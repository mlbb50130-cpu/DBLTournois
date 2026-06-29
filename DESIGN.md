# Système de Tournoi DBL — WhatsApp + Discord

Système de gestion de tournois **Dragon Ball Legends (DBL)** combinant un bot
WhatsApp et un bot Discord, pilotés par un cœur central commun.

## Principe directeur

Les deux bots ne sont **que des interfaces**. Toute la logique (inscriptions,
brackets, scores, classement) vit dans un **service central** unique. Cela évite
que WhatsApp et Discord se désynchronisent.

```
        ┌──────────────┐         ┌──────────────┐
        │  Bot Discord │         │ Bot WhatsApp │
        │ (discord.js) │         │(whatsapp-web)│
        └──────┬───────┘         └──────┬───────┘
               │  REST / events         │
               └───────────┬────────────┘
                           ▼
                ┌─────────────────────┐
                │   API CENTRALE       │  ← source de vérité unique
                │ (NestJS / Fastify)   │
                │  - moteur de bracket │
                │  - validation scores │
                │  - moteur de règles  │
                └─────────┬───────────┘
                          │
              ┌───────────┼────────────┐
              ▼                        ▼
        ┌──────────┐            ┌────────────┐
        │PostgreSQL│            │ Redis       │
        │ (données)│            │ Pub/Sub+cache│
        └──────────┘            └────────────┘
```

**Pourquoi Redis Pub/Sub ?** Quand un joueur déclare un score sur WhatsApp,
l'API publie un événement `match.updated`. Les **deux** bots y sont abonnés →
Discord met à jour son embed bracket *et* WhatsApp notifie, sans qu'aucun bot ne
parle directement à l'autre.

## Stack

| Composant       | Techno                                  | Rôle                              |
|-----------------|-----------------------------------------|-----------------------------------|
| Cœur / API      | Node.js (NestJS ou Fastify)             | Logique tournoi, source de vérité |
| Base de données | PostgreSQL                              | Joueurs, matchs, scores           |
| Temps réel/cache| Redis (Pub/Sub + cache)                 | Propager les MAJ entre les bots   |
| Bot Discord     | discord.js (slash commands, embeds)     | Inscriptions, bracket, matchs     |
| Bot WhatsApp    | whatsapp-web.js (gratuit)               | Inscriptions, notifs, scores      |

> ⚠️ `whatsapp-web.js` est gratuit mais **non officiel** : risque de
> bannissement du numéro. Utiliser un numéro dédié.

## Spécificités Dragon Ball Legends

DBL = combat **1v1** en manches. On modélise donc :

- **Format de match** : Best-of (BO1, BO3, BO5) configurable par tournoi.
- **Score** = nombre de manches gagnées (ex. `2-1`).
- **ID joueur** : on stocke le **Friend ID DBL** (utile pour s'ajouter en jeu
  avant le match).
- **Pas de stockage de screenshots** : les joueurs peuvent en envoyer dans le
  chat, mais le système ne les enregistre pas. La validation repose sur la
  confirmation de l'adversaire et, en cas de litige, la décision d'un admin.

## Modèle de données

```
Player
  id, pseudo, dbl_friend_id
  discord_id?      (nullable)
  whatsapp_number? (nullable)
  link_code        (pour fusionner les 2 plateformes)

Tournament
  id, nom, jeu='DBL'
  format     ENUM(simple, double, poules)
  best_of    INT (1,3,5)
  statut     ENUM(inscription, en_cours, termine)
  max_joueurs

Registration
  tournament_id, player_id, seed?

Match
  id, tournament_id, round
  bracket    ENUM(principal, perdants, poule)  -- pour double élim / poules
  player1_id, player2_id
  score_p1, score_p2
  statut     ENUM(a_jouer, attente_validation, termine, litige)
  winner_id

PoolStanding   (seulement format poules)
  tournament_id, poule_id, player_id
  V, D, manches_pour, manches_contre, points
```

## Moteur de bracket — les 3 formats

| Format               | Génération                                   | Progression                                                        |
|----------------------|----------------------------------------------|--------------------------------------------------------------------|
| Élimination simple   | Bracket en puissance de 2 (byes si impair)   | Le gagnant monte d'un tour                                          |
| Élimination double   | Bracket *gagnants* + bracket *perdants*      | 1 défaite → bracket perdants ; 2 défaites → éliminé ; grande finale |
| Poules + finale      | Répartition en groupes, round-robin par poule| Top N de chaque poule → tableau à élimination                      |

Le format est choisi à la création (`creer-tournoi`). Le **même code de bot**
gère les trois — c'est l'API qui applique la bonne stratégie.

## Liaison des identités (point critique)

Pour qu'un joueur WhatsApp affronte un joueur Discord dans le même bracket :

1. Le joueur s'inscrit sur une plateforme → reçoit un **code de liaison**
   (ex. `DBL-7F3K`).
2. Sur l'autre plateforme, il tape `/lier DBL-7F3K`.
3. Les deux comptes fusionnent sur le même `Player.id`.

Sans liaison, un joueur reste mono-plateforme (c'est OK aussi).

## Commandes

### Joueur (Discord = slash commands / WhatsApp = préfixe `!`)

| Action                     | Discord            | WhatsApp        |
|----------------------------|--------------------|-----------------|
| S'inscrire                 | `/inscription`     | `!join`         |
| Lier ses comptes           | `/lier <code>`     | `!lier <code>`  |
| Voir le bracket            | `/bracket`         | `!bracket`      |
| Son prochain match         | `/monmatch`        | `!monmatch`     |
| Déclarer un score          | `/score @adv 2-1`  | `!score 2-1`    |
| Confirmer le score adverse | `/valider`         | `!valider`      |
| Classement                 | `/classement`      | `!classement`   |

### Admin

`/creer-tournoi nom format bo max` · `/seed` · `/demarrer` · `/valider-score` ·
`/litige` · `/clore`

## Flux de validation d'un score (anti-triche)

```
Joueur A déclare 2-1
        │
        ▼
Match → "attente_validation"  → notif au Joueur B sur SA plateforme
        │
   ┌────┴─────┐
   ▼          ▼
B valide   B conteste
   │          │
   ▼          ▼
termine    "litige" → admin tranche
   │
   ▼
bracket avancé → événement Redis → MAJ Discord + WhatsApp
```

## Plan de mise en œuvre

1. **Phase 1** — API centrale + PostgreSQL + moteur élimination simple.
2. **Phase 2** — Bot Discord branché sur l'API (UI riche : boutons, embeds).
3. **Phase 3** — Bot WhatsApp (whatsapp-web.js) + liaison d'identités.
4. **Phase 4** — Double élimination + poules.
5. **Phase 5** — Validation scores + gestion des litiges.
