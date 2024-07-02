import { rng } from ".";
import { Piece } from "../types";

export const classic = (seed: number) => {
  const TETROMINOS: Piece[] = ["Z", "L", "O", "S", "I", "J", "T"];
  let lastGenerated: number | null = null;
  const gen = rng(seed);

  return () => {
    let index = Math.floor(gen.nextFloat() * (TETROMINOS.length + 1));

    if (index === lastGenerated || index >= TETROMINOS.length) {
      index = Math.floor(gen.nextFloat() * TETROMINOS.length);
    }

    lastGenerated = index;
    return [TETROMINOS[index]];
  };
};
