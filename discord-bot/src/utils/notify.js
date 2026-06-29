// Notifie un joueur sur ses plateformes liées. En mono-service, les deux bots
// enregistrent leur fonction d'envoi dans global.DBL_NOTIFY (discord/whatsapp).
// En service séparé, seule la plateforme locale est disponible (dégradation OK).
async function notifyOpponent(opponent, text) {
  if (!opponent) return;
  const n = global.DBL_NOTIFY || {};
  if (opponent.discordId && n.discord) {
    try {
      await n.discord(opponent.discordId, text);
    } catch {
      /* DM fermé / utilisateur introuvable */
    }
  }
  if (opponent.whatsappNumber && n.whatsapp) {
    try {
      await n.whatsapp(opponent.whatsappNumber, text);
    } catch {
      /* numéro injoignable */
    }
  }
}

module.exports = { notifyOpponent };
