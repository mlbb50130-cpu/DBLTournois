require('dotenv').config({ quiet: true });

module.exports = {
  TOKEN: process.env.DISCORD_TOKEN || '',
  CLIENT_ID: process.env.DISCORD_CLIENT_ID || '',
  GUILD_ID: process.env.DISCORD_GUILD_ID || '',
  BOT_NAME: process.env.BOT_NAME || 'DBL Tournois',

  API_BASE_URL: process.env.API_BASE_URL || 'http://localhost:3000',
  API_KEY: process.env.API_KEY || '',
  ADMIN_KEY: process.env.ADMIN_KEY || '',

  ADMIN_IDS: process.env.ADMIN_IDS
    ? process.env.ADMIN_IDS.split(',').map((s) => s.trim()).filter(Boolean)
    : [],
};
