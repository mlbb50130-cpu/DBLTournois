const Match = require('../models/Match');
const Tournament = require('../models/Tournament');
const Player = require('../models/Player');
const Players = require('./players');
const { getActive } = require('./registrations');
const { persistSingleElimination } = require('./persist');
const format = require('../utils/format');
const { AppError } = require('../utils/errors');

// Match en cours d'un joueur (à jouer ou en attente de validation).
function getCurrentMatch(tournamentId, playerId) {
  return Match.findOne({
    tournament: tournamentId,
    status: { $in: ['a_jouer', 'attente_validation'] },
    $or: [{ player1: playerId }, { player2: playerId }],
  }).sort({ round: 1, index: 1 });
}

async function requirePlayer(platform, externalId) {
  const player = await Players.findByPlatform(platform, externalId);
  if (!player) throw new AppError("Tu n'es pas inscrit. Inscris-toi d'abord.", 404);
  return player;
}

async function requireRunningTournament() {
  const tournament = await getActive();
  if (!tournament || tournament.status !== 'en_cours') {
    throw new AppError("Aucun tournoi n'est en cours.", 409);
  }
  return tournament;
}

// Aiguille le gagnant (et, en double élimination, le perdant) vers la suite.
// Sans match suivant => match terminal (finale / grande finale) => champion.
async function advanceMatch(match, tournament) {
  const loser =
    String(match.winner) === String(match.player1) ? match.player2 : match.player1;

  if (match.nextMatch) {
    const next = await Match.findById(match.nextMatch);
    if (next) {
      if (match.nextSlot === 1) next.player1 = match.winner;
      else next.player2 = match.winner;
      await next.save();
    }
  }

  // Un joueur disqualifié n'est PAS repêché dans le losers bracket.
  const loserDQ = (tournament.disqualified || []).some((id) => String(id) === String(loser));
  if (match.loserNext && loser && !loserDQ) {
    const lnext = await Match.findById(match.loserNext);
    if (lnext) {
      if (match.loserSlot === 1) lnext.player1 = loser;
      else lnext.player2 = loser;
      await lnext.save();
    }
  }

  if (!match.nextMatch) {
    tournament.champion = match.winner;
    tournament.status = 'termine';
    await tournament.save();
    return { champion: match.winner };
  }
  return { champion: null };
}

// Format poules : à la fin de tous les matchs de groupe, génère le bracket final.
async function handlePouleCompletion(tournament) {
  if (tournament.finalGenerated) return { champion: null };

  const remaining = await Match.countDocuments({
    tournament: tournament._id,
    bracket: 'poule',
    status: { $ne: 'termine' },
  });
  if (remaining > 0) return { champion: null };

  const pouleMatches = await Match.find({ tournament: tournament._id, bracket: 'poule' });
  const table = format.poolTable(pouleMatches);

  // Qualifiés interclassés (1er de chaque poule, puis 2e de chaque poule, …).
  const groups = Object.keys(table).map(Number).sort((a, b) => a - b);
  const qualifiers = [];
  for (let r = 0; r < tournament.qualifiersPerPool; r++) {
    for (const g of groups) {
      const row = table[String(g)][r];
      if (row) qualifiers.push(row.playerId);
    }
  }

  tournament.finalGenerated = true;
  if (qualifiers.length < 2) {
    // Pas assez de qualifiés : on clôture.
    tournament.status = 'termine';
    if (qualifiers.length === 1) tournament.champion = qualifiers[0];
    await tournament.save();
    return { champion: tournament.champion };
  }

  await persistSingleElimination(tournament._id, qualifiers);
  await tournament.save();
  return { champion: null };
}

// Aiguillage selon le type de match.
async function onMatchCompleted(match, tournament) {
  if (match.bracket === 'poule') return handlePouleCompletion(tournament);
  return advanceMatch(match, tournament);
}

async function getMyMatchMessage(platform, externalId) {
  const player = await requirePlayer(platform, externalId);
  const tournament = await getActive();
  if (!tournament) return { message: 'Aucun tournoi actif.' };
  if (tournament.status === 'inscription') {
    return { message: `Le tournoi *${tournament.name}* n'a pas encore démarré.` };
  }

  const current = await getCurrentMatch(tournament._id, player._id);
  const populated = current
    ? await Match.findById(current._id).populate('player1 player2')
    : null;

  // Adversaire (si connu) pour permettre au bot de le notifier.
  let opponent = null;
  if (populated && populated.player1 && populated.player2) {
    const opp = String(populated.player1._id) === String(player._id) ? populated.player2 : populated.player1;
    if (opp) {
      opponent = {
        pseudo: opp.pseudo,
        discordId: opp.discordId || null,
        whatsappNumber: opp.whatsappNumber || null,
      };
    }
  }

  return {
    message: format.formatMyMatch(populated, player._id, tournament),
    opponent,
    me: player.pseudo,
    tournament: tournament.name,
  };
}

/**
 * Déclare un score (depuis le point de vue du joueur : "mesManches-advManches").
 * Passe le match en attente de validation par l'adversaire.
 */
async function reportScore(platform, externalId, scoreStr) {
  const player = await requirePlayer(platform, externalId);
  const tournament = await requireRunningTournament();

  const match = await getCurrentMatch(tournament._id, player._id);
  if (!match) throw new AppError("Tu n'as pas de match à jouer.", 404);
  if (!match.player1 || !match.player2) {
    throw new AppError("Ton adversaire n'est pas encore connu.", 409);
  }

  const m = /^(\d+)-(\d+)$/.exec(String(scoreStr || ''));
  if (!m) throw new AppError('Format de score invalide. Exemple : 2-1', 400);

  const mine = Number(m[1]);
  const theirs = Number(m[2]);
  const required = Math.floor(tournament.bestOf / 2) + 1;
  if (
    mine === theirs ||
    Math.max(mine, theirs) !== required ||
    Math.min(mine, theirs) >= required ||
    mine + theirs > tournament.bestOf
  ) {
    throw new AppError(
      `Score invalide pour un BO${tournament.bestOf}. Le gagnant doit atteindre exactement ${required} manches.`,
      400,
    );
  }

  const iAmP1 = String(match.player1) === String(player._id);
  match.pendingP1 = iAmP1 ? mine : theirs;
  match.pendingP2 = iAmP1 ? theirs : mine;
  match.reportedBy = player._id;
  match.status = 'attente_validation';
  await match.save();

  const oppId = iAmP1 ? match.player2 : match.player1;
  const opp = await Player.findById(oppId);
  return {
    message:
      `✅ Score déclaré : tu annonces ${mine}-${theirs}.\n` +
      `*${opp?.pseudo || 'Ton adversaire'}* doit le valider (ou le contester).`,
    opponent: opp
      ? {
          pseudo: opp.pseudo,
          discordId: opp.discordId || null,
          whatsappNumber: opp.whatsappNumber || null,
        }
      : null,
  };
}

/**
 * Confirme le score déclaré par l'adversaire et fait avancer le gagnant.
 */
async function validateScore(platform, externalId) {
  const player = await requirePlayer(platform, externalId);
  const tournament = await requireRunningTournament();

  const match = await Match.findOne({
    tournament: tournament._id,
    status: 'attente_validation',
    $or: [{ player1: player._id }, { player2: player._id }],
  }).sort({ round: 1, index: 1 });

  if (!match) throw new AppError("Aucun score à valider pour toi.", 404);
  if (String(match.reportedBy) === String(player._id)) {
    throw new AppError(
      'Tu ne peux pas valider ton propre score. Ton adversaire doit le confirmer (ou un admin).',
      403,
    );
  }
  if (match.pendingP1 == null || match.pendingP2 == null) {
    throw new AppError('Aucun score en attente.', 409);
  }

  match.scoreP1 = match.pendingP1;
  match.scoreP2 = match.pendingP2;
  match.winner = match.scoreP1 > match.scoreP2 ? match.player1 : match.player2;
  match.status = 'termine';
  match.pendingP1 = null;
  match.pendingP2 = null;
  await match.save();

  const result = await onMatchCompleted(match, tournament);

  let message = `✅ Score validé : ${match.scoreP1}-${match.scoreP2}.`;
  if (result.champion) {
    const champ = await Player.findById(result.champion);
    message += `\n\n👑 *${champ?.pseudo || 'Le vainqueur'}* remporte le tournoi ! Félicitations 🎉`;
  } else {
    message += '\nLe gagnant passe au tour suivant.';
  }
  return { message };
}

/**
 * Conteste le score déclaré par l'adversaire : le match passe en litige.
 */
async function contestScore(platform, externalId) {
  const player = await requirePlayer(platform, externalId);
  const tournament = await requireRunningTournament();

  const match = await Match.findOne({
    tournament: tournament._id,
    status: 'attente_validation',
    $or: [{ player1: player._id }, { player2: player._id }],
  }).sort({ round: 1, index: 1 });

  if (!match) throw new AppError("Aucun score à contester pour toi.", 404);
  if (String(match.reportedBy) === String(player._id)) {
    throw new AppError('Tu ne peux pas contester ton propre score.', 403);
  }

  match.status = 'litige';
  match.pendingP1 = null;
  match.pendingP2 = null;
  match.reportedBy = null;
  await match.save();

  return {
    message: `⚠️ Score contesté (match ${format.matchCode(match)}). Un administrateur doit trancher.`,
  };
}

// Applique un score à un match et fait progresser le tournoi.
async function resolveMatch(match, scoreStr) {
  if (!match.player1 || !match.player2) throw new AppError('Match incomplet.', 409);
  const m = /^(\d+)-(\d+)$/.exec(String(scoreStr || ''));
  if (!m) throw new AppError('Format de score invalide. Exemple : 2-1', 400);
  if (Number(m[1]) === Number(m[2])) throw new AppError('Un match ne peut pas être nul.', 400);

  match.scoreP1 = Number(m[1]);
  match.scoreP2 = Number(m[2]);
  match.winner = match.scoreP1 > match.scoreP2 ? match.player1 : match.player2;
  match.status = 'termine';
  match.pendingP1 = null;
  match.pendingP2 = null;
  await match.save();

  const tournament = await Tournament.findById(match.tournament);
  const result = await onMatchCompleted(match, tournament);
  return {
    message:
      `✅ Match ${format.matchCode(match)} résolu : ${match.scoreP1}-${match.scoreP2}.` +
      (result.champion ? ' Champion désigné.' : ''),
  };
}

// Résolution admin par id (compat).
async function adminResolve(matchId, scoreStr) {
  const match = await Match.findById(matchId);
  if (!match) throw new AppError('Match introuvable.', 404);
  return resolveMatch(match, scoreStr);
}

// Résolution admin par code court (ex. P2-1) sur le tournoi actif.
async function adminResolveByCode(code, scoreStr) {
  const tournament = await getActive();
  if (!tournament) throw new AppError('Aucun tournoi actif.', 404);

  const wanted = String(code || '').toUpperCase();
  const matches = await Match.find({ tournament: tournament._id });
  const match = matches.find((mm) => format.matchCode(mm) === wanted);
  if (!match) throw new AppError(`Aucun match avec le code ${wanted}.`, 404);

  return resolveMatch(match, scoreStr);
}

// Liste les matchs en litige du tournoi actif (pour les admins).
async function listLitiges() {
  const tournament = await getActive();
  if (!tournament) return { message: 'Aucun tournoi actif.' };

  const matches = await Match.find({ tournament: tournament._id, status: 'litige' })
    .sort({ round: 1, index: 1 })
    .populate('player1 player2');

  if (!matches.length) return { message: '✅ Aucun litige en cours.' };

  const lines = matches.map(
    (m) =>
      `• *${format.matchCode(m)}* : ${format.name(m.player1)} vs ${format.name(m.player2)}`,
  );
  return {
    message: `⚠️ *Litiges en cours*\n${lines.join('\n')}\n\nRésous avec la commande de résolution + le code + le score.`,
  };
}

/**
 * Disqualifie un joueur (par pseudo) du tournoi actif.
 * - Inscriptions : retire son inscription.
 * - En cours     : forfait — ses matchs en attente (avec adversaire connu) sont
 *   gagnés par ses adversaires ; il n'est pas repêché en double élimination.
 */
async function disqualify(opts = {}) {
  const tournament = await getActive();
  if (!tournament) throw new AppError('Aucun tournoi actif.', 404);
  await tournament.populate('registrations.player');

  const players = tournament.registrations.map((r) => r.player).filter(Boolean);

  // Identification : par mention (plateforme + externalId) OU par pseudo.
  let player = null;
  if (opts.platform && opts.externalId) {
    const field = opts.platform === 'discord' ? 'discordId' : 'whatsappNumber';
    player = players.find((p) => p[field] === String(opts.externalId));
    if (!player) throw new AppError("Ce joueur n'est pas inscrit au tournoi.", 404);
  } else {
    const q = String(opts.pseudo || '').trim().toLowerCase();
    if (!q) throw new AppError('Indique le joueur à disqualifier (pseudo ou mention).', 400);
    player = players.find((p) => p.pseudo.toLowerCase() === q);
    if (!player) throw new AppError(`Aucun joueur "${opts.pseudo}" dans le tournoi.`, 404);
  }

  if (tournament.status === 'inscription') {
    tournament.registrations = tournament.registrations.filter(
      (r) => String(r.player._id) !== String(player._id),
    );
    await tournament.save();
    return { message: `✅ *${player.pseudo}* disqualifié (inscription retirée).` };
  }
  if (tournament.status !== 'en_cours') {
    throw new AppError('Le tournoi est déjà terminé.', 409);
  }

  if (!tournament.disqualified) tournament.disqualified = [];
  if (!tournament.disqualified.some((id) => String(id) === String(player._id))) {
    tournament.disqualified.push(player._id);
    await tournament.save();
  }

  const pending = await Match.find({
    tournament: tournament._id,
    status: { $in: ['a_jouer', 'attente_validation'] },
    $or: [{ player1: player._id }, { player2: player._id }],
  }).sort({ round: 1, index: 1 });

  const required = Math.floor(tournament.bestOf / 2) + 1;
  let awarded = 0;
  for (const m of pending) {
    if (!m.player1 || !m.player2) continue; // adversaire pas encore connu
    const dqIsP1 = String(m.player1) === String(player._id);
    m.scoreP1 = dqIsP1 ? 0 : required;
    m.scoreP2 = dqIsP1 ? required : 0;
    m.winner = dqIsP1 ? m.player2 : m.player1;
    m.status = 'termine';
    m.pendingP1 = null;
    m.pendingP2 = null;
    await m.save();
    await onMatchCompleted(m, tournament);
    awarded += 1;
  }

  const extra = awarded ? ` ${awarded} match(s) gagné(s) par forfait par ses adversaires.` : '';
  return { message: `✅ *${player.pseudo}* disqualifié.${extra}` };
}

module.exports = {
  getMyMatchMessage,
  reportScore,
  validateScore,
  contestScore,
  adminResolve,
  adminResolveByCode,
  listLitiges,
  disqualify,
};
