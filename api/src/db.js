const dns = require('dns');
const mongoose = require('mongoose');
const config = require('./config');

// Les URI Atlas (mongodb+srv) nécessitent une résolution DNS SRV ; certains
// résolveurs locaux échouent (querySrv ETIMEOUT). On ajoute des DNS publics.
try {
  const current = dns.getServers();
  dns.setServers(['8.8.8.8', '1.1.1.1', ...current]);
} catch {
  /* sans effet si non supporté */
}

async function connectDatabase() {
  mongoose.set('strictQuery', true);
  await mongoose.connect(config.MONGODB_URI, { serverSelectionTimeoutMS: 20000 });
  return mongoose.connection;
}

module.exports = { connectDatabase };
