import { Social } from "../../social";
import { Client } from "./client";

export interface Ribbon {
  session: {
    ribbonid: string;
    tokenid: string;
  };

  ping: {
    recvid: number;
  };

  "server.authorize": {
    success: boolean;
    maintenance: boolean;
    worker: {
      name: string;
      flag: string;
    };
    social: {
      total_online: number;
      notifications: Social.Notification[];
      presences: {
        [userId: string]: {
          status: string;
          detail: string;
          invitable: boolean;
        };
      };
      relationships: Social.Relationship[];
    };
  };

  "server.migrate": {
    endpoint: string;
  };

  "server.migrated": {};

  kick: {
    reason: string;
  };

  nope: {
    reason: string;
  };

  error: any;
  err: any;

  notify:
    | {
        type: "err" | "warn" | "ok" | "announce";
        msg: string;
      }
    | {
        type: "deny";
        msg: string;
        timeout?: number;
      }
    | Client["client.notify"]
    | string;
}
