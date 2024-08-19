import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
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
          cookie: `${defaults.turnstile ? "cf_clearance=" + defaults.turnstile : ""}`,
          Authorization:
            token === null ? undefined : `Bearer ${token || defaults.token}`,
          ...headers
        } as any
      });

      const copy = res.clone();
      try {
        return json
          ? await res.json()
          : pack.unpack(Buffer.from(await res.arrayBuffer()));
      } catch {
        if (res.status === 429)
          throw new Error(`Rate limit (429) on GET to ${uri}`);
        else {
          try {
            await fs.readdir(path.join(os.homedir(), ".trianglejs", "errors"));
          } catch {
            await fs.mkdir(path.join(os.homedir(), ".trianglejs", "errors"), {
              recursive: true
            });
          }
          const now = Date.now();
          const text = await copy.text();
          await fs.writeFile(
            path.join(os.homedir(), ".trianglejs", "errors", `${now}.html`),
            text
          );
          if (text.includes("<title>Maintenance</title>"))
            throw new Error(
              `The TETR.IO Servers are under maintanence. Check https://status.osk.sh for updates. You can view more information at ${path.join(
                os.homedir(),
                ".trianglejs",
                "errors",
                `${now}.html`
              )}`
            );
          else
            throw new Error(
              `An error occured. This was likely because it the request was blocked by Cloudflare Turnstile on GET to ${uri}. Try passing in a turnstile token. View the error at ${path.join(
                os.homedir(),
                ".trianglejs",
                "errors",
                `${now}.html`
              )}`
            );
        }
      }
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
    }): Promise<Res<T>> => {
      const res = await fetch(`https://tetr.io/api/${uri}`, {
        method: "POST",
        body: json ? JSON.stringify(body) : pack.pack(body),
        headers: {
          Accept: json ? "application/json" : "application/vnd.osk.theorypack",
          "User-Agent": defaults.userAgent,
          cookie: `${defaults.turnstile ? "cf_clearance=" + defaults.turnstile : ""}`,
          "Content-Type": json
            ? "application/json"
            : "application/vnd.osk.theorypack",

          Authorization:
            token === null ? undefined : `Bearer ${token || defaults.token}`,
          ...headers
        } as any
      });

      const copy = res.clone();
      try {
        return json
          ? await res.json()
          : pack.unpack(Buffer.from(await res.arrayBuffer()));
      } catch {
        if (res.status === 429)
          throw new Error(`Rate limit (429) on GET to ${uri}`);
        else {
          try {
            await fs.readdir(path.join(os.homedir(), ".trianglejs", "errors"));
          } catch {
            await fs.mkdir(path.join(os.homedir(), ".trianglejs", "errors"), {
              recursive: true
            });
          }
          const now = Date.now();
          const text = await copy.text();
          await fs.writeFile(
            path.join(os.homedir(), ".trianglejs", "errors", `${now}.html`),
            text
          );
          if (text.includes("<title>Maintenance</title>"))
            throw new Error(
              `The TETR.IO Servers are under maintanence. Check https://status.osk.sh for updates. You can view more information at ${path.join(
                os.homedir(),
                ".trianglejs",
                "errors",
                `${now}.html`
              )}`
            );
          else
            throw new Error(
              `An error occured. This was likely because it the request was blocked by Cloudflare Turnstile on GET to ${uri}. Try passing in a turnstile token. View the error at ${path.join(
                os.homedir(),
                ".trianglejs",
                "errors",
                `${now}.html`
              )}`
            );
        }
      }
    }
  };
};

export type Get = ReturnType<typeof basic>["get"];
export type Post = ReturnType<typeof basic>["post"];
