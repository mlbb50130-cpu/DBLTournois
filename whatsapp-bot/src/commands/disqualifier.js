module.exports = {
  name: 'disqualifier',
  aliases: ['dq', 'exclure', 'disqualify'],
  description: 'Disqualifier un joueur (pseudo ou mention) (admin)',
  usage: 'disqualifier <@mention|pseudo>',
  category: 'ADMIN',
  adminOnly: true,

  async execute(sock, message, args, ctx) {
    // Mentions WhatsApp (@numéro) -> jids dans contextInfo.
    const ctxInfo =
      message.message?.extendedTextMessage?.contextInfo ||
      message.message?.contextInfo ||
      {};
    const mentioned = ctxInfo.mentionedJid || [];

    let res;
    if (mentioned.length) {
      const number = mentioned[0].split('@')[0];
      res = await ctx.api.disqualify({ platform: 'whatsapp', externalId: number });
    } else {
      const pseudo = args.join(' ').replace(/@/g, '').trim();
      if (!pseudo) {
        await ctx.reply(`Usage : ${ctx.config.PREFIX}disqualifier <@mention ou pseudo>`);
        return;
      }
      res = await ctx.api.disqualify({ pseudo });
    }
    await ctx.reply(res.message || '✅ Joueur disqualifié.');
  },
};
