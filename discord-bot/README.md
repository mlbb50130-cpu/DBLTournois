# Bot Discord — Tournois DBL

Bot Discord (slash commands + images) pour les tournois **Dragon Ball Legends**.
Interface fine vers l'**API centrale** (même logique et mêmes rendus d'image que
le bot WhatsApp). Plateforme `discord` (identité = ID utilisateur Discord).

## Prérequis : créer l'application Discord
1. https://discord.com/developers/applications → **New Application**
2. Onglet **Bot** → *Reset Token* → copie le token → `DISCORD_TOKEN`
3. Onglet **General Information** → *Application ID* → `DISCORD_CLIENT_ID`
4. Inviter le bot sur ton serveur : onglet **OAuth2 → URL Generator** →
   scopes `bot` + `applications.commands` → ouvre l'URL générée.
5. (Recommandé) Mets l'ID de ton serveur dans `DISCORD_GUILD_ID` pour des
   commandes **instantanées** (sinon global ~1h).

## Installation

```bash
cd discord-bot
npm install
cp .env.example .env   # renseigne DISCORD_TOKEN, DISCORD_CLIENT_ID, (DISCORD_GUILD_ID)
npm run deploy         # enregistre les slash commands
npm start              # démarre le bot
```

L'API centrale doit tourner (`API_BASE_URL`, défaut http://localhost:3000).

## Commandes (slash)

**Joueur** : `/join` `/desister` `/lier` `/tournoi` `/participants` `/monmatch`
`/score` `/valider` `/contester` `/bracket` `/classement` `/affichage` `/aide`

**Admin** (permission Administrateur ou `ADMIN_IDS`) :
`/creer-tournoi` `/demarrer` `/cloturer` `/litiges` `/trancher`

## Notes
- Le rendu des images (classement, bracket) est partagé avec le bot WhatsApp
  (copie dans `src/utils/` + assets dans `src/assets/`). Pour changer le visuel,
  pense à mettre à jour les deux bots (ou factoriser plus tard).
- Les réglages d'affichage (`/affichage`) sont **communs** aux deux bots (stockés
  dans l'API), donc cohérents entre WhatsApp et Discord.
- Mets le même `ADMIN_KEY` que l'API pour les commandes admin (vide = ouvert en dev).
