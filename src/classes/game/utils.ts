import { Queue } from "../../engine";
import { Game } from "../../types";

export const getFullFrame = ({
  options,
  bgm,
  handling,
  multiplayer
}: {
  options: Game.ReadyOptions;
  bgm: string;
  multipleTargets?: true;
  handling: {
    arr: number;
    das: number;
    dcd: number;
    sdf: number;
    safelock: boolean;
    cancel: boolean;
    may20g: boolean;
  };
  multiplayer?: boolean;
}): Game.Replay.Frames.Full & { frame: number } => ({
  frame: 0,
  type: "full",
  data: {
    successful: false,
    gameoverreason: null,
    replay: {},
    source: {},
    options: {
      ...options,
      displayFire: multiplayer,
      fulloffset: options.fulloffset,
      fullinterval: options.fullinterval,
      song: bgm,
      username: options.username,
      constants_overrides: {},
      boardbuffer: 20,
      minoskin: {
        z: "tetrio",
        l: "tetrio",
        o: "tetrio",
        s: "tetrio",
        i: "tetrio",
        j: "tetrio",
        t: "tetrio",
        other: "tetrio"
      },
      ghostskin: "tetrio",
      boardskin: "generic"
    },
    stats: {
      seed: options.seed,
      lines: 0,
      level_lines: 0,
      level_lines_needed: 1,
      inputs: 0,
      holds: 0,
      time: { start: 0, zero: true, locked: false, prev: 0, frameoffset: 0 },
      score: 0,
      zenlevel: 1,
      zenprogress: 0,
      level: 1,
      combo: 0,
      currentcombopower: 0,
      topcombo: 0,
      btb: 0,
      topbtb: 0,
      currentbtbchainpower: 0,
      tspins: 0,
      piecesplaced: 0,
      clears: {
        singles: 0,
        doubles: 0,
        triples: 0,
        quads: 0,
        pentas: 0,
        realtspins: 0,
        minitspins: 0,
        minitspinsingles: 0,
        tspinsingles: 0,
        minitspindoubles: 0,
        tspindoubles: 0,
        tspintriples: 0,
        tspinquads: 0,
        tspinpentas: 0,
        allclear: 0
      },
      garbage: { sent: 0, received: 0, attack: 0, cleared: 0 },
      kills: 0,
      finesse: { combo: 0, faults: 0, perfectpieces: 0 }
    },
    diyusi: 0,
    enemies: [],
    targets: [],
    fire: 0,
    game: {
      board: Array.from({ length: options.boardheight * 2 }, () =>
        Array.from({ length: options.boardwidth }, () => null)
      ),
      bag: [
        ...new Queue({
          type: options.bagtype,
          minLength: 7,
          seed: options.seed
        }).value.map((piece) => piece.toLowerCase())
      ],
      hold: { piece: null, locked: false },
      g: options.g,
      controlling: {
        ldas: 0,
        ldasiter: 0,
        lshift: false,
        rdas: 0,
        rdasiter: 0,
        rshift: false,
        lastshift: 0,
        softdrop: false
      },
      falling: {
        sleep: true,
        deep_sleep: true,
        hibernated: false,
        locking: 0,
        lockresets: 0,
        forcelock: false,
        floored: false,
        clamped: false,
        safelock: 0,
        x: 4,
        y: 14,
        r: 0,
        type: "i",
        highesty: 14,
        last: null,
        lastkick: 0,
        lastrotation: "none",
        irs: 0,
        ihs: false,
        aox: 0,
        aoy: 0,
        keys: 0
      },
      handling: handling,
      playing: true
    },

    killer: { gameid: null, name: null, type: "sizzle" },
    aggregatestats: { apm: 0, pps: 0, vsscore: 0 }
  }
});

/** round frame */
export const rf = (frame: number) => Math.round(frame * 10) / 10;
/** split frame */
export const sf = (frame: number) => [
  Math.floor(frame),
  Math.round((frame % 1) * 10) / 10
];
