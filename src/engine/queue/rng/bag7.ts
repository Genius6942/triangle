import { rng } from ".";
import { Piece } from "../types";

export const bag7 = (seed: number) => {
  const gen = rng(seed);
  return () => gen.shuffleArray(["Z", "L", "O", "S", "I", "J", "T"] as Piece[]);
};
