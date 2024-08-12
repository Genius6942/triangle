import { API, CONSTANTS, parseToken } from "../../utils";
import { ClientUser, ClientOptions } from "./types";
import { Game as GameTypes, Events } from "../../types";
import { Ribbon } from "../ribbon";
import { Social } from "../social";
import { ClientUtils } from "../utils";
import { Room } from "../room";
import { Game } from "../game";

export type * from "./types";

export class Client {
  /** User information */
  public user: ClientUser;
  /**
   * Utils for the client.
   * @deprecated - functionality has been moved to other sections. This may be removed in the future.
   */
  public utils: ClientUtils;
  /** The client's token */
  public token: string;
  /** @hidden */
  private _handling: GameTypes.Handling;

  /** Raw ribbon client, the backbone of TETR.IO multiplayer. You probably don't want to touch this unless you know what you are doing. */
  public ribbon: Ribbon;
  /** A helpful manager for all things social on TETR.IO (friends, dms etc.) */
  public social!: Social;
  /** The room the client is in (if it is in a room). You can make it non-nullable with `client.room!` */
  public room?: Room;
  /** The game the client is currently in if it is in a game. */
  public game?: Game;

  /** Useful for connecting to the main game API when none of the client helpers have the request you want to send. You can use `client.api.get` and `client.api.post` to easily send GET and POST requests. */
  public api: API;

  public rooms: {
    list(): ReturnType<API["rooms"]>;
    join(id: string): Promise<Room>;
    create(type?: "public" | "private"): Promise<Room>;
  };

  /**
   * Raw ribbon handler.
   * @example
   * client.on('social.dm', () => console.log('DM recieved!'));
   */
  public on: typeof this.ribbon.emitter.on;
  /** Raw ribbon handler. */
  public off: typeof this.ribbon.emitter.off;
  /** Raw ribbon handler. You likely want to use `client.wait` instead. */
  public once: typeof this.ribbon.emitter.once;
  /** Raw ribbon handler for sending messages. */
  public emit: typeof this.ribbon.emit;

  /** @hideconstructor */
  private constructor(
    token: string,
    sessionID: string,
    ribbon: Ribbon,
    me: Awaited<ReturnType<API["users"]["me"]>>,
    userAgent: string = CONSTANTS.userAgent,
    handling: GameTypes.Handling
  ) {
    this.token = token;
    this.ribbon = ribbon;
    this.on = ribbon.emitter.on.bind(ribbon.emitter);
    this.off = ribbon.emitter.off.bind(ribbon.emitter);
    this.once = ribbon.emitter.once.bind(ribbon.emitter);
    this.emit = ribbon.emit.bind(ribbon);

    this.ribbon.on("send", (data) => this.emit("client.ribbon.send", data));
    this.ribbon.on("receive", (data) =>
      this.emit("client.ribbon.receive", data)
    );

    this.ribbon.on;

    this.user = {
      id: me._id,
      role: me.role,
      sessionID,
      username: me.username,
      userAgent
    };

    this._handling = handling;

    this.utils = new ClientUtils(this);

    this.api = new API({ token: this.token, userAgent });

    this.rooms = {
      list: () => this.api.rooms(),
      join: async (id: string) => {
        await this.wrap("room.join", id.toUpperCase(), "room.update");
        return await new Promise((r) => setTimeout(() => r(this.room!), 0));
      },
      create: async (type = "private") => {
        await this.wrap("room.create", type === "public", "room.update");
        return await new Promise((r) => setTimeout(() => r(this.room!), 0));
      }
    };

    this.init();
  }

  /**
   * Create a new client
   * @example
   * const client = await Client.connect({ token: 'your.jwt.token' });
   * @example
   * const client = await Client.connect({ username: 'halp', password: 'password' });
   * @example
   * // If playing games, pass in handling
   * const client = await Client.connect({
   *   // ...login info
   *   handling: {
   *     arr: 0,
   *     cancel: false,
   *     das: 5,
   *     dcd: 0,
   *     safelock: false,
   *     may20g: true,
   *     sdf: 41
   *   };
   * });
   * @example
   * // You can pass in a custom user agent
   * const client = await Client.connect({
   *   // ...login info
   *   userAgent: "v8/001"
   * });
   */
  static async connect(options: ClientOptions) {
    const api = new API();
    if (options.userAgent) {
      api.update({ userAgent: options.userAgent });
    }
    if (options.turnstile) {
      api.update({ turnstile: options.turnstile });
    }

    const sessionID = `SESS-${Math.floor(
      Math.random() * Number.MAX_SAFE_INTEGER
    )}`;
    let self: { id: string; token: string };
    if ("token" in options) {
      self = {
        token: options.token,
        id: parseToken(options.token)
      };
    } else if ("username" in options) {
      self = await api.users.authenticate(options.username, options.password);
    } else {
      throw new Error("Invalid client options");
    }

    const token = self.token;

    api.update({ token });

    const handling = options.handling || {
      arr: 0,
      cancel: false,
      das: 5,
      dcd: 0,
      safelock: false,
      may20g: true,
      sdf: 41
    };

    const ribbon = new Ribbon({
      token,
      handling,
      userAgent: options.userAgent || CONSTANTS.userAgent
    });

    await ribbon.connect();

    const data = await new Promise<Events.in.Client["client.ready"]>(
      (resolve, reject) => {
        setTimeout(() => reject("Failed to connect"), 5000);
        ribbon.emitter.once("client.ready", (d) => {
          if (d) resolve(d);
        });
      }
    );

    const client = new Client(
      token,
      sessionID,
      ribbon,
      await api.users.me(),
      options.userAgent || CONSTANTS.userAgent,
      handling
    );

    client.social = await Social.create(client, data.social);

    return client;
  }

  /**
   * Wait for an event to occur. Wraps `client.once` into a typed Promise.
   * @returns the data from the event
   * @example
   * // wait for a notification (although you probably want to use `client.on` for this instead)
   * console.log(await client.wait('social.notification'));
   */
  wait<T extends keyof Events.in.all>(event: T) {
    return new Promise<Events.in.all[T]>((resolve) =>
      this.once(event, resolve)
    );
  }

  /**
   * Send a message and then wait for another message. Throws an error if a 'err' message is recieved before the response message
   * @param event - the `command` of the event to send
   * @param data - the data to send along with the command. For void (no) data, just pass in `undefined`
   * @param listen - the event to wait for before resolving.
   * @returns the data sent by the `listen` event
   * @throws an error if the 'err' message is recieved from TETR.IO
   * @example
   * // This is just for example, use `client.room!.chat` instead
   * await client.wrap('room.chat', { content: 'Hello', pinned: false }, 'room.chat');
   */
  wrap<O extends keyof Events.out.all, I extends keyof Events.in.all>(
    event: O,
    data: Events.out.all[O],
    listen: I
  ) {
    return new Promise<Events.in.all[I]>((resolve, reject) => {
      const disband = () => {
        this.off(listen, rs);
        this.off("error", rj);
        this.off("err", rj);
      };
      const rs = (data: Events.in.all[I]) => {
        disband();
        resolve(data);
      };

      const rj = (error: string) => {
        disband();
        reject(error);
      };

      this.once(listen, rs);
      this.once("error", rj);
      this.once("err", rj);

      // @ts-expect-error
      this.emit(event, data);
    });
  }

  /** @hidden */
  private init() {
    this.on("room.join", async () => {
      const data = await this.wait("room.update");
      this.room = new Room(this, data);
    });
  }

  /** The bot's current handling */
  get handling() {
    return this._handling;
  }

  /** Change the bot's current room (do not use in room) */
  set handling(handling: GameTypes.Handling) {
    if (this.room)
      throw new Error(
        "Do not set the handling in a room (you will be banned)!"
      );
    this._handling = handling;
    this.emit("config.handling", handling);
  }

  /** Clean up the client */
  async destroy() {
    if (this.room) await this.room.leave();
    await this.ribbon.destroy();
  }
}
