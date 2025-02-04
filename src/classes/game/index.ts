import { Engine } from "../../engine";
import { Events, Game as GameTypes } from "../../types";
import { Client } from "../client";
import { getFullFrame } from "./utils";

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

  /** The client's engine */
  public engine!: Engine;
  /** Data on the opponents in game */
  public opponents: {
    name: string;
    gameid: number;
    userid: string;
    engine: Engine;
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

  /** Game stats */
  public stats = {
    piecesPlaced: 0
    // TODO: add more of the stats
  };

  /** @hideconstructor */
  constructor(client: Client, ready: GameTypes.Ready) {
    this.client = client;

    const self = ready.players.find((p) => p.userid === client.user.id);

    if (!self) throw new Error("User not in game");
    this.gameid = self.gameid;
    this.options = self.options;
    this.readyData = ready;

    this.engine = this.createEngine(this.options, this.gameid);

    ready.players.forEach((player) =>
      this.client.emit("game.scope.start", player.gameid)
    );

    this.init();
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
    this.over = true;
    delete this.client.game;
  }

  // private addIGE(data: Events.in.Game["game.replay.ige"]) {
  //   this.igeBuffer.push(data);
  // }

  private init() {
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
    if (p.length === 2) {
      // TODO: Add support for larger game spectating, including choosing who to spectate
      const opponents = p.filter((p) => p.gameid !== this.gameid);
      this.opponents = opponents.map((o) => ({
        name: o.options.username,
        userid: o.userid,
        gameid: o.gameid,
        engine: this.createEngine(o.options, o.gameid)
      }));
    }

    // this.listen("game.replay.ige", (data) => this.addIGE(data));
    this.listen("game.replay.ige", (data) => this.handleIGE(data));
    this.listen("game.replay", ({ gameid, frames, provisioned }) => {
      const game = this.opponents.find((player) => player.gameid === gameid);
      if (!game || game.engine.toppedOut) return false;

      while (game.engine.frame < provisioned - 1)
        game.engine.tick(
          frames.filter((frame) => frame.frame === game.engine.frame + 1) as any
        );
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
        garbageMultiplier: {
          value: options.garbagemultiplier,
          increase: options.garbageincrease,
          marginTime: options.garbagemargin
        },
        clutch: options.clutch,
        garbageTargetBonus: options.garbagetargetbonus,
        spinBonuses: options.spinbonuses,
        garbageAttackCap: Infinity // TODO idk what but this is wrong
      },
      queue: {
        minLength: 31,
        seed: options.seed,
        type: options.bagtype as any
      },

      garbage: {
        cap: {
          absolute: Infinity, // TODO also fix this idk
          increase: options.garbagecapincrease,
          max: options.garbagecapmax,
          value: options.garbagecap
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
          within: options.messiness_inner
        },
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
          ? { at: options.b2bcharge_at - 1, base: options.b2bcharge_base }
          : false
      },
      gravity: {
        value: options.g,
        increase: options.gincrease,
        marginTime: options.gmargin
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
      const res = await this.tick({
        gameid: this.gameid,
        frame: this.frame,
        events: this.messageQueue.splice(0, this.messageQueue.length),
        engine: this.engine!
      });

      if (res.keys) this.keyQueue.push(...res.keys);
      if (res.runAfter) runAfter.push(...res.runAfter);
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
