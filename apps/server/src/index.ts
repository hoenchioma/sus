import { DurableObject } from 'cloudflare:workers';
import {
  apply,
  createRoom,
  join,
  nextAlarm,
  quest,
  setConnected,
  tick,
  useRejoinCode,
  viewFor,
  type Command,
  type Env as GameEnv,
  type Member,
  type Room,
} from '@sus/engine';

type AnyRoom = Room | quest.QuestRoom;

const isQuest = (room: AnyRoom): room is quest.QuestRoom => 'kind' in room && room.kind === 'quest';

/** One interface over both games so the Durable Object stays game-agnostic. */
const games = {
  join: (room: AnyRoom, name: string, env: GameEnv): Member | string =>
    isQuest(room) ? quest.joinQuest(room, name, env) : join(room, name, env),
  rejoin: (room: AnyRoom, code: string, env: GameEnv) =>
    isQuest(room) ? quest.useQuestRejoinCode(room, code, env) : useRejoinCode(room, code, env),
  connected: (room: AnyRoom, id: string, on: boolean, now: number) =>
    isQuest(room) ? quest.setQuestConnected(room, id, on, now) : setConnected(room, id, on, now),
  apply: (room: AnyRoom, id: string, cmd: unknown, env: GameEnv) =>
    isQuest(room) ? quest.applyQuest(room, id, cmd as quest.QuestCommand, env) : apply(room, id, cmd as Command, env),
  tick: (room: AnyRoom, env: GameEnv) => (isQuest(room) ? quest.tickQuest(room, env) : tick(room, env)),
  alarm: (room: AnyRoom) => (isQuest(room) ? quest.questNextAlarm(room) : nextAlarm(room)),
  view: (room: AnyRoom, viewer: string) => (isQuest(room) ? quest.viewQuest(room, viewer) : viewFor(room, viewer)),
};

interface Env {
  ROOMS: DurableObjectNamespace<RoomObject>;
  ASSETS: Fetcher;
}

/** What each socket is: a player, the TV, or not joined yet. */
interface Attachment {
  playerId: string | null;
  tv: boolean;
}

type ClientMessage =
  | { type: 'join'; name: string }
  | { type: 'rejoin'; code: string }
  | { type: 'ping' }
  | { type: 'command'; command: unknown };

const ROOM_TTL_MS = 24 * 60 * 60 * 1000;
const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

export class RoomObject extends DurableObject<Env> {
  private room: AnyRoom | null = null;

  private gameEnv(): GameEnv {
    return { now: Date.now(), random: Math.random, id: () => crypto.randomUUID() };
  }

  private async load(): Promise<AnyRoom | null> {
    this.room ??= (await this.ctx.storage.get<AnyRoom>('room')) ?? null;
    return this.room;
  }

  private async save() {
    if (!this.room) return;
    this.room.tvConnected = this.sockets().some(({ att }) => att.tv);
    await this.ctx.storage.put('room', this.room);
    const alarms = [games.alarm(this.room), this.everyoneGone() ? Date.now() + ROOM_TTL_MS : null].filter((t): t is number => t !== null);
    if (alarms.length) await this.ctx.storage.setAlarm(Math.max(Date.now() + 50, Math.min(...alarms)));
    else await this.ctx.storage.deleteAlarm();
  }

  private sockets() {
    return this.ctx.getWebSockets().map((ws) => ({ ws, att: (ws.deserializeAttachment() ?? { playerId: null, tv: false }) as Attachment }));
  }

  private everyoneGone() {
    return this.sockets().length === 0;
  }

  private broadcast() {
    if (!this.room) return;
    for (const { ws, att } of this.sockets()) {
      if (!att.playerId && !att.tv) continue;
      try {
        ws.send(JSON.stringify({ type: 'view', now: Date.now(), view: games.view(this.room, att.tv ? 'tv' : att.playerId!) }));
      } catch (error) {
        // A closed socket is cleaned up by webSocketClose; anything else is a bug worth seeing in the logs.
        if (!(error instanceof TypeError)) console.error('broadcast failed', error);
      }
    }
  }

  private async commit() {
    await this.save();
    this.broadcast();
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/init') {
      if (await this.load()) return json({ error: 'exists' }, 409);
      const { code, game, skin } = (await request.json()) as { code: string; game?: string; skin?: quest.QuestSkinId };
      this.room = game === 'quest' ? quest.createQuestRoom(code, Date.now(), skin) : createRoom(code, Date.now());
      await this.save();
      return json({ code });
    }

    const room = await this.load();
    if (!room) return json({ error: 'No room with that code' }, 404);
    // Catch up on any timer whose alarm was missed, so activity alone keeps a room moving.
    games.tick(room, this.gameEnv());

    if (request.headers.get('Upgrade') !== 'websocket') {
      return json({ code: room.code, game: isQuest(room) ? 'quest' : 'mafia', phase: room.phase, players: room.members.length });
    }

    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    const token = url.searchParams.get('token');
    const member = token ? room.members.find((m) => m.token === token) : undefined;
    const att: Attachment = { playerId: member?.id ?? null, tv: url.searchParams.get('tv') === '1' };
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment(att);

    if (member) games.connected(room, member.id, true, Date.now());
    if (att.tv || member) {
      await this.commit();
    } else {
      server.send(JSON.stringify({ type: 'needJoin', phase: room.phase }));
      await this.save();
    }
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    const room = await this.load();
    if (!room || typeof raw !== 'string') return;
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw) as ClientMessage;
    } catch {
      return;
    }
    const att = (ws.deserializeAttachment() ?? { playerId: null, tv: false }) as Attachment;
    const env = this.gameEnv();
    if (msg.type === 'ping') {
      // Pings double as a safety net for missed alarms: catch up on overdue timers and tell everyone if anything moved.
      const before = JSON.stringify(room);
      games.tick(room, env);
      if (JSON.stringify(room) !== before) return this.commit();
      if (att.playerId || att.tv) ws.send(JSON.stringify({ type: 'view', now: Date.now(), view: games.view(room, att.tv ? 'tv' : att.playerId!) }));
      else ws.send(JSON.stringify({ type: 'pong' }));
      return;
    }
    games.tick(room, env);
    const fail = (message: string) => ws.send(JSON.stringify({ type: 'error', message }));

    if (msg.type === 'join' || msg.type === 'rejoin') {
      const result = msg.type === 'join' ? games.join(room, msg.name, env) : games.rejoin(room, msg.code, env) ?? 'That code is not valid';
      if (typeof result === 'string') return fail(result);
      ws.serializeAttachment({ playerId: result.id, tv: false } satisfies Attachment);
      ws.send(JSON.stringify({ type: 'joined', token: result.token }));
      return this.commit();
    }

    if (!att.playerId) return fail('Join the room first');
    const error = games.apply(room, att.playerId, msg.command, env);
    if (error) fail(error);
    await this.commit();
  }

  async webSocketClose(ws: WebSocket) {
    await this.disconnect(ws);
  }

  async webSocketError(ws: WebSocket) {
    await this.disconnect(ws);
  }

  private async disconnect(ws: WebSocket) {
    const room = await this.load();
    if (!room) return;
    const att = (ws.deserializeAttachment() ?? { playerId: null, tv: false }) as Attachment;
    const stillOpen = this.sockets().some((s) => s.ws !== ws && s.att.playerId && s.att.playerId === att.playerId);
    if (att.playerId && !stillOpen) games.connected(room, att.playerId, false, Date.now());
    await this.commit();
  }

  async alarm() {
    const room = await this.load();
    if (!room) return;
    if (this.everyoneGone() && Math.max(room.createdAt, ...room.members.map((m) => m.lastSeen)) + ROOM_TTL_MS <= Date.now()) {
      await this.ctx.storage.deleteAll();
      this.room = null;
      return;
    }
    games.tick(room, this.gameEnv());
    await this.commit();
  }
}

function newCode() {
  return Array.from({ length: 4 }, () => CODE_LETTERS[Math.floor(Math.random() * CODE_LETTERS.length)]).join('');
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/rooms' && request.method === 'POST') {
      const options = (await request.json().catch(() => ({}))) as { game?: string; skin?: string };
      for (let attempt = 0; attempt < 8; attempt++) {
        const code = newCode();
        const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
        const res = await stub.fetch('https://room/init', { method: 'POST', body: JSON.stringify({ ...options, code }) });
        if (res.ok) return json({ code });
      }
      return json({ error: 'Could not create a room, try again' }, 503);
    }

    const match = url.pathname.match(/^\/api\/rooms\/([A-Za-z]{4})(\/ws)?$/);
    if (match) {
      const code = match[1]!.toUpperCase();
      const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
      return stub.fetch(new Request(`https://room/${code}${url.search}`, request));
    }

    if (url.pathname.startsWith('/api/')) return json({ error: 'Not found' }, 404);
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
