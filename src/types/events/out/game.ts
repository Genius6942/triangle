import { Game as GameTypes } from "../../../types";

export interface Game {
  "game.scope.start": string;

  replay: {
    gameid: string;
    frames: GameTypes.Replay.Frame[];
    provisioned: number;
  };
}
