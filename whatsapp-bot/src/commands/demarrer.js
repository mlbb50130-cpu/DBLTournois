module.exports = {
  name: 'demarrer',
  aliases: ['demarer', 'lancer', 'start'],
  description: 'Démarrer le tournoi en cours (admin)',
  usage: 'demarrer',
  category: 'ADMIN',
  adminOnly: true,

  async execute(sock, message, args, ctx) {
    const res = await ctx.api.startActiveTournament();
    await ctx.reply(res.message);
  },
};
