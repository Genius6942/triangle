import { Game, User } from "../../types";

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
};

export interface ClientUser {
  id: string;
  username: string;
  role: User.Role;
  sessionID: string;
  userAgent: string;
}
