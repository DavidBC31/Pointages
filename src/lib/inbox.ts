import { gmailClient } from "./gmail";

/** Une réponse reçue dans la boîte pointage@ (candidate à un pointage). */
export interface InboxReply {
  id: string;
  threadId: string;
  from: string; // nom affiché + adresse
  fromEmail: string; // adresse seule, en minuscules
  subject: string;
  date: string; // ISO
  text: string; // corps texte, partie citée retirée
}

type GmailPart = {
  mimeType?: string | null;
  body?: { data?: string | null } | null;
  parts?: GmailPart[] | null;
};

function header(headers: { name?: string | null; value?: string | null }[], name: string): string {
  return headers.find((h) => (h.name ?? "").toLowerCase() === name)?.value ?? "";
}

function emailOf(from: string): string {
  const m = from.match(/<([^>]+)>/);
  return (m ? m[1] : from).trim().toLowerCase();
}

/** Décode récursivement le premier text/plain d'un message Gmail. */
function decodeBody(payload: GmailPart): string {
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return Buffer.from(payload.body.data, "base64").toString("utf-8");
  }
  for (const p of payload.parts ?? []) {
    const t = decodeBody(p);
    if (t) return t;
  }
  return "";
}

/** Retire la partie citée (réponse au-dessus du message d'origine). */
function stripQuoted(text: string): string {
  const cut = text.search(
    /\n\s*Le .+ a écrit\s*:|\n\s*On .+ wrote:|\n\s*De\s*:|\n\s*From:|\n\s*-{2,}\s*(Message|Forwarded)|\n>/,
  );
  return (cut >= 0 ? text.slice(0, cut) : text).trim();
}

/**
 * Liste les réponses récentes reçues dans pointage@ (hors auto-envois).
 * Sert de base à l'écran de réception/validation (version B).
 */
export async function listInboxReplies(opts?: { days?: number; max?: number }): Promise<InboxReply[]> {
  const { gmail } = gmailClient();
  const days = opts?.days ?? 21;
  const q = `in:inbox newer_than:${days}d -from:pointage@bleucitron.net -category:promotions -category:social`;
  const list = await gmail.users.messages.list({ userId: "me", q, maxResults: opts?.max ?? 60 });
  const ids = (list.data.messages ?? []).map((m) => m.id!).filter(Boolean);

  const out: InboxReply[] = [];
  for (const id of ids) {
    const msg = await gmail.users.messages.get({ userId: "me", id, format: "full" });
    const p = msg.data.payload;
    if (!p) continue;
    const headers = p.headers ?? [];
    const from = header(headers, "from");
    const ts = Number(msg.data.internalDate ?? 0);
    out.push({
      id,
      threadId: msg.data.threadId ?? "",
      from,
      fromEmail: emailOf(from),
      subject: header(headers, "subject"),
      date: ts ? new Date(ts).toISOString() : "",
      text: stripQuoted(decodeBody(p)),
    });
  }
  return out;
}
