# Héberger l'app sur le Mac Studio (auto-hébergé)

L'app est un **serveur Next.js standard** : tout ce qui tourne sur Vercel tourne
sur une machine perso, à une exception près — **les crons Vercel** (à remplacer
par un cron système, §7). Pas besoin de Docker.

Cible : Mac Studio M1 Max (« Mac Studio de Serveur »), exposition via
**Cloudflare Tunnel**, process via **pm2**, admin via **Tailscale**.
Pré-requis Google (OAuth + délégation) : voir [SETUP-GOOGLE.md](./SETUP-GOOGLE.md).

> ⚠️ **Où lancer ces commandes ?** Sur le **Mac Studio lui-même** (clavier/écran,
> ou en SSH via Tailscale). Tes sessions Claude Code tournent souvent sur le
> MacBook : elles ne configurent PAS le Studio à distance.

---

## 1. Logiciels

```bash
brew install node git cloudflared      # Node 20+ (24 OK), git, tunnel
npm install -g pm2                      # superviseur de process
```

Empêcher la veille (sinon le service s'arrête) :
```bash
sudo pmset -a sleep 0 disksleep 0 womp 1
```

## 2. Récupérer le code

Le dépôt local n'a **pas encore de remote**. Deux options :

- **A. Via GitHub (recommandé)** : créer un repo privé, puis sur le MacBook
  `git remote add origin <url> && git push -u origin master`. Sur le Studio :
  ```bash
  mkdir -p ~/apps && cd ~/apps
  git clone <url> Pointages && cd Pointages
  ```
- **B. Copie directe** (sans GitHub) : depuis le MacBook, via Tailscale —
  ```bash
  rsync -av --exclude node_modules --exclude .next \
    ~/Desktop/Pointages/  david@<studio-tailscale>:~/apps/Pointages/
  ```
  (inclut `.env.local` et `.secrets/` ; pratique mais à faire sur réseau de confiance).

Puis :
```bash
cd ~/apps/Pointages
npm ci
npm run build       # build de prod (~10 s)
```

## 3. Secrets & configuration (`.env.local`)

Le plus simple : **récupérer les valeurs déjà mises sur Vercel** (elles y sont
toutes), depuis une machine connectée au bon compte Vercel :
```bash
vercel link            # lier au projet david-bc-s-projects/pointages
vercel env pull .env.local --environment=production
```
…puis copier ce `.env.local` sur le Studio. Sinon, recréer le fichier à la main
avec ces clés (valeurs identiques à la prod) :

```bash
# PIMS
PIMS_BASE_URL=https://bleucitron.pims.io/api/v2
PIMS_USERNAME=...
PIMS_PASSWORD=...
# Service account Google (délégation domaine)
GOOGLE_APPLICATION_CREDENTIALS=./.secrets/service-account.json
GMAIL_IMPERSONATE=pointage@bleucitron.net
POINTAGE_SHEET_FILE_ID=1zsVu3Y4xitX3tULNpwqr5blaeUC6X5ll
# SSO Google (même valeurs que la prod — AUTH_SECRET DOIT être identique
# si tu veux que les sessions restent valides entre Vercel et le Studio)
AUTH_GOOGLE_ID=...apps.googleusercontent.com
AUTH_GOOGLE_SECRET=...
AUTH_SECRET=...
AUTH_HOSTED_DOMAIN=bleucitron.net
# Cron
CRON_SECRET=...
# (justificatifs / absences, si tu héberges aussi ces modules)
JUSTIF_MAILBOX=justif@bleucitron.net
JUSTIF_DRIVE_FOLDER=15ucT77NBT_30rVagMfpfhZDssmf_NpxU
BCD_SHEET_FILE_ID=1PXay_SqirJyT1P6IXS2iSVN5J9TMM_ffZdj2ZS6FcTI
```

Déposer la clé du service account dans `~/apps/Pointages/.secrets/service-account.json`.

> `.env.local` et `.secrets/` sont gitignorés → ils ne passent jamais par git ;
> on les copie à la main (ou via `vercel env pull` + copie du JSON).

## 4. Lancer en service permanent (pm2)

```bash
cd ~/apps/Pointages
pm2 start "npm run start" --name pointages   # écoute sur :3000
pm2 save
pm2 startup                                   # affiche une commande à lancer (sudo) → démarrage au boot
```
Utiles : `pm2 logs pointages`, `pm2 restart pointages`, `pm2 status`.

## 5. Exposer en HTTPS — Cloudflare Tunnel

(HTTPS **obligatoire** pour le SSO Google ; le tunnel évite d'ouvrir un port.)
```bash
cloudflared tunnel login                      # navigateur → choisir le domaine Cloudflare
cloudflared tunnel create pointages
cloudflared tunnel route dns pointages pointages.bleucitron.net
```
`~/.cloudflared/config.yml` :
```yaml
tunnel: pointages
credentials-file: /Users/<user>/.cloudflared/<TUNNEL_ID>.json
ingress:
  - hostname: pointages.bleucitron.net
    service: http://localhost:3000
  - service: http_status:404
```
Lancer en service : `sudo cloudflared service install` (démarre au boot).

## 6. Mettre à jour le client OAuth Google

Pour le domaine du Studio (ex. `https://pointages.bleucitron.net`), ajouter dans
le client OAuth `380687599158-8puf…` (APIs & Services → Identifiants) :
- **URI de redirection** : `https://pointages.bleucitron.net/api/auth/callback`
- **Origine JS** : `https://pointages.bleucitron.net`

## 7. Cron des relances (remplace le cron Vercel)

`vercel.json` planifie `/api/cron/relances` chaque **lundi** — ce cron ne tourne
QUE sur Vercel. En auto-hébergé, le recréer via `crontab -e` (heure locale Paris).
La route est en **GET**, protégée par `CRON_SECRET` :
```cron
# Lundi 09:00 — génère les brouillons de relance dans pointage@
0 9 * * 1  curl -s -H "Authorization: Bearer <CRON_SECRET>" https://pointages.bleucitron.net/api/cron/relances >> ~/apps/Pointages/cron.log 2>&1
```

## 8. Mises à jour de l'app

```bash
cd ~/apps/Pointages
git pull            # (ou re-rsync depuis le MacBook)
npm ci
npm run build
pm2 restart pointages
```

## 9. Migrer entièrement depuis Vercel (optionnel)

- Éviter le **double cron** : si tu gardes Vercel actif, désactive l'un des deux
  (sinon les brouillons du lundi sont créés en double). Pour couper côté Vercel :
  retire le bloc `crons` de `vercel.json` puis redéploie, ou mets le projet en pause.
- Garde le **même `AUTH_SECRET`** des deux côtés tant que les deux tournent.
- Une fois le Studio validé, tu peux suspendre le projet Vercel.

## 10. Checklist

- [ ] `pm2 status` → `pointages` online
- [ ] `curl -I http://localhost:3000/` → 307 (redirection SSO)
- [ ] URL publique https répond et redirige vers Google
- [ ] Connexion `@bleucitron.net` → dashboard pointages
- [ ] `curl -H "Authorization: Bearer <CRON_SECRET>" https://…/api/cron/relances` → JSON `{ok:true}` et brouillons créés
- [ ] La machine ne dort pas (`pmset -g | grep sleep`)
- [ ] Tunnel actif au boot (`cloudflared` en service)
