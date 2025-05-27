import { Engine } from "../../engine";
import { Events, Game as GameTypes } from "../../types";
import { Client } from "../client";
import { getFullFrame } from "./utils";

import chalk from "chalk";

const moveElementToFirst = <T>(arr: T[], n: number) => [
  arr[n],
  ...arr.slice(0, n),
  ...arr.slice(n + 1)
];

export class Game {
  private client: Client;
  private listeners: Parameters<typeof this.client.on>[] = [];
  private frameQueue: GameTypes.Replay.Frame[] = [];
  private incomingGarbage: (GameTypes.Replay.Frames.IGE & { frame: number })[] =
    [];
  private timeout: NodeJS.Timeout | null = null;
  private messageQueue: GameTypes.Client.Events[] = [];
  // private igeBuffer: Events.in.Game["game.replay.ige"][] = [];
  private startTime: number | null = null;
  private _target: GameTypes.Target = { strategy: "even" };
  private tick?: GameTypes.Tick.Func;
  private over = false;
	private isPractice = false;

  /** The client's engine */
  public engine!: Engine;
  /** Data on the opponents in game */
  public opponents: {
    name: string;
    gameid: number;
    userid: string;
    engine: Engine;
    queue: GameTypes.Replay.Frame[];
  }[] = [];
  /** The client's `gameid` set by the server */
  public gameid: number;
  /** The raw game config sent by TETR.IO */
  public options: GameTypes.ReadyOptions;
  /** The raw game config for all players, including the client's own game config */
  public readyData: GameTypes.Ready;
  /** The targets set by the server */
  public serverTargets: number[] = [];
  /** The gameids of the users targeting the client */
  public enemies: number[] = [];
  /** The keys the client has queued to press (allows for pressing keys in the future) */
  public keyQueue: NonNullable<GameTypes.Tick.Out["keys"]> = [];
  /** Whether or not targeting is allowed (changed by server). Setting target while this is `false` will throw an error. */
  public canTarget = true;

  /** The Frames Per Second of the TETR.IO engine */
  static fps = 60;
  /** Frames per message */
  private static fpm = 12;

  /**
   * Game stats
   * @deprecated use engine.stats instead
   */
  public stats = {
    piecesPlaced: 0
  };

  /** @hideconstructor */
  constructor(client: Client, ready: GameTypes.Ready) {
    this.client = client;

    const self = ready.players.find((p) => p.userid === client.user.id);

    if (!self) throw new Error("User not in game");
    this.gameid = self.gameid;
    this.options = self.options;
    this.readyData = ready;

    try {
      this.engine = this.createEngine(this.options, this.gameid);
    } catch (e) {
      console.error(e);
      throw e;
    }

    ready.players.forEach((player) =>
      this.client.emit("game.scope.start", player.gameid)
    );

    this.init();
  }

  #log(
    msg: string,
    { level = "info" }: { level: "info" | "warning" | "error" } = {
      level: "info"
    }
  ) {
    const func =
      level === "info"
        ? chalk.blue
        : level === "warning"
          ? chalk.yellow
          : chalk.red;
    console.log(`${func("[🎀\u2009Triangle.JS]")}: ${msg}`);
  }

  private listen<T extends keyof Events.in.all>(
    event: T,
    cb: (data: Events.in.all[T]) => void,
    once = false
  ) {
    this.listeners.push([event, cb] as any);
    if (once) {
      this.client.once(event, cb);
    } else {
      this.client.on(event, cb);
    }
  }

  /** Kill the game. This is called automatically by the Room class when a game ends/is aborted, you don't need to use this. */
  destroy(): undefined {
    this.listeners.forEach((l) => this.client.off(l[0], l[1]));
    if (this.timeout)
      this.timeout = (clearTimeout(this.timeout) as any) || null;
    delete this.client.game;
    this.engine.events.removeAllListeners();
		this.over = true;
  }

  // private addIGE(data: Events.in.Game["game.replay.ige"]) {
  //   this.igeBuffer.push(data);
  // }

  private init() {
		this.listen("game.match", (data) => {
			// if (data.)
		});
    this.listen(
      "game.start",
      () => {
        const timeout = setTimeout(
          () => {
            this.start();
          },
          this.options.countdown_count * this.options.countdown_interval +
            this.options.precountdown +
            this.options.prestart
        );
        this.listen("game.abort", () => clearTimeout(timeout), true);
      },
      true
    );

    const p = this.readyData.players;
    // TODO: Add support for choosing who to spectate
    const opponents = p.filter((p) => p.gameid !== this.gameid);
    this.opponents = opponents.map((o) => ({
      name: o.options.username,
      userid: o.userid,
      gameid: o.gameid,
      engine: this.createEngine(o.options, o.gameid),
      queue: []
    }));

    // this.listen("game.replay.ige", (data) => this.addIGE(data));
    this.listen("game.replay.ige", (data) => this.handleIGE(data));
    this.listen("game.replay", ({ gameid, frames }) => {
      const game = this.opponents.find((player) => player.gameid === gameid);
      if (!game || game.engine.toppedOut) return false;

      game.queue.push(...frames);
      while (game.queue.some((f) => f.frame > game.engine.frame)) {
        const frames: GameTypes.Replay.Frame[] = [];
        while (
          game.queue.length > 0 &&
          game.queue[0].frame <= game.engine.frame
        ) {
          frames.push(game.queue.shift()!);
        }
        game.engine.tick(frames);
      }
    });
  }

  private start() {
    this.pipe(
      {
        type: "start",
        frame: 0,
        data: {}
      },
      getFullFrame(this.options)
    );

    this.startTime = performance.now();
    try {
      this.target = this.target;
    } catch {}

    this.client.emit("client.game.round.start", [
      (f) => {
        this.tick = f;
      },
      this.engine,
      [
        ...this.opponents.map((opponent) => ({
          name: opponent.name,
          gameid: opponent.gameid,
          engine: opponent.engine
        }))
      ]
    ]);

    this.timeout = setTimeout(this.tickGame.bind(this), 0);
  }

  createEngine(options: GameTypes.ReadyOptions, gameid: number) {
    return new Engine({
      multiplayer: {
        opponents: this.readyData.players
          .map((o) => o.gameid)
          .filter((id) => id !== gameid),
        passthrough: options.passthrough
      },
      board: {
        width: options.boardwidth,
        height: options.boardheight,
        buffer: 20 // there is always a buffer of 20 over the visible board
      },
      kickTable: options.kickset as any,
      options: {
        comboTable: options.combotable as any,
        garbageBlocking: options.garbageblocking as any,
        clutch: options.clutch,
        garbageTargetBonus: options.garbagetargetbonus,
        spinBonuses: options.spinbonuses
      },
      queue: {
        minLength: 31,
        seed: options.seed,
        type: options.bagtype as any
      },

      garbage: {
        cap: {
          absolute: options.garbageabsolutecap,
          increase: options.garbagecapincrease,
          max: options.garbagecapmax,
          value: options.garbagecap,
          marginTime: options.garbagecapmargin
        },
        multiplier: {
          value: options.garbagemultiplier,
          increase: options.garbageincrease,
          marginTime: options.garbagemargin
        },
        boardWidth: options.boardwidth,
        garbage: {
          speed: options.garbagespeed,
          holeSize: options.garbageholesize
        },
        messiness: {
          change: options.messiness_change,
          nosame: options.messiness_nosame,
          timeout: options.messiness_timeout,
          within: options.messiness_inner,
          center: options.messiness_center ?? false
        },

        bombs: options.usebombs,

        seed: options.seed,
        rounding: options.roundmode,
        openerPhase: options.openerphase,
        specialBonus: options.garbagespecialbonus
      },
      pc: options.allclears
        ? {
            garbage: options.allclear_garbage,
            b2b: options.allclear_b2b
          }
        : false,
      b2b: {
        chaining: options.b2bchaining,
        charging: options.b2bcharging
          ? { at: options.b2bcharge_at, base: options.b2bcharge_base }
          : false
      },
      gravity: {
        value: options.g,
        increase: options.gincrease,
        marginTime: options.gmargin
      },
      misc: {
        movement: {
          infinite: options.infinite_movement,
          lockResets: options.lockresets,
          lockTime: options.locktime,
          may20G: options.gravitymay20g
        },
        allowed: {
          spin180: options.allow180,
          hardDrop: options.allow_harddrop,
          hold: options.display_hold
        },
        infiniteHold: options.infinite_hold,
        username: options.username,
        date: new Date()
      },
      handling: options.handling
    });
  }

  private flushFrames() {
    let returnFrames = this.frameQueue.filter((f) => f.frame <= this.frame);
    this.frameQueue = this.frameQueue.filter((f) => f.frame > this.frame);
    if (!this.canTarget)
      returnFrames = returnFrames.filter(
        (f) => f.type !== "strategy" && f.type !== "manual_target"
      );
    if (!this.options.manual_allowed)
      returnFrames = returnFrames.filter((f) => f.type !== "manual_target");

    // move the full frame to the front as a precaution
    const fullFrameIndex = returnFrames.findIndex(
      (frame) => frame.type === "full"
    );
    if (fullFrameIndex >= 0) {
      returnFrames = moveElementToFirst(returnFrames, fullFrameIndex);
    }

    // move start frame to front (start -> full at the end)
    const startFrameIndex = returnFrames.findIndex(
      (frame) => frame.type === "start"
    );
    if (startFrameIndex >= 0) {
      returnFrames = moveElementToFirst(returnFrames, startFrameIndex);
    }
    return returnFrames;
  }

  private async tickGame() {
    if (this.over) return;
    let runAfter: GameTypes.Tick.Out["runAfter"] = [];
    if (this.tick) {
      try {
        const res = await this.tick({
          gameid: this.gameid,
          frame: this.frame,
          events: this.messageQueue.splice(0, this.messageQueue.length),
          engine: this.engine!
        });

        const isValidObject = (obj: any) =>
          typeof obj === "object" && obj !== null;
        if (res.keys)
          this.keyQueue.push(
            ...res.keys.filter((k, idx) => {
              if (
                !isValidObject(k) ||
                !(k.type === "keydown" || k.type === "keyup") ||
                typeof k.frame !== "number" ||
                isNaN(k.frame) ||
                k.frame < this.frame ||
                !isValidObject(k.data) ||
                !(
                  [
                    "moveLeft",
                    "moveRight",
                    "hardDrop",
                    "hold",
                    "softDrop",
                    "rotateCW",
                    "rotate180",
                    "rotateCCW"
                  ] satisfies GameTypes.Tick.Keypress["data"]["key"][]
                ).includes(k.data.key) ||
                typeof k.data.subframe !== "number" ||
                isNaN(k.data.subframe) ||
                k.data.subframe < 0 ||
                k.data.subframe >= 1
              ) {
                this.#log(
                  `Invalid key event at index ${idx} passed on frame ${this.frame}:\n${JSON.stringify(k, null, 2)}`,
                  {
                    level: "error"
                  }
                );
                return false;
              }
              return true;
            })
          );
        if (res.runAfter)
          runAfter.push(
            ...res.runAfter.filter((ra, idx) => {
              if (typeof ra !== "function") {
                this.#log(
                  `Invalid runAfter callback at index ${idx} passed on frame ${this.frame}.`,
                  {
                    level: "warning"
                  }
                );
                return false;
              }
              return true;
            })
          );
      } catch (e) {
        if (this.over) return;
        throw e;
      }
    }
    if (this.over) return;

    const keys: typeof this.keyQueue = [];

    for (let i = this.keyQueue.length - 1; i >= 0; i--) {
      const key = this.keyQueue[i];
      if (Math.floor(key.frame) === this.frame) {
        keys.push(key);
        this.keyQueue.splice(i, 1);
      }
    }

    keys.splice(0, keys.length, ...keys.reverse());

    try {
      const { garbage, pieces } = this.engine.tick([
        ...this.incomingGarbage.splice(0, this.incomingGarbage.length),
        ...keys
      ]);

      this.stats.piecesPlaced += pieces;

      this.messageQueue.push(
        ...garbage.received.map((g) => ({
          type: "garbage" as const,
          ...g
        }))
      );

      this.pipe(...keys);

      // // handle buffered IGE data
      // const flattenedIGEBuffer = this.igeBuffer.flat();
      // this.handleIGE(flattenedIGEBuffer);
      // this.igeBuffer = [];

      if (this.frame !== 0 && this.frame % Game.fpm === 0) {
        const frames = this.flushFrames();
        this.client.emit("game.replay", {
          gameid: this.gameid,
          provisioned: this.frame,
          frames
        });

        this.messageQueue.push({
          type: "frameset",
          provisioned: this.frame,
          frames
        });
      }

      runAfter.forEach((f) => f());

      this.timeout = setTimeout(
        this.tickGame.bind(this),
        ((this.frame + 1) / Game.fps) * 1000 -
          (performance.now() - this.startTime!)
      );
    } catch (e) {
      console.error(e);
      throw e;
    }
  }

  /**
   * Send raw frames to TETR.IO -
   * Not recommendedfor normal use.
   */
  pipe(...frames: GameTypes.Replay.Frame[]) {
    this.frameQueue.push(...frames);
  }

  private handleIGE(data: Events.in.Game["game.replay.ige"]) {
    data.iges.forEach((ige) => {
      const frame: GameTypes.Replay.Frame = {
        frame: this.frame,
        type: "ige",
        data: ige
      };

      this.pipe(frame);
      this.incomingGarbage.push({ ...frame });

      if (ige.type === "interaction_confirm") {
        if (ige.data.type === "targeted") {
          // TODO: implement
        }
      } else if (ige.type === "target") {
        this.serverTargets = ige.data.targets;
      } else if (ige.type === "allow_targeting") {
        this.canTarget = ige.data.value;
      }
    });
  }

  /**
   * The current targeting strategy
   */
  get target() {
    return this._target;
  }

  /**
   * Set the current targeting strategy, throws error if targeting is not allowed
   */
  set target(t: GameTypes.Target) {
    if (!this.canTarget) throw new Error("Targeting not allowed.");
    const strategyMap = {
      even: 0,
      elims: 1,
      random: 2,
      payback: 3,
      manual: 4
    } as const;

    const frame = this.frame;
    if (t.strategy === "manual") {
      this.pipe({
        frame,
        type: "manual_target",
        data: t.target
      });
    } else {
      this.pipe({
        frame,
        type: "strategy",
        data: strategyMap[t.strategy]
      });
    }

    this._target = t;
  }

  /**
   * The game's current frame
   */
  public get frame() {
    return this.engine ? this.engine.frame : 0;
  }

  private set frame(newFrame: number) {
    this.engine.frame = newFrame;
  }
}
