import { Mino } from "../types";
import { bag7 } from "./bag7";
import { bag7_1 } from "./bag7-1";
import { bag7_2 } from "./bag7-2";
import { bag7_X } from "./bag7-x";
import { bag14 } from "./bag14";
import { classic } from "./classic";
import { pairs } from "./pairs";
import { random } from "./random";

export type BagType =
  | "7-bag"
  | "14-bag"
  | "classic"
  | "pairs"
  | "total mayhem"
  | "7+1-bag"
  | "7+2-bag"
  | "7+x-bag";
export type RngInnerFunction = () => Mino[];
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
