import { Emitter, Game, Events } from "../../types";
import { API, APITypes } from "../../utils";
import { EventEmitter } from "node:events";
import { WebSocket } from "ws";
import { RibbonEvents } from "./types";
import { Bits, Codec, CodecType } from "./codec";
import { vmPack } from "./vm-pack";
import chalk from "chalk";

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
  private codecVM?: Awaited<ReturnType<typeof vmPack>>;
  private globalVM: boolean;

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
  verbose: boolean = false;

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
    codec = "vm",
    verbose = false,
    globalVM = false
  }: {
    token: string;
    userAgent: string;
    handling: Game.Handling;
    codec?: CodecType;
    verbose?: boolean;
    globalVM?: boolean;
  }) {
    this.token = token;
    this.handling = handling;
    this.userAgent = userAgent;
    this.codecMethod = codec;
    this.api = new API({ token, userAgent });
    this.verbose = verbose;
    this.globalVM = globalVM;
  }

  log(
    msg: string,
    {
      force = false,
      level = "info"
    }: { force: boolean; level: "info" | "warning" | "error" } = {
      force: false,
      level: "info"
    }
  ) {
    if (!this.verbose && !force) return;
    const func =
      level === "info"
        ? chalk.blue
        : level === "warning"
          ? chalk.yellow
          : chalk.red;
    console.log(`${func("[🎀\u2009Ribbon]")}: ${msg}`);
  }

  async connect() {
    const spool = this.spool.endpoint
      ? { endpoint: this.spool.endpoint, token: this.spool.token }
      : await this.api.server.spool();

    this.session.lastPong = performance.now();
    this.spool = { ...this.spool, ...spool };
    this.spool.signature = (await this.api.server.environment()).signature;

    if (this.codecMethod === "vm") {
      this.codecVM = await vmPack(this.userAgent, { globalVM: this.globalVM });
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

  static SLOW_CODEC_THRESHOLD = 100;

  encode(msg: string, data?: Record<string, any>): Buffer {
    const start = performance.now();
    const res =
      this.codecMethod === "vm"
        ? this.codecVM!.encode(msg, data)
        : this.codec.encode(msg, data);
    const end = performance.now();
    if (end - start > Ribbon.SLOW_CODEC_THRESHOLD) {
      this.log(`Slow encode: ${msg} (${end - start}ms)`, {
        force: true,
        level: "warning"
      });
    }
    return res;
  }

  decode(data: Buffer) {
    const start = performance.now();
    const res =
      this.codecMethod === "vm"
        ? this.codecVM!.decode(data)
        : this.codec.decode(data);
    const end = performance.now();
    if (end - start > Ribbon.SLOW_CODEC_THRESHOLD) {
      this.log(`Slow decode: ${res.command} (${end - start}ms)`, {
        force: true,
        level: "warning"
      });
    }
    return res;
  }

  private pipe(msg: string, data?: Record<string, any>) {
    if (!this.ws) return this.session.messageQueue.push({ command: msg, data });

    const encoded = this.encode(msg, data);

    if (encoded[0] & Codec.FLAGS.F_ID) {
      const id = ++this.session.lastSent!;
      new Bits(encoded).seek(8).write(id, 24);
    }

    this.ws.send(encoded);
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
    if (this.verbose)
      this.log(
        `Connected to <${this.spool.endpoint?.split(".")[0]}/${this.spool.endpoint?.split("/").at(-1)}>`
      );
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

  private onWSMessage(data: any) {
    const item = this.decode(data);
    if (item.command === "packets") {
      for (const packet of item.data.packets) {
        const decodedPacket = this.decode(packet);
        this.handleMessage(decodedPacket);
      }
    } else this.handleMessage(item);
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
          this.log("Authorized");
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
        this.log(`Migrating to ${m.data.endpoint}`);
        break;
      case "server.migrated":
        while (this.session.messageQueue.length > 0) {
          const message = this.session.messageQueue.shift()!;
          this.pipe(message.command, message.data);
        }
        break;
      case "kick":
      case "nope":
        this.log(
          `${m.command}${m.command === "kick" ? "ed" : "d"}: ${m.data.reason}`,
          { force: true, level: "error" }
        );
        this.destroy();
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