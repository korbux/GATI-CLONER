import type {
    CategoryData,
    ChannelPermissionsData,
    CreateOptions,
    LoadOptions,
    MessageData,
    TextChannelData,
    ThreadChannelData,
    VoiceChannelData
} from './types';
import type {
    CategoryChannel,
    Collection,
    Guild,
    GuildChannelCreateOptions,
    Message,
    OverwriteData,
    Snowflake,
    TextChannel,
    VoiceChannel,
    NewsChannel,
    PremiumTier,
    ThreadChannel
} from 'discord.js-selfbot-v13';
import { configOptions2 } from '../utils/func';
import { t } from '../utils/i18n';
import { theme } from '../utils/theme';

const MaxBitratePerTier: Record<PremiumTier, number> = {
    NONE: 64000,
    TIER_1: 128000,
    TIER_2: 256000,
    TIER_3: 384000
};

/** Contador global de errores de la clonación (se muestra al final). */
export const stats = { errors: 0, channels: 0 };

/**
 * Texto del error + detalle de la petición a Discord cuando existe
 * (método, ruta, código y estado HTTP). Sirve para saber exactamente qué llamada falló.
 */
export function describeError(error: any): string {
    const msg = String(error?.message ?? error).split('\n')[0];
    if (error?.path) {
        const parts = [`${error.method ?? ''} ${error.path}`.trim()];
        if (error.code !== undefined) parts.push(`código ${error.code}`);
        if (error.httpStatus !== undefined) parts.push(`HTTP ${error.httpStatus}`);
        return `${msg} [${parts.join(' · ')}]`;
    }
    return msg;
}

export function logError(message: string, error?: any) {
    stats.errors++;
    const detail = error ? `: ${describeError(error)}` : '';
    console.error(theme.error(message + detail));
}

const debug = (...args: any[]) => {
    if (configOptions2.Debug) console.log('[Debug]', ...args);
};

/**
 * Gets the permissions for a channel
 */
export function fetchChannelPermissions(channel: TextChannel | VoiceChannel | CategoryChannel | NewsChannel) {
    const permissions: ChannelPermissionsData[] = [];
    try {
        channel.permissionOverwrites.cache
            .filter((p) => p.type === 'role')
            .forEach((perm) => {
                const role = channel.guild.roles.cache.get(perm.id);
                if (role) {
                    permissions.push({
                        roleName: role.name,
                        allow: perm.allow.bitfield.toString(),
                        deny: perm.deny.bitfield.toString()
                    });
                }
            });
        debug('Permisos obtenidos:', channel.name, permissions);
    } catch (error) {
        logError(`Error fetching channel permissions for ${channel.name}`, error);
    }
    return permissions;
}

/**
 * Fetches the voice channel data that is necessary for the backup
 */
export async function fetchVoiceChannelData(channel: VoiceChannel): Promise<VoiceChannelData> {
    return {
        type: 'GUILD_VOICE',
        name: channel.name,
        bitrate: channel.bitrate,
        userLimit: channel.userLimit,
        parent: channel.parent ? channel.parent.name : null,
        permissions: fetchChannelPermissions(channel)
    };
}

/**
 * Descarga los últimos N mensajes de un canal (más nuevos primero).
 * Antes devolvía solo la primera tanda de 100 y nunca se llamaba.
 */
export async function fetchChannelMessages(
    channel: TextChannel | NewsChannel | ThreadChannel,
    options: CreateOptions
): Promise<MessageData[]> {
    const messages: MessageData[] = [];
    const max = Number.isFinite(options.maxMessagesPerChannel) ? options.maxMessagesPerChannel : 0;
    let before: Snowflake | undefined;

    while (messages.length < max) {
        const fetched: Collection<Snowflake, Message> = await channel.messages.fetch({
            limit: Math.min(100, max - messages.length),
            ...(before ? { before } : {})
        });
        if (fetched.size === 0) break;
        before = fetched.last().id;

        for (const msg of fetched.values()) {
            if (!msg.author || msg.system) continue;
            messages.push({
                username: msg.author.username,
                avatar: msg.author.displayAvatarURL(),
                content: msg.cleanContent,
                embeds: msg.embeds,
                files: msg.attachments.map((a) => ({ name: a.name, attachment: a.url })),
                pinned: msg.pinned
            });
            if (messages.length >= max) break;
        }
    }
    return messages;
}

/**
 * Fetches the text channel data that is necessary for the backup
 */
export async function fetchTextChannelData(channel: TextChannel | NewsChannel, options: CreateOptions): Promise<TextChannelData> {
    const channelData: TextChannelData = {
        type: channel.type,
        name: channel.name,
        nsfw: channel.nsfw,
        rateLimitPerUser: channel.type === 'GUILD_TEXT' ? channel.rateLimitPerUser : undefined,
        parent: channel.parent ? channel.parent.name : null,
        topic: channel.topic,
        permissions: fetchChannelPermissions(channel),
        messages: [],
        isNews: channel.type === 'GUILD_NEWS',
        threads: []
    };
    debug('Canal:', channelData.name);

    /* Threads (solo los que están en caché/activos) */
    for (const thread of channel.threads.cache.values()) {
        const threadData: ThreadChannelData = {
            type: thread.type,
            name: thread.name,
            archived: thread.archived,
            autoArchiveDuration: thread.autoArchiveDuration,
            locked: thread.locked,
            rateLimitPerUser: thread.rateLimitPerUser,
            messages: []
        };
        try {
            threadData.messages = await fetchChannelMessages(thread, options);
        } catch (error) {
            logError(`Error fetching thread messages for ${thread.name}`, error);
        }
        channelData.threads.push(threadData);
    }

    /* Mensajes del canal (antes este bloque estaba vacío y nunca se guardaban) */
    try {
        channelData.messages = await fetchChannelMessages(channel, options);
        debug(`${channelData.messages.length} mensajes guardados de ${channel.name}`);
    } catch (error) {
        logError(`Error fetching channel messages for ${channel.name}`, error);
    }
    return channelData;
}

function buildOverwrites(guild: Guild, permissions: ChannelPermissionsData[]): OverwriteData[] {
    const finalPermissions: OverwriteData[] = [];
    permissions.forEach((perm) => {
        const role = guild.roles.cache.find((r) => r.name === perm.roleName);
        if (role) {
            finalPermissions.push({ id: role.id, allow: BigInt(perm.allow), deny: BigInt(perm.deny) });
        }
    });
    return finalPermissions;
}

/**
 * Creates a category for the guild
 */
export async function loadCategory(categoryData: CategoryData, guild: Guild): Promise<CategoryChannel> {
    const category = await guild.channels.create(categoryData.name, { type: 'GUILD_CATEGORY' });
    try {
        await category.permissionOverwrites.set(buildOverwrites(guild, categoryData.permissions));
    } catch (error) {
        logError(`No se pudieron aplicar los permisos de la categoría ${categoryData.name}`, error);
    }
    return category;
}

/**
 * Reenvía los mensajes guardados usando un webhook temporal.
 */
async function loadMessages(
    channel: TextChannel | ThreadChannel,
    messages: MessageData[],
    options?: LoadOptions
): Promise<void> {
    const max = options?.maxMessagesPerChannel ?? 0;
    if (!max || !messages || messages.length === 0) return;

    const isThread = channel.isThread();
    const hookChannel = (isThread ? (channel as ThreadChannel).parent : channel) as TextChannel;
    if (!hookChannel) return;

    let webhook;
    try {
        webhook = await hookChannel.createWebhook('MessagesBackup', {
            avatar: channel.client.user.displayAvatarURL()
        });
    } catch (error) {
        logError(`No se pudo crear el webhook en ${channel.name}`, error);
        return;
    }

    // Los mensajes vienen del más nuevo al más viejo: se invierten para enviarlos en orden.
    const ordered = messages
        .filter((m) => (m.content?.length ?? 0) > 0 || (m.embeds?.length ?? 0) > 0 || (m.files?.length ?? 0) > 0)
        .slice(0, max)
        .reverse();

    for (const msg of ordered) {
        try {
            const sent = await webhook.send({
                content: msg.content || undefined,
                username: msg.username && msg.username.length >= 2 ? msg.username : `${msg.username}_`,
                avatarURL: msg.avatar,
                embeds: msg.embeds,
                files: msg.files,
                allowedMentions: options?.allowedMentions ?? { parse: [] },
                ...(isThread ? { threadId: channel.id } : {})
            });
            if (msg.pinned && sent && !isThread) await (sent as Message).pin().catch(() => {});
        } catch (error: any) {
            logError(`No se pudo reenviar un mensaje en ${channel.name}`, error);
        }
    }

    try {
        await webhook.delete();
    } catch {
        /* no pasa nada si no se puede borrar */
    }
}

/**
 * Create a channel and returns it (o null si falla / se ignora)
 */
export async function loadChannel(
    channelData: TextChannelData | VoiceChannelData,
    guild: Guild,
    category?: CategoryChannel | null,
    options?: LoadOptions
) {
    // Antes esto hacía `return null` sin resolver la promesa y el clonador se quedaba colgado.
    if (channelData.name.startsWith('ticket-') && configOptions2.ignoreTickets) {
        console.log(channelData.name + t('ignoreticketmsg'));
        return null;
    }

    const createOptions: GuildChannelCreateOptions = {
        type: null,
        parent: category ?? undefined
    };

    if (channelData.type === 'GUILD_TEXT' || channelData.type === 'GUILD_NEWS') {
        const text = channelData as TextChannelData;
        createOptions.topic = text.topic ?? undefined;
        createOptions.nsfw = text.nsfw;
        createOptions.rateLimitPerUser = text.rateLimitPerUser;
        createOptions.type = text.isNews && guild.features.includes('NEWS') ? 'GUILD_NEWS' : 'GUILD_TEXT';
    } else if (channelData.type === 'GUILD_VOICE') {
        const voice = channelData as VoiceChannelData;
        const maxBitrate = MaxBitratePerTier[guild.premiumTier] ?? MaxBitratePerTier.NONE;
        createOptions.bitrate = Math.min(voice.bitrate ?? maxBitrate, maxBitrate);
        if (voice.userLimit <= 99) createOptions.userLimit = voice.userLimit;
        createOptions.type = 'GUILD_VOICE';
    } else {
        return null; // tipo no soportado
    }

    try {
        const channel = await guild.channels.create(channelData.name, createOptions);

        try {
            await channel.permissionOverwrites.set(buildOverwrites(guild, channelData.permissions));
        } catch (error) {
            logError(`No se pudieron aplicar los permisos de ${channelData.name}`, error);
        }

        if (channelData.type === 'GUILD_TEXT') {
            const text = channelData as TextChannelData;

            for (const threadData of text.threads ?? []) {
                try {
                    const thread = await (channel as TextChannel).threads.create({
                        name: threadData.name,
                        autoArchiveDuration: threadData.autoArchiveDuration,
                        type: 'GUILD_PUBLIC_THREAD'
                    } as any);
                    await loadMessages(thread, threadData.messages, options);
                } catch (error) {
                    logError(`No se pudo crear el hilo ${threadData.name}`, error);
                }
            }

            await loadMessages(channel as TextChannel, text.messages, options);
        }
        stats.channels++;
        console.log(theme.ok(t(channelData.type === 'GUILD_VOICE' ? 'voicechannelcreate' : 'textchannelcreate') + channelData.name));
        return channel;
    } catch (error) {
        logError(`Error creando el canal ${channelData.name}`, error);
        return null;
    }
}

/**
 * Delete all roles, all channels and all emojis of a guild.
 * Ahora espera de verdad a que termine cada borrado (antes usaba forEach(async) sin await).
 * Ya no desbanea usuarios ni borra integraciones del servidor destino.
 */
export async function clearGuild(guild: Guild) {
    const safe = async (label: string, fn: () => Promise<unknown>) => {
        try {
            await fn();
        } catch (error: any) {
            console.error(theme.error(`No se pudo ${label}: ${error?.message ?? error}`));
        }
    };

    for (const channel of [...guild.channels.cache.values()]) {
        await safe(`borrar el canal ${channel.name}`, () => channel.delete());
    }

    const roles = [...guild.roles.cache.values()].filter((r) => !r.managed && r.editable && r.id !== guild.id);
    for (const role of roles) {
        await safe(`borrar el cargo ${role.name}`, () => role.delete());
    }

    for (const emoji of [...guild.emojis.cache.values()]) {
        await safe(`borrar el emoji ${emoji.name}`, () => emoji.delete());
    }

    await safe('quitar el canal AFK', () => guild.setAFKChannel(null));
    await safe('restablecer el timeout AFK', () => guild.setAFKTimeout(60 * 5));
    await safe('quitar el icono', () => guild.setIcon(null));
    await safe('quitar el banner', () => guild.setBanner(null));
    await safe('quitar el splash', () => guild.setSplash(null));
    await safe('restablecer notificaciones', () => guild.setDefaultMessageNotifications('ONLY_MENTIONS'));
    await safe('desactivar el widget', () => guild.setWidgetSettings({ enabled: false, channel: null }));
    if (!guild.features.includes('COMMUNITY')) {
        await safe('restablecer el filtro de contenido', () => guild.setExplicitContentFilter('DISABLED'));
        await safe('restablecer el nivel de verificación', () => guild.setVerificationLevel('NONE'));
    }
    await safe('quitar el canal del sistema', () => guild.setSystemChannel(null));
}
