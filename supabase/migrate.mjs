import fs from 'node:fs';
import pg from 'pg';
const { Pool } = pg;

// Read .env.local manually
const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const idx = trimmed.indexOf('=');
  if (idx !== -1) {
    const k = trimmed.substring(0, idx).trim();
    const v = trimmed.substring(idx + 1).trim();
    env[k] = v;
  }
}

async function migrate() {
  console.log('Connecting to Supabase PostgreSQL...');
  const pool = new Pool({
    connectionString: env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  const sql = fs.readFileSync('supabase/schema.sql', 'utf8');
  console.log('Applying schema.sql...');
  await pool.query(sql);
  console.log('Schema applied successfully!');

  // Check tables
  const res = await pool.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
  );
  console.log('Active tables in public schema:', res.rows.map(r => r.table_name));

  // Seed default salesperson ALI100
  const check = await pool.query("SELECT id, code, name FROM salespeople WHERE code = 'ALI100'");
  if (check.rows.length === 0) {
    console.log('Seeding initial salesperson: ALI100 (Ali Mohamed)...');
    const inserted = await pool.query(
      "INSERT INTO salespeople (name, code, phone, commission_rate, is_active) VALUES ($1, $2, $3, $4, $5) RETURNING id, code, name",
      ['Ali Mohamed', 'ALI100', '252615551000', 0.02, true]
    );
    console.log('Seeded:', inserted.rows[0]);
  } else {
    console.log('Salesperson ALI100 already exists:', check.rows[0]);
  }

  // Seed other team referral codes
  const reps = [
    { name: 'Maazin', code: 'MAAZIN' },
    { name: 'Xirsi', code: 'XIRSI' },
    { name: 'Ahmed', code: 'AHMED' },
    { name: 'Fatima', code: 'FATIMA' },
    { name: 'Abdalla', code: 'ABDALLA' },
    { name: 'Haji', code: 'HAJI' }
  ];
  for (const r of reps) {
    const existing = await pool.query('SELECT id FROM salespeople WHERE code = $1', [r.code]);
    if (existing.rows.length === 0) {
      await pool.query('INSERT INTO salespeople (name, code, commission_rate, is_active) VALUES ($1, $2, 0.02, true)', [r.name, r.code]);
      console.log('Seeded salesperson:', r.code);
    }
  }

  const allReps = await pool.query('SELECT code, name, commission_rate, is_active FROM salespeople ORDER BY code');
  console.log('All active salespeople in Supabase:');
  console.table(allReps.rows);

  await pool.end();
}

migrate().catch(e => {
  console.error('Migration failed:', e);
  process.exit(1);
});
