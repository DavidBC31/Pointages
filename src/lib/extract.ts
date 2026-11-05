/**
 * Extraction heuristique du chiffre de pointage depuis une réponse en texte libre.
 *
 * Volontairement conservateur : on remonte des CANDIDATS avec leur contexte,
 * jamais une valeur « certaine ». La validation humaine (Emma) tranche — c'est
 * le point du cahier des charges. Un passage IA pourra raffiner `best` plus tard
 * sans changer l'interface.
 */
export interface FigureCandidate {
  value: number;
  context: string; // extrait du texte autour du nombre
  score: number; // plus haut = plus probable
}
export interface Extraction {
  best: number | null;
  candidates: FigureCandidate[];
}

// Mots qui, à proximité d'un nombre, signalent un pointage.
const KEYWORDS =
  /(vendu|vendus|vente|ventes|billet|billets|place|places|pax|total|pointage|écoulé|ecoule|à ce jour|a ce jour|on est à|on est a)/i;
// Contextes à écarter (dates, heures, téléphone, jauge/capacité…).
const NEGATIVE = /(jauge|capacit|invit|%|€|\bh\b|heure|rue|tél|tel|\/20\d{2}|\d{2}:\d{2})/i;

/** "1 234", "1.234", "1 234" → 1234 ; renvoie null si improbable. */
function parseNumber(raw: string): number | null {
  const n = Number(raw.replace(/[ .  ]/g, ""));
  if (!Number.isFinite(n) || n < 0 || n > 500000) return null;
  return n;
}

export function extractFigure(text: string): Extraction {
  const candidates: FigureCandidate[] = [];
  // Nombres de 1 à 6 chiffres, éventuels séparateurs de milliers.
  const re = /\b\d{1,3}(?:[ .  ]\d{3})*\b|\b\d{1,6}\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const value = parseNumber(m[0]);
    if (value === null) continue;
    const start = Math.max(0, m.index - 35);
    const end = Math.min(text.length, m.index + m[0].length + 25);
    const context = text.slice(start, end).replace(/\s+/g, " ").trim();
    let score = 0;
    if (KEYWORDS.test(context)) score += 3;
    if (NEGATIVE.test(context)) score -= 3;
    if (value >= 5) score += 1; // un pointage est rarement < 5
    candidates.push({ value, context, score });
  }
  candidates.sort((a, b) => b.score - a.score);
  const best = candidates.length && candidates[0].score > 0 ? candidates[0].value : null;
  return { best, candidates: candidates.slice(0, 5) };
}
