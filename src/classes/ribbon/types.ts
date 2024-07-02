export namespace RibbonEvents {
  export type Raw<T> = {
    [P in keyof T]: T[P] extends void
      ? { command: P }
      : { command: P; data: T[P] };
  }[keyof T];

  export interface Send {}
}
