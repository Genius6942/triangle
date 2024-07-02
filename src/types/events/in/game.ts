// Also includes "replay" events
import { Game as GameTypes } from "../../../types";

export interface Game {
  "game.ready": GameTypes.Ready;
  "game.abort": void;
  "game.match": {
    refereedata: {
      ft: number;
      wb: number;
      modename: string;
    };
    leaderboard: GameTypes.Leaderboard[];
  };
  "game.start": void;
  "game.score": {
    refereedata: { ft: number; wb: number; modename: string };
    leaderboard: GameTypes.Leaderboard[];
    victor: string;
  };
  "game.end": {
    leaderboard: GameTypes.Leaderboard[];
    currentboard: GameTypes.Leaderboard[];
    xpPerUser: number;
  };
  "game.replay.state": {
    gameid: string;
    data: "wait";
  };

  "game.ige": GameTypes.IGE[];
  "game.replay.board": {
    gameid: string;
    board: {
      /** Board state */
      b: GameTypes.BoardSquare[][];
      // TODO: what is this
      f: number;
      // TODO: what is this
      g: number;
      /** Board width */
      w: number;
      /** Board height */
      h: number;
    };
  }[];
  replay: {
    gameid: string;
    frames: GameTypes.Replay.Frame[];
    provisioned: number;
  };
}
