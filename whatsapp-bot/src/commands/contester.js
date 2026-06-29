module.exports = {
  name: 'contester',
  aliases: ['refuser', 'litige'],
  description: 'Contester le score déclaré par ton adversaire',
  usage: 'contester',
  category: 'TOURNOI',

  async execute(sock, message, args, ctx) {
    const res = await ctx.api.contestScore(ctx.number);
    await ctx.reply(res.message || '⚠️ Score contesté.');
  },
};
