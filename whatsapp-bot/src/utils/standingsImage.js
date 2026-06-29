const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('@napi-rs/canvas');

const ASSETS_DIR = path.join(__dirname, '..', 'assets');

const FORMAT_LABEL = {
  simple: 'Élimination simple',
  double: 'Élimination double',
  poules: 'Poules + phase finale',
};

const MEDAL = { 1: '#ffd700', 2: '#d7dde6', 3: '#cd7f32' };
const QUALIFIED = '#5bd6a0';

const WIDTH = 760;
const HEADER_H = 168;
const FOOTER_H = 40;

function findAsset(...names) {
  for (const n of names) {
    const p = path.join(ASSETS_DIR, n);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function truncate(text, max) {
  const s = String(text || '');
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function statusColor(status) {
  if (status === 'champion') return '#ffd700';
  if (status === 'finaliste') return '#d7dde6';
  if (status === 'en lice') return QUALIFIED;
  return '#8fa6c0';
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

function drawCover(ctx, img, x, y, w, h, ax = 0.5, ay = 0.5) {
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
  ctx.drawImage(img, x + (w - dw) * ax, y + (h - dh) * ay, dw, dh);
}

function starPath(ctx, cx, cy, outer, inner, points = 5, rot = -Math.PI / 2) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const rad = i % 2 === 0 ? outer : inner;
    const a = rot + (i * Math.PI) / points;
    const px = cx + Math.cos(a) * rad;
    const py = cy + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function drawDragonBall(ctx, cx, cy, R) {
  ctx.save();
  ctx.shadowColor = 'rgba(255,150,30,0.85)';
  ctx.shadowBlur = R * 0.9;
  const sphere = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.35, R * 0.1, cx, cy, R);
  sphere.addColorStop(0, '#fff1c9');
  sphere.addColorStop(0.45, '#ffb43a');
  sphere.addColorStop(1, '#e8650a');
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fillStyle = sphere;
  ctx.fill();
  ctx.restore();

  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.lineWidth = Math.max(2, R * 0.06);
  ctx.strokeStyle = 'rgba(150,65,0,0.75)';
  ctx.stroke();

  const off = R * 0.36;
  ctx.fillStyle = '#c81212';
  for (const [dx, dy] of [[-off, -off], [off, -off], [-off, off], [off, off]]) {
    starPath(ctx, cx + dx, cy + dy, R * 0.2, R * 0.092);
    ctx.fill();
  }

  ctx.beginPath();
  ctx.ellipse(cx - R * 0.35, cy - R * 0.4, R * 0.32, R * 0.17, -0.6, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.fill();
}

function drawDrawnLogo(ctx) {
  const ballR = 46;
  const ballX = 66;
  const ballY = 80;
  drawDragonBall(ctx, ballX, ballY, ballR);

  const wmX = ballX + ballR + 22;
  const baseline = 100;
  const size = 60;
  ctx.font = `bold ${size}px Arial`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const grad = ctx.createLinearGradient(wmX, baseline - size, wmX, baseline);
  grad.addColorStop(0, '#fff6c0');
  grad.addColorStop(0.5, '#ffc01e');
  grad.addColorStop(1, '#e8730f');
  ctx.save();
  ctx.shadowColor = 'rgba(255,160,40,0.6)';
  ctx.shadowBlur = size * 0.25;
  ctx.lineWidth = size * 0.09;
  ctx.strokeStyle = '#2a1300';
  ctx.strokeText('DBL', wmX, baseline);
  ctx.restore();
  ctx.fillStyle = grad;
  ctx.fillText('DBL', wmX, baseline);

  ctx.fillStyle = '#c2d2e6';
  ctx.font = 'bold 15px Arial';
  ctx.fillText('LEGENDS · TOURNOIS', wmX + 4, 124);
}

// Badges de plateforme (WhatsApp / Discord). Renvoie la largeur dessinée.
function platformTokens(platform) {
  if (platform === 'both') return [['WA', '#25D366'], ['DC', '#5865F2']];
  if (platform === 'discord') return [['DC', '#5865F2']];
  if (platform === 'whatsapp') return [['WA', '#25D366']];
  return [];
}

function drawBadges(ctx, x, cy, platform) {
  const tokens = platformTokens(platform);
  const w = 26;
  const h = 18;
  let bx = x;
  ctx.font = 'bold 12px Arial';
  ctx.textBaseline = 'middle';
  for (const [label, color] of tokens) {
    roundRect(ctx, bx, cy - h / 2, w, h, 5);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(label, bx + w / 2, cy + 1);
    bx += w + 5;
  }
  ctx.textAlign = 'left';
  return bx - x;
}

function bgGradient(ctx, width, height) {
  const bg = ctx.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0, '#070b16');
  bg.addColorStop(1, '#0c1830');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);
}

/**
 * Crée la "frame" commune (fond adaptatif + logo + titre) et renvoie le
 * contexte ainsi que la zone de contenu disponible.
 */
async function createFrame(contentBodyH, tournament, subtitle) {
  const contentH = HEADER_H + contentBodyH + FOOTER_H;

  const bgFile = findAsset('background.png', 'background.jpg', 'background.jpeg', 'bg.png', 'bg.jpg');
  let bg = null;
  if (bgFile) {
    try {
      bg = await loadImage(bgFile);
    } catch {
      bg = null;
    }
  }

  const height = bg ? Math.max(contentH, Math.round(WIDTH / (bg.width / bg.height))) : contentH;
  const canvas = createCanvas(WIDTH, height);
  const ctx = canvas.getContext('2d');

  if (bg) {
    drawCover(ctx, bg, 0, 0, WIDTH, height, 0.5, 0);
    ctx.fillStyle = 'rgba(6,10,22,0.5)';
    ctx.fillRect(0, 0, WIDTH, height);
    const tg = ctx.createLinearGradient(0, 0, 0, HEADER_H);
    tg.addColorStop(0, 'rgba(6,10,22,0.65)');
    tg.addColorStop(1, 'rgba(6,10,22,0)');
    ctx.fillStyle = tg;
    ctx.fillRect(0, 0, WIDTH, HEADER_H);
  } else {
    bgGradient(ctx, WIDTH, height);
  }

  // Halo + logo.
  const glow = ctx.createRadialGradient(WIDTH * 0.5, 70, 30, WIDTH * 0.5, 70, WIDTH * 0.7);
  glow.addColorStop(0, 'rgba(255,150,40,0.18)');
  glow.addColorStop(1, 'rgba(255,150,40,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, WIDTH, HEADER_H + 30);

  const logoFile = findAsset('logo.png', 'logo-dbl.png', 'logo.jpg');
  let drewLogo = false;
  if (logoFile) {
    try {
      const logo = await loadImage(logoFile);
      const lh = 96;
      ctx.drawImage(logo, 36, 32, (logo.width / logo.height) * lh, lh);
      drewLogo = true;
    } catch {
      drewLogo = false;
    }
  }
  if (!drewLogo) drawDrawnLogo(ctx);

  // Bloc titre (droite).
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ffb300';
  ctx.font = 'bold 30px Arial';
  ctx.fillText('CLASSEMENT', WIDTH - 36, 70);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px Arial';
  ctx.fillText(truncate(tournament.name || 'Tournoi DBL', 30), WIDTH - 36, 100);
  if (subtitle) {
    ctx.fillStyle = '#c2d2e6';
    ctx.font = '15px Arial';
    ctx.fillText(subtitle, WIDTH - 36, 124);
  }

  // Séparateur doré.
  const sep = ctx.createLinearGradient(36, 0, WIDTH - 36, 0);
  sep.addColorStop(0, 'rgba(255,179,0,0)');
  sep.addColorStop(0.5, 'rgba(255,179,0,0.85)');
  sep.addColorStop(1, 'rgba(255,179,0,0)');
  ctx.fillStyle = sep;
  ctx.fillRect(36, HEADER_H - 14, WIDTH - 72, 2);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  return { canvas, ctx, height };
}

function footer(ctx, height) {
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#7d93ad';
  ctx.font = '14px Arial';
  ctx.fillText('Tournois DBL — généré automatiquement', 36, height - 16);
}

// Image "liste" (élimination simple/double et phase finale des poules).
async function renderList(tournament, rows, subtitle) {
  const rowH = 58;
  const { canvas, ctx, height } = await createFrame(rows.length * rowH, tournament, subtitle);

  const bodyTop = HEADER_H;
  const bodyBottom = height - FOOTER_H;
  const start = bodyTop + Math.max(0, (bodyBottom - bodyTop - rows.length * rowH) / 2);

  rows.forEach((s, i) => {
    const top = start + i * rowH;
    const h = rowH - 8;
    const cy = top + h / 2;
    const accent = MEDAL[s.rank] || '#2f7fd6';

    roundRect(ctx, 28, top, WIDTH - 56, h, 12);
    ctx.fillStyle = i % 2 ? 'rgba(10,16,30,0.55)' : 'rgba(20,30,50,0.6)';
    ctx.fill();
    roundRect(ctx, 28, top, 6, h, 3);
    ctx.fillStyle = accent;
    ctx.fill();

    const cx = 70;
    const r = 21;
    if (s.rank && s.rank <= 3) {
      ctx.save();
      ctx.shadowColor = accent;
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = accent;
      ctx.fill();
      ctx.restore();
    } else {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = '#22364f';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = accent;
      ctx.stroke();
    }
    ctx.fillStyle = s.rank && s.rank <= 3 ? '#1a1206' : '#dce8f5';
    ctx.font = 'bold 19px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(s.rank != null ? String(s.rank) : '—', cx, cy + 1);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 23px Arial';
    const pseudo = truncate(s.pseudo, 18);
    ctx.fillText(pseudo, 104, cy + 1);
    const pw = ctx.measureText(pseudo).width;
    drawBadges(ctx, 104 + pw + 10, cy, s.platform);

    ctx.fillStyle = statusColor(s.status);
    ctx.font = 'bold 15px Arial';
    ctx.textAlign = 'right';
    ctx.fillText((s.status || '').toUpperCase(), WIDTH - 44, cy + 1);
    ctx.textAlign = 'left';
  });

  footer(ctx, height);
  return canvas.encode('png');
}

// Image "table de poule" (colonnes Pts / V-D / Manches / Diff).
async function renderPool(tournament, pool) {
  const rowH = 54;
  const colHeaderH = 30;
  const bodyH = colHeaderH + pool.rows.length * rowH;
  const subtitle = `Poule ${pool.group}${tournament.bestOf ? `  ·  BO${tournament.bestOf}` : ''}`;
  const { canvas, ctx, height } = await createFrame(bodyH, tournament, subtitle);

  // Colonnes (x de fin pour texte aligné à droite).
  const colPts = WIDTH - 300;
  const colVD = WIDTH - 210;
  const colMan = WIDTH - 110;
  const colDiff = WIDTH - 44;

  const bodyTop = HEADER_H;
  const bodyBottom = height - FOOTER_H;
  const start = bodyTop + Math.max(0, (bodyBottom - bodyTop - bodyH) / 2);

  // En-tête de colonnes.
  ctx.fillStyle = '#8fa6c0';
  ctx.font = 'bold 13px Arial';
  ctx.textAlign = 'left';
  ctx.fillText('JOUEUR', 104, start + 16);
  ctx.textAlign = 'right';
  ctx.fillText('PTS', colPts, start + 16);
  ctx.fillText('V-D', colVD, start + 16);
  ctx.fillText('MANCHES', colMan, start + 16);
  ctx.fillText('DIFF', colDiff, start + 16);

  pool.rows.forEach((row, i) => {
    const top = start + colHeaderH + i * rowH;
    const h = rowH - 8;
    const cy = top + h / 2;
    const accent = row.qualified ? QUALIFIED : '#2f7fd6';

    roundRect(ctx, 28, top, WIDTH - 56, h, 12);
    ctx.fillStyle = row.qualified ? 'rgba(40,90,70,0.5)' : 'rgba(15,24,42,0.58)';
    ctx.fill();
    roundRect(ctx, 28, top, 6, h, 3);
    ctx.fillStyle = accent;
    ctx.fill();

    // Rang.
    const cx = 70;
    ctx.beginPath();
    ctx.arc(cx, cy, 19, 0, Math.PI * 2);
    ctx.fillStyle = '#22364f';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = accent;
    ctx.stroke();
    ctx.fillStyle = '#dce8f5';
    ctx.font = 'bold 17px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(String(row.rank), cx, cy + 1);

    // Pseudo + plateforme.
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px Arial';
    const ppseudo = truncate(row.pseudo, 10);
    ctx.fillText(ppseudo, 104, cy + 1);
    const ppw = ctx.measureText(ppseudo).width;
    drawBadges(ctx, 104 + ppw + 8, cy, row.platform);

    // Stats.
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 18px Arial';
    ctx.fillText(String(row.points), colPts, cy + 1);
    ctx.fillStyle = '#dce8f5';
    ctx.font = '16px Arial';
    ctx.fillText(`${row.v}-${row.d}`, colVD, cy + 1);
    ctx.fillText(`${row.mp}/${row.mc}`, colMan, cy + 1);
    ctx.fillStyle = row.diff > 0 ? QUALIFIED : row.diff < 0 ? '#e8728f' : '#dce8f5';
    ctx.fillText(`${row.diff > 0 ? '+' : ''}${row.diff}`, colDiff, cy + 1);
    ctx.textAlign = 'left';
  });

  footer(ctx, height);
  return canvas.encode('png');
}

/**
 * Construit la/les image(s) de classement selon le format.
 * @returns {Promise<Array<{ buffer: Buffer, caption: string }>>}
 */
async function renderStandingsImages(res) {
  const tournament = res.tournament || {};
  const fmt = res.format || tournament.format;
  const baseName = tournament.name ? ` — ${tournament.name}` : '';
  const images = [];

  if (fmt === 'poules' && res.standings && Array.isArray(res.standings.pools)) {
    for (const pool of res.standings.pools) {
      images.push({
        buffer: await renderPool(tournament, pool),
        caption: `🏆 Classement${baseName} · Poule ${pool.group}`,
      });
    }
    if (Array.isArray(res.standings.finale) && res.standings.finale.length) {
      images.push({
        buffer: await renderList(tournament, res.standings.finale, `Phase finale  ·  BO${tournament.bestOf}`),
        caption: `🏆 Classement${baseName} · Phase finale`,
      });
    }
    return images;
  }

  // Élimination simple / double : une seule image liste.
  const rows = Array.isArray(res.standings) ? res.standings : [];
  const subtitle = [FORMAT_LABEL[fmt] || fmt, tournament.bestOf ? `BO${tournament.bestOf}` : null]
    .filter(Boolean)
    .join('  ·  ');
  images.push({ buffer: await renderList(tournament, rows, subtitle), caption: `🏆 Classement${baseName}` });
  return images;
}

module.exports = { renderStandingsImages, renderList, renderPool };
