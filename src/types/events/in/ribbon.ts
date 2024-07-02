import { Social } from "../../social";

export interface Ribbon {
  authorize: {
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

  migrate: {
    endpoint: string;
  };

  kick: {
    reason: string;
  };

  error: any;
  err: any;

  notify: {
    msg: string;
    color: string;
    icon: string;
    timeout?: number;
  };
}
