export const garbageRNG = (seed: number) => {
  let t = seed % 2147483647;

  if (t <= 0) {
    t += 2147483646;
  }

  return {
    next: function () {
      t = (16807 * t) % 2147483647;
      return t;
    },
    nextFloat: function () {
      return (this.next() - 1) / 2147483646;
    },
    shuffleArray: function (array: string[]) {
      if (array.length == 0) {
        return array;
      }

      for (let i = array.length - 1; i != 0; i--) {
        const r = Math.floor(this.nextFloat() * (i + 1));
        [array[i], array[r]] = [array[r], array[i]];
      }

      return array;
    },
    getCurrentSeed: function () {
      return t;
    }
  };
};

export const columnWidth = (width: number, garbageHoleSize: number) => {
  return Math.max(0, width - (garbageHoleSize - 1));
};
