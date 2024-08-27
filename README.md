# Triangle.js

### A Typescript library and client for interacting with the TETR.IO main game API

## Installation

```bash
npm i @haelp/teto
```

or

```bash
git clone https://github.com/Genius6942/triangle triangle
```

> Note:
> Only looking to use the `ch.tetr.io` api? Check out the documentation [here](https://triangle.haelp.dev/documents/Channel.html).

## Setup (git installation only)

It is _highly_ recommended that you use a Typescript project for this library if you choose to clone from source. If you are not using Typescript, you will need to use a tool like `tsc` to compile the source code. This is because the TETR.IO api is complex and being able to use type checking will greatly reduce the chance of errors. Incorrectly formatted messages sent to the server may cause an account ban.

It is also recommended (but not required) that you add a typescript path mapping to the `src` directory in your `tsconfig.json` file. This will allow you to import the library like so:

```ts
import { Client } from "@triangle";
```

To do this, add the following to the "compilerOptions" object in your `tsconfig.json` file:

```json
"paths": {
		"@triangle": ["./path/to/triangle/src"]
}
```

## Usage

The following usage examples assume you are using Typescript. They also assume you can use top level await. If you cannot, you will need to wrap the code in an async function.

### Import

Bun:

```ts
import { Client } from "@haelp/teto/bun";
```

> Warning:
> Bun currently segfaults when running the codec vm required for ribbon. This will not be fixed, the issue will only be resovled if a new bun version fixes this bug. For now, we recommend using 'esbuild' to compile/run your code if you use typescript.

Node:

```ts
import { Client } from "@haelp/teto";
```

### Creating a client

```ts
const client = await Client.connect({
  username: "your-username",
  password: "your-password"
});
// or {token: "your-token"}
```

### Creating a room

```ts
const room = await client.rooms.create("private");
console.log("Joined room", room.id);
```

### Joining a public room

```ts
const rooms = await client.rooms.list();
const room = await client.rooms.join(rooms[0].id);
console.log("Joined room", room.id);
```

### Starting a game

The following example presses the hard drop key every 1/2 second

```ts
room.start();
const tick = await client.wait("client.game.start");
tick(async (data) => {
  if (data.frame % 30 === 29) {
    return {
      keys: [
        {
          frame: data.frame,
          key: "hardDrop",
          type: "keydown"
        },
        {
          frame: data.frame + 0.5,
          key: "hardDrop",
          type: "keydown"
        }
      ]
    };
  }
  return {};
});

await client.wait("game.end");
console.log("game over");
```

### Chatting

```ts
room.chat("Hello, world!");
// send a pinned message (when host)
room.chat("Hello, world!", true);
```

### Listening for chat messages

```ts
client.on("room.chat", (data) => {
  console.log(data.user, "says", data.content);
});
```

## Events

The triangle.js client follows an async/await based method, while TETR.IO generally has a event/callback based system. To help facilitate the connection between these two systems, the client provides several helper methods.

All of these methods are typed, so your ide will likely assist with autocomplete. All events are in src/types/events

`client.emit` - Takes in an event (sent as "command" to TETR.IO) and optionally a data parameter (sent as "data")

```ts
client.emit(<event>, <data>);
```

`client.wait` - Waits for an event to occur and returns a promise of the data in the event.

```ts
const data = await client.wait(<event>);
```

`client.wrap` - Sends an event and waits for a return event. Throws an error if the server responds with an "err" message while waiting.

```ts
const data = await client.wrap(<send event>, <data>, <receive event>);
```

For events that you might want to handle multiple times, you can use `client.on`, `client.off`, and `client.once` (node EventEmitter methods).

### Client Events

Client events are not sent by TETR.IO. They are events sent by the triangle.js client itself, to help make creating a bot easier.

For example the `client.room.players` event fires every time a player moves their bracket, joins, or leaves. Rather than listening to several events and managing a players list yourself (with `room.player.add`, `room.player.remove`, `room.update`, `room.update.bracket`, etc) you can use the single `client.room.players`. See src/types/events/in/client for more events you can use.

## Other notes

To run and debug your code, it is best to use [bun](https://bun.sh)

You should store credentials in a `.env` file. Bun will automatically load this file and make the variables available in your code. You can also use the `dotenv` package to load the file manually.

The code should only be used on an authorized bot account (or you risk being banned)
It is recommended to set a custom `userAgent` in the client options to identify your bot to the server.

Be careful with what variables you save and where. Due to the event-based nature of TETR.IO and this library, it is easy to accidentally create a memory leak.
For example, the "tick" function exposed on the "client.game.start" event is used for this reason.

## Building

Install bun if you haven't already:

```bash
curl -fsSL https://bun.sh/install | bash
```

Then run:

```bash
bun run build
```

## Contributing

File an issue and make a pull request on github

## Credits

- Made by [halp](https://github.com/Genius6942) [(website under construction)](https://haelp.dev)

- Thanks to [luke](https://github.com/encryptluke) and [redstone576](https://github.com/redstone576) for testing this library.

Interested in contribute to the project? Contact `haelp` on discord (Please come with some experience with TETR.IO api and an understanding of this library).
