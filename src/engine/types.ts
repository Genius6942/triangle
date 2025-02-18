import { Board } from "./board";
import { GarbageQueue } from "./garbage";
import { Mino } from "./queue";

export type SpinType = "none" | "mini" | "normal";

export interface EngineCheckpoint {
  garbage: GarbageQueue["queue"];
  queue: number;
  board: Board["state"];
  falling: Mino;
  b2b: number;
  combo: number;
}

export interface IncreasableValue {
  value: number;
  increase: number;
  marginTime: number;
}
