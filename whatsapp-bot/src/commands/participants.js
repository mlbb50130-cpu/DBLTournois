module.exports = {
  name: 'participants',
  aliases: ['joueurs', 'inscrits'],
  description: 'Voir la liste des inscrits',
  usage: 'participants',
  category: 'TOURNOI',

  async execute(sock, message, args, ctx) {
    const res = await ctx.api.getParticipants();
    await ctx.reply(res.message || 'Aucun inscrit.');
  },
};
