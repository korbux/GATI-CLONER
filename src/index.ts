import Discord from "discord.js-selfbot-v13";
import readline from "readline";
import dotenv from "dotenv";
import { theme } from "./utils/theme";
import { choiceinit, menutext, creatorname } from "./utils/func";
import { tx } from "./utils/i18n";
import transjson from './utils/translations.json';
dotenv.config();
process.title = "GATI CLONER";

export const client = new Discord.Client({
  checkUpdate: false,
  partials: [],
});

export const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

// Un error suelto de una promesa no debe tumbar una clonación en curso, pero si ocurre
// antes de conectar (login/READY) hay que mostrarlo y salir, no quedarse girando.
process.on("unhandledRejection", (reason: any) => {
  const message = reason?.message ?? String(reason);
  if (!client.isReady()) {
    stopSpinner();
    console.error(theme.error(`\n${tx("Error al conectar", "Connection error", "Erro ao conectar")}: ${message}`));
    console.error(theme.error(tx("Si el error persiste, revisa que tu token sea válido y vuelve a intentarlo.", "If it keeps failing, check your token is valid and try again.", "Se o erro persistir, confira se o token é válido e tente de novo.")));
    process.exit(1);
  }
  console.error(theme.error(`[unhandledRejection] ${message}`));
});

let spinner: NodeJS.Timeout | null = null;
function startSpinner() {
  let dots = 0;
  spinner = setInterval(() => {
    process.stdout.write(`\r${theme.prompt(`${tx("Conectando", "Connecting", "Conectando")}${'.'.repeat(dots)}   `)}`);
    dots = (dots + 1) % 4;
  }, 500);
}
function stopSpinner() {
  if (spinner) clearInterval(spinner);
  spinner = null;
  process.stdout.write("\r\x1b[K");
}

client.on("ready", () => {
  stopSpinner();
  menutext(client);
  choiceinit(client);
});

function login(token: string) {
  startSpinner();
  client.login(token).catch((error) => {
    stopSpinner();
    const invalid = /invalid token/i.test(error?.message ?? "");
    console.error(theme.error(invalid ? tx("Token inválido", "Invalid token", "Token inválido") : `${tx("Error de inicio de sesión", "Login error", "Erro de login")}: ${error?.message ?? error}`));
    process.exit(1);
  });
}

const envToken = process.env.TOKEN?.trim();
if (envToken) {
  console.clear();
  login(envToken);
} else {
  console.clear();
  creatorname();
  rl.question(theme.prompt(tx("Tu token (el de tu cuenta, NO el de un bot)\n» ", "Your token (your account token, NOT a bot token)\n» ", "Seu token (o da sua conta, NÃO de bot)\n» ")), (input) => {
    const token = input.trim();
    if (!token) {
      console.log(theme.error(tx("El token está vacío", "The token is empty", "O token está vazio")));
      process.exit(1);
    }
    login(token);
  });
}

export type Translations = {
  es: { [key: string]: string };
  en: { [key: string]: string };
  pt: { [key: string]: string };
};
export const translations: Partial<Translations> = transjson;
