import { rng } from ".";
import { Piece } from "../types";

export const bag7_2 = (seed: number): (() => Piece[]) => {
  const gen = rng(seed);
	return () =>
		gen.shuffleArray([
			"z",
			"l",
			"o",
			"s",
			"i",
			"j",
			"t",
			(["z", "l", "o", "s", "i", "j", "t"] as const)[
				Math.floor(gen.nextFloat() * 7)
			],
			(["z", "l", "o", "s", "i", "j", "t"] as const)[
				Math.floor(gen.nextFloat() * 7)
			]
		] as const);
};
