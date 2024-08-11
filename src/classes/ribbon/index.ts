import { Emitter, Game, Events } from "../../types";
import { API, APITypes } from "../../utils";
import { EventEmitter } from "node:events";
import { WebSocket } from "ws";
import { RibbonEvents } from "./types";
import { Bits, Codec, CodecType } from "./codec";
import { remotePack } from "./remote-pack";

const RIBBON_CLOSE_CODES = {
  1000: "Ribbon closed normally",
  1001: "Client closed ribbon",
  1002: "Protocol error",
  1003: "Protocol violation",
  1005: "No reason given",
  1006: "Ribbon lost",
  1007: "Payload data corrupted",
  1008: "Protocol violation",
  1009: "Too much data",
  1010: "Negotiation error",
  1011: "Server error",
  1012: "Server restarting",
  1013: "Temporary error",
  1014: "Bad gateway",
  1015: "TLS error"
} as const;

export class Ribbon {
  private ws: WebSocket | null = null;
  private token: string;
  private userAgent: string;
  private api: API;
  private codec = new Codec();
  private codecMethod: CodecType;
  private pptr?: Awaited<ReturnType<typeof remotePack>>;
  private codecQueue = {
    send: {
      latest: -1,
      last: -1,
      queue: [] as { id: number; data: Buffer }[]
    },
    receive: {
      last: -1,
      queue: [] as { id: number; data: any }[]
    }
  };

  private spool: {
    endpoint?: string;
    detail?: string;
    token?: string;
    tokenid?: string;
    signature?: APITypes.Server.Signature;
    authed: boolean;
    migrated?: boolean;
  } = {
    authed: false
  };

  private session: {
    ready?: boolean;
    flags: number;
    lastPong?: number;
    lastSent: number;
    lastReceived: number;
    open: boolean;
    id?: string;
    messageQueue: any[];
    messageHistory: any[];
  } = {
    flags: 0,
    open: false,
    messageQueue: [],
    messageHistory: [],
    lastSent: 0,
    lastReceived: 0
  };

  private heartbeat?: NodeJS.Timeout;

  emitter: Emitter<Events.in.all> = new EventEmitter();
  handling: Game.Handling;

  private listeners: {
    type: "send" | "receive";
    callback: (message: Events.in.Client["client.ribbon.receive"]) => void;
  }[] = [];

  static FLAGS = {
    ALIVE: 1,
    SUCCESSFUL: 2,
    CONNECTING: 4,
    FAST_PING: 8,
    TIMING_OUT: 16,
    DEAD: 32
  };
  /** @hideconstructor */
  constructor({
    token,
    userAgent,
    handling,
    codec = "pptr"
  }: {
    token: string;
    userAgent: string;
    handling: Game.Handling;
    codec?: CodecType;
  }) {
    this.token = token;
    this.handling = handling;
    this.userAgent = userAgent;
    this.codecMethod = codec;
    this.api = new API({ token, userAgent });
  }

  async connect() {
    const spool = this.spool.endpoint
      ? { endpoint: this.spool.endpoint, token: this.spool.token }
      : await this.api.server.spool();

    this.session.lastPong = performance.now();
    this.spool = { ...this.spool, ...spool };
    this.spool.signature = (await this.api.server.environment()).signature;

    if (this.codecMethod === "pptr") {
      this.pptr = await remotePack();
    }

    this.ws = new WebSocket(`wss:${this.spool.endpoint}`, this.spool.token, {
      headers: {
        "user-agent": this.userAgent
      }
    });

    this.ws.on("open", this.onWSOpen.bind(this));
    this.ws.on("message", this.onWSMessage.bind(this));
    this.ws.on("close", this.onWSClose.bind(this));
  }

  async encode(msg: string, data?: Record<string, any>) {
    return this.codecMethod === "pptr"
      ? await this.pptr!.encode(msg, data)
      : this.codec.encode(msg, data);
  }

  async decode(data: Buffer) {
    if (this.codecMethod === "pptr") {
      const queueItem = {
        id: ++this.codecQueue.receive.last,
        data: undefined as any
      };
      this.codecQueue.receive.queue.push(queueItem);
      queueItem.data = await this.pptr!.decode(data);

      if (queueItem.data.command === "packets") {
        const packets = queueItem.data.data.packets;
        queueItem.data = undefined;
        this.codecQueue.receive.queue.forEach((item) => {
          if (item.id > queueItem.id) item.id += packets.length;
        });
        await Promise.all(
          packets.map(async (packet: Buffer, i: number) => {
            const q = { id: queueItem.id + i + 1, data: undefined };
            this.codecQueue.receive.queue.push(q);
            this.codecQueue.receive.queue = this.codecQueue.receive.queue.sort(
              (a, b) => a.id - b.id
            );
            const decoded = await this.pptr!.decode(packet);
            q.data = decoded;
          })
        );
        queueItem.data = { command: "packets", data: packets };
      }
      while (
        this.codecQueue.receive.queue[0] &&
        this.codecQueue.receive.queue[0].data !== undefined
      ) {
        const item = this.codecQueue.receive.queue.shift()!;
        if (item.data.command !== "packets") this.handleMessage(item.data);
      }
    } else {
      const item = this.codec.decode(data);
      if (item.command === "packets") {
        for (const packet of item.data.packets) {
          const decodedPacket = await this.decode(packet);
          this.handleMessage(decodedPacket);
        }
      } else this.handleMessage(item);
    }
  }

  private async pipe(msg: string, data?: Record<string, any>) {
    if (!this.ws) return this.session.messageQueue.push({ command: msg, data });

    const queueItem = {
      id: ++this.codecQueue.send.last,
      data: await this.encode(msg, data)
    };

    if (queueItem.data[0] & Codec.FLAGS.F_ID) {
      const id = ++this.session.lastSent!;
      new Bits(queueItem.data).seek(8).write(id, 24);
    }

    if (this.codecMethod === "pptr") {
      if (this.codecQueue.send.latest === queueItem.id - 1) {
        this.ws.send(queueItem.data);
        this.codecQueue.send.latest = queueItem.id;
        while (
          this.codecQueue.send.queue[0] &&
          this.codecQueue.send.queue[0].id === this.codecQueue.send.latest + 1
        ) {
          const item = this.codecQueue.send.queue.shift()!;
          this.ws.send(item.data);
          this.codecQueue.send.latest++;
        }
      } else {
        this.codecQueue.send.queue.push(queueItem);
      }
    } else {
      this.ws.send(queueItem.data);
    }
    if (msg !== "ping")
      this.listeners
        .filter((l) => l.type === "send")
        .forEach((l) =>
          l.callback(data ? { command: msg, data } : { command: msg })
        );
  }

  private ping() {
    this.pipe("ping", { recvid: this.session.lastReceived });
  }

  private async onWSOpen() {
    this.session.open = true;
    this.session.flags |= Ribbon.FLAGS.ALIVE | Ribbon.FLAGS.SUCCESSFUL;
    this.session.flags &= ~Ribbon.FLAGS.TIMING_OUT;

    if (!this.spool.authed) {
      this.pipe("new");
    } else {
      this.pipe("session", {
        ribbonid: this.session.id,
        tokenid: this.spool.tokenid
      });
    }
    this.session.lastPong = performance.now();

    this.heartbeat = setInterval(() => {
      if (this.ws!.readyState !== 1) return;
      if (performance.now() - this.session.lastPong! > 30000)
        return this.ws!.close(3001, "pong timeout");
      this.ping();
    }, 2500);
  }

  private handleMigrate = async (newEndpoint: string) => {
    if (this.spool.migrated) {
      return;
    }
    this.spool.endpoint = `${this.spool.endpoint!.split("/ribbon/")[0]}${newEndpoint}`;

    this.die();
    this.spool.migrated = true;
    await this.connect();
  };

  private async onWSMessage(data: any) {
    await this.decode(data);
  }

  private onWSClose(e: number) {
    if (!this.spool.authed) {
      return this.connect();
    }

    this.ws!.removeAllListeners();
    this.session.open = false;
    clearInterval(this.heartbeat);

    const code = e.toString();
    const closeReason =
      code in RIBBON_CLOSE_CODES
        ? RIBBON_CLOSE_CODES[code as unknown as keyof typeof RIBBON_CLOSE_CODES]
        : "Unknown reason: " + code;

    this.emitter.emit("client.close", closeReason);
  }

  private handleMessage(msg: any): void {
    if (msg.id) {
      this.session.lastReceived = msg.id;
    }
    if (msg.command !== "ping") {
      this.listeners
        .filter((l) => l.type === "receive")
        .forEach((l) => l.callback(msg));
    }

    const m: RibbonEvents.Raw<Events.in.all> = msg;

    switch (m.command) {
      case "ping":
        this.session.lastPong = performance.now();
        return;
      case "session":
        this.session.id = m.data.ribbonid;
        this.spool.tokenid = m.data.tokenid;
        if (!this.spool.authed) {
          this.pipe("server.authorize", {
            token: this.token,
            handling: this.handling,
            signature: this.spool.signature,
            i: undefined
          });
        }
        return;
      case "server.authorize":
        if (m.data.success) {
          this.spool.authed = true;
          this.emit("social.presence", {
            status: "online",
            detail: "menus"
          });
          this.ping();

          this.emitter.emit("client.ready", {
            endpoint: this.spool.endpoint!,
            social: m.data.social
          });
        } else {
          this.emitter.emit("client.error", "Failure to authorize ribbon");
        }
        this.pipe("ping", { recvid: this.session.lastReceived });
        break;
      case "server.migrate":
        this.handleMigrate(m.data.endpoint);
        break;
      case "server.migrated":
        while (this.session.messageQueue.length > 0) {
          const message = this.session.messageQueue.shift()!;
          this.pipe(message.command, message.data);
        }
        break;
      case "kick":
      case "nope":
        console.log(m);
        this.die(true);
        break;
    }
    this.emitter.emit(m.command, (m as any).data);
  }

  emit<T extends keyof Events.out.all>(
    event: T,
    ...data: Events.out.all[T] extends void ? [] : [Events.out.all[T]]
  ) {
    if (event.startsWith("client.")) {
      this.emitter.emit(event, data[0]);
      return;
    }

    const msg = data[0]
      ? {
          command: event,
          data: data[0],
          id: this.session.lastSent
        }
      : {
          command: event,
          id: this.session.lastSent
        };
    this.session.messageQueue.push(msg);
    this.session.messageHistory.push(msg);

    if (this.session.messageQueue.length >= 500)
      this.session.messageHistory.shift();

    if (!this.session.open) {
      return;
    }

    for (let i = 0; i < this.session.messageQueue!.length; i++) {
      const message = this.session.messageQueue!.shift();
      // log('sendMessage', message)
      this.pipe(message.command, message.data);
    }
  }

  on(
    event: (typeof this.listeners)[number]["type"],
    callback: (typeof this.listeners)[number]["callback"]
  ) {
    this.listeners.push({
      type: event,
      callback
    });
  }

  off(
    event: (typeof this.listeners)[number]["type"],
    callback: (typeof this.listeners)[number]["callback"]
  ) {
    this.listeners = this.listeners.filter(
      (l) => l.type === event && l.callback !== callback
    );
  }

  die(permanent = false) {
    if (!this.session.open) return;

    this.session.open = false;

    if (this.ws) this.ws.close(1000, "die");

    if (permanent) {
      this.emitter.emit("client.dead", undefined);
    }
  }

  destroy() {
    (this.emitter as unknown as EventEmitter).removeAllListeners();
    this.spool.authed = false;
    this.ws?.removeAllListeners();
    this.die(true);
  }
}
