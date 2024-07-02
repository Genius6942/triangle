import { Piece } from "../../queue/types";
import { BoardSquare } from "../../board";
import { KickTable, legal, performKick } from "../kicks";
import { tetrominoes } from "./data";
import { Rotation } from "./types";

export interface TetrominoInitializeParams {
  symbol: Piece;
  initialRotation: Rotation;
  boardHeight: number;
  boardWidth: number;
}

export class Tetromino {
  private _rotation!: Rotation;
  symbol: Piece;
  states: [number, number][][];
  location: [number, number];

  constructor(options: TetrominoInitializeParams) {
    this.rotation = options.initialRotation;
    this.symbol = options.symbol;
    const tetromino = tetrominoes[this.symbol.toLowerCase()];

    this.states = tetromino.matrix.data as any;

    this.location = [
      Math.floor(options.boardWidth / 2 - tetromino.matrix.w / 2),
      options.boardHeight + 2
    ];
  }

  get blocks() {
    return this.states[Math.min(this.rotation, this.states.length)];
  }

  get rotation(): Rotation {
    return (this._rotation % 4) as any;
  }

  set rotation(value: number) {
    this._rotation = (value % 4) as any;
  }

  rotate(board: BoardSquare[][], kickTable: KickTable, amt: Rotation) {
    const rotatedBlocks = this.states[(this.rotation + amt) % 4];
    const kickRes = performKick(
      kickTable,
      this.symbol,
      this.location,
      rotatedBlocks,
      this.rotation,
      ((this.rotation + amt) % 4) as any,
      board
    );

    if (typeof kickRes === "object") {
      const kick = kickRes.kick;
      this.location = [this.location[0] + kick[0], this.location[1] + kick[1]];
    }
    if (kickRes) {
      this.rotation = this.rotation + amt;

      return kickRes;
    }

    return false;
  }

  rotateCW(board: BoardSquare[][], kickTable: KickTable) {
    return this.rotate(board, kickTable, 1);
  }

  rotateCCW(board: BoardSquare[][], kickTable: KickTable) {
    return this.rotate(board, kickTable, 3);
  }

  rotate180(board: BoardSquare[][], kickTable: KickTable) {
    return this.rotate(board, kickTable, 2);
  }

  moveRight(board: BoardSquare[][]) {
    if (
      legal(
        this.blocks.map((block) => [
          block[0] + this.location[0] + 1,
          -block[1] + this.location[1]
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
          -block[1] + this.location[1]
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
    while (
      legal(
        this.blocks.map((block) => [
          block[0] + this.location[0],
          -block[1] + this.location[1] - 1
        ]),
        board
      )
    ) {
      this.location[1]--;
    }
  }
}

export * from "./data";
