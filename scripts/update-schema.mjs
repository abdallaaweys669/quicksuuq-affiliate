import fs from 'node:fs';
import pg from 'pg';
const { Pool } = pg;

const env = {};
fs.readFileSync('.env.local', 'utf8').split('\n').forEach(l => {
  const parts = l.trim().split('=');
  if (parts.length > 1) env[parts[0]] = parts.slice(1).join('=');
});

const pool = new Pool({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function updateSchema() {
  console.log('Adding email column and unique constraint to salespeople...');
  await pool.query(`
    ALTER TABLE salespeople ADD COLUMN IF NOT EXISTS email text;
    CREATE UNIQUE INDEX IF NOT EXISTS salespeople_email_idx ON salespeople(lower(email)) WHERE email IS NOT NULL;
  `);

  // Assign emails to existing reps if null
  const reps = await pool.query('SELECT id, name, code, phone, email FROM salespeople');
  for (const r of reps.rows) {
    if (!r.email) {
      const email = `${r.code.toLowerCase()}@quicksuuq.com`;
      await pool.query('UPDATE salespeople SET email = $1 WHERE id = $2', [email, r.id]);
      console.log(`Assigned email ${email} to ${r.name} (${r.code})`);
    }
  }

  const updated = await pool.query('SELECT id, name, code, email, phone, is_active FROM salespeople ORDER BY code');
  console.log('Updated salespeople list:');
  console.table(updated.rows);

  await pool.end();
}

updateSchema().catch(console.error);
