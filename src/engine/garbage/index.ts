import { deepCopy, RNG } from "../utils";
import { columnWidth } from "./utils";

export interface GarbageQueueInitializeParams {
  cap: {
    value: number;
    marginTime: number;
    increase: number;
    absolute: number;
    max: number;
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

  multiplier: {
    value: number;
    increase: number;
    marginTime: number;
  };

  seed: number;
  boardWidth: number;
  rounding: "down" | "rng";
  openerPhase: number;
  specialBonus: boolean;
}

export interface Garbage {
  frame: number;
  amount: number;
  size: number;
}

export interface IncomingGarbage extends Garbage {
  cid: number;
  gameid: number;
  confirmed: boolean;
}
export interface OutgoingGarbage extends Garbage {
  column: number;
}

export interface GarbageQueueSnapshot {
  seed: number;
  lastTankTime: number;
  lastColumn: number | null;
  sent: number;
  queue: IncomingGarbage[];
}

export class GarbageQueue {
  options: GarbageQueueInitializeParams;

  queue: IncomingGarbage[];

  lastTankTime: number = 0;
  lastColumn: number | null = null;
  rng: RNG;

  // for opener phase calculations
  sent = 0;

  constructor(options: GarbageQueueInitializeParams) {
    this.options = options;
    if (!this.options.cap.absolute) this.options.cap.absolute = Infinity;

    this.queue = [];

    this.rng = new RNG(this.options.seed);
  }

  snapshot(): GarbageQueueSnapshot {
    return {
      seed: this.rng.seed,
      lastTankTime: this.lastTankTime,
      lastColumn: this.lastColumn,
      sent: this.sent,
      queue: deepCopy(this.queue)
    };
  }

  fromSnapshot(snapshot: GarbageQueueSnapshot) {
    this.queue = deepCopy(snapshot.queue);
    this.lastTankTime = snapshot.lastTankTime;
    this.lastColumn = snapshot.lastColumn;
    this.rng = new RNG(snapshot.seed);
    this.sent = snapshot.sent;
  }

  rngex() {
    return this.rng.nextFloat();
  }

  get size() {
    return this.queue.reduce((a, b) => a + b.amount, 0);
  }

  receive(...args: IncomingGarbage[]) {
    this.queue.push(...args.filter((arg) => arg.amount > 0));

    while (this.size > this.options.cap.absolute) {
      const total = this.size;
      if (this.queue.at(-1)!.amount <= total - this.options.cap.absolute) {
        this.queue.pop();
      } else {
        this.queue.at(-1)!.amount -= total - this.options.cap.absolute;
      }
    }
  }

  confirm(cid: number, gameid: number, frame: number) {
    const obj = this.queue.find((g) => g.cid === cid && g.gameid === gameid);
    if (!obj) return false;
    obj.frame = frame;
    obj.confirmed = true;
    return true;
  }

  cancel(
    amount: number,
    pieceCount: number,
    legacy: { openerPhase?: boolean } = {}
  ) {
    let send = amount,
      cancel = 0;
    if (
      pieceCount + 1 <=
        this.options.openerPhase - (legacy.openerPhase ? 1 : 0) &&
      this.size >= this.sent
    )
      cancel += amount;
    while ((send > 0 || cancel > 0) && this.size > 0) {
      this.queue[0].amount--;
      if (this.queue[0].amount <= 0) this.queue.shift();
      if (send > 0) send--;
      else cancel--;
    }

    this.sent += send;
    return send;
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

  tank(frame: number, cap: number, hard: boolean): OutgoingGarbage[] {
    if (this.queue.length === 0) return [];

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

    while (total < cap && this.queue.length > 0) {
      const item = deepCopy(this.queue[0]);

      // TODO: wtf hacky fix, this is 100% not right idk how to fix this
      if (item.frame + this.options.garbage.speed > (hard ? frame : frame - 1))
        break; // do not spawn garbage that is still traveling
      total += item.amount;

      let exausted = false;

      if (total > cap) {
        const excess = total - cap;
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

  round(amount: number): number {
    switch (this.options.rounding) {
      case "down":
        return Math.floor(amount);
      case "rng":
        const floored = Math.floor(amount);
        if (floored === amount) return floored;
        const decimal = amount - floored;
        return floored + (this.rngex() < decimal ? 1 : 0);
      default:
        throw new Error(`Invalid rounding mode ${this.options.rounding}`);
    }
  }
}
