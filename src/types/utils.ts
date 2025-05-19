export namespace Utils {
  export type DeepKeysInner<T> = T extends object
    ? T extends any[]
      ? never
      : {
          [K in keyof T]-?: T[K] extends object
            ? // @ts-expect-error
              `${K}.${DeepKeysInner<T[K]>}`
            : K;
        }[keyof T]
    : "";

  export type RemoveDotOptions<T extends string> = T extends `${infer _}.`
    ? never
    : T;

  // @ts-expect-error
  export type DeepKeys<T> = RemoveDotOptions<DeepKeysInner<T>>;

  export type DeepKey<T, K extends string> = K extends keyof T
    ? T[K]
    : K extends `${infer First}.${infer Rest}`
      ? First extends keyof T
        ? DeepKey<T[First], Rest>
        : never
      : never;

  export type DeepKeyValue<T, K extends string> = K extends keyof T
    ? T[K]
    : DeepKey<T, K>;
}
