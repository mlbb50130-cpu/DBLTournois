module.exports = {
  name: 'lier',
  aliases: ['link'],
  description: 'Lier ce compte WhatsApp à ton compte Discord',
  usage: 'lier <code>',
  category: 'TOURNOI',

  async execute(sock, message, args, ctx) {
    const code = args[0];
    if (!code) {
      await ctx.reply(`Usage : ${ctx.config.PREFIX}lier <code>\nEx. : ${ctx.config.PREFIX}lier DBL-7F3K`);
      return;
    }
    const res = await ctx.api.linkAccount(ctx.number, code.toUpperCase());
    await ctx.reply(res.message || '✅ Comptes liés.');
  },
};
