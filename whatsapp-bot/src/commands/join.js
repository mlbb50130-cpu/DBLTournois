module.exports = {
  name: 'join',
  aliases: ['inscription', 'inscrire'],
  description: "S'inscrire au tournoi en cours",
  usage: 'join [pseudo]',
  category: 'TOURNOI',

  async execute(sock, message, args, ctx) {
    const pseudo = args.join(' ').trim() || undefined;
    const res = await ctx.api.joinTournament(ctx.number, pseudo);
    await ctx.reply(res.message || '✅ Inscription enregistrée.');
  },
};
