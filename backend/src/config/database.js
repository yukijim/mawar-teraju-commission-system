const { Pool } = require('pg');
const variables = require('./variables');

const pool = new Pool({
  host: variables.DATABASE_HOST,
  port: variables.DATABASE_PORT,
  database: variables.DATABASE_NAME,
  user: variables.DATABASE_USER,
  password: variables.DATABASE_PASSWORD,
  max: 20, // maximum number of clients in the pool
  idleTimeoutMillis: 30000, // close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // return an error after 2 seconds if a connection cannot be established
});

// Event listeners for the pool
pool.on('connect', () => {
  if (variables.NODE_ENV === 'development') {
    console.log('[Database] Database client successfully checked out/connected from pool');
  }
});

pool.on('error', (err) => {
  console.error('[Database Error] Unexpected error on idle database client:', err.message);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  connect: () => pool.connect(),
  pool,
};
