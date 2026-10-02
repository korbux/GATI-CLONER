import transjson from "./translations.json";

/**
 * Idioma y textos. Este módulo no importa nada del resto del programa a propósito:
 * así está listo desde el primer instante (el banner se dibuja durante el arranque).
 */
export type Lang = "es" | "en" | "pt";

const translations = transjson as Record<string, Record<string, string>>;
let current: Lang = "es";

export const DISCORD_LINK = "https://discord.gg/AkE7ksEQKb";

export function setlang(lang: Lang) {
  current = lang;
}

export function getLang(): Lang {
  return current;
}

/** Texto del JSON de idiomas (si falta en el idioma actual, cae al español y luego al inglés). */
export function t(key: string): string {
  return translations[current]?.[key] || translations.es?.[key] || translations.en?.[key] || key;
}

/** Texto escrito directo en el código, en los tres idiomas (español por defecto). */
export const tx = (es: string, en: string, pt: string = en) =>
  current === "es" ? es : current === "pt" ? pt : en;
