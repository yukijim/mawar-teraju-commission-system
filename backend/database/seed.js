const bcrypt = require('bcrypt');
const { pool } = require('../src/config/database');
const variables = require('../src/config/variables');

/**
 * Seeds the default Admin user if they do not already exist in the database.
 */
const seedAdmin = async () => {
  const username = 'admin';
  const rawPassword = 'Admin@123456';
  const fullName = 'System Administrator';
  const role = 'ADMIN';

  console.log(`[Seed Info] Connecting to ${variables.DATABASE_HOST}:${variables.DATABASE_PORT}...`);

  try {
    // 1. Check if user already exists
    const userCheck = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    
    if (userCheck.rows.length > 0) {
      console.log(`[Seed Info] User "${username}" already exists. Seeding skipped.`);
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
