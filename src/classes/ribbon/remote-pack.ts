import { basic } from "../../utils/api/basic";
import puppeteer from "puppeteer";
import { Server } from "../../utils/api/server";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { homedir } from "node:os";

let globalRemotePack: Awaited<ReturnType<typeof remotePack>>;

export const remotePack = (): Promise<{
  encode: (msg: string, data?: any) => Promise<Buffer>;
  decode: (data: Buffer) => Promise<any>;
}> => {
  if (globalRemotePack) return Promise.resolve(globalRemotePack);
  else
    return new Promise(async (resolve) => {
      const browser = await puppeteer.launch({
        ignoreDefaultArgs: ["--disable-extensions"]
      });

      const serverVersion = await basic({
        userAgent: await browser.userAgent(),
        token: "",
        turnstile: null
      }).get<Server.Environment>({
        uri: "server/environment"
      });
      if (serverVersion.success === false) {
        throw new Error(serverVersion.error.msg);
      }

      const triangleDir = path.join(homedir(), ".trianglejs");
      const fileName = `tetrio-${serverVersion.signature.build.id}.js`;

      let tetrioOverride: string;
      try {
        tetrioOverride = await fs.readFile(
          path.join(triangleDir, fileName),
          "utf-8"
        );
      } catch {
        if (!fsSync.existsSync(triangleDir)) {
          await fs.mkdir(triangleDir, { recursive: true });
        }

        // empty triangle folder
        const files = await fs.readdir(triangleDir);
        for (const file of files) {
          await fs.unlink(path.join(triangleDir, file));
        }

        const response = await fetch("https://tetr.io/js/tetrio.js");
        const buffer = Buffer.from(await response.arrayBuffer());
        tetrioOverride = buffer.toString();

        const classMatch = tetrioOverride.match(/const \w+=new class/);
        if (!classMatch) {
          throw new Error("Failed to find class");
        }

        const classIdx = classMatch.index;
        if (!classIdx || classIdx === -1) {
          throw new Error("Failed to find class");
        }

        let idx = classIdx + 50;

        while (tetrioOverride[idx] !== "{") {
          idx++;
        }

        let indent = 1;

        while (indent !== 0) {
          idx++;
          if (tetrioOverride[idx] === "{") {
            indent++;
          } else if (tetrioOverride[idx] === "}") {
            indent--;
          }
        }

        tetrioOverride =
          tetrioOverride.slice(0, idx) +
          `;window.__encode__=this.Encode.bind(this);window.__decode__=this.Decode.bind(this);` +
          tetrioOverride.slice(idx);
        tetrioOverride =
          tetrioOverride.slice(0, classIdx) +
          "window.Buffer=e;" +
          tetrioOverride.slice(classIdx);
        await fs.writeFile(path.join(triangleDir, fileName), tetrioOverride);
      }

      const page = await browser.newPage();

      await page.setRequestInterception(true);
      page.on("request", (request) => {
        if (request.url().includes("https://tetr.io/js/tetrio.js")) {
          request.respond({
            status: 200,
            contentType: "application/javascript; charset=utf-8",
            body: tetrioOverride
          });
        } else if (request.url().includes("https://tetr.io/res")) {
          request.respond({
            status: 404,
            body: "404 not found"
          });
        } else {
          request.continue();
        }
      });

      await page.goto("https://tetr.io");

      const encode = async (msg: string, data?: any) => {
        const result = await page.evaluate(
          async (msg, data) => {
            // @ts-expect-error
            const encoded = window.__encode__(msg, data);
            return encoded.toJSON().data;
          },
          msg,
          data
        );
        return Buffer.from(result);
      };

      const decode = async (data: any) => {
        const result = await page.evaluate(async (data) => {
          // @ts-expect-error
          return await window.__decode__(await window.Buffer.from(data));
        }, data.toJSON().data);
        if (result.command === "packets") {
          result.data.packets = result.data.packets.map((packet: any) =>
            Buffer.from(Object.values(packet) as number[])
          );
        }
        return result;
      };

      const res = { encode, decode };
      globalRemotePack = res;

      resolve(res);
    });
};
