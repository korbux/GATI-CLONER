// Estos dos van primero a propósito: no dependen de nada, y así existen aunque este archivo
// se cargue en medio del arranque (hay imports circulares con index.ts).
import { setlang, getLang, t, tx, DISCORD_LINK } from "./i18n";
import { theme } from "./theme";
import chalk from "chalk";
import backup from "../src/index";
import boxen from "boxen";
import { rl } from "../index";

import { Client, Guild } from "discord.js-selfbot-v13";
import { stats, describeError } from "../src/util";
export function choiceinit(client: Client) {
  let clearall = () => {
    creatorname();
    menutext(client);
    choiceinit(client);
  };
  rl.question(
    theme.prompt(t("optionPrompt")),
    async (choice: string) => {
      choice = choice.trim();
      switch (choice) {
        case "":
        case "back":
        case "volver":
          clearall();
          break;
        case "1":
          creatorname();
          await client.guilds.fetch();
          configop(client);
          break;
        case "2":
          creatorname();
          infouser(client);
          break;
        case "3":
          creatorname();
          serverinfo(client);
          break;
        case "4":
          creatorname();
          console.log(theme.main(`Discord: ${DISCORD_LINK}`));
          awaitenter(client);
          break;
        case "5":
          creatorname();
          changelang(client);
          break;
        default:
          clearall();
      }
    }
  );
}

export function creatorname() {
  console.clear();
  const banner = [
    " ██████╗  █████╗ ████████╗██╗",
    "██╔════╝ ██╔══██╗╚══██╔══╝██║",
    "██║  ███╗███████║   ██║   ██║",
    "██║   ██║██╔══██║   ██║   ██║",
    "╚██████╔╝██║  ██║   ██║   ██║",
    " ╚═════╝ ╚═╝  ╚═╝   ╚═╝   ╚═╝",
  ];
  // Letras (█) en degradado verde de arriba a abajo; la sombra en gris muy oscuro,
  // porque el negro puro no se vería sobre el fondo negro del CMD.
  const greens = ["#39ff14", "#2ee610", "#22cc0c", "#1aa80a", "#118008", "#0a5c05"];
  // Con colores extendidos: gris casi negro. Sin ellos, "gris oscuro" estándar (el negro puro se pierde).
  const shadow = chalk.level >= 2 ? chalk.hex("#2b2b2b") : chalk.blackBright;
  const art = banner
    .map((row, i) =>
      [...row]
        .map((ch) => (ch === "█" ? chalk.hex(greens[i])(ch) : ch === " " ? ch : shadow(ch)))
        .join("")
    )
    .join("\n");
  console.log("\n" + art);
  console.log(theme.dim("  ·· " + t("tagline") + " ··") + "\n");
}

export function menutext(client: Client) {
  creatorname();
  const goodbyegudog = getLang() === "pt" ? theme.main(["[0] Nos despedimos do Gudog com carinho, Adeus gudog\n","[0] Em homenagem ao gudog, Descanse em paz\n","[0] Em memória do Gudog, um administrador que nos deixou. Adeus, amigo\n"][Math.floor(Math.random() * 3)]) : null;
  console.log((goodbyegudog ? goodbyegudog : '') + theme.menu(t("menuText")));
}


export function infouser(client: Client) {
  creatorname();
  const u = client.user;
  const row = (es: string, en: string, pt: string, value: unknown) => `${tx(es, en, pt)}: ${value}`;
  const lines = [
    row("Nombre de la cuenta", "Account name", "Nome da conta", u.username),
    row("Nombre global", "Global name", "Nome global", u.globalName),
    row("Avatar", "Avatar", "Avatar", u.avatarURL({ format: "png", dynamic: true, size: 1024 })),
    row("Banner", "Banner", "Banner", u.bannerURL({ format: "png", dynamic: true })),
    row("ID", "ID", "ID", u.id),
    row("Cuenta creada el", "Account created", "Conta criada em", u.createdAt),
    row("Servidores", "Servers", "Servidores", client.guilds.cache.size),
    row("Nitro", "Nitro", "Nitro", u.nitroType),
    row("Correo", "Email", "Email", u.emailAddress),
    row("Celular", "Phone", "Celular", u.phoneNumber),
    row("Idioma de Discord", "Discord language", "Idioma do Discord", client.settings.locale),
    row("Tema", "Theme", "Tema", client.settings.theme),
    row("Modo desarrollador", "Developer mode", "Modo desenvolvedor", client.settings.developerMode),
    row("Tiempo AFK", "AFK timeout", "Tempo AFK", client.settings.afkTimeout),
    row("Escaneo de DMs", "DM scan level", "Nível de scan de DMs", client.settings.DMScanLevel),
    row("Modo compacto", "Compact mode", "Modo compacto", client.settings.compactMode),
    row("Vista previa de links", "Link preview", "Preview de links", client.settings.previewLink),
  ];
  console.log(theme.main(lines.join("\n")));
  awaitenter(client);
}

export async function Cloner(
  client: Client,
  configOptions: {
    maxMessagesPerChannel: number;
    jsonSave: boolean;
    jsonBeautify: boolean;
    doNotBackup: string[];
  },
  // Solo se clona hacia un servidor que ya existe (Discord bloquea crear servidores desde la cuenta).
) {
  const started = process.hrtime();
  stats.errors = 0;
  stats.channels = 0;
  const prompt = (key: string) => espop(theme.prompt(t(key)));
  const fail = (msg: string) => {
    console.error(theme.error(msg));
    awaitenter(client);
  };

  const sourceId = await prompt("ServerID");
  const destId = await prompt("ServerID2");

  let step = tx("leer tus servidores", "reading your servers", "ler seus servidores");
  try {
    await client.guilds.fetch();
    const source = client.guilds.cache.get(sourceId);
    if (!source) return fail(t("idservererror"));

    const target: Guild = client.guilds.cache.get(destId);
    if (!target) return fail(t("invalidid"));
    if (target.id === source.id) {
      return fail(tx("El servidor de origen y el de destino no pueden ser el mismo.", "Source and destination can't be the same server.", "O servidor de origem e o de destino não podem ser o mesmo."));
    }
    // El destino se vacía por completo: se pide confirmación explícita.
    console.log(
      theme.error(
        tx(
          `¡OJO! Voy a BORRAR todos los canales, roles y emojis de "${target.name}".`,
          `WARNING: every channel, role and emoji in "${target.name}" will be DELETED.`,
          `ATENÇÃO: todos os canais, cargos e emojis de "${target.name}" serão APAGADOS.`
        )
      )
    );
    const answer = (await espop(tx('Escribe BORRAR para seguir: ', 'Type DELETE to continue: ', 'Digite APAGAR para continuar: '))).toUpperCase();
    if (!["BORRAR", "APAGAR", "DELETE"].includes(answer)) {
      return fail(tx("Cancelado. No toqué nada.", "Cancelled. Nothing was changed.", "Cancelado. Nada foi alterado."));
    }

    console.log(theme.main(t("initcloner")));
    step = tx("leer el servidor original", "reading the source server", "ler o servidor original");
    const data = await backup.create(source, {
      maxMessagesPerChannel: configOptions.maxMessagesPerChannel,
      jsonSave: configOptions.jsonSave,
      jsonBeautify: configOptions.jsonBeautify,
      doNotBackup: configOptions.doNotBackup,
    });

    step = tx("restaurar en el servidor de destino", "restoring into the destination server", "restaurar no servidor de destino");
    // Se pasa el backup en memoria (antes se releía 666.json, que falla si jsonSave está desactivado).
    await backup.load(data, target, {
      clearGuildBeforeRestore: true,
      maxMessagesPerChannel: configOptions.maxMessagesPerChannel,
    });

    const elapsed = process.hrtime(started);
    console.log(theme.finish(t("msgfinalcloner") + Tempoex(elapsed[0] + elapsed[1] / 1e9)));
    console.log(theme.finish(t("channelnumber") + stats.channels));
    console.log(theme.finish(t("errorcloning") + stats.errors));

    console.log(theme.ok(t("clonedone")));
    awaitenter(client);
  } catch (error: any) {
    console.error(theme.error(`${tx("Uy, falló la clonación", "The cloning failed", "A clonagem falhou")} (${tx("paso", "step", "etapa")}: ${step}): ${describeError(error)}`));
    awaitenter(client);
  }
}
export async function serverinfo(client: Client) {
  async function fetchGuildData(guildId: string) {
    try {
      const guild = await client.guilds.fetch(guildId);
      const preview = await guild.fetchPreview();
      creatorname();
      const show = (label: string, value: unknown) => console.log(theme.main(`${label}: ${value}`));
      show(tx("Nombre del servidor", "Server name", "Nome do servidor"), preview.name);
      show(tx("Descripción", "Description", "Descrição"), preview.description);
      show(tx("Miembros", "Members", "Membros"), preview.approximateMemberCount);
      show(tx("Miembros en línea", "Members online", "Membros online"), preview.approximatePresenceCount);
      show(tx("Creado el", "Created at", "Criado em"), preview.createdAt);
      show(tx("ID del servidor", "Server ID", "ID do servidor"), preview.id);
      if (preview.icon) show(tx("Ícono", "Icon", "Ícone"), preview.iconURL());
      if (preview.splash) show("Splash", preview.splashURL());
      if (preview.discoverySplash) show(tx("Splash de descubrimiento", "Discovery splash", "Splash de descoberta"), preview.discoverySplashURL());
      show(tx("Funciones", "Features", "Recursos"), preview.features.join(", "));
      show("Emojis", preview.emojis.size);
      show("Stickers", preview.stickers.size);
    } catch (error) {
      console.error(theme.error(tx("Uy, algo salió mal:", "Something went wrong:", "Algo deu errado:")), error);
    }
    awaitenter(client);
  }
  rl.question(theme.prompt(t('ServerID')), (guildId: string) => {
    fetchGuildData(guildId.trim());
  });
}
export const configOptions2: any = {
  ignoreTickets: false,
  Debug: false,
};
export const configOptions: any = {
  maxMessagesPerChannel: 0,
  jsonSave: true,
  jsonBeautify: true,
  doNotBackup: ["bans"],
};

export async function configop(client: Client) {
  creatorname();
  console.log(theme.prompt(t('configcloner')));

  const run = async () => {
    console.clear();
    creatorname();
    await Cloner(client, configOptions);
  };

  while (true) {
    const tableContent = `
    ${theme.label("O:")} ${theme.prompt(t("msgcloner"))}
    ${theme.label("V:")} ${theme.lime(configOptions.maxMessagesPerChannel)}
    ${theme.label("O:")} ${theme.prompt(t("savejsonconfig"))}
    ${theme.label("V:")} ${configOptions.jsonSave ? chalk.green(t("yes")) : theme.dim(t("no"))}
    ${theme.label("O:")} ${theme.prompt(t('beautifuljson'))}
    ${theme.label("V:")} ${configOptions.jsonBeautify ? chalk.green(t("yes")) : theme.dim(t("no"))}
    ${theme.label("O:")} ${theme.prompt(t('noclone'))}
    ${theme.label("V:")} ${theme.lime(configOptions.doNotBackup.join(", "))}
    ${theme.label("O:")} ${theme.prompt(t('ignoretickets'))}
    ${theme.label("V:")} ${configOptions2.ignoreTickets ? chalk.green(t("yes")) : theme.dim(t("no"))}
    ${theme.label("O:")} ${theme.prompt("Debug?")}
    ${theme.label("V:")} ${configOptions2.Debug ? chalk.green(t("yes")) : theme.dim(t("no"))}
    `;
    console.log(
      boxen(tableContent, {
        borderStyle: {
          topLeft: "╭", topRight: "╮", bottomLeft: "╰", bottomRight: "╯",
          horizontal: "─", vertical: "│", top: "─", right: "│", bottom: "─", left: "│",
        },
        padding: 2,
        margin: 2,
        borderColor: "green",
        backgroundColor: "#1A1A1A",
      })
    );

    try {
      const choice = await espop(theme.prompt(t('option234')));

      if (choice === "1") {
        const n = parseInt(await espop(theme.prompt(t('cloningmessage'))), 10);
        configOptions.maxMessagesPerChannel = Number.isNaN(n) || n < 0 ? 0 : n;
        configOptions.jsonSave = await yop(theme.prompt(t("savejsoninput")));
        configOptions.jsonBeautify = await yop(theme.prompt(t("beautifuljson")));
        configOptions.doNotBackup = (await espop(theme.prompt(t("noclonerinput"))))
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);
        configOptions2.ignoreTickets = await yop(theme.prompt(t("ignoreticketsinput")));
        configOptions2.Debug = await yop(theme.prompt(t("debugoption")));
        await run();
        return;
      } else if (choice === "2") {
        await run();
        return;
      } else if (choice === "3") {
        console.clear();
        creatorname();
        menutext(client);
        choiceinit(client);
        return;
      } else {
        console.log(theme.error(t('undefinedfunc')));
      }
    } catch (error) {
      console.error(theme.error(t('error2'), error));
      awaitenter(client);
      return;
    }
  }
}


async function yop(question: string): Promise<boolean> {
  const answer = await espop(question + theme.finish((t('yandn'))));
  return answer === "1";
}

function espop(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer: string) => {
      resolve(answer.trim());
    });
  });
}

function Tempoex(timeInSeconds: number) {
  const hours = Math.floor(timeInSeconds / 3600);
  const minutes = Math.floor((timeInSeconds % 3600) / 60);
  const seconds = Math.floor(timeInSeconds % 60);

  const hoursStr = hours.toString().padStart(2, "0");
  const minutesStr = minutes.toString().padStart(2, "0");
  const secondsStr = seconds.toString().padStart(2, "0");

  if (hours > 0) {
    return `${hoursStr}:${minutesStr}:${secondsStr}`;
  } else {
    return `${minutesStr}:${secondsStr}`;
  }
}
function awaitenter(client: Client) {
  rl.question(
    theme.prompt(t('awaitenter')),
    () => {
      menutext(client);
      choiceinit(client);
    }
  );
}
function changelang(client: Client) {
  const l = getLang();
  setlang(l === "es" ? "en" : l === "en" ? "pt" : "es");
  creatorname();
  menutext(client);
  choiceinit(client);
}
