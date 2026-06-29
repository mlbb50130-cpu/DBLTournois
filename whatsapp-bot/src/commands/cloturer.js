module.exports = {
  name: 'cloturer',
  aliases: ['cloture', 'terminer', 'annuler'],
  description: 'Clôturer le tournoi en cours (admin)',
  usage: 'cloturer',
  category: 'ADMIN',
  adminOnly: true,

  async execute(sock, message, args, ctx) {
    const res = await ctx.api.closeActiveTournament();
    await ctx.reply(res.message);
  },
};
