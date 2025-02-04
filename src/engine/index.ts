import { Game } from "../types";
import { Board, BoardInitializeParams } from "./board";
import {
  Garbage,
  GarbageQueue,
  GarbageQueueInitializeParams,
  OutgoingGarbage
} from "./garbage";
import { IGEHandler, MultiplayerOptions } from "./multiplayer";
import { Queue, QueueInitializeParams } from "./queue";
import { Piece } from "./queue/types";
import { bfs } from "./search";
import { Handling, IncreasableValue, KeyPress } from "./types";
import { EngineCheckpoint, SpinType } from "./types";
import { calculateIncrease, deepCopy } from "./utils";
import { garbageCalcV2, garbageData } from "./utils/damageCalc";
import { KickTable, legal } from "./utils/kicks";
import { KickTableName, kicks } from "./utils/kicks/data";
import { Tetromino, tetrominoes } from "./utils/tetromino";

import chalk from "chalk";

export interface GameOptions {
  spinBonuses: Game.SpinBonuses;
  comboTable: keyof (typeof garbageData)["comboTable"] | "multiplier";
  garbageTargetBonus: "none" | "normal" | string;
  garbageMultiplier: {
    value: number;
    increase: number;
    marginTime: number;
  };

  clutch: boolean;

  garbageAttackCap?: number;
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

export interface EngineInitializeParams {
  queue: QueueInitializeParams;
  board: BoardInitializeParams;
  kickTable: KickTable;
  options: GameOptions;
  gravity: IncreasableValue;
  garbage: GarbageQueueInitializeParams;
  handling: Handling;
  pc: PCOptions;
  b2b: B2BOptions;
  multiplayer?: MultiplayerOptions;
}

export class Engine {
  queue!: Queue;
  held!: Piece | null;
  falling!: Tetromino;
  private _kickTable!: KickTableName;
  board!: Board;
  lastSpin!: {
    piece: Piece;
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
  checkpoints!: EngineCheckpoint[];

  initializer: EngineInitializeParams;

  handling!: Handling;
  keys: {
    left: [number, number];
    right: [number, number];
    soft: [number, number];
  } = {
    left: [-1, -1],
    right: [-1, -1],
    soft: [-1, -1]
  };

  pc!: PCOptions;
  b2b!: B2BOptions;
  gravity!: IncreasableValue;

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
  onGarbageSpawn?: (column: number, size: number) => void;
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

    this.nextPiece();
    this.held = null;
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

    this.gravity = options.gravity;

    this.gameOptions = options.options;
    this.handling = options.handling;
    this.frame = 0;

    this.checkpoints = [];
    this.bindAll();
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
    this.revert = this.revert.bind(this);
    this.save = this.save.bind(this);
    this.checkpoint = this.checkpoint.bind(this);
    this.nextPiece = this.nextPiece.bind(this);
  }

  revert() {
    if (this.checkpoints.length === 0)
      throw new Error("No checkpoints to revert to");
    const checkpoint = this.checkpoints.at(-1)!;
    this.queue.reset(checkpoint.queue);
    this.board.state = deepCopy(checkpoint.board);
    this.stats.b2b = checkpoint.b2b;
    this.stats.combo = checkpoint.combo;
    this.initiatePiece(checkpoint.falling);
    this.garbageQueue.queue = deepCopy(checkpoint.garbage);
    this.checkpoints.pop();
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
  }

  initiatePiece(piece: Piece) {
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
          this.board.state[-block[1] + this.falling.location[1]][
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

  isTSpinKick(kick: ReturnType<typeof Tetromino.prototype.rotate180>) {
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
    this.lastSpin = {
      piece: this.falling.symbol,
      type: this.detectSpin(
        this.isTSpinKick(
          this.falling.rotateCW(this.board.state, this.kickTableName)
        )
      )
    };
  }
  rotateCCW() {
    this.lastSpin = {
      piece: this.falling.symbol,
      type: this.detectSpin(
        this.isTSpinKick(
          this.falling.rotateCCW(this.board.state, this.kickTableName)
        )
      )
    };
  }
  rotate180() {
    this.lastSpin = {
      piece: this.falling.symbol,
      type: this.detectSpin(
        this.isTSpinKick(
          this.falling.rotate180(this.board.state, this.kickTableName)
        )
      )
    };
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
   * Returns array of true/false corners in this form (numbers represent array indicies):
   * @example
   *  0    1
   *  🟦🟦🟦
   *  3 🟦 2
   */
  getTCorners() {
    const [x, y] = [this.falling.location[0] + 1, this.falling.location[1] - 1];
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

  lock() {
    this.board.add(
      ...(this.falling.blocks.map((block) => [
        this.falling.symbol,
        this.falling.location[0] + block[0],
        this.falling.location[1] - block[1]
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
        spin: this.lastSpin ? this.lastSpin.type : "none",
        frame: this.frame
      },
      {
        ...this.gameOptions,
        b2b: { chaining: this.b2b.chaining, charging: !!this.b2b.charging }
      }
    );
    const gEvents =
      garbage.garbage > 0 || gSpecialBonus > 0
        ? [this.garbageQueue.round(garbage.garbage + gSpecialBonus)]
        : []; // TODO: do this after calculating increase instead, margin time issues
    const m = this.gameOptions.garbageMultiplier;

    const gMultiplier = calculateIncrease(
      m.value,
      this.frame,
      m.increase,
      m.marginTime
    );
    if (brokeB2B !== false) {
      let btb = brokeB2B;
      if (this.b2b.charging !== false && btb > this.b2b.charging.at) {
        const value = Math.floor(
          (btb - this.b2b.charging.at + this.b2b.charging.base) * gMultiplier
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
      gEvents.push(this.garbageQueue.round(this.pc.garbage * gMultiplier));
      this.stats.b2b += this.pc.b2b;
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
      const garbages = this.garbageQueue.tank(this.frame);
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
    this.stats.pieces++;

    try {
      if (!legal(this.falling.absoluteBlocks, this.board.state))
        res.topout = true;
    } catch {
      res.topout = true;
    }
    return res;
  }

  press<T extends KeyPress>(key: T) {
    if (key in this) return this[key]() as ReturnType<(typeof this)[T]>;
    else throw new Error("invalid key: " + key);
  }

  testKeys(keys: KeyPress[], target: [number, number][]) {
    const targetSet = new Set(target.map(([x, y]) => `${x},${y}`));

    const state = {
      location: this.falling.location.slice() as [number, number],
      rotation: this.falling.rotation,
      lastSpin: this.lastSpin ? { ...this.lastSpin } : null
    };

    keys.forEach((key) => this[key]());

    const res = this.falling.blocks
      .map(
        (block) =>
          `${this.falling.location[0] + block[0]},${
            this.falling.location[1] - block[1]
          }`
      )
      .every((block) => targetSet.has(block));

    // reset
    this.falling.location = state.location;
    this.falling.rotation = state.rotation;
    this.lastSpin = state.lastSpin;

    return res;
  }

  tick(frames: Game.Replay.Frame[]) {
    this.frame++;

    if (this.frame > this.gravity.marginTime)
      this.gravity.value += this.gravity.increase;

    const r = (n: number) => Math.round(n * 10) / 10;
    let spin = "none";
    // array of arrays of frames, each arr has a subframe
    const f: Game.Replay.Frame[][] = Array.from({ length: 10 }, () => []);
    frames.forEach((frame) => {
      if (frame.type === "keyup" || frame.type === "keydown") {
        if (frame.data && typeof frame.data.subframe === "number") {
          const i = Math.round(frame.data.subframe * 10);
          const ci = Math.max(0, Math.min(9, i));
          f[ci].push(frame);
        }
      } else if (frame.type === "ige") {
        if (frame.data.type === "interaction_confirm") {
          if (frame.data.data.type === "garbage") {
            this.receiveGarbage({
              frame: frame.frame,
              amount: this.multiplayer?.passthrough?.network
                ? this.igeHandler.receive({
                    playerID: frame.data.data.gameid,
                    ackiid: frame.data.data.ackiid,
                    amount: frame.data.data.amt,
                    iid: frame.data.data.iid
                  })
                : frame.data.data.amt,
              size: frame.data.data.size
            });
          }
        } else if (frame.data.type === "target" && this.multiplayer) {
          this.multiplayer.targets = frame.data.data.targets;
        }
      }
    });

    const res: {
      pieces: number;
      garbage: {
        sent: number[];
        received: OutgoingGarbage[];
      };
    } = {
      pieces: 0,
      garbage: {
        sent: [],
        received: []
      }
    };

    f.forEach((frames, subf) => {
      subf = r(subf / 10);
      frames.forEach((frame) => {
        if (frame.type === "keydown") {
          const {
            hoisted,
            data: { subframe, key }
          } = frame;
          if (key === "moveRight") {
            if (hoisted) {
              if (this.handling.arr === 0) {
                this.dasRight();
                const target = r(this.frame + subframe + 0.1);
                this.keys.right = [Math.floor(target), r(target % 1)];
              } else {
                const target = r(this.frame + subframe + this.handling.arr);
                this.keys.right = [Math.floor(target), r(target % 1)];
                this.moveRight();
              }
            } else {
              const target = r(this.frame + subframe + this.handling.das);
              this.keys.right = [Math.floor(target), r(target % 1)];
              this.moveRight();
            }
          } else if (key === "moveLeft") {
            if (hoisted) {
              if (this.handling.arr === 0) {
                this.dasLeft();
                const target = r(this.frame + subframe + 0.1);
                this.keys.left = [Math.floor(target), r(target % 1)];
              } else {
                const target = r(this.frame + subframe + this.handling.arr);
                this.keys.left = [Math.floor(target), r(target % 1)];
                this.moveLeft();
              }
            } else {
              const target = r(this.frame + subframe + this.handling.das);
              this.keys.left = [Math.floor(target), r(target % 1)];
              this.moveLeft();
            }
          } else if (key === "softDrop") {
            this.keys.soft = [frame.frame, subframe];
          } else if (key === "hardDrop") {
            const { garbage: g, garbageAdded, spin: s } = this.hardDrop();
            res.garbage.sent.push(...g);
            if (g.length > 0) {
              if (this.multiplayer)
                this.multiplayer.targets.forEach((target) =>
                  g.forEach((g) =>
                    this.igeHandler.send({ amount: g, playerID: target })
                  )
                );
            }
            res.garbage.received.push(...(garbageAdded || []));
            res.pieces++;
            spin = s;
          } else if (key === "hold") {
            this.hold();
          } else if (key === "rotateCW") {
            this.rotateCW();
          } else if (key === "rotateCCW") {
            this.rotateCCW();
          } else if (key === "rotate180") {
            this.rotate180();
          }
        } else if (frame.type === "keyup") {
          if (frame.data.key === "moveRight") this.keys.right = [-1, -1];
          if (frame.data.key === "moveLeft") this.keys.left = [-1, -1];
          if (frame.data.key === "softDrop") this.keys.soft = [-1, -1];
        }
      });

      if (this.frame === this.keys.left[0] && subf === this.keys.left[1]) {
        if (this.handling.arr === 0) {
          this.dasLeft();
          const t = r(this.frame + subf + 0.1);
          this.keys.left = [Math.floor(t), r(t % 1)];
        } else {
          this.moveLeft();
          const t = r(this.frame + subf + this.handling.arr);
          this.keys.left = [Math.floor(t), r(t % 1)];
        }
      }

      if (this.frame === this.keys.right[0] && subf === this.keys.right[1]) {
        if (this.handling.arr === 0) {
          this.dasRight();
          const t = r(this.frame + subf + 0.1);
          this.keys.right = [Math.floor(t), r(t % 1)];
        } else {
          this.moveRight();
          const t = r(this.frame + subf + this.handling.arr);
          this.keys.right = [Math.floor(t), r(t % 1)];
        }
      }

      if (
        r(this.frame + subf) >= r(this.keys.soft[0] + this.keys.soft[1]) &&
        !(this.keys.soft[0] === -1 && this.keys.soft[1] === -1)
      ) {
        // const o = 1; // TODO: wtf is this?
        // let dropFactor =
        //   this.handling.sdf === 41
        //     ? 400 * o
        //     : Math.max(
        //         this.gravity.value * o * this.handling.sdf,
        //         0.05 * this.handling.sdf
        //       );

        // TODO: do real softdrop cause idk how it works
        this.softDrop();
      }
    });

    return { ...res, spin };
  }

  receiveGarbage(...garbage: Garbage[]) {
    this.garbageQueue.receive(...garbage);
  }

  hold() {
    if (this.held) {
      const save = this.held;
      this.held = this.falling.symbol;
      this.initiatePiece(save);
    } else {
      this.held = this.falling.symbol;
      this.nextPiece();
    }
  }

  getPreview(piece: Piece) {
    return tetrominoes[piece.toLowerCase()].preview;
  }

  bfs(depth: number, target: [number, number][], finesse?: boolean) {
    return bfs(this, depth, target, finesse);
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
export * from "./search";
export * from "./utils";
export * from "./board";
export * from "./types";
