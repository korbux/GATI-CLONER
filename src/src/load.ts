import type { Guild, Role, VoiceChannel } from 'discord.js-selfbot-v13';
import { theme } from '../utils/theme';
import type { BackupData, CategoryData, LoadOptions, TextChannelData, VoiceChannelData } from './types';
import { loadCategory, loadChannel, logError } from './util';
import { t } from '../utils/i18n';

/**
 * Restores the guild configuration.
 * Cada ajuste se aplica por separado: si uno falla (p. ej. banner sin boosts) los demás siguen.
 */
export const loadConfig = async (guild: Guild, backupData: BackupData): Promise<void> => {
    const tasks: [string, () => Promise<unknown>][] = [];
    if (backupData.name) tasks.push(['nombre', () => guild.setName(backupData.name)]);

    if (backupData.iconBase64) tasks.push(['icono', () => guild.setIcon(Buffer.from(backupData.iconBase64, 'base64'))]);
    else if (backupData.iconURL) tasks.push(['icono', () => guild.setIcon(backupData.iconURL)]);

    if (backupData.splashBase64) tasks.push(['splash', () => guild.setSplash(Buffer.from(backupData.splashBase64, 'base64'))]);
    else if (backupData.splashURL) tasks.push(['splash', () => guild.setSplash(backupData.splashURL)]);

    if (backupData.bannerBase64) tasks.push(['banner', () => guild.setBanner(Buffer.from(backupData.bannerBase64, 'base64'))]);
    else if (backupData.bannerURL) tasks.push(['banner', () => guild.setBanner(backupData.bannerURL)]);

    if (backupData.verificationLevel) tasks.push(['nivel de verificación', () => guild.setVerificationLevel(backupData.verificationLevel)]);
    if (backupData.defaultMessageNotifications !== undefined) {
        tasks.push(['notificaciones', () => guild.setDefaultMessageNotifications(backupData.defaultMessageNotifications as any)]);
    }
    if (backupData.explicitContentFilter && guild.features.includes('COMMUNITY')) {
        tasks.push(['filtro de contenido', () => guild.setExplicitContentFilter(backupData.explicitContentFilter)]);
    }

    for (const [label, fn] of tasks) {
        try {
            await fn();
        } catch (error) {
            logError(`No se pudo aplicar ${label} (se omite)`, error);
        }
    }
};

/**
 * Restore the guild roles.
 * Se crean uno a uno en el orden guardado (del más alto al más bajo): Discord añade cada cargo nuevo
 * justo encima de @everyone, así que el orden final coincide con el original.
 */
export const loadRoles = async (guild: Guild, backupData: BackupData): Promise<Role[]> => {
    const created: Role[] = [];

    for (const roleData of backupData.roles ?? []) {
        try {
            if (roleData.isEveryone) {
                const everyoneRole = guild.roles.cache.get(guild.id);
                // Solo se copian los permisos: @everyone no se puede renombrar ni recolorear.
                if (everyoneRole) await everyoneRole.setPermissions(BigInt(roleData.permissions));
                continue;
            }
            const role = await guild.roles.create({
                name: roleData.name,
                color: roleData.color,
                hoist: roleData.hoist,
                permissions: BigInt(roleData.permissions),
                mentionable: roleData.mentionable
            });
            created.push(role);
            console.log(theme.ok(t('rolecreate') + role.name));
        } catch (error) {
            logError(`No se pudo crear el cargo ${roleData.name}`, error);
        }
    }
    return created;
};

/**
 * Restore the guild channels (en orden, para que las posiciones coincidan con el original)
 */
export const loadChannels = async (guild: Guild, backupData: BackupData, options: LoadOptions): Promise<void> => {
    for (const categoryData of backupData.channels.categories as CategoryData[]) {
        try {
            const category = await loadCategory(categoryData, guild);
            console.log(theme.ok(t('categorycreate') + category.name));
            for (const channelData of categoryData.children as (TextChannelData | VoiceChannelData)[]) {
                await loadChannel(channelData, guild, category, options);
            }
        } catch (error) {
            logError(`Error creando la categoría ${categoryData.name}`, error);
        }
    }

    for (const channelData of backupData.channels.others as (TextChannelData | VoiceChannelData)[]) {
        await loadChannel(channelData, guild, null, options);
    }
};

/**
 * Restore the afk configuration
 */
export const loadAFK = async (guild: Guild, backupData: BackupData): Promise<void> => {
    if (!backupData.afk) return;
    try {
        const afkChannel = guild.channels.cache.find(
            (ch) => ch.name === backupData.afk.name && ch.type === 'GUILD_VOICE'
        ) as VoiceChannel | undefined;
        if (afkChannel) await guild.setAFKChannel(afkChannel);
        await guild.setAFKTimeout(backupData.afk.timeout);
    } catch (error) {
        logError('No se pudo restaurar la configuración AFK', error);
    }
};

/**
 * Restore guild emojis (uno a uno: Discord limita mucho la creación de emojis)
 */
export const loadEmojis = async (guild: Guild, backupData: BackupData): Promise<void> => {
    for (const emoji of backupData.emojis ?? []) {
        try {
            if (emoji.url) await guild.emojis.create(emoji.url, emoji.name);
            else if (emoji.base64) await guild.emojis.create(Buffer.from(emoji.base64, 'base64'), emoji.name);
            else continue;
            console.log(theme.ok(t('emojicreate') + emoji.name));
        } catch (error) {
            logError(`No se pudo crear el emoji ${emoji.name}`, error);
        }
    }
};

/**
 * Restore guild bans
 */
export const loadBans = async (guild: Guild, backupData: BackupData): Promise<void> => {
    for (const ban of backupData.bans ?? []) {
        try {
            await guild.members.ban(ban.id, { reason: ban.reason });
        } catch (error) {
            logError(`No se pudo banear a ${ban.id}`, error);
        }
    }
};

/**
 * Restore embedChannel (widget) configuration
 */
export const loadEmbedChannel = async (guild: Guild, backupData: BackupData): Promise<void> => {
    if (!backupData.widget?.channel) return;
    try {
        const channel = guild.channels.cache.find((ch) => ch.name === backupData.widget.channel);
        if (channel) await guild.setWidgetSettings({ enabled: backupData.widget.enabled, channel });
    } catch (error) {
        logError('No se pudo restaurar el widget', error);
    }
};
