// amadeus-codec
import { pack } from "../../utils";
import { Bits } from "./bits";

export type CodecType = "vm" | "custom" | "codec-2" | "json" | "teto" | "candor";

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
          // @ts-ignore
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
              // @ts-ignore
              Buffer.concat([i, n])
            );
          }
          case 2:
          case 3:
          case 4:
          case 5:
            // @ts-ignore
            return Buffer.concat([i, Buffer.from(t.msg)]);
          default:
            // @ts-ignore
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
