const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Use file-based storage so data persists between restarts
const adapter = new FileSync(path.join(__dirname, '../data/db.json'));
const db = low(adapter);

// Set default structure
db.defaults({
  users: [],
  tokens: []  // blacklisted tokens (logged out)
}).write();

module.exports = db;
