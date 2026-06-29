const Tournament = require('../models/Tournament');
const Match = require('../models/Match');
const { getActive, getLatest } = require('./registrations');
const Settings = require('./settings');
const {
  persistSingleElimination,
  persistDoubleElimination,
  persistPools,
} = require('./persist');
const format = require('../utils/format');
const { AppError } = require('../utils/errors');

async function create({ name, format: fmt, bestOf, maxPlayers } = {}) {
  if (!name) throw new AppError('Nom du tournoi requis.', 400);

  const active = await getActive();
  if (active) {
    throw new AppError(`Un tournoi est déjà actif ("${active.name}"). Termine-le d'abord.`, 409);
  }

  const tournament = await Tournament.create({
    name,
    format: fmt || 'simple',
    bestOf: bestOf || 3,
    maxPlayers: maxPlayers || 0,
  });

  return {
    message: `✅ Tournoi *${tournament.name}* créé (format ${tournament.format}, BO${tournament.bestOf}). Inscriptions ouvertes.`,
    id: tournament._id,
  };
}

/**
 * Démarre un tournoi : génère le bracket et persiste les matchs.
 */
async function start(tournamentId) {
  const tournament = await Tournament.findById(tournamentId);
  if (!tournament) throw new AppError('Tournoi introuvable.', 404);
  if (tournament.status !== 'inscription') {
    throw new AppError('Ce tournoi est déjà démarré ou terminé.', 409);
  }

  const players = tournament.registrations
    .slice()
    .sort((a, b) => (a.seed || 0) - (b.seed || 0))
    .map((r) => r.player);

  if (players.length < 2) throw new AppError('Il faut au moins 2 joueurs inscrits.', 400);

  if (tournament.format === 'simple') {
    await persistSingleElimination(tournament._id, players);
  } else if (tournament.format === 'double') {
    if ((players.length & (players.length - 1)) !== 0) {
      throw new AppError(
        `La double élimination nécessite un nombre de joueurs en puissance de 2 (4, 8, 16, 32…). Actuellement : ${players.length}.`,
        400,
      );
    }
    await persistDoubleElimination(tournament._id, players);
  } else if (tournament.format === 'poules') {
    await persistPools(tournament._id, players, tournament.poolSize);
  } else {
    throw new AppError(`Format inconnu : ${tournament.format}.`, 400);
  }

  tournament.status = 'en_cours';
  await tournament.save();

  return {
    message: `🚀 Tournoi *${tournament.name}* démarré avec ${players.length} joueurs ! Tape la commande "bracket" pour voir le tableau.`,
    id: tournament._id,
  };
}

async function close(tournamentId) {
  const tournament = await Tournament.findById(tournamentId);
  if (!tournament) throw new AppError('Tournoi introuvable.', 404);
  tournament.status = 'termine';
  await tournament.save();
  return { message: `✅ Tournoi *${tournament.name}* clôturé.` };
}

// Démarre le tournoi actif (ouvert aux inscriptions) — sans id à fournir.
async function startActive() {
  const tournament = await getActive();
  if (!tournament) throw new AppError('Aucun tournoi à démarrer.', 404);
  return start(tournament._id);
}

// Clôture le tournoi actif — sans id à fournir.
async function closeActive() {
  const tournament = await getActive();
  if (!tournament) throw new AppError('Aucun tournoi actif à clôturer.', 404);
  return close(tournament._id);
}

async function list() {
  const tournaments = await Tournament.find({}).sort({ createdAt: -1 }).lean();
  return { tournaments };
}

async function bracketMessage() {
  const tournament = await getLatest();
  if (!tournament) return { message: 'Aucun tournoi pour le moment.' };

  const matches = await Match.find({ tournament: tournament._id })
    .sort({ round: 1, index: 1 })
    .populate('player1 player2 winner');
  await tournament.populate('champion');

  return {
    message: format.formatBracket(tournament, matches),
    format: tournament.format,
    display: await Settings.getDisplay(),
    bracketData: format.buildBracketData(tournament, matches),
  };
}

async function standingsMessage() {
  const tournament = await getLatest();
  if (!tournament) return { message: 'Aucun tournoi pour le moment.' };

  const matches = await Match.find({ tournament: tournament._id })
    .sort({ round: 1, index: 1 })
    .populate('player1 player2 winner');
  await tournament.populate('champion');

  const meta = {
    name: tournament.name,
    format: tournament.format,
    bestOf: tournament.bestOf,
    status: tournament.status,
  };
  const display = await Settings.getDisplay();

  if (tournament.format === 'poules') {
    const pools = format.buildPoolStandings(tournament, matches);
    const finalMatches = matches.filter((m) => m.bracket === 'principal');
    const finale = finalMatches.length ? format.buildRanking(tournament, finalMatches) : [];
    return {
      message: format.formatStandings(tournament, matches),
      format: 'poules',
      display,
      standings: { pools, finale },
      tournament: meta,
    };
  }

  const standings =
    tournament.format === 'double'
      ? format.buildDoubleRanking(tournament, matches)
      : format.buildRanking(tournament, matches);

  return {
    message: format.formatStandings(tournament, matches),
    format: tournament.format,
    display,
    standings,
    tournament: meta,
  };
}

module.exports = {
  create,
  start,
  close,
  startActive,
  closeActive,
  list,
  bracketMessage,
  standingsMessage,
};
