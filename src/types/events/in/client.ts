import { Relationship, Room as RoomClass } from "../../../classes";
import { Engine } from "../../../engine";
import { Game, Room } from "../../../types";
import { Game as GameEvents } from "./game";
import { Ribbon } from "./ribbon";

export type Hex = `#${string}`;

export interface Client {
  /** Fires inside Client.create(), will never fire afterwards. */
  "client.ready": {
    endpoint: string;
    social: Ribbon["server.authorize"]["social"];
  };
  /** Fires when recieving an "err" notification. Data is the "msg" of the notification */
  "client.error": string;
  /** Fires when the client dies. */
  "client.dead": string;
  /**
   * Fires when the websocket closes.
   * Note: the websocket might just be migrating, to check for a fully disconnected client, use `client.dead`
   */
  "client.close": string;

  /** Any notification popup */
  "client.notify": {
    msg: string;
    timeout?: number;
    subcolor?: Hex;
    fcolor?: Hex;
    color?: Hex;
    bgcolor?: Hex;
    icon?: string;
    subicon?: string;
    header?: string;
    classes?: string;
    buttons?: { icon?: string; label: string; classes?: string }[];
    id?: string;
  };

  /** Fires whenever the players state changes. */
  "client.room.players": Room.Player[];

  /** Fires when the client joins a room */
  "client.room.join": RoomClass;

  /** Fires when a game starts */
  "client.game.start": (
    | { multi: false }
    | { multi: true; ft: number; wb: number }
  ) & {
    players: { id: string; name: string; points: 0 }[];
  };

  /** Fires when a round starts (this includes 1-round games) */
  "client.game.round.start": [
    (cb: Game.Tick.Func) => void,
    Engine,
    { name: string; gameid: number; engine: Engine }[]
  ];
  /** Fires when the client's game ends (topout). Finish = game.replay.end, abort = game.abort, end = game.end or game.advance or game.score */
  "client.game.over":
    | {
        reason: "finish";
        data: GameEvents["game.replay.end"]["data"];
      }
    | {
        reason: "abort";
      }
    | {
        reason: "end";
      }
    | {
        reason: "leave";
      };
  /** Fires when a round is over, sends the gameid of the winning player. */
  "client.game.round.end": string;
  /**
   * Fires when a game ends. Likely known issue:
   * @see https://github.com/tetrjs/tetr.js/issues/62
   */
  "client.game.end": {
    players: { id: string; name: string; points: number; won: boolean }[];
  };

  /** Same as game.abort */
  "client.game.abort": void;

  /** Fires when a message is recived from the server. Contains the raw data of the server message. Useful for logging, do not use for handling events for functionality. Instead, use `client.on(<event>)`. */
  "client.ribbon.receive": { command: string; data?: any };

  /** Fires when a message is sent to the server. Contains the raw data of the server message. Useful for logging. */
  "client.ribbon.send": { command: string; data?: any };

  // relationship stuff
  /** Fires whenever the client is friended */
  "client.friended": { id: string; name: string; avatar: number };

  /** Fires when a DM (direct message) has been received and AFTER any unknown data has been loaded about the user */
  "client.dm": {
    user: Relationship;
    content: string;
    reply: (message: string) => Promise<void>;
  };
}
