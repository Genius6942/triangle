import { BagType, Engine, KickTable } from "../engine";

export namespace Game {
  /** Handling config interface (test on TETR.IO for limits) */
  export interface Handling {
    arr: number;
    das: number;
    dcd: number;
    sdf: number;
    safelock: boolean;
    cancel: boolean;
    may20g: boolean;
  }

  /** Game config preset */
  export type Preset =
    | "default"
    | "tetra league"
    | "enforced delays"
    | "4wide"
    | "100 battle royale"
    | "classic"
    | "arcade"
    | "bombs"
    | "quickplay";

  /** Way the garbage enters the board. `continuous` and `delayed` not yet supported */
  export type GarbageEntry = "instant" | "continuous" | "delayed";
  /** When garbage enters the board. only `combo blocking` is currently supported */
  export type GarbageBlocking = "combo blocking" | "limited blocking" | "none";
  /** Garbage target bonus not yet supported. Used in royale mode */
  export type GarbageTargetBonus = "offensive" | "defensive" | "none";
  /** Only `zero` passthrough supported */
  export type Passthrough = "zero" | "limited" | "consistent" | "full";
  /** Only `T-spins` supported */
  export type SpinBonuses = "T-spins" | "all" | "handheld" | "stupid" | "none";
  /** Only `multiplier` is currently supported */
  export type ComboTable =
    | "none"
    | "multiplier"
    | "classic guideline"
    | "modern guideline";
  /** Only `versus` supported. Client will run in `practice` but undoing is not yet implemented. */
  export type GameMode = "versus" | "royale" | "practice";

  export interface Options {
    version: number;
    seed_random: boolean;
    seed: number;
    g: number;
    stock: number;
    countdown: boolean;
    countdown_count: number;
    countdown_interval: number;
    precountdown: number;
    prestart: number;
    mission: string;
    mission_type: string;
    zoominto: string;
    slot_counter1: string;
    slot_counter2: string;
    slot_counter3: string;
    slot_counter5: string;
    slot_bar1: string;
    display_fire: boolean;
    display_username: boolean;
    hasgarbage: boolean;
    bgmnoreset: boolean;
    neverstopbgm: boolean;
    display_next: boolean;
    display_hold: boolean;
    infinite_hold: boolean;
    gmargin: number;
    gincrease: number;
    garbagemultiplier: number;
    garbagemargin: number;
    garbageincrease: number;
    garbagecap: number;
    garbagecapincrease: number;
    garbagecapmax: number;
    garbageabsolutecap: boolean;
    garbageholesize: number;
    garbagephase: number;
    garbagequeue: boolean;
    garbageare: number;
    garbageentry: GarbageEntry;
    garbageblocking: GarbageBlocking;
    garbagetargetbonus: GarbageTargetBonus;
    presets: Preset;
    bagtype: BagType;
    spinbonuses: SpinBonuses;
    combotable: ComboTable;
    kickset: KickTable;
    nextcount: number;
    allow_harddrop: boolean;
    display_shadow: boolean;
    locktime: number;
    garbagespeed: number;
    forfeit_time: number;
    are: number;
    lineclear_are: number;
    infinitemovement: boolean;
    lockresets: number;
    allow180: boolean;
    objective: {
      type: string;
    };
    room_handling: boolean;
    room_handling_arr: number;
    room_handling_das: number;
    room_handling_sdf: number;
    manual_allowed: boolean;
    b2bchaining: boolean;
    allclears: boolean;
    clutch: boolean;
    nolockout: boolean;
    passthrough: Passthrough;
    can_undo: boolean;
    can_retry: boolean;
    retryisclear: boolean;
    noextrawidth: boolean;
    stride: boolean;
    boardwidth: number;
    boardheight: number;
    new_payback: boolean;
    messiness_change: number;
    messiness_inner: number;
    messiness_nosame: boolean;
    messiness_timeout: number;
  }

  export interface ReadyOptions {
    version: number;
    seed_random: boolean;
    seed: number;
    g: number;
    stock: number;
    countdown: boolean;
    countdown_count: number;
    countdown_interval: number;
    precountdown: number;
    prestart: number;
    mission: string;
    mission_type: string;
    zoominto: string;
    slot_counter1: string;
    slot_counter2: string;
    slot_counter3: string;
    slot_counter5: string;
    slot_bar1: string;
    display_fire: boolean;
    display_username: boolean;
    hasgarbage: boolean;
    bgmnoreset: boolean;
    neverstopbgm: boolean;
    display_next: boolean;
    display_hold: boolean;
    infinite_hold: boolean;
    gmargin: number;
    gincrease: number;
    garbagemultiplier: number;
    garbagemargin: number;
    garbageincrease: number;
    garbagecap: number;
    garbagecapincrease: number;
    garbagecapmax: number;
    garbageholesize: number;
    garbagephase: boolean;
    garbagequeue: boolean;
    garbageare: number;
    garbageentry: GarbageEntry;
    garbageblocking: GarbageBlocking;
    garbagetargetbonus: GarbageTargetBonus;
    presets: Preset;
    bagtype: BagType;
    spinbonuses: SpinBonuses;
    combotable: ComboTable;
    kickset: KickTable;
    nextcount: number;
    allow_harddrop: boolean;
    display_shadow: boolean;
    locktime: number;
    garbagespeed: number;
    forfeit_time: number;
    are: number;
    lineclear_are: number;
    infinitemovement: boolean;
    lockresets: number;
    allow180: boolean;
    objective: { type: string };
    room_handling: boolean;
    room_handling_arr: number;
    room_handling_das: number;
    room_handling_sdf: number;
    manual_allowed: boolean;
    b2bchaining: boolean;
    allclears: boolean;
    clutch: boolean;
    nolockout: boolean;
    passthrough: Passthrough;
    can_undo: boolean;
    can_retry: boolean;
    retryisclear: boolean;
    noextrawidth: boolean;
    stride: boolean;
    boardwidth: number;
    boardheight: number;
    new_payback: boolean;
    messiness_change: number;
    messiness_inner: number;
    messiness_nosame: boolean;
    messiness_timeout: number;
    usebombs: boolean;
    song: string;
    latencypreference: string;
    handling: {
      arr: number;
      das: number;
      dcd: number;
      sdf: number;
      safelock: boolean;
      cancel: boolean;
      may20g: true;
    };
    fulloffset: number;
    fullinterval: number;
    gameid: string;
    username: string;
    constants_overrides: Record<string, any>;
    garbageattackcap: boolean;
    nosound: boolean;
    boardbuffer: number;
    survival_cap: number;
    survival_timer_itv: number;
    survival_layer_min: number;
    minoskin: {
      z: string;
      l: string;
      o: string;
      s: string;
      i: string;
      j: string;
      t: string;
      other: string;
    };
    ghostskin: string;
    boardskin: string;
  }

  export interface Ready {
    players: {
      gameid: string;
      userid: string;
      options: ReadyOptions;
      alive: boolean;
    }[];
    isNew: boolean;
  }

  export namespace IGEs {
    export type all = (Target | AllowTargeting | Interaction | KEV) & {
      frame: number;
      id: number;
    };

    export interface Target {
      type: "target";
      targets: string[];
    }
    export interface AllowTargeting {
      type: "allow_targeting";
      value: boolean;
    }

    export namespace Interactions {
      export type all = Garbage | Targeted;

      export interface Garbage {
        iid: number;
        type: "garbage";
        amt: number;
        col?: number;
        ackiid: number;
        x: number;
        y: number;
        size: number;
        username: string;
      }

      export interface Targeted {
        type: "targeted";
        value: boolean;
      }
    }

    export interface Interaction {
      type: "interaction" | "interaction_confirm";
      gameid: string;
      data: Interactions.all;
      cid: number;
    }

    export interface KEV {
      type: "kev";
      victim: {
        gameid: string;
        name: string;
      };
      killer: {
        gameid: string;
        name: string;
        type: "sizzle";
      };
      fire: number;
    }
  }

  export interface IGE {
    id: number;
    targetFrame: number;
    unlocks?: number;
    data: IGEs.all;
  }

  export interface Leaderboard {
    id: string;
    username: string;
    handling: Handling;
    active: boolean;
    success: null | true;
    inputs: number;
    piecesplaced: number;
    naturalorder: number;
    score: number;
    wins: number;
    points: {
      primary: number;
      secondary: number;
      tertiary: number;
      extra: {};
    };
  }

  export type Key =
    | "moveLeft"
    | "moveRight"
    | "rotateCW"
    | "rotateCCW"
    | "rotate180"
    | "softDrop"
    | "hardDrop"
    | "hold";
  export namespace Replay {
    export namespace Frames {
      export type all = Start | Full | IGE | Keypress | End | Target;

      export interface Start {
        type: "start";
        data: {};
      }

      export interface Full {
        type: "full";
        data: any; // TODO: type this
      }

      export interface IGE {
        type: "ige";
        data: {
          id: number;
          frame: number;
          type: "ige";
          data: IGEs.all;
        };
      }

      export interface Keypress {
        type: "keydown" | "keyup";
        data: {
          key: Key;
          subframe: number;
        };
      }

      export interface End {
        type: "end";
        data: any; // TODO: type this
      }

      export interface Target {
        type: "target";
        data: {
          id: "diyusi";
          frame: number;
        } & (
          | {
              type: "target";
              data: string;
            }
          | {
              type: "strategy";
              data: 0 | 1 | 2 | 3;
            }
        );
      }
    }

    export type Frame = Frames.all & { frame: number };
  }

  export type Mino = "s" | "z" | "j" | "l" | "i" | "t" | "o";
  export type BoardSquare = Mino | "gb" | null;

  export namespace Client {
    export type Events = Garbage | Frameset;

    export interface Frameset {
      type: "frameset";
      provisioned: number;
      frames: Game.Replay.Frame[];
    }

    export interface Garbage {
      type: "garbage";
      frame: number;
      amount: number;
      size: number;
    }
  }

  export type Target =
    | {
        strategy: "even" | "elims" | "random" | "payback";
      }
    | {
        strategy: "manual";
        target: string;
      };

  export namespace Tick {
    export interface In {
      frame: number;
      events: Client.Events[];
      engine: Engine;
    }

    export interface Keypress {
      type: "keydown" | "keyup";
      frame: number;
      data: {
        key: Key;
        /** The 1-digit decimal part of the frame (`.0 | .1 | .2 | .3 | .4 | .5 | .6 | .7 | .8 | .9`) */
        subframe: number;
      };
    }

    export interface Out {
      keys?: Keypress[];
      runAfter?: (() => void)[];
    }

    export type Func = (data: In) => Promise<Out> | Out;
  }
}
