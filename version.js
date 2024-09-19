const { version } = require("./package.json");
const fs = require("node:fs");
const path = require("node:path");

fs.writeFileSync(
  path.join(__dirname, "src/utils/version.ts"),
  `export const version = "${version}";`
);

console.log("Version:", version);
