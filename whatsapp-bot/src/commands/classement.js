const { renderStandingsImages } = require('../utils/standingsImage');

// Retire les plateformes si l'option est désactivée (pas de badges dessinés).
function stripPlatform(standings) {
  if (Array.isArray(standings)) {
    standings.forEach((s) => {
      s.platform = null;
    });
  } else if (standings && Array.isArray(standings.pools)) {
    standings.pools.forEach((pool) => pool.rows.forEach((r) => {
      r.platform = null;
    }));
    (standings.finale || []).forEach((s) => {
      s.platform = null;
    });
  }
}

module.exports = {
  name: 'classement',
  aliases: ['leaderboard', 'top', 'rang'],
  description: 'Afficher le classement',
  usage: 'classement',
  category: 'TOURNOI',

  async execute(sock, message, args, ctx) {
    const res = await ctx.api.getStandings();
    const display = res.display || {};

    // Mode texte demandé.
    if (display.standingsMode === 'texte') {
      await ctx.reply(res.message || 'Classement indisponible.');
      return;
    }

    const hasData =
      (Array.isArray(res.standings) && res.standings.length) ||
      (res.standings && Array.isArray(res.standings.pools) && res.standings.pools.length);

    if (hasData) {
      try {
        if (display.showPlatform === false) stripPlatform(res.standings);
        const images = await renderStandingsImages(res);
        for (const img of images) {
          await ctx.reply({ image: img.buffer, caption: img.caption });
        }
        if (images.length) return;
      } catch (err) {
        console.error('Rendu image du classement échoué, repli texte :', err.message);
      }
    }

    await ctx.reply(res.message || 'Classement indisponible.');
  },
};
