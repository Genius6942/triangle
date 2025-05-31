import { APIDefaults } from ".";
import type { Get, Post } from "./basic";

export namespace Server {
  export interface Signature {
    version: string;
    countdown: boolean;
    novault: boolean;
    noceriad: boolean;
    norichpresence: boolean;
    noreplaydispute: boolean;
    supporter_specialthanks_goal: number;
    xp_multiplier: number;
    catalog: {
      supporter: {
        price: number;
        price_bulk: number;
        price_gift: number;
        price_gift_bulk: number;
        bulk_after: number;
        normal_price: number;
        normal_price_bulk: number;
        normal_price_gift: number;
        normal_price_gift_bulk: number;
        normal_bulk_after: number;
      };
      "zenith-tower-ost": {
        price: number;
        normal_price: number;
      };
    };
    league_mm_roundtime_min: number;
    league_mm_roundtime_max: number;
    league_additional_settings: Record<string, any>;
    league_season: {
      current: string;
      prev: string;
      next: string | null;
      next_at: string | null;
      ranked: boolean;
    };
    zenith_duoisfree: boolean;
    zenith_freemod: boolean;
    zenith_cpu_count: number;
    zenith_additional_settings: {
      TEMP_zenith_grace: string;
      messiness_timeout: number;
    };
    domain: string;
    ch_domain: string;
    mode: string;
    sentry_enabled: boolean;
    serverCycle: string;
    domain_hash: string;
    client: {
      commit: {
        id: string;
        time: number;
      };
      branch: string;
      build: {
        id: string;
        time: number;
      };
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

export const server = (get: Get, _: Post, options: APIDefaults) => {
  const getDespool = async (endpoint: string, index: string) => {
    const req = await fetch(
      encodeURI(
        `https://${endpoint}/spool?${Date.now()}-${index}-${Math.floor(1e6 * Math.random())}`
      ),
      {
        method: "GET",
        headers: {
          // Authorization: `Bearer ${options.token}`,
          "User-Agent": options.userAgent
        }
      }
    );
    const res = new Uint8Array(await req.arrayBuffer());

    const parseSpoolData = (e: Uint8Array) => {
      const t = e[0],
        n = {
          online: 128 & e[1],
          avoidDueToHighLoad: 64 & e[1],
          recentlyRestarted: 32 & e[1],
          backhaulDisrupted: 16 & e[1]
        },
        s = [0, 0, 0];
      (s[0] = (e[2] / 256) * 4),
        (s[1] = (e[3] / 256) * 4),
        (s[2] = (e[4] / 256) * 4);
      return {
        version: t,
        flags: n,
        load: s,
        latency: e[5],
        str: `v${t} /${n.avoidDueToHighLoad ? "Av" : ""}${n.recentlyRestarted ? "Rr" : ""}${n.backhaulDisrupted ? "Bd" : ""}/ ${s[0]}, ${s[1]}, ${s[2]}`
      };
    };

    return parseSpoolData(res);
  };

  const findLowestPingSpool = async (
    spools: { name: string; host: string; flag: string; location: string }[]
  ): Promise<{
    name: string;
    host: string;
    flag: string;
    location: string;
  }> => {
    return await Promise.any(
      spools.map(async (spool, index) => {
        await getDespool(spool.host, index.toString());
        return spool;
      })
    );
  };

  return {
    environment: async (): Promise<Server.Environment> => {
      const result = await get<Server.Environment>({
        uri: "server/environment"
      });

      if (result.success === false) throw new Error(result.error.msg);
      return result;
    },
    spool: async (useSpools: boolean) => {
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

      if (!useSpools || res.spools === null)
        return {
          host: "tetr.io",
          endpoint: res.endpoint.replace("/ribbon/", ""),
          token: ""
        };
      else {
        const lowestPingSpool = await findLowestPingSpool(res.spools.spools);
        return {
          host: lowestPingSpool.host,
          endpoint: res.endpoint.replace("/ribbon/", ""),
          token: res.spools.token
        };
      }
    }
  };
};
