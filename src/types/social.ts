import { User } from "./user";

export namespace Social {
  export type Status = "online" | "away" | "busy" | "offline";

  export type Detail =
    | ""
    | "menus"
    | "40l"
    | "blitz"
    | "zen"
    | "custom"
    | "lobby_end:X-QP"
    | "lobby_spec:X-QP"
    | "lobby_ig:X-QP"
    | "lobby:X-QP"
    | "lobby_end:X-PRIV"
    | "lobby_spec:X-PRIV"
    | "lobby_ig:X-PRIV"
    | "lobby:X-PRIV"
    | "tl_mm"
    | "tl"
    | "tl_end"
    | "tl_mm_complete";

  export interface DM {
    data: {
      content: string;
      content_safe: string;
      user: string;
      userdata: {
        role: User.Role;
        supporter: boolean;
        supporter_tier: number;
        verified: boolean;
      };
      system: boolean;
    };
    stream: string;
    ts: Date;
    id: string;
  }

  export type NotificationType =
    | "friend"
    | "pending"
    | "noop_forfeit_notice"
    | "announcement"
    | "supporter_new"
    | "supporter_gift"
    | "";

  export interface Notification {
    _id: string;
    data: {
      relationship: {
        _id: string;
        from: {
          _id: string;
          username: string;
          avatar_revision: number;
        };
        to: {
          _id: string;
          username: string;
          avatar_revision: number;
        };
        type: NotificationType;
        unread: number;
        updated: string;
      };
      ismutual?: boolean;
    };
    seen: boolean;
    stream: string;
    ts: string;
    type: string;
  }

  export type RelationshipType = "friend" | "block" | "pending";
  export interface Relationship {
    _id: string;
    from: {
      _id: string;
      username: string;
      avatar_revision: number;
    };
    to: {
      _id: string;
      username: string;
      avatar_revision: number;
    };
    type: Social.RelationshipType;
    unread: number;
    updated: string;
  }

  export interface Interaction {
    id: string;
    relationshipID: string;
    username: string;
    avatar: number;
    dm: (content: string) => Promise<void>;
		markAsRead: () => void;
    dms: DM[];
    invite: () => Promise<void>;
  }

  export interface Blocked {
    id: string;
    username: string;
    avatar: number;
  }
}
