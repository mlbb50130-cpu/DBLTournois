module.exports = {
  name: 'desister',
  aliases: ['desinscription', 'quitter'],
  description: 'Se désinscrire (avant le démarrage)',
  usage: 'desister',
  category: 'TOURNOI',

  async execute(sock, message, args, ctx) {
    const res = await ctx.api.withdraw(ctx.number);
    await ctx.reply(res.message || '✅ Désinscription confirmée.');
  },
};
