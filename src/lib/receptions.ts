import { listInboxReplies, type InboxReply } from "./inbox";
import { getDataset } from "./sheet";
import { extractFigure, type Extraction } from "./extract";
import { eventIdFromLink, getLatestTicketCount, type PimsPoint } from "./pims";
import type { Entry } from "./types";

/** Une réponse reçue, rapprochée d'une date suivie, avec le chiffre extrait. */
export interface Reception {
  reply: InboxReply;
  entry: Entry | null; // date/événement rapproché
  matchScore: number; // confiance du rapprochement (0 = aucun)
  matchedByEmail: boolean; // true = e-mail expéditeur reconnu (signal fort)
  extraction: Extraction;
  dernierRecu: string | null; // dernier point connu pour cette entrée (du Sheet)
  pimsPoint: PimsPoint | null; // point global actuel dans PIMS (lecture)
}

/** Normalise pour comparaison : majuscules, sans accents. */
function norm(s: string): string {
  return s
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

/** Toutes les adresses e-mail présentes dans une cellule MAIL (souvent plusieurs). */
function emailsOf(mail: string): string[] {
  return (mail.match(/[\w.+-]+@[\w.-]+\.\w+/g) ?? []).map((e) => e.toLowerCase());
}

/** Score de rapprochement entre une réponse et une entrée suivie. */
function scoreEntry(subject: string, body: string, fromEmail: string, e: Entry): number {
  let sc = 0;
  if (emailsOf(e.mail).includes(fromEmail)) sc += 5; // signal fort
  const hay = subject + " \n " + body;
  const art = norm(e.artiste);
  if (art.length >= 4) {
    if (subject.includes(art)) sc += 3;
    else if (body.includes(art)) sc += 2;
  }
  const salle = norm(e.salle);
  if (salle.length >= 4 && hay.includes(salle)) sc += 1;
  const ville = norm(e.ville);
  if (ville.length >= 4 && hay.includes(ville)) sc += 1;
  return sc;
}

export async function buildReceptions(): Promise<Reception[]> {
  const [replies, dataset] = await Promise.all([listInboxReplies(), getDataset()]);

  const base: Reception[] = replies.map((reply) => {
    const subject = norm(reply.subject);
    const body = norm(reply.text);
    let best: Entry | null = null;
    let bestScore = 0;
    for (const e of dataset.entries) {
      const sc = scoreEntry(subject, body, reply.fromEmail, e);
      if (sc > bestScore) {
        bestScore = sc;
        best = e;
      }
    }
    // Seuil : au moins un signal e-mail (5) ou artiste dans l'objet (3).
    const entry = bestScore >= 3 ? best : null;
    return {
      reply,
      entry,
      matchScore: entry ? bestScore : 0,
      matchedByEmail: !!entry && emailsOf(entry.mail).includes(reply.fromEmail),
      extraction: extractFigure(reply.text),
      dernierRecu: entry?.dernier_recu ?? null,
      pimsPoint: null,
    };
  });

  // Point global PIMS (lecture) pour les entrées rapprochées ayant un lien séance.
  await Promise.all(
    base.map(async (r) => {
      const id = eventIdFromLink(r.entry?.lien_pims);
      if (id) r.pimsPoint = await getLatestTicketCount(id);
    }),
  );
  return base;
}
