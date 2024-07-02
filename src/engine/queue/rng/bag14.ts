import { rng } from ".";
import { Piece } from "../types";

export const bag14 = (seed: number) => {
  const gen = rng(seed);
  return () =>
    gen.shuffleArray([
      "Z",
      "L",
      "O",
      "S",
      "I",
      "J",
      "T",
      "Z",
      "L",
      "O",
      "S",
      "I",
      "J",
      "T"
    ] as Piece[]);
};
