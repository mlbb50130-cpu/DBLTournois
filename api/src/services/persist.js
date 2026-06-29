const Match = require('../models/Match');
const {
  generateSingleElimination,
  generateDoubleElimination,
  generatePools,
} = require('./bracket');

// Persiste un bracket à élimination simple (gère les byes du 1er tour).
async function persistSingleElimination(tournamentId, players) {
  const { grid, rounds } = generateSingleElimination(players);

  const docs = {};
  for (let r = 1; r <= rounds; r++) {
    docs[r] = grid[r].map(() => new Match({ tournament: tournamentId, bracket: 'principal' }));
  }
  for (let r = 1; r <= rounds; r++) {
    for (let i = 0; i < grid[r].length; i++) {
      const cell = grid[r][i];
      const doc = docs[r][i];
      doc.round = r;
      doc.index = i;
      doc.player1 = cell.p1 || null;
      doc.player2 = cell.p2 || null;
      if (cell.nextRound) {
        doc.nextMatch = docs[cell.nextRound][cell.nextIndex]._id;
        doc.nextSlot = cell.nextSlot;
      }
    }
  }
  // Byes du 1er tour : qualification d'office.
  for (let i = 0; i < grid[1].length; i++) {
    const cell = grid[1][i];
    const doc = docs[1][i];
    const hasP1 = !!doc.player1;
    const hasP2 = !!doc.player2;
    if (hasP1 !== hasP2) {
      doc.winner = doc.player1 || doc.player2;
      doc.status = 'termine';
      if (cell.nextRound) {
        const nd = docs[cell.nextRound][cell.nextIndex];
        if (cell.nextSlot === 1) nd.player1 = doc.winner;
        else nd.player2 = doc.winner;
      }
    }
  }

  const all = [];
  for (let r = 1; r <= rounds; r++) all.push(...docs[r]);
  await Match.insertMany(all);
  return all.length;
}

// Persiste un bracket à double élimination.
async function persistDoubleElimination(tournamentId, players) {
  const { matches: descs } = generateDoubleElimination(players);

  const byKey = {};
  for (const d of descs) {
    byKey[d.key] = new Match({
      tournament: tournamentId,
      bracket: d.bracket,
      round: d.round,
      index: d.index,
    });
  }
  for (const d of descs) {
    const doc = byKey[d.key];
    doc.player1 = d.p1 || null;
    doc.player2 = d.p2 || null;
    if (d.winnerTo) {
      doc.nextMatch = byKey[d.winnerTo.key]._id;
      doc.nextSlot = d.winnerTo.slot;
    }
    if (d.loserTo) {
      doc.loserNext = byKey[d.loserTo.key]._id;
      doc.loserSlot = d.loserTo.slot;
    }
  }
  await Match.insertMany(Object.values(byKey));
  return descs.length;
}

// Persiste les matchs de poules (round-robin par groupe).
async function persistPools(tournamentId, players, poolSize) {
  const { matches } = generatePools(players, poolSize);
  const docs = matches.map(
    (m, idx) =>
      new Match({
        tournament: tournamentId,
        bracket: 'poule',
        group: m.group,
        round: 0,
        index: idx,
        player1: m.p1,
        player2: m.p2,
      }),
  );
  await Match.insertMany(docs);
  return docs.length;
}

module.exports = { persistSingleElimination, persistDoubleElimination, persistPools };
