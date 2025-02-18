import { rng } from ".";
import { Mino } from "../types";

export const random = (seed: number) => {
  const gen = rng(seed);
  return () => {
    const TETROMINOS: Mino[] = [
      Mino.Z,
      Mino.L,
      Mino.O,
      Mino.S,
      Mino.I,
      Mino.J,
      Mino.T
    ];
    return [TETROMINOS[Math.floor(gen.nextFloat() * TETROMINOS.length)]];
  };
};
