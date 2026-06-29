# Déploiement sur Railway

Le projet = **3 services** indépendants + **MongoDB Atlas** :

| Service        | Dossier         | Rôle                              |
|----------------|-----------------|-----------------------------------|
| API centrale   | `api/`          | Source de vérité (port auto)      |
| Bot WhatsApp   | `whatsapp-bot/` | Interface WhatsApp (Baileys)      |
| Bot Discord    | `discord-bot/`  | Interface Discord (slash + boutons)|

Sur Railway, on crée **un service par dossier** (monorepo) en réglant le
**Root Directory** de chaque service.

---

## 0) Préparatifs

- **MongoDB Atlas** → *Network Access* → autorise `0.0.0.0/0` (les IP de Railway
  sont dynamiques). Récupère l'URI `mongodb+srv://...`.
- Pousse le repo sur GitHub (les `.env` ne sont **pas** versionnés ; les assets
  d'image dans `*/src/assets/` le sont).

---

## 1) Service API (`api/`)

- **Root Directory** : `api`
- **Start** : `npm start` (auto-détecté)
- **Variables** :
  - `MONGODB_URI` = ton URI Atlas
  - `ADMIN_KEY` = un secret fort (ex. généré aléatoirement)
  - `LOG_LEVEL` = `warn` (optionnel)
  - ⚠️ Ne définis **pas** `PORT` : Railway le fournit, l'API l'utilise déjà
    (`process.env.PORT`, bind `0.0.0.0`).
- Une fois déployée, **génère un domaine** (Settings → Networking → Generate
  Domain). Note l'URL publique `https://<api>.up.railway.app` : les bots en ont
  besoin.

Test : ouvre `https://<api>.up.railway.app/health` → `{"status":"ok"}`.

---

## 2) Service Bot Discord (`discord-bot/`)

- **Root Directory** : `discord-bot`
- **Variables** :
  - `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_GUILD_ID`
  - `API_BASE_URL` = l'URL publique de l'API (étape 1)
  - `ADMIN_KEY` = **le même** que l'API
  - `ADMIN_IDS` (optionnel), `BOT_NAME` (optionnel)
- **Slash commands** : à enregistrer **une fois** (et à chaque changement de
  commande). Le plus simple : depuis ta machine,
  `cd discord-bot && npm run deploy` (ça appelle l'API Discord, marche de
  partout). Sinon, exécute-le comme commande ponctuelle sur Railway.

---

## 3) Service Bot WhatsApp (`whatsapp-bot/`)

> ⚠️ Point sensible : Baileys garde une **session** sur le disque. Le système de
> fichiers de Railway est **éphémère** → sans volume, il faut ré-appairer à
> chaque redéploiement.

- **Root Directory** : `whatsapp-bot`
- **Volume** : ajoute un **Volume** Railway monté sur `/data`.
- **Variables** :
  - `API_BASE_URL` = URL publique de l'API
  - `ADMIN_KEY` = le même que l'API
  - `SESSION_PATH` = `/data/whatsapp_auth`  (sur le volume → session persistante)
  - `WHATSAPP_NUMBER` = numéro du bot (chiffres, indicatif inclus)
  - `USE_PAIRING_CODE` = `true`
  - `ADMIN_NUMBERS` (optionnel), `PREFIX`, `BOT_NAME` (optionnels)
- **Premier appairage** : ouvre les **logs** du service → le **code d'appairage**
  s'y affiche → saisis-le dans WhatsApp (*Appareils connectés → Connecter avec le
  numéro*). Grâce au volume, la session persiste ensuite.

---

## Liaison entre services

```
WhatsApp ─┐
          ├─►  API (https://<api>.up.railway.app)  ─►  MongoDB Atlas
Discord  ─┘
```

Les deux bots pointent vers l'API via `API_BASE_URL`. Mets le **même `ADMIN_KEY`**
partout pour que les commandes admin passent.

> Alternative réseau : Railway propose le *private networking*
> (`http://<api>.railway.internal:<PORT>`). L'URL publique reste la solution la
> plus simple à configurer.

---

## Récap des variables par service

| Variable          | API | WhatsApp | Discord |
|-------------------|:---:|:--------:|:-------:|
| `MONGODB_URI`     | ✅  |          |         |
| `ADMIN_KEY`       | ✅  | ✅       | ✅      |
| `API_BASE_URL`    |     | ✅       | ✅      |
| `LOG_LEVEL`       | ⬜  |          |         |
| `SESSION_PATH`    |     | ✅       |         |
| `WHATSAPP_NUMBER` |     | ✅       |         |
| `USE_PAIRING_CODE`|     | ⬜       |         |
| `ADMIN_NUMBERS`   |     | ⬜       |         |
| `DISCORD_TOKEN`   |     |          | ✅      |
| `DISCORD_CLIENT_ID`|    |          | ✅      |
| `DISCORD_GUILD_ID`|     |          | ⬜      |
| `ADMIN_IDS`       |     |          | ⬜      |

✅ requis · ⬜ optionnel
