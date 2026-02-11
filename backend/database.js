const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.SUPABASE_CONNECTION,
  ssl: { rejectUnauthorized: false }
});

module.exports = pool;