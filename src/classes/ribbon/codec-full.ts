//@ts-nocheck
import { default as n } from "../../utils/theorypack/msgpackr.js";
import { Bits as r } from "./bits";
import {
  OptionsList,
  spinbonuses_rules,
  kicksets,
  tetrominoes,
  minocolors
} from "./shared";

import { strictShallowEqual } from "fast-equals";

const e = Buffer;

const ye = {
  int64AsType: "number",
  bundleStrings: false,
  sequential: false
};
const Be = new n.Packr(ye);
const ke = new n.Unpackr(ye);

// theorypack
// n.addExtension({
//   type: 1,
//   read: (e: any) =>
//     e === null
//       ? {
//           success: true
//         }
//       : {
//           success: true,
//           ...e
//         }
// });
// n.addExtension({
//   type: 2,
//   read: (e: any) =>
//     e === null
//       ? {
//           success: false
//         }
//       : {
//           success: false,
//           error: e
//         }
// });
// end of theorypack
b.cached = {} as { [key: string]: string };
function b(e: any) {
  const t = Object.prototype.toString.call(e);
  if (b.cached[t]) {
    return b.cached[t];
  } else {
    return (b.cached[t] = t.substring(8, t.length - 1).toLowerCase());
  }
}
function initOptions() {
  let OptionsTemplate: { [key: string]: any } = {};
  for (const [e, t] of Object.entries(OptionsList)) {
    OptionsTemplate[e] = t.default;
    const n = b(t.default);
    switch (n) {
      case "boolean":
      case "number":
      case "array":
      case "object":
        t.type = n;
        break;
      case "string":
        t.type = t.allowed || t.possibles ? "table" : "string";
        break;
      default:
        throw new TypeError(
          `Error while templating ${e}: typeof ${n} is not supported as default values`
        );
    }
  }
}

const EncodingManager = new (class {
  _commands = new Map();
  _codes = new Map();
  _PACK = null;
  _UNPACK = null;
  SymCmd = Symbol("cmd");
  FLAG = {
    F_ALLOC: 1,
    F_HOOK: 2,
    F_ID: 128
  };
  // can't put types easily here
  SetMsgpackr(packr: any, unpackr: any) {
    this._PACK = packr.pack.bind(packr);
    this._UNPACK = unpackr.unpack.bind(unpackr);
  }
  GetHandlers() {
    const nt = [];
    for (const e of this._commands.values()) {
      if (e.flags & this.FLAG.F_HOOK) {
        nt.push(e.name);
      }
    }
    const st = this._commands.get("__pack__")?.table;
    if (st) {
      nt.push.apply(nt, Object.keys(st));
    }
    return nt;
  }
  Add(t, n) {
    if (
      (this._commands.set(t, n),
      this._codes.set(n.code, n),
      (n.name = t),
      n.flags & this.FLAG.F_ALLOC)
    ) {
      n.buffer = e.from([n.code]);
    }
    if (n.table) {
      n._kv = new Map();
      n._vk = new Map();
      n.getkv = (e: any) => n._kv.get(e);
      n.getvk = (e: any) => n._vk.get(e);
      for (const [e, t] of Object.entries(n.table)) {
        n._kv.set(e, t);
        n._vk.set(t, e);
      }
    }
  }
  encode(key: string, data: any, opts = { batched: false, id: false }): Buffer {
    const cmd = this._commands.get(key) ?? this._commands.get("__pack__");
    let code = cmd.code,
      headerLength = 1;
    if (cmd.flags & this.FLAG.F_ALLOC) return cmd.buffer;
    if (!opts.batched && (cmd.flags & this.FLAG.F_ID || opts.id)) {
      headerLength += 3;
      code |= this.FLAG.F_ID;
    }
    const encoded = cmd.encode(data, this._PACK, key);
    const buffer = Buffer.allocUnsafe(headerLength + encoded.byteLength);
    buffer.writeUInt8(code, 0);
    buffer.set(encoded, headerLength);
    return buffer;
  }
  decode(e: Buffer): { command: string; data?: any } {
    const t = new r(e),
      n = t.peek(6, 2),
      s = this._codes.get(n),
      i = {
        command: s?.name
      };
    let o = 1;
    if (!s)
      throw new ReferenceError(
        `received an unknown code [0x${n.toString(16).padStart(2, "0")}]`
      );
    if (s.flags & this.FLAG.F_ALLOC) return i;
    e[0] & this.FLAG.F_ID && ((i.id = t.peek(24, 8)), (o += 3));
    e = e.subarray(o);
    try {
      i.data = s.decode(e, this._UNPACK);
    } catch (t) {
      throw (
        (console.error(
          `Failed to decode command ${s.name}: ${e.toString()}, raw: ${e.toJSON().data}, cmd: ${i.command}`
        ),
        t)
      );
    }
    this.SymCmd in i.data &&
      ((i.command = i.data[this.SymCmd]), (i.data = i.data.data));
    return i;
  }
})();
{
  const { F_ALLOC: t, F_HOOK: n, F_ID: s } = EncodingManager.FLAG;
  EncodingManager.Add("new", {
    code: 25,
    flags: t
  });
  EncodingManager.Add("die", {
    code: 63,
    flags: t
  });
  EncodingManager.Add("rejected", {
    code: 19,
    flags: n | t
  });
  EncodingManager.Add("reload", {
    code: 33,
    flags: n | t
  });
  EncodingManager.Add("ping", {
    code: 9,
    flags: n,
    encode({ recvid: t }) {
      const n = e.allocUnsafe(4);
      n.writeUInt32BE(t, 0);
      return n;
    },
    decode(e: any) {
      return {
        recvid: e.readUInt32BE(0)
      };
    }
  });
  EncodingManager.Add("session", {
    code: 44,
    encode({ ribbonid: t, tokenid: n }) {
      const s = e.allocUnsafe(16);
      s.write(t, 0, 8, "hex");
      s.write(n, 8, 8, "hex");
      return s;
    },
    decode: (e: any) => ({
      ribbonid: e.toString("hex", 0, 8),
      tokenid: e.toString("hex", 8, 16)
    })
  });
  EncodingManager.Add("packets", {
    code: 7,
    encode({ packets: t }) {
      const n = t.reduce((e, t) => e + t.length, 0),
        s = e.allocUnsafe(n + 4 * t.length);
      for (let e = 0, n = 0; e < t.length; e++) {
        const i = t[e];
        s.writeUInt32BE(i.length, n), s.set(i, n + 4), (n += i.length + 4);
      }
      return s;
    },
    decode(e: any) {
      const t = [];
      for (let n = 0; n < e.length; ) {
        const s = e.readUInt32BE(n);
        n += 4;
        const i = e.subarray(n, n + s);
        t.push(i), (n += s);
      }
      return { packets: t };
    }
  });
  EncodingManager.Add("kick", {
    table: {
      outdated: 1,
      kick: 2,
      restrict: 3,
      block: 4,
      anticheat: 5,
      manual: 6,
      rename: 7
    },
    flags: n,
    code: 4,
    encode({ reason: t }: { reason: any }) {
      let n = e.allocUnsafe(1);
      const s = this.getkv(t);
      n.writeUInt8(s, 0);
      s || (n = e.concat([n, e.from(t)]));
      return n;
    },
    decode(e: any) {
      let n = this.getvk(e.readUInt8(0));
      n || (n = e.toString("utf8", 1));
      return {
        reason: n
      };
    }
  });
  EncodingManager.Add("nope", {
    table: {
      "protocol violation": 0,
      "ribbon expired": 1
    },
    code: 42,
    encode({ reason: t }) {
      return e.from([this.getkv(t)]);
    },
    decode(e) {
      return {
        reason: this.getvk(e.readUInt8(0))
      };
    }
  });
  EncodingManager.Add("pni", {
    table: {
      background: 0,
      split: 1,
      load: 2
    },
    code: 51,
    flags: n,
    encode({ type: t, timeout: n } = { type: 0, timeout: 0 }) {
      const s = e.allocUnsafe(3);
      s.writeUInt8(t, 0);
      s.writeUInt16BE(n, 1);
      return s;
    },
    decode: (e: any) => ({
      type: e.readUInt8(0),
      timeout: e.readUInt16BE(1)
    })
  });
  EncodingManager.Add("notify", {
    table: {
      deny: 1,
      warm: 2,
      ok: 3,
      error: 4,
      announce: 5
    },
    code: 49,
    flags: n | s,
    encode(t: any, n: any) {
      const s = this.getkv(t.type),
        i = e.from([s]);
      switch (s) {
        case 1: {
          const n = e.allocUnsafe(2 + t.msg.length);
          n.writeUInt16BE(t.timeout);
          n.write(t.msg, 2);
          // @ts-expect-error
          return e.concat([i, n]);
        }
        case 2:
        case 3:
        case 4:
        case 5:
          // @ts-expect-error
          return e.concat([i, e.from(t.msg)]);
        default:
          return e.concat([i, n(t)]);
      }
    },
    decode(e: any, t: any) {
      const n = e.readUInt8(0),
        s = this.getvk(n);
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
          return {
            type: s,
            msg: e.toString("utf8", 1)
          };
        default:
          return t(e.subarray(1));
      }
    }
  });
  EncodingManager.Add("__pack__", {
    table: {
      "config.handling": 1,
      "channel.subscribe": 2,
      "channel.unsubscribe": 3,
      "social.presence": 16,
      "social.invite": 17,
      "social.link": 18,
      "social.online": 19,
      "social.notification": 20,
      "social.notification.ack": 21,
      "social.dm": 22,
      "social.dm.fail": 23,
      "social.relation.ack": 24,
      "social.relation.add": 25,
      "social.relation.remove": 26,
      "social.relation.update": 27,
      "social.relation.clear": 28,
      "social.party.invite": 29,
      "social.party.invite.accept": 30,
      "game.enter": 48,
      "game.replace": 49,
      "game.forfeit": 50,
      "game.ready": 51,
      "game.start": 52,
      "game.spectate": 53,
      "game.submit": 54,
      "game.advance": 55,
      "game.abort": 56,
      "game.end": 57,
      "game.score": 58,
      "game.waitstate": 59,
      "game.match": 60,
      "game.match.score": 61,
      "game.replay": 62,
      "game.replay.enter": 63,
      "game.replay.ige": 64,
      "game.replay.state": 65,
      "game.replay.board": 66,
      "game.replay.end": 67,
      "game.scope.start": 68,
      "game.scope.end": 69,
      "game.setspec": 70,
      "game.records.revolved": 71,
      "party.ready": 80,
      "party.leave": 81,
      "party.members": 83,
      "party.sync": 82,
      "staff.chat": 96,
      "staff.spam": 97,
      "staff.warn": 98,
      "staff.silence": 99,
      "staff.lift": 100,
      "staff.kickfail": 101,
      "staff.shout": 102,
      "staff.waterfall": 103,
      "staff.game.event": 104,
      "staff.xrc": 105,
      "room.create": 128,
      "room.join": 129,
      "room.leave": 130,
      "room.abort": 131,
      "room.start": 132,
      "room.kick": 133,
      "room.unban": 134,
      "room.banlist": 135,
      "room.setid": 136,
      "room.setconfig": 137,
      "room.update": 138,
      "room.update.bracket": 139,
      "room.update.host": 140,
      "room.update.auto": 141,
      "room.update.supporter": 142,
      "room.player.add": 143,
      "room.player.remove": 144,
      "room.bracket.switch": 145,
      "room.bracket.move": 146,
      "room.owner.transfer": 147,
      "room.owner.revoke": 148,
      "room.chat": 149,
      "room.chat.send": 150,
      "room.chat.clear": 151,
      "room.chat.delete": 152,
      "room.chat.gift": 153,
      "room.chat.game": 154,
      "room.call": 155,
      "league.enter": 177,
      "league.leave": 178,
      "league.match": 179,
      "league.counts": 180,
      "league.ready": 181,
      "server.maintenance": 208,
      "server.announcement": 209,
      "server.authorize": 210,
      "server.migrate": 211,
      "server.migrated": 212,
      "xrc.relog": 255
    },
    flags: 128,
    code: 43,
    encode(data, pack, key) {
      const result = pack(data);
      const buffer = Buffer.allocUnsafe(1 + result.length);
      buffer.writeUInt8(this.getkv(key), 0);
      buffer.set(result, 1);
      return buffer;
    },
    decode(e, t) {
      return {
        [EncodingManager.SymCmd]: this.getvk(e.readUInt8(0)),
        data: t(e.subarray(1))
      };
    }
  });
}
class Transcoder {
  static TYPES = {
    Table: 0,
    Array: 1,
    Struct: 2,
    String: 3,
    Buffer: 4,
    Boolean: 5,
    Int: 6,
    UInt: 7,
    DInt: 8,
    Float: 9,
    UFloat: 10,
    Double: 11,
    Number: 12,
    Any: 13
  };
  static TYPES_INDEX = Array.from(Object.keys(this.TYPES));
  static SUPPORTED_TYPES = new Set([
    "undefined",
    "null",
    "boolean",
    "number",
    "string",
    "array"
  ]);
  static cla32(e) {
    if (e >>> 0 === e) {
      return Math.max(32 - Math.clz32(e), 1);
    } else {
      return Math.max(32 - Math.clz32(~e) + 1, 2);
    }
  }
  static GetIntSize(e) {
    return Math.ceil(this.cla32(e) / 4);
  }
  static DInt = class {
    constructor({ min: e, max: t }) {
      this._minBits = e;
      this._maxBits = t;
      this._minSize = Math.pow(2, e);
      this._maxSize = Math.pow(2, t);
    }
    get minSize() {
      return this._minSize;
    }
    get maxSize() {
      return this._maxSize;
    }
    readSize(e) {
      if (e) {
        return this._maxBits;
      } else {
        return this._minBits;
      }
    }
    writeSize(e) {
      let t;
      switch (e) {
        case e >>> 0:
          t = this._minSize <= e;
          break;
        case e | 0:
          t = -this._minSize / 2 > e;
          break;
        default:
          throw new RangeError(
            `Float/Double is not supported for DInt: got ${e}`
          );
      }
      return {
        bit: t,
        size: t ? this._maxBits : this._minBits
      };
    }
  };
  static Number = new (class {
    TYPES = {
      NaN: 0,
      Infinity: 1,
      UInt: 2,
      Int: 3,
      Double: 4
    };
    encode(e, t) {
      const { TYPES: n } = this;
      if (typeof t != "number") {
        throw new TypeError(`Attempted to encode ${typeof t} as a number`);
      }
      if (Number.isNaN(t)) {
        return e.writeUInt(n.NaN, 3);
      }
      if (!Number.isFinite(t)) {
        e.writeUInt(n.Infinity, 3);
        return e.writeBoolean(t === Number.POSITIVE_INFINITY);
      }
      switch (t) {
        case t >>> 0: {
          const s = Transcoder.GetIntSize(t);
          e.writeUInt(n.UInt, 3);
          e.writeUInt(s - 1, 3);
          e.writeUInt(t, s * 4);
          break;
        }
        case t | 0: {
          const s = Transcoder.GetIntSize(t);
          e.writeUInt(n.Int, 3);
          e.writeUInt(s - 1, 3);
          e.writeInt(t, s * 4);
          break;
        }
        default:
          e.writeUInt(n.Double, 3);
          e.writeDouble(t);
      }
    }
    decode(e) {
      switch (e.readUInt(3)) {
        case 0:
          return NaN;
        case 1:
          if (e.readBoolean()) {
            return Number.POSITIVE_INFINITY;
          } else {
            return Number.NEGATIVE_INFINITY;
          }
        case 2: {
          const t = e.readUInt(3) + 1;
          return e.readUInt(t * 4);
        }
        case 3: {
          const t = e.readUInt(3) + 1;
          return e.readInt(t * 4);
        }
        case 4:
          return e.readDouble();
      }
    }
  })();
  static Table = class {
    constructor(e, t = "strict") {
      this._kv = new Map();
      this._vk = new Map();
      for (const [t, n] of e.entries()) {
        this._kv.set(n, t + 1);
        this._vk.set(t + 1, n);
      }
      this._mode = t;
      this._size = Math.floor(Math.log2(this._kv.size)) + 1;
      this.has = this._kv.has.bind(this._kv);
    }
    get mode() {
      return this._mode;
    }
    get size() {
      return this._size;
    }
    get struct() {
      const E = {};
      for (const [e, t] of this._kv.entries()) {
        E[e] = "0x" + t.toString(16).padStart(2, "0");
      }
      return E;
    }
    getkv(e) {
      return this._kv.get(e);
    }
    getvk(e) {
      return this._vk.get(e);
    }
  };
  static Array = class {
    constructor(e = "default", { list: t, min: n, max: s } = {}) {
      this._mode = e;
      switch (e) {
        case "strict":
          this._table = new Transcoder.Table(t);
          break;
        case "flexible":
          throw new Error("Flexible mode is not implemented yet");
        case "default":
      }
      n = n ?? 7;
      s = s ?? 15;
      const $e = {
        min: n,
        max: s
      };
      this._prop = new Transcoder.DInt($e);
    }
    get mode() {
      return this._mode;
    }
    encode(e, t) {
      e.writeDInt(t.length, this._prop);
      switch (this._mode) {
        case "strict":
          for (const n of t) {
            e.writeTable(n, this._table);
          }
          break;
        case "flexible":
          throw new Error("Flexible mode is not implemented yet");
        default:
          for (const n of t) {
            e.writeAny(n, this);
          }
      }
    }
    decode(e) {
      const t = e.readDInt(this._prop);
      const n = [];
      if (this._mode === "strict") {
        for (let s = 0; s < t; s++) {
          n.push(e.readTable(this._table));
        }
      } else {
        for (let s = 0; s < t; s++) {
          n.push(e.readAny(this));
        }
      }
      return n;
    }
  };
  static init() {
    this.SUPPORTED_TYPES_TABLE = new this.Table(
      Array.from(this.SUPPORTED_TYPES.keys())
    );
    this.DEFAULT_ARRAY = new this.Array();
    this.DEFAULT_PROP = new this.DInt({
      min: 8,
      max: 32
    });
  }
  constructor() {
    this.ref = new Map();
    this.refid = 0;
  }
  static Encoder = class t extends this {
    static TYPES = {
      BUFFER: 1,
      DOUBLE: 2,
      QWORD: 3,
      HEX: 4
    };
    constructor(e = null, t = null) {
      super();
      this._buffer = [];
      this._size = 0;
      this._packr = e;
      this._packBuffer = t;
    }
    get buffer() {
      return this._buffer;
    }
    get size() {
      return this._size;
    }
    get byteLength() {
      return Math.ceil(this._size / 8);
    }
    realign() {
      return (this._size += (8 - (this._size % 8)) % 8);
    }
    _insert(e, t, n = null) {
      if (n) {
        this.realign();
      }
      this._size += t;
      return this._buffer.push({
        val: e,
        size: t,
        type: n
      });
    }
    writeTable(e, t) {
      if (t.mode === "strict") {
        return this._insert(t.getkv(e), t.size);
      }
      const n = t.getkv(e);
      if (n === undefined) {
        this._insert(null, t.size);
        return this.writeAny(e);
      } else {
        return this._insert(n, t.size);
      }
    }
    writeArray(e, t = Transcoder.DEFAULT_ARRAY) {
      if (t.mode === "strict") {
        return t.encode(this, e);
      } else if (this.ref.has(e)) {
        this._insert(true, 1);
        return this.writeDInt(this.ref.get(e), Transcoder.DEFAULT_PROP);
      } else {
        this._insert(false, 1);
        this.ref.set(e, this.refid++);
        return t.encode(this, e);
      }
    }
    writeStruct(e, t) {
      return t.encode(this, e);
    }
    writeString(n, s = true) {
      n = e.from(s ? `${n}\0` : n);
      return this._insert(n, n.byteLength * 8, t.TYPES.BUFFER);
    }
    writeBuffer(e) {
      return this._insert(e, e.byteLength * 8, t.TYPES.BUFFER);
    }
    writeBoolean(e) {
      return this._insert(!!e, 1);
    }
    writeInt(e, t) {
      return this._insert(e, t);
    }
    writeUInt(e, t) {
      return this._insert(e, t);
    }
    writeUInt64(e) {
      const s = 2539;
      const i = 2568;
      return this._insert(
        e,
        64,
        t.TYPES[((r = 3120), 2562, (c = i), "JE4w", "QWORD")]
      );
      var r;
      var c;
    }
    writeDInt(e, t) {
      const n = t.writeSize(e);
      this._insert(n.bit, 1);
      return this._insert(e, n.size);
    }
    writeFloat(e, t, n) {
      this._insert(e < 0, 1);
      return this._insert(Math.round(e * n), t);
    }
    writeUFloat(e, t, n) {
      return this._insert(Math.round(e * n), t);
    }
    writeDouble(e) {
      return this._insert(e, 64, t.TYPES.DOUBLE);
    }
    writeNumber(e) {
      return Transcoder.Number.encode(this, e);
    }
    writeHex(e, n) {
      const s = 1059;
      const i = 706;
      const a = 44;
      const r = 495;
      const c = 471;
      const d = 90;
      return this._insert(e, n * 8, t[("w4zl", (f = i), 316, "TYPES")].HEX);
      var f;
    }
    writeAny(e, t) {
      const n = b(e);
      if (!Transcoder.SUPPORTED_TYPES.has(n)) {
        throw new TypeError(
          `Type ${n} is not implemented for NetCodec.TYPES.Any`
        );
      }
      this.writeTable(n, Transcoder.SUPPORTED_TYPES_TABLE);
      switch (n) {
        case "boolean":
          this.writeBoolean(e);
          break;
        case "null":
        case "undefined":
          break;
        case "number":
          Transcoder.Number.encode(this, e);
          break;
        case "string":
          this.writeString(e);
          break;
        case "array":
          this.writeArray(e, t);
      }
    }
    writeByType(e, t, ...n) {
      return this[`write${Transcoder.TYPES_INDEX[e]}`](t, ...n);
    }
    pack(e) {
      this._packr.useBuffer(this._packBuffer);
      const n = this._packr.pack(e);
      return this._insert(n, n.byteLength * 8, t.TYPES.BUFFER);
    }
    finalize(s = null) {
      const i = s ?? e.allocUnsafe(this.byteLength);
      const o = new n(i);
      for (const { val: e, size: n, type: s } of this._buffer) {
        switch (s) {
          case t.TYPES.BUFFER:
            o.offset += (8 - (o.offset % 8)) % 8;
            i.set(e, o.offset / 8);
            o.seek(e.byteLength * 8, 2);
            break;
          case t.TYPES.DOUBLE:
            o.offset += (8 - (o.offset % 8)) % 8;
            i.writeDoubleBE(e, o.offset / 8);
            o.seek(64, 2);
            break;
          case t.TYPES.QWORD:
            o.offset += (8 - (o.offset % 8)) % 8;
            i.writeBigUInt64BE(e, o.offset / 8);
            o.seek(64, 2);
            break;
          case t.TYPES.HEX:
            o.offset += (8 - (o.offset % 8)) % 8;
            i.write(e, o.offset / 8, "hex");
            o.seek(n, 2);
            break;
          default:
            o.write(e, n);
        }
      }
      return i;
    }
  };
  static Decoder = class e extends this {
    static _MAX_BITS = Math.log2(Number.MAX_SAFE_INTEGER);
    static _MAX_BITS_SIGNED = 32;
    constructor(e, t = null) {
      super();
      this._bits = new r(e);
      this._unpack = t;
    }
    get length() {
      return this._bits.length;
    }
    get offset() {
      return this._bits.offset;
    }
    set offset(e) {
      this._bits.offset = e;
    }
    get buffer() {
      return this._bits.buffer;
    }
    get byteOffset() {
      return Math.ceil(this.offset / 8);
    }
    realign() {
      this.offset = this.byteOffset * 8;
    }
    _read_signed(t) {
      const n = e._MAX_BITS_SIGNED - t;
      return (this._read(t) << n) >> n;
    }
    _read(e) {
      return this._bits.read(e);
    }
    readTable(e) {
      const t = e.size;
      if (this.peek(t) !== 0) {
        return e.getvk(this._read(t));
      } else {
        this.seek(t, 2);
        return this.readAny();
      }
    }
    readArray(e = Transcoder.DEFAULT_ARRAY) {
      if (e.mode === "strict") {
        return e.decode(this);
      }
      if (this._read(1)) {
        return this.ref.get(this.readDInt(Transcoder.DEFAULT_PROP));
      }
      const t = [];
      this.ref.set(this.refid++, t);
      t.push.apply(t, e.decode(this));
      return t;
    }
    readStruct(e) {
      return e.decode(this);
    }
    readString(e) {
      const t = this.byteOffset;
      let n;
      if (typeof e == "number") {
        n = t + e;
        this.seek(n * 8);
      } else {
        n = this.buffer.indexOf(0, t);
        this.seek((n + 1) * 8);
      }
      return this.buffer.toString("utf8", t, n);
    }
    readBuffer(e) {
      const t = this.byteOffset;
      const n = t + e;
      this.seek(n * 8);
      return this.buffer.subarray(t, n);
    }
    readBoolean() {
      return !!this._read(1);
    }
    readInt(t) {
      if (t > e._MAX_BITS_SIGNED) {
        throw new RangeError(
          `${t} of bits is not supported for signed values, max is ${e._MAX_BITS_SIGNED}`
        );
      }
      return this._read_signed(t);
    }
    readUInt(t) {
      if (t > e._MAX_BITS) {
        throw new RangeError(
          `${t} of bits is not supported, max is ${e._MAX_BITS}`
        );
      }
      return this._read(t);
    }
    readUInt64() {
      const e = this.byteOffset;
      this.seek(e * 8 + 64);
      return this.buffer.readBigUInt64BE(e);
    }
    readDInt(e, t = false) {
      const n = e.readSize(this._read(1));
      if (t) {
        return this._read_signed(n);
      } else {
        return this._read(n);
      }
    }
    readFloat(e, t) {
      if (this.peek(1)) {
        return this._read_signed(e + 1) / t;
      } else {
        this.seek(1, 2);
        return this._read(e) / t;
      }
    }
    readUFloat(e, t) {
      return this._read(e) / t;
    }
    readDouble() {
      const e = this.byteOffset;
      this.seek(e * 8 + 64);
      return this.buffer.readDoubleBE(e);
    }
    readNumber() {
      return Transcoder.Number.decode(this);
    }
    readHex(e) {
      const t = this.byteOffset;
      const n = t + e;
      this.seek(n * 8);
      return this.buffer.toString("hex", t, n);
    }
    readAny(e) {
      switch (this.readTable(Transcoder.SUPPORTED_TYPES_TABLE)) {
        case "boolean":
          return this.readBoolean();
        case "null":
          return null;
        case "undefined":
          return;
        case "number":
          return Transcoder.Number.decode(this);
        case "string":
          return this.readString();
        case "array":
          return this.readArray(e);
      }
    }
    readByType(e, ...t) {
      return this[`read${Transcoder.TYPES_INDEX[e]}`](...t);
    }
    peek(e, t) {
      return this._bits.peek(e, t);
    }
    peekTable(e, t = this.offset) {
      return e.getvk(this.peek(e.size, t));
    }
    peekDInt(e, t = this.offset) {
      return this.peek(e.readSize(this.peek(1, t)), t + 1);
    }
    seek(e, t) {
      this._bits.seek(e, t);
    }
    unpack() {
      this.realign();
      return this._unpack(this.byteOffset);
    }
  };
}
class Serializable {
  static _MAX_BUFFER = 65536;
  static BUFFER = e.alloc(this._MAX_BUFFER);
  static _LIST = {};
  static get LIST() {
    return this._LIST;
  }
  static AddExtension(t, n = {}) {
    this._LIST[t.name] = t;
    if ("ownBuffer" in n) {
      t.BUFFER = e.alloc(this._MAX_BUFFER);
    }
  }
  static AddTable(e: any, t: any, n: any) {
    this["$$" + e] = new Transcoder.Table(t, n);
  }
  static AddProperty(e, t) {
    this["$" + e] = new Transcoder.DInt(t);
  }
  static LoadExtensions(e) {
    let runningCode = 10;
    function N(e) {
      return e.encode.call(
        e,
        new Transcoder.Encoder(this, e.constructor.BUFFER)
      );
    }
    function G(e, t, n, s) {
      return e.decode(new Transcoder.Decoder(t, (e) => n(s + e)));
    }
    for (const t of Object.values(this._LIST)) {
      t.ext_code = runningCode++;
      e.addExtension({
        Class: t,
        type: t.ext_code,
        pack: N,
        unpack: G.bind(null, t)
      });
    }
  }
}
class Structure extends Serializable {
  static AddStructure(e) {
    this._cstFields = new Map();
    this._fixFields = new Map();
    this._optFields = new Map();
    for (const [t, { mode: n, type: s, size: i, value: o }] of Object.entries(
      e
    )) {
      switch (n) {
        case "static":
          this._cstFields.set(t, o);
          break;
        case "fixed":
          const e = {
            type: s,
            size: i
          };
          this._fixFields.set(t, e);
          break;
        case "optional":
          const n = {
            type: s,
            size: i
          };
          this._optFields.set(t, n);
      }
    }
    super.AddTable("prop", Array.from(this._optFields.keys()));
  }
  static encode(e, t) {
    for (const [n, { type: s, size: i }] of this._fixFields.entries()) {
      e.writeByType(s, t[n], i);
    }
    for (const [n, { type: s, size: i }] of this._optFields.entries()) {
      if (t[n] != null) {
        e.writeTable(n, this.$$prop);
        e.writeByType(s, t[n], i);
      }
    }
    e.writeUInt(null, this.$$prop.size);
  }
  static decode(e) {
    const t = {};
    const n = this.$$prop.size;
    for (const [n, { type: s, size: i }] of this._fixFields.entries()) {
      t[n] = e.readByType(s, i);
    }
    for (let s = e.peek(n); s !== 0; s = e.peek(n)) {
      const n = e.readTable(this.$$prop);
      const { type: s, size: i } = this._optFields.get(n);
      const o = e.readByType(s, i);
      t[n] = o;
    }
    for (const [e, n] of this._cstFields.entries()) {
      t[e] = n;
    }
    return t;
  }
}
class IgeInteractionData extends Structure {
  static init() {
    const Oa = "1|0|3|2|4".split("|");
    let Pa = 0;
    while (true) {
      switch (Oa[Pa++]) {
        case "0":
          super.AddTable("type", ["garbage", "corruption"]);
          continue;
        case "1":
          super.AddProperty("byte", {
            min: 8,
            max: 24
          });
          continue;
        case "2":
          super.AddTable("position", [
            "aboveStack",
            "aboveUnclearable",
            "abovePerma",
            "bottom"
          ]);
          continue;
        case "3":
          super.AddTable("colors", [null, ...minocolors]);
          continue;
        case "4":
          const n = {
            mode: "fixed",
            type: Transcoder.TYPES.Table,
            size: this.$$type
          };
          const s = {
            mode: "optional",
            type: Transcoder.TYPES.String,
            size: true
          };
          const i = {
            mode: "fixed",
            type: Transcoder.TYPES.DInt,
            size: this.$byte
          };
          const o = {
            mode: "optional",
            type: Transcoder.TYPES.UInt,
            size: 13
          };
          const a = {
            mode: "optional",
            type: Transcoder.TYPES.Table,
            size: this.$$position
          };
          const r = {
            mode: "optional",
            type: Transcoder.TYPES.DInt,
            size: this.$byte
          };
          const c = {
            mode: "optional",
            type: Transcoder.TYPES.DInt,
            size: this.$byte
          };
          const p = {
            mode: "optional",
            type: Transcoder.TYPES.DInt,
            size: this.$byte
          };
          const d = {
            mode: "optional",
            type: Transcoder.TYPES.DInt,
            size: this.$byte
          };
          const h = {
            mode: "optional",
            type: Transcoder.TYPES.Int,
            size: GameBoard.MAX_WIDTH
          };
          const u = {
            mode: "optional",
            type: Transcoder.TYPES.UInt,
            size: GameBoard.MAX_HEIGHT
          };
          const m = {
            mode: "optional",
            type: Transcoder.TYPES.Table,
            size: this.$$colors
          };
          const g = {
            mode: "optional",
            type: Transcoder.TYPES.Table,
            size: this.$$colors
          };
          const f = {
            mode: "optional",
            type: Transcoder.TYPES.UInt,
            size: 22
          };
          const b = {
            mode: "optional",
            type: Transcoder.TYPES.UInt,
            size: GameBoard.MAX_WIDTH
          };
          const C = {
            mode: "optional",
            type: Transcoder.TYPES.UInt,
            size: 16
          };
          const y = {
            mode: "optional",
            type: Transcoder.TYPES.Boolean
          };
          const x = {
            mode: "optional",
            type: Transcoder.TYPES.Boolean
          };
          const v = {
            mode: "optional",
            type: Transcoder.TYPES.UInt,
            size: GameBoard.MAX_WIDTH
          };
          const k = {
            mode: "optional",
            type: Transcoder.TYPES.Double
          };
          const B = {
            mode: "optional",
            type: Transcoder.TYPES.String
          };
          const L = {
            mode: "optional",
            type: Transcoder.TYPES.String
          };
          const z = {
            mode: "optional",
            type: Transcoder.TYPES.String
          };
          const F = {
            mode: "optional",
            type: Transcoder.TYPES.String
          };
          const T = {
            mode: "optional",
            type: Transcoder.TYPES.Any
          };
          const M = {
            mode: "optional",
            type: Transcoder.TYPES.Any
          };
          const D = {
            mode: "optional",
            type: Transcoder.TYPES.String
          };
          const O = {
            mode: "optional",
            type: Transcoder.TYPES.Any
          };
          const P = {
            mode: "optional",
            type: Transcoder.TYPES.Any
          };
          const H = {
            type: n,
            username: s,
            amt: i,
            gameid: o,
            position: a,
            frame: r,
            cid: c,
            iid: p,
            ackiid: d,
            x: h,
            y: u,
            pos: m,
            neg: g,
            color: f,
            column: b,
            delay: C,
            queued: y,
            hardened: x,
            size: v,
            zthalt: k,
            actor_neg: B,
            actor_pos: L,
            anchor: z,
            actor_neg_data_type: F,
            actor_neg_data_amt: T,
            actor_neg_data_time: M,
            actor_pos_data_type: D,
            actor_pos_data_amt: O,
            actor_pos_data_time: P
          };
          super.AddStructure(H);
          continue;
      }
      break;
    }
  }
}
class SpecialLines extends Structure {
  static init() {
    const Vo = "0|3|2|1|4".split("|");
    let Yo = 0;
    while (true) {
      switch (Vo[Yo++]) {
        case "0":
          super.AddTable("action", ["add", "remove"]);
          continue;
        case "1":
          super.AddProperty("byte", {
            min: 8,
            max: 32
          });
          continue;
        case "2":
          super.AddTable("colors", [null, ...minocolors]);
          continue;
        case "3":
          super.AddTable("position", [
            "aboveStack",
            "aboveUnclearable",
            "abovePerma",
            "bottom"
          ]);
          continue;
        case "4":
          const t = {
            mode: "fixed",
            type: Transcoder.TYPES.Table,
            size: this.$$action
          };
          const n = {
            mode: "fixed",
            type: Transcoder.TYPES.DInt,
            size: this.$byte
          };
          const s = {
            mode: "fixed",
            type: Transcoder.TYPES.UInt,
            size: GameBoard.MAX_WIDTH
          };
          const i = {
            mode: "optional",
            type: Transcoder.TYPES.Table,
            size: this.$$colors
          };
          const o = {
            mode: "optional",
            type: Transcoder.TYPES.Table,
            size: this.$$colors
          };
          const a = {
            mode: "optional",
            type: Transcoder.TYPES.Table,
            size: this.$$position
          };
          const r = {
            mode: "optional",
            type: Transcoder.TYPES.UInt,
            size: GameBoard.MAX_WIDTH
          };
          const l = {
            mode: "optional",
            type: Transcoder.TYPES.UInt,
            size: 16
          };
          const c = {
            mode: "optional",
            type: Transcoder.TYPES.String
          };
          const p = {
            mode: "optional",
            type: Transcoder.TYPES.String
          };
          const d = {
            mode: "optional",
            type: Transcoder.TYPES.String
          };
          const h = {
            mode: "optional",
            type: Transcoder.TYPES.String
          };
          const u = {
            mode: "optional",
            type: Transcoder.TYPES.String
          };
          const m = {
            mode: "optional",
            type: Transcoder.TYPES.Any
          };
          const g = {
            mode: "optional",
            type: Transcoder.TYPES.Any
          };
          const f = {
            mode: "optional",
            type: Transcoder.TYPES.String
          };
          const b = {
            mode: "optional",
            type: Transcoder.TYPES.Any
          };
          const C = {
            mode: "optional",
            type: Transcoder.TYPES.Any
          };
          const y = {
            action: t,
            amt: n,
            size: s,
            pos: i,
            neg: o,
            position: a,
            column: r,
            slow: l,
            effect: c,
            actor_neg: p,
            actor_pos: d,
            anchor: h,
            actor_neg_data_type: u,
            actor_neg_data_amt: m,
            actor_neg_data_time: g,
            actor_pos_data_type: f,
            actor_pos_data_amt: b,
            actor_pos_data_time: C
          };
          super.AddStructure(y);
          continue;
      }
      break;
    }
  }
}
class GameReplay extends Serializable {
  static init() {
    super.AddExtension(this);
    super.AddProperty("prov", {
      min: 18,
      max: 26
    });
  }
  static decode(e) {
    return new this(e.readUInt(13), e.readDInt(this.$prov), e.unpack());
  }
  constructor(e, t, n) {
    super();
    this.gameid = e;
    this.provisioned = t;
    this.frames = n.map((e) => new GameReplayFrame(e));
  }
  encode(e) {
    e.writeUInt(this.gameid, 13);
    e.writeDInt(this.provisioned, this.constructor.$prov);
    e.pack(this.frames);
    return e.finalize();
  }
}
class GameReplayBoard extends Serializable {
  static init() {
    super.AddExtension(this);
    super.AddProperty("long", {
      min: 16,
      max: 32
    });
  }
  static decode(e: any) {
    const t = [],
      n = e.readUInt(13);
    for (let s = 0; s < n; s++) {
      const n = {
        board: {
          f: 0,
          g: 0,
          w: 0,
          h: 0,
          b: {}
        },
        gameid: 0
      };
      (n.gameid = e.readUInt(13)),
        (n.board.f = e.readUInt(10)),
        (n.board.g = e.readDInt(this.$long)),
        (n.board.w = e.readUInt(GameBoard.MAX_WIDTH)),
        (n.board.h = e.readUInt(GameBoard.MAX_HEIGHT)),
        (n.board.b = e.readStruct(GameBoard)),
        (t[s] = n);
    }
    return new this(t);
  }
  boards: any[];
  constructor(e: any) {
    super();
    this.boards = e;
  }
  encode(e: any) {
    e.writeUInt(this.boards.length, 13);
    for (const {
      gameid: n,
      board: { b: s, f: i, g: o, w: a, h: r }
    } of this.boards)
      e.writeUInt(n, 13),
        e.writeUInt(i, 10),
        e.writeDInt(o, this.constructor.$long),
        e.writeUInt(a, GameBoard.MAX_WIDTH),
        e.writeUInt(r, GameBoard.MAX_HEIGHT),
        e.writeStruct(s, GameBoard);
    return e.finalize();
  }
}
class ZenithSpecStats extends Serializable {
  static init() {
    super.AddExtension(this);
  }
  static decode(e) {
    const t = [];
    const n = e.readUInt(13);
    for (let s = 0; s < n; s++) {
      const n = {
        stats: {},
        allies: []
      };
      t[s] = n;
      n.gameid = e.readUInt(13);
      n.stats.rank = e.readUInt(6);
      n.stats.altitude = e.readFloat(18, 10);
      n.stats.btb = e.readUInt(13);
      n.stats.revives = e.readUInt(8);
      n.specCount = e.readUInt(8);
      n.speedrun = e.readBoolean();
      n.nearWR = e.readBoolean();
      const i = e.readUInt(3);
      for (let t = 0; t < i; t++) {
        n.allies.push(e.readUInt(13));
      }
    }
    return new this(t);
  }
  constructor(e) {
    super();
    this.sb = e;
  }
  encode(e) {
    e.writeUInt(this.sb.length, 13);
    for (const {
      gameid: t,
      stats: n,
      allies: s,
      specCount: i,
      speedrun: o,
      nearWR: a
    } of this.sb) {
      e.writeUInt(t, 13);
      e.writeUInt(Math.floor(n.rank), 6);
      e.writeFloat(n.altitude.toFixed(2), 18, 10);
      e.writeUInt(n.btb, 13);
      e.writeUInt(n.revives, 8);
      e.writeUInt(i, 8);
      e.writeBoolean(o);
      e.writeBoolean(a);
      if (s) {
        e.writeUInt(s.length, 3);
        for (const t of s) {
          e.writeUInt(t, 13);
        }
      } else {
        e.writeUInt(0, 3);
      }
    }
    return e.finalize();
  }
}
class GameReplayFrame extends Serializable {
  static init() {
    super.AddExtension(this, {
      ownBuffer: true
    });
    super.AddProperty("frame", {
      min: 18,
      max: 26
    });
    super.AddTable("type", [
      "keydown",
      "keyup",
      "start",
      "full",
      "end",
      "ige",
      "strategy",
      "manual_target"
    ]);
    super.AddTable("key", [
      "moveLeft",
      "moveRight",
      "rotate180",
      "rotateCCW",
      "rotateCW",
      "softDrop",
      "hardDrop",
      "undo",
      "redo",
      "hold",
      "retry",
      "exit"
    ]);
  }
  static decode(e) {
    const t = {
      type: "",
      frame: 0,
      data: {}
    };
    switch (
      // @ts-expect-error
      ((t.type = e.readTable(this.$$type)),
      // @ts-expect-error
      (t.frame = e.readDInt(this.$frame)),
      t.type)
    ) {
      case "keydown":
      case "keyup": {
        // @ts-expect-error
        const n = e.readTable(this.$$key);
        const s = e.readBoolean();
        const i = {
          key: n,
          subframe: e.readFloat(4, 10),
          hoisted: false
        };
        if (s) {
          i.hoisted = true;
        }
        t.data = i;
        break;
      }
      case "start":
        t.data = {};
        break;
      case "full":
        t.data = e.readStruct(FullFrame);
        break;
      case "end":
        t.data = e.readStruct(EndFrame);
        break;
      case "ige":
        t.data = e.readStruct(IgeFrame);
        break;
      case "strategy":
        t.data = e.readUInt(3);
        break;
      case "manual_target":
        t.data = e.readUInt(13);
        break;
      default:
        t.data = e.unpack();
    }
    return new this(t);
  }
  constructor(e: any) {
    super();
    this.type = e.type;
    this.frame = e.frame;
    this.data = e.data;
  }
  encode(e) {
    const t = this.constructor;
    switch (
      (e.writeTable(this.type, t.$$type),
      e.writeDInt(this.frame, t.$frame),
      this.type)
    ) {
      case "keydown":
      case "keyup": {
        e.writeTable(this.data.key, t.$$key);
        e.writeBoolean(this.data.hoisted);
        e.writeFloat(this.data.subframe, 4, 10);
        return e.finalize();
      }
      case "start":
        return e.finalize();
      case "full":
        return e.writeStruct(this.data, FullFrame), e.finalize();
      case "end":
        return e.writeStruct(this.data, EndFrame), e.finalize();
      case "ige":
        return e.writeStruct(this.data, IgeFrame), e.finalize();
      case "strategy":
        return e.writeUInt(this.data, 3), e.finalize();
      case "manual_target":
        return e.writeUInt(this.data, 13), e.finalize();
      default:
        return (
          console.warn(
            `Fallback to packer ${this.type} -> ${JSON.stringify(this.data)}`
          ),
          e.pack(this.data),
          e.finalize()
        );
    }
  }
}
class Leaderboard extends Serializable {
  static init() {
    super.AddExtension(this);
  }
  static decode(e) {
    const t = [];
    const n = e.readUInt(13);
    for (let s = 0; s < n; s++) {
      const n = {};
      n.userid = e.readHex(12);
      n.gameid = e.readUInt(13);
      n.alive = e.readBoolean();
      n.naturalorder = e.readUInt(13);
      n.options = e.readStruct(IgeOptions);
      t.push(n);
    }
    return t;
  }
  constructor(e) {
    super();
    this.players = e;
  }
  encode(e) {
    e.writeUInt(this.players.length, 13);
    for (const {
      gameid: t,
      userid: n,
      alive: s,
      naturalorder: i,
      options: o
    } of this.players) {
      e.writeHex(n, 12);
      e.writeUInt(t, 13);
      e.writeBoolean(s);
      e.writeUInt(i, 13);
      e.writeStruct(o, IgeOptions);
    }
    return e.finalize();
  }
}
class FullFrame extends Serializable {
  static init() {
    super.AddTable("piece", [null, ...Object.keys(tetrominoes)], "flexible");
    //@ts-ignore
    super.AddTable("ixs", ["off", "hold", "tap"]);
  }
  static encode(e, t) {
    const n = t.game.board;
    const s = t.game.bag;
    const i = t.game.hold;
    const o = t.game.g;
    const a = t.game.controlling;
    const r = t.game.falling;
    const l = t.game.handling;
    e.writeUInt(s.length(), 12);
    for (const t of s) {
      // @ts-expect-error
      e.writeTable(t, this.$$piece);
    }
    e.writeStruct(n, GameBoard);
    e.writeBoolean(i.locked);
    // @ts-expect-error
    e.writeTable(i.piece, this.$$piece);
    e.writeDouble(o);
    e.writeBoolean(a.inputSoftdrop);
    e.writeBoolean(a.lastshift === -1);
    e.writeBoolean(a.lShift.held);
    e.writeBoolean(a.rShift.held);
    e.writeUInt(t.diyusi, 4);
    e.writeDouble(a.lShift.arr);
    e.writeDouble(a.rShift.arr);
    e.writeDouble(a.lShift.das);
    e.writeDouble(a.rShift.das);
    e.writeStruct(r, FallingPiece);
    e.writeFloat(l.arr, 6, 10);
    e.writeUInt(l.sdf, 6);
    e.writeBoolean(l.safelock);
    e.writeBoolean(l.cancel);
    e.writeBoolean(l.may20g);
    e.writeBoolean(t.game.playing);
    e.writeFloat(l.das, 8, 10);
    e.writeFloat(l.dcd, 8, 10);
    e.writeStruct(t.stats, GameStats);
  }
  static decode(e: any) {
    const t = {
      diyusi: 0,
      stats: {},
      game: {}
    };
    const n = {
      bag: [],
      falling: {},
      playing: false,
      controlling: {
        lShift: {
          dir: -1,
          held: false,
          arr: 0,
          das: 0
        },
        rShift: {
          dir: 1,
          held: false,
          arr: 0,
          das: 0
        },
        inputSoftdrop: false,
        lastshift: 1,
        falling: {}
      },
      board: {},
      handling: {
        arr: 0,
        sdf: 0,
        safelock: false,
        cancel: false,
        may20g: false,
        das: 0,
        dcd: 0
      },
      g: 0,
      hold: {
        locked: false,
        piece: null
      }
    };
    const s = n.controlling;
    const i = n.handling;
    const o = e.readUInt(12);
    for (let t = 0; t < o; t++) {
      // @ts-expect-error
      n.bag.push(e.readTable(this.$$piece));
    }
    n.board = e.readStruct(GameBoard);
    n.hold = {
      locked: e.readBoolean(),
      // @ts-expect-error
      piece: e.readTable(this.$$piece)
    };
    n.g = e.readDouble();
    s.inputSoftdrop = e.readBoolean();
    s.lastshift = e.readBoolean() ? -1 : 1;
    s.lShift.held = e.readBoolean();
    s.rShift.held = e.readBoolean();
    t.diyusi = e.readUInt(4);
    s.lShift.arr = e.readDouble();
    s.rShift.arr = e.readDouble();
    s.lShift.das = e.readDouble();
    s.rShift.das = e.readDouble();
    n.falling = e.readStruct(FallingPiece);
    i.arr = e.readFloat(6, 10);
    i.sdf = e.readUInt(6);
    i.safelock = e.readBoolean();
    i.cancel = e.readBoolean();
    i.may20g = e.readBoolean();
    n.playing = e.readBoolean();
    i.das = e.readFloat(8, 10);
    i.dcd = e.readFloat(8, 10);
    t.stats = e.readStruct(GameStats);
    t.game = n;
    return t;
  }
}
class GameBoard extends Serializable {
  static MAX_WIDTH = Math.log2(512);
  static MAX_HEIGHT = Math.log2(512);
  static init() {
    super.AddTable("blk", [false, null, ...minocolors]);
  }
  static encode(e: any, t: any) {
    const n = t[0]?.length ?? 0;
    const s = t.length;
    if (!n) {
      return e.writeUInt(0, this.MAX_WIDTH);
    }
    e.writeUInt(n, this.MAX_WIDTH);
    e.writeUInt(s, this.MAX_HEIGHT);
    for (const n of t) {
      if (n.some((e: any) => e !== null)) {
        for (const t of n) {
          // @ts-expect-error
          e.writeTable(t, this.$$blk);
        }
      } else {
        // @ts-expect-error
        e.writeTable(false, this.$$blk);
      }
    }
  }
  static decode(e: any) {
    const t = [];
    const n = e.readUInt(this.MAX_WIDTH);
    if (!n) {
      return t;
    }
    const s = e.readUInt(this.MAX_HEIGHT);
    for (let i = 0; i < s; i++) {
      if (e.peekTable(this.$$blk) !== false) {
        t[i] = [];
        for (let s = 0; s < n; s++) {
          t[i][s] = e.readTable(this.$$blk);
        }
      } else {
        e.seek(4, 2);
        t[i] = new Array(n).fill(null);
      }
    }
    return t;
  }
}
class FallingPiece extends Serializable {
  static init() {
    super.AddTable("piece", [null, ...Object.keys(tetrominoes)], "flexible");
  }
  static encode(e: any, t: any) {
    e.writeTable(t.type, this.$$piece);
    e.writeInt(t.x, GameBoard.MAX_WIDTH);
    e.writeUInt(t.r, 2);
    e.writeUInt(t.hy, GameBoard.MAX_HEIGHT);
    e.writeUInt(t.irs, 2);
    e.writeUInt(t.kick, 5);
    e.writeUInt(t.keys, 16);
    e.writeUInt(t.flags, 15);
    e.writeUInt(t.safelock, 3);
    e.writeUInt(t.lockresets, 5);
    e.writeUInt(t.rotresets, 6);
    e.writeBoolean(t.skip.length);
    if (t.skip.length) {
      for (const n of t.skip) {
        e.writeUInt(n + 1, 7);
      }
      e.writeUInt(0, 7);
    }
    e.writeDouble(t.y);
    e.writeDouble(t.locking);
  }
  static decode(e) {
    const t = {
      type: "",
      x: 0,
      r: 0,
      hy: 0,
      irs: 0,
      kick: 0,
      keys: 0,
      flags: 0,
      safelock: 0,
      lockresets: 0,
      rotresets: 0,
      skip: [],
      y: 0,
      locking: 0
    };
    //@ts-ignore
    t.type = e.readTable(this.$$piece);
    t.x = e.readInt(GameBoard.MAX_WIDTH);
    t.r = e.readUInt(2);
    t.hy = e.readUInt(GameBoard.MAX_HEIGHT);
    t.irs = e.readUInt(2);
    t.kick = e.readUInt(5);
    t.keys = e.readUInt(16);
    t.flags = e.readUInt(15);
    t.safelock = e.readUInt(3);
    t.lockresets = e.readUInt(5);
    t.rotresets = e.readUInt(6);
    t.skip = [];
    if (e.readBoolean()) {
      const n = 7;
      for (let s = e.peek(n); s !== 0; s = e.peek(n)) {
        //@ts-ignore
        t.skip.push(e.readUInt(n) - 1);
      }
      e.seek(n, 2);
    }
    t.y = e.readDouble();
    t.locking = e.readDouble();
    return t;
  }
}
class GameStats extends Serializable {
  static init() {
    super.AddTable("piece", [...Object.keys(tetrominoes)], "flexible");
    super.AddProperty("short", {
      min: 8,
      max: 16
    });
    super.AddProperty("long", {
      min: 16,
      max: 32
    });
    this._clears = [
      "singles",
      "doubles",
      "triples",
      "quads",
      "pentas",
      "realtspins",
      "minitspins",
      "minitspinsingles",
      "tspinsingles",
      "minitspindoubles",
      "tspindoubles",
      "minitspintriples",
      "tspintriples",
      "minitspinquads",
      "tspinquads",
      "tspinpentas",
      "allclear"
    ];
  }
  static encode(e, t) {
    const n = t.garbage;
    const s = t.clears;
    const i = t.finesse;
    e.writeDInt(t.lines, this.$short);
    e.writeDInt(t.level_lines, this.$short);
    e.writeDInt(t.level_lines_needed, this.$short);
    e.writeDInt(t.inputs, this.$long);
    e.writeDInt(t.holds, this.$long);
    e.writeDInt(t.score, this.$long);
    e.writeUInt(t.level, 8);
    e.writeDInt(t.combo, this.$long);
    e.writeDInt(t.topcombo, this.$long);
    e.writeUInt(t.combopower, 3);
    e.writeDInt(t.btb, this.$short);
    e.writeDInt(t.topbtb, this.$short);
    e.writeUInt(t.btbpower, 8);
    e.writeDInt(t.tspins, this.$long);
    e.writeDInt(t.piecesplaced, this.$long);
    for (const t of this._clears) {
      e.writeDInt(s[t], this.$short);
    }
    e.writeDInt(n.sent, this.$long);
    e.writeDInt(n.sent_nomult, this.$long);
    e.writeDInt(n.maxspike, this.$long);
    e.writeDInt(n.maxspike_nomult, this.$long);
    e.writeDInt(n.received, this.$long);
    e.writeDInt(n.attack, this.$long);
    e.writeDInt(n.cleared, this.$long);
    e.writeDInt(t.kills, this.$short);
    e.writeDInt(i.combo, this.$long);
    e.writeDInt(i.faults, this.$long);
    e.writeDInt(i.perfectpieces, this.$long);
    e.writeStruct(t.zenith, Zenith);
  }
  static decode(e) {
    const t = {
      zenlevel: 1,
      zenprogress: 0,
      clears: {},
      garbage: {},
      finesse: {}
    };
    t.lines = e.readDInt(this.$short);
    t.level_lines = e.readDInt(this.$short);
    t.level_lines_needed = e.readDInt(this.$short);
    t.inputs = e.readDInt(this.$long);
    t.holds = e.readDInt(this.$long);
    t.score = e.readDInt(this.$long);
    t.level = e.readUInt(8);
    t.combo = e.readDInt(this.$long);
    t.topcombo = e.readDInt(this.$long);
    t.combopower = e.readUInt(3);
    t.btb = e.readDInt(this.$short);
    t.topbtb = e.readDInt(this.$short);
    t.btbpower = e.readUInt(8);
    t.tspins = e.readDInt(this.$long);
    t.piecesplaced = e.readDInt(this.$long);
    for (const n of this._clears) {
      t.clears[n] = e.readDInt(this.$short);
    }
    t.garbage.sent = e.readDInt(this.$long);
    t.garbage.sent_nomult = e.readDInt(this.$long);
    t.garbage.maxspike = e.readDInt(this.$long);
    t.garbage.maxspike_nomult = e.readDInt(this.$long);
    t.garbage.received = e.readDInt(this.$long);
    t.garbage.attack = e.readDInt(this.$long);
    t.garbage.cleared = e.readDInt(this.$long);
    t.kills = e.readDInt(this.$short);
    t.finesse.combo = e.readDInt(this.$long);
    t.finesse.faults = e.readDInt(this.$long);
    t.finesse.perfectpieces = e.readDInt(this.$long);
    t.zenith = e.readStruct(Zenith);
    return t;
  }
}
class Zenith extends Serializable {
  static init() {
    super.AddProperty("long", {
      min: 16,
      max: 32
    });
  }
  static encode(e: any, t: any) {
    e.writeDouble(t.altitude);
    e.writeDouble(t.rank);
    e.writeDouble(t.peakrank);
    e.writeDouble(t.avgrankpts);
    e.writeDouble(t.totalbonus);
    e.writeFloat(t.targetingfactor, 16, 100);
    e.writeFloat(t.targetinggrace, 16, 100);
    e.writeUInt(t.floor, 4);
    e.writeUInt(t.revives, 8);
    e.writeUInt(t.revivesTotal, 8);
    e.writeBoolean(t.speedrun);
    e.writeBoolean(t.speedrun_seen);
    for (let n = 0; n < 9; n++) e.writeDInt(t.splits[n], this.$long);
  }
  static decode(e) {
    const t = {};
    t.altitude = e.readDouble();
    t.rank = e.readDouble();
    t.peakrank = e.readDouble();
    t.avgrankpts = e.readDouble();
    t.totalbonus = e.readDouble();
    t.targetingfactor = e.readFloat(16, 100);
    t.targetinggrace = e.readFloat(16, 100);
    t.floor = e.readUInt(4);
    t.revives = e.readUInt(8);
    t.revivesTotal = e.readUInt(8);
    t.revivesMaxOfBoth = Math.max(t.revives, t.revivesTotal - t.revives);
    t.speedrun = e.readBoolean();
    t.speedrun_seen = e.readBoolean();
    t.splits = [];
    for (let n = 0; n < 9; n++) {
      t.splits[n] = e.readDInt(this.$long);
    }
    return t;
  }
}
class IgeFrame extends Serializable {
  static init() {
    super.AddProperty("byte", {
      min: 8,
      max: 24
    });
    super.AddTable("type", [
      "interaction",
      "interaction_confirm",
      "target",
      "targeted",
      "allow_targeting",
      "kev",
      "custom"
    ]);
    // @ts-expect-error
    super.AddTable("int_type", [
      "garbage",
      "zenith.climb_pts",
      "zenith.bonus",
      "zenith.incapacitated",
      "zenith.revive"
    ]);
  }
  static encode(e: any, t: any) {
    const s = t.type,
      i = t.data;
    switch (
      (e.writeDInt(t.id, this.$byte),
      e.writeDInt(t.frame, this.$byte),
      e.writeTable(s, this.$$type),
      s)
    ) {
      case "interaction":
        return e.writeStruct(i, IgeInteractionData);
      case "interaction_confirm":
        switch ((e.writeTable(i.type, this.$$int_type), i.type)) {
          case "garbage":
            return e.writeStruct(i, IgeInteractionData);
          case "zenith.climb_pts":
          case "zenith.bonus":
            return (
              e.writeUInt(i.gameid, 13),
              e.writeDInt(i.frame, this.$byte),
              e.writeDouble(i.amt)
            );
          case "zenith.incapacitated":
          case "zenith.revive":
            return e.writeUInt(i.gameid, 13), e.writeDInt(i.frame, this.$byte);
          default:
            throw new Error(`Unknown interaction type received: ${i.type}`);
        }
      case "target":
        e.writeUInt(i.targets.length, 13);
        for (const t of i.targets) e.writeUInt(t, 13);
        break;
      case "targeted":
        e.writeBoolean(i.value),
          e.writeUInt(i.gameid, 13),
          e.writeDInt(i.frame, this.$byte);
        break;
      case "allow_targeting":
        e.writeBoolean(i.value);
        break;
      case "kev":
        e.writeUInt(i.victim.gameid, 13),
          e.writeUInt(i.killer.gameid, 13),
          e.writeDInt(i.frame, this.$byte),
          e.writeUInt(i.fire, 10);
        break;
      case "custom":
        return e.writeStruct(i, IgeCustomData);
    }
  }
  static decode(e) {
    const t = {};
    t.id = e.readDInt(this.$byte);
    t.frame = e.readDInt(this.$byte);
    t.type = e.readTable(this.$$type);
    e: switch (t.type) {
      case "interaction":
        t.data = e.readStruct(IgeInteractionData);
        break;
      case "interaction_confirm": {
        const n = e.readTable(this.$$int_type);
        switch (n) {
          case "garbage":
            t.data = e.readStruct(IgeInteractionData);
            break e;
          case "zenith.climb_pts":
          case "zenith.bonus":
            t.data = {
              type: n,
              gameid: e.readUInt(13),
              frame: e.readDInt(this.$byte),
              amt: e.readDouble()
            };
            break e;
          case "zenith.incapacitated":
          case "zenith.revive":
            t.data = {
              type: n,
              gameid: e.readUInt(13),
              frame: e.readDInt(this.$byte)
            };
            break e;
        }
        break;
      }
      case "target": {
        const n = [];
        const s = e.readUInt(13);
        for (let t = 0; t < s; t++) {
          n.push(e.readUInt(13));
        }
        t.data = {
          targets: n
        };
        break;
      }
      case "targeted":
        t.data = {
          value: e.readBoolean(),
          gameid: e.readUInt(13),
          frame: e.readDInt(this.$byte)
        };
        break;
      case "allow_targeting":
        t.data = {
          value: e.readBoolean()
        };
        break;
      case "kev":
        t.data = {
          victim: {
            gameid: e.readUInt(13)
          },
          killer: {
            gameid: e.readUInt(13)
          },
          frame: e.readDInt(this.$byte),
          fire: e.readUInt(10)
        };
        break;
      case "custom":
        t.data = e.readStruct(IgeCustomData);
    }
    return t;
  }
}
class IgeLines extends Structure {
  static init() {
    super.AddTable("action", ["add", "remove"]);
    super.AddProperty("byte", {
      min: 8,
      max: 32
    });
    super.AddStructure({
      action: {
        mode: "fixed",
        type: Transcoder.TYPES.Table,
        size: this.$$action
      },
      amt: {
        mode: "fixed",
        type: Transcoder.TYPES.DInt,
        size: this.$byte
      },
      perma: {
        mode: "fixed",
        type: Transcoder.TYPES.Boolean
      },
      size: {
        mode: "fixed",
        type: Transcoder.TYPES.UInt,
        size: GameBoard.MAX_WIDTH
      },
      column: {
        mode: "optional",
        type: Transcoder.TYPES.UInt,
        size: GameBoard.MAX_WIDTH
      },
      slow: {
        mode: "optional",
        type: Transcoder.TYPES.UInt,
        size: 16
      },
      effect: {
        mode: "optional",
        type: Transcoder.TYPES.String
      }
    });
  }
}
class IgeCustomData extends Serializable {
  static init() {
    super.AddTable("type", [
      "garbage",
      "map",
      "queue",
      "piece",
      "lines",
      "boardsize",
      "holderstate",
      "setoptions",
      "constants",
      "tetrominoes"
    ]);
  }
  static encode(e, { type: t, data: n }) {
    switch ((e.writeTable(t, this.$$type), t)) {
      case "garbage":
        return e.writeStruct(n, IgeInteractionData);
      case "map":
        return (
          e.writeStruct(n.map, GameMap),
          e.writeUInt(n.w, GameBoard.MAX_WIDTH),
          e.writeUInt(n.h, GameBoard.MAX_HEIGHT)
        );
      case "queue":
        return e.writeBoolean(n.start), e.writeString(n.queue.toString());
      case "piece":
        return e.writeString(n.piece);
      case "lines":
        return e.writeStruct(n, IgeLines);
      case "boardsize":
        return (
          e.writeUInt(n.w, GameBoard.MAX_WIDTH),
          e.writeUInt(n.h, GameBoard.MAX_HEIGHT)
        );
      case "holderstate":
      case "constants":
        return e.pack(n);
      case "setoptions":
        return e.writeStruct(n.options, IgeOptions);
      case "tetrominoes":
        return e.writeStruct(n, Tetrominoes);
    }
  }
  static decode(e: any) {
    const t = {};
    switch (((t.type = e.readTable(this.$$type)), (t.data = {}), t.type)) {
      case "garbage":
        t.data = e.readStruct(IgeInteractionData);
        break;
      case "map":
        (t.data.map = e.readStruct(GameMap)),
          (t.data.w = e.readUInt(GameBoard.MAX_WIDTH)),
          (t.data.h = e.readUInt(GameBoard.MAX_HEIGHT));
        break;
      case "queue":
        (t.data.start = e.readBoolean()),
          (t.data.queue = e.readString().split(","));
        break;
      case "piece":
        t.data.piece = e.readString();
        break;
      case "lines":
        t.data = e.readStruct(IgeLines);
        break;
      case "boardsize":
        (t.data.w = e.readUInt(GameBoard.MAX_WIDTH)),
          (t.data.h = e.readUInt(GameBoard.MAX_HEIGHT));
        break;
      case "holderstate":
      case "constants":
        t.data = e.unpack();
        break;
      case "setoptions":
        t.data.options = e.readStruct(IgeOptions);
        break;
      case "tetrominoes":
        t.data = e.readStruct(Tetrominoes);
    }
    return t;
  }
}
class GameMap extends Serializable {
  static init() {
    super.AddTable(
      "letters",
      ["?", ",", "_", "#", "@", "z", "l", "o", "s", "i", "j", "t", "g", "d"],
      "flexible"
    );
    super.AddProperty("word", {
      min: 16,
      max: 32
    });
  }
  static encode(e, t) {
    const n = t.split("");
    e.writeDInt(n.length, this.$word);
    for (const t of n) {
      e.writeTable(t, this.$$letters);
    }
  }
  static decode(e) {
    let t = "";
    const n = e.readDInt(this.$word);
    for (let s = 0; s < n; s++) {
      t += e.readTable(this.$$letters);
    }
    return t;
  }
}
class Tetrominoes extends Serializable {
  static init() {
    const Xe = "0|1|2|3|4".split("|");
    let qe = 0;
    while (true) {
      switch (Xe[qe++]) {
        case "0":
          super.AddProperty("tiny", {
            min: 3,
            max: 7
          });
          continue;
        case "1":
          super.AddTable(
            "spinbonus",
            [...Object.keys(spinbonuses_rules)],
            "flexible"
          );
          continue;
        case "2":
          super.AddTable("colors", [...minocolors]);
          continue;
        case "3":
          super.AddTable("kicksets", [...Object.keys(kicksets)], "flexible");
          continue;
        case "4":
          super.AddTable("special", ["i", "i2", "i3", "l3", "i5", "oo"]);
          continue;
      }
      break;
    }
  }
  static encode(e, t) {
    const n = t.tetrominoes;
    const s = t.minotypes;
    const i = t.tetrominoes_color;
    const o = Object.keys(n);
    e.writeUInt(o.length, 8);
    for (const t of o) {
      e.writeString(t);
    }
    for (const [t, o] of Object.entries(n)) {
      const { matrix: n, preview: a } = o;
      e.writeDInt(n.w, this.$tiny);
      e.writeDInt(n.h, this.$tiny);
      e.writeUInt(n.dx, 5);
      e.writeUInt(n.dy, 5);
      e.writeDInt(n.data[0].length, this.$tiny);
      const [r, l] = [Transcoder.cla32(n.w - 1), Transcoder.cla32(n.h - 1)];
      for (const t of n.data) {
        for (const [n, s] of t) {
          e.writeUInt(n, r);
          e.writeUInt(s, l);
        }
      }
      e.writeDInt(a.w, this.$tiny);
      e.writeDInt(a.h, this.$tiny);
      for (const [t, n] of a.data) {
        e.writeUInt(t, r);
        e.writeUInt(n, l);
      }
      e.writeBoolean(o.weight !== undefined);
      e.writeBoolean(o.spinbonus_override);
      e.writeBoolean(o.kickset_override);
      e.writeBoolean(o.kickset_special);
      e.writeBoolean(s.includes(t));
      e.writeTable(i[t], this.$$colors);
      if (o.weight !== undefined) {
        e.writeDInt(o.weight, this.$tiny);
      }
      if (o.spinbonus_override) {
        e.writeTable(o.spinbonus_override.rule, this.$$spinbonus);
        e.writeBoolean(o.spinbonus_override.mini);
      }
      if (o.kickset_override) {
        e.writeTable(o.kickset_override, this.$$kicksets);
      }
      if (o.kickset_special) {
        e.writeTable(o.kickset_special, this.$$special);
      }
    }
  }
  static decode(e) {
    const t = {};
    const n = [];
    const s = {};
    const i = e.readUInt(8);
    const o = [];
    for (let n = 0; n < i; n++) {
      const n = e.readString();
      t[n] = {
        matrix: {},
        preview: {}
      };
      o.push(n);
    }
    for (const i of o) {
      const o = t[i];
      const { matrix: a, preview: r } = o;
      a.w = e.readDInt(this.$tiny);
      a.h = e.readDInt(this.$tiny);
      a.dx = e.readUInt(5);
      a.dy = e.readUInt(5);
      const l = e.readDInt(this.$tiny);
      const [c, p] = [Transcoder.cla32(a.w - 1), Transcoder.cla32(a.h - 1)];
      a.data = [];
      for (let t = 0; t < 4; t++) {
        a.data[t] = [];
        for (let n = 0; n < l; n++) {
          const [s, i] = [e.readUInt(c), e.readUInt(p)];
          a.data[t][n] = [s, i];
        }
      }
      r.w = e.readDInt(this.$tiny);
      r.h = e.readDInt(this.$tiny);
      r.data = [];
      for (let t = 0; t < l; t++) {
        const [n, s] = [e.readUInt(c), e.readUInt(p)];
        r.data[t] = [n, s];
      }
      const d = e.readBoolean();
      const h = e.readBoolean();
      const u = e.readBoolean();
      const _ = e.readBoolean();
      const m = e.readBoolean();
      s[i] = e.readTable(this.$$colors);
      if (d) {
        o.weight = e.readDInt(this.$tiny);
      }
      if (h) {
        o.spinbonus_override = {
          rule: e.readTable(this.$$spinbonus),
          mini: e.readBoolean()
        };
      }
      if (u) {
        o.kickset_override = e.readTable(this.$$kicksets);
      }
      if (_) {
        o.kickset_special = e.readTable(this.$$special);
      }
      if (m) {
        n.push(i);
      }
    }
    return {
      minotypes: n,
      tetrominoes: t,
      tetrominoes_color: s
    };
  }
}
class IgeOptions extends Serializable {
  static TypeOrders = [
    "boolean",
    "number",
    "table",
    "object",
    "array",
    "string"
  ];
  static OptsBook = OptionsList;
  static init() {
    super.AddTable("options", Object.keys(this.OptsBook));
    super.AddTable(
      "minoskin",
      ["i", "j", "l", "o", "s", "t", "z", "ghost", "other"],
      "flexible"
    );
    super.AddTable("skins", ["tetrio", "_bombs", "connected_test"], "flexible");
    super.AddTable("ixs", ["off", "hold", "tap"]);
    for (const [e, t] of Object.entries(this.OptsBook)) {
      if (t.allowed) {
        super.AddTable("_" + e, t.allowed);
      } else if (t.possibles) {
        super.AddTable("_" + e, t.possibles, "flexible");
      }
    }
  }
  static *ParseOptions(e) {
    const { TypeOrders: t, OptsBook: n } = this;
    const s = Object.keys(e);
    for (const i of t) {
      for (const t of s) {
        const s = n[t];
        if (s.type !== i) {
          continue;
        }
        const o = e[t];
        yield [t, o, s];
      }
    }
  }
  static encode(e, t) {
    for (const [n, s, i] of this.ParseOptions(t)) {
      e.writeTable(n, this.$$options);
      switch (i.type) {
        case "object":
          if (n === "handling") {
            e.writeFloat(s.arr, 6, 10);
            e.writeUInt(s.sdf, 6);
            e.writeBoolean(s.safelock);
            e.writeBoolean(s.cancel);
            e.writeBoolean(s.may20g);
            e.writeFloat(s.das, 8, 10);
            e.writeFloat(s.dcd, 8, 10);
            e.writeTable(s.irs, this.$$ixs);
            e.writeTable(s.ihs, this.$$ixs);
          } else if (n === "minoskin") {
            e.writeUInt(Object.keys(s).length, 8);
            for (const [t, n] of Object.entries(s)) {
              e.writeTable(t, this.$$minoskin);
              e.writeTable(n, this.$$skins);
            }
          }
          break;
        case "array":
          e.writeArray(s);
          break;
        case "boolean":
          e.writeBoolean(s);
          break;
        case "table":
          e.writeTable(s, this[`$$_${n}`], i.mode);
          break;
        case "number":
          e.writeNumber(s);
          break;
        case "string":
          e.writeString(s);
          break;
        default:
          throw new TypeError(
            `Unknown type for key: ${n} value: ${s} | got -> ${i.type}`
          );
      }
    }
    e.writeTable(null, this.$$options);
  }
  static decode(e) {
    const t = this.$$options.size;
    const n = this.OptsBook;
    const s = {};
    let i = null;
    let o = null;
    for (let a = e.peek(t); a !== 0; a = e.peek(t)) {
      const t = e.readTable(this.$$options);
      const a = n[t]?.type;
      switch (a) {
        case "object":
          if (t === "handling") {
            const n = {};
            n.arr = e.readFloat(6, 10);
            n.sdf = e.readUInt(6);
            n.safelock = e.readBoolean();
            n.cancel = e.readBoolean();
            n.may20g = e.readBoolean();
            n.das = e.readFloat(8, 10);
            n.dcd = e.readFloat(8, 10);
            n.irs = e.readTable(this.$$ixs);
            n.ihs = e.readTable(this.$$ixs);
            s[t] = n;
          } else if (t === "minoskin") {
            const n = {};
            const i = e.readUInt(8);
            s[t] = n;
            for (let t = 0; t < i; t++) {
              const t = e.readTable(this.$$minoskin);
              const s = e.readTable(this.$$skins);
              n[t] = s;
            }
          }
          break;
        case "array":
          s[t] = e.readArray();
          break;
        case "boolean":
          s[t] = e.readBoolean();
          break;
        case "table":
          s[t] = e.readTable(this[`$$_${t}`]);
          break;
        case "number":
          s[t] = e.readNumber();
          break;
        case "string":
          s[t] = e.readString();
          break;
        default:
          console.error("Options dump: ", s);
          throw new TypeError(
            `Unknown type for key: ${t} | got -> ${a}\nLast Key: ${i}\nLast Value: ${o}\n`
          );
      }
      i = t;
      o = s[t];
    }
    e.seek(t, 2);
    return s;
  }
}
class EndFrameOptions extends IgeOptions {
  static *ParseOptions(e: any) {
    for (const [n, s, i] of super.ParseOptions(e)) {
      if (i.default !== s) {
        if (i.type !== "object" || !strictShallowEqual(i.default, s)) {
          yield [n, s, i];
        }
      }
    }
  }
}
class EndFrame extends Serializable {
  static init() {
    super.AddExtension(this, {
      ownBuffer: true
    });
    super.AddTable("gor", [
      null,
      "topout",
      "garbagesmash",
      "zenith",
      "clear",
      "topout_clear",
      "winner",
      "forfeit",
      "retry",
      "drop",
      "dropnow",
      "disconnect"
    ]);
  }
  static encode(e, t) {
    const n = t.successful;
    const s = t.gameoverreason;
    const i = t.killer.gameid;
    const o = t.killer.type === "spark";
    const a = t.killer.username ?? "";
    const { apm: r, pps: l, vsscore: c } = t.aggregatestats;
    const { game: p, stats: d, diyusi: h } = t;
    e.writeBoolean(n);
    e.writeTable(s, this.$$gor);
    e.writeUInt(i, 13);
    e.writeBoolean(o, 1);
    e.writeString(a);
    e.writeStruct(t.options, EndFrameOptions);
    e.writeDouble(r);
    e.writeDouble(l);
    e.writeDouble(c);
    e.writeStruct(
      {
        game: p,
        stats: d,
        diyusi: h
      },
      FullFrame
    );
  }
  static decode(e) {
    const t = {
      killer: {},
      aggregatestats: {}
    };
    t.successful = e.readBoolean();
    t.gameoverreason = e.readTable(this.$$gor);
    t.killer.gameid = e.readUInt(13);
    t.killer.type = e.readBoolean() ? "spark" : "sizzle";
    t.killer.username = e.readString();
    t.options = e.readStruct(EndFrameOptions);
    t.aggregatestats.apm = e.readDouble();
    t.aggregatestats.pps = e.readDouble();
    t.aggregatestats.vsscore = e.readDouble();
    Object.assign(t, e.readStruct(FullFrame));
    return t;
  }
}
// initOptions();
Transcoder.init();
GameReplay.init();
GameReplayBoard.init();
ZenithSpecStats.init();
GameReplayFrame.init();
Leaderboard.init();
FullFrame.init();
GameBoard.init();
FallingPiece.init();
GameStats.init();
Zenith.init();
IgeFrame.init();
IgeInteractionData.init();
SpecialLines.init();
IgeCustomData.init();
Tetrominoes.init();
GameMap.init();
IgeOptions.init();
EndFrameOptions.init();
EndFrame.init();

// IgeLines.init();
Serializable.LoadExtensions(n);
EncodingManager.SetMsgpackr(Be, ke);

export { EncodingManager as FullCodec };
