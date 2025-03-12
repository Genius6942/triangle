import { RNG } from "../../utils";
import { Mino } from "../types";

export const bag7_1 = (seed: number): (() => Mino[]) => {
  const gen = new RNG(seed);
  return () =>
    gen.shuffleArray([
      Mino.Z,
      Mino.L,
      Mino.O,
      Mino.S,
      Mino.I,
      Mino.J,
      Mino.T,
      ([Mino.Z, Mino.L, Mino.O, Mino.S, Mino.I, Mino.J, Mino.T] as const)[
        Math.floor(gen.nextFloat() * 7)
      ]
    ] as const);
};
