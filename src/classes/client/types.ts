import { Game, User } from "../../types";
import { CodecType } from "../ribbon/codec";

export type ClientOptions = (
  | {
      token: string;
    }
  | {
      username: string;
      password: string;
    }
) & {
  handling?: Game.Handling;
  userAgent?: string;
  /** a cf_clearance Cloudflare turnstile token. */
  turnstile?: string;
  ribbon?: {
    codec?: CodecType;
    verbose?: boolean;
    globalVM?: boolean;
		spooling?: boolean;
  };
};

export interface ClientUser {
  id: string;
  username: string;
  role: User.Role;
  sessionID: string;
  userAgent: string;
}
