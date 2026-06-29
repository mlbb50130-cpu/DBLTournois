require('dotenv').config({ quiet: true });

module.exports = {
  // Préfixe des commandes (ex. "!join").
  PREFIX: process.env.PREFIX || process.env.BOT_PREFIX || '!',
  BOT_NAME: process.env.BOT_NAME || 'DBL Tournois',

  // API centrale : source de vérité unique (cf. DESIGN.md).
  API_BASE_URL: process.env.API_BASE_URL || 'http://localhost:3000',
  API_KEY: process.env.API_KEY || '',

  // Clé d'admin envoyée à l'API pour les actions protégées (création, démarrage…).
  ADMIN_KEY: process.env.ADMIN_KEY || '',

  // Dossier de session WhatsApp (useMultiFileAuthState de Baileys).
  SESSION_PATH: process.env.SESSION_PATH || './whatsapp_auth',

  // Numéro du bot (avec indicatif, chiffres uniquement) pour l'appairage par code.
  WHATSAPP_NUMBER: (process.env.WHATSAPP_NUMBER || '').replace(/[^0-9]/g, ''),
  // Prioriser le code d'appairage plutôt que le QR (true par défaut).
  USE_PAIRING_CODE: process.env.USE_PAIRING_CODE
    ? process.env.USE_PAIRING_CODE === 'true'
    : true,

  // Numéros administrateurs (séparés par des virgules) autorisés à configurer.
  // Vide = tout le monde peut configurer (dev).
  ADMIN_NUMBERS: process.env.ADMIN_NUMBERS
    ? process.env.ADMIN_NUMBERS.split(',').map((s) => s.trim()).filter(Boolean)
    : [],
};
