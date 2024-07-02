import { calculateIncrease, deepCopy } from "../utils";
import { columnWidth, garbageRNG } from "./utils";

export interface GarbageQueueInitializeParams {
  cap: {
    value: number;
    absolute: number;
    max: number;
    increase: number;
  };
  messiness: {
    change: number;
    within: number;
    nosame: boolean;
    timeout: number;
  };

  garbage: {
    speed: number;
    holeSize: number;
  };
  seed: number;
  boardWidth: number;
}

export interface Garbage {
  frame: number;
  amount: number;
  size: number;
}

export type OutgoingGarbage = Garbage & { column: number };

export class GarbageQueue {
  options: GarbageQueueInitializeParams;

  queue: Garbage[];

  private lastTankTime: number = 0;
  private lastColumn: number | null = null;
  private rng: ReturnType<typeof garbageRNG>;
  constructor(options: GarbageQueueInitializeParams) {
    this.options = options;
    if (!this.options.cap.absolute) this.options.cap.absolute = Infinity;

    this.queue = [];

    this.rng = garbageRNG(options.seed);
  }

  rngex() {
    return this.rng.nextFloat();
  }

  get size() {
    return this.queue.reduce((a, b) => a + b.amount, 0);
  }

  cap(frame: number) {
    return Math.min(
      calculateIncrease(
        this.options.cap.value,
        frame,
        this.options.cap.increase,
        0
      ),
      this.options.cap.max
    );
  }

  receive(...args: Garbage[]) {
    this.queue.push(...args);

    while (this.size > this.options.cap.absolute) {
      const total = this.size;
      if (this.queue.at(-1)!.amount <= total - this.options.cap.absolute) {
        this.queue.pop();
      } else {
        this.queue.at(-1)!.amount -= total - this.options.cap.absolute;
      }
    }
  }

  cancel(amount: number) {
    while (amount > 0) {
      if (this.queue.length <= 0) {
        break;
      }

      if (amount >= this.queue[0].amount) {
        amount -= this.queue[0].amount;
        this.queue.shift();
      } else {
        this.queue[0].amount -= amount;
        amount = 0;
        break;
      }
    }

    return amount;
  }

  private reroll_column() {
    let col: number;
    const cols = columnWidth(
      this.options.boardWidth,
      this.options.garbage.holeSize
    );

    if (this.options.messiness.nosame && this.lastColumn !== null) {
      col = Math.floor(this.rngex() * (cols - 1));
      if (col >= this.lastColumn) col++;
    } else {
      col = Math.floor(this.rngex() * cols);
    }

    this.lastColumn = col;
    return col;
  }

  tank(frame: number): OutgoingGarbage[] {
    if (this.queue.length === 0) return [];

    // console.log("call tank", this.queue);

    const res: OutgoingGarbage[] = [];

    this.queue = this.queue.sort((a, b) => a.frame - b.frame);

    if (
      this.options.messiness.timeout &&
      frame >= this.lastTankTime + this.options.messiness.timeout
    ) {
      this.reroll_column();
      this.lastTankTime = frame;
    }

    let total = 0;

    while (total < this.cap(frame) && this.queue.length > 0) {
      const item = deepCopy(this.queue[0]);

      if (item.frame + this.options.garbage.speed > frame) break; // do not spawn garbage that is still traveling

      total += item.amount;

      let exausted = false;

      if (total > this.cap(frame)) {
        const excess = total - this.cap(frame);
        this.queue[0].amount = excess;
        item.amount -= excess;
      } else {
        this.queue.shift();
        exausted = true;
      }

      for (let i = 0; i < item.amount; i++) {
        const reroll =
          this.lastColumn === null ||
          this.rngex() < this.options.messiness.within;
        res.push({
          ...item,
          amount: 1,
          column: reroll ? this.reroll_column() : this.lastColumn!
        });
      }

      if (exausted && this.rngex() < this.options.messiness.change) {
        this.reroll_column();
      }
    }

    return res;
  }
}
