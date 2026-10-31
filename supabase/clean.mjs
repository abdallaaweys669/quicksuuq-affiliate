import fs from 'node:fs';
import pg from 'pg';
const { Pool } = pg;

const env = {};
fs.readFileSync('.env.local', 'utf8').split('\n').forEach(l => {
  const parts = l.trim().split('=');
  if (parts.length > 1) env[parts[0]] = parts.slice(1).join('=');
});

const pool = new Pool({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function clean() {
  await pool.query("DELETE FROM commissions WHERE shopify_order_id LIKE '9999%'");
  await pool.query("DELETE FROM customer_mappings WHERE first_order_id LIKE '9999%'");
  const res = await pool.query('SELECT code, name, commission_rate, is_active FROM salespeople ORDER BY code');
  console.log('Test orders cleaned. Active salespeople in Supabase:');
  console.table(res.rows);
  await pool.end();
}

clean().catch(console.error);
