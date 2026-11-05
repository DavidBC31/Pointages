/**
 * Lecture (seule) du point global dans PIMS.
 * L'API expose les ticket-counts en lecture — pas d'écriture (cf. saisie assistée).
 * Note : PIMS exige un en-tête `Accept-Language` valide, sinon 400.
 */
export interface PimsPoint {
  sales: number | null;
  gross: number | null;
  date: string | null;
}

/** Extrait l'id d'événement de l'URL « séance PIMS » (…/seances/points?id=11037). */
export function eventIdFromLink(lien: string | null | undefined): string | null {
  if (!lien) return null;
  const m = lien.match(/[?&]id=(\d+)/);
  return m ? m[1] : null;
}

function authHeader(): string {
  const u = process.env.PIMS_USERNAME ?? "";
  const p = process.env.PIMS_PASSWORD ?? "";
  return "Basic " + Buffer.from(`${u}:${p}`).toString("base64");
}

/** Dernier ticket-count (point global) connu pour un événement, ou null. */
export async function getLatestTicketCount(eventId: string): Promise<PimsPoint | null> {
  const base = process.env.PIMS_BASE_URL;
  if (!base) return null;
  try {
    const r = await fetch(`${base}/events/${eventId}/ticket-counts?page_size=100`, {
      headers: { Authorization: authHeader(), Accept: "application/json", "Accept-Language": "fr" },
    });
    if (!r.ok) return null;
    const d = (await r.json()) as { _embedded?: Record<string, { date: string; sales: number; gross: number }[]> };
    const key = Object.keys(d._embedded ?? {})[0];
    const items = key ? d._embedded![key] : [];
    if (!items.length) return null;
    const last = [...items].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))[0];
    return { sales: last.sales ?? null, gross: last.gross ?? null, date: last.date ?? null };
  } catch {
    return null;
  }
}
