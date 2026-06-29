const { getAllCommands } = require('../handler');
const { isAdmin } = require('../utils/admin');

module.exports = {
  name: 'aide',
  aliases: ['help', 'menu', 'commandes'],
  description: 'Afficher la liste des commandes',
  usage: 'aide',
  category: 'TOURNOI',

  async execute(sock, message, args, ctx) {
    const p = ctx.config.PREFIX;
    const admin = isAdmin(ctx.number);

    const all = getAllCommands();
    const joueur = all.filter((c) => !c.adminOnly && c.category !== 'ADMIN');
    const line = (c) => `• ${p}${c.usage || c.name} — ${c.description}`;

    let msg = `🐉 *${ctx.config.BOT_NAME}* — commandes\n\n${joueur.map(line).join('\n')}`;

    if (admin) {
      const adminCmds = all.filter((c) => c.adminOnly || c.category === 'ADMIN');
      if (adminCmds.length) {
        msg += `\n\n🔧 *Admin*\n${adminCmds.map(line).join('\n')}`;
      }
    }

    msg += `\n\nExemples : ${p}join, ${p}score 2-1, ${p}lier DBL-7F3K`;
    await ctx.reply(msg);
  },
};
