const fs = require('fs');
const path = require('path');
const config = require('./config');
const api = require('./api');
const { isAdmin } = require('./utils/admin');

// Registre des commandes (name + alias -> commande).
const commands = new Map();

/**
 * Charge dynamiquement toutes les commandes du dossier ./commands.
 * Chaque fichier exporte : { name, aliases?, description, usage?, execute }.
 */
function loadCommands() {
  const dir = path.join(__dirname, 'commands');
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.js')) continue;
    const command = require(path.join(dir, file));
    if (!command || !command.name) continue;

    commands.set(command.name.toLowerCase(), command);
    for (const alias of command.aliases || []) {
      const a = String(alias || '').toLowerCase();
      if (a && !commands.has(a)) commands.set(a, command);
    }
  }
  const count = new Set(commands.values()).size;
  console.log(`✅ ${count} commande(s) chargée(s).`);
}

// Extraction du texte d'un message (compatible Baileys 7.0).
function extractText(msg) {
  if (!msg) return '';
  if (msg.ephemeralMessage?.message) return extractText(msg.ephemeralMessage.message);
  if (msg.viewOnceMessageV2?.message) return extractText(msg.viewOnceMessageV2.message);
  if (msg.viewOnceMessage?.message) return extractText(msg.viewOnceMessage.message);
  if (msg.conversation) return msg.conversation;
  if (msg.extendedTextMessage?.text) return msg.extendedTextMessage.text;
  if (msg.imageMessage?.caption) return msg.imageMessage.caption;
  if (msg.videoMessage?.caption) return msg.videoMessage.caption;
  return '';
}

// Numéro WhatsApp de l'expéditeur (sert d'identifiant joueur côté API).
// Pour un message envoyé par le bot lui-même (fromMe), on prend le numéro du bot.
function userNumber(sock, message) {
  if (message.key.fromMe) {
    const id = sock?.user?.id || '';
    return id.split('@')[0].split(':')[0];
  }
  const jid = message.key.participant || message.key.remoteJid || '';
  return jid.split('@')[0].split(':')[0];
}

/**
 * Route un message entrant vers la bonne commande.
 */
async function handleMessage(sock, message, isGroup) {
  const text = extractText(message.message);
  if (!text || !text.startsWith(config.PREFIX)) return;

  const senderJid = message.key.remoteJid;
  const args = text.slice(config.PREFIX.length).trim().split(/\s+/);
  let name = (args.shift() || '').toLowerCase();
  // Tolère les accents (ex. "réponse" -> "reponse").
  name = name.normalize('NFD').replace(/[̀-ͯ]/g, '');

  const command = commands.get(name);
  if (!command) return;

  const reply = (body) =>
    sock.sendMessage(
      senderJid,
      typeof body === 'string' ? { text: body } : body,
      { quoted: message },
    );

  const number = userNumber(sock, message);

  // Droits admin : commandes marquées adminOnly réservées aux ADMIN_NUMBERS.
  if (command.adminOnly && !isAdmin(number)) {
    await reply('⛔ Commande réservée aux administrateurs.');
    return;
  }

  const ctx = {
    reply,
    senderJid,
    isGroup,
    number,
    pushName: message.pushName || '',
    api,
    config,
  };

  try {
    await command.execute(sock, message, args, ctx);
  } catch (error) {
    if (error && error.name === 'ApiError') {
      await reply(`⚠️ ${error.message}`);
    } else {
      console.error(`Erreur commande "${name}":`, error);
      await reply('❌ Une erreur est survenue. Réessaie plus tard.');
    }
  }
}

module.exports = {
  loadCommands,
  handleMessage,
  getAllCommands: () => Array.from(new Set(commands.values())),
};
