import { Board, Engine, GarbageQueue, Mino } from ".";
import { Rotation } from "./utils/tetromino/types";

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
  shift: {
    l: Engine["input"]["lShift"];
    r: Engine["input"]["rShift"];
  };
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
  garbage: {
    queue: GarbageQueue["queue"];
    sent: number;
    seed: number;
  };
	board: Board['state'];
}
