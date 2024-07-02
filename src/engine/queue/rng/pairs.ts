import { rng } from ".";
import { Piece } from "../types";

export const pairs = (seed: number) => {
  const gen = rng(seed);
  return () => {
    const s = gen.shuffleArray(["Z", "L", "O", "S", "I", "J", "T"] as Piece[]);
    const pairs = gen.shuffleArray([s[0], s[0], s[0], s[1], s[1], s[1]]);

    return pairs;
  };
};
