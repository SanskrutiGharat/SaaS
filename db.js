// db.js
require('dotenv').config();

const dbType = (process.env.DB_TYPE || 'sqlite').toLowerCase();
const toInt = (v, f) => { const n = parseInt(String(v ?? '').trim(), 10); return Number.isFinite(n) ? n : f; };

let api;

if (dbType === 'postgres') {
  const { Pool } = require('pg');
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: toInt(process.env.DB_PORT, 5432),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : false,
    max: toInt(process.env.DB_POOL_MAX, 10),
    idleTimeoutMillis: toInt(process.env.DB_POOL_IDLE_MS, 30000),
    connectionTimeoutMillis: toInt(process.env.DB_CONNECT_TIMEOUT_MS, 5000),
  });
  pool.on('error', (err) => { console.error('[pg] idle client error', err); process.exitCode = 1; });
  api = {
    async query(text, params = []) {
      const t0 = Date.now();
      try { const res = await pool.query(text, params); if (Date.now() - t0 > 300) console.warn(`[pg] slow: ${text}`); return res; }
      catch (err) { err.meta = { text, params }; console.error('[pg] query error', err); throw err; }
    },
    async sampleSelect() { const { rows } = await this.query('SELECT * FROM test_table LIMIT 100'); return rows; },
    async health() { const r = await this.query('SELECT 1 AS ok'); return r.rows?.[0]?.ok === 1; },
    async close() { await pool.end(); },
  };
} else if (dbType === 'mysql') {
  const mysql = require('mysql2/promise');
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: toInt(process.env.DB_PORT, 3306),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    waitForConnections: true,
    connectionLimit: toInt(process.env.DB_POOL_MAX, 10),
    queueLimit: 0,
    enableKeepAlive: true,
  });
  api = {
    async query(sql, params = []) {
      const t0 = Date.now();
      try { const [rows] = await pool.execute(sql, params); if (Date.now() - t0 > 300) console.warn(`[mysql] slow: ${sql}`); return rows; }
      catch (err) { err.meta = { sql, params }; console.error('[mysql] query error', err); throw err; }
    },
    async sampleSelect() { return await this.query('SELECT * FROM test_table LIMIT 100'); },
    async health() { const rows = await this.query('SELECT 1 AS ok'); return rows?.[0]?.ok === 1; },
    async close() { await pool.end(); },
  };
} else if (dbType === 'mongodb') {
  const { MongoClient } = require('mongodb');
  const uri = process.env.MONGODB_URI; const dbName = process.env.MONGODB_DB;
  if (!uri || !dbName) throw new Error('MONGODB_URI and MONGODB_DB are required');
  const client = new MongoClient(uri, { maxPoolSize: toInt(process.env.DB_POOL_MAX, 10), serverSelectionTimeoutMS: toInt(process.env.DB_CONNECT_TIMEOUT_MS, 5000) });
  let cachedDb = null;
  api = {
    async connect() { if (!cachedDb) { await client.connect(); cachedDb = client.db(dbName); } return cachedDb; },
    async sampleSelect() { const db = await this.connect(); return await db.collection('test_table').find({}).limit(100).toArray(); },
    async health() { try { await client.db('admin').command({ ping: 1 }); return true; } catch { return false; } },
    async close() { await client.close(); cachedDb = null; },
  };
} else if (dbType === 'sqlite') {
  const Database = require('better-sqlite3');
  const db = new Database(process.env.SQLITE_FILE || './database.sqlite', { fileMustExist: false });
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  api = {
    query(sql, params = []) { try { const s = db.prepare(sql); return /^\s*select/i.test(sql) ? s.all(params) : s.run(params); }
      catch (err) { err.meta = { sql, params }; console.error('[sqlite] query error', err); throw err; } },
    sampleSelect() { return this.query('SELECT * FROM test_table LIMIT 100'); },
    health() { const r = this.query('SELECT 1 AS ok'); return Array.isArray(r) ? r[0]?.ok === 1 : !!r; },
    close() { db.close(); },
  };
} else {
  throw new Error(`Unsupported DB_TYPE: ${dbType}`);
}

module.exports = api;


