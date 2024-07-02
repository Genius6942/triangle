import { Piece } from "../../queue/types";
import { BoardSquare } from "../../board";
import { Rotation } from "../tetromino/types";
import { kicks } from "./data";

export type KickTable = keyof typeof kicks;

export const legal = (blocks: [number, number][], board: BoardSquare[][]) => {
  if (board.length === 0) return false;
  for (const block of blocks) {
    if (block[0] < 0) return false;
    if (block[0] >= board[0].length) return false;
    if (block[1] < 0) return false;
    if (board[block[1]][block[0]]) return false;
  }

  return true;
};

export const performKick = (
  kicktable: KickTable,
  piece: Piece,
  pieceLocation: [number, number],
  blocks: [number, number][],
  startRotation: Rotation,
  endRotation: Rotation,
  board: BoardSquare[][]
): { kick: [number, number]; id: string; index: number } | boolean => {
  if (
    legal(
      blocks.map((block) => [
        pieceLocation[0] + block[0],
        pieceLocation[1] - block[1]
      ]),
      board
    )
  )
    return true;

  const kickID = `${startRotation}${endRotation}`;
  const table = kicks[kicktable];
  const customKicksetID = `${piece.toLowerCase()}_kicks` as keyof typeof table;
  const kickset: [number, number][] =
    customKicksetID in table
      ? table[customKicksetID][
          kickID as keyof (typeof table)[typeof customKicksetID]
        ]
      : (table.kicks[kickID as keyof typeof table.kicks] as [number, number][]);

  for (let i = 0; i < kickset.length; i++) {
    const [dx, dy] = kickset[i];
    if (
      legal(
        blocks.map((block) => [
          pieceLocation[0] + block[0] + dx,
          pieceLocation[1] - block[1] - dy
        ]),
        board
      )
    ) {
      return {
        kick: [dx, -dy],
        id: kickID,
        index: i
      };
    }
  }

  return false;
};
