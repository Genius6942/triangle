// amadeus-codec

import { pack } from "../../utils";

export type CodecType = "vm" | "custom";

export type Command = {
  flags: number;
  code: number;
  name: string;
} & (
  | {
      encode: () => void;
      decode: () => void;
    }
  | { buffer: Uint8Array }
);

export class Bits {
  private static readonly u: number =
    Number.MAX_SAFE_INTEGER.toString(2).length;
  private buffer: Buffer;
  private _length: number;
  private _offset: number;

  constructor(t: number | Buffer) {
    if (typeof t === "number") {
      this.buffer = Buffer.alloc(Math.ceil(t / 8));
    } else {
      if (!(t instanceof Buffer)) {
        throw new TypeError(
          "Initialize by specifying a bit-length or referencing a Buffer"
        );
      }
      this.buffer = t;
    }
    this._length = 8 * this.buffer.length;
    this._offset = 0;
  }

  static alloc(t: number, e?: number, r?: BufferEncoding): Bits {
    return new Bits(Buffer.alloc(t, e, r));
  }

  static from(
    t: string | Buffer | ArrayBuffer | SharedArrayBuffer,
    e?: BufferEncoding,
    r?: number
  ): Bits {
    return new Bits(Buffer.from(t as any, e as any, r));
  }

  get eof(): boolean {
    return this._offset === this._length;
  }

  get length(): number {
    return this._length;
  }

  get offset(): number {
    return this._offset;
  }

  set offset(t: number) {
    if (t < 0) throw new RangeError("Cannot set offset below 0");
    if (t > this._length)
      throw new RangeError(
        `Cannot set offset to ${t}, buffer length is ` + this._length
      );
    this._offset = Math.floor(t);
  }

  get remaining(): number {
    return this._length - this._offset;
  }

  clear(t: number = 0): this {
    this.buffer.fill(t);
    this._offset = 0;
    return this;
  }

  clearBit(t: number): this {
    this.insert(0, 1, t);
    return this;
  }

  flipBit(t: number): number {
    const e = 1 ^ this.peek(1, t);
    this.modifyBit(e, t);
    return e;
  }

  getBit(t: number): number {
    return this.peek(1, t);
  }

  insert(t: number, e: number = 1, r?: number): number {
    if ((r = typeof r === "number" ? 0 | r : this._offset) + e > this._length)
      throw new RangeError(
        `Cannot write ${e} bits, only ${this.remaining} bit(s) left`
      );
    if (e > Bits.u)
      throw new RangeError(`Cannot write ${e} bits, max is ` + Bits.u);
    let n = e;
    while (n > 0) {
      const i = r >> 3,
        o = 7 & r,
        f = Math.min(8 - o, n),
        s = (1 << f) - 1,
        o2 = 8 - f - o,
        h = ((t >>> (n - f)) & s) << o2;
      this.buffer[i] = (this.buffer[i] & ~(s << o2)) | h;
      r += f;
      n -= f;
    }
    return r;
  }

  modifyBit(t: number, e: number): this {
    this.insert(t, 1, e);
    return this;
  }

  peek(t: number = 1, e?: number): number {
    if ((e = typeof e === "number" ? 0 | e : this._offset) + t > this._length)
      throw new RangeError(
        `Cannot read ${t} bits, only ${this.remaining} bit(s) left`
      );
    if (t > Bits.u)
      throw new RangeError(
        `Reading ${t} bits would overflow result, max is ` + Bits.u
      );
    const r = 7 & e,
      n = Math.min(8 - r, t);
    let i = (this.buffer[e >> 3] >> (8 - n - r)) & ((1 << n) - 1),
      o = ((e += n), t - n);
    while (o >= 8) {
      i = (i << 8) | this.buffer[e >> 3];
      e += 8;
      o -= 8;
    }
    if (o > 0) {
      const r2 = 8 - o;
      i = (i << o) | ((this.buffer[e >> 3] >> r2) & (255 >> r2));
    }
    return i;
  }

  read(t: number = 1): number {
    const e = this.peek(t, this._offset);
    this._offset += t;
    return e;
  }

  seek(t: number, e: number = 1): this {
    switch (e) {
      case 2:
        this.offset += t;
        break;
      case 3:
        this.offset = this.length - t;
        break;
      default:
        this.offset = t;
    }
    return this;
  }

  setBit(t: number): this {
    this.insert(1, 1, t);
    return this;
  }

  skip(t: number): this {
    return this.seek(t, 2);
  }

  testBit(t: number): boolean {
    return !!this.peek(1, t);
  }

  toString(t: BufferEncoding = "utf8"): string {
    return this.buffer.toString(t);
  }

  write(t: number, e: number = 1): this {
    this._offset = this.insert(t, e, this._offset);
    return this;
  }
}

export class Table {
  private readonly table: Record<string, number>;

  constructor(t: Record<string, number>) {
    this.table = t;
  }

  getKey(value: number) {
    return Object.keys(this.table).find((key) => this.table[key] === value);
  }

  getValue(key: string) {
    return this.table[key];
  }
}

export class Codec {
  private commands = new Map<string, Command>();
  private codes = new Map<number, Command>();

  static FLAGS = { F_ALLOC: 1, F_HOOK: 2, F_ID: 128 } as const;
  static SymCmd = Symbol("cmd");
  static TABLES = {
    kick: new Table({
      anticheat: 5,
      block: 4,
      kick: 2,
      manual: 6,
      outdated: 1,
      rename: 7,
      restrict: 3
    }),
    nope: new Table({
      "protocol violation": 0,
      "ribbon expired": 1
    }),
    pni: new Table({
      background: 0,
      split: 1,
      load: 2
    }),
    notify: new Table({
      announce: 5,
      deny: 1,
      error: 4,
      ok: 3,
      warm: 2
    }),
    __pack__: new Table({
      "channel.subscribe": 2,
      "channel.unsubscribe": 3,
      "config.handling": 1,
      "game.abort": 54,
      "game.advance": 53,
      "game.end": 55,
      "game.enter": 48,
      "game.match": 57,
      "game.match.score": 58,
      "game.ready": 49,
      "game.records.revolved": 67,
      "game.replay": 59,
      "game.replay.board": 63,
      "game.replay.end": 64,
      "game.replay.enter": 60,
      "game.replay.ige": 61,
      "game.replay.state": 62,
      "game.scope.end": 66,
      "game.scope.start": 65,
      "game.score": 56,
      "game.spectate": 51,
      "game.start": 50,
      "game.submit": 52,
      "league.abort": 180,
      "league.counts": 181,
      "league.enter": 177,
      "league.leave": 178,
      "league.match": 179,
      "party.leave": 81,
      "party.members": 83,
      "party.ready": 80,
      "party.sync": 82,
      "room.abort": 131,
      "room.banlist": 135,
      "room.bracket.move": 146,
      "room.bracket.switch": 145,
      "room.chat": 149,
      "room.chat.clear": 151,
      "room.chat.delete": 152,
      "room.chat.game": 154,
      "room.chat.gift": 153,
      "room.chat.send": 150,
      "room.create": 128,
      "room.join": 129,
      "room.kick": 133,
      "room.leave": 130,
      "room.owner.revoke": 148,
      "room.owner.transfer": 147,
      "room.player.add": 143,
      "room.player.remove": 144,
      "room.setconfig": 137,
      "room.setid": 136,
      "room.start": 132,
      "room.unban": 134,
      "room.update": 138,
      "room.update.auto": 141,
      "room.update.bracket": 139,
      "room.update.host": 140,
      "room.update.supporter": 142,
      "server.announcement": 209,
      "server.authorize": 210,
      "server.maintenance": 208,
      "server.migrate": 211,
      "server.migrated": 212,
      "social.dm": 22,
      "social.dm.fail": 23,
      "social.invite": 17,
      "social.link": 18,
      "social.notification": 20,
      "social.notification.ack": 21,
      "social.online": 19,
      "social.party.invite": 29,
      "social.party.invite.accept": 30,
      "social.presence": 16,
      "social.relation.ack": 24,
      "social.relation.add": 25,
      "social.relation.clear": 28,
      "social.relation.remove": 26,
      "social.relation.update": 27,
      "staff.chat": 96,
      "staff.game.event": 104,
      "staff.kickfail": 101,
      "staff.lift": 100,
      "staff.shout": 102,
      "staff.silence": 99,
      "staff.spam": 97,
      "staff.warn": 98,
      "staff.waterfall": 103,
      "staff.xrc": 105,
      "xrc.relog": 255
    })
  };

  constructor() {
    this.initCommands();
  }

  private addCommand(
    name: string,
    command: {
      flags?: number;
      code: number;
      encode?: (data: any, name: string) => Buffer;
      decode?: (data: Buffer) => any;
    }
  ) {
    const data: any = {
      name,
      flags: command.flags,
      code: command.code
    };

    if ((command.flags || 0) & Codec.FLAGS.F_ALLOC) {
      data.buffer = new Uint8Array([command.code]);
    } else {
      data.encode = command.encode;
      data.decode = command.decode;
    }

    this.commands.set(name, data);
    this.codes.set(command.code, data);
  }

  private initCommands() {
    this.addCommand("new", { flags: Codec.FLAGS.F_ALLOC, code: 25 });
    this.addCommand("die", { flags: Codec.FLAGS.F_ALLOC, code: 63 });
    this.addCommand("rejected", {
      flags: Codec.FLAGS.F_HOOK | Codec.FLAGS.F_ALLOC,
      code: 19
    });
    this.addCommand("reload", {
      flags: Codec.FLAGS.F_HOOK | Codec.FLAGS.F_ALLOC,
      code: 33
    });
    this.addCommand("ping", {
      flags: Codec.FLAGS.F_HOOK,
      code: 9,
      encode: ({ recvid: t }) => {
        const n = Buffer.allocUnsafe(4);
        return n.writeUInt32BE(t, 0), n;
      },
      decode: (e) => {
        return {
          recvid: e.readUint32BE(0)
        };
      }
    });

    this.addCommand("session", {
      code: 44,
      encode: ({ ribbonid: e, tokenid: t }) => {
        const n = Buffer.allocUnsafe(16);
        return n.write(e, 0, 8, "hex"), n.write(t, 8, 8, "hex"), n;
      },
      decode: (e: Buffer) => ({
        ribbonid: e.toString("hex", 0, 8),
        tokenid: e.toString("hex", 8, 16)
      })
    });

    this.addCommand("packets", {
      code: 7,
      encode: ({ packets: t }: { packets: any[] }) => {
        const n = t.reduce((e, t) => e + t.length, 0),
          s = Buffer.allocUnsafe(n + 4 * t.length);
        for (let e = 0, n = 0; e < t.length; e++) {
          const i = t[e];
          s.writeUInt32BE(i.length, n), s.set(i, n + 4), (n += i.length + 4);
        }
        return s;
      },
      decode: (data: Buffer) => {
        const t = [];
        for (let n = 0; n < data.length; ) {
          const s = data.readUInt32BE(n);
          n += 4;
          const i = data.subarray(n, n + s);
          t.push(i), (n += s);
        }
        return {
          packets: t
        };
      }
    });

    this.addCommand("kick", {
      code: 4,
      flags: Codec.FLAGS.F_HOOK,
      encode: ({ reason: t }) => {
        let n = Buffer.allocUnsafe(1);
        const s = Codec.TABLES.kick.getValue(t);
        return (
          n.writeUInt8(s, 0), s || (n = Buffer.concat([n, Buffer.from(t)])), n
        );
      },
      decode: (e) => {
        const t = e.readUInt8(0);
        let n = Codec.TABLES.kick.getKey(t);
        return n || (n = e.toString("utf8", 1)), { reason: n };
      }
    });

    this.addCommand("nope", {
      code: 42,
      encode({ reason: t }) {
        return Buffer.from([Codec.TABLES.nope.getValue(t)]);
      },
      decode(e) {
        const t = e.readUInt8(0);
        return { reason: Codec.TABLES.nope.getKey(t) };
      }
    });

    this.addCommand("pni", {
      code: 51,
      flags: Codec.FLAGS.F_HOOK,
      encode: ({ type: t, timeout: n }) => {
        const s = Buffer.allocUnsafe(3);
        return s.writeUInt8(t, 0), s.writeUInt16BE(n, 1), s;
      },
      decode: (e) => ({ type: e.readUInt8(0), timeout: e.readUInt16BE(1) })
    });

    this.addCommand("notify", {
      code: 49,
      flags: Codec.FLAGS.F_HOOK | Codec.FLAGS.F_ID,
      encode: (t) => {
        const s = Codec.TABLES.notify.getValue(t.type),
          i = Buffer.from([s]);
        switch (s) {
          case 1: {
            const n = Buffer.allocUnsafe(2 + t.msg.length);
            return (
              n.writeUInt16BE(t.timeout),
              n.write(t.msg, 2),
              Buffer.concat([i, n])
            );
          }
          case 2:
          case 3:
          case 4:
          case 5:
            return Buffer.concat([i, Buffer.from(t.msg)]);
          default:
            return Buffer.concat([i, pack.pack(t)]);
        }
      },
      decode: (e) => {
        const n = e.readUInt8(0),
          s = Codec.TABLES.notify.getKey(n);
        switch (n) {
          case 1:
            return {
              type: s,
              timeout: e.readUInt16BE(1),
              msg: e.toString("utf8", 3)
            };
          case 2:
          case 3:
          case 4:
          case 5:
            return { type: s, msg: e.toString("utf8", 1) };
          default:
            return pack.unpack(e.subarray(1));
        }
      }
    });

    this.addCommand("__pack__", {
      code: 43,
      flags: Codec.FLAGS.F_ID,
      encode: (t, s) => {
        const i = pack.pack(t),
          o = Buffer.allocUnsafe(1 + i.length),
          a = Codec.TABLES.__pack__.getValue(s!);
        // if (s === "social.presence") console.log("pack presence as", i);
        return o.writeUInt8(a, 0), o.set(i, 1), o;
      },
      decode: (e) => {
        const n = e.readUInt8(0),
          s = Codec.TABLES.__pack__.getKey(n),
          i = pack.unpack(e.subarray(1));
        return { [Codec.SymCmd]: s, data: i };
      }
    });
  }

  encode(
    msg: string,
    data?: any,
    options: { batched?: boolean; id?: number } = {}
  ) {
    const cmd = this.commands.get(msg) ?? this.commands.get("__pack__")!;
    let code = cmd.code;
    if (cmd.flags & Codec.FLAGS.F_ALLOC) return (cmd as any).buffer;

    let a = 1;
    if (!options.batched && (cmd.flags & Codec.FLAGS.F_ID || options.id)) {
      a += 3;
      code |= Codec.FLAGS.F_ID;
    }

    const packed: Buffer = (cmd as any).encode(data, msg);
    const buffer = Buffer.allocUnsafe(packed.byteLength + a);
    buffer.writeUInt8(code, 0);
    buffer.set(packed, a);
    return buffer;
  }

  encodeAsync(
    msg: string,
    data?: any,
    options: {
      batched?: boolean;
      id?: number;
      pack?: (data: any) => Promise<Buffer>;
    } = {}
  ) {
    const cmd = this.commands.get(msg) ?? this.commands.get("__pack__")!;
    let code = cmd.code;
    if (cmd.flags & Codec.FLAGS.F_ALLOC) return (cmd as any).buffer;

    let a = 1;
    if (!options.batched && (cmd.flags & Codec.FLAGS.F_ID || options.id)) {
      a += 3;
      code |= Codec.FLAGS.F_ID;
    }

    const packed: Buffer = (cmd as any).encode(data, msg);
    const buffer = Buffer.allocUnsafe(packed.byteLength + a);
    buffer.writeUInt8(code, 0);
    buffer.set(packed, a);
    return buffer;
  }

  decode(data: Buffer) {
    const b = new Bits(data);
    const code = b.peek(6, 2);
    const command = this.codes.get(code)!;
    const res: any = {
      command: command?.name
    };

    let o = 1;
    if (command.flags & Codec.FLAGS.F_ALLOC) return res;

    if (data[0] & Codec.FLAGS.F_ID) {
      res.id = b.peek(24, 8);
      o += 3;
    }

    data = data.subarray(o);

    res.data = (command as any).decode(data);

    if (Codec.SymCmd in res.data) {
      res.command = res.data[Codec.SymCmd];
      res.data = res.data.data;
    }

    return res;
  }
}
