import { Emitter, Game, Events } from "../../types";
import { API, APITypes, pack } from "../../utils";
import { EventEmitter } from "node:events";
import { WebSocket } from "ws";
import { RibbonEvents } from "./types";

const RIBBON_CLOSE_CODES = {
  "1000": "ribbon closed normally",
  "1001": "client closed ribbon",
  "1002": "protocol error",
  "1003": "protocol violation",
  "1005": "no reason given",
  "1006": "ribbon lost",
  "1007": "payload data corrupted",
  "1008": "protocol violation",
  "1009": "too much data",
  "1010": "negotiation error",
  "1011": "server error",
  "1012": "server restarting",
  "1013": "temporary error",
  "1014": "bad gateway",
  "1015": "TLS error"
} as const;

const RIBBON_TAG = {
  STANDARD_ID: 0x45, // base
  EXTRACTED_ID: 0xae, // buffer packets
  BATCH: 0x58,
  EXTENSION: 0xb
};

const EXTENSION_TAG = {
  PING: 0x0b, // client
  PONG: 0x0c // server
};

// @ts-ignore
const RIBBON_EXTRACTED_ID_TAG = new Uint8Array([174]);
const RIBBON_STANDARD_ID_TAG = new Uint8Array([69]);
// @ts-ignore
const RIBBON_BATCH_TAG = new Uint8Array([88]);
const RIBBON_EXTENSION_TAG = new Uint8Array([0xb0]);

const RIBBON_EXTENSIONS = new Map();
RIBBON_EXTENSIONS.set(0x0b, (payload: any) => {
  if (payload.byteLength >= 6) {
    return {
      command: "ping",
      at: new DataView(payload.buffer).getUint32(2, false)
    };
  } else {
    return { command: "ping" };
  }
});
RIBBON_EXTENSIONS.set("ping", (extensionData?: number) => {
  if (typeof extensionData === "number") {
    const dat = new Uint8Array([0xb0, 0x0b, 0x00, 0x00, 0x00, 0x00]);
    new DataView(dat.buffer).setUint32(2, extensionData, false);
    return dat;
  } else {
    return new Uint8Array([0xb0, 0x0b]);
  }
});
RIBBON_EXTENSIONS.set(0x0c, (payload: any) => {
  if (payload.byteLength >= 6) {
    return {
      command: "pong",
      at: new DataView(payload.buffer).getUint32(2, false)
    };
  } else {
    return { command: "pong" };
  }
});
RIBBON_EXTENSIONS.set("pong", (extensionData?: number) => {
  if (typeof extensionData === "number") {
    const dat = new Uint8Array([0xb0, 0x0c, 0x00, 0x00, 0x00, 0x00]);
    new DataView(dat.buffer).setUint32(2, extensionData, false);
    return dat;
  } else {
    return new Uint8Array([0xb0, 0x0c]);
  }
});

const smartEncodePing = (
  packet: any,
  extensionData = null as null | number
) => {
  if (typeof packet === "string") {
    // This might be an extension, look it up
    const found = RIBBON_EXTENSIONS.get(packet);
    if (found) {
      return found(extensionData);
    }
  }

  let prependable = RIBBON_STANDARD_ID_TAG;

  const msgpacked = pack.pack(packet);
  const merged = new Uint8Array(prependable.length + msgpacked.length);
  merged.set(prependable, 0);
  merged.set(msgpacked, prependable.length);

  return merged;
};

const smartDecodePong = (packet: any) => {
  if (packet[0] === RIBBON_EXTENSION_TAG[0]) {
    // look up this extension
    const found = RIBBON_EXTENSIONS.get(packet[1]);
    if (!found) {
      throw "Unknown extension";
    }
    return found(packet);
  }
  return false;
};

const decode = (packet: any): any => {
  if (packet[0] === RIBBON_TAG.STANDARD_ID)
    return pack.unpackMultiple(packet.slice(1));
  else if (packet[0] === RIBBON_TAG.EXTRACTED_ID) {
    const message = pack.unpack(packet.slice(5));
    const view = new DataView(packet.buffer);

    message.id = view.getUint32(1, false);

    return [message];
  } else if (packet[0] === RIBBON_TAG.BATCH) {
    const items = [];
    const lengths = [];

    const batchView = new DataView(packet.buffer);

    for (let i = 0; true; i++) {
      const length = batchView.getUint32(1 + i * 4, false);

      if (length === 0) break;

      lengths.push(length);
    }

    let pointer = 0;

    for (let i = 0; i < lengths.length; i++) {
      items.push(
        packet.slice(
          1 + lengths.length * 4 + 4 + pointer,
          1 + lengths.length * 4 + 4 + pointer + lengths[i]
        )
      );
      pointer += lengths[i];
    }

    return [].concat(...items.map((item) => decode(item)));
  } else if (packet[0] === RIBBON_TAG.EXTENSION) {
    if (packet[1] === EXTENSION_TAG.PONG) return [{ command: "pong" }];
    else return [];
  } else return [pack.unpack(packet)];
};

function encode(message: any): any {
  const msgpacked = pack.encode(message);
  const packet = new Uint8Array(msgpacked.length + 1);

  packet.set([0x45], 0);
  packet.set(msgpacked, 1);

  return packet;
}

export class Ribbon {
  private ws: WebSocket | null = null;
  private token: string;
  private userAgent: string;
  private api: API;

  private spool: {
    endpoint?: string;
    detail?: string;
    token?: string;
    resumeToken?: string;
    signature?: APITypes.Server.Signature;
    migrate?: boolean;
  } = {};

  private session: {
    ready?: boolean;
    lastPong?: number;
    lastSent?: number;
    lastReceived?: number;
    open: boolean;
    id?: string;
    messageQueue: any[];
    messageHistory: any[];
  } = {
    open: false,
    messageQueue: [],
    messageHistory: []
  };

  private heartbeat?: NodeJS.Timeout;

  emitter: Emitter<Events.in.all> = new EventEmitter();
  handling: Game.Handling;

  private listeners: {
    type: "send" | "receive";
    callback: (message: Events.in.Client["client.ribbon.receive"]) => void;
  }[] = [];

  /** @hideconstructor */
  constructor({
    token,
    userAgent,
    handling
  }: {
    token: string;
    userAgent: string;
    handling: Game.Handling;
  }) {
    this.token = token;
    this.handling = handling;
    this.userAgent = userAgent;

    this.api = new API({ token, userAgent });
  }

  async connect() {
    const spool = this.spool.endpoint
      ? { endpoint: this.spool.endpoint, token: this.spool.token }
      : await this.api.server.spool();

    this.session.lastPong = performance.now();
    this.spool = { ...this.spool, ...spool };

    this.spool.signature = (await this.api.server.environment()).signature;

    this.ws = new WebSocket(`wss:${this.spool.endpoint}`, this.spool.token, {
      headers: {
        "user-agent": this.userAgent
      }
    });

    this.ws.on("open", this.onWSOpen.bind(this));
    this.ws.on("message", this.onWSMessage.bind(this));
    this.ws.on("close", this.onWSClose.bind(this));
  }

  private pipe(msg: { command: string } & Record<string, any>) {
    if (!this.ws) throw new Error("Not connected");
    // console.log("send", msg);
    this.ws.send(encode(msg));

    this.listeners
      .filter((l) => l.type === "send")
      // @ts-expect-error
      .forEach((l) => l.callback(msg));
  }

  private onWSOpen() {
    this.session.open = true;

    if (!this.spool.resumeToken) {
      this.pipe({ command: "new" });
    } else {
      this.pipe({
        command: "resume",
        socketid: this.session.id,
        resumetoken: this.spool.resumeToken
      });

      // this.pipe({
      //   command: "hello",
      //   packets: this.session.messageHistory ?? []
      // });
    }

    this.heartbeat = setInterval(() => {
      if (this.ws!.readyState !== 1) return;
      if (performance.now() - this.session.lastPong! > 30000)
        this.ws!.close(3001, "pong timeout"); /* */

      const ping = smartEncodePing("ping", this.session.lastReceived as number);
      this.ws?.send(ping);
    }, 2500);
  }

  private onWSMessage(data: any) {
    const pong = smartDecodePong(data);
    if (pong) {
      this.session.lastPong = performance.now();
      return;
    }

    const messages = decode(new Uint8Array(data));
    if (messages?.error) return;
    for (const x of messages) {
      this.handleMessage(x);
    }
  }

  private onWSClose(e: number) {
    if (this.spool.migrate) {
      this.connect();
      this.spool.migrate = false;
      return;
    }

    this.ws!.removeAllListeners();
    this.session.open = false;

    clearInterval(this.heartbeat);

    const code = e.toString();
    const closeReason =
      code in RIBBON_CLOSE_CODES
        ? RIBBON_CLOSE_CODES[code as keyof typeof RIBBON_CLOSE_CODES]
        : "Unknown reason: " + code;

    this.emitter.emit("client.close", closeReason);
  }

  private handleMessage(msg: any): void {
    if (msg.type === "Buffer") {
      const packet = Buffer.from(msg.data);
      const message = decode(packet);

      if (message?.error) return;

      this.handleMessage(message);
    }

    if (msg.command !== "hello" && msg.id) {
      if (msg.id > (this.session.lastReceived ?? -1)) {
        this.session.lastReceived = msg.id;
      } else return;
    }

    if (!!msg.command) {
      this.listeners
        .filter((l) => l.type === "receive")
        .forEach((l) => l.callback(msg));

      const m:
        | RibbonEvents.Raw<Events.in.all>
        | { command: "pong" }
        | {
            command: "hello";
            id: string;
            resume: string;
            packets: { command: string; data: any }[];
          }
        | { command: "nope"; reason: string } = msg;

      switch (m.command) {
        case "pong":
          this.session.lastPong = performance.now();
          return;
        case "hello":
          this.session.id = m.id;
          if (!this.spool.resumeToken) {
            this.pipe({
              command: "authorize",
              id: this.session.lastSent ?? 0,
              data: {
                token: this.token,
                handling: this.handling,
                signature: this.spool.signature
              }
            });
          }
          for (const x of m.packets) {
            this.handleMessage(x);
          }
          this.spool.resumeToken = m.resume;
          return;
        case "authorize":
          if (m.data.success) {
            this.emit("social.presence", {
              status: "online",
              detail: "menus"
            });

            this.emitter.emit("client.ready", {
              endpoint: this.spool.endpoint!,
              social: m.data.social
            });
          } else {
            this.emitter.emit("client.error", "Failure to authorize ribbon");
          }
          break;
        case "migrate":
          this.spool.migrate = true;
          this.spool.endpoint =
            this.spool.endpoint!.split("/ribbon/")[0] + m.data.endpoint;
          this.die();
          break;
        case "kick":
        case "nope":
          console.log(m);
          this.die(true);
          break;
      }
      this.emitter.emit(m.command, (m as any).data);
    }
  }

  emit<T extends keyof Events.out.all>(
    event: T,
    ...data: Events.out.all[T] extends void ? [] : [Events.out.all[T]]
  ) {
    if (event.startsWith("client.")) {
      this.emitter.emit(event, data[0]);
      return;
    }

    this.session.lastSent = !!this.session.lastSent
      ? this.session.lastSent + 1
      : 1;

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
      // log('no send', msg, 'because session not open.')
      return;
    }

    for (let i = 0; i < this.session.messageQueue!.length; i++) {
      const message = this.session.messageQueue!.shift();
      // log('sendMessage', message)
      this.pipe(message);
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
      (l) => l.type === event && l.callback === callback
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
    this.spool.migrate = false;
    this.ws?.removeAllListeners();
    this.die(true);
  }
}
