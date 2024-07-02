import { pack } from "../../utils";
import { APIDefaults } from ".";

export type Res<T = any> =
  | { success: false; error: { msg: string; [key: string]: any } }
  | ({ success: true } & T);

export const basic = (defaults: APIDefaults) => {
  return {
    get: async <T = any>({
      token,
      uri,
      headers = {},
      json = false
    }: {
      token?: string | null;
      uri: string;
      headers?: Record<string, string>;
      json?: boolean;
    }): Promise<Res<T>> => {
      const res = await fetch(`https://tetr.io/api/${uri}`, {
        headers: {
          Accept: json ? "application/json" : "application/vnd.osk.theorypack",
          "User-Agent": defaults.userAgent,
          Authorization:
            token === null ? undefined : `Bearer ${token || defaults.token}`,
          ...headers
        } as any
      });

      return (
        json
          ? await res.json()
          : pack.unpack(Buffer.from(await res.arrayBuffer()))
      ) as Res<T>;
    },

    post: async <T = any>({
      token,
      uri,
      body,
      headers = {},
      json = false
    }: {
      token?: string;
      uri: string;
      body: Record<string, any>;
      headers?: Record<string, string>;
      json?: boolean;
    }) => {
      const res = await fetch(`https://tetr.io/api/${uri}`, {
        method: "POST",
        body: json ? JSON.stringify(body) : pack.pack(body),
        headers: {
          Accept: json ? "application/json" : "application/vnd.osk.theorypack",
          "User-Agent": defaults.userAgent,
          "Content-Type": json
            ? "application/json"
            : "application/vnd.osk.theorypack",

          Authorization:
            token === null ? undefined : `Bearer ${token || defaults.token}`,
          ...headers
        } as any
      });

      return (
        json
          ? await res.json()
          : pack.unpack(Buffer.from(await res.arrayBuffer()))
      ) as Res<T>;
    }
  };
};

export type Get = ReturnType<typeof basic>["get"];
export type Post = ReturnType<typeof basic>["post"];
