// Load environment variables from .env file
require('dotenv').config();

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Determine database path from environment variable or use default
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data');
const DB_NAME = process.env.DB_NAME || 'scorecard.db';
const dbPath = path.join(DB_PATH, DB_NAME);

// Ensure data directory exists
if (!fs.existsSync(DB_PATH)) {
  console.log(`Creating database directory: ${DB_PATH}`);
  fs.mkdirSync(DB_PATH, { recursive: true });
}

// Connect to database
function connectToDatabase() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Could not connect to database', err);
        reject(err);
      } else {
        console.log('Connected to database');
        resolve(db);
      }
    });
  });
}

// Run a query
function run(db, query, params = []) {
  return new Promise((resolve, reject) => {
    db.run(query, params, function(err) {
      if (err) {
        console.error('Error running query', query, err);
        reject(err);
      } else {
        resolve({ id: this.lastID, changes: this.changes });
      }
    });
  });
}

// Get all rows
function all(db, query, params = []) {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) {
        console.error('Error getting rows', query, err);
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

// Get a single row
function get(db, query, params = []) {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) {
        console.error('Error getting row', query, err);
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

// Execute multiple queries in a transaction
async function executeTransaction(db, queries) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      
      let results = [];
      let hasError = false;
      
      queries.forEach(({ query, params = [] }) => {
        if (hasError) return;
        
        db.run(query, params, function(err) {
          if (err) {
            console.error('Error in transaction', query, err);
            hasError = true;
            db.run('ROLLBACK');
            reject(err);
          } else {
            results.push({ 
              id: this.lastID, 
              changes: this.changes 
            });
          }
        });
      });
      
      if (!hasError) {
        db.run('COMMIT', (err) => {
          if (err) {
            console.error('Error committing transaction', err);
            db.run('ROLLBACK');
            reject(err);
          } else {
            resolve(results);
          }
        });
      }
    });
  });
}

// Backup the database
function backupDatabase() {
  return new Promise((resolve, reject) => {
    const backupFileName = `scorecard-backup-${Date.now()}.db`;
    const backupPath = path.join(DB_PATH, backupFileName);
    const source = new sqlite3.Database(dbPath);
    const destination = new sqlite3.Database(backupPath);
    
    source.backup(destination, (err) => {
      if (err) {
        console.error('Backup failed', err);
        reject(err);
      } else {
        console.log(`Backup created at ${backupPath}`);
        resolve(backupPath);
      }
      
      source.close();
      destination.close();
    });
  });
}

module.exports = {
  connectToDatabase,
  run,
  all,
  get,
  executeTransaction,
  backupDatabase
};