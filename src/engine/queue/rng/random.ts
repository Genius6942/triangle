import { rng } from ".";
import { Piece } from "../types";

export const random = (seed: number) => {
  const gen = rng(seed);
  return () => {
		const TETROMINOS: Piece[] = ["z", "l", "o", "s", "i", "j", "t"];
    return [TETROMINOS[Math.floor(gen.nextFloat() * TETROMINOS.length)]];
  };
};
