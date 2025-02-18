export type Rotation = 0 | 1 | 2 | 3;

export namespace Falling {
  export enum SpinTypeKind {
    Null,
    Normal,
    Mini
  }

  export enum LastKind {
    None,
    Rotate,
    Move,
    Fall
  }

  export enum LastRotationKind {
    None,
    Right,
    Left,
    Vertical,
    Horizontal
  }
}
