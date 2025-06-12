export class IncreaseTracker {
   #value: number;

  base: number;
  increase: number;
  margin: number;
  frame: number;
  constructor(base: number, increase: number, margin: number) {
    this.#value = this.base = base;
    this.increase = increase;
    this.margin = margin;
    this.frame = 0;
  }

  reset() {
    this.#value = this.base;
    this.frame = 0;
  }

  tick() {
    this.frame++;
    if (this.frame > this.margin) this.#value += this.increase / 60;
    return this.get();
  }

  get() {
    return this.#value;
  }

  set(value: number) {
    this.#value = value;
  }
}
