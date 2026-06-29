# Bot WhatsApp — Tournois DBL

Bot WhatsApp pour les tournois **Dragon Ball Legends**, construit sur
**Baileys** (`@whiskeysockets/baileys`), aligné sur la stack de `TetsuBot`
(CommonJS, chargement dynamique des commandes).

Le bot est une **interface fine** : toute la logique métier (brackets, scores,
classement) vit dans l'API centrale (cf. `../DESIGN.md`).

## Installation

```bash
cd whatsapp-bot
npm install
cp .env.example .env   # puis ajuste les valeurs
```

## Lancement

```bash
npm start        # ou: npm run dev (avec nodemon)
```

Au premier démarrage, un **QR code** s'affiche dans le terminal : scanne-le
depuis WhatsApp (*Paramètres > Appareils connectés > Connecter un appareil*).
La session est ensuite sauvegardée dans `whatsapp_auth/` (pas de re-scan).

> ⚠️ Baileys est une lib **non officielle** : utilise un **numéro dédié**
> (risque de bannissement par WhatsApp).

## Configuration (`.env`)

| Variable       | Rôle                                                  |
|----------------|-------------------------------------------------------|
| `PREFIX`       | Préfixe des commandes (défaut `!`)                    |
| `BOT_NAME`     | Nom affiché du bot                                    |
| `API_BASE_URL` | URL de l'API centrale                                 |
| `API_KEY`      | Clé d'API (si l'API en exige une)                    |
| `SESSION_PATH` | Dossier de session WhatsApp (défaut `./whatsapp_auth`)|

## Commandes

### Joueur
| Commande              | Description                                  |
|-----------------------|----------------------------------------------|
| `!join [pseudo]`      | S'inscrire au tournoi en cours               |
| `!desister`           | Se désinscrire (avant le démarrage)          |
| `!lier <code>`        | Lier ce compte à un compte Discord           |
| `!tournoi`            | Infos du tournoi (format, statut, inscrits)  |
| `!participants`       | Liste des inscrits                           |
| `!monmatch`           | Voir son prochain match (avec son code)      |
| `!score 2-1`          | Déclarer le score de son match               |
| `!valider`            | Confirmer le score déclaré par l'adversaire  |
| `!contester`          | Contester le score déclaré → litige          |
| `!bracket`            | Diagramme des rencontres (image)             |
| `!classement`         | Classement (image, multi-images en poules)   |
| `!affichage`          | Voir les réglages d'affichage                |
| `!aide`               | Liste des commandes                          |

### Admin (`ADMIN_NUMBERS`)
| Commande                                   | Description                          |
|--------------------------------------------|--------------------------------------|
| `!creer-tournoi <format> <BO> <nom>`       | Créer un tournoi (simple/double/poules, BO 1/3/5) |
| `!demarrer`                                | Démarrer le tournoi (génère le bracket) |
| `!cloturer`                                | Clôturer le tournoi                  |
| `!litiges`                                 | Lister les matchs en litige (codes)  |
| `!trancher <code> <score>`                 | Résoudre un litige (ex. `!trancher P2-1 2-1`) |
| `!affichage classement\|bracket image\|texte` | Mode d'affichage                  |
| `!affichage plateforme on\|off`            | Badges plateforme on/off             |

> Codes de match : `P2-1` (principal tour 2, match 1), `L3-1` (losers), `GF` (grande finale), `G1-3` (poule 1, match 3).

## Architecture

```
src/
  index.js     -> connexion Baileys (QR, reconnexion, routage messages.upsert)
  handler.js   -> loadCommands() + handleMessage() (parsing préfixe, dispatch)
  api.js       -> client HTTP vers l'API centrale
  config.js    -> configuration (.env)
  commands/    -> une commande par fichier { name, aliases, description, execute }
```

### Ajouter une commande

Créer `src/commands/<nom>.js` :

```js
module.exports = {
  name: 'macommande',
  aliases: ['alias1'],
  description: 'Ce que fait la commande',
  usage: 'macommande <arg>',
  async execute(sock, message, args, ctx) {
    // ctx = { reply, senderJid, isGroup, number, pushName, api, config }
    await ctx.reply('Réponse');
  },
};
```

Le fichier est chargé automatiquement au démarrage par `loadCommands()`.
Les erreurs de type `ApiError` sont déjà gérées par le handler (réponse `⚠️ ...`).
