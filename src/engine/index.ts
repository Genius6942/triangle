import { Game } from "../types";
import { Board, BoardInitializeParams } from "./board";
import { constants } from "./constants";
import { GarbageQueue, GarbageQueueInitializeParams, IncomingGarbage, OutgoingGarbage } from "./garbage";
import { IGEHandler, MultiplayerOptions } from "./multiplayer";
import { Queue, QueueInitializeParams } from "./queue";
import { Mino } from "./queue/types";
import { EngineSnapshot, IncreasableValue } from "./types";
import { SpinType } from "./types";
import { IncreaseTracker, deepCopy } from "./utils";
import { garbageCalcV2, garbageData } from "./utils/damageCalc";
import { KickTable, legal, performKick } from "./utils/kicks";
import { KickTableName, kicks } from "./utils/kicks/data";
import { Tetromino, tetrominoes } from "./utils/tetromino";
import { Rotation } from "./utils/tetromino/types";



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

  initializer: EngineInitializeParams;

  handling!: Game.Handling;

  input!: {
    lShift: { held: boolean; arr: number; das: number; dir: -1 };
    rShift: { held: boolean; arr: number; das: number; dir: 1 };
    lastShift: number;
    keys: {
      [k in
        | "softDrop"
        | "rotateCCW"
        | "rotateCW"
        | "rotate180"
        | "hold"]: boolean;
    };
    firstInputTime: number;
    time: {
      start: number;
      zero: boolean;
      locked: boolean;
      prev: number;
      frameoffset: number;
    };
    lastPieceTime: number;
  };

  pc!: PCOptions;
  b2b!: B2BOptions;

  dynamic!: {
    gravity: IncreaseTracker;
    garbageMultiplier: IncreaseTracker;
    garbageCap: IncreaseTracker;
  };

  glock!: number;

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

  state!: number;

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

    this.glock = 0;

    this.misc = options.misc;

    this.gameOptions = options.options;
    this.handling = options.handling;
    this.input = {
      lShift: { held: false, arr: 0, das: 0, dir: -1 },
      rShift: { held: false, arr: 0, das: 0, dir: 1 },
      lastShift: -1,
      firstInputTime: -1,
      time: { start: 0, zero: true, locked: false, prev: 0, frameoffset: 0 },
      lastPieceTime: 0,
      keys: {
        softDrop: false,
        hold: false,
        rotateCW: false,
        rotateCCW: false,
        rotate180: false
      }
    };
    this.frame = 0;
    this.subframe = 0;

    this.state = 0;

    this.flushRes();

    this.nextPiece();

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
    this.snapshot = this.snapshot.bind(this);
    this.fromSnapshot = this.fromSnapshot.bind(this);
    this.nextPiece = this.nextPiece.bind(this);
  }

  snapshot(): EngineSnapshot {
    return {
      board: deepCopy(this.board.state),
      falling: {
        aox: this.falling.aox,
        aoy: this.falling.aoy,
        fallingRotations: this.falling.fallingRotations,
        highestY: this.falling.highestY,
        ihs: this.falling.ihs,
        irs: this.falling.irs,
        keys: this.falling.keys,
        rotation: this.falling.rotation,
        location: this.falling.location,
        locking: this.falling.lockResets,
        lockResets: this.falling.lockResets,
        rotResets: this.falling.rotResets,
        safeLock: this.falling.safeLock,
        symbol: this.falling.symbol,
        totalRotations: this.falling.totalRotations
      },
      frame: this.frame,
      garbage: {
        queue: deepCopy(this.garbageQueue.queue),
        seed: this.garbageQueue.currentSeed,
        sent: this.garbageQueue.sent
      },
      hold: this.held,
      holdLocked: this.holdLocked,
      lastSpin: deepCopy(this.lastSpin),
      queue: this.queue.index,
      shift: {
        l: deepCopy(this.input.lShift),
        r: deepCopy(this.input.rShift)
      },
      subframe: this.subframe
    };
  }

	fromSnapshot(snapshot: EngineSnapshot) {
    this.board.state = deepCopy(snapshot.board);
    this.initiatePiece(snapshot.falling.symbol);
    for (const key of Object.keys(snapshot.falling)) {
      // @ts-expect-error
      this.falling[key] = snapshot.falling[key];
    }
    this.falling.location[0] = snapshot.falling.location[0];
    this.falling.location[1] = snapshot.falling.location[1];
    this.frame = snapshot.frame;
    this.subframe = snapshot.subframe;
    this.garbageQueue.queue = deepCopy(snapshot.garbage.queue);
    this.held = snapshot.hold;
    this.holdLocked = snapshot.holdLocked;
    this.lastSpin = deepCopy(snapshot.lastSpin);
    this.queue = new Queue(this.initializer.queue);
    for (let i = 0; i < snapshot.queue; i++) this.queue.shift();

    this.dynamic = {
      gravity: new IncreaseTracker(
        this.initializer.gravity.value,
        this.initializer.gravity.increase,
        this.initializer.gravity.marginTime
      ),
      garbageMultiplier: new IncreaseTracker(
        this.initializer.garbage.multiplier.value,
        this.initializer.garbage.multiplier.increase,
        this.initializer.garbage.multiplier.marginTime
      ),
      garbageCap: new IncreaseTracker(
        this.initializer.garbage.cap.value,
        this.initializer.garbage.cap.increase,
        this.initializer.garbage.cap.marginTime
      )
    };

		for (let i = 0; i < this.frame; i++)
			for (const key of Object.keys(this.dynamic))
				this.dynamic[key as keyof typeof this.dynamic].tick();
		
		this.input.lShift = deepCopy(snapshot.shift.l);
		this.input.rShift = deepCopy(snapshot.shift.r);
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

  #getEffectiveGravity() {
    return this.glock <= 0
      ? this.dynamic.gravity.get()
      : this.glock <= 180
        ? (1 - this.glock / 180) ** 2 * this.dynamic.gravity.get()
        : 0;
  }

  #hasHitWall() {
    return !!(this.state & constants.flags.STATE_WALL);
  }

  // @ts-expect-error unused
  #hasRotated() {
    return !!(
      this.state &
      (constants.flags.ROTATION_LEFT | constants.flags.ROTATION_RIGHT)
    );
  }

  // @ts-expect-error unused
  #hasRotated180() {
    return !!(this.state & constants.flags.ROTATION_180);
  }

  // @ts-expect-error unused
  #isSpin() {
    return !!(this.state & constants.flags.ROTATION_SPIN);
  }

  // @ts-expect-error unused
  #isSpinMini() {
    return !(
      ~this.state &
      (constants.flags.ROTATION_SPIN | constants.flags.ROTATION_MINI)
    );
  }

  // @ts-expect-error unused
  #isSpinAll() {
    return !!(this.state & constants.flags.ROTATION_SPIN_ALL);
  }

  #isSleep() {
    return !!(this.state & constants.flags.STATE_SLEEP);
  }

  // @ts-expect-error unused
  #isFloored() {
    return !!(this.state & constants.flags.STATE_FLOOR);
  }

  // @ts-expect-error unused
  #isVisible() {
    return !(this.state & constants.flags.STATE_NODRAW);
  }

  // @ts-expect-error unused
  #isSoftDropped() {
    return !!(this.state & constants.flags.ACTION_SOFTDROP);
  }

  #isForcedToLock() {
    return !!(this.state & constants.flags.ACTION_FORCELOCK);
  }

  #is20G() {
    const is20G = this.dynamic.gravity.get() > this.board.height;
    const mode20G = this.misc.movement.may20G;

    if (this.input.keys.softDrop) {
      const preferSoftDrop = this.handling.may20g || (is20G && mode20G);
      return (
        (this.handling.sdf === 41 ||
          this.dynamic.gravity.get() * this.handling.sdf > this.board.height) &&
        preferSoftDrop
      );
    }

    return is20G && mode20G;
  }

  #shouldLock() {
    return (
      !this.misc.movement.infinite &&
      this.falling.lockResets >= this.misc.movement.lockResets
    );
  }

  #shouldFallFaster() {
    return this.misc.movement.infinite
      ? false
      : this.falling.rotResets > this.misc.movement.lockResets + 15;
  }

  #clearFlags(e: number) {
    this.state &= e;
  }

  #__internal_lock(subframe = 1 - this.subframe) {
    this.falling.locking += subframe;

    return (
      this.falling.locking > this.misc.movement.lockTime ||
      this.#isForcedToLock() ||
      (this.falling.lockResets > this.misc.movement.lockResets &&
        !this.misc.movement.infinite) ||
      this.#shouldLock()
    );
  }

  #__internal_fall(value: number) {
    let y1 = Math.round(1e6 * (this.falling.location[1] - value)) / 1e6,
      y2 = this.falling.location[1] - 1;

    if (y1 % 1 === 0) y1 -= 1e-6;
    if (y2 % 1 === 0) y2 += 2e-6;

    if (
      !legal(this.falling.absoluteAt({ y: y1 }), this.board.state) ||
      !legal(this.falling.absoluteAt({ y: y2 }), this.board.state)
    )
      return false;

    const { highestY } = this.falling;
    if (highestY > y1) this.falling.highestY = Math.floor(y1);
    this.falling.location[1] = y1;
    this.state &= ~constants.flags.STATE_FLOOR;

    if (y1 > highestY || this.misc.movement.infinite) {
      this.falling.lockResets = 0;
      this.falling.rotResets = 0;
    }

    return true;
  }

  // @ts-expect-error unused
  #__internal_lockout() {
    // TODO: implement
    // if (this.options.nolockout) return;
    // if (!e || false === this.options.clutch)
    //   return this.self.stm.LoseStockOrGameOver(
    //     this.options.topoutisclear ? "topout_clear" : "topout",
    //   );
  }

  #__internal_dcd() {
    if (!this.#hasHitWall() || !this.handling.dcd) return;

    this.input.lShift.das = Math.min(
      this.input.lShift.das,
      this.handling.das - this.handling.dcd
    );
    this.input.lShift.arr = this.handling.arr;

    this.input.rShift.das = Math.min(
      this.input.rShift.das,
      this.handling.das - this.handling.dcd
    );
    this.input.rShift.arr = this.handling.arr;
  }

  #fall(subframe = 1 - this.subframe) {
    if (this.falling.safeLock > 0) this.falling.safeLock--;
    // TODO: if pause, return: if ((this.piece.safelock > 0 && this.piece.safelock--, this.S.pause)) return;

    if (this.#isSleep()) return;

    let fall = this.#getEffectiveGravity() * subframe;

    if (this.glock > 0) this.glock -= subframe;
    if (this.glock < 0) this.glock = 0;

    if (this.input.keys.softDrop) {
      if (this.handling.sdf === 41) fall = 400 * subframe;
      else {
        fall *= this.handling.sdf;

        fall = Math.max(fall, 0.05 * this.handling.sdf);
      }
    }

    if (
      this.#shouldLock() &&
      !legal(
        this.falling.absoluteAt({ y: this.falling.location[1] - 1 }),
        this.board.state
      )
    ) {
      fall = 20;
      this.state |= constants.flags.ACTION_FORCELOCK;
    }

    if (this.#shouldFallFaster()) {
      fall +=
        0.5 *
        subframe *
        (this.falling.rotResets - (this.misc.movement.lockResets + 15));
    }

    for (
      let dropFactor = fall;
      dropFactor > 0;
      dropFactor -= Math.min(1, dropFactor)
    ) {
      const y = this.falling.location[1];

      if (!this.#__internal_fall(Math.min(1, dropFactor))) {
        if (this.#__internal_lock(subframe)) {
          if (this.handling.safelock) this.falling.safeLock = 7;
          this.#lock();
        }
        break;
      }

      if (Math.floor(y) !== Math.floor(this.falling.location[1])) {
        this.state &= ~constants.flags.ROTATION_ALL;
      }
    }
  }

  #clampRotation(amount: number): Rotation {
    return ((((this.falling.rotation + amount) % 4) + 4) % 4) as Rotation;
  }

  #__internal_rotate(
    newX: number,
    newY: number,
    newRotation: number,
    rotationDirection: number,
    kick: ReturnType<typeof performKick>,
    _isIRS = false
  ) {
    // Handle rotation flags based on direction
    if (rotationDirection >= 2) {
      // 180 degree rotation
      rotationDirection = newRotation > this.falling.rotation ? 1 : -1;
      this.state |= constants.flags.ROTATION_180;
    }

    // Update this.falling properties
    this.falling.x = newX;
    this.falling.y = newY;
    this.falling.rotation = newRotation;

    // Set rotation direction flags
    this.state |=
      rotationDirection === 1
        ? constants.flags.ROTATION_RIGHT
        : constants.flags.ROTATION_LEFT;
    this.state &= ~(
      constants.flags.ROTATION_SPIN |
      constants.flags.ROTATION_MINI |
      constants.flags.ROTATION_SPIN_ALL
    );

    // Update lock and rotation resets with caps
    if (this.falling.lockResets < 31) this.falling.lockResets++;
    if (this.falling.rotResets < 63) this.falling.rotResets++;

    // Check for T-Spin
    const spin = this.detectSpin(this.isTSpinKick(kick));

    this.lastSpin = {
      piece: this.falling.symbol,
      type: spin
    };

    if (spin) {
      this.state |= constants.flags.ROTATION_SPIN;
      if (spin === "mini") {
        this.state |= constants.flags.ROTATION_MINI;
      }
    }

    this.falling.totalRotations++;

    // Handle post-rotation actions
    this.#__internal_dcd();

    // Reset locking if not going to lock
    if (!this.#shouldLock()) {
      this.falling.locking = 0;
    }
  }

  #kick(to: Rotation): false | Exclude<ReturnType<typeof performKick>, true> {
    const kick = performKick(
      this.kickTableName,
      this.falling.symbol,
      this.falling.location,
      [this.falling.aox, this.falling.aoy],
      !this.misc.movement.infinite &&
        this.falling.totalRotations > this.misc.movement.lockResets + 15,
      this.falling.states[to],
      this.falling.rotation,
      to,
      this.board.state
    );

    if (typeof kick === "object") return kick;
    else
      return kick === false
        ? false
        : {
            kick: [0, 0],
            newLocation: [this.falling.location[0], this.falling.location[1]],
            id: "00",
            index: 0
          };
  }

  #rotate(amount: number, isIRS = false) {
    if (this.#isSleep()) {
      if (this.handling.irs === "tap")
        this.falling.irs = (((this.falling.irs + amount) % 4) + 4) % 4;
      return;
    }

    const to = this.#clampRotation(amount);

    this.state |= constants.flags.ACTION_MOVE;
    this.state |= constants.flags.ACTION_ROTATE;
    const kick = this.#kick(to);

    return kick
      ? this.#__internal_rotate(
          kick.newLocation[0],
          kick.newLocation[1],
          to,
          amount,
          kick,
          isIRS
        )
      : undefined;
  }

  nextPiece(canClutch = false, ignoreBlockout = false) {
    const newTetromino = this.queue.shift()!;

    this.initiatePiece(newTetromino, canClutch, ignoreBlockout);
  }

  initiatePiece(
    piece: Mino,
    canClutch: boolean = false,
    ignoreBlockout = false,
    isHold = false
  ) {
    if (this.handling.ihs === "hold") {
      let rotationState = 0;

      // Calculate rotation based on input
      if (this.input.keys.rotateCCW) rotationState -= 1;
      if (this.input.keys.rotateCW) rotationState += 1;
      if (this.input.keys.rotate180) rotationState += 2;

      // Ensure rotation state is in 0-3 range
      this.falling.irs = ((rotationState % 4) + 4) % 4;
    }

    if (this.handling.ihs === "hold" && this.input.keys.hold && !isHold) {
      this.state |= constants.flags.ACTION_IHS;
    }

    this.#__internal_dcd();

    this.state &= ~(
      constants.flags.ROTATION_ALL |
      constants.flags.STATE_ALL |
      constants.flags.ACTION_FORCELOCK |
      constants.flags.ACTION_SOFTDROP |
      constants.flags.ACTION_MOVE |
      constants.flags.ACTION_ROTATE
    );

    this.input.firstInputTime = -1;

    if (!isHold) this.holdLocked = false;

    this.falling = new Tetromino({
      boardHeight: this.board.height,
      boardWidth: this.board.width,
      initialRotation:
        piece.toLowerCase() in this.kickTable.spawn_rotation
          ? this.kickTable.spawn_rotation[
              piece.toLowerCase() as keyof typeof this.kickTable.spawn_rotation
            ]
          : 0,
      symbol: piece,
      from: this.falling
    });

    if (!ignoreBlockout && this.#considerBlockout(canClutch, isHold)) {
      // Lose Stock or Game Over
      this.state ^= constants.flags.ACTION_IHS;
      this.falling.irs = 0;
    } else {
      if (this.state & constants.flags.ACTION_IHS) {
        this.state ^= constants.flags.ACTION_IHS;
        this.hold(true, ignoreBlockout);
      } else {
        if (this.falling.irs !== 0) {
          this.#rotate(this.falling.irs, true);
          this.falling.irs = 0;
        }

        if (this.#considerBlockout(canClutch, !ignoreBlockout || isHold)) {
          // lose stock or game over
        } else {
          if (this.#is20G()) {
            this.#slamToFloor();
          }
        }
      }
    }
  }

  #considerBlockout(canClutch: boolean, isSilent: boolean = false) {
    if (legal(this.falling.absoluteBlocks, this.board.state)) {
      // TODO: clutch count
      // if (!isSilent) {
      //   this.S.clutchCount = 0;
      // }
      return false;
    }

    let clutched = false;

    if (canClutch && this.gameOptions.clutch !== false) {
      const originalY = this.falling.location[1];
      const originalHy = this.falling.highestY;

      while (this.falling.y < this.board.fullHeight) {
        this.falling.location[1]++;
        this.falling.highestY++;

        if (legal(this.falling.absoluteBlocks, this.board.state)) {
          clutched = true;
          break;
        }
      }

      if (!clutched) {
        this.falling.location[1] = originalY;
        this.falling.highestY = originalHy;
      }
    }

    if (!clutched) return true;

    if (!isSilent) {
      // TODO: update clutch count +1
    }

    return false;
  }

  #slamToFloor() {
    while (this.#__internal_fall(1)) {}
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

  rotateCW() {
    return this.#processRotate(1);
  }

  rotateCCW() {
    return this.#processRotate(-1);
  }

  rotate180() {
    return this.#processRotate(2);
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
    while (this.#__internal_fall(1));

    return this.#lock();
  }

  #lock(emptyDrop = false) {
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

  #keydown({ data: event }: Game.Replay.Frames.Keypress) {
    this.#processSubframe(event.subframe);
    // TODO: inversion?
    // if (this.misc.inverted)
    //   switch (e.key) {
    //     case "moveLeft":
    //       e.key = "moveRight";
    //       break;
    //     case "moveRight":
    //       e.key = "moveLeft";
    //   }

    switch (event.key) {
      case "moveLeft":
        this.falling.keys++;
        if (this.input.firstInputTime == -1)
          this.input.firstInputTime = this.frame + this.subframe;
        this.#activateShift("lShift", !!event.hoisted);
        this.#__internal_shift();
        return;

      case "moveRight":
        this.falling.keys++;
        if (this.input.firstInputTime == -1)
          this.input.firstInputTime = this.frame + this.subframe;
        this.#activateShift("rShift", !!event.hoisted);
        this.#__internal_shift();
        return;

      case "softDrop":
        this.input.keys.softDrop = true;
        if (this.input.firstInputTime == -1)
          this.input.firstInputTime = this.frame + this.subframe;
        return;

      case "rotateCCW":
        this.input.keys.rotateCCW = true;
        break;

      case "rotateCW":
        this.input.keys.rotateCW = true;
        break;

      case "rotate180":
        this.input.keys.rotate180 = true;
        break;
    }

    // todo: all in if (!this.pause)
    switch (event.key) {
      case "rotateCCW":
        if (this.input.firstInputTime == -1)
          this.input.firstInputTime = this.frame + this.subframe;
        this.#processRotate(-1);
        break;

      case "rotateCW":
        if (this.input.firstInputTime == -1)
          this.input.firstInputTime = this.frame + this.subframe;
        this.#processRotate(1);
        break;

      case "rotate180":
        if (!this.misc.allowed.spin180) return;
        if (this.input.firstInputTime == -1)
          this.input.firstInputTime = this.frame + this.subframe;
        this.#processRotate(2);
        break;

      case "hardDrop":
        if (this.misc.allowed.hardDrop === false || this.falling.safeLock !== 0)
          return;
        this.hardDrop();
        return;

      case "hold":
        this.hold();
        return;
    }
  }

  #keyup({ data: event }: Game.Replay.Frames.Keypress) {
    this.#processSubframe(event.subframe);
    // TODO: inversion?
    // if (this.misc.inverted)
    //   switch (e.key) {
    //     case "moveLeft":
    //       e.key = "moveRight";
    //       break;
    //     case "moveRight":
    //       e.key = "moveLeft";
    //   }

    switch (event.key) {
      case "moveLeft":
        this.input.lShift.held = false;
        this.input.lShift.das = 0;
        this.input.lastShift = this.input.rShift.held
          ? this.input.rShift.dir
          : this.input.lastShift;
        if (this.handling.cancel) {
          this.input.rShift.arr = this.handling.arr;
          this.input.rShift.das = 0;
        }
        break;

      case "moveRight":
        this.input.rShift.held = false;
        this.input.rShift.das = 0;
        this.input.lastShift = this.input.lShift.held
          ? this.input.lShift.dir
          : this.input.lastShift;
        if (this.handling.cancel) {
          this.input.lShift.arr = this.handling.arr;
          this.input.lShift.das = 0;
        }
        break;

      case "softDrop":
        this.state |= constants.flags.ACTION_SOFTDROP;
        this.input.keys.softDrop = false;
        break;

      case "rotateCCW":
        this.input.keys.rotateCCW = false;
        break;

      case "rotateCW":
        this.input.keys.rotateCW = false;
        break;

      case "rotate180":
        this.input.keys.rotate180 = false;
        break;

      case "hold":
        this.input.keys.hold = false;
        break;
    }
  }

  #activateShift(shift: "lShift" | "rShift", hoisted: boolean) {
    this.input[shift].held = true;
    this.input[shift].das = hoisted ? this.handling.das - this.handling.dcd : 0;
    this.input[shift].arr = this.handling.arr;
    this.input.lastShift = this.input[shift].dir;
  }

  #processRotate(rotation: number) {
    this.falling.keys += rotation >= 2 ? 2 : 1;
    this.#rotate(rotation as Rotation);
  }

  #processSubframe(subframe: number) {
    if (subframe <= this.subframe) return;
    const delta = subframe - this.subframe;
    this.#processAllShift(delta);
    this.#fall(delta);
    this.subframe = subframe;
  }

  #__internal_shift() {
    if (!this.#isSleep()) {
      // TODO: missing: && !this.pause
      this.state |= constants.flags.ACTION_MOVE;
      if (
        legal(
          this.falling.absoluteAt({
            x: this.falling.location[0] + this.input.lastShift
          }),
          this.board.state
        )
      ) {
        this.falling.location[0] += this.input.lastShift;
        if (this.falling.lockResets < 31) this.falling.lockResets++;
        this.#clearFlags(
          constants.flags.ROTATION_ALL | constants.flags.STATE_WALL
        );
        // fallingdirty = true;
        if (this.#is20G()) this.#slamToFloor();
        if (!this.#shouldLock()) this.falling.locking = 0;
        return true;
      } else {
        this.state |= constants.flags.STATE_WALL;
        return false;
      }
    }
  }

  #processShift(shift: "lShift" | "rShift", delta: number) {
    if (
      !this.input[shift].held ||
      this.input.lastShift !== this.input[shift].dir
    )
      return;
    const arrDelta = Math.max(
      0,
      delta - Math.max(0, this.handling.das - this.input[shift].das)
    );
    this.input[shift].das = Math.min(
      this.input[shift].das + delta,
      this.handling.das
    );
    if (this.input[shift].das < this.handling.das) return;
    if (this.#isSleep()) return; // TODO: missing: && !this.pause
    this.input[shift].arr += arrDelta;
    if (this.input[shift].arr < this.handling.arr) return;
    const arrMultiplier =
      this.handling.arr === 0
        ? this.board.width
        : Math.floor(this.input[shift].arr / this.handling.arr);
    this.input[shift].arr -= this.handling.arr * arrMultiplier;
    for (let i = 0; i < arrMultiplier; i++) this.#__internal_shift();
  }

  #processAllShift(subFrameDiff = 1 - this.subframe) {
    for (const shift of ["lShift", "rShift"] as const)
      this.#processShift(shift, subFrameDiff);
  }

  run(...frames: Game.Replay.Frame[]) {
    frames.forEach((frame) => {
      switch (frame.type) {
        case "keydown":
          this.#keydown(frame);
          break;
        case "keyup":
          this.#keyup(frame);
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
    this.#processAllShift();
    this.#fall();
    // TODO: execute waiting frames
    // TODO: process garbage are
    Object.keys(this.dynamic).forEach((key) =>
      this.dynamic[key as keyof typeof this.dynamic].tick()
    );

    return { ...this.flushRes() };
  }

  receiveGarbage(...garbage: IncomingGarbage[]) {
    this.garbageQueue.receive(...garbage);
  }

  hold(_ihs = false, ignoreBlockout = false) {
    if (this.#isSleep()) {
      if (this.handling.ihs === "tap") this.state |= constants.flags.ACTION_IHS;
      return;
    }
    if (this.holdLocked || !this.misc.allowed.hold) return;
    this.holdLocked = !this.misc.infiniteHold;
    if (this.held) {
      const save = this.held;
      this.held = this.falling.symbol;
      this.initiatePiece(save);
    } else {
      this.held = this.falling.symbol;
      this.nextPiece(false, ignoreBlockout);
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