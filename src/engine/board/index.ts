import { Piece } from "../queue/types";

export interface BoardInitializeParams {
  width: number;
  height: number;
  buffer: number;
}

export type BoardSquare = Piece | "G" | null;

export class Board {
  state: BoardSquare[][];

  private _height: number;
  private _width: number;
  private _buffer: number;

  constructor(options: BoardInitializeParams) {
    this._width = options.width;
    this._height = options.height;
    this._buffer = options.buffer;
    this.state = Array(this.fullHeight)
      .fill(null)
      .map(() => Array(this.width).fill(null));
  }

  get height(): number {
    return this._height;
  }

  set height(value: number) {
    this._height = value;
  }

  get width(): number {
    return this._width;
  }

  set width(value: number) {
    this._width = value;
  }

  get buffer(): number {
    return this._buffer;
  }

  set buffer(value: number) {
    this._buffer = value;
  }

  get fullHeight(): number {
    return this.height + this.buffer;
  }

  add(...blocks: [BoardSquare, number, number][]) {
    blocks.forEach(([char, x, y]) => {
      this.state[y][x] = char;
    });
  }

  clearLines() {
    const lines: number[] = [];
    this.state.forEach((row, idx) => {
      if (row.every((block) => block !== null)) {
        lines.push(idx);
      }
    });

    [...lines].reverse().forEach((line) => {
      this.state.splice(line, 1);
      this.state.push(new Array(this.width).fill(null));
    });
    return lines.length;
  }

  get perfectClear() {
    return this.state.every((row) => row.every((block) => block === null));
  }

  insertGarbage({
    amount,
    size,
    column
  }: {
    amount: number;
    size: number;
    column: number;
  }) {
    this.state.splice(
      0,
      0,
      ...Array.from({ length: amount }, () =>
        Array.from({ length: this.width }, (_, idx) =>
          idx >= column && idx < column + size ? null : ("G" as "G" | null)
        )
      )
    );

    this.state.splice(this.fullHeight - amount - 1, amount);
  }
}
