import { Client } from "../src";

(async () => {
  const p1 = await Client.connect({
    username: "test",
    password: "password" // not a real password, use bot credentials instead
  });

  console.log("connected to", p1.user.username);

  const room = await p1.rooms.create();

  console.log(`<${room.id}> ${room.name}`);
})();
