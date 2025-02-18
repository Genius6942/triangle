import { BoardSquare } from "../../board";
import { Mino } from "../../queue/types";
import { KickTable, legal, performKick } from "../kicks";
import { tetrominoes } from "./data";
import { Rotation, Falling } from "./types";

export interface TetrominoInitializeParams {
  symbol: Mino;
  initialRotation: Rotation;
  boardHeight: number;
  boardWidth: number;
}

export class Tetromino {
  private _rotation!: Rotation;
  symbol: Mino;
  states: [number, number][][];
  location: [number, number];

  sleep: boolean;
  deepSleep: boolean;
  hibernated: boolean;
  locking: number;
  lockResets: number;
  forceLock: boolean;
  floored: boolean;
  clamped: boolean;
  safeLock: number;
  highestY: number;
  last: Falling.LastKind;
  lastKick: number;
  lastRotation: Falling.LastRotationKind;
  fallingRotations: number;
  totalRotations: number;
  irs: number;
  ihs: boolean;
  aox: number;
  aoy: number;
  readonly keys: number;
  spinType: Falling.SpinTypeKind;

  constructor(options: TetrominoInitializeParams) {
    this.rotation = options.initialRotation;
    this.symbol = options.symbol;
    const tetromino = tetrominoes[this.symbol.toLowerCase()];

    this.states = tetromino.matrix.data as any;

    this.location = [
      Math.floor(options.boardWidth / 2 - tetromino.matrix.w / 2),
      options.boardHeight + 2.04
    ];

    // other stuff
    this.sleep = false;
    this.deepSleep = false;
    this.hibernated = false;
    this.locking = 0;
    this.lockResets = 0;
    this.forceLock = false;
    this.floored = false;
    this.clamped = false;
    this.safeLock = 0;
    this.highestY = this.location[1];
    this.last = Falling.LastKind.None;
    this.lastKick = 0;
    this.lastRotation = Falling.LastRotationKind.None;
    this.fallingRotations = 0;
    this.totalRotations = 0;
    this.irs = 0;
    this.ihs = false;
    this.aox = 0;
    this.aoy = 0;
    this.keys = 0;
    this.spinType = Falling.SpinTypeKind.Null;
  }

  get blocks() {
    return this.states[Math.min(this.rotation, this.states.length)];
  }

  get absoluteBlocks() {
    return this.blocks.map((block): [number, number] => [
      block[0] + this.location[0],
      -block[1] + this.y
    ]);
  }

  absoluteAt({
    x = this.location[0],
    y = this.location[1],
    rotation = this.rotation
  }: {
    x?: number;
    y?: number;
    rotation?: number;
  }) {
    const currentState = [this.location[0], this.location[1], this.rotation];

    this.location = [x, y];
    this.rotation = rotation;

    const res = this.absoluteBlocks;

    this.location = [currentState[0], currentState[1]];
    this.rotation = currentState[2];

    return res;
  }

  get rotation(): Rotation {
    return (this._rotation % 4) as any;
  }

  set rotation(value: number) {
    this._rotation = (value % 4) as any;
  }

  get x() {
    return this.location[0];
  }

  set x(value: number) {
    this.location[0] = value;
  }

  get y() {
    return Math.floor(this.location[1]);
  }

  set y(value: number) {
    this.location[1] = value;
  }

  isStupidSpinPosition(board: BoardSquare[][]) {
    return !legal(
      this.blocks.map((block) => [
        block[0] + this.location[0],
        -block[1] + this.y - 1
      ]),
      board
    );
  }

  isAllSpinPosition(board: BoardSquare[][]) {
    return (
      !legal(
        this.blocks.map((block) => [
          block[0] + this.location[0] - 1,
          -block[1] + this.y
        ]),
        board
      ) &&
      !legal(
        this.blocks.map((block) => [
          block[0] + this.location[0] + 1,
          -block[1] + this.y
        ]),
        board
      ) &&
      !legal(
        this.blocks.map((block) => [
          block[0] + this.location[0],
          -block[1] + this.y + 1
        ]),
        board
      ) &&
      !legal(
        this.blocks.map((block) => [
          block[0] + this.location[0],
          -block[1] + this.y - 1
        ]),
        board
      )
    );
  }

  rotate(
    board: BoardSquare[][],
    kickTable: KickTable,
    amt: Rotation,
    maxMovement: boolean
  ) {
    const rotatedBlocks = this.states[(this.rotation + amt) % 4];
    const kickRes = performKick(
      kickTable,
      this.symbol,
      this.location,
      [this.aox, this.aoy],
      maxMovement,
      rotatedBlocks,
      this.rotation,
      ((this.rotation + amt) % 4) as any,
      board
    );

    if (typeof kickRes === "object") {
      this.location = [...kickRes.newLocation];
    }
    if (kickRes) {
      this.rotation = this.rotation + amt;

      return kickRes;
    }

    return false;
  }

  moveRight(board: BoardSquare[][]) {
    if (
      legal(
        this.blocks.map((block) => [
          block[0] + this.location[0] + 1,
          -block[1] + this.y
        ]),
        board
      )
    ) {
      this.location[0]++;
      return true;
    }
    return false;
  }
  moveLeft(board: BoardSquare[][]) {
    if (
      legal(
        this.blocks.map((block) => [
          block[0] + this.location[0] - 1,
          -block[1] + this.y
        ]),
        board
      )
    ) {
      this.location[0]--;
      return true;
    }

    return false;
  }

  dasRight(board: BoardSquare[][]) {
    if (this.moveRight(board)) {
      while (this.moveRight(board)) {}
      return true;
    }
    return false;
  }

  dasLeft(board: BoardSquare[][]) {
    if (this.moveLeft(board)) {
      while (this.moveLeft(board)) {}
      return true;
    }
    return false;
  }

  softDrop(board: BoardSquare[][]) {
    const start = this.location[1];
    while (
      legal(
        this.blocks.map((block) => [
          block[0] + this.location[0],
          -block[1] + this.y - 1
        ]),
        board
      )
    ) {
      this.location[1]--;
    }

    return start !== this.location[1];
  }
}

export * from "./data";
