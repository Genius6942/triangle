import { Client } from "./client";
import { Game } from "./game";
import { Ribbon } from "./ribbon";
import { Room } from "./room";
import { Social } from "./social";
import { Staff } from "./staff";

export * from "./client";
export * from "./game";
export * from "./ribbon";
export * from "./room";
export * from "./social";
export * from "./staff";

export type all = Client & Game & Ribbon & Room & Social & Staff;
