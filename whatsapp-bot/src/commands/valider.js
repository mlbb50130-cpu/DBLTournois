module.exports = {
  name: 'valider',
  aliases: ['confirmer', 'ok'],
  description: 'Confirmer le score déclaré par ton adversaire',
  usage: 'valider',
  category: 'TOURNOI',

  async execute(sock, message, args, ctx) {
    const res = await ctx.api.validateScore(ctx.number);
    await ctx.reply(res.message || '✅ Score validé.');
  },
};
