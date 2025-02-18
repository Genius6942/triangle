import { rng } from ".";
import { Mino } from "../types";

export const bag14 = (seed: number) => {
  const gen = rng(seed);
  return () =>
    gen.shuffleArray([
      "z",
      "l",
      "o",
      "s",
      "i",
      "j",
      "t",
      "z",
      "l",
      "o",
      "s",
      "i",
      "j",
      "t"
    ] as Mino[]);
};
