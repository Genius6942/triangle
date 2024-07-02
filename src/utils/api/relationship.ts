import { APIDefaults } from ".";
import { Social } from "../../types";
import type { Get, Post } from "./basic";

export const relationship = (get: Get, post: Post, __: APIDefaults) => {
  return {
    friend: async (id: string) => {
      const res = await post<{}>({
        uri: "relationships/friend",
        body: { user: id }
      });

      if (res.success === false) throw new Error(res.error.msg);
      return res.success;
    },
    dms: async (id: string) => {
      const res = await get<{
        dms: Social.DM[];
      }>({
        uri: `dms/${id}`
      });
      if (res.success === false) throw new Error(res.error.msg);
      return res.dms;
    }
  };
};
