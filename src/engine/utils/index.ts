export * from "./damageCalc";
export * from "./increase";
export * from "./kicks";
export * from "./tetromino";
export * from "./seed";
export * from "./polyfills";
export * from "./rng";

export interface Handler<T> {
  type: new (...args: any[]) => T;
  copy: (value: T) => T;
}
export function deepCopy<T>(obj: T): T;
export function deepCopy<T, H extends Handler<any>[]>(obj: T, handlers: H): T;
export function deepCopy<T, H extends Handler<any>[]>(
  obj: T,
  handlers: H = [] as unknown as H
): T {
  if (obj === null || obj === undefined || typeof obj !== "object") {
    return obj;
  }

  for (const h of handlers) {
    if (obj instanceof h.type) {
      return h.copy(obj as any) as T;
    }
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => deepCopy(item, handlers)) as any;
  }

  const out: { [k: string]: any } = {};
  for (const key of Object.keys(obj)) {
    out[key] = deepCopy((obj as any)[key], handlers);
  }
  return out as T;
}
