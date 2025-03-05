import type { Board, Engine, GarbageQueueSnapshot, Mino } from ".";
import { IGEHandlerSnapshot } from "./multiplayer";
import type { Rotation } from "./utils/tetromino/types";

export type SpinType = "none" | "mini" | "normal";

export interface IncreasableValue {
  value: number;
  increase: number;
  marginTime: number;
}

export interface EngineSnapshot {
  frame: number;
  subframe: number;
  queue: number;
  hold: Mino | null;
  holdLocked: boolean;
  input: Engine["input"];
  falling: {
    symbol: Mino;
    location: [number, number];
    locking: number;
    lockResets: number;
    rotResets: number;
    safeLock: number;
    highestY: number;
    rotation: Rotation;
    fallingRotations: number;
    totalRotations: number;
    irs: number;
    ihs: boolean;
    aox: number;
    aoy: number;
    keys: number;
  };
  lastSpin: Engine["lastSpin"];
  garbage: GarbageQueueSnapshot;
  board: Board["state"];
  targets?: number[];
  stats: Engine["stats"];
  glock: number;
  state: number;
  ige: IGEHandlerSnapshot;
}
