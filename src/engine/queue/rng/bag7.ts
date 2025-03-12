import { RNG } from "../../utils";
import { Mino } from "../types";

export const bag7 = (seed: number) => {
  const gen = new RNG(seed);
  return () => gen.shuffleArray(["z", "l", "o", "s", "i", "j", "t"] as Mino[]);
};
