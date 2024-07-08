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
      invite: async () => await this.invite(r.id)
    }));
    this.other = init.other.map((r) => ({
      ...r,
      dm: async (content: string) => {
        await this.dm(r.id, content);
      },
      invite: async () => await this.invite(r.id)
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
            markAsRead: async () =>
              client.emit("social.relationships.ack", r._id),
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
            markAsRead: async () =>
              client.emit("social.relationships.ack", r._id),
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
    setTimeout(
      () =>
        this.notifications.forEach((n) => {
          if (n.type === "friend") {
            if (!n.seen) {
              this.client.emit("client.friended", {
                id: n.data.relationship.from._id,
                name: n.data.relationship.from.username,
                avatar: n.data.relationship.from.avatar_revision
              });
            }
          }
        }),
      0
    );

    this.client.on("social.online", (count) => {
      this.online = count;
    });

    this.client.on("social.notification", async (n) => {
      this.notifications.splice(0, 0, n);

      if (n.type === "friend") {
        this.client.emit("client.friended", {
          id: n.data.relationship.from._id,
          name: n.data.relationship.from.username,
          avatar: n.data.relationship.from.avatar_revision
        });

				const user = this.get({ id: n.data.relationship.from._id });

				if (!user) {
					this.other.push({
						id: n.data.relationship.from._id,
						username: n.data.relationship.from.username,
						avatar: n.data.relationship.from.avatar_revision,
						dm: async (content: string) => {
							await this.dm(n.data.relationship.from._id, content);
						},
						markAsRead: async () => this.client.emit("social.relationships.ack", n.data.relationship._id),
						dms: await this.api.social.dms(n.data.relationship.from._id),
						relationshipID: n.data.relationship._id,
						invite: async () => await this.invite(n.data.relationship.from._id)
					});
				}
      }
    });

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
          markAsRead: async () =>
            this.client.emit("social.relationships.ack", u._id),

          dms: await this.api.social.dms(u._id),

          relationshipID: "",
          invite: async () => await this.invite(u._id)
        });
      }
    });
  }

  /**
   * Marks all notifications as read
   * @example
   * client.social.markNotificationsAsRead();
   */
  markNotificationsAsRead() {
    this.client.emit("social.notifications.ack");
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

  /**
   * Get the user id given a username
   */
  async resolve(username: string) {
    return await this.api.users.resolve(username);
  }

  /** Get a users' information based on their userid or username
   * @example
   * const user = await client.social.who(client.social.resolve('halp'));
   */
  who(id: string): Promise<APITypes.Users.User>;
  async who(id: string): Promise<APITypes.Users.User> {
    return this.api.users.get({ id });
  }

  /**
   * Send a message to a specified user (based on id)
   * @example
   * await client.social.dm(client.social.resolve('halp'), 'what\'s up?');
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
   * await client.social.friend(client.social.resolve('halp'));
	 * @returns false if the user is already friended, true otherwise
	 * @throws {Error} If an error occurs (such as the user has blocked the client, etc)
   */
  async friend(userID: string) {
		if (this.friends.find((r) => r.id === userID)) return false;
    await this.api.social.friend(userID);
		this.friends.push({
			id: userID,
			username: (await this.who(userID)).username,
			avatar: (await this.who(userID)).avatar_revision,
			dm: async (content: string) => {
				await this.dm(userID, content);
			},
			markAsRead: async () => this.client.emit("social.relationships.ack", userID),
			dms: await this.api.social.dms(userID),
			relationshipID: "",
			invite: async () => await this.invite(userID)
		});

		return true;
  }

  /**
   * Unfriend a user. Note: unfriending a user will unblock them if they are blocked.
   * @example
   * await client.social.unfriend(client.social.resolve('halp'));
	 * @returns false if the user is not unfriended, true otherwise
   */
  async unfriend(userID: string) {
		if (!this.friends.find((r) => r.id === userID)) return false;
    await this.api.social.unfriend(userID);
		this.friends = this.friends.filter((r) => r.id !== userID);

		return true;
  }

  /**
   * Block a user
   * @example
   * await client.social.block(client.social.resolve('halp'));
	 * @returns false if the user is already blocked, true otherwise
   */
  async block(userID: string) {
		if (this.blocked.find((r) => r.id === userID)) return false;
    await this.api.social.block(userID);
  }

  /**
   * Unblock a user. Note: unblocking a user will unfriend them if they are friended.
   * @example
   * await client.social.unblock(client.social.resolve('halp'));
	 * @returns false if the user is not unblocked, true otherwise
   */
  async unblock(userID: string) {
		
    await this.api.social.unblock(userID);
  }

  /**
   * Invite a user to your room
   * @example
   * await client.social.invite(client.social.resolve('halp'));
   */
  async invite(userID: string) {
    this.client.emit("social.invite", userID);
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
