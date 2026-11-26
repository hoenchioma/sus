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
  PAIRS: DurableObjectNamespace<PairObject>;
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

/** On Cloudflare's free plan, every storage call throws this once the day's write allowance is used up. */
const isQuotaError = (e: unknown) => e instanceof Error && /exceeded allowed .* durable objects free tier/i.test(e.message);

/** The daily allowance resets at midnight UTC. */
function quotaResetsAt() {
  const d = new Date();
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
}

const quotaResponse = () => json({ error: 'quota', resetAt: quotaResetsAt() }, 503);
const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

export class RoomObject extends DurableObject<Env> {
  private room: AnyRoom | null = null;
  /** Set while saves fail on the daily quota: the room keeps running from memory and players are warned. */
  private storageFull = false;

  private gameEnv(): GameEnv {
    return { now: Date.now(), random: Math.random, id: () => crypto.randomUUID() };
  }

  private async load(): Promise<AnyRoom | null> {
    this.room ??= (await this.ctx.storage.get<AnyRoom>('room')) ?? null;
    return this.room;
  }

  private async save({ afterAlarm = false } = {}) {
    if (!this.room) return;
    this.room.tvConnected = this.sockets().some(({ att }) => att.tv);
    try {
      await this.writeRoom(afterAlarm);
      this.storageFull = false;
    } catch (error) {
      if (!isQuotaError(error)) throw error;
      if (!this.storageFull) console.warn('storage quota used up; room continues from memory', { code: this.room.code });
      this.storageFull = true;
    }
  }

  private async writeRoom(afterAlarm: boolean) {
    if (!this.room) return;
    await this.ctx.storage.put('room', this.room);
    let due = games.alarm(this.room);
    if (afterAlarm && due !== null && due <= Date.now()) {
      // The alarm just ran and the timer is still overdue, so another alarm can't move it either.
      // Rescheduling would loop forever and burn the storage write quota; drop it and leave a trace instead.
      console.error('room timer stuck after alarm', { code: this.room.code, phase: this.room.phase, due });
      due = null;
    }
    const alarms = [due, this.everyoneGone() ? Date.now() + ROOM_TTL_MS : null].filter((t): t is number => t !== null);
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
        ws.send(JSON.stringify(this.viewMessage(att)));
      } catch (error) {
        // A closed socket is cleaned up by webSocketClose; anything else is a bug worth seeing in the logs.
        if (!(error instanceof TypeError)) console.error('broadcast failed', error);
      }
    }
  }

  private viewMessage(att: Attachment) {
    return {
      type: 'view',
      now: Date.now(),
      view: games.view(this.room!, att.tv ? 'tv' : att.playerId!),
      storageFullUntil: this.storageFull ? quotaResetsAt() : null,
    };
  }

  private async commit() {
    await this.save();
    this.broadcast();
  }

  async fetch(request: Request): Promise<Response> {
    try {
      return await this.handle(request);
    } catch (error) {
      if (!isQuotaError(error)) throw error;
      // The room couldn't even be read, so there is nothing to keep running; tell the client plainly.
      if (request.headers.get('Upgrade') !== 'websocket') return quotaResponse();
      const pair = new WebSocketPair();
      pair[1].accept();
      pair[1].send(JSON.stringify({ type: 'quota', resetAt: quotaResetsAt() }));
      pair[1].close(4003, 'storage quota');
      return new Response(null, { status: 101, webSocket: pair[0] });
    }
  }

  private async handle(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/init') {
      if (await this.load()) return json({ error: 'exists' }, 409);
      const { code, game, skin } = (await request.json()) as { code: string; game?: string; skin?: quest.QuestSkinId };
      this.room = game === 'quest' ? quest.createQuestRoom(code, Date.now(), skin) : createRoom(code, Date.now());
      await this.save();
      if (this.storageFull) {
        // A brand-new room living only in memory would vanish the moment its last phone dropped.
        this.room = null;
        return quotaResponse();
      }
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
    try {
      await this.handleMessage(ws, raw);
    } catch (error) {
      if (isQuotaError(error)) {
        ws.send(JSON.stringify({ type: 'quota', resetAt: quotaResetsAt() }));
        ws.close(4003, 'storage quota');
        return;
      }
      console.error('message failed', error);
      ws.send(JSON.stringify({ type: 'error', message: 'Something went wrong on the server. Try that again.' }));
    }
  }

  private async handleMessage(ws: WebSocket, raw: string | ArrayBuffer) {
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
      if (att.playerId || att.tv) ws.send(JSON.stringify(this.viewMessage(att)));
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
    const room = await this.load().catch((error) => {
      if (isQuotaError(error)) return null;
      throw error;
    });
    if (!room) return;
    const att = (ws.deserializeAttachment() ?? { playerId: null, tv: false }) as Attachment;
    const stillOpen = this.sockets().some((s) => s.ws !== ws && s.att.playerId && s.att.playerId === att.playerId);
    if (att.playerId && !stillOpen) games.connected(room, att.playerId, false, Date.now());
    await this.commit();
  }

  async alarm() {
    try {
      await this.runAlarm();
    } catch (error) {
      // Throwing would make Cloudflare retry the alarm, which only fails again until the quota resets.
      // Connected phones keep timers moving through their pings meanwhile.
      if (!isQuotaError(error)) throw error;
      console.warn('alarm skipped: storage quota used up');
    }
  }

  private async runAlarm() {
    const room = await this.load();
    if (!room) return;
    if (this.everyoneGone() && Math.max(room.createdAt, ...room.members.map((m) => m.lastSeen)) + ROOM_TTL_MS <= Date.now()) {
      await this.ctx.storage.deleteAll();
      this.room = null;
      return;
    }
    games.tick(room, this.gameEnv());
    await this.save({ afterAlarm: true });
    this.broadcast();
  }
}

/**
 * Lets a TV join a room without typing an address: the TV shows a short code and waits here on a
 * socket, and the host's phone sends the room code to it. Nothing is stored.
 */
export class PairObject extends DurableObject<Env> {
  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') === 'websocket') {
      const pair = new WebSocketPair();
      if (this.ctx.getWebSockets().length) {
        // Another TV is already showing this code; it picks a fresh one.
        pair[1].accept();
        pair[1].send(JSON.stringify({ type: 'taken' }));
        pair[1].close(4009, 'code taken');
      } else {
        this.ctx.acceptWebSocket(pair[1]);
      }
      return new Response(null, { status: 101, webSocket: pair[0] });
    }
    const { room } = (await request.json().catch(() => ({}))) as { room?: string };
    if (!room || !/^[A-Z]{4}$/.test(room)) return json({ error: 'Bad room code' }, 400);
    const tvs = this.ctx.getWebSockets();
    if (!tvs.length) return json({ error: 'No TV is showing that code' }, 404);
    for (const ws of tvs) ws.send(JSON.stringify({ type: 'paired', room }));
    return json({ ok: true });
  }

  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    if (message === 'ping') ws.send('pong');
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
        if (res.status === 503) return res;
      }
      return json({ error: 'Could not create a room, try again' }, 503);
    }

    const pairing = url.pathname.match(/^\/api\/pair\/(\d{4})(\/ws)?$/);
    if (pairing) {
      const stub = env.PAIRS.get(env.PAIRS.idFromName(pairing[1]!));
      return stub.fetch(new Request('https://pair/', request));
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
