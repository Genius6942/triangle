export * from "./damageCalc";
export * from "./increase";
export * from "./kicks";
export * from "./tetromino";
export * from "./seed";
export * from "./polyfills";

export const deepCopy = <T>(obj: T): T => JSON.parse(JSON.stringify(obj));
