import { listInboxReplies, type InboxReply } from "./inbox";
import { getDataset } from "./sheet";
import { extractFigure, type Extraction } from "./extract";
import type { Entry } from "./types";

/** Une réponse reçue, rapprochée d'une date suivie, avec le chiffre extrait. */
export interface Reception {
  reply: InboxReply;
  entry: Entry | null; // date/événement rapproché (par l'adresse de l'expéditeur)
  extraction: Extraction;
  dernierRecu: string | null; // dernier point connu pour cette entrée (du Sheet)
}

/** Toutes les adresses e-mail présentes dans une cellule MAIL (souvent plusieurs). */
function emailsOf(mail: string): string[] {
  return (mail.match(/[\w.+-]+@[\w.-]+\.\w+/g) ?? []).map((e) => e.toLowerCase());
}

export async function buildReceptions(): Promise<Reception[]> {
  const [replies, dataset] = await Promise.all([listInboxReplies(), getDataset()]);

  // Index : adresse e-mail -> entrées relançables
  const byEmail = new Map<string, Entry[]>();
  for (const e of dataset.entries) {
    for (const addr of emailsOf(e.mail)) {
      (byEmail.get(addr) ?? byEmail.set(addr, []).get(addr)!).push(e);
    }
  }

  return replies.map((reply) => {
    const matches = byEmail.get(reply.fromEmail) ?? [];
    // Si plusieurs dates pour ce contact, on affine via l'artiste cité dans l'objet.
    const entry =
      matches.find((e) => e.artiste && reply.subject.toUpperCase().includes(e.artiste.toUpperCase())) ??
      matches[0] ??
      null;
    return {
      reply,
      entry,
      extraction: extractFigure(reply.text),
      dernierRecu: entry?.dernier_recu ?? null,
    };
  });
}
