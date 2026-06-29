const FORMATS = ['simple', 'double', 'poules'];
const BOS = [1, 3, 5];

module.exports = {
  name: 'creer-tournoi',
  aliases: ['creer', 'ct', 'creertournoi', 'nouveau-tournoi', 'newtournoi'],
  description: 'Créer un tournoi (admin)',
  usage: 'creer-tournoi <simple|double|poules> <BO 1|3|5> <nom>',
  category: 'ADMIN',
  adminOnly: true,

  async execute(sock, message, args, ctx) {
    const p = ctx.config.PREFIX;
    const format = (args[0] || '').toLowerCase();
    const bestOf = parseInt(args[1], 10);
    const name = args.slice(2).join(' ').trim();

    if (!FORMATS.includes(format) || !BOS.includes(bestOf) || !name) {
      await ctx.reply(
        `Usage : ${p}creer-tournoi <simple|double|poules> <1|3|5> <nom>\n` +
          `Ex. : ${p}creer-tournoi double 3 Coupe DBL Saison 1`,
      );
      return;
    }

    const res = await ctx.api.createTournament({ name, format, bestOf });
    await ctx.reply(
      `${res.message}\n\nLes joueurs peuvent s'inscrire avec ${p}join. ` +
        `Lance le tournoi avec ${p}demarrer quand tout le monde est inscrit.`,
    );
  },
};
