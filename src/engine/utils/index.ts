export * from "./garbage";
export * from "./kicks";
export * from "./tetromino";
export * from "./seed";

export const deepCopy = <T>(obj: T): T => JSON.parse(JSON.stringify(obj));

export const calculateIncrease = (
  base: number,
  frames: number,
  increase: number,
  marginTime: number
) => {
  const times = Math.floor(Math.max(0, frames - marginTime) / 60);
  return base + increase * times;
};
