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
  "game.advance": {
    scoreboard: {
      id: string;
      username: string;
      active: boolean;
      naturalorder: number;
      shadows: [];
      shadowedBy: [null, null];
      alive: boolean;
      lifetime: number;
      stats: {
        apm: number;
        pps: number;
        vsscore: number;
        garbagesent: number;
        garbagereceived: number;
        kills: 1;
        altitude: 0;
        rank: 1;
        targetingfactor: 3;
        targetinggrace: 0;
      };
    }[];
  };
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
    gameid: number;
    data: "wait";
  };

  "game.replay.ige": {
    gameid: number;
    iges: GameTypes.IGE[];
  };

  "game.replay.board": {
    boards: {
      0: {
        board: {
          /** Board state */
          b: GameTypes.BoardSquare[][];
          /** Frame number or turn */
          f: number;
          /** Game status or flag */
          g: number;
          /** Board width */
          w: number;
          /** Board height */
          h: number;
        };
        gameid: number;
      };
      1: {
        board: {
          /** Board state */
          b: GameTypes.BoardSquare[][];
          /** Frame number or turn */
          f: number;
          /** Game status or flag */
          g: number;
          /** Board width */
          w: number;
          /** Board height */
          h: number;
        };
        gameid: number;
      };
    };
  };
  "game.replay": {
    gameid: number;
    provisioned: number;
    frames: GameTypes.Replay.Frame[];
  };
  "game.replay.end": {
    gameid: number;
    data: {
      gameoverreason: GameTypes.GameOverReason;
      killer: { gameid: number; type: "sizzle"; username: null | string };
    };
  };
}
