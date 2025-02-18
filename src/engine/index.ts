import { Game } from "../types";
import { Board, BoardInitializeParams } from "./board";
import {
  GarbageQueue,
  GarbageQueueInitializeParams,
  IncomingGarbage,
  OutgoingGarbage
} from "./garbage";
import { IGEHandler, MultiplayerOptions } from "./multiplayer";
import { Queue, QueueInitializeParams } from "./queue";
import { Mino } from "./queue/types";
import { IncreasableValue } from "./types";
import { EngineCheckpoint, SpinType } from "./types";
import { IncreaseTracker, deepCopy } from "./utils";
import { garbageCalcV2, garbageData } from "./utils/damageCalc";
import { KickTable, legal } from "./utils/kicks";
import { KickTableName, kicks } from "./utils/kicks/data";
import { Tetromino, tetrominoes } from "./utils/tetromino";
import { Falling, Rotation } from "./utils/tetromino/types";

import chalk from "chalk";

export interface GameOptions {
  spinBonuses: Game.SpinBonuses;
  comboTable: keyof (typeof garbageData)["comboTable"] | "multiplier";
  garbageTargetBonus: "none" | "normal" | string;
  clutch: boolean;
  garbageBlocking: "combo blocking" | "limited blocking" | "none";
}

export type PCOptions =
  | false
  | {
      garbage: number;
      b2b: number;
    };

export interface B2BOptions {
  chaining: boolean;
  charging:
    | false
    | {
        at: number;
        base: number;
      };
}

export interface MiscellaneousOptions {
  movement: {
    infinite: boolean;
    lockResets: number;
    lockTime: number;
    may20G: boolean;
  };
  allowed: {
    spin180: boolean;
    hardDrop: boolean;
    hold: boolean;
  };
  infiniteHold: boolean;
}

export interface EngineInitializeParams {
  queue: QueueInitializeParams;
  board: BoardInitializeParams;
  kickTable: KickTable;
  options: GameOptions;
  gravity: IncreasableValue;
  garbage: GarbageQueueInitializeParams;
  handling: Game.Handling;
  pc: PCOptions;
  b2b: B2BOptions;
  multiplayer?: MultiplayerOptions;
  misc: MiscellaneousOptions;
}

export class Engine {
  queue!: Queue;
  held!: Mino | null;
  holdLocked!: boolean;
  falling!: Tetromino;
  private _kickTable!: KickTableName;
  board!: Board;
  lastSpin!: {
    piece: Mino;
    type: SpinType;
  } | null;
  stats!: {
    combo: number;
    b2b: number;
    pieces: number;
  };
  gameOptions!: GameOptions;
  garbageQueue!: GarbageQueue;

  frame!: number;
  subframe!: number;
  checkpoints!: EngineCheckpoint[];

  initializer: EngineInitializeParams;

  handling!: Game.Handling;

  input!: {
    lDas: number;
    lDasIter: number;
    lShift: boolean;
    rDas: number;
    rDasIter: number;
    rShift: boolean;
    lastShift: number;
    softDrop: boolean;
    keys: { [k in Game.Key]: boolean };
  };

  pc!: PCOptions;
  b2b!: B2BOptions;

  dynamic!: {
    gravity: IncreaseTracker;
    garbageMultiplier: IncreaseTracker;
    garbageCap: IncreaseTracker;
  };

  multiplayer?: {
    options: MultiplayerOptions;
    targets: number[];
    passthrough: {
      network: boolean;
      replay: boolean;
      travel: boolean;
    };
  };
  igeHandler!: IGEHandler;

  misc!: MiscellaneousOptions;

  onGarbageSpawn?: (column: number, size: number) => void;

  private resCache!: {
    pieces: number;
    garbage: {
      sent: number[];
      received: OutgoingGarbage[];
    };
  };

  constructor(options: EngineInitializeParams) {
    this.initializer = options;
    this.init();
  }

  init() {
    const options = this.initializer;

    this.queue = new Queue(options.queue);

    this._kickTable = options.kickTable;

    this.board = new Board(options.board);

    this.garbageQueue = new GarbageQueue(options.garbage);

    this.igeHandler = new IGEHandler(options.multiplayer?.opponents || []);

    if (options.multiplayer)
      this.multiplayer = {
        options: options.multiplayer,
        targets: [],
        passthrough: {
          network: ["consistent", "zero"].includes(
            options.multiplayer.passthrough
          ),
          replay: options.multiplayer.passthrough !== "full",
          travel: ["zero", "limited"].includes(options.multiplayer.passthrough)
        }
      };

    this.held = null;
    this.holdLocked = false;
    this.lastSpin = null;

    this.stats = {
      combo: -1,
      b2b: -1,
      pieces: 0
    };

    this.pc = options.pc;
    this.b2b = {
      chaining: options.b2b.chaining,
      charging: options.b2b.charging
    };

    this.dynamic = {
      gravity: new IncreaseTracker(
        options.gravity.value,
        options.gravity.increase,
        options.gravity.marginTime
      ),
      garbageMultiplier: new IncreaseTracker(
        options.garbage.multiplier.value,
        options.garbage.multiplier.increase,
        options.garbage.multiplier.marginTime
      ),
      garbageCap: new IncreaseTracker(
        options.garbage.cap.value,
        options.garbage.cap.increase,
        options.garbage.cap.marginTime
      )
    };

    this.misc = options.misc;

    this.gameOptions = options.options;
    this.handling = options.handling;
    this.input = {
      lDas: 0,
      lDasIter: 0,
      lShift: false,
      rDas: 0,
      rDasIter: 0,
      rShift: false,
      lastShift: 0,
      softDrop: false,
      keys: {
        moveRight: false,
        moveLeft: false,
        softDrop: false,
        hold: false,
        rotateCW: false,
        rotateCCW: false,
        rotate180: false,
        hardDrop: false
      }
    };
    this.frame = 0;
    this.subframe = 0;

    this.flushRes();

    this.nextPiece();

    this.checkpoints = [];

    this.bindAll();
  }

  private flushRes() {
    const res = this.resCache ? deepCopy(this.resCache) : null;
    this.resCache = {
      pieces: 0,
      garbage: {
        sent: [],
        received: []
      }
    };

    return res!;
  }

  reset() {
    this.init();
  }

  bindAll() {
    this.moveRight = this.moveRight.bind(this);
    this.moveLeft = this.moveLeft.bind(this);
    this.dasRight = this.dasRight.bind(this);
    this.dasLeft = this.dasLeft.bind(this);
    this.softDrop = this.softDrop.bind(this);
    this.hardDrop = this.hardDrop.bind(this);
    this.hold = this.hold.bind(this);
    this.rotateCW = this.rotateCW.bind(this);
    this.rotateCCW = this.rotateCCW.bind(this);
    this.rotate180 = this.rotate180.bind(this);
    this.save = this.save.bind(this);
    this.checkpoint = this.checkpoint.bind(this);
    this.nextPiece = this.nextPiece.bind(this);
  }

  checkpoint() {
    this.save();
  }

  save() {
    this.checkpoints.push({
      garbage: deepCopy(this.garbageQueue.queue),
      board: deepCopy(this.board.state),
      falling: this.falling.symbol,
      queue: this.queue.index,
      b2b: this.stats.b2b,
      combo: this.stats.combo
    });
  }

  get kickTable(): (typeof kicks)[KickTableName] {
    return kicks[this._kickTable];
  }

  get kickTableName(): KickTableName {
    return this._kickTable;
  }

  set kickTable(value: KickTableName) {
    this._kickTable = value;
  }

  nextPiece(canClutch = false) {
    const newTetromino = this.queue.shift()!;

    const isFirstPiece = this.falling === undefined;

    const { clamped, ihs, irs } = this.falling || {
      clamped: false,
      ihs: false,
      irs: 0
    };

    this.initiatePiece(newTetromino);
    if (canClutch && this.gameOptions.clutch) {
      while (
        Math.max(...this.falling.absoluteBlocks.map((block) => block[1])) <
          this.board.fullHeight &&
        !legal(this.falling.absoluteBlocks, this.board.state)
      ) {
        this.falling.location[1]++;
      }
    }

    if (!isFirstPiece) {
      if (clamped && this.handling.dcd > 0) {
        this.input.lDas = Math.min(
          this.input.lDas,
          this.handling.das - this.handling.dcd
        );
        this.input.lDasIter = this.handling.arr;

        this.input.rDas = Math.min(
          this.input.rDas,
          this.handling.das - this.handling.dcd
        );
        this.input.rDasIter = this.handling.arr;
      }

      // TODO: dead??

      if (ihs) {
        this.falling.ihs = false;
        this.hold();
      }

      if (irs !== 0) {
        this.rotate(irs as Rotation);
      }
    }

    if (this.is20G()) this.slam();
  }

  private is20G() {
    const is20G = this.dynamic.gravity.get() > this.board.height;
    const mode20G = this.misc.movement.may20G;

    if (this.input.softDrop) {
      const preferSoftDrop = this.handling.may20g || (is20G && mode20G);
      return (
        (this.handling.sdf === 41 ||
          this.dynamic.gravity.get() * this.handling.sdf > this.board.height) &&
        preferSoftDrop
      );
    }

    return is20G && mode20G;
  }

  private slam() {
    const gravity = this.dynamic.gravity.get();
    this.dynamic.gravity.set(Number.MAX_SAFE_INTEGER);
    this.fall(null, 1);
    this.dynamic.gravity.set(gravity);
  }

  initiatePiece(piece: Mino) {
    this.falling = new Tetromino({
      boardHeight: this.board.height,
      boardWidth: this.board.width,
      initialRotation:
        piece.toLowerCase() in this.kickTable.spawn_rotation
          ? this.kickTable.spawn_rotation[
              piece.toLowerCase() as keyof typeof this.kickTable.spawn_rotation
            ]
          : 0,
      symbol: piece
    });
  }

  get toppedOut() {
    try {
      for (const block of this.falling.blocks) {
        if (
          this.board.state[-block[1] + this.falling.y][
            block[0] + this.falling.location[0]
          ] !== null
        )
          return true;
      }

      return false;
    } catch {
      return true;
    }
  }

  isTSpinKick(kick: ReturnType<typeof Tetromino.prototype.rotate>) {
    if (typeof kick === "object") {
      return (
        // fin cw and tst ccw
        ((kick.id === "23" || kick.id === "03") &&
          kick.kick[0] === 1 &&
          kick.kick[1] === -2) ||
        // fin ccw and tst cw
        ((kick.id === "21" || kick.id === "01") &&
          kick.kick[0] === -1 &&
          kick.kick[1] === -2)
      );
    }

    return false;
  }

  rotate(amt: Rotation) {
    const currentRotation = this.falling.rotation;
    const newRotation = (currentRotation + amt) % 4;

    let lastRotation = Falling.LastRotationKind.None;

    if (newRotation < currentRotation) {
      lastRotation = Falling.LastRotationKind.Right;
    } else {
      lastRotation = Falling.LastRotationKind.Left;
    }

    if (newRotation == 0 && currentRotation == 3) {
      lastRotation = Falling.LastRotationKind.Right;
    }

    if (newRotation == 3 && currentRotation == 3) {
      lastRotation = Falling.LastRotationKind.Left;
    }

    if (newRotation == 2 && currentRotation == 0)
      lastRotation = Falling.LastRotationKind.Vertical;
    if (newRotation == 0 && currentRotation == 2)
      lastRotation = Falling.LastRotationKind.Vertical;
    if (newRotation == 3 && currentRotation == 1)
      lastRotation = Falling.LastRotationKind.Horizontal;
    if (newRotation == 1 && currentRotation == 3)
      lastRotation = Falling.LastRotationKind.Horizontal;

    const res = this.falling.rotate(
      this.board.state,
      this.kickTableName,
      amt,
      !this.misc.movement.infinite &&
        this.falling.totalRotations > this.misc.movement.lockResets + 15
    );

    if (res === true) {
      this.falling.aox = 0;
      this.falling.aoy = 0;
      this.falling.last = Falling.LastKind.Rotate;
      this.falling.lastRotation = lastRotation;
      this.falling.lastKick = 0;

      const spin = this.detectSpin(false);

      this.lastSpin = {
        piece: this.falling.symbol,
        type: spin
      };

      this.falling.spinType =
        spin === "none"
          ? Falling.SpinTypeKind.Null
          : spin === "mini"
            ? Falling.SpinTypeKind.Mini
            : Falling.SpinTypeKind.Normal;
      this.falling.fallingRotations++;
      this.falling.totalRotations++;

      if (this.falling.clamped && this.handling.dcd > 0) {
        this.input.lDas = Math.min(
          this.input.lDas,
          this.handling.das - this.handling.dcd
        );
        this.input.lDasIter = this.handling.arr;
        this.input.rDas = Math.min(
          this.input.rDas,
          this.handling.das - this.handling.dcd
        );
        this.input.rDasIter = this.handling.arr;
      }

      if (++this.falling.lockResets < 15 || this.misc.movement.infinite) {
        this.falling.locking = 0;
      }

      return true;
    }

    if (this.falling.symbol === Mino.O) return;

    if (typeof res === "object") {
      this.falling.aox = 0;
      this.falling.aoy = 0;
      this.falling.last = Falling.LastKind.Rotate;
      this.falling.lastRotation = lastRotation;
      this.falling.lastKick = res.index + 1;
      const spin = this.detectSpin(this.isTSpinKick(res));

      this.lastSpin = {
        piece: this.falling.symbol,
        type: spin
      };

      this.falling.spinType =
        spin === "none"
          ? Falling.SpinTypeKind.Null
          : spin === "mini"
            ? Falling.SpinTypeKind.Mini
            : Falling.SpinTypeKind.Normal;
      this.falling.fallingRotations++;
      this.falling.totalRotations++;

      if (this.falling.clamped && this.handling.dcd > 0) {
        this.input.lDas = Math.min(
          this.input.lDas,
          this.handling.das - this.handling.dcd
        );
        this.input.lDasIter = this.handling.arr;
        this.input.rDas = Math.min(
          this.input.rDas,
          this.handling.das - this.handling.dcd
        );
        this.input.rDasIter = this.handling.arr;
      }

      if (++this.falling.lockResets < 15 || this.misc.movement.infinite) {
        this.falling.locking = 0;
      }

      return true;
    }
  }

  rotateCW() {
    return this.rotate(1);
  }

  rotateCCW() {
    return this.rotate(3);
  }

  rotate180() {
    return this.rotate(2);
  }

  moveRight() {
    const res = this.falling.moveRight(this.board.state);
    if (res && this.gameOptions.spinBonuses !== "stupid") this.lastSpin = null;
    return res;
  }

  moveLeft() {
    const res = this.falling.moveLeft(this.board.state);
    if (res && this.gameOptions.spinBonuses !== "stupid") this.lastSpin = null;
    return res;
  }

  dasRight() {
    const res = this.falling.dasRight(this.board.state);
    if (res && this.gameOptions.spinBonuses !== "stupid") this.lastSpin = null;
    return res;
  }

  dasLeft() {
    const res = this.falling.dasLeft(this.board.state);
    if (res && this.gameOptions.spinBonuses !== "stupid") this.lastSpin = null;
    return res;
  }

  softDrop() {
    const res = this.falling.softDrop(this.board.state);
    if (res && this.gameOptions.spinBonuses !== "stupid") this.lastSpin = null;
    return res;
  }

  maxSpin(...spins: SpinType[]) {
    const score = (spin: SpinType) => ["none", "mini", "normal"].indexOf(spin);
    return spins.reduce((a, b) => {
      return score(a) > score(b) ? a : b;
    });
  }

  detectSpin(finOrTst: boolean): SpinType {
    if (this.gameOptions.spinBonuses === "none") return "none";
    const tSpin =
      (
        [
          "all",
          "all-mini",
          "all-mini+",
          "all+",
          "T-spins"
        ] as Game.SpinBonuses[]
      ).includes(this.gameOptions.spinBonuses) && this.falling.symbol === "t"
        ? this.detectTSpin(finOrTst)
        : false;
    const allSpin = this.falling.isAllSpinPosition(this.board.state);

    switch (this.gameOptions.spinBonuses) {
      case "stupid":
        return this.falling.isStupidSpinPosition(this.board.state)
          ? "normal"
          : "none";
      case "T-spins":
        return tSpin || "none";
      case "all":
        return tSpin || (allSpin ? "normal" : "none");
      case "all-mini":
        return tSpin || (allSpin ? "mini" : "none");
      case "all+":
        return this.maxSpin(tSpin || "none", allSpin ? "normal" : "none");
      case "all-mini+":
        return this.maxSpin(tSpin || "none", allSpin ? "mini" : "none");
      case "mini-only":
        return tSpin === "normal"
          ? "mini"
          : this.maxSpin(tSpin || "none", allSpin ? "mini" : "none");
      case "handheld":
        // TODO: How does this work?
        return "none";
    }
  }

  detectTSpin(finOrTst: boolean): SpinType {
    if (this.falling.symbol !== "t") return "none";

    if (finOrTst) return "normal";

    const corners = this.getTCorners();

    if (corners.filter((item) => item).length < 3) return "none";

    const facingCorners: [boolean, boolean] = [
      corners[this.falling.rotation],
      corners[(this.falling.rotation + 1) % 4]
    ];

    if (facingCorners[0] && facingCorners[1]) {
      return "normal";
    }

    return "mini";
  }

  /**
   * Returns array of true/false corners in this form (numbers represent array indices):
   * @example
   *  0    1
   *  🟦🟦🟦
   *  3 🟦 2
   */
  getTCorners() {
    const [x, y] = [this.falling.location[0] + 1, this.falling.y - 1];
    const getLocation = (x: number, y: number) =>
      x < 0
        ? true
        : x >= this.board.width
          ? true
          : y < 0
            ? true
            : y >= this.board.fullHeight
              ? true
              : this.board.state[y][x] !== null;

    return [
      getLocation(x - 1, y + 1),
      getLocation(x + 1, y + 1),
      getLocation(x + 1, y - 1),
      getLocation(x - 1, y - 1)
    ];
  }

  hardDrop() {
    this.softDrop();

    return this.lock();
  }

  fall(value: number | null = null, subFrameDiff = 1) {
    if (this.falling.safeLock > 0) this.falling.safeLock--;
    if (this.falling.sleep || this.falling.deepSleep) return;

    let subFrameGravity = this.dynamic.gravity.get() * subFrameDiff;

    // ASSUME SOFTDROP, LATEST VERSION
    if (this.input.softDrop) {
      if (this.handling.sdf === 41) subFrameGravity = 400 * subFrameDiff;
      else
        subFrameGravity = Math.max(
          subFrameGravity * this.handling.sdf,
          0.05 * this.handling.sdf
        );
    }

    if (value !== null) subFrameGravity = Math.floor(value);

    if (
      !this.misc.movement.infinite &&
      this.falling.lockResets >= this.misc.movement.lockResets &&
      !legal(
        this.falling.absoluteBlocks.map((block) => [block[0], block[1] - 1]),
        this.board.state
      )
    ) {
      subFrameGravity = 20;
      this.falling.forceLock = true;
    }

    if (
      !this.misc.movement.infinite &&
      this.falling.fallingRotations > this.misc.movement.lockResets + 15
    ) {
      subFrameGravity +=
        0.5 *
        subFrameDiff *
        (this.falling.fallingRotations - (this.misc.movement.lockResets + 15));
    }

    while (subFrameGravity > 0) {
      const y = this.falling.y;
      if (!this.fallInner(Math.min(1, subFrameGravity))) {
        if (value !== null) this.falling.forceLock = true;
        this.locking(value != null, subFrameDiff);
        break;
      }

      subFrameGravity -= Math.min(1, subFrameGravity);
      if (y !== this.falling.y) {
        this.falling.last = Falling.LastKind.Fall;
        // something about score goes here, irrelevant
      }
    }
  }

  private fallInner(v1: number): boolean {
    const TERA10 = Math.pow(10, 13);

    let y1 = Math.ceil(TERA10 * this.falling.location[1]) / TERA10 - v1;

    if (y1 % 1 === 0) y1 -= 0.00001;

    let y2 = Math.ceil(TERA10 * this.falling.location[1]) / TERA10 - 1;

    if (y2 % 1 === 0) y2 += 0.00002;

    if (
      legal(this.falling.absoluteAt({ y: y1 }), this.board.state) &&
      legal(this.falling.absoluteAt({ y: y2 }), this.board.state)
    ) {
      const highestY = this.falling.highestY;

      y2 = this.falling.location[1];

      this.falling.location[1] = y1;

      this.falling.highestY = Math.floor(Math.min(this.falling.highestY, y1));
      this.falling.floored = false;
      if (Math.floor(y1) !== Math.floor(y2)) {
        // nothing goes here??? idk
      }

      if (y1 < highestY || this.misc.movement.infinite) {
        this.falling.lockResets = 0;
        this.falling.fallingRotations = 0;
      }

      return true;
    }

    return false;
  }

  private locking(value = false, subframe = 1) {
    this.falling.locking += subframe;
    this.falling.floored = true;

    if (
      this.falling.locking > this.misc.movement.lockTime ||
      this.falling.forceLock ||
      (this.falling.lockResets > this.misc.movement.lockResets &&
        !this.misc.movement.infinite)
    )
      this.lock(value);
  }

  lock(emptyDrop = false) {
    this.falling.sleep = true;
    this.holdLocked = false;

    if (!emptyDrop && this.handling.safelock) {
      this.falling.safeLock = 7;
    }

    // TODO: ARE (line clear, garbage)

    this.board.add(
      ...(this.falling.blocks.map((block) => [
        this.falling.symbol,
        this.falling.location[0] + block[0],
        this.falling.y - block[1]
      ]) as any)
    );

    const { lines, garbageCleared } = this.board.clearLines();
    const pc = this.board.perfectClear;

    let brokeB2B: false | number = this.stats.b2b;
    if (lines > 0) {
      this.stats.combo++;
      if ((this.lastSpin && this.lastSpin.type !== "none") || lines >= 4) {
        this.stats.b2b++;
        brokeB2B = false;
      }
      if (pc && this.pc && this.pc.b2b) {
        this.stats.b2b += this.pc.b2b;
        brokeB2B = false;
      }

      if (brokeB2B !== false) {
        this.stats.b2b = -1;
      }
    } else {
      this.stats.combo = -1;
      brokeB2B = false;
    }

    const gSpecialBonus =
      this.initializer.garbage.specialBonus &&
      garbageCleared &&
      ((this.lastSpin && this.lastSpin.type !== "none") || lines >= 4)
        ? 1
        : 0;

    const garbage = garbageCalcV2(
      {
        b2b: Math.max(this.stats.b2b, 0),
        combo: Math.max(this.stats.combo, 0),
        enemies: 0,
        lines,
        piece: this.falling.symbol,
        spin: this.lastSpin ? this.lastSpin.type : "none"
      },
      {
        ...this.gameOptions,
        b2b: { chaining: this.b2b.chaining, charging: !!this.b2b.charging }
      }
    );

    const gEvents =
      garbage.garbage > 0 || gSpecialBonus > 0
        ? [
            this.garbageQueue.round(
              garbage.garbage * this.dynamic.garbageMultiplier.get() +
                gSpecialBonus
            )
          ]
        : [];

    if (brokeB2B !== false) {
      let btb = brokeB2B;
      if (this.b2b.charging !== false && btb > this.b2b.charging.at) {
        const value = Math.floor(
          (btb - this.b2b.charging.at + this.b2b.charging.base) *
            this.dynamic.garbageMultiplier.get()
        );
        const garbages = [
          Math.round(value / 3),
          Math.round(value / 3),
          value - 2 * Math.round(value / 3)
        ];
        gEvents.splice(0, 0, ...garbages);
        brokeB2B = false;
      }
    }
    if (pc && this.pc) {
      gEvents.push(
        this.garbageQueue.round(
          this.pc.garbage * this.dynamic.garbageMultiplier.get()
        )
      );
    }

    const res = {
      lines,
      spin: this.lastSpin ? this.lastSpin.type : "none",
      garbage: gEvents.filter((g) => g > 0),
      dump: {
        garbage: garbage.garbage,
        lines,
        ...this.stats,
        spin: this.lastSpin ? this.lastSpin.type : "none",
        rawGarbage: [...gEvents]
      },
      garbageAdded: false as false | OutgoingGarbage[],
      topout: false
    };

    if (lines > 0) {
      while (res.garbage.length > 0) {
        if (res.garbage[0] === 0) {
          res.garbage.shift();
          continue;
        }
        const r = this.garbageQueue.cancel(res.garbage[0], this.stats.pieces);
        if (r === 0) res.garbage.shift();
        else {
          res.garbage[0] = r;
          break;
        }
      }
    } else {
      const garbages = this.garbageQueue.tank(
        this.frame,
        this.dynamic.garbageCap.get()
      );
      res.garbageAdded = garbages;
      if (res.garbageAdded) {
        garbages.forEach((garbage) => {
          this.board.insertGarbage(garbage);
          if (this.onGarbageSpawn) {
            this.onGarbageSpawn(garbage.column, garbage.size);
          }
        });
      }
    }

    this.nextPiece(lines > 0);

    this.lastSpin = null;

    try {
      if (!legal(this.falling.absoluteBlocks, this.board.state))
        res.topout = true;
    } catch {
      res.topout = true;
    }

    if (res.garbage.length > 0)
      if (this.multiplayer)
        this.multiplayer.targets.forEach((target) =>
          res.garbage.forEach((g) =>
            this.igeHandler.send({ amount: g, playerID: target })
          )
        );

    this.resCache.garbage.sent.push(...res.garbage);
    this.resCache.garbage.received.push(...(res.garbageAdded || []));

    this.stats.pieces++;

    return res;
  }

  press<T extends Game.Key>(key: T) {
    if (key in this) return this[key]() as ReturnType<(typeof this)[T]>;
    else throw new Error("invalid key: " + key);
  }

  keydown(event: Game.Replay.Frames.Keypress) {
    this.input.keys[event.data.key] = true;

    if (event.data.subframe > this.subframe) {
      this.processShift(false, event.data.subframe - this.subframe);
      this.fall(null, event.data.subframe - this.subframe);
      this.subframe = event.data.subframe;
    }

    if (event.data.key === "moveLeft") {
      this.input.lShift = true;
      this.input.lastShift = -1;
      this.input.lDas = event.hoisted
        ? this.handling.das - this.handling.dcd
        : 0;
      this.input.lDasIter = this.handling.arr;

      this.processLShift(true, 0);
      return;
    }

    if (event.data.key === "moveRight") {
      this.input.rShift = true;
      this.input.lastShift = 1;
      this.input.rDas = event.hoisted
        ? this.handling.das - this.handling.dcd
        : 0;
      this.input.rDasIter = this.handling.arr;

      this.processRShift(true, 0);
      return;
    }

    if (event.data.key === "softDrop") {
      this.input.softDrop = true;
      return;
    }

    if (!this.falling.deepSleep) {
      if (this.falling.sleep) {
        if (event.data.key === "rotateCCW") {
          const irs = this.falling.irs - 1;
          this.falling.irs = irs < 0 ? 3 : irs;
        } else if (event.data.key === "rotateCW") {
          this.falling.irs = (this.falling.irs + 1) % 4;
        } else if (event.data.key === "rotate180") {
          this.falling.irs = (this.falling.irs + 2) % 4;
        } else if (event.data.key === "hold") {
          this.falling.ihs = true;
        }
      } else {
        if (event.data.key === "rotateCCW") return this.rotateCCW();
        else if (event.data.key === "rotateCW") return this.rotateCW();
        else if (event.data.key === "rotate180" && this.misc.allowed.spin180)
          return this.rotate180();
        else if (
          event.data.key === "hardDrop" &&
          this.misc.allowed.hardDrop &&
          this.falling.safeLock === 0
        )
          return this.hardDrop();
        else if (event.data.key === "hold" && this.misc.allowed.hold)
          return this.hold();
      }
    }
  }

  keyup(event: Game.Replay.Frames.Keypress) {
    this.input.keys[event.data.key] = false;

    if (event.data.subframe > this.subframe) {
      this.processShift(false, event.data.subframe - this.subframe);
      this.fall(null, event.data.subframe - this.subframe);
      this.subframe = event.data.subframe;
    }

    if (event.data.key === "moveLeft") {
      this.input.lShift = false;
      this.input.lDas = 0;

      if (this.handling.cancel) {
        this.input.rDas = 0;
        this.input.rDasIter = this.handling.arr;
      }

      return;
    }

    if (event.data.key === "moveRight") {
      this.input.rShift = false;
      this.input.rDas = 0;

      if (this.handling.cancel) {
        this.input.lDas = 0;
        this.input.lDasIter = this.handling.arr;
      }

      return;
    }

    if (event.data.key === "softDrop") {
      this.input.softDrop = false;
    }
  }

  private processLShift(value: boolean, subFrameDiff = 1) {
    if (
      !this.input.lShift ||
      (this.input.rShift && this.input.lastShift !== -1)
    )
      return;

    let subFrameDiffForDas = subFrameDiff;
    const dasDiff = Math.max(0, this.handling.das - this.input.lDas);

    this.input.lDas += value ? 0 : subFrameDiff;
    if (this.input.lDas < this.handling.das && !value) return;

    subFrameDiffForDas = Math.max(0, subFrameDiffForDas - dasDiff);
    if (this.falling.sleep || this.falling.deepSleep) return;

    let moveLoopCount = 1;
    if (!value) {
      this.input.lDasIter += subFrameDiffForDas;
      if (this.input.lDasIter < this.handling.arr) return;

      moveLoopCount =
        this.handling.arr === 0
          ? 10
          : Math.floor(this.input.lDasIter / this.handling.arr);

      this.input.lDasIter -= this.handling.arr * moveLoopCount;
    }

    for (let i = 0; i < moveLoopCount; i++) {
      // Try moving left
      const moved = this.falling.moveLeft(this.board.state);
      if (moved) {
        this.falling.last = Falling.LastKind.Move;
        this.falling.clamped = false;
        if (this.is20G()) this.slam();
        if (++this.falling.lockResets < 15 || this.misc.movement.infinite) {
          this.falling.locking = 0;
        }
      } else {
        this.falling.clamped = true;
      }
    }
  }

  private processRShift(value: boolean, subFrameDiff = 1) {
    if (!this.input.rShift || (this.input.lShift && this.input.lastShift !== 1))
      return;

    let subFrameDiffForDas = subFrameDiff;
    const dasDiff = Math.max(0, this.handling.das - this.input.rDas);

    this.input.rDas += value ? 0 : subFrameDiff;
    if (this.input.rDas < this.handling.das && !value) return;

    subFrameDiffForDas = Math.max(0, subFrameDiffForDas - dasDiff);
    if (this.falling.sleep || this.falling.deepSleep) return;

    let moveLoopCount = 1;
    if (!value) {
      this.input.rDasIter += subFrameDiffForDas;
      if (this.input.rDasIter < this.handling.arr) return;

      moveLoopCount =
        this.handling.arr === 0
          ? 10
          : Math.floor(this.input.rDasIter / this.handling.arr);

      this.input.rDasIter -= this.handling.arr * moveLoopCount;
    }

    for (let i = 0; i < moveLoopCount; i++) {
      // Try moving right
      const moved = this.falling.moveRight(this.board.state);
      if (moved) {
        this.falling.last = Falling.LastKind.Move;
        this.falling.clamped = false;
        if (this.is20G()) this.slam();
        if (++this.falling.lockResets < 15 || this.misc.movement.infinite) {
          this.falling.locking = 0;
        }
      } else {
        this.falling.clamped = true;
      }
    }
  }

  private processShift(value: boolean, subFrameDiff = 1) {
    this.processLShift(value, subFrameDiff);
    this.processRShift(value, subFrameDiff);
  }

  run(...frames: Game.Replay.Frame[]) {
    frames.forEach((frame) => {
      switch (frame.type) {
        case "keydown":
          this.keydown(frame);
          break;
        case "keyup":
          this.keyup(frame);
          break;
        case "ige":
          if (frame.data.type === "interaction") {
            if (frame.data.data.type === "garbage") {
              this.receiveGarbage({
                frame:
                  Number.MAX_SAFE_INTEGER -
                  this.garbageQueue.options.garbage.speed,
                amount: this.multiplayer?.passthrough?.network
                  ? this.igeHandler.receive({
                      playerID: frame.data.data.gameid,
                      ackiid: frame.data.data.ackiid,
                      amount: frame.data.data.amt,
                      iid: frame.data.data.iid
                    })
                  : frame.data.data.amt,
                size: frame.data.data.size,
                cid: frame.data.data.iid,
                gameid: frame.data.data.gameid,
                confirmed: false
              });
            }
          } else if (frame.data.type === "interaction_confirm") {
            if (frame.data.data.type === "garbage") {
              console.log("CONFIRM", frame.data.data, frame.frame);
              this.garbageQueue.confirm(
                frame.data.data.iid,
                frame.data.data.gameid,
                frame.frame
              );
            }
          } else if (frame.data.type === "target" && this.multiplayer) {
            this.multiplayer.targets = frame.data.data.targets;
          }
          break;
      }
    });
  }

  tick(frames: Game.Replay.Frame[]) {
    this.subframe = 0;

    this.run(...frames);

    this.frame++;
    this.processShift(false, 1 - this.subframe);
    this.fall(null, 1 - this.subframe);
    // TODO: EXECUTE WAITING FRAMES
    Object.keys(this.dynamic).forEach((key) =>
      this.dynamic[key as keyof typeof this.dynamic].tick()
    );

    return { ...this.flushRes() };
  }

  receiveGarbage(...garbage: IncomingGarbage[]) {
    this.garbageQueue.receive(...garbage);
  }

  hold() {
    if (this.holdLocked) return;
    if (this.held) {
      const save = this.held;
      this.held = this.falling.symbol;
      this.initiatePiece(save);
    } else {
      this.held = this.falling.symbol;
      this.nextPiece();
    }

    this.holdLocked = !this.misc.infiniteHold;
  }

  getPreview(piece: Mino) {
    return tetrominoes[piece.toLowerCase()].preview;
  }

  onQueuePieces(
    listener: NonNullable<(typeof Queue)["prototype"]["repopulateListener"]>
  ) {
    this.queue.onRepopulate(listener);
  }

  spawnGarbage(column: number, size: number) {
    if (this.onGarbageSpawn) {
      this.onGarbageSpawn(column, size);
    }
  }

  private static colorMap = {
    i: chalk.bgCyan,
    j: chalk.bgBlue,
    l: chalk.bgYellow,
    o: chalk.bgWhite,
    s: chalk.bgGreenBright,
    t: chalk.bgMagentaBright,
    z: chalk.bgRedBright,
    gb: chalk.bgBlack
  };

  get text() {
    const boardTop = this.board.state.findIndex((row: (string | null)[]) =>
      row.every((block) => block === null)
    );
    const height = Math.max(this.garbageQueue.size, boardTop, 0);

    const output: string[] = [];
    for (let i = 0; i < height; i++) {
      let str = i % 2 === 0 ? "|" : " ";
      if (i < this.garbageQueue.size) str += " " + chalk.bgRed(" ") + " ";
      else str += "   ";
      if (i > boardTop) {
        output.push(
          str + "  ".repeat(this.board.width) + " " + (i % 2 === 0 ? "|" : " ")
        );
        continue;
      }

      for (let j = 0; j < this.board.width; j++) {
        const block = this.board.state[i][j];
        str += block ? Engine.colorMap[block]("  ") : "  ";
      }

      output.push(str + " " + (i % 2 === 0 ? "|" : " "));
    }

    return output.reverse().join("\n");
  }
}

export * from "./queue";
export * from "./garbage";
export * from "./utils";
export * from "./board";
export * from "./types";
