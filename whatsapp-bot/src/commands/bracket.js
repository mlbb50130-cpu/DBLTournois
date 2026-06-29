const { renderBracketImages } = require('../utils/bracketImage');

// Retire les plateformes des cases si l'option est désactivée.
function stripPlatform(data) {
  if (!data) return;
  if (data.champion) data.champion.platform = null;
  const clearMatch = (m) => {
    if (m.p1) m.p1.platform = null;
    if (m.p2) m.p2.platform = null;
  };
  for (const bracket of data.brackets || []) {
    for (const round of bracket.rounds || []) round.forEach(clearMatch);
  }
  for (const pool of data.pools || []) (pool.matches || []).forEach(clearMatch);
}

module.exports = {
  name: 'bracket',
  aliases: ['tableau', 'arbre', 'rencontres'],
  description: 'Afficher le tableau / les rencontres du tournoi',
  usage: 'bracket',
  category: 'TOURNOI',

  async execute(sock, message, args, ctx) {
    const res = await ctx.api.getBracket();
    const display = res.display || {};

    // Mode texte demandé.
    if (display.bracketMode === 'texte') {
      await ctx.reply(res.message || 'Aucun tournoi actif.');
      return;
    }

    if (res.bracketData) {
      try {
        if (display.showPlatform === false) stripPlatform(res.bracketData);
        const images = await renderBracketImages(res.bracketData);
        for (const img of images) {
          await ctx.reply({ image: img.buffer, caption: img.caption });
        }
        if (images.length) return;
      } catch (err) {
        console.error('Rendu image du bracket échoué, repli texte :', err.message);
      }
    }

    await ctx.reply(res.message || 'Aucun tournoi actif.');
  },
};
