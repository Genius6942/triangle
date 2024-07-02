export namespace User {
  export type Role =
    | "banned"
    | "user"
    | "bot"
    | "halfmod"
    | "mod"
    | "admin"
    | "sysop";

  export interface Badge {
    id: string;
    label: string;
    group: string | null;
    ts: string;
  }

  export interface Records {
    "40l": RecordDetail;
    blitz: RecordDetail;
  }

  export interface RecordDetail {
    record: Record;
    rank: number | null;
  }

  export interface Record {
    _id: string;
    endcontext: EndContext;
    ismulti: boolean;
    replayid: string;
    stream: string;
    ts: string;
    user: {
      _id: string;
      username: string;
    };
  }

  export interface EndContext {
    seed: number;
    lines: number;
    level_lines: number;
    level_lines_needed: number;
    inputs: number;
    holds: number;
    time: {
      start: number;
      zero: boolean;
      locked: boolean;
      prev: number;
      frameoffset: number;
    };
    score: number;
    zenlevel: number;
    zenprogress: number;
    level: number;
    combo: number;
    currentcombopower: number;
    topcombo: number;
    btb: number;
    topbtb: number;
    currentbtbchainpower: number;
    tspins: number;
    piecesplaced: number;
    clears: {
      singles: number;
      doubles: number;
      triples: number;
      quads: number;
      pentas: number;
      realtspins: number;
      minitspins: number;
      minitspinsingles: number;
      tspinsingles: number;
      minitspindoubles: number;
      tspindoubles: number;
      tspintriples: number;
      tspinquads: number;
      tspinpentas: number;
      allclear: number;
    };
    garbage: {
      sent: number;
      received: number;
      attack: number;
      cleared: number;
    };
    kills: number;
    finesse: {
      combo: number;
      faults: number;
      perfectpieces: number;
    };
    finalTime: number;
    gametype: string;
  }

  export interface League {
    gamesplayed: number;
    gameswon: number;
    rating: number;
    glicko: number;
    rd: number;
    rank: string;
    apm: number;
    pps: number;
    vs: number;
    decaying: boolean;
    standing: number;
    standing_local: number;
  }
}
