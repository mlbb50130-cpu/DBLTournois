const makeWASocket = require('@whiskeysockets/baileys').default;
const {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  Browsers,
  DisconnectReason,
} = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const pino = require('pino');
const fs = require('fs');
const config = require('./config');
const { loadCommands, handleMessage } = require('./handler');

let sock = null;

async function connectToWhatsApp() {
  if (!fs.existsSync(config.SESSION_PATH)) {
    fs.mkdirSync(config.SESSION_PATH, { recursive: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(config.SESSION_PATH);
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'silent' }),
    browser: Browsers.ubuntu('Chrome'),
    syncFullHistory: false,
    printQRInTerminal: false,
  });

  sock.ev.on('creds.update', saveCreds);

  // Appairage par CODE (prioritaire) : si un numéro est configuré et que la
  // session n'est pas encore enregistrée, on demande un code à saisir dans WhatsApp.
  const usePairing = config.USE_PAIRING_CODE && !!config.WHATSAPP_NUMBER;
  if (usePairing && !sock.authState.creds.registered) {
    setTimeout(async () => {
      try {
        const code = await sock.requestPairingCode(config.WHATSAPP_NUMBER);
        const pretty = code?.match(/.{1,4}/g)?.join('-') || code;
        console.log('\n══════════════════════════════════════════════');
        console.log(`🔗 CODE D'APPAIRAGE WhatsApp : ${pretty}`);
        console.log('   Sur ton téléphone : WhatsApp > Appareils connectés >');
        console.log('   Connecter un appareil > Connecter avec le numéro de téléphone,');
        console.log('   puis saisis ce code.');
        console.log('══════════════════════════════════════════════\n');
      } catch (err) {
        console.error("Échec de la demande de code d'appairage :", err.message);
        console.error('→ Vérifie WHATSAPP_NUMBER, ou mets USE_PAIRING_CODE=false pour le QR.');
      }
    }, 3000);
  }

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    // QR uniquement en repli (si l'appairage par code n'est pas utilisé).
    if (qr && !usePairing) {
      console.log('\n📱 Scanne ce QR code avec WhatsApp (Paramètres > Appareils connectés) :\n');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'open') {
      console.log(`✅ ${config.BOT_NAME} connecté. Préfixe des commandes : "${config.PREFIX}"`);
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      if (statusCode === DisconnectReason.loggedOut) {
        console.error(
          `❌ Session expirée. Supprime le dossier "${config.SESSION_PATH}" puis relance pour rescanner.`,
        );
      } else {
        console.warn('⚠️ Connexion perdue. Reconnexion dans 5s...');
        await new Promise((resolve) => setTimeout(resolve, 5000));
        connectToWhatsApp();
      }
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    // 'notify' = nouveaux messages entrants ; 'append' = messages synchronisés
    // (souvent tes propres messages tapés depuis le téléphone hôte).
    if (type !== 'notify' && type !== 'append') return;

    const message = messages[0];
    if (!message?.message) return;

    // Pour 'append', ne traiter que les messages récents (éviter de rejouer
    // l'historique lors d'une (re)connexion).
    if (type === 'append') {
      const ts = Number(message.messageTimestamp || 0) * 1000;
      if (ts && Date.now() - ts > 60000) return;
    }

    const senderJid = message.key.remoteJid || '';
    if (senderJid === 'status@broadcast') return;

    const isGroup = senderJid.endsWith('@g.us');
    await handleMessage(sock, message, isGroup);
  });

  return sock;
}

async function main() {
  loadCommands();
  await connectToWhatsApp();
}

process.on('SIGINT', async () => {
  if (sock) await sock.end();
  process.exit(0);
});

main().catch((error) => {
  console.error('Erreur fatale au démarrage :', error);
  process.exit(1);
});
