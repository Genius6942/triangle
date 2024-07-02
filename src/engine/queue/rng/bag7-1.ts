import { rng } from ".";
import { Piece } from "../types";

export const bag7_1 = (seed: number): (() => Piece[]) => {
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
      (["Z", "L", "O", "S", "I", "J", "T"] as const)[
        Math.floor(gen.nextFloat() * 7)
      ]
    ] as const);
};
