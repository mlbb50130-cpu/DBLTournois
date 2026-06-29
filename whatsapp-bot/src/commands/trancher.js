module.exports = {
  name: 'trancher',
  aliases: ['resoudre', 'resolve'],
  description: 'Trancher un match par son code (admin)',
  usage: 'trancher <code> <score>',
  category: 'ADMIN',
  adminOnly: true,

  async execute(sock, message, args, ctx) {
    const p = ctx.config.PREFIX;
    const code = args[0];
    const score = args[1];
    if (!code || !score || !/^\d+-\d+$/.test(score)) {
      await ctx.reply(
        `Usage : ${p}trancher <code> <score>\nEx. : ${p}trancher P2-1 2-1\n` +
          `(vois les codes avec ${p}litiges)`,
      );
      return;
    }
    const res = await ctx.api.resolveByCode(code.toUpperCase(), score);
    await ctx.reply(res.message || '✅ Match résolu.');
  },
};
