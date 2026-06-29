# Pointages — Outils paie Bleu Citron

Application interne multi-outils hébergeant trois fonctionnalités paie :

| Route | Outil | Description |
|---|---|---|
| `/` | **Relances pointages** | Lit le doc de suivi (Drive), génère les brouillons de relance dans `pointage@bleucitron.net` |
| `/justificatifs` | **Justificatifs** | Formulaire de dépôt (forfait téléphone, mobilité, Navigo) → email pivot vers le Pôle Social |
| `/absences` | **Nettoyeur absences Lucca** | Transforme l'export Lucca (multiples lignes/collaborateur) en une ligne fusionnée prête pour sPAIEctacle |

> **Note** : les routes `/justificatifs` et `/absences` ont vocation à migrer dans des projets dédiés (`justif` et `paye`). Elles restent ici le temps de leur extraction.

## Architecture — Relances pointages

```
pointage suivi.xlsx (Drive)
        │  Drive API + SheetJS (live)  ─ ou ─  data/relances.json (snapshot, repli)
        ▼
src/lib/normalize.ts   texte libre → champs explicites (statut, cadence…)
src/lib/engine.ts      sélection du jour + rendu des mails (objet/corps)
src/lib/gmail.ts       service account → création des brouillons (rien n'est envoyé)
        ▼
src/app/page.tsx       dashboard (stats, aperçu, génération, exclusions)
src/app/api/drafts     POST { confirm?, date?, limit?, test? }
src/app/api/cron/...   cron Vercel (lundi) → brouillons du jour
```

## Logique d'aiguillage (relances)

`SKIP` si le statut contient : `LIAISON PIMS`, `AUTONOME`, `AUTOMATIQUE`,
`COMPLET`, `NE PAS RELANCER`, `MEV`, « ne veut/donne pas ». Sinon `RELANCE`,
cadence par défaut = **lundi** (cadences spécifiques mardi / 1×semaine reconnues).

## Variables d'environnement

| Var | Rôle |
|---|---|
| `PIMS_BASE_URL` / `PIMS_USERNAME` / `PIMS_PASSWORD` | API PIMS (phase 2) |
| `GOOGLE_APPLICATION_CREDENTIALS` (dev) / `GOOGLE_SA_KEY_B64` (prod) | clé service account |
| `GMAIL_IMPERSONATE` | boîte incarnée (`pointage@bleucitron.net`) |
| `POINTAGE_SHEET_FILE_ID` | id Drive du doc de suivi |
| `CRON_SECRET` | protège l'endpoint cron |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` / `AUTH_SECRET` | OAuth2 + cookie session (justificatifs) |
| `JUSTIF_MAILBOX` | destinataire des justificatifs (défaut : `justif@bleucitron.net`) |

Scopes service account (délégation domaine) : `gmail.modify`, `gmail.send`,
`drive.readonly`.

## Dev

```bash
npm install
python3 scripts/import_sheet.py   # régénère le snapshot data/relances.json
npm run dev                        # http://localhost:3000
```

## Roadmap

- [x] Phase 1 — relances du lundi en brouillons validés
- [ ] Déploiement Vercel + cron hebdo
- [ ] Phase 2 — parsing des réponses entrantes + push PIMS
- [ ] Phase 3 — billets tiers via TAL-API (Aparté)
- [ ] Extraction `/justificatifs` → projet `justif` (repo séparé)
- [ ] Extraction `/absences` → projet `paye` (repo séparé)
