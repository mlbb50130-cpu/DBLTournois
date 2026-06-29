module.exports = {
  name: 'monmatch',
  aliases: ['match', 'next'],
  description: 'Voir ton prochain match',
  usage: 'monmatch',
  category: 'TOURNOI',

  async execute(sock, message, args, ctx) {
    const res = await ctx.api.getMyMatch(ctx.number);
    await ctx.reply(res.message || "Tu n'as pas de match en attente.");
  },
};
