import { Events, Social as SocialTypes } from "../../types";
import type { Client } from "../client";
import { APITypes } from "../../utils";

interface SocialInitData {
  online: number;
  notifications: SocialTypes.Notification[];
  friends: SocialTypes.Interaction[];
  other: SocialTypes.Interaction[];
  blocked: SocialTypes.Blocked[];
}

export class Social {
  private client: Client;

  /** The current number of people online */
  public online: number;
  /** List of the client's friends */
  public friends: SocialTypes.Interaction[];
  /** List of "pending" relationships (shows in `other` tab on TETR.IO) */
  public other: SocialTypes.Interaction[];
  /** people you block */
  public blocked: SocialTypes.Blocked[];
  /** Notifications */
  public notifications: SocialTypes.Notification[];

  /** @hideconstructor */
  private constructor(client: Client, init: SocialInitData) {
    this.client = client;

    this.init();
    this.online = init.online;
    this.friends = init.friends.map((r) => ({
      ...r,
      dm: async (content: string) => {
        await this.dm(r.id, content);
      },
      invite: async () => await this.invite({ id: r.id })
    }));
    this.other = init.other.map((r) => ({
      ...r,
      dm: async (content: string) => {
        await this.dm(r.id, content);
      },
      invite: async () => await this.invite({ id: r.id })
    }));
    this.blocked = init.blocked;
    this.notifications = init.notifications;
  }

  static async create(
    client: Client,
    initData: Events.in.Client["client.ready"]["social"]
  ) {
    const data: SocialInitData = {
      online: initData.total_online,
      notifications: initData.notifications,
      friends: await Promise.all(
        initData.relationships
          .filter((r) => r.type === "friend")
          .map(async (r) => ({
            id: r.to._id,
            relationshipID: r._id,
            username: r.to.username,
            avatar: r.to.avatar_revision,
            dm: async () => {},
            dms: await client.api.social.dms(r.to._id),
            invite: async () => {}
          }))
      ),
      other: await Promise.all(
        initData.relationships
          .filter((r) => r.type === "pending")
          .map(async (r) => ({
            id: r.to._id,
            relationshipID: r._id,
            username: r.to.username,
            avatar: r.to.avatar_revision,
            dm: async () => {},
            dms: await client.api.social.dms(r.to._id),
            invite: async () => {}
          }))
      ),

      blocked: initData.relationships
        .filter((r) => r.type === "block")
        .map((r) => ({
          id: r.to._id,
          username: r.to.username,
          avatar: r.to.avatar_revision
        }))
    };

    return new Social(client, data);
  }

  private get api() {
    return this.client.api;
  }

  private init() {
    this.client.on("social.online", (count) => {
      this.online = count;
    });

    this.client.on("social.notification", (n) =>
      this.notifications.splice(0, 0, n)
    );

    this.client.on("social.dm", async (dm) => {
      const user = this.get({ id: dm.data.user });
      if (user) user.dms.push(dm);
      else {
        const u = await this.who(dm.data.user);
        this.other.push({
          id: dm.data.user,
          username: u.username,
          avatar: u.avatar_revision,
          dm: async (content: string) => {
            await this.dm(u._id, content);
          },
          dms: await this.api.social.dms(u._id),
          relationshipID: "",
          invite: async () => await this.invite({ id: u._id })
        });
      }
    });
  }

  /**
   * Get a user + social data from the list of users and pending friends (OTHER tab in TETR.IO)
   * @example
   * const user = await client.social.get('halp')
   * @example
   * const user = await client.social.get('646f633d276f42a80ba44304');
   * @example
   * const user = await client.social.get({ username: 'halp' });
   * @example
   * const user = await client.social.get({ id: '646f633d276f42a80ba44304 });
   * @example
   * // You can then use the object to read user data and interact with the user
   * await user.dm('wanna play?');
   * await user.invite();
   */
  get(target: string): SocialTypes.Interaction | null;
  get(target: { id: string }): SocialTypes.Interaction | null;
  get(target: { username: string }): SocialTypes.Interaction | null;
  get(
    target: string | { id: string } | { username: string }
  ): SocialTypes.Interaction | null {
    if (typeof target === "string")
      return (
        this.friends.find((r) => r.id === target || r.username === target) ||
        this.other.find((r) => r.id === target || r.username === target) ||
        null
      );
    else if ("id" in target)
      return (
        this.friends.find((r) => r.id === target.id) ||
        this.other.find((r) => r.id === target.id) ||
        null
      );
    else
      return (
        this.friends.find((r) => r.username === target.username) ||
        this.other.find((r) => r.username === target.username) ||
        null
      );
  }

  /** Get a users' information based on their userid or username
   * @example
   * const user = await client.social.who({ username: "halp" });
   * @example
   * // halp's id
   * const user = await client.social.who("646f633d276f42a80ba44304");
   */
  who(id: string): Promise<APITypes.Users.User>;
  who(target: { username: string }): Promise<APITypes.Users.User>;
  async who(
    target: string | { username: string }
  ): Promise<APITypes.Users.User> {
    if (typeof target === "string") return this.api.users.get({ id: target });
    else return this.api.users.get(target);
  }

  /**
   * Send a message to a specified user (based on id)
   * @example
   * await client.social.dm('646f633d276f42a80ba44304', 'what\'s up?');
   */
  async dm(userID: string, message: string) {
    return await this.client.wrap(
      "social.dm",
      {
        recipient: userID,
        msg: message
      },
      "social.dm"
    );
  }

  /**
   * Send a user a friend request
   * @example
   * await client.social.friend({ username: 'halp' });
   * @example
   * await client.social.friend({ id: '646f633d276f42a80ba44304' });
   */
  async friend(user: { username: string } | { id: string }) {
    let id: string;
    if ("username" in user) id = await this.api.users.resolve(user.username);
    else id = user.id;

    await this.api.social.friend(id);
  }

  /**
   * Invite a user to your room
   * @example
   * await client.social.invite({ username: 'halp' });
   * @example
   * await client.social.invite({ id: '646f633d276f42a80ba44304' });
   */
  async invite(user: { username: string } | { id: string }) {
    let id: string;
    if ("username" in user) id = await this.api.users.resolve(user.username);
    else id = user.id;

    this.client.emit("social.invite", id);
  }

  /**
   * Set the client's status
   * @example
   * client.social.status('online', 'lobby:X-QP');
   */
  status(status: SocialTypes.Status, detail: SocialTypes.Detail | String = "") {
    this.client.emit("social.presence", { status, detail });
  }
}
