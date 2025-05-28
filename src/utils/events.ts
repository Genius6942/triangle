export class EventEmitter<T extends Record<string, any>> {
  #listeners: [keyof T, Function][];
  #maxListeners: number = 10;

  /** Enables more debugging logs for memory leaks */
  verbose = false;

  constructor() {
    this.#listeners = [];
  }

  on<K extends keyof T>(event: K, cb: (data: T[K]) => void) {
    this.#listeners.push([event, cb]);

    const listeners = this.#listeners.filter(([e]) => e === event);
    if (listeners.length > this.#maxListeners) {
      console.warn(
        `Max listeners exceeded for event "${String(event)}". Current: ${
          this.#listeners.filter(([e]) => e === event).length
        }, Max: ${this.#maxListeners}`
      );
      if (this.verbose)
        console.warn(
          `Trace: ${new Error().stack}\n\nListeners:\n`,
          listeners.map(([_, fn]) => fn.toString()).join("\n\n")
        );
    }
    return this;
  }

  off<K extends keyof T>(event: K, cb: (data: T[K]) => void) {
    this.#listeners = this.#listeners.filter(
      ([e, c]) => e !== event || c !== cb
    );
    return this;
  }

  emit<K extends keyof T>(event: K, data: T[K]) {
    this.#listeners.filter(([e]) => e === event).forEach(([_, cb]) => cb(data));
  }

  once<K extends keyof T>(event: K, cb: (data: T[K]) => any | Promise<any>) {
    const handler = async (data: T[K]) => {
      this.off(event, handler);
      const res = await cb(data);
      return res;
    };
    this.on(event, handler);

    return this;
  }

  removeAllListeners<K extends keyof T>(event?: K) {
    if (event) {
      this.#listeners = this.#listeners.filter(([e]) => e !== event);
    } else {
      this.#listeners = [];
    }
  }

  set maxListeners(n: number) {
    if (n <= 0 || !Number.isInteger(n)) {
      throw new RangeError("Max listeners must be a positive integer");
    }

    this.#maxListeners = n;
  }

  get maxListeners() {
    return this.#maxListeners;
  }
}
