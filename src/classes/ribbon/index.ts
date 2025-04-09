import { Emitter, Events, Game } from "../../types";
import { API, APITypes } from "../../utils";
import { Bits } from "./bits";
import { Codec, CodecType } from "./codec";
import { FullCodec } from "./codec-full";
import { tetoPack } from "./teto-pack";
import { RibbonEvents } from "./types";
import { vmPack } from "./vm-pack";

import { EventEmitter } from "node:events";

import chalk from "chalk";
import { client as WebSocket, connection as Connection } from "websocket";

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
  private ws: Connection | null = null;
  private token: string;
  private userAgent: string;
  private api: API;
  private codec = new Codec();
  private codec2 = FullCodec;
  private codecMethod: CodecType;
  private codecVM?: Awaited<ReturnType<typeof vmPack>>;
  private codecWrapper?: Awaited<ReturnType<typeof tetoPack>>;
  private globalVM: boolean;
  private globalTeto: boolean;

  private spool: {
    endpoint?: string;
    detail?: string;
    token?: string;
    tokenid?: string;
    signature?: Promise<APITypes.Server.Signature>;
    migrated?: boolean;
  } = {};

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
    codec = "teto",
    verbose = false,
    globalVM = false,
    globalPacker = false
  }: {
    token: string;
    userAgent: string;
    handling: Game.Handling;
    codec?: CodecType;
    verbose?: boolean;
    globalVM?: boolean;
    globalPacker?: boolean;
  }) {
    this.token = token;
    this.handling = handling;
    this.userAgent = userAgent;
    this.codecMethod = codec;
    this.api = new API({ token, userAgent });
    this.verbose = verbose;
    this.globalVM = globalVM;
    this.globalTeto = globalPacker;
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
    const envPromise = this.api.server.environment();

    const vmPromise =
      this.codecMethod === "vm"
        ? vmPack(this.userAgent, { globalVM: this.globalVM })
        : Promise.resolve(undefined);
    const packerPromise =
      this.codecMethod === "teto"
        ? tetoPack(this.userAgent, { global: this.globalTeto })
        : Promise.resolve(undefined);

    const spool = this.spool.endpoint
      ? Promise.resolve({
          endpoint: this.spool.endpoint,
          token: this.spool.token
        })
      : this.api.server.spool();

    this.session.lastPong = performance.now();
    this.spool.signature = new Promise<APITypes.Server.Signature>(
      async (r) => await envPromise.then((s) => r(s.signature))
    );

    this.codecVM = await vmPromise;
    this.codecWrapper = await packerPromise;

    this.spool = { ...this.spool, ...(await spool) };

    if (this.verbose) {
      this.log(
        `Connecting to <${this.spool.endpoint?.split(".")[0]}/${this.spool.endpoint?.split("/").at(-1)}>`
      );
    }

    const wsClient = new WebSocket();

    wsClient.on("connectFailed", (error: { toString: () => string }) => {
      this.log("Connect error: " + error.toString(), {
        force: true,
        level: "error"
      });
      setTimeout(() => this.connect(), 1000);
    });

    wsClient.on("connect", (connection) => {
      this.ws = connection;
      this.onWSOpen();

      connection.on("error", (error) => {
        this.log("Connection error: " + error.toString(), {
          force: true,
          level: "error"
        });
        this.die();
      });

      connection.on("close", (code) => {
        this.onWSClose(code);
      });

      connection.on("message", (message) => {
        if (message.type === "utf8" && message.utf8Data) {
          this.onWSMessage(Buffer.from(message.utf8Data));
        } else if (message.type === "binary" && message.binaryData) {
          // @ts-ignore
          this.onWSMessage(Buffer.from(message.binaryData));
        }
      });
    });

    wsClient.connect(`wss://${this.spool.endpoint}`, undefined, undefined, {
      "user-agent": this.userAgent,
      authorization: `Bearer ${this.spool.token}`
    });
  }

  static SLOW_CODEC_THRESHOLD = 100;

  encode(msg: string, data?: Record<string, any>): Buffer | string {
    const start = performance.now();
    let res;
    switch (this.codecMethod) {
      case "vm":
        res = this.codecVM!.encode(msg, data);
        break;
      case "teto":
        res = this.codecWrapper!.encode(msg, data);
        break;
      case "codec-2":
        res = this.codec2.encode(msg, data);
        break;
      case "json":
        res = JSON.stringify({ command: msg, data });
        break;
      default:
        res = this.codec.encode(msg, data);
    }
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
    try {
      const start = performance.now();
      let res;

      if (this.codecMethod === "codec-2") {
        try {
          res = this.codec2.decode(data);
          if (res.command === "packets") {
            res.data.packets = res.data.packets.map((packet: any) =>
              Buffer.from([...packet])
            );
          }
        } catch (e) {
          if (this.codecVM) {
            res = this.codecVM.decode(data);
            this.log("Decoded with VM", { level: "warning", force: true });
            console.warn(res);
          } else {
            throw e;
          }
        }
      } else {
        res = (() => {
          switch (this.codecMethod) {
            case "vm":
              return this.codecVM!.decode(data);
            case "teto":
              return this.codecWrapper!.decode(data);
            case "json":
              return JSON.parse(data.toString());
            default:
              return this.codec.decode(data);
          }
        })();
      }

      const end = performance.now();
      if (end - start > Ribbon.SLOW_CODEC_THRESHOLD) {
        this.log(`Slow decode: ${res.command} (${end - start}ms)`, {
          force: true,
          level: "warning"
        });
      }
      return res;
    } catch (e: any) {
      this.log(`Error decoding message: ${e.stack || e.message || e}`, {
        force: true,
        level: "error"
      });
      this.log(
        `Data (${typeof data} | ${data instanceof Buffer}): ${JSON.stringify(data)}`,
        {
          force: true,
          level: "error"
        }
      );
    }
  }

  private pipe(msg: string, data?: Record<string, any>) {
    if (!this.ws) return this.session.messageQueue.push({ command: msg, data });

    const encoded = this.encode(msg, data);
    if (Buffer.isBuffer(encoded) && encoded[0] & Codec.FLAGS.F_ID) {
      const id = ++this.session.lastSent!;
      new Bits(encoded).seek(8).write(id, 24);
    }
    if (this.codecMethod === "json") {
      this.ws.sendUTF(encoded.toString());
    } else {
      this.ws.sendBytes(
        Buffer.isBuffer(encoded) ? encoded : Buffer.from(encoded)
      );
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
    if (this.verbose)
      this.log(
        `Connected to <${this.spool.endpoint?.split(".")[0]}/${this.spool.endpoint?.split("/").at(-1)}>`
      );
    this.session.open = true;
    this.session.flags |= Ribbon.FLAGS.ALIVE | Ribbon.FLAGS.SUCCESSFUL;
    this.session.flags &= ~Ribbon.FLAGS.TIMING_OUT;

    if (!this.spool.tokenid) {
      this.pipe("new");
    } else {
      this.pipe("session", {
        ribbonid: this.session.id,
        tokenid: this.spool.tokenid
      });
    }
    this.session.lastPong = performance.now();

    this.heartbeat = setInterval(() => {
      if (this.ws!.connected) {
        if (performance.now() - this.session.lastPong! > 30000) {
          this.ws!.close(3001, "pong timeout");
        } else {
          this.ping();
        }
      }
    }, 2500);
  }

  private handleMigrate = async (newEndpoint: string) => {
    if (this.spool.migrated) {
      if (this.verbose) {
        this.log(
          `Already migrated to <${
            this.spool.endpoint?.split(".")[0]
          }/${this.spool.endpoint?.split("/").at(-1)}>`
        );
      }
      return;
    }
    this.spool.endpoint = `${this.spool.endpoint!.split("/ribbon/")[0]}${newEndpoint}`;

    this.die();
    this.spool.migrated = true;
    await this.connect();
  };

  private onWSMessage(data: any) {
    try {
      const reProcessPacket = (packetData: any) => {
        const item =
          this.codecMethod === "json"
            ? packetData instanceof Buffer
              ? JSON.parse(packetData.toString())
              : packetData
            : this.decode(packetData);

        if (!item) return;

        if (item.command === "packets") {
          const packets = item.data.packets;
          packets.forEach((packet: any) => {
            let command = "ribbon:unparsed";
            try {
              const decoded =
                this.codecMethod === "json" ? packet : this.decode(packet);

              command = decoded.command;

              if (decoded.command === "packets") {
                reProcessPacket(packet);
              } else {
                this.handleMessage(decoded);
              }
            } catch (e) {
              console.error(
                `failed to unpack packet with command ${command}`,
                packet,
                e
              );
            }
          });
        } else {
          this.handleMessage(item);
        }
      };

      reProcessPacket(data);
    } catch (e: any) {
      this.log(`error handling message: ${e.stack || e.message || e}`, {
        force: true,
        level: "error"
      });
      this.log(
        `data (${typeof data} | ${data instanceof Buffer}): ${JSON.stringify(data)}`,
        {
          force: true,
          level: "error"
        }
      );
    }
  }

  private onWSClose(code: number) {
    if (!this.spool.tokenid) {
      return this.connect();
    }

    this.ws!.removeAllListeners();
    this.session.open = false;
    clearInterval(this.heartbeat);

    const closeReason =
      code in RIBBON_CLOSE_CODES
        ? RIBBON_CLOSE_CODES[code as unknown as keyof typeof RIBBON_CLOSE_CODES]
        : "Unknown reason: " + code;

    this.emitter.emit("client.close", closeReason);
    this.emitter.emit("client.dead", undefined);
  }

  private async handleMessage(msg: any): Promise<void> {
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
        if (!this.spool.tokenid) {
          this.pipe("server.authorize", {
            token: this.token,
            handling: this.handling,
            signature: await this.spool.signature,
            i: undefined
          });
        }
        this.session.id = m.data.ribbonid;
        this.spool.tokenid = m.data.tokenid;
        return;
      case "server.authorize":
        if (m.data.success) {
          this.log("Authorized");
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
        this.log(`Migrating to ${m.data.endpoint}`);
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
    this.ws?.removeAllListeners();
    this.die(true);
  }

  get endpoint() {
    return this.spool.endpoint;
  }
}
