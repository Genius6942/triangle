import { Game as GameTypes } from "../../../types";

export interface Game {
  "game.scope.start": number;

  "game.scope.end": number;

  "game.spectate": void;

  "game.replay": {
    gameid: number;
    frames: GameTypes.Replay.Frame[];
    provisioned: number;
  };
}
