const { PermissionFlagsBits } = require('discord.js');
const config = require('../config');

// Admin si : ADMIN_IDS vide (dev), ou id listé, ou permission Administrateur.
function isAdmin(interaction) {
  if (config.ADMIN_IDS.length === 0) return true;
  if (config.ADMIN_IDS.includes(interaction.user.id)) return true;
  try {
    if (interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) return true;
  } catch {
    /* hors serveur */
  }
  return false;
}

module.exports = { isAdmin };
