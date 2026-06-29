module.exports = {
  name: 'litiges',
  aliases: ['contestations'],
  description: 'Lister les matchs en litige (admin)',
  usage: 'litiges',
  category: 'ADMIN',
  adminOnly: true,

  async execute(sock, message, args, ctx) {
    const res = await ctx.api.listLitiges();
    await ctx.reply(res.message || '✅ Aucun litige.');
  },
};
