// Construction des messages texte renvoyés aux bots (champ `message`).

function name(player) {
  return player && player.pseudo ? player.pseudo : 'À déterminer';
}

function formatLabel(format) {
  return (
    {
      simple: 'Élimination simple',
      double: 'Élimination double',
      poules: 'Poules + phase finale',
    }[format] || format
  );
}

// Nom d'un tour à partir du nombre de matchs qu'il contient.
function roundName(matchCount) {
  return (
    {
      1: 'Finale',
      2: 'Demi-finales',
      4: 'Quarts de finale',
      8: 'Huitièmes de finale',
      16: '16es de finale',
    }[matchCount] || `Tour (${matchCount} matchs)`
  );
}

function matchLine(m) {
  const p1 = name(m.player1);
  const p2 = name(m.player2);

  // Qualification d'office (bye) : un seul joueur présent et match déjà terminé.
  if (m.status === 'termine' && (!m.player1 || !m.player2)) {
    return `✅ ${name(m.player1 || m.player2)} (qualifié d'office)`;
  }
  if (m.status === 'termine') {
    return `✅ ${p1} ${m.scoreP1}–${m.scoreP2} ${p2}`;
  }
  if (m.status === 'attente_validation') {
    return `⏳ ${p1} vs ${p2} — score à valider`;
  }
  if (m.status === 'litige') {
    return `⚠️ ${p1} vs ${p2} — litige (admin)`;
  }
  return `• ${p1} vs ${p2}`;
}

function appendRounds(lines, ms, niceLabels) {
  const byRound = new Map();
  for (const m of ms) {
    if (!byRound.has(m.round)) byRound.set(m.round, []);
    byRound.get(m.round).push(m);
  }
  for (const r of [...byRound.keys()].sort((a, b) => a - b)) {
    const list = byRound.get(r).sort((a, b) => a.index - b.index);
    lines.push(`*${niceLabels ? roundName(list.length) : `Tour ${r}`}*`);
    for (const m of list) lines.push(matchLine(m));
  }
}

function formatBracket(tournament, matches) {
  if (!matches.length) {
    return `Le tournoi *${tournament.name}* n'a pas encore démarré.`;
  }

  const lines = [
    `🏆 *${tournament.name}* — ${formatLabel(tournament.format)} (BO${tournament.bestOf})`,
  ];

  if (tournament.format === 'poules') {
    const byGroup = new Map();
    const finals = [];
    for (const m of matches) {
      if (m.bracket === 'poule') {
        if (!byGroup.has(m.group)) byGroup.set(m.group, []);
        byGroup.get(m.group).push(m);
      } else {
        finals.push(m);
      }
    }
    for (const g of [...byGroup.keys()].sort((a, b) => a - b)) {
      lines.push('', `*Poule ${g + 1}*`);
      for (const m of byGroup.get(g).sort((a, b) => a.index - b.index)) lines.push(matchLine(m));
    }
    if (finals.length) {
      lines.push('', '*— Phase finale —*');
      appendRounds(lines, finals, false);
    }
  } else if (tournament.format === 'double') {
    const wb = matches.filter((m) => m.bracket === 'principal');
    const lb = matches.filter((m) => m.bracket === 'perdants');
    const gf = matches.filter((m) => m.bracket === 'finale');
    if (wb.length) {
      lines.push('', '*🏅 Winners bracket*');
      appendRounds(lines, wb, false);
    }
    if (lb.length) {
      lines.push('', '*🔁 Losers bracket*');
      appendRounds(lines, lb, false);
    }
    if (gf.length) {
      lines.push('', '*🏆 Grande finale*');
      for (const m of gf) lines.push(matchLine(m));
    }
  } else {
    lines.push('');
    appendRounds(lines, matches.filter((m) => m.bracket !== 'poule'), true);
  }

  if (tournament.champion) {
    lines.push('', `👑 Champion : *${name(tournament.champion)}*`);
  }
  return lines.join('\n');
}

function formatMyMatch(match, meId, tournament) {
  if (!match) {
    return "Tu n'as pas de match en attente. Tu es peut-être éliminé ou en attente du tour suivant.";
  }

  const iAmP1 = match.player1 && String(match.player1._id) === String(meId);
  const opp = iAmP1 ? match.player2 : match.player1;

  if (!opp) {
    return '🎮 Ton prochain adversaire n’est pas encore connu (un match précédent doit se terminer). Reste prêt !';
  }

  const required = Math.floor(tournament.bestOf / 2) + 1;
  const lines = [
    `🎮 *Ton match* (${matchCode(match)}) — ${tournament.name}`,
    `Adversaire : *${opp.pseudo}*`,
  ];
  if (opp.dblFriendId) lines.push(`Friend ID DBL : ${opp.dblFriendId}`);
  lines.push(`Format : BO${tournament.bestOf} (premier à ${required} manches)`);

  if (match.status === 'attente_validation') {
    lines.push('', '⏳ Un score est en attente : valide-le ou conteste-le.');
  } else {
    lines.push('', 'Quand le match est fini, déclare le résultat (ex. score 2-1).');
  }
  return lines.join('\n');
}

function formatStandings(tournament, matches) {
  const total = tournament.registrations.length;
  const lines = [`🏆 *${tournament.name}* — ${total} joueur(s)`];

  if (tournament.status === 'inscription') {
    lines.push('Inscriptions ouvertes. Le tournoi n’a pas encore démarré.');
    return lines.join('\n');
  }

  if (tournament.champion) {
    lines.push('', `👑 1er : *${name(tournament.champion)}*`);
    const final = matches.find((m) => !m.nextMatch && m.status === 'termine');
    if (final && final.winner) {
      const runnerUp =
        String(final.winner._id) === String(final.player1?._id)
          ? final.player2
          : final.player1;
      if (runnerUp) lines.push(`🥈 2e : *${name(runnerUp)}*`);
    }
    return lines.join('\n');
  }

  // En cours : joueurs encore en lice + tour actuel.
  const eliminated = new Set();
  for (const m of matches) {
    if (m.status === 'termine' && m.winner && m.player1 && m.player2) {
      const loser =
        String(m.winner._id) === String(m.player1._id) ? m.player2 : m.player1;
      if (loser) eliminated.add(String(loser._id));
    }
  }
  lines.push('', `Joueurs encore en lice : ${total - eliminated.size}/${total}`);

  const pending = matches.filter((m) => m.status !== 'termine');
  if (pending.length) {
    const activeRound = Math.min(...pending.map((m) => m.round));
    const ms = matches
      .filter((m) => m.round === activeRound)
      .sort((a, b) => a.index - b.index);
    lines.push('', `*${roundName(ms.length)}* en cours :`);
    for (const m of ms) lines.push(matchLine(m));
  }
  return lines.join('\n');
}

// Code court et stable d'un match (pour le référencer, ex. résolution de litige).
// Ex : P2-1 (principal tour 2 match 1), L3-2 (losers), GF (grande finale),
// G1-3 (poule 1, match 3).
function matchCode(m) {
  if (m.bracket === 'finale') return 'GF';
  if (m.bracket === 'poule') return `G${(m.group ?? 0) + 1}-${(m.index ?? 0) + 1}`;
  const prefix = m.bracket === 'perdants' ? 'L' : 'P';
  return `${prefix}${m.round}-${(m.index ?? 0) + 1}`;
}

// Plateforme(s) d'un joueur d'après ses identifiants liés.
function playerPlatform(p) {
  if (!p) return null;
  const w = !!p.whatsappNumber;
  const d = !!p.discordId;
  if (w && d) return 'both';
  if (d) return 'discord';
  if (w) return 'whatsapp';
  return null;
}

/**
 * Classement complet par tour d'élimination (élimination simple).
 * 1er = champion, 2e = finaliste battu, 3e = demi-finalistes (ex æquo), etc.
 * Les joueurs encore en lice (tournoi en cours) ont rank = null.
 * @returns {Array<{ rank: number|null, pseudo: string, status: string, platform: string }>}
 */
function buildRanking(tournament, matches) {
  if (!matches.length) return [];

  const totalRounds = Math.max(...matches.map((m) => m.round));
  const players = new Map(); // id -> player (populé)
  const elimRound = new Map(); // id -> tour où le joueur a perdu

  for (const m of matches) {
    for (const p of [m.player1, m.player2]) if (p) players.set(String(p._id), p);
    if (m.status === 'termine' && m.winner && m.player1 && m.player2) {
      const loser = String(m.winner._id) === String(m.player1._id) ? m.player2 : m.player1;
      if (loser) elimRound.set(String(loser._id), m.round);
    }
  }

  // Un joueur éliminé au tour r partage le rang 2^(toursRestants)+1.
  const rankForRound = (r) => 2 ** (totalRounds - r) + 1;
  const championId = tournament.champion
    ? String(tournament.champion._id || tournament.champion)
    : null;

  const entries = [];
  for (const [id, p] of players) {
    let rank = null;
    let status = 'en lice';
    if (id === championId) {
      rank = 1;
      status = 'champion';
    } else if (elimRound.has(id)) {
      rank = rankForRound(elimRound.get(id));
      status = rank === 2 ? 'finaliste' : 'éliminé';
    }
    entries.push({ rank, pseudo: p.pseudo, status, platform: playerPlatform(p) });
  }

  entries.sort((a, b) => {
    if (a.rank == null && b.rank == null) return a.pseudo.localeCompare(b.pseudo);
    if (a.rank == null) return -1;
    if (b.rank == null) return 1;
    return a.rank - b.rank || a.pseudo.localeCompare(b.pseudo);
  });

  return entries;
}

// Table de classement des poules : par groupe, agrège points / V-D / manches.
function poolTable(matches) {
  const groups = {};
  const ensure = (g, id) => {
    if (!groups[g]) groups[g] = {};
    if (!groups[g][id]) groups[g][id] = { playerId: id, v: 0, d: 0, mp: 0, mc: 0, pts: 0 };
    return groups[g][id];
  };

  for (const m of matches) {
    if (m.bracket !== 'poule' || !m.player1 || !m.player2) continue;
    const id1 = String(m.player1._id || m.player1);
    const id2 = String(m.player2._id || m.player2);
    const a = ensure(m.group, id1);
    const b = ensure(m.group, id2);
    if (m.status === 'termine') {
      a.mp += m.scoreP1;
      a.mc += m.scoreP2;
      b.mp += m.scoreP2;
      b.mc += m.scoreP1;
      if (m.scoreP1 > m.scoreP2) {
        a.v += 1;
        b.d += 1;
        a.pts += 3;
      } else {
        b.v += 1;
        a.d += 1;
        b.pts += 3;
      }
    }
  }

  const res = {};
  for (const g of Object.keys(groups)) {
    res[g] = Object.values(groups[g]).sort(
      (x, y) => y.pts - x.pts || (y.mp - y.mc) - (x.mp - x.mc) || y.mp - x.mp,
    );
  }
  return res;
}

// Classement structuré des poules (avec pseudos + qualifiés).
function buildPoolStandings(tournament, matches) {
  const table = poolTable(matches);
  const idToPlayer = new Map();
  for (const m of matches) {
    for (const p of [m.player1, m.player2]) if (p && p._id) idToPlayer.set(String(p._id), p);
  }

  const pools = [];
  for (const g of Object.keys(table).map(Number).sort((a, b) => a - b)) {
    const rows = table[String(g)].map((r, i) => {
      const p = idToPlayer.get(r.playerId);
      return {
        rank: i + 1,
        pseudo: p ? p.pseudo : '?',
        platform: playerPlatform(p),
        points: r.pts,
        v: r.v,
        d: r.d,
        mp: r.mp,
        mc: r.mc,
        diff: r.mp - r.mc,
        qualified: i < tournament.qualifiersPerPool,
      };
    });
    pools.push({ group: g + 1, rows });
  }
  return pools;
}

// Classement d'une double élimination (par stade d'élimination).
function buildDoubleRanking(tournament, matches) {
  const players = new Map();
  for (const m of matches) {
    for (const p of [m.player1, m.player2]) if (p) players.set(String(p._id), p);
  }

  let gfWinner = null;
  let gfLoser = null;
  const gf = matches.find((m) => m.bracket === 'finale');
  if (gf && gf.status === 'termine' && gf.winner && gf.player1 && gf.player2) {
    gfWinner = String(gf.winner._id);
    const loser = String(gf.winner._id) === String(gf.player1._id) ? gf.player2 : gf.player1;
    if (loser) gfLoser = String(loser._id);
  }

  const lbElim = new Map(); // id -> tour LB où le joueur a perdu (2e défaite)
  for (const m of matches) {
    if (m.bracket === 'perdants' && m.status === 'termine' && m.winner && m.player1 && m.player2) {
      const loser = String(m.winner._id) === String(m.player1._id) ? m.player2 : m.player1;
      if (loser) lbElim.set(String(loser._id), m.round);
    }
  }

  const entries = [];
  for (const [id, p] of players) {
    let sv;
    let status;
    if (id === gfWinner) {
      sv = Infinity;
      status = 'champion';
    } else if (id === gfLoser) {
      sv = 1e9;
      status = 'finaliste';
    } else if (lbElim.has(id)) {
      sv = lbElim.get(id);
      status = 'éliminé';
    } else {
      sv = -1;
      status = 'en lice';
    }
    entries.push({ pseudo: p.pseudo, sv, status, platform: playerPlatform(p) });
  }

  const alive = entries.filter((e) => e.sv === -1).sort((a, b) => a.pseudo.localeCompare(b.pseudo));
  const done = entries.filter((e) => e.sv !== -1).sort((a, b) => b.sv - a.sv || a.pseudo.localeCompare(b.pseudo));

  const finished = tournament.status === 'termine';
  const out = alive.map((e) => ({ rank: null, pseudo: e.pseudo, status: e.status, platform: e.platform }));

  let rank = 0;
  let lastSv = null;
  done.forEach((e, i) => {
    if (e.sv !== lastSv) {
      rank = alive.length + i + 1;
      lastSv = e.sv;
    }
    out.push({ rank: finished ? rank : null, pseudo: e.pseudo, status: e.status, platform: e.platform });
  });
  return out;
}

// Cellule joueur pour le diagramme (pseudo + plateforme).
function playerCell(p) {
  if (!p) return null;
  return { pseudo: p.pseudo, platform: playerPlatform(p) };
}

// Cellule match pour le diagramme.
function matchCell(m) {
  let winner = null;
  if (m.winner && m.player1) {
    winner = String(m.winner._id || m.winner) === String(m.player1._id) ? 1 : 2;
  }
  return {
    round: m.round,
    index: m.index,
    group: m.group,
    p1: playerCell(m.player1),
    p2: playerCell(m.player2),
    s1: m.scoreP1,
    s2: m.scoreP2,
    status: m.status,
    winner,
  };
}

/**
 * Structure du bracket pour le rendu en diagramme (image).
 * brackets[].type : 'tree' (arbre binaire) | 'columns' (colonnes) | 'single'.
 * pools[] : matchs round-robin par groupe (format poules).
 */
function buildBracketData(tournament, matches) {
  const champion = tournament.champion
    ? { pseudo: tournament.champion.pseudo, platform: playerPlatform(tournament.champion) }
    : null;

  const toRounds = (ms) => {
    const byRound = new Map();
    for (const m of ms) {
      if (!byRound.has(m.round)) byRound.set(m.round, []);
      byRound.get(m.round).push(matchCell(m));
    }
    return [...byRound.keys()]
      .sort((a, b) => a - b)
      .map((r) => byRound.get(r).sort((a, b) => a.index - b.index));
  };

  const data = {
    format: tournament.format,
    name: tournament.name,
    bestOf: tournament.bestOf,
    champion,
    brackets: [],
    pools: [],
  };

  if (tournament.format === 'poules') {
    const byGroup = new Map();
    const finals = [];
    for (const m of matches) {
      if (m.bracket === 'poule') {
        if (!byGroup.has(m.group)) byGroup.set(m.group, []);
        byGroup.get(m.group).push(matchCell(m));
      } else {
        finals.push(m);
      }
    }
    for (const g of [...byGroup.keys()].sort((a, b) => a - b)) {
      data.pools.push({ group: g + 1, matches: byGroup.get(g).sort((a, b) => a.index - b.index) });
    }
    if (finals.length) data.brackets.push({ name: 'Phase finale', type: 'tree', rounds: toRounds(finals) });
  } else if (tournament.format === 'double') {
    const wb = matches.filter((m) => m.bracket === 'principal');
    const lb = matches.filter((m) => m.bracket === 'perdants');
    const gf = matches.filter((m) => m.bracket === 'finale');
    if (wb.length) data.brackets.push({ name: 'Winners bracket', type: 'tree', rounds: toRounds(wb) });
    if (lb.length) data.brackets.push({ name: 'Losers bracket', type: 'columns', rounds: toRounds(lb) });
    if (gf.length) data.brackets.push({ name: 'Grande finale', type: 'single', rounds: [[matchCell(gf[0])]] });
  } else {
    data.brackets.push({ name: '', type: 'tree', rounds: toRounds(matches.filter((m) => m.bracket !== 'poule')) });
  }

  return data;
}

module.exports = {
  formatBracket,
  formatMyMatch,
  formatStandings,
  buildRanking,
  buildPoolStandings,
  buildDoubleRanking,
  buildBracketData,
  poolTable,
  playerPlatform,
  matchCode,
  name,
  formatLabel,
};
