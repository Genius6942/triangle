import { polyfills } from "../utils";

interface GarbageRecord {
  amount: number;
  iid: number;
}

interface PlayerData {
  incoming: number;
  outgoing: GarbageRecord[];
}

export interface IGEHandlerSnapshot {
  iid: number;
  players: { [key: number]: string };
}
/**
 * Manages network IGE cancelling
 */
export class IGEHandler {
  /** @hidden */
  private players: polyfills.Map<
    number,
    // { incoming: number; outgoing: GarbageRecord[] }
    //! there was an issue where as an object some garbage numbers would magically turn into other numbers, wtf js
    string
  >;
  /** @hidden */
  private iid = 0;

  /** @hidden */
  private extract(data: string): PlayerData {
    return JSON.parse(data);
  }

  /** @hidden */
  private stringify(data: PlayerData): string {
    return JSON.stringify(data);
  }

  /**
   * Manages network IGE cancelling
   * @param players - list of player ids
   */
  constructor(players: number[]) {
    this.players = new polyfills.Map();
    players.forEach((player) => {
      this.players.set(player, this.stringify({ incoming: 0, outgoing: [] }));
    });
  }

  /**
   * Sends a message to a player.
   * @param options - info on sending player
   * @param options.playerID - The ID of the player to send the message to.
   * @param options.amount - The amount of the message.
   * @throws {Error} If the player is not found.
   */
  send({ playerID, amount }: { playerID: number; amount: number }) {
    if (amount === 0) return;
    const player = this.players.get(playerID);
    const iid = ++this.iid;

    if (!player)
      throw new Error(
        `player not found: player with id ${playerID} not in ${[
          ...(this.players.keys() as any)
        ].join(", ")}`
      );

    this.players.set(
      playerID,
      JSON.stringify({
        incoming: JSON.parse(player).incoming,
        outgoing: [...this.extract(player).outgoing, { iid, amount }]
      })
    );

    // console.log(
    //   "send",
    //   playerID,
    //   Object.fromEntries(
    //     [...this.players.entries()].map(([k, v]) => [k, this.extract(v)])
    //   )
    // );
  }

  /**
   * Receives a garbage from a player and processes it.
   * @param garbage - garbage object of data
   * @param garbage.playerID - The ID of the player sending the garbage.
   * @param garbage.ackiid - The IID of the last acknowledged item.
   * @param garbage.iid - The IID of the incoming item.
   * @param garbage.amount - The amount of the incoming item.
   * @returns The remaining amount after processing the message.
   * @throws {Error} If the player is not found.
   */
  receive({
    playerID,
    ackiid,
    iid,
    amount
  }: {
    playerID: number;
    ackiid: number;
    iid: number;
    amount: number;
  }) {
    const player = this.players.get(playerID);
    if (!player)
      throw new Error(
        `player not found: player with id ${playerID} not in ${[
          ...(this.players.keys() as any)
        ].join(", ")}`
      );

    const p = this.extract(player);

    const incomingIID = Math.max(iid, p.incoming ?? 0);

    const newIGEs: GarbageRecord[] = [];

    let runningAmount = amount;
    p.outgoing.forEach((item) => {
      if (item.iid <= ackiid) return;
      const amt = Math.min(item.amount, runningAmount);
      item.amount -= amt;
      runningAmount -= amt;
      if (item.amount > 0) newIGEs.push(item);
    });

    this.players.set(
      playerID,
      this.stringify({ incoming: incomingIID, outgoing: newIGEs })
    );

    // console.log(
    //   "receive",
    //   playerID,
    //   Object.fromEntries(
    //     [...this.players.entries()].map(([k, v]) => [k, this.extract(v)])
    //   )
    // );

    return runningAmount;
  }

  snapshot(): IGEHandlerSnapshot {
    return {
      players: Object.fromEntries(this.players.entries()),
      iid: this.iid
    };
  }

  fromSnapshot(snapshot: IGEHandlerSnapshot) {
    this.players = new polyfills.Map(
      Object.entries(snapshot.players).map(([k, v]) => [Number(k), v])
    );
    this.iid = snapshot.iid;
  }
}
