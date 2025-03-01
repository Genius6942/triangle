export namespace constants {
  export namespace flags {
    export const ROTATION_LEFT = 1;
    export const ROTATION_RIGHT = 2;
    export const ROTATION_180 = 4;
    export const ROTATION_SPIN = 8;
    export const ROTATION_MINI = 16;
    export const ROTATION_SPIN_ALL = 32;
    export const ROTATION_ALL =
      ROTATION_LEFT |
      ROTATION_RIGHT |
      ROTATION_180 |
      ROTATION_SPIN |
      ROTATION_MINI |
      ROTATION_SPIN_ALL;
    export const STATE_WALL = 64;
    export const STATE_SLEEP = 128;
    export const STATE_FLOOR = 256;
    export const STATE_NODRAW = 512;
    export const STATE_ALL =
      STATE_WALL | STATE_SLEEP | STATE_FLOOR | STATE_NODRAW;
    export const ACTION_IHS = 1024;
    export const ACTION_FORCELOCK = 2048;
    export const ACTION_SOFTDROP = 4096;
    export const ACTION_MOVE = 8192;
    export const ACTION_ROTATE = 16384;
    export const FLAGS_COUNT = 15;
  }
}
