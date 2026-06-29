// Lanceur mono-service : API + bot WhatsApp + bot Discord dans UN seul processus.
// Idéal pour un déploiement Railway en un seul service (Root Directory = racine).

const PORT = process.env.PORT || 3000;

// Les bots appellent l'API dans le même conteneur (sauf si on force une URL).
if (!process.env.API_BASE_URL) {
  process.env.API_BASE_URL = `http://127.0.0.1:${PORT}`;
}

// Un échec isolé (login bot, etc.) ne doit pas tuer tout le processus.
process.on('unhandledRejection', (e) => {
  console.error('unhandledRejection:', e && e.message ? e.message : e);
});
process.on('uncaughtException', (e) => {
  console.error('uncaughtException:', e && e.message ? e.message : e);
});

console.log('🚀 Démarrage mono-service : API + WhatsApp + Discord');

// L'API démarre en premier (elle écoute sur PORT) ; les bots n'appellent l'API
// qu'au moment d'une commande, donc elle est prête à temps.
require('./api/src/index.js');
require('./whatsapp-bot/src/index.js');
require('./discord-bot/src/index.js');
