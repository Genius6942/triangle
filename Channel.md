# Triangle.js Tetra Channel API
This is the documentation for the subsection of Triangle.js that interacts with the public `https://ch.tetr.io/api` api. For the full documentation, see the [main README](/).

## Usage

### Import
```ts
import { ch } from "@haelp/teto";
```
Or
```ts
// only load the required channel api module
import { ch } from "@haelp/teto/ch";
```

### Handling the SessionID
```ts
ch.setSessionID("your-session-id");
const id = ch.getSessionID();
```

## Methods
There are 4 different types of requests that the api can make. Here is an explanation of each one:

### Empty requests
These send no data to the server.
Example:
```ts
const res = await ch.general.stats();
```

### Argument only requests
These send data in the form of arugments in the request uri.
Example:
```ts
// This sends a request to https://ch.tetr.io/api/users/halp
const res = await ch.users.get("halp");
```
Or
```ts
const res = await ch.users.get({ user: halp });
```

### Query param only requests
These send data in the form of query parameters.
Example:
```ts
// This sends a request to https://ch.tetr.io/api/news/?limit=100
const res = await ch.news.all({ limit: 100 });
```

### Query param and argument requests
These send data in the form of query parameters and arguments in the request uri.
Example:
```ts
// This sends a request to https://ch.tetr.io/api/users/by/xp?limit=100
const res = await ch.users.leaderboard("xp", { limit: 100 });
```

[View the official docs](https://tetr.io/about/api) for more information on the api.
