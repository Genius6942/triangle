import { RNG } from "../../utils";
import { Mino } from "../types";

export const bag7_X = (seed: number): (() => Mino[]) => {
  const gen = new RNG(seed);
  const extraPieceCount = [3, 2, 1, 1];
  let bagid = 0;
  let extraBag: Mino[] = [];
  return () => {
    const extra = extraPieceCount[bagid++] ?? 0;
    if (extraBag.length < extra)
      extraBag = gen.shuffleArray([
        Mino.Z,
        Mino.L,
        Mino.O,
        Mino.S,
        Mino.I,
        Mino.J,
        Mino.T
      ] as const);
    return gen.shuffleArray([
      Mino.Z,
      Mino.L,
      Mino.O,
      Mino.S,
      Mino.I,
      Mino.J,
      Mino.T,
      ...extraBag.splice(0, extra)
    ] as const);
  };
};
