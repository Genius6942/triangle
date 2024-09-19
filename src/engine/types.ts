import { Board } from "./board";
import { GarbageQueue } from "./garbage";
import { Piece } from "./queue";

export type SpinType = "none" | "mini" | "normal";

export interface EngineCheckpoint {
  garbage: GarbageQueue["queue"];
  queue: number;
  board: Board["state"];
  falling: Piece;
  b2b: number;
  combo: number;
}

export type KeyPress =
  | "rotateCW"
  | "rotateCCW"
  | "rotate180"
  | "moveLeft"
  | "moveRight"
  | "dasLeft"
  | "dasRight"
  | "hold"
  | "hardDrop"
  | "softDrop";

export interface Handling {
  arr: number;
  das: number;
  dcd: number;
  sdf: number;
  safelock: boolean;
  cancel: boolean;
  may20g: boolean;
}

export interface IncreasableValue {
  value: number;
  increase: number;
  marginTime: number;
}
