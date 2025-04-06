export class EventEmitter<T extends Record<string, any>> {
  #listeners: [string, (arg: any) => void, boolean][] = [];

  on<K extends keyof T>(event: K, listener: (arg: T[K]) => void) {
    this.#listeners.push([event as string, listener, false]);
  }
	
  once<K extends keyof T>(event: K, listener: (arg: T[K]) => void) {
    this.#listeners.push([event as string, listener, true]);
  }

  off<K extends keyof T>(event: K, listener: (arg: T[K]) => void) {
    this.#listeners = this.#listeners.filter(
      (l) => l[0] !== event || l[1] !== listener
    );
  }

  emit<K extends keyof T>(event: K, arg: T[K]) {
    for (const [e, listener, once] of this.#listeners) {
      if (e === event) {
        listener(arg);
        if (once) {
          this.off(event, listener);
        }
      }
    }
  }

  removeAllListeners() {
    this.#listeners = [];
  }
}
