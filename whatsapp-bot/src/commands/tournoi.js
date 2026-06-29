module.exports = {
  name: 'tournoi',
  aliases: ['infos', 'info', 'statut'],
  description: 'Voir les infos du tournoi en cours',
  usage: 'tournoi',
  category: 'TOURNOI',

  async execute(sock, message, args, ctx) {
    const res = await ctx.api.getInfo();
    await ctx.reply(res.message || 'Aucun tournoi pour le moment.');
  },
};
