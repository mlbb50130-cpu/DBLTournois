const { isAdmin } = require('../utils/admin');

function recap(prefix, d) {
  return (
    `⚙️ *Affichage actuel*\n` +
    `• Classement : *${d.standingsMode}*\n` +
    `• Rencontres (bracket) : *${d.bracketMode}*\n` +
    `• Badges plateforme : *${d.showPlatform ? 'on' : 'off'}*\n\n` +
    `Pour modifier (admin) :\n` +
    `${prefix}affichage classement image|texte\n` +
    `${prefix}affichage bracket image|texte\n` +
    `${prefix}affichage plateforme on|off`
  );
}

module.exports = {
  name: 'affichage',
  aliases: ['display', 'config'],
  description: "Configurer l'affichage du classement et des rencontres",
  usage: 'affichage [classement|bracket image|texte] [plateforme on|off]',
  category: 'TOURNOI',

  async execute(sock, message, args, ctx) {
    const p = ctx.config.PREFIX;

    // Sans argument : affiche les réglages actuels.
    if (!args.length) {
      const { display } = await ctx.api.getDisplaySettings();
      await ctx.reply(recap(p, display));
      return;
    }

    if (!isAdmin(ctx.number)) {
      await ctx.reply('⛔ Seuls les administrateurs peuvent changer l’affichage.');
      return;
    }

    const key = (args[0] || '').toLowerCase();
    const val = (args[1] || '').toLowerCase();
    const patch = {};

    if (['classement', 'standings'].includes(key) && ['image', 'texte'].includes(val)) {
      patch.standingsMode = val;
    } else if (['bracket', 'rencontres', 'tableau'].includes(key) && ['image', 'texte'].includes(val)) {
      patch.bracketMode = val;
    } else if (['plateforme', 'platform'].includes(key) && ['on', 'off'].includes(val)) {
      patch.showPlatform = val === 'on';
    } else {
      await ctx.reply(
        `Usage :\n${p}affichage classement image|texte\n${p}affichage bracket image|texte\n${p}affichage plateforme on|off`,
      );
      return;
    }

    const res = await ctx.api.updateDisplaySettings(patch);
    await ctx.reply(`${res.message}\n\n${recap(p, res.display)}`);
  },
};
