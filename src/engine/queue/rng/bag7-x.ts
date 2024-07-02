import { rng } from ".";
import { Piece } from "../types";

export const bag7_X = (seed: number): (() => Piece[]) => {
  const gen = rng(seed);
  const extraPieceCount = [3, 2, 1, 1];
  let bagid = 0;
  let extraBag: Piece[] = [];
  return () => {
    const extra = extraPieceCount[bagid++] ?? 0;
    if (extraBag.length < extra)
      extraBag = gen.shuffleArray(["Z", "L", "O", "S", "I", "J", "T"] as const);
    return gen.shuffleArray([
      "Z",
      "L",
      "O",
      "S",
      "I",
      "J",
      "T",
      ...extraBag.splice(0, extra)
    ] as const);
  };
};
