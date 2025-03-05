import { Mino } from "../queue/types";

export interface BoardInitializeParams {
  width: number;
  height: number;
  buffer: number;
}

export type BoardSquare = Mino | "gb" | null;

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
      if (y < 0 || y >= this.fullHeight || x < 0 || x >= this.width) return;
      this.state[y][x] = char;
    });
  }

  clearLines() {
    let garbageCleared = 0;
    const lines: number[] = [];
    this.state.forEach((row, idx) => {
      if (row.every((block) => block !== null)) {
        lines.push(idx);
        if (row.some((block) => block === "gb")) garbageCleared++;
      }
    });

    [...lines].reverse().forEach((line) => {
      this.state.splice(line, 1);
      this.state.push(new Array(this.width).fill(null));
    });
    return { lines: lines.length, garbageCleared };
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
          idx >= column && idx < column + size ? null : ("gb" as const)
        )
      )
    );

    this.state.splice(this.fullHeight - amount - 1, amount);
  }
}
