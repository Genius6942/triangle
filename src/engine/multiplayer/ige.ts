interface GarbageRecord {
  amount: number;
  iid: number;
}

/**
 * Manages network IGE cancelling
 */
export class IGEHandler {
  /** @hidden */
  private players: Map<number, { incoming: number; outgoing: GarbageRecord[] }>;
  /** @hidden */
  private iid = 0;

  /**
   * Manages network IGE cancelling
   * @param players - list of player ids
   */
  constructor(players: number[]) {
    this.players = new Map();
    players.forEach((player) => {
      this.players.set(player, { incoming: 0, outgoing: [] });
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
    const player = this.players.get(playerID);
    const iid = ++this.iid;

    if (!player)
      throw new Error(
        `player not found: player with id ${playerID} not in ${[
          ...(this.players.keys() as any)
        ].join(", ")}`
      );
    this.players.set(playerID, {
      incoming: player.incoming,
      outgoing: [...player.outgoing, { iid, amount }]
    });
    // console.log('sent: ', { iid: this.iid, players: Object.fromEntries(this.players) });
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

    const incomingIID = Math.max(iid, player.incoming ?? 0);

    const newIGEs: GarbageRecord[] = [];

    let runningAmount = amount;
    player.outgoing.forEach((item) => {
      if (item.iid <= ackiid) return;
      const amt = Math.min(item.amount, runningAmount);
      item.amount -= amt;
      runningAmount -= amt;
      if (item.amount > 0) newIGEs.push(item);
    });

    this.players.set(playerID, { incoming: incomingIID, outgoing: newIGEs });
    // console.log('recieved:', { iid: this.iid, players: Object.fromEntries(this.players) });

    return runningAmount;
  }
}
