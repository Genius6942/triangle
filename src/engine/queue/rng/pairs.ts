import { rng } from ".";
import { Mino } from "../types";

export const pairs = (seed: number) => {
  const gen = rng(seed);
  return () => {
    const s = gen.shuffleArray(["z", "l", "o", "s", "i", "j", "t"] as Mino[]);
    const pairs = gen.shuffleArray([s[0], s[0], s[0], s[1], s[1], s[1]]);

    return pairs;
  };
};
