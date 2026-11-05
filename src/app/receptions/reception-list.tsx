"use client";
import { useEffect, useState } from "react";
import type { Reception } from "@/lib/receptions";

const LS_KEY = "receptions-done";

function frDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("fr-FR");
}

export function ReceptionList({ receptions }: { receptions: Reception[] }) {
  const [done, setDone] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      setDone(JSON.parse(localStorage.getItem(LS_KEY) ?? "{}"));
    } catch {
      /* stockage indispo : on reste sur un état vide */
    }
  }, []);

  function toggle(id: string) {
    setDone((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  if (receptions.length === 0) {
    return <div className="glass-card p-5 text-[13px] text-apple-secondary">Aucune réponse récente.</div>;
  }

  return (
    <section className="space-y-3">
      {receptions.map((r) => (
        <Card key={r.reply.id} r={r} done={!!done[r.reply.id]} onToggle={() => toggle(r.reply.id)} />
      ))}
    </section>
  );
}

function Card({ r, done, onToggle }: { r: Reception; done: boolean; onToggle: () => void }) {
  const [valeur, setValeur] = useState(r.extraction.best?.toString() ?? "");
  const [copied, setCopied] = useState(false);

  const loc = r.entry ? [r.entry.ville, r.entry.salle].filter(Boolean).join(" · ") : "";
  const cible = r.entry
    ? [r.entry.artiste, loc, frDate(r.entry.date_concert)].filter(Boolean).join(" — ")
    : "⚠️ non rapproché à une date suivie";

  async function copy() {
    try {
      await navigator.clipboard.writeText(valeur);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard indispo */
    }
  }

  return (
    <div className={`glass-card p-5 ${done ? "opacity-55" : ""}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="truncate text-[14px] font-medium">{r.reply.from}</div>
          <div className="truncate text-[13px] text-apple-secondary">{cible}</div>
          <div className="mt-0.5 text-[12px] text-apple-secondary">
            {frDate(r.reply.date)} · {r.reply.subject}
          </div>
        </div>
        <label className="flex shrink-0 items-center gap-1.5 text-[13px] text-apple-secondary">
          <input type="checkbox" checked={done} onChange={onToggle} className="h-4 w-4" />
          fait
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-apple-secondary">Chiffre validé</span>
          <input
            value={valeur}
            onChange={(e) => setValeur(e.target.value.replace(/[^\d]/g, ""))}
            inputMode="numeric"
            placeholder="—"
            className="w-28 !py-2 text-center text-[17px] font-semibold tabular-nums"
          />
        </div>
        <button onClick={copy} className="btn-cta" disabled={!valeur}>
          {copied ? "Copié ✓" : "Copier"}
        </button>
        {r.dernierRecu && (
          <span className="text-[12px] text-apple-secondary">
            dernier reçu : {frDate(r.dernierRecu)}
          </span>
        )}
      </div>

      {r.extraction.candidates.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className="text-[12px] text-apple-secondary">autres nombres détectés :</span>
          {r.extraction.candidates.map((c, i) => (
            <button
              key={i}
              onClick={() => setValeur(String(c.value))}
              title={c.context}
              className="rounded-full bg-black/[0.04] px-2 py-0.5 text-[12px] tabular-nums hover:bg-black/[0.08]"
            >
              {c.value}
            </button>
          ))}
        </div>
      )}

      <details className="mt-3">
        <summary className="cursor-pointer text-[12px] text-apple-secondary">Voir le message</summary>
        <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-xl bg-black/[0.03] p-3 text-[13px]">
          {r.reply.text || "(corps vide)"}
        </pre>
      </details>
    </div>
  );
}
