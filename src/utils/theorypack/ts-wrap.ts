// @ts-expect-error no declaration file
import msgpackr_raw from "./msgpackr.js";

const msgpackr = msgpackr_raw as typeof import("msgpackr");

export const addExtension = msgpackr.addExtension;
export const Packr = msgpackr.Packr;
export const Unpackr = msgpackr.Unpackr;
