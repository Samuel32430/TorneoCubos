import type { ScrambleItem } from "@/types/tournament";

const FACES_333 = ["R", "L", "U", "D", "F", "B"] as const;
const MODIFIERS = ["", "'", "2"] as const;

const OPPOSITE_FACE: Record<string, string> = {
  R: "L",
  L: "R",
  U: "D",
  D: "U",
  F: "B",
  B: "F",
};

function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Genera un scramble oficial WCA válido para 3x3x3 (20-22 movimientos).
 * Evita movimientos consecutivos en la misma cara o secuencias redundantes en caras opuestas.
 */
export function generate333Scramble(length = 21): string {
  const moves: string[] = [];
  let lastFace = "";
  let secondLastFace = "";

  while (moves.length < length) {
    const face = FACES_333[getRandomInt(0, FACES_333.length - 1)];

    if (face === lastFace) continue;
    if (secondLastFace === face && OPPOSITE_FACE[face] === lastFace) continue;

    const modifier = MODIFIERS[getRandomInt(0, MODIFIERS.length - 1)];
    moves.push(`${face}${modifier}`);

    secondLastFace = lastFace;
    lastFace = face;
  }

  return moves.join(" ");
}

/**
 * Genera un scramble válido para 2x2x2 (9-11 movimientos, usando únicamente R, U, F).
 */
export function generate222Scramble(length = 10): string {
  const faces = ["R", "U", "F"] as const;
  const moves: string[] = [];
  let lastFace = "";

  while (moves.length < length) {
    const face = faces[getRandomInt(0, faces.length - 1)];
    if (face === lastFace) continue;

    const modifier = MODIFIERS[getRandomInt(0, MODIFIERS.length - 1)];
    moves.push(`${face}${modifier}`);
    lastFace = face;
  }

  return moves.join(" ");
}

/**
 * Genera un scramble para Pyraminx (10-12 movimientos de cuerpo + tips).
 */
export function generatePyraminxScramble(): string {
  const bodyFaces = ["U", "L", "R", "B"] as const;
  const moves: string[] = [];
  let lastFace = "";

  for (let i = 0; i < 11; i++) {
    const available = bodyFaces.filter((f) => f !== lastFace);
    const face = available[getRandomInt(0, available.length - 1)];
    const modifier = Math.random() < 0.5 ? "" : "'";
    moves.push(`${face}${modifier}`);
    lastFace = face;
  }

  // Tips opcionales (u, l, r, b)
  const tips = ["u", "l", "r", "b"];
  for (const tip of tips) {
    if (Math.random() < 0.6) {
      const modifier = Math.random() < 0.5 ? "" : "'";
      moves.push(`${tip}${modifier}`);
    }
  }

  return moves.join(" ");
}

/**
 * Generador para cualquier evento soportado.
 */
export function generateSingleScramble(eventCode: string): string {
  switch (eventCode) {
    case "222":
      return generate222Scramble();
    case "pyram":
      return generatePyraminxScramble();
    case "333":
    case "333oh":
    default:
      return generate333Scramble();
  }
}

/**
 * Genera el paquete oficial de 10 mezclas para una ronda:
 * - 5 mezclas para Grupo A (intentos 1 al 5)
 * - 5 mezclas para Grupo B (intentos 1 al 5)
 */
export function generate10Scrambles(eventCode: string): ScrambleItem[] {
  const items: ScrambleItem[] = [];

  // Grupo A: 5 intentos
  for (let i = 1; i <= 5; i++) {
    items.push({
      id: i,
      group: "A",
      attempt: i,
      sequence: generateSingleScramble(eventCode),
    });
  }

  // Grupo B: 5 intentos
  for (let i = 1; i <= 5; i++) {
    items.push({
      id: i + 5,
      group: "B",
      attempt: i,
      sequence: generateSingleScramble(eventCode),
    });
  }

  return items;
}
