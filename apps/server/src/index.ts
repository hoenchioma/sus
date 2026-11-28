import { DurableObject } from 'cloudflare:workers';
import {
  apply,
  createRoom,
  join,
  mafiaRoomRecord,
  nextAlarm,
  roomWithPeople,
  quest,
  setConnected,
  questRoomRecord,
  tick,
  trackerRecord,
  useRejoinCode,
  viewFor,
  type Command,
  type Env as GameEnv,
  type GameRecord,
  type Member,
  type Room,
} from '@sus/engine';
import { isDeviceId, saveRecord, type StatsEnv } from './stats';

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

interface Env extends StatsEnv {
  ROOMS: DurableObjectNamespace<RoomObject>;
  PAIRS: DurableObjectNamespace<PairObject>;
  /** Where <site>/tv.apk points: the Android TV app's download, set at deploy time. */
  TV_APP_URL?: string;
  ASSETS: Fetcher;
}

/** What each socket is: a player, the TV, or not joined yet. */
interface Attachment {
  playerId: string | null;
  tv: boolean;
}

type ClientMessage =
  | { type: 'join'; name: string; device?: string; test?: boolean }
  | { type: 'rejoin'; code: string; device?: string; test?: boolean }
  | { type: 'ping' }
  | { type: 'command'; command: unknown }
  | { type: 'switchGame'; game: 'mafia' | 'quest' };

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
    const record = this.finishedGame();
    try {
      await this.writeRoom(afterAlarm);
      this.storageFull = false;
    } catch (error) {
      if (!isQuotaError(error)) throw error;
      if (!this.storageFull) console.warn('storage quota used up; room continues from memory', { code: this.room.code });
      this.storageFull = true;
    }
    if (record) this.ctx.waitUntil(saveRecord(this.env, record).catch((error) => console.error('stats not saved', error)));
  }

  /** The record of a game that has just ended, once per ending (a game can end again after the host undoes a step). */
  private finishedGame(): GameRecord | null {
    const room = this.room!;
    if (room.phase !== 'over' || !this.env.STATS) return null;
    const key = `${room.gameId}:${room.steps.length}`;
    if (room.recorded === key) return null;
    room.recorded = key;
    try {
      const meta = { endedAt: Date.now() };
      return isQuest(room) ? questRoomRecord(room, meta) : mafiaRoomRecord(room, meta);
    } catch (error) {
      console.error('stats record failed', error);
      return null;
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
      // A random ID from the phone, so the same phone can be recognised across games in the stats.
      if (isDeviceId(msg.device)) result.device = msg.device;
      if (msg.test === true) result.test = true;
      ws.serializeAttachment({ playerId: result.id, tv: false } satisfies Attachment);
      ws.send(JSON.stringify({ type: 'joined', token: result.token }));
      return this.commit();
    }

    if (!att.playerId) return fail('Join the room first');

    if (msg.type === 'switchGame') {
      // One room for the whole evening: the host swaps games between rounds and nobody has to rejoin.
      if (att.playerId !== room.hostId) return fail('Only the host can change the game');
      if (room.phase !== 'lobby' && room.phase !== 'over') return fail('Finish this game first');
      if (msg.game === (isQuest(room) ? 'quest' : 'mafia')) return;
      const next = msg.game === 'quest' ? quest.questRoomWithPeople(room) : roomWithPeople(room);
      if (typeof next === 'string') return fail(next);
      this.room = next;
      await this.save();
      // Every screen reloads into the other game's layout; their saved tokens bring them straight back in.
      for (const { ws: socket } of this.sockets()) socket.send(JSON.stringify({ type: 'gameChanged' }));
      return;
    }
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
  /**
   * The room this TV was sent to. Whoever claims the code first decides it; anyone scanning the TV's code
   * afterwards (or at the same moment) is pointed at the same room. Memory only: it only needs to last
   * while people are gathering.
   */
  private linked: string | null = null;

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') === 'websocket') {
      const pair = new WebSocketPair();
      if (this.ctx.getWebSockets().length) {
        // Another TV is already showing this code; it picks a fresh one.
        pair[1].accept();
        pair[1].send(JSON.stringify({ type: 'taken' }));
        pair[1].close(4009, 'code taken');
      } else {
        this.linked = null;
        this.ctx.acceptWebSocket(pair[1]);
      }
      return new Response(null, { status: 101, webSocket: pair[0] });
    }

    if (request.method === 'GET') {
      if (this.linked) return json({ room: this.linked });
      return this.ctx.getWebSockets().length ? json({ room: null }) : json({ error: 'No TV is showing that code' }, 404);
    }

    const { room } = (await request.json().catch(() => ({}))) as { room?: string };
    if (!room || !/^[A-Z]{4}$/.test(room)) return json({ error: 'Bad room code' }, 400);
    // No await between this check and the claim below, so two phones can't both win.
    if (this.linked) return json({ room: this.linked });
    const tvs = this.ctx.getWebSockets();
    if (!tvs.length) return json({ error: 'No TV is showing that code' }, 404);
    this.linked = room;
    for (const ws of tvs) ws.send(JSON.stringify({ type: 'paired', room }));
    return json({ room });
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

    if (url.pathname === '/api/stats/games' && request.method === 'POST') {
      // A one-phone game, sent by the phone once it ends. Silent either way: the phone doesn't retry on errors.
      const body = await request.text();
      if (body.length > 100_000) return json({ error: 'Too big' }, 413);
      let upload: unknown;
      try {
        upload = JSON.parse(body);
      } catch {
        return json({ error: 'Bad upload' }, 400);
      }
      const record = trackerRecord(upload, Date.now());
      if (typeof record === 'string') return json({ error: record }, 400);
      const device = (upload as { device?: unknown }).device;
      await saveRecord(env, record, isDeviceId(device) ? device : null).catch((error) => console.error('stats not saved', error));
      return new Response(null, { status: 204 });
    }

    if (url.pathname === '/tv.apk') {
      if (!env.TV_APP_URL) return new Response('The TV app is not published for this site.', { status: 404 });
      return Response.redirect(env.TV_APP_URL, 302);
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
