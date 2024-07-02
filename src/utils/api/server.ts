import * as ping from "ping";
import { APIDefaults } from ".";
import type { Get, Post } from "./basic";

export namespace Server {
  export interface Signature {
    version: string;
    countdown: boolean;
    novault: boolean;
    supporter_specialthanks_goal: number;
    xp_multiplier: number;
    catalog: {
      supporter: object; // You might want to define a more specific type for the supporter object
    };
    league_mm_roundtime_min: number;
    league_mm_roundtime_max: number;
    league_additional_settings: object; // You might want to define a more specific type for additional settings
    domain: string;
    domain_hash: string;
    ch_domain: string;
    mode: string;
    commit: {
      id: string;
      time: number;
    };
    branch: string;
    serverCycle: string;
    build: {
      id: string;
      time: number;
    };
  }

  export interface Environment {
    stats: {
      players: number;
      users: number;
      gamesplayed: number;
      gametime: number;
    };
    signature: Signature;
    vx: string;
  }
}

async function findLowestPingSpool(
  spools: { name: string; host: string; flag: string; location: string }[]
): Promise<{ name: string; host: string; flag: string; location: string }> {
  const pingResults = await Promise.all(
    spools.map(async (spool) => {
      const res = await ping.promise.probe(spool.host);
      return { spool, time: res.time === "unknown" ? Infinity : res.time };
    })
  );

  pingResults.sort((a, b) => a.time - b.time);

  return pingResults[0].spool;
}

export const server = (get: Get, _: Post, options: APIDefaults) => {
  const getDespool = async (endpoint: string) => {
    const req = await fetch(encodeURI("https://" + endpoint + "/spool"), {
      method: "GET",
      headers: {
        Authorization: "Bearer " + options.token,
        "User-Agent": options.userAgent
      }
    });
    const res = new Uint8Array(await req.arrayBuffer());

    const despool = {
      version: res[0],
      load1: res[2],
      load5: res[3],
      load15: res[4],
      online: (res[1] & 0b10000000) >> 7 === 1,
      overloaded: (res[1] & 0b01000000) >> 6 === 1,
      cold: (res[1] & 0b00100000) >> 5 === 1,
      reserved1: (res[1] & 0b00010000) >> 4 === 1,
      reserved2: (res[1] & 0b00001000) >> 3 === 1,
      reserved3: (res[1] & 0b00000100) >> 2 === 1,
      reserved4: (res[1] & 0b00000010) >> 1 === 1,
      reserved5: (res[1] & 0b00000001) >> 0 === 1
    };

    return despool;
  };
  return {
    environment: async (): Promise<Server.Environment> => {
      const result = await get<Server.Environment>({
        uri: "server/environment"
      });

      if (result.success === false) throw new Error(result.error.msg);
      return result;
    },
    spool: async () => {
      const res = await get<{
        endpoint: string;
        spools: {
          token: string;
          spools: {
            name: string;
            host: string;
            flag: string;
            location: string;
          }[];
        } | null;
      }>({
        uri: "server/ribbon"
      });

      if (res.success === false) {
        throw new Error(res.error.msg);
      }

      if (res.spools === null)
        return { endpoint: `tetr.io${res.endpoint}`, token: "" };
      else {
        const lowestPingSpool = await findLowestPingSpool(res.spools.spools);
        const spool = await getDespool(lowestPingSpool.host);
        if (spool.online && !spool.overloaded) {
          return {
            endpoint: `${lowestPingSpool.host}${res.endpoint}`,
            token: res.spools.token
          };
        }
      }
    }
  };
};
