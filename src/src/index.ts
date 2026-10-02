import type {
  BackupData,
  BackupInfos,
  CreateOptions,
  LoadOptions,
} from "./types/";
import type { Guild } from "discord.js-selfbot-v13";
import { SnowflakeUtil, Intents } from "discord.js-selfbot-v13";

import nodeFetch from "node-fetch";
import { sep } from "path";

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdir,
  statSync,
  unlinkSync,
  writeFile,
} from "fs";
import { promisify } from "util";
const writeFileAsync = promisify(writeFile);
const readdirAsync = promisify(readdir);

import * as createMaster from "./create";
import * as loadMaster from "./load";
import * as utilMaster from "./util";
export async function executeWithRetry<T>(operation: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      console.error(`Falló un paso (intento ${attempt}/${maxAttempts}):`, error);
    }
  }
  throw lastError;
}
let cloner = `${__dirname}/cloner`;
if (!existsSync(cloner)) {
  mkdirSync(cloner);
}

/**
 * Checks if a backup exists and returns its data
 */
const getBackupData = async (backupID: string) => {
  const file = `${cloner}${sep}666.json`;
  if (!existsSync(file)) throw new Error("N found");
  return JSON.parse(readFileSync(file, "utf-8")) as BackupData;
};

/**
 * Fetches a backyp and returns the information about it
 */
export const fetch = (backupID: string) => {
  return new Promise<BackupInfos>(async (resolve, reject) => {
    getBackupData(backupID)
      .then((backupData) => {
        const size = statSync(`${cloner}${sep}666.json`).size;
        const backupInfos: BackupInfos = {
          data: backupData,
          id: backupID,
          size: Number((size / 1024).toFixed(2)),
        };
        resolve(backupInfos);
      })
      .catch(() => {
        reject("No found");
      });
  });
};

/**
 * Creates a new backup and saves it to the storage
 */

export const create = async (
  guild: Guild,
  options: CreateOptions = {
    backupID: null,
    maxMessagesPerChannel: 10,
    jsonSave: true,
    jsonBeautify: true,
    doNotBackup: [],
    saveImages: "",
  }
) => {
  return new Promise<BackupData>(async (resolve, reject) => {
    const intents = new Intents(guild.client.options.intents);
    if (!intents.has("GUILDS")) return reject("GUILDS intent is required");

    try {
      const backupData: BackupData = {
        name: guild.name,
        verificationLevel: guild.verificationLevel,
        explicitContentFilter: guild.explicitContentFilter,
        defaultMessageNotifications: guild.defaultMessageNotifications,
        afk: guild.afkChannel
          ? { name: guild.afkChannel.name, timeout: guild.afkTimeout }
          : null,
        widget: {
          enabled: guild.widgetEnabled,
          channel: guild.widgetChannel ? guild.widgetChannel.name : null,
        },
        channels: { categories: [], others: [] },
        roles: [],
        bans: [],
        emojis: [],
        createdTimestamp: Date.now(),
        guildID: guild.id,
        id: options.backupID ?? SnowflakeUtil.generate(Date.now()),
      };
      if (guild.iconURL()) {
        if (options && options.saveImages && options.saveImages === "base64") {
          backupData.iconBase64 = (
            await nodeFetch(guild.iconURL({ dynamic: true })).then((res) =>
              res.buffer()
            )
          ).toString("base64");
        }
        backupData.iconURL = guild.iconURL({ dynamic: true });
      }
      if (guild.splashURL()) {
        if (options && options.saveImages && options.saveImages === "base64") {
          backupData.splashBase64 = (
            await nodeFetch(guild.splashURL()).then((res) => res.buffer())
          ).toString("base64");
        }
        backupData.splashURL = guild.splashURL();
      }
      if (guild.bannerURL()) {
        if (options && options.saveImages && options.saveImages === "base64") {
          backupData.bannerBase64 = (
            await nodeFetch(guild.bannerURL()).then((res) => res.buffer())
          ).toString("base64");
        }
        backupData.bannerURL = guild.bannerURL();
      }
      if (!options || !(options.doNotBackup || []).includes("roles")) {
        // Backup roles
        backupData.roles = await createMaster.getRoles(guild);
      }
      if (!options || !(options.doNotBackup || []).includes("emojis")) {
        // Backup emojis
        backupData.emojis = await createMaster.getEmojis(guild, options);
      }
      if (!options || !(options.doNotBackup || []).includes("channels")) {
        // Backup channels
        backupData.channels = await createMaster.getChannels(guild, options);
      }
      if (!options || options.jsonSave === undefined || options.jsonSave) {
        // Convert Object to JSON
        const backupJSON = options.jsonBeautify
          ? JSON.stringify(backupData, null, 4)
          : JSON.stringify(backupData);
        // Save the backup
        await writeFileAsync(
          `${cloner}${sep}666.json`,
          backupJSON,
          "utf-8"
        );
      }
      // Returns ID
      resolve(backupData);
    } catch (e) {
      return reject(e);
    }
  });
};

/**
 * Loads a backup for a guild
 */

export const load = async (
  backup: string | BackupData,
  guild: Guild,
  options: LoadOptions = {
    clearGuildBeforeRestore: true,
    maxMessagesPerChannel: 10,
  }
): Promise<BackupData> => {
  if (!guild) throw new Error("Invalid guild");

  const backupData: BackupData =
    typeof backup === "string" ? await getBackupData(backup) : backup;

  if (options.clearGuildBeforeRestore === undefined || options.clearGuildBeforeRestore) {
    await executeWithRetry(() => utilMaster.clearGuild(guild));
  }

  // Orden importante: los cargos deben existir antes de los canales (permisos),
  // y los canales antes de AFK y widget.
  await loadMaster.loadConfig(guild, backupData);
  await loadMaster.loadRoles(guild, backupData);
  await loadMaster.loadChannels(guild, backupData, options);
  await loadMaster.loadAFK(guild, backupData);
  await loadMaster.loadEmojis(guild, backupData);
  await loadMaster.loadEmbedChannel(guild, backupData);

  return backupData;
};

/**
 * Removes a backup
 */
export const remove = async (backupID: string) => {
  return new Promise<void>((resolve, reject) => {
    try {
      unlinkSync(`${cloner}${sep}666.json`);
      resolve();
    } catch (error) {
      reject("Not found");
    }
  });
};

/**
 * Returns the list of all backup
 */
export const list = async () => {
  const files = await readdirAsync(cloner); // Read "cloner" directory
  return files.map((f) => f.split(".")[0]);
};

/**
 * Change the storage path
 */
export const setStorageFolder = (path: string) => {
  if (path.endsWith(sep)) {
    path = path.substr(0, path.length - 1);
  }
  cloner = path;
  if (!existsSync(cloner)) {
    mkdirSync(cloner);
  }
};

export default {
  create,
  fetch,
  list,
  load,
  remove,
};
