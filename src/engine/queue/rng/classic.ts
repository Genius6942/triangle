import { RNG } from "../../utils";
import { Mino } from "../types";

export const classic = (seed: number) => {
  const TETROMINOS: Mino[] = [
    Mino.Z,
    Mino.L,
    Mino.O,
    Mino.S,
    Mino.I,
    Mino.J,
    Mino.T
  ];
  let lastGenerated: number | null = null;
  const gen = new RNG(seed);

  return () => {
    let index = Math.floor(gen.nextFloat() * (TETROMINOS.length + 1));

    if (index === lastGenerated || index >= TETROMINOS.length) {
      index = Math.floor(gen.nextFloat() * TETROMINOS.length);
    }

    lastGenerated = index;
    return [TETROMINOS[index]];
  };
};
