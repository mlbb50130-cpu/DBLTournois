// Moteur de génération de bracket. Phase 1 : élimination simple.
// (double / poules : Phase 4 — voir tournaments.start)

function nextPow2(n) {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

/**
 * Ordre de seeding standard pour un bracket de taille `size` (puissance de 2).
 * Retourne un tableau de graines (1..size) dans l'ordre des positions, tel que
 * les têtes de série soient réparties dans des moitiés opposées et que les byes
 * (graines > nombre de joueurs) reviennent aux meilleures têtes de série.
 */
function seedPositions(size) {
  let positions = [1, 2];
  while (positions.length < size) {
    const sum = positions.length * 2 + 1;
    const next = [];
    for (const p of positions) {
      next.push(p);
      next.push(sum - p);
    }
    positions = next;
  }
  return positions;
}

/**
 * Construit la grille d'un tournoi à élimination simple.
 * @param {Array} players  Identifiants des joueurs, dans l'ordre des graines.
 * @returns {{ grid: object, rounds: number, size: number }}
 *   grid[round] = [{ p1, p2, nextRound?, nextIndex?, nextSlot? }, ...]
 */
function generateSingleElimination(players) {
  const n = players.length;
  const size = nextPow2(n);
  const rounds = Math.log2(size);
  const pos = seedPositions(size);
  const seedToPlayer = (s) => (s <= n ? players[s - 1] : null);

  const grid = {};
  for (let r = 1; r <= rounds; r++) {
    const count = size / 2 ** r;
    grid[r] = [];
    for (let i = 0; i < count; i++) grid[r].push({ p1: null, p2: null });
  }

  // Premier tour : appariement des positions (2i, 2i+1).
  for (let i = 0; i < grid[1].length; i++) {
    grid[1][i].p1 = seedToPlayer(pos[2 * i]);
    grid[1][i].p2 = seedToPlayer(pos[2 * i + 1]);
  }

  // Liens vers le tour suivant.
  for (let r = 1; r < rounds; r++) {
    for (let i = 0; i < grid[r].length; i++) {
      grid[r][i].nextRound = r + 1;
      grid[r][i].nextIndex = Math.floor(i / 2);
      grid[r][i].nextSlot = i % 2 === 0 ? 1 : 2;
    }
  }

  return { grid, rounds, size };
}

/**
 * Répartit les joueurs en groupes et génère les matchs round-robin de chaque
 * poule (chaque joueur affronte tous les autres de son groupe).
 * @param {Array} players  joueurs (ordre des graines)
 * @param {number} poolSize  taille cible d'un groupe
 * @returns {{ pools: Array<Array>, matches: Array<{group:number,p1:any,p2:any}>, numPools:number }}
 */
function generatePools(players, poolSize = 4) {
  const n = players.length;
  const numPools = Math.max(1, Math.ceil(n / Math.max(2, poolSize)));
  const pools = Array.from({ length: numPools }, () => []);

  // Distribution équilibrée (serpentin par index).
  players.forEach((p, i) => pools[i % numPools].push(p));

  const matches = [];
  pools.forEach((group, gi) => {
    for (let a = 0; a < group.length; a++) {
      for (let b = a + 1; b < group.length; b++) {
        matches.push({ group: gi, p1: group[a], p2: group[b] });
      }
    }
  });

  return { pools, matches, numPools };
}

/**
 * Génère un bracket à double élimination (winners + losers + grande finale).
 * Nécessite un nombre de joueurs en puissance de 2.
 * @param {Array} players  joueurs (ordre des graines)
 * @returns {{ matches: Array, byKey: object, wbRounds:number, lbRounds:number }}
 *   Chaque match : { key, bracket, round, index, p1, p2, winnerTo, loserTo }
 *   winnerTo/loserTo = { key, slot } | null (null = sortie : champion / éliminé)
 */
function generateDoubleElimination(players) {
  const n = players.length;
  if (n < 2 || (n & (n - 1)) !== 0) {
    throw new Error(
      'La double élimination nécessite un nombre de joueurs en puissance de 2 (4, 8, 16, 32…).',
    );
  }
  const k = Math.log2(n); // tours du winners bracket
  const pos = seedPositions(n);
  const seedToPlayer = (s) => players[s - 1];

  const byKey = {};
  const matches = [];
  const key = (bracket, round, index) => `${bracket}-${round}-${index}`;
  const add = (bracket, round, index) => {
    const d = { key: key(bracket, round, index), bracket, round, index, p1: null, p2: null, winnerTo: null, loserTo: null };
    byKey[d.key] = d;
    matches.push(d);
    return d;
  };

  // --- Winners bracket ---
  for (let r = 1; r <= k; r++) {
    const count = n / 2 ** r;
    for (let i = 0; i < count; i++) add('principal', r, i);
  }
  for (let i = 0; i < n / 2; i++) {
    byKey[key('principal', 1, i)].p1 = seedToPlayer(pos[2 * i]);
    byKey[key('principal', 1, i)].p2 = seedToPlayer(pos[2 * i + 1]);
  }
  for (let r = 1; r < k; r++) {
    const count = n / 2 ** r;
    for (let i = 0; i < count; i++) {
      byKey[key('principal', r, i)].winnerTo = {
        key: key('principal', r + 1, Math.floor(i / 2)),
        slot: i % 2 === 0 ? 1 : 2,
      };
    }
  }

  // --- Losers bracket (2(k-1) tours, alternance mineur/majeur) ---
  for (let m = 1; m <= k - 1; m++) {
    const cnt = 2 ** (k - 1 - m);
    for (let i = 0; i < cnt; i++) add('perdants', 2 * m - 1, i); // tour mineur
    for (let i = 0; i < cnt; i++) add('perdants', 2 * m, i); // tour majeur
  }

  // --- Grande finale ---
  add('finale', 1, 0);

  // Routage des perdants du WB.
  for (let i = 0; i < n / 2; i++) {
    byKey[key('principal', 1, i)].loserTo = {
      key: key('perdants', 1, Math.floor(i / 2)),
      slot: i % 2 === 0 ? 1 : 2,
    };
  }
  for (let j = 2; j <= k; j++) {
    const count = n / 2 ** j;
    for (let i = 0; i < count; i++) {
      byKey[key('principal', j, i)].loserTo = { key: key('perdants', 2 * (j - 1), i), slot: 2 };
    }
  }

  // Liens des vainqueurs du LB.
  for (let m = 1; m <= k - 1; m++) {
    const cnt = 2 ** (k - 1 - m);
    for (let i = 0; i < cnt; i++) {
      byKey[key('perdants', 2 * m - 1, i)].winnerTo = { key: key('perdants', 2 * m, i), slot: 1 };
    }
    if (m < k - 1) {
      for (let i = 0; i < cnt; i++) {
        byKey[key('perdants', 2 * m, i)].winnerTo = {
          key: key('perdants', 2 * m + 1, Math.floor(i / 2)),
          slot: i % 2 === 0 ? 1 : 2,
        };
      }
    } else {
      byKey[key('perdants', 2 * m, 0)].winnerTo = { key: key('finale', 1, 0), slot: 2 };
    }
  }

  // WB final -> grande finale (slot 1). GF : vainqueur = champion, perdant = 2e.
  byKey[key('principal', k, 0)].winnerTo = { key: key('finale', 1, 0), slot: 1 };

  return { matches, byKey, wbRounds: k, lbRounds: 2 * (k - 1) };
}

module.exports = {
  generateSingleElimination,
  generatePools,
  generateDoubleElimination,
  seedPositions,
  nextPow2,
};
