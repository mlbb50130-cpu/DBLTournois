require('dotenv').config({ quiet: true });

module.exports = {
  PORT: parseInt(process.env.PORT, 10) || 3000,
  HOST: process.env.HOST || '0.0.0.0',
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/dbl_tournois',
  ADMIN_KEY: process.env.ADMIN_KEY || '',
};
