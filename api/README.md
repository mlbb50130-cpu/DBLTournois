# API centrale — Tournois DBL

Source de vérité unique des tournois **Dragon Ball Legends**.
**Fastify + MongoDB (Mongoose).** Les bots WhatsApp et Discord ne sont que des
interfaces qui appellent cette API (cf. `../DESIGN.md`).

Phase 1 : inscriptions, liaison de comptes, **élimination simple** complète
(byes, validation des scores, progression, champion). Les formats *double* et
*poules* sont prévus pour la Phase 4.

## Installation

```bash
cd api
npm install
cp .env.example .env   # configure MONGODB_URI
npm start              # ou: npm run dev
```

Il faut une instance MongoDB joignable (locale ou Atlas) via `MONGODB_URI`.

## Endpoints

### Publics (utilisés par les bots)
| Méthode | Route                              | Body / Query                          |
|---------|------------------------------------|---------------------------------------|
| POST    | `/registrations`                   | `{ platform, externalId, pseudo? }`   |
| POST    | `/players/link`                    | `{ platform, externalId, code }`      |
| GET     | `/players/match`                   | `?platform=&externalId=`              |
| POST    | `/matches/score`                   | `{ platform, externalId, score }`     |
| POST    | `/matches/validate`                | `{ platform, externalId }`            |
| GET     | `/tournaments/active/bracket`      | —                                     |
| GET     | `/tournaments/active/standings`    | —                                     |

`platform` = `"whatsapp"` ou `"discord"`. Chaque réponse contient un champ
`message` prêt à afficher.

### Admin (`x-admin-key` requis si `ADMIN_KEY` défini)
| Méthode | Route                               | Body                                          |
|---------|-------------------------------------|-----------------------------------------------|
| GET     | `/admin/tournaments`                | —                                             |
| POST    | `/admin/tournaments`                | `{ name, format?, bestOf?, maxPlayers? }`     |
| POST    | `/admin/tournaments/:id/start`      | —                                             |
| POST    | `/admin/tournaments/:id/close`      | —                                             |
| POST    | `/admin/matches/:id/resolve`        | `{ score }` (litige)                          |

## Exemple de cycle complet

```bash
# 1) Créer un tournoi (BO3, élimination simple)
curl -X POST localhost:3000/admin/tournaments \
  -H 'content-type: application/json' \
  -d '{"name":"Coupe DBL","format":"simple","bestOf":3}'

# 2) Inscrire des joueurs
curl -X POST localhost:3000/registrations \
  -H 'content-type: application/json' \
  -d '{"platform":"whatsapp","externalId":"22990000001","pseudo":"Goku"}'

# 3) Démarrer  (remplace :id par l'id renvoyé en étape 1)
curl -X POST localhost:3000/admin/tournaments/:id/start

# 4) Déclarer puis valider un score
curl -X POST localhost:3000/matches/score \
  -H 'content-type: application/json' \
  -d '{"platform":"whatsapp","externalId":"22990000001","score":"2-0"}'
```

## Architecture

```
src/
  index.js              -> bootstrap Fastify + gestion d'erreurs
  config.js / db.js     -> config + connexion MongoDB
  models/               -> Player, Tournament, Match (Mongoose)
  services/
    bracket.js          -> moteur de bracket (élimination simple)
    registrations.js    -> inscriptions + tournoi actif
    players.js          -> joueurs + liaison de comptes
    tournaments.js      -> création/démarrage/bracket/classement
    matches.js          -> scores, validation, progression, litige
  routes/               -> exposition HTTP des services
  utils/                -> erreurs + formatage des messages
```

## À venir
- Phase 3 : Redis Pub/Sub pour pousser les mises à jour vers les deux bots.
- Phase 4 : élimination double et poules (brancher dans `services/bracket.js`).
