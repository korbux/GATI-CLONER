// Parche para discord.js-selfbot-v13 2.15.1
// Discord ahora envía algunos ajustes de usuario como `null` en el evento READY y la librería
// los lee sin comprobar ("Cannot read properties of null (reading 'all' / 'map')"),
// con lo que el login se queda colgado. Este script añade la comprobación. Es idempotente.
const fs = require("fs");
const path = require("path");

const file = path.join(
  __dirname, "..", "node_modules", "discord.js-selfbot-v13", "src", "managers", "ClientUserSettingManager.js"
);
if (!fs.existsSync(file)) process.exit(0);

let src = fs.readFileSync(file, "utf8");
let changed = 0;
for (const key of ["friend_source_flags", "guild_folders", "restricted_guilds"]) {
  const bad = `if ('${key}' in data) {`;
  const good = `if ('${key}' in data && data.${key}) {`;
  if (src.includes(bad)) {
    src = src.split(bad).join(good);
    changed++;
  }
}
if (changed) {
  fs.writeFileSync(file, src);
  console.log(`[patch-selfbot] aplicado (${changed} correcciones)`);
}
