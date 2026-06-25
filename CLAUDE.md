@AGENTS.md

# Pointages — Guide pour Claude

## Vue d'ensemble

App interne Bleu Citron de suivi des pointages et génération automatique de mails de relance.
Elle lit un Google Sheet (source de vérité), calcule les absences dues selon le jour, et crée
des brouillons Gmail dans la boîte `pointage@bleucitron.net`. Rien n'est envoyé automatiquement.

- **URL prod** : https://pointages.bleucitron.app
- **Port local** : 3004 (pm2 `pointages-new`)
- **Stack** : Next.js 16.2.9 (Turbopack), TypeScript, Tailwind v4
- **Infra** : Mac Studio, Cloudflare Tunnel (`fedfdc62-f061-4aac-b330-413a6d0b87a8`)
- **Repo** : https://github.com/DavidBC31/Pointages (branche `master`)

## Fonctionnement métier

1. `src/lib/sheet.ts` — lit le Google Sheet via Service Account (`.secrets/service-account.json`)
2. `src/lib/engine.ts` — calcule les brouillons à envoyer selon le jour + règles métier
3. `src/app/page.tsx` — dashboard : stats, aperçu des brouillons, bouton de génération
4. `src/app/api/generate/route.ts` — crée les brouillons dans Gmail (boîte `pointage@`)
5. `src/app/justificatifs/` — module séparé de gestion des justificatifs d'absence

## Authentification

Auth Google maison, sans next-auth. Cookie `justif_session` (HMAC-SHA256), valide 7 jours.

```
/api/auth/google   → redirect Google OAuth2
/api/auth/callback → échange code, pose cookie, redirect /justificatifs
```

**Point critique** : derrière Cloudflare Tunnel, `req.nextUrl.origin` retourne `https://localhost:3004`
au lieu de `https://pointages.bleucitron.app`. `publicOrigin()` dans `src/lib/auth.ts` corrige ça
en lisant les headers `x-forwarded-host` / `x-forwarded-proto`. Toujours utiliser `publicOrigin(req)`
pour construire les `redirect_uri` Google.

```typescript
// ✅ Correct
const redirectUri = `${publicOrigin(req)}/api/auth/callback`;

// ❌ Faux (retourne localhost derrière Cloudflare Tunnel)
const redirectUri = `${req.nextUrl.origin}/api/auth/callback`;
```

Cookie session : `SESSION_COOKIE = "justif_session"`, stocke `{ nom, prenom, email, exp }`.
Domaine cookie : local uniquement (pas partagé avec le hub — auth propre à cette app).

## Structure des fichiers clés

```
src/
├── app/
│   ├── page.tsx                    # Dashboard principal (relances du jour)
│   ├── generate-button.tsx         # Bouton "Générer" (Server Action)
│   ├── globals.css                 # Design system Apple/iOS 18
│   ├── layout.tsx
│   ├── api/
│   │   ├── auth/google/route.ts    # Démarre OAuth2 → redirect Google
│   │   ├── auth/callback/route.ts  # Échange code → cookie session
│   │   └── generate/route.ts       # Crée brouillons Gmail
│   ├── justificatifs/              # Module justificatifs (page + actions)
│   └── absences/                   # Module absences
└── lib/
    ├── auth.ts         # OAuth2, publicOrigin(), signSession(), verifySession(), getSession()
    ├── sheet.ts        # Lecture Google Sheet via Service Account
    ├── engine.ts       # Logique métier : calcul des relances dues
    ├── gmail.ts        # API Gmail (brouillons + checkAccess)
    ├── types.ts        # Types partagés
    └── ...
```

## Variables d'environnement (.env.local — jamais commité)

```
# Google OAuth2 (Console Cloud → projet bleucitron-pointages)
AUTH_GOOGLE_ID=...
AUTH_GOOGLE_SECRET=...
AUTH_SECRET=...                    # Clé HMAC cookie session (≥ 32 chars, propre à cette app)
AUTH_HOSTED_DOMAIN=bleucitron.net

# Google Sheets + Service Account
GOOGLE_SHEET_ID=...
GOOGLE_SA_KEY_PATH=.secrets/service-account.json

# Gmail
GMAIL_USER=pointage@bleucitron.net

# Infra
NEXTAUTH_URL=https://pointages.bleucitron.app
CRON_SECRET=...
```

**Fichier secret** : `.secrets/service-account.json` — Service Account Google (projet bleucitron-pointages). Gitignored, jamais commité.

## Infrastructure

**Cloudflare Tunnel** (`/etc/cloudflared/config.yml`) :
```yaml
- hostname: pointages.bleucitron.app
  service: http://localhost:3004
  originRequest:
    httpHostHeader: pointages.bleucitron.app  # indispensable pour Next.js 16
```

**pm2** : process `pointages-new` (id 5), dans `~/Projets/ecosystem.config.js`.

```bash
# Rebuild + restart
cd /Users/serveurit/Projets/Pointages
PATH="/opt/homebrew/bin:$PATH" npm run build
PATH="/opt/homebrew/bin:$PATH" pm2 restart pointages-new
```

## Design system

Apple/iOS 18 glassmorphism. Classes : `.glass-card`, `.glass-pill`, `.navbar-pill`.
Couleurs Tailwind custom : `text-apple-blue`, `text-apple-secondary`, `text-apple-green`, `text-apple-orange`.

## Points d'attention Next.js 16

- Turbopack actif — `next.config.ts` fixe `turbopack.root: __dirname` (évite le crash "Map maximum size exceeded")
- `cookies()`, `headers()` → Promises, toujours `await`
- Server Actions dans `generate-button.tsx` (directive `"use server"`)
- `export const dynamic = "force-dynamic"` sur `page.tsx` (données temps réel)

## Sécurité

- `.env.local` et `.secrets/` gitignorés — jamais commiter
- Cookie `httpOnly, secure, sameSite=lax`
- OAuth2 restreint au domaine `bleucitron.net` (param `hd`)
- `publicOrigin()` empêche les redirects vers localhost en production
