import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { buildReceptions, type Reception } from "@/lib/receptions";
import { ReceptionList } from "./reception-list";

export const dynamic = "force-dynamic";

export default async function Receptions() {
  if (process.env.AUTH_SECRET && !(await getSession())) {
    redirect("/api/auth/google");
  }

  let receptions: Reception[] = [];
  let error: string | null = null;
  try {
    receptions = await buildReceptions();
  } catch (e) {
    error = (e as Error).message;
  }

  const avecChiffre = receptions.filter((r) => r.extraction.best !== null).length;
  const rapprochees = receptions.filter((r) => r.entry).length;

  return (
    <div className="mx-auto w-full max-w-[1100px] px-6 py-5">
      <nav className="navbar-pill mb-8 flex items-center justify-between px-5 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-lg">🍋</span>
          <span className="text-[15px] font-semibold tracking-tight">Pointages — Réceptions</span>
        </div>
        <a href="/" className="text-[13px] text-apple-secondary hover:text-apple-blue">
          ← Relances
        </a>
      </nav>

      <main className="fade-in space-y-6">
        <header>
          <h1 className="text-[28px] font-semibold tracking-tight">Réponses des producteurs</h1>
          <p className="mt-1 text-[13px] text-apple-secondary">
            Chiffres extraits automatiquement des réponses reçues dans pointage@.{" "}
            <strong>À valider</strong> avant report dans PIMS — rien n&apos;est écrit automatiquement.
          </p>
        </header>

        {error ? (
          <div className="glass-card p-5 text-[13px] text-apple-orange">⚠️ {error}</div>
        ) : (
          <>
            <section className="grid grid-cols-3 gap-4">
              <Stat label="Réponses reçues" value={receptions.length} />
              <Stat label="Chiffre détecté" value={avecChiffre} accent />
              <Stat label="Dates rapprochées" value={rapprochees} />
            </section>
            <ReceptionList receptions={receptions} />
          </>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="glass-card p-5">
      <div
        className={`text-[34px] font-semibold leading-none tracking-tight tabular-nums ${
          accent ? "text-apple-blue" : ""
        }`}
      >
        {value}
      </div>
      <div className="mt-2 text-[13px] text-apple-secondary">{label}</div>
    </div>
  );
}
