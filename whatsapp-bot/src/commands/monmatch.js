const { notifyOpponent } = require('../utils/notify');

module.exports = {
  name: 'monmatch',
  aliases: ['match', 'next'],
  description: 'Voir ton prochain match (notifie ton adversaire)',
  usage: 'monmatch',
  category: 'TOURNOI',

  async execute(sock, message, args, ctx) {
    const res = await ctx.api.getMyMatch(ctx.number);
    await ctx.reply(res.message || "Tu n'as pas de match en attente.");

    // Notifie l'adversaire sur ses plateformes liées.
    if (res.opponent) {
      const text =
        `🔔 *${res.me || 'Un joueur'}* est prêt pour votre match dans *${res.tournament || 'le tournoi'}*. À vous de jouer !`;
      await notifyOpponent(res.opponent, text);
    }
  },
};
