import { Engine } from "..";
import { KeyPress } from "../types";

export interface BFSStats {
  nodes: number;
  depth: number;
  time: number;
}
export interface BFSResult {
  keys: KeyPress[];
  stats: BFSStats;
}

export const bfs = (
  engine: Engine,
  depth: number,
  target: [number, number][],
  finesse?: boolean
): false | BFSResult => {
  const keys: KeyPress[] = [
    "moveLeft",
    "moveRight",
    ...(finesse ? (["dasLeft", "dasRight"] as const) : []),
    "rotateCW",
    "rotateCCW",
    "rotate180",
    "softDrop"
  ];

  const targetSet = new Set(target.map(([x, y]) => `${x},${y}`));
  const queue: { keys: KeyPress[]; initialDepth: number }[] = [];
  let queuePointer = 0;

  const stats: BFSStats = {
    nodes: 0,
    depth: 0,
    time: 0
  };

  const reset = (() => {
    const og = {
      rotation: engine.falling.rotation,
      location: [...engine.falling.location] as [number, number]
    };
    return () => {
      engine.falling.rotation = og.rotation;
      engine.falling.location = [og.location[0], og.location[1]];
    };
  })();
  if (!finesse) {
    for (const rot of [null, "rotateCCW", "rotateCW", "rotate180"] as const) {
      if (rot) {
        engine[rot]();
      }
      const left =
        engine.falling.blocks.reduce((a, b) => [Math.min(a[0], b[0]), 0])[0] +
        engine.falling.location[0];
      const right =
        engine.board.width -
        1 -
        (engine.falling.blocks.reduce((a, b) => [Math.max(a[0], b[0]), 0])[0] +
          engine.falling.location[0]);

      for (let x = 0; x < left; x++) {
        if (!rot && x === 0) continue;
        const k = rot
          ? [
              rot,
              ...Array(x)
                .fill("")
                .map(() => "moveLeft" as const)
            ]
          : [
              ...Array(x)
                .fill("")
                .map(() => "moveLeft" as const)
            ];
        queue.push({ keys: k, initialDepth: k.length });
      }

      for (let x = 1; x < right; x++) {
        const k = rot
          ? [
              rot,
              ...Array(x)
                .fill("")
                .map(() => "moveRight" as const)
            ]
          : [
              ...Array(x)
                .fill("")
                .map(() => "moveRight" as const)
            ];
        queue.push({ keys: k, initialDepth: k.length });
      }

      reset();
    }
  } else {
    queue.push(
      ...keys.map((k) => ({
        keys: [k],
        initialDepth: 0
      }))
    );
  }

  const start = performance.now();

  while (queuePointer < queue.length) {
    stats.nodes++;
    const item = queue[queuePointer++];
    for (const key of item.keys.slice(0, item.keys.length - 1)) {
      engine[key]!();
    }

    const og = {
      rotation: engine.falling.rotation,
      location: [...engine.falling.location] as [number, number]
    };
    try {
      if (item.keys.length > 0) engine[item.keys.at(-1)!]();
    } catch (e) {
      console.error(item.keys);
      throw e;
    }

    if (
      // (["ccw", "cw", "180"].includes(item.at(-1) as any) &&
      //   engine.falling.rotation === og.rotation) ||
      // (["left", "right", "dasleft", "dasright", "soft"].includes(item.at(-1) as any) &&
      //   engine.falling.location[0] === og.location[0] &&
      //   engine.falling.location[1] === og.location[1])
      engine.falling.location[0] === og.location[0] &&
      engine.falling.location[1] === og.location[1] &&
      engine.falling.rotation === og.rotation
    ) {
      reset();
      continue;
    }

    if (
      engine.falling.blocks
        .map(
          (block) =>
            `${engine.falling.location[0] + block[0]},${
              engine.falling.location[1] - block[1]
            }`
        )
        .every((block) => targetSet.has(block))
    ) {
      reset();
      stats.depth = item.keys.length;

      if (item.keys[item.keys.length - 1] === "softDrop") {
        item.keys.splice(item.keys.length - 1, 1);
      }

      stats.time = performance.now() - start;

      return { keys: item.keys, stats };
    } else {
      if (item.keys.length - item.initialDepth >= depth) {
        reset();
        continue;
      }
      const lastKey = item.keys.at(-1)!;

      const bfsSkips: [KeyPress, KeyPress][] = [
        ["rotateCW", "rotateCCW"],
        ["rotateCCW", "rotateCW"],
        ["moveRight", "moveLeft"],
        ["moveLeft", "moveRight"],
        ["dasLeft", "moveLeft"],
        ["moveLeft", "dasLeft"],
        ["dasRight", "moveRight"],
        ["moveRight", "dasRight"]
      ];

      for (const key of keys) {
        if (
          key === "hardDrop" ||
          bfsSkips.map((i) => `${i[0]},${i[1]}`).includes(`${lastKey},${key}`)
        )
          continue;
        queue.push({
          keys: [...item.keys, key as KeyPress],
          initialDepth: item.initialDepth
        });
      }
      reset();
    }
  }

  return false;
};
