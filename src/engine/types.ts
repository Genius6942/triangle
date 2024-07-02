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

export type Frame = {
  frame: number;
} & (
  | {
      type: "ige";
      data: {
        id: number;
        frame: number;
        type: "ige";
        data: { frame: number } & (
          | {
              type: "target";
              targets: string[];
            }
          | {
              type: "allow_targeting";
              value: boolean;
            }
          | {
              type: "interaction" | "interaction_confirm";
              gameid: string;
              data: {
                type: "garbage";
                iid: number;
                amt: number;
                ackiid: number;
                x: number;
                y: number;
                size: number;
                username: string;
              }; // TODO: complete this also
              cid: number;
            }
        ); // TODO: complete this
      };
    }
  | {
      type: "keydown";
      data: {
        key: KeyPress;
        subframe: number;
        hoisted?: boolean;
      };
    }
  | {
      type: "keyup";
      data: {
        key: KeyPress;
        subframe: number;
      };
    }
);

export interface IncreasableValue {
  value: number;
  increase: number;
  marginTime: number;
}
