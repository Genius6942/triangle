import { Client } from "../client";

/**
 * Client utils. This may be deprecated in the future
 */
export class ClientUtils {
  private client: Client;
  /** @hideconstructor */
  constructor(client: Client) {
    this.client = client;
  }

  private get api() {
    return this.client.api;
  }

  /**
   * Get the userid based on username
   * @deprecated in favor of `client.social.resolve`
   */
  async getID(username: string) {
    return this.api.users.resolve(username);
  }

  /**
   * Get a user.
   * @deprecated in favor of `client.social.who`
   */
  async getUser(opts: Parameters<typeof this.api.users.get>[0]) {
    return this.api.users.get(opts);
  }

  /**
   * Promise that resolves after `time` ms
   */
  async sleep(time: number) {
    return await new Promise((resolve) => setTimeout(resolve, time));
  }
}
