import { rng } from ".";
import { Piece } from "../types";

export const random = (seed: number) => {
  const gen = rng(seed);
  return () => {
    const TETROMINOS: Piece[] = ["Z", "L", "O", "S", "I", "J", "T"];
    return [TETROMINOS[Math.floor(gen.nextFloat() * TETROMINOS.length)]];
  };
};
