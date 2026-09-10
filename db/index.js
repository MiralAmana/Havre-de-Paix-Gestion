const { Database } = require('node-sqlite3-wasm');
const { applySchema } = require('./schema');
const { createRepository } = require('./repository');

function initDatabase(dbPath) {
  const db = new Database(dbPath);
  applySchema(db);
  return { db, repo: createRepository(db) };
}

module.exports = { initDatabase };
