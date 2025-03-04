export * from "./damageCalc";
export * from "./increase";
export * from "./kicks";
export * from "./tetromino";
export * from "./seed";
export * from "./polyfills";

export const deepCopy = <T>(obj: T): T => {
  if (!obj) return obj;
  if (Array.isArray(obj)) {
    var arr = [];
    var length = obj.length;
    for (var i = 0; i < length; i++) arr.push(deepCopy(obj[i]));
    return arr as any;
  } else if (typeof obj === "object") {
    var keys = Object.keys(obj);
    var length = keys.length;
    var newObject: { [k: string]: any } = {};
    for (var i = 0; i < length; i++) {
      var key = keys[i];
      newObject[key] = deepCopy((obj as any)[key]);
    }
    return newObject as any;
  }
  return obj;
};
