import gradient from "gradient-string";
import chalk from "chalk";

/**
 * Tema verde/negro del programa. Todos los colores salen de aquí:
 * para cambiar el estilo basta con editar este archivo.
 */
export const theme = {
  /** Texto principal: menú, títulos, información. */
  main: gradient(["#39ff14", "#22cc0c", "#118008"]),
  /** Preguntas y entradas del usuario. */
  prompt: gradient(["#b6ff9e", "#39ff14"]),
  /** Pasos completados (cargo, categoría, canal, emoji creado). */
  ok: gradient(["#39ff14", "#0fae0a"]),
  /** Resumen final. */
  finish: gradient(["#eaff00", "#39ff14"]),
  /** Errores: se quedan en rojo para que se distingan del resto. */
  error: gradient(["#ff3b30", "#ff6b5a"]),

  /** Etiquetas y números de opción. */
  label: chalk.hex("#39ff14"),
  /** Valores destacados. */
  lime: chalk.hex("#b6ff9e"),
  /** Valor "no"/desactivado. */
  dim: chalk.gray,

  /** Menú principal: "[n]" en verde neón y la descripción en verde más suave. */
  menu(text: string): string {
    return text
      .split("\n")
      .map((line) => {
        const m = line.match(/^(\[[^\]]+\])(.*)$/);
        if (m) return chalk.hex("#39ff14").bold(m[1]) + chalk.hex("#22cc0c")(m[2]);
        if (line.trim() === "") return line;
        return chalk.hex("#118008")(line); // avisos, p. ej. "[Warn] ..."
      })
      .join("\n");
  },
};
