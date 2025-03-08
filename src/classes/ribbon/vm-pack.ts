import { version } from "../../utils";
import { basic } from "../../utils/api/basic";
import { Server } from "../../utils/api/server";

import fsSync from "node:fs";
import fs from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import vm from "node:vm";

import * as msgpackr from 'msgpackr';

let globalVM: Awaited<ReturnType<typeof vmPack>> | null = null;

export const vmPack = (
  userAgent: string,
  options: {
    globalVM: boolean;
  } = { globalVM: false }
): Promise<{
  encode: (msg: string, data?: any) => Buffer;
  decode: (data: Buffer) => any;
}> => {
  if (globalVM && options.globalVM) return Promise.resolve(globalVM);

  return new Promise(async (resolve) => {
    const serverVersion = await basic({
      userAgent,
      token: "",
      turnstile: null
    }).get<Server.Environment>({
      uri: "server/environment"
    });
    if (serverVersion.success === false) {
      throw new Error(serverVersion.error.msg);
    }

    const triangleDir = path.join(homedir(), ".trianglejs");
    const fileName = `tetrio-vm-${version}-${serverVersion.signature.build.id}.js`;

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
        await fs.rm(path.join(triangleDir, file), {
          recursive: true,
          force: true
        });
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
        `;exports.__encode__=(...d)=>this.Encode(...d).toJSON().data;exports.__decode__=(b)=>{const c=exports.__buffer__.allocUnsafe(b.length);b.forEach((v,i)=>{c[i]=v});return this.Decode(c)};exports.__codec__=this;` +
        tetrioOverride.slice(idx);
      tetrioOverride =
        tetrioOverride.slice(0, classIdx) +
        "exports.__buffer__=e;" +
        tetrioOverride.slice(classIdx);

      // f.Text -> onward remove
      (() => {
        const start = tetrioOverride.indexOf(".Text=class") - 2;
        let end = start;
        let bracket = 0;
        while (tetrioOverride[end] !== ";" || bracket !== 0) {
          if (tetrioOverride[end] === "{") {
            bracket++;
          } else if (tetrioOverride[end] === "}") {
            bracket--;
          }
          end++;
        }
        tetrioOverride =
          tetrioOverride.slice(0, start) + tetrioOverride.slice(end);
      })();

      // no setTimeout issue or smth
      (() => {
        const target = "=window}return";
        const find = tetrioOverride.indexOf(target);
        const idx = find + target.length + 1;
        tetrioOverride =
          tetrioOverride.slice(0, idx) +
          "{setInterval}" +
          tetrioOverride.slice(idx + 1);
      })();

      tetrioOverride = `try{${tetrioOverride}}catch(e){}`;
      await fs.writeFile(path.join(triangleDir, fileName), tetrioOverride);
    }

    const tetrio: any = {
      console: { log: () => {}, error: () => {}, warn: () => {} },
			// console,
      performance: performance,
      Response: Response,

      setTimeout: setTimeout,
      clearTimeout: clearTimeout,
      setInterval: setInterval,
      clearInterval: clearInterval,
      localStorage: {
        items: new Map<string, string>(),
        getItem: (key: string) => tetrio.localStorage.items.get(key),
        setItem: (key: string, value: string) =>
          tetrio.localStorage.items.set(key, value)
      },
      addEventListener: () => {},
      exports: {},
			imports: {
				Buffer,
				msgpackr
			}
    };

    tetrio.self = tetrio;
    tetrio.window = tetrio;
    tetrio.globalThis = tetrio;
    tetrio.document = { createElement: () => ({}) };

    vm.createContext(tetrio);
    vm.runInContext(tetrioOverride, tetrio);

    resolve({
      encode: (msg: string, data?: any) => {
        const encoded: number[] = tetrio.exports.__encode__(msg, data);
        return Buffer.from([...encoded]);
      },
      decode: (data: Buffer) => {
        const decoded = tetrio.exports.__decode__([...data]);
        if (decoded.command === "packets") {
          decoded.data.packets = decoded.data.packets.map((packet: any) =>
            Buffer.from([...packet])
          );
        }
        return decoded;
      }
    });
  });
};
