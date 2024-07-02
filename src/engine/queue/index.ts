import { BagType, RngInnerFunction, rngMap } from "./rng";
import { Piece } from "./types";

export interface QueueInitializeParams {
  seed: number;
  type: BagType;
  minLength: number;
}

export class Queue {
  seed: number;
  type: BagType;
  genFunction!: RngInnerFunction;
  value: Piece[];
  _minLength!: number;
  index: number;
  repopulateListener: ((pieces: Piece[]) => void) | null = null;
  constructor(options: QueueInitializeParams) {
    this.seed = options.seed;
    this.type = options.type;
    this.reset();
    this.value = [];
    this.minLength = options.minLength;

    this.index = 0;
  }

  reset(index = 0) {
    this.genFunction = rngMap[this.type](this.seed);
    this.value = [];
    this.index = index;
    this.repopulate();
    for (let i = 0; i < index; i++) {
      this.shift();
      this.repopulate();
    }
  }

  onRepopulate(listener: NonNullable<typeof this.repopulateListener>) {
    this.repopulateListener = listener;
  }

  get minLength() {
    return this._minLength;
  }
  set minLength(val: number) {
    this._minLength = val;
    this.repopulate();
  }

  get next() {
    return this.value[0];
  }

  at(index: number) {
    return this.value.at(index);
  }

  shift() {
    const val = this.value.shift();
    this.index++;
    this.repopulate();
    return val;
  }

  private repopulate() {
    const added: Piece[] = [];
    while (this.value.length < this.minLength) {
      const newValues = this.genFunction();
      this.value.push(...newValues);
      added.push(...newValues);
    }

    if (this.repopulateListener) {
      this.repopulateListener(added);
    }
  }
}
export * from "./rng";
export * from "./types";
