const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('@napi-rs/canvas');

// Diagramme de bracket (arbre de tournoi). Utilise les assets de l'utilisateur
// (fond + logo) avec un voile renforcé pour garder le diagramme lisible.

const ASSETS_DIR = path.join(__dirname, '..', 'assets');
const MARGIN = 30;
const HEADER_H = 96;
const BOX_W = 224;
const ROW_H = 31;
const BOX_H = ROW_H * 2;
const V_GAP = 26;
const COL_GAP = 54;

function truncate(text, max) {
  const s = String(text || '');
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function findAsset(...names) {
  for (const n of names) {
    const p = path.join(ASSETS_DIR, n);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

async function loadAssets() {
  const bgFile = findAsset('background.png', 'background.jpg', 'background.jpeg', 'bg.png', 'bg.jpg');
  const logoFile = findAsset('logo.png', 'logo-dbl.png', 'logo.jpg');
  let bg = null;
  let logo = null;
  if (bgFile) {
    try {
      bg = await loadImage(bgFile);
    } catch {
      bg = null;
    }
  }
  if (logoFile) {
    try {
      logo = await loadImage(logoFile);
    } catch {
      logo = null;
    }
  }
  return { bg, logo };
}

function drawCover(ctx, img, x, y, w, h) {
  const ir = img.width / img.height;
  const r = w / h;
  let dw;
  let dh;
  if (ir > r) {
    dh = h;
    dw = h * ir;
  } else {
    dw = w;
    dh = w / ir;
  }
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

function roundRect(ctx, x, y, w, h, r) {
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function platformTokens(platform) {
  if (platform === 'both') return [['WA', '#25D366'], ['DC', '#5865F2']];
  if (platform === 'discord') return [['DC', '#5865F2']];
  if (platform === 'whatsapp') return [['WA', '#25D366']];
  return [];
}

function drawBadges(ctx, x, cy, platform) {
  const tokens = platformTokens(platform);
  const w = 22;
  const h = 15;
  let bx = x;
  ctx.font = 'bold 10px Arial';
  ctx.textBaseline = 'middle';
  for (const [label, color] of tokens) {
    roundRect(ctx, bx, cy - h / 2, w, h, 4);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(label, bx + w / 2, cy + 1);
    bx += w + 4;
  }
  ctx.textAlign = 'left';
  return bx - x;
}

function drawHeader(ctx, width, title, subtitle, logo) {
  let titleX = 90;

  if (logo) {
    const lh = 60;
    const lw = (logo.width / logo.height) * lh;
    ctx.drawImage(logo, MARGIN, 14, lw, lh);
    titleX = MARGIN + lw + 18;
  } else {
    // Emblème Dragon Ball dessiné (repli).
    const cx = 52;
    const cy = 48;
    const R = 24;
    ctx.save();
    ctx.shadowColor = 'rgba(255,150,30,0.85)';
    ctx.shadowBlur = R;
    const g = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.35, R * 0.1, cx, cy, R);
    g.addColorStop(0, '#fff1c9');
    g.addColorStop(0.45, '#ffb43a');
    g.addColorStop(1, '#e8650a');
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#c81212';
    for (const [dx, dy] of [[-8, -8], [8, -8], [-8, 8], [8, 8]]) {
      ctx.beginPath();
      ctx.arc(cx + dx, cy + dy, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
    titleX = 90;
  }

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 6;
  ctx.fillStyle = '#ffb300';
  ctx.font = 'bold 26px Arial';
  ctx.fillText(truncate(title || 'BRACKET', 34), titleX, 44);
  if (subtitle) {
    ctx.fillStyle = '#e6eef8';
    ctx.font = '15px Arial';
    ctx.fillText(truncate(subtitle, 50), titleX, 68);
  }
  ctx.restore();

  const sep = ctx.createLinearGradient(MARGIN, 0, width - MARGIN, 0);
  sep.addColorStop(0, 'rgba(255,179,0,0)');
  sep.addColorStop(0.5, 'rgba(255,179,0,0.8)');
  sep.addColorStop(1, 'rgba(255,179,0,0)');
  ctx.fillStyle = sep;
  ctx.fillRect(MARGIN, HEADER_H - 12, width - MARGIN * 2, 2);
}

function background(ctx, width, height, bg) {
  if (bg) {
    drawCover(ctx, bg, 0, 0, width, height);
    // Voile renforcé : un bracket comporte beaucoup d'éléments à lire.
    ctx.fillStyle = 'rgba(6,10,22,0.8)';
    ctx.fillRect(0, 0, width, height);
    return;
  }
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, '#070b16');
  grad.addColorStop(1, '#0c1830');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
}

// Dessine une case de match (deux joueurs).
function drawMatchBox(ctx, x, y, match) {
  roundRect(ctx, x, y, BOX_W, BOX_H, 8);
  ctx.fillStyle = 'rgba(20,30,50,0.92)';
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(255,179,0,0.35)';
  ctx.stroke();

  // Ligne de séparation.
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y + ROW_H);
  ctx.lineTo(x + BOX_W, y + ROW_H);
  ctx.stroke();

  const done = match.status === 'termine';
  const rowFor = (player, side, top) => {
    const cy = top + ROW_H / 2;
    const isWinner = done && match.winner === side;
    if (isWinner) {
      ctx.fillStyle = 'rgba(255,215,0,0.12)';
      ctx.fillRect(x + 1, top + 1, BOX_W - 2, ROW_H - 2);
      ctx.fillStyle = '#ffd700';
      ctx.fillRect(x + 1, top + 1, 4, ROW_H - 2);
    }
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.font = 'bold 14px Arial';
    ctx.fillStyle = player ? (isWinner ? '#ffd700' : '#ffffff') : '#7d93ad';
    const label = player ? truncate(player.pseudo, 12) : 'À déterminer';
    ctx.fillText(label, x + 10, cy);
    if (player) {
      const pw = ctx.measureText(label).width;
      drawBadges(ctx, x + 10 + pw + 6, cy, player.platform);
    }
    if (done) {
      ctx.textAlign = 'right';
      ctx.fillStyle = isWinner ? '#ffd700' : '#aebfd2';
      ctx.font = 'bold 14px Arial';
      ctx.fillText(String(side === 1 ? match.s1 : match.s2), x + BOX_W - 10, cy);
      ctx.textAlign = 'left';
    }
  };
  rowFor(match.p1, 1, y);
  rowFor(match.p2, 2, y + ROW_H);
}

function connector(ctx, x1, y1, x2, y2) {
  const midX = x1 + (x2 - x1) / 2;
  ctx.strokeStyle = 'rgba(255,179,0,0.35)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(midX, y1);
  ctx.lineTo(midX, y2);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

// --- Mesure + dessin (offsets), pour pouvoir composer plusieurs sections ---

function measureTree(rounds) {
  const numRounds = rounds.length;
  const firstCount = rounds[0].length;
  return {
    width: numRounds * BOX_W + (numRounds - 1) * COL_GAP,
    height: firstCount * (BOX_H + V_GAP),
  };
}

// Dessine un arbre binaire dont le coin haut-gauche est (ox, oy).
function drawTree(ctx, ox, oy, rounds) {
  const numRounds = rounds.length;
  const colX = (c) => ox + c * (BOX_W + COL_GAP);
  const centers = [];
  for (let c = 0; c < numRounds; c++) {
    centers[c] = [];
    for (let i = 0; i < rounds[c].length; i++) {
      if (c === 0) {
        centers[c][i] = oy + i * (BOX_H + V_GAP) + BOX_H / 2;
      } else {
        const a = centers[c - 1][2 * i];
        const b = centers[c - 1][2 * i + 1];
        centers[c][i] = b != null ? (a + b) / 2 : a;
      }
    }
  }
  for (let c = 0; c < numRounds - 1; c++) {
    for (let i = 0; i < rounds[c].length; i++) {
      connector(ctx, colX(c) + BOX_W, centers[c][i], colX(c + 1), centers[c + 1][Math.floor(i / 2)]);
    }
  }
  for (let c = 0; c < numRounds; c++) {
    for (let i = 0; i < rounds[c].length; i++) {
      drawMatchBox(ctx, colX(c), centers[c][i] - BOX_H / 2, rounds[c][i]);
    }
  }
}

function measureColumns(rounds) {
  const numRounds = rounds.length;
  const maxCount = Math.max(...rounds.map((r) => r.length));
  return {
    width: numRounds * BOX_W + (numRounds - 1) * COL_GAP,
    height: 24 + maxCount * (BOX_H + V_GAP),
  };
}

// Colonnes par tour (losers bracket), coin haut-gauche (ox, oy).
function drawColumns(ctx, ox, oy, rounds) {
  const colX = (c) => ox + c * (BOX_W + COL_GAP);
  for (let c = 0; c < rounds.length; c++) {
    ctx.fillStyle = '#8fa6c0';
    ctx.font = 'bold 13px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(`Tour ${c + 1}`, colX(c) + 4, oy + 16);
    for (let i = 0; i < rounds[c].length; i++) {
      drawMatchBox(ctx, colX(c), oy + 24 + i * (BOX_H + V_GAP), rounds[c][i]);
    }
  }
}

function sectionTitle(ctx, x, y, text) {
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ffb300';
  ctx.font = 'bold 22px Arial';
  ctx.fillText(text, x, y + 20);
}

// Arbre seul sur une image (élimination simple / phase finale des poules).
function renderSingleTree(rounds, title, subtitle, assets = {}) {
  const m = measureTree(rounds);
  const width = MARGIN * 2 + m.width;
  const height = HEADER_H + m.height + MARGIN;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  background(ctx, width, height, assets.bg);
  drawHeader(ctx, width, title, subtitle, assets.logo);
  drawTree(ctx, MARGIN, HEADER_H, rounds);
  return canvas.encode('png');
}

// Double élimination : Winners + Losers + Grande finale sur UNE seule image.
function renderDoubleCombined(data, assets = {}) {
  const get = (n) => data.brackets.find((b) => b.name === n);
  const wb = get('Winners bracket');
  const lb = get('Losers bracket');
  const gf = get('Grande finale');

  const TITLE_H = 36;
  const SECTION_GAP = 34;
  const sections = [];
  if (wb) sections.push({ kind: 'tree', label: 'WINNERS BRACKET', rounds: wb.rounds, m: measureTree(wb.rounds) });
  if (lb) sections.push({ kind: 'columns', label: 'LOSERS BRACKET', rounds: lb.rounds, m: measureColumns(lb.rounds) });
  if (gf) sections.push({ kind: 'single', label: 'GRANDE FINALE', match: gf.rounds[0][0], m: { width: BOX_W, height: BOX_H } });

  const contentWidth = Math.max(...sections.map((s) => s.m.width));
  const width = MARGIN * 2 + contentWidth;
  let height = HEADER_H;
  for (const s of sections) height += TITLE_H + s.m.height + SECTION_GAP;
  height += MARGIN;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  background(ctx, width, height, assets.bg);
  drawHeader(ctx, width, 'BRACKET', data.name, assets.logo);

  let y = HEADER_H;
  for (const s of sections) {
    sectionTitle(ctx, MARGIN, y, s.label);
    const sy = y + TITLE_H;
    if (s.kind === 'tree') drawTree(ctx, MARGIN, sy, s.rounds);
    else if (s.kind === 'columns') drawColumns(ctx, MARGIN, sy, s.rounds);
    else drawMatchBox(ctx, MARGIN, sy, s.match);
    y = sy + s.m.height + SECTION_GAP;
  }
  return canvas.encode('png');
}

// Carte des matchs d'une poule (round-robin).
function renderMatchlist(matches, title, subtitle, assets = {}) {
  const rowH = 40;
  const width = 620;
  const height = HEADER_H + matches.length * rowH + MARGIN;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  background(ctx, width, height, assets.bg);
  drawHeader(ctx, width, title, subtitle, assets.logo);

  matches.forEach((m, i) => {
    const top = HEADER_H + i * rowH;
    const cy = top + rowH / 2;
    roundRect(ctx, MARGIN, top + 3, width - MARGIN * 2, rowH - 6, 8);
    ctx.fillStyle = i % 2 ? 'rgba(20,30,50,0.6)' : 'rgba(15,24,42,0.6)';
    ctx.fill();

    const done = m.status === 'termine';
    const name = (p, side) => {
      if (!p) return 'À déterminer';
      const s = truncate(p.pseudo, 12);
      return done ? `${s} ${side === 1 ? m.s1 : m.s2}` : s;
    };
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'left';
    ctx.fillStyle = done && m.winner === 1 ? '#ffd700' : '#ffffff';
    ctx.fillText(name(m.p1, 1), MARGIN + 16, cy);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#8fa6c0';
    ctx.font = '13px Arial';
    ctx.fillText('vs', width / 2, cy);
    ctx.textAlign = 'right';
    ctx.fillStyle = done && m.winner === 2 ? '#ffd700' : '#ffffff';
    ctx.font = 'bold 16px Arial';
    ctx.fillText(name(m.p2, 2), width - MARGIN - 16, cy);
  });
  return canvas.encode('png');
}

/**
 * Construit la/les image(s) du bracket selon le format.
 * @returns {Promise<Array<{ buffer: Buffer, caption: string }>>}
 */
async function renderBracketImages(data) {
  const images = [];
  const base = data.name ? ` — ${data.name}` : '';
  const assets = await loadAssets();

  // Double élimination : tout (Winners + Losers + Grande finale) sur 1 image.
  if (data.format === 'double') {
    const hasContent = (data.brackets || []).some(
      (b) => b.rounds && b.rounds.length && b.rounds[0].length,
    );
    if (hasContent) {
      images.push({
        buffer: await renderDoubleCombined(data, assets),
        caption: `🗺️ Bracket${base}`,
      });
    }
    return images;
  }

  // Poules : matchs de chaque groupe, puis phase finale.
  for (const pool of data.pools || []) {
    if (!pool.matches.length) continue;
    images.push({
      buffer: await renderMatchlist(pool.matches, `Poule ${pool.group}`, data.name, assets),
      caption: `📋 Affrontements${base} · Poule ${pool.group}`,
    });
  }

  // Élimination simple (et phase finale des poules) : un arbre par bracket.
  for (const bracket of data.brackets || []) {
    if (!bracket.rounds || !bracket.rounds.length || !bracket.rounds[0].length) continue;
    images.push({
      buffer: await renderSingleTree(bracket.rounds, bracket.name || 'BRACKET', data.name, assets),
      caption: `🗺️ ${bracket.name || 'Bracket'}${base}`,
    });
  }

  return images;
}

module.exports = { renderBracketImages };
