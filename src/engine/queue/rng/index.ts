import { Piece } from "../types";
import { bag14 } from "./bag14";
import { bag7 } from "./bag7";
import { classic } from "./classic";
import { pairs } from "./pairs";
import { random } from "./random";
import { bag7_1 } from "./bag7-1";
import { bag7_2 } from "./bag7-2";
import { bag7_X } from "./bag7-x";

export const rng = (seed: number) => {
  let t = seed % 2147483647;

  if (t <= 0) {
    t += 2147483646;
  }

  return {
    next: function () {
      return (t = (16807 * t) % 2147483647);
    },
    nextFloat: function () {
      return (this.next() - 1) / 2147483646;
    },
    shuffleArray: function <T extends any[]>(array: T) {
      if (array.length == 0) {
        return array;
      }

      for (let i = array.length - 1; i != 0; i--) {
        const r = Math.floor(this.nextFloat() * (i + 1));
        [array[i], array[r]] = [array[r], array[i]];
      }

      return array;
    }
  };
};

export type BagType =
  | "7-bag"
  | "14-bag"
  | "classic"
  | "pairs"
  | "total mayhem"
  | "7+1-bag"
  | "7+2-bag"
  | "7+x-bag";
export type RngInnerFunction = () => Piece[];
export type RngFunction = (seed: number) => RngInnerFunction;

export const rngMap: { [k in BagType]: RngFunction } = {
  "7-bag": bag7,
  "14-bag": bag14,
  classic: classic,
  pairs: pairs,
  "total mayhem": random,
  "7+1-bag": bag7_1,
  "7+2-bag": bag7_2,
  "7+x-bag": bag7_X
};

export * from "./bag7";
export * from "./bag14";
export * from "./classic";
export * from "./pairs";
export * from "./random";
export * from "./bag7-1";
export * from "./bag7-2";
export * from "./bag7-x";
