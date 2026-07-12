const bcrypt = require('bcrypt');
const { pool } = require('../src/config/database');
const variables = require('../src/config/variables');

/**
 * Seeds the default Admin user using credentials specified in the environment variables.
 * Aborts the operation if the credentials are not provided.
 */
const seedAdmin = async () => {
  const username = variables.DEFAULT_ADMIN_USERNAME;
  const rawPassword = variables.DEFAULT_ADMIN_PASSWORD;

  // Enforce credentials check from variables.js
  if (!username || !rawPassword) {
    console.error('[Seed Failure] Aborting database seeding. Environment variables "DEFAULT_ADMIN_USERNAME" and "DEFAULT_ADMIN_PASSWORD" must be defined in the .env file.');
    process.exit(1);
  }

  const fullName = 'System Administrator';
  const role = 'ADMIN';

  console.log(`[Seed Info] Connecting to database on ${variables.DATABASE_HOST}:${variables.DATABASE_PORT}...`);

  try {
    // 1. Check if user already exists
    const userCheck = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    
    if (userCheck.rows.length > 0) {
      console.log(`[Seed Info] Admin user "${username}" already exists in the database. Seeding skipped.`);
      return;
    }

    // 2. Hash password with bcrypt
    console.log('[Seed Info] Hashing administrator password...');
    const saltRounds = 12; // High security standard
    const passwordHash = await bcrypt.hash(rawPassword, saltRounds);

    // 3. Insert default admin
    console.log('[Seed Info] Inserting default administrator...');
    const result = await pool.query(
      `INSERT INTO users (full_name, username, password_hash, role, status)
       VALUES ($1, $2, $3, $4, 'ACTIVE')
       RETURNING id, username`,
      [fullName, username, passwordHash, role]
    );

    console.log(`[Seed Success] Default admin seeded. ID: ${result.rows[0].id}, Username: ${result.rows[0].username}`);
  } catch (err) {
    console.error('[Seed Failure] Error seeding administrator:', err.message);
  } finally {
    // Clean up database connection pool
    await pool.end();
    console.log('[Seed Info] Database connection terminated.');
  }
};

// Execute seeding
seedAdmin();
