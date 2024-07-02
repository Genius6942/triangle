//i have no idea if this works or not, mr dinglebot man help
import { rng } from ".";
import { Piece } from "../types";

export const bag7plusX = (seed: number) => {
  const gen = rng(seed);
  return () => {
    let bag = gen.shuffleArray(["Z", "L", "O", "S", "I", "J", "T"] as Piece[]);
    let result = [];
    let bagSizes = [10, 9, 8, 8]; // total pieces in each bag for the first 4 bags

    for (let i = 0; i < 4; i++) {
      let tempBag = [...bag];
      for (let j = 7; j < bagSizes[i]; j++) {
        tempBag.push(bag[Math.floor(gen.nextFloat() * bag.length)]);
      }
      result.push(...gen.shuffleArray(tempBag));
    }

    // revert back to standard 7-bag
    for (let i = 4; i < 7; i++) {
      result.push(...gen.shuffleArray([...bag]));
    }

    return result;
  };
};
