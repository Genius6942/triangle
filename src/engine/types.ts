import type {
  Board,
  Engine,
  GarbageQueueSnapshot,
  Mino,
  OutgoingGarbage,
	TetrominoSnapshot
} from ".";
import { Game } from "../types";
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
  falling: TetrominoSnapshot;
  lastSpin: Engine["lastSpin"];
  lastWasClear: boolean;
  garbage: GarbageQueueSnapshot;
  board: Board["state"];
  targets?: number[];
  stats: Engine["stats"];
  glock: number;
  state: number;
  ige: IGEHandlerSnapshot;
	resCache: Engine["resCache"];
}

export interface LockRes {
  mino: Mino;
  garbageCleared: number;
  lines: number;
  spin: SpinType;
  garbage: number[];
  stats: {
    garbage: {
      sent: number;
      attack: number;
      receive: number;
      cleared: number;
    };
    combo: number;
    b2b: number;
    pieces: number;
    lines: number;
  };
  garbageAdded: false | OutgoingGarbage[];
  topout: boolean;
  /** The number of frames since the last piece was placed */
  pieceTime: number;
  keysPresses: Game.Key[];
}

export interface Events {
  /** Fired when garbage is recieved, immediately after it is added to the garbage queue */
  "garbage.receive": {
    /** The garbage's interaction id */
    iid: number;
    /** The amount added to the garbage queue after passthrough canceling */
    amount: number;
    /** The original amount recieved before passthrough cancelling */
    originalAmount: number;
  };
  /** Fired when garbage is confirmed (interaction_confirm ige). This starts the cancel timer (usually 20 frames) */
  "garbage.confirm": {
    /** The garbage's interaction id */
    iid: number;
    /** The sender's game id */
    gameid: number;
    /** The frame to start timer at */
    frame: number;
  };
  /** Fired immediately after garbage is tanked. */
  "garbage.tank": {
    /** The garbage's interaction id */
    iid: number;
    /** The garbage's spawn column (0-indexed) */
    column: number;
    /** The height of the garbage column */
    amount: number;
    /** The width of the garbage column */
    size: number;
  };
  /** Fired immediately after garbage is cancelled. */
  "garbage.cancel": {
    /** The garbage's interaction id */
    iid: number;
    /** The amount of garbage that was cancelled */
    amount: number;
    /** The width of the would-be garbage */
    size: number;
  };

  /** Fired whenever a piece locks. */
  "falling.lock": LockRes;

  /** Fired whenever a new set of pieces is added to the queue. */
  "queue.add": Mino[];
}
