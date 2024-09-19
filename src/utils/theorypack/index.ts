import { Packr, Unpackr, addExtension } from "./ts-wrap";

// require theorypack extensions
addExtension({
  Class: undefined!,
  type: 1,
  read: (e) => (null === e ? { success: true } : { success: true, ...e })
});

addExtension({
  Class: undefined!,
  type: 2,
  read: (e) => (null === e ? { success: false } : { success: false, error: e })
});

const unpacker = new Unpackr({
  int64AsType: "number",
  bundleStrings: true,
  sequential: false
});

const packer = new Packr({
  int64AsType: "number",
  bundleStrings: true,
  sequential: false
});

export namespace pack {
  /** unpack a single theorypack message */
  export const unpack = unpacker.unpack.bind(
    unpacker
  ) as typeof unpacker.unpack;
  /** unpack multiple theorypack messages */
  export const unpackMultiple = unpacker.unpackMultiple.bind(
    unpacker
  ) as typeof unpacker.unpackMultiple;
  /** decode a theorypack message */
  export const decode = packer.decode.bind(unpacker) as typeof unpacker.decode;
  /** pack a single theorypack messages */
  export const pack = packer.pack.bind(packer) as typeof packer.pack;
  /** encode a theorypack message */
  export const encode = packer.encode.bind(packer) as typeof packer.encode;
}
