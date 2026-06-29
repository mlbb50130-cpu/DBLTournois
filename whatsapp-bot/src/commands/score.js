module.exports = {
  name: 'score',
  aliases: ['resultat'],
  description: 'Déclarer le score de ton match en cours',
  usage: 'score <tesManches>-<advManches>',
  category: 'TOURNOI',

  async execute(sock, message, args, ctx) {
    const score = args[0];
    if (!score || !/^\d+-\d+$/.test(score)) {
      await ctx.reply(`Usage : ${ctx.config.PREFIX}score 2-1  (tes manches - celles de l'adversaire)`);
      return;
    }
    const res = await ctx.api.reportScore(ctx.number, score);

    // Ping l'adversaire s'il est sur WhatsApp.
    const num = res.opponent && res.opponent.whatsappNumber;
    if (num) {
      await ctx.reply({
        text: `@${num} ${res.message || '✅ Score déclaré.'}`,
        mentions: [`${num}@s.whatsapp.net`],
      });
      return;
    }
    await ctx.reply(res.message || '✅ Score envoyé. En attente de validation de l’adversaire.');
  },
};
