import { rng } from ".";
import { Piece } from "../types";

export const bag7 = (seed: number) => {
  const gen = rng(seed);
  return () => gen.shuffleArray(["z", "l", "o", "s", "i", "j", "t"] as Piece[]);
};
