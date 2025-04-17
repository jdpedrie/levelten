// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const sqlite3 = require('sqlite3').verbose();
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Determine if we're in production mode
const isProduction = process.env.NODE_ENV === 'production';

// Initialize express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

// Middleware
app.use(morgan('dev'));
app.use(cors());
app.use(express.json());

// Determine database path from environment variable or use default
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data');
const DB_NAME = 'scorecard.db';
const dbPath = path.join(DB_PATH, DB_NAME);
const statusFilePath = path.join(DB_PATH, 'status.json');

// Define database connection variable (will be initialized later)
let db;

// Ensure data directory exists
if (!fs.existsSync(DB_PATH)) {
  console.log(`Creating database directory: ${DB_PATH}`);
  fs.mkdirSync(DB_PATH, { recursive: true });
}

// Database backup configuration
const BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // Check for backup once per day
const MIN_BACKUP_AGE_MS = 7 * 24 * 60 * 60 * 1000; // Minimum 7 days between backups

console.log(`Using database at: ${dbPath}`);

// Get or initialize database status
function getDbStatus() {
  try {
    if (fs.existsSync(statusFilePath)) {
      const statusData = fs.readFileSync(statusFilePath, 'utf8');
      return JSON.parse(statusData);
    }
  } catch (error) {
    console.error('Error reading status file:', error);
  }

  // Default status if file doesn't exist or there's an error
  const defaultStatus = {
    initDate: new Date().toISOString(),
    lastBackupDate: null
  };

  // Save the default status
  try {
    fs.writeFileSync(statusFilePath, JSON.stringify(defaultStatus, null, 2));
  } catch (error) {
    console.error('Error writing initial status file:', error);
  }

  return defaultStatus;
}

// Update the database status
function updateDbStatus(updates) {
  try {
    const currentStatus = getDbStatus();
    const newStatus = { ...currentStatus, ...updates };
    fs.writeFileSync(statusFilePath, JSON.stringify(newStatus, null, 2));
    return newStatus;
  } catch (error) {
    console.error('Error updating status file:', error);
    return null;
  }
}

// Create a backup of the database
function backupDatabase(force = false) {
  const status = getDbStatus();
  const now = new Date();

  // Skip time checks if force is true
  if (!force) {
    // Check if the database has been initialized for at least a week
    const initDate = new Date(status.initDate);
    if (now - initDate < MIN_BACKUP_AGE_MS) {
      console.log('Database is too new for backup (less than 7 days since initialization)');
      return false;
    }

    // Check if it's been at least a week since the last backup
    if (status.lastBackupDate) {
      const lastBackupDate = new Date(status.lastBackupDate);
      if (now - lastBackupDate < MIN_BACKUP_AGE_MS) {
        console.log('Last backup is too recent (less than 7 days ago)');
        return false;
      }
    }
  }

  // Format the date for the backup filename (YYYY-MM-DD)
  const dateStr = now.toISOString().split('T')[0];
  const backupPath = path.join(DB_PATH, `scorecard.${dateStr}.db`);

  // Close the current database connection
  db.close(() => {
    try {
      // Copy the database file
      fs.copyFileSync(dbPath, backupPath);
      console.log(`Database backup created: ${backupPath}`);

      // Update the last backup date
      updateDbStatus({ lastBackupDate: now.toISOString() });

      // Reconnect to the database
      db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          console.error('Error reconnecting to database:', err.message);
        } else {
          console.log('Reconnected to the SQLite database after backup');
        }
      });
    } catch (error) {
      console.error('Error creating database backup:', error);

      // Reconnect to the database even if backup failed
      db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          console.error('Error reconnecting to database:', err.message);
        } else {
          console.log('Reconnected to the SQLite database after failed backup attempt');
        }
      });
    }
  });

  return true;
}

// Connect to SQLite database
db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error connecting to database:', err.message);
  } else {
    console.log('Connected to the SQLite database');

    // Get or initialize the database status
    const status = getDbStatus();
    console.log('Database status:', status);

    // Initialize database tables
    initializeDatabase();

    // Set up periodic backup check
    setInterval(() => {
      console.log('Running scheduled database backup check...');
      const result = backupDatabase();
      if (result) {
        console.log('Scheduled backup completed successfully');
      }
    }, BACKUP_INTERVAL_MS);
  }
});

// Initialize database tables if they don't exist
function initializeDatabase() {
  db.serialize(() => {
    // Create people table
    db.run(`
      CREATE TABLE IF NOT EXISTS people (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE
      )
    `);

    // Create metrics table
    db.run(`
      CREATE TABLE IF NOT EXISTS metrics (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        target_value REAL NOT NULL,
        target_unit TEXT NOT NULL,
        target_operator TEXT NOT NULL,
        owner_id TEXT NOT NULL,
        display_order INTEGER DEFAULT 0,
        value_type TEXT DEFAULT 'number',
        FOREIGN KEY (owner_id) REFERENCES people (id)
      )
    `);

    // Create weeks table
    db.run(`
      CREATE TABLE IF NOT EXISTS weeks (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL
      )
    `);

    // Create weekly values table
    db.run(`
      CREATE TABLE IF NOT EXISTS weekly_values (
        id TEXT PRIMARY KEY,
        metric_id TEXT NOT NULL,
        week_id TEXT NOT NULL,
        value REAL NOT NULL,
        unit TEXT NOT NULL,
        FOREIGN KEY (metric_id) REFERENCES metrics (id),
        FOREIGN KEY (week_id) REFERENCES weeks (id),
        UNIQUE (metric_id, week_id)
      )
    `);

    // Set up periodic check for new completed weeks (every hour)
    setInterval(() => {
      console.log('Running scheduled check for new completed weeks...');
      checkAndCreateNewWeeks();
    }, 60 * 60 * 1000); // 1 hour in milliseconds
  });
}

// Check if tables are empty
function isDatabaseInitialized() {
  return new Promise((resolve, reject) => {
    db.get('SELECT COUNT(*) as count FROM people', (err, row) => {
      if (err) {
        console.error('Error checking people count:', err.message);
        reject(err);
        return;
      }

      resolve(row.count > 0);
    });
  });
}

// Initialize with sample data
function checkForDataAndInitializeSampleData() {
  return new Promise((resolve, reject) => {
    isDatabaseInitialized()
      .then(isInitialized => {
        if (!isInitialized) {
          console.log('Initializing database with sample data...');
          createSampleData();
          resolve(true);
        } else {
          console.log('Database already contains data, skipping sample data creation');
          resolve(false);
        }
      })
      .catch(err => {
        console.error('Error checking database initialization:', err.message);
        reject(err);
      });
  });
}

// Create sample data similar to the frontend's sample data
function createSampleData() {
  // Sample people - We'll check if they exist first
  const samplePeople = [
    { name: 'Alice Smith', email: 'alice@example.com' },
    { name: 'Bob Johnson', email: 'bob@example.com' },
    { name: 'Carol Williams', email: 'carol@example.com' }
  ];

  // For storing the inserted people with their IDs
  const people = [];

  // Use sequential execution to avoid statement finalization issues
  db.serialize(() => {
    db.run('BEGIN TRANSACTION', (err) => {
      if (err) {
        console.error('Error starting transaction:', err.message);
        return;
      }

      // Process people sequentially to avoid SQLite statement issues
      function processPerson(index) {
        if (index >= samplePeople.length) {
          // All people processed, commit transaction
          db.run('COMMIT', (err) => {
            if (err) {
              console.error('Error committing transaction:', err.message);
              return;
            }
            console.log('All sample people processed successfully');

            // Continue with metrics after a short delay
            setTimeout(() => createMetricsAndWeeks(people), 500);
          });
          return;
        }

        const personData = samplePeople[index];

        // Check if person exists
        db.get('SELECT id FROM people WHERE email = ?', [personData.email], (err, row) => {
          if (err) {
            console.error(`Error checking if ${personData.email} exists:`, err.message);
            processPerson(index + 1); // Continue with next person
            return;
          }

          if (row) {
            // Person exists, use their ID
            console.log(`Person with email ${personData.email} already exists, skipping insert`);
            people.push({ id: row.id, ...personData });
            processPerson(index + 1); // Continue with next person
          } else {
            // Insert new person
            const id = uuidv4();
            db.run(
              'INSERT INTO people (id, name, email) VALUES (?, ?, ?)',
              [id, personData.name, personData.email],
              (err) => {
                if (err) {
                  console.error(`Error inserting ${personData.name}:`, err.message);
                } else {
                  people.push({ id, ...personData });
                  console.log(`Inserted person: ${personData.name}`);
                }
                processPerson(index + 1); // Continue with next person
              }
            );
          }
        });
      }

      // Start processing with the first person
      processPerson(0);
    });
  });

  // This is now handled by the sequential processPerson approach above
  // No need for a duplicate createMetricsAndWeeks call

  function createMetricsAndWeeks(peopleList) {
    // If no people were provided, try to fetch them from the database
    if (!peopleList || peopleList.length === 0) {
      console.log('No people provided, fetching from database...');
      db.all('SELECT * FROM people LIMIT 3', (err, rows) => {
        if (err) {
          console.error('Error fetching people for metrics:', err.message);
          return;
        }

        if (rows.length === 0) {
          console.error('No people available to assign metrics to!');
          return;
        }

        const existingPeople = rows.map(row => ({
          id: row.id,
          name: row.name,
          email: row.email
        }));

        console.log(`Found ${existingPeople.length} people in database`);
        createMetricsInternal(existingPeople);
      });
      return;
    }

    createMetricsInternal(peopleList);

    // Internal function to handle metric creation
    function createMetricsInternal(people) {
      console.log(`Creating metrics for ${people.length} people`);

      // First check if metrics already exist
      db.get('SELECT COUNT(*) as count FROM metrics', (err, row) => {
        if (err) {
          console.error('Error checking metrics count:', err.message);
          return;
        }

        if (row.count > 0) {
          console.log('Metrics already exist, skipping metrics creation');
          createWeeksIfNeeded();
          return;
        }

        // Sample metrics with different value types
        const metrics = [
          {
            id: uuidv4(),
            name: 'New Customers',
            target_value: 100,
            target_unit: '',
            target_operator: 'gte',
            owner_id: people[0].id,
            value_type: 'number'
          },
          {
            id: uuidv4(),
            name: 'Revenue',
            target_value: 1,
            target_unit: 'm',
            target_operator: 'gte',
            owner_id: people.length > 1 ? people[1].id : people[0].id,
            value_type: 'dollars'
          },
          {
            id: uuidv4(),
            name: 'Support Tickets',
            target_value: 50,
            target_unit: '',
            target_operator: 'lte',
            owner_id: people.length > 2 ? people[2].id : people[0].id,
            value_type: 'number'
          },
          {
            id: uuidv4(),
            name: 'Customer Satisfaction',
            target_value: 95,
            target_unit: '%',
            target_operator: 'gte',
            owner_id: people.length > 1 ? people[1].id : people[0].id,
            value_type: 'percent'
          },
          {
            id: uuidv4(),
            name: 'Response Time',
            target_value: 8,
            target_unit: 'hour',
            target_operator: 'lte',
            owner_id: people.length > 2 ? people[2].id : people[0].id,
            value_type: 'time'
          }
        ];

        // Insert metrics one by one to avoid statement issues
        db.run('BEGIN TRANSACTION', (err) => {
          if (err) {
            console.error('Error starting metrics transaction:', err.message);
            return;
          }

          function insertMetric(index) {
            if (index >= metrics.length) {
              // All metrics inserted, commit and continue
              db.run('COMMIT', (err) => {
                if (err) {
                  console.error('Error committing metrics transaction:', err.message);
                  return;
                }
                console.log('Sample metrics created successfully');
                createWeeksIfNeeded(metrics);
              });
              return;
            }

            const metric = metrics[index];

            db.run(
              'INSERT INTO metrics (id, name, target_value, target_unit, target_operator, owner_id, display_order, value_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
              [
                metric.id,
                metric.name,
                metric.target_value,
                metric.target_unit,
                metric.target_operator,
                metric.owner_id,
                index,
                metric.value_type || 'number'
              ],
              (err) => {
                if (err) {
                  console.error(`Error inserting metric ${metric.name}:`, err.message);
                } else {
                  console.log(`Inserted metric: ${metric.name}`);
                }
                insertMetric(index + 1);
              }
            );
          }

          // Start inserting metrics
          insertMetric(0);
        });
      });
    }
  }

  function createWeeksIfNeeded(createdMetrics) {
    // Check if weeks already exist
    db.get('SELECT COUNT(*) as count FROM weeks', (err, row) => {
      if (err) {
        console.error('Error checking weeks count:', err.message);
        return;
      }

      if (row.count > 0) {
        console.log('Weeks already exist, skipping weeks creation');
        // If metrics were just created but weeks already exist,
        // we should make sure the weekly_values are also created
        if (createdMetrics) {
          createWeeklyValues(createdMetrics);
        }
        return;
      }

      // No weeks exist, create them
      const now = new Date();
      const weeks = [];

      // Find the most recent completed Monday (previous week's Monday)
      const mostRecentCompletedMonday = new Date(now);
      // Go back to previous week's Monday
      mostRecentCompletedMonday.setDate(now.getDate() - 7 - (now.getDay() === 0 ? 6 : now.getDay() - 1));
      mostRecentCompletedMonday.setHours(0, 0, 0, 0);

      // Generate 12 weeks of data (all previous completed weeks)
      for (let i = 0; i < 12; i++) {
        const startDate = new Date(mostRecentCompletedMonday);
        startDate.setDate(startDate.getDate() - (i * 7)); // Previous weeks

        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 6); // Sunday

        // Only add completed weeks
        if (endDate < now) {
          weeks.push({
            id: uuidv4(),
            name: `Week ${i + 1}`,
            start_date: startDate.toISOString(),
            end_date: endDate.toISOString()
          });
        }
      }

      // Insert weeks sequentially
      db.run('BEGIN TRANSACTION', (err) => {
        if (err) {
          console.error('Error starting weeks transaction:', err.message);
          return;
        }

        function insertWeek(index) {
          if (index >= weeks.length) {
            // All weeks inserted, commit transaction and continue
            db.run('COMMIT', (err) => {
              if (err) {
                console.error('Error committing weeks transaction:', err.message);
                return;
              }

              console.log('Sample weeks created successfully');

              // If we just created metrics, create weekly values too
              if (createdMetrics) {
                createWeeklyValues(createdMetrics, weeks);
              } else {
                // Otherwise, look up metrics and then create weekly values
                db.all('SELECT * FROM metrics', (err, metrics) => {
                  if (err) {
                    console.error('Error fetching metrics for weekly values:', err.message);
                    return;
                  }

                  createWeeklyValues(metrics, weeks);
                });
              }
            });
            return;
          }

          const week = weeks[index];

          db.run(
            'INSERT INTO weeks (id, name, start_date, end_date) VALUES (?, ?, ?, ?)',
            [week.id, week.name, week.start_date, week.end_date],
            (err) => {
              if (err) {
                console.error(`Error inserting week ${week.name}:`, err.message);
              } else {
                console.log(`Inserted week: ${week.name}`);
              }
              insertWeek(index + 1);
            }
          );
        }

        // Start inserting weeks
        insertWeek(0);
      });
    });
  }

  function createWeeklyValues(metrics, passedWeeks) {
    // Check if values already exist
    db.get('SELECT COUNT(*) as count FROM weekly_values', (err, row) => {
      if (err) {
        console.error('Error checking weekly_values count:', err.message);
        return;
      }

      if (row.count > 0) {
        console.log('Weekly values already exist, skipping creation');
        return;
      }

      // Function to continue with the passed or fetched weeks
      const continueWithWeeks = (weeks) => {
        console.log(`Creating weekly values for ${metrics.length} metrics and ${weeks.length} weeks`);

        // Start transaction
        db.run('BEGIN TRANSACTION', (err) => {
          if (err) {
            console.error('Error starting weekly values transaction:', err.message);
            return;
          }

          // Process metrics one by one
          function processMetric(metricIndex) {
            if (metricIndex >= metrics.length) {
              // All metrics processed, commit transaction
              db.run('COMMIT', (err) => {
                if (err) {
                  console.error('Error committing weekly values transaction:', err.message);
                  return;
                }
                console.log('Sample weekly values created successfully');
              });
              return;
            }

            const metric = metrics[metricIndex];

            // Process weeks for this metric one by one
            function processWeek(weekIndex) {
              if (weekIndex >= weeks.length) {
                // All weeks for this metric processed, move to next metric
                processMetric(metricIndex + 1);
                return;
              }

              const week = weeks[weekIndex];

              // Calculate the relative index for consistent data patterns
              const relativeIndex = weeks.length - 1 - weekIndex; // Newest week has highest index

              // Generate realistic looking data with some trends and variations
              let value;
              let unit = '';

              // Use metric.name for created metrics, or metric_name for fetched metrics
              const metricName = metric.name || metric.metric_name;
              const valueType = metric.value_type || 'number';

              if (metricName === 'New Customers') {
                // New Customers - generally around 100-130, trending up
                const base = 100 + relativeIndex * 2;  // Trend up for newer weeks
                const variation = Math.floor(Math.random() * 30) - 15; // +/- 15
                value = base + variation;
                unit = '';
              }
              else if (metricName === 'Revenue') {
                // Revenue - around 1m, seasonal variations
                const base = 1.0;
                const seasonal = Math.sin((relativeIndex / 12) * Math.PI * 2) * 0.3; // Seasonal cycle
                const random = (Math.random() * 0.2) - 0.1; // +/- 0.1m
                value = base + seasonal + random;
                value = Math.max(0.8, Math.min(1.5, value)); // Keep between 0.8m and 1.5m
                value = parseFloat(value.toFixed(2)); // Two decimal places
                unit = 'm';
              }
              else if (metricName === 'Customer Satisfaction') {
                // Customer Satisfaction - percentage between 85-100%
                const base = 92; // Base satisfaction level
                const variation = Math.floor(Math.random() * 10) - 3; // +/- 3
                value = Math.min(100, Math.max(85, base + variation));
                unit = '%';
              }
              else if (metricName === 'Response Time') {
                // Response Time - hours between 3-12
                const base = 6; // Base response time
                const variation = Math.random() * 6 - 3; // +/- 3
                value = Math.max(3, Math.min(12, base + variation));
                value = parseFloat(value.toFixed(1)); // One decimal place
                unit = 'hour';
              }
              else {
                // Support Tickets - target is below 50, fluctuates
                const base = 35 + (Math.sin((relativeIndex / 6) * Math.PI) * 20); // Cycle with peak around 55
                const variation = Math.floor(Math.random() * 16) - 8; // +/- 8
                value = Math.max(20, Math.round(base + variation));
                unit = '';
              }

              const valueId = uuidv4();
              const weekId = week.id || week.week_id;

              db.run(
                'INSERT INTO weekly_values (id, metric_id, week_id, value, unit) VALUES (?, ?, ?, ?, ?)',
                [valueId, metric.id, weekId, value, unit],
                (err) => {
                  if (err) {
                    console.error(`Error inserting weekly value for metric ${metricName}, week ${weekId}:`, err.message);
                  }
                  processWeek(weekIndex + 1);
                }
              );
            }

            // Start processing weeks for this metric
            processWeek(0);
          }

          // Start processing metrics
          processMetric(0);
        });
      };

      // If weeks were passed, use them, otherwise fetch weeks from db
      if (passedWeeks && passedWeeks.length > 0) {
        console.log(`Using ${passedWeeks.length} provided weeks`);
        continueWithWeeks(passedWeeks);
      } else {
        console.log('Fetching weeks from database...');
        db.all('SELECT * FROM weeks ORDER BY start_date ASC', (err, weeks) => {
          if (err) {
            console.error('Error fetching weeks for weekly values:', err.message);
            return;
          }

          if (weeks.length === 0) {
            console.error('No weeks found in database, cannot create weekly values');
            return;
          }

          console.log(`Found ${weeks.length} weeks in database`);
          continueWithWeeks(weeks);
        });
      }
    });
  }
}

// Socket.io connection handler
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Helper function to broadcast changes to all connected clients
function broadcastChange(event, data) {
  io.emit(event, data);
}

// ===================== API ROUTES =====================

// Check database initialization status
app.get('/api/status', async (req, res) => {
  try {
    const isInitialized = await isDatabaseInitialized();
    const dbStatus = getDbStatus();

    res.json({
      initialized: isInitialized,
      initDate: dbStatus.initDate,
      lastBackupDate: dbStatus.lastBackupDate
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Trigger a database backup
app.post('/api/backup', async (req, res) => {
  try {
    const force = req.query.force === 'true';

    // This is async due to the db.close callback, so we need to handle the response differently
    db.get('SELECT 1', (err) => {
      if (err) {
        return res.status(500).json({ error: 'Database not available', success: false });
      }

      const status = getDbStatus();
      const now = new Date();
      const initDate = new Date(status.initDate);

      // Skip time checks if force is true
      if (!force) {
        // Check if DB is too new
        if (now - initDate < MIN_BACKUP_AGE_MS) {
          return res.json({
            success: false,
            message: 'Database is too new for backup (less than 7 days since initialization)',
            initDate: status.initDate,
            lastBackupDate: status.lastBackupDate,
            minBackupAge: MIN_BACKUP_AGE_MS / (24 * 60 * 60 * 1000) + ' days'
          });
        }

        // Check if last backup is too recent
        if (status.lastBackupDate) {
          const lastBackupDate = new Date(status.lastBackupDate);
          if (now - lastBackupDate < MIN_BACKUP_AGE_MS) {
            return res.json({
              success: false,
              message: 'Last backup is too recent (less than 7 days ago)',
              initDate: status.initDate,
              lastBackupDate: status.lastBackupDate,
              minBackupAge: MIN_BACKUP_AGE_MS / (24 * 60 * 60 * 1000) + ' days'
            });
          }
        }
      }

      // Format the date for the backup filename (YYYY-MM-DD)
      const dateStr = now.toISOString().split('T')[0];
      const backupPath = path.join(DB_PATH, `scorecard.${dateStr}.db`);

      // Close the current database connection
      db.close(() => {
        try {
          // Copy the database file
          fs.copyFileSync(dbPath, backupPath);
          console.log(`Database backup created: ${backupPath}`);

          // Update the last backup date
          updateDbStatus({ lastBackupDate: now.toISOString() });

          // Reconnect to the database
          db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
              console.error('Error reconnecting to database:', err.message);
              return res.status(500).json({
                error: 'Error reconnecting to database after backup',
                success: false
              });
            } else {
              console.log('Reconnected to the SQLite database after backup');
              return res.json({
                success: true,
                message: 'Backup created successfully',
                backupPath: backupPath,
                backupDate: now.toISOString()
              });
            }
          });
        } catch (error) {
          console.error('Error creating database backup:', error);

          // Reconnect to the database even if backup failed
          db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
              console.error('Error reconnecting to database:', err.message);
              return res.status(500).json({
                error: 'Error reconnecting to database after failed backup attempt',
                success: false
              });
            } else {
              console.log('Reconnected to the SQLite database after failed backup attempt');
              return res.status(500).json({
                error: 'Failed to create backup: ' + error.message,
                success: false
              });
            }
          });
        }
      });
    });
  } catch (err) {
    res.status(500).json({ error: err.message, success: false });
  }
});

// Initialize database with sample data
app.post('/api/initialize/sample', async (req, res) => {
  try {
    const isInitialized = await isDatabaseInitialized();
    if (isInitialized) {
      return res.status(400).json({ error: 'Database is already initialized' });
    }

    await checkForDataAndInitializeSampleData();
    res.json({ success: true, message: 'Database initialized with sample data' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Initialize database from EOS data
app.post('/api/initialize/eos', async (req, res) => {
  try {
    const isInitialized = await isDatabaseInitialized();
    if (isInitialized) {
      return res.status(400).json({ error: 'Database is already initialized' });
    }

    const { data } = req.body;

    if (!data || !data.measurables || !data.dates) {
      return res.status(400).json({ error: 'Invalid EOS data format' });
    }

    await importEosData(data);
    res.json({ success: true, message: 'Database initialized with EOS data' });
  } catch (err) {
    console.error('Error importing EOS data:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET all people
app.get('/api/people', (req, res) => {
  db.all('SELECT * FROM people', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// GET a single person
app.get('/api/people/:id', (req, res) => {
  db.get('SELECT * FROM people WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row) {
      res.status(404).json({ error: 'Person not found' });
      return;
    }
    res.json(row);
  });
});

// POST a new person
app.post('/api/people', (req, res) => {
  const { name, email } = req.body;

  if (!name || !email) {
    res.status(400).json({ error: 'Name and email are required' });
    return;
  }

  const id = uuidv4();

  db.run(
    'INSERT INTO people (id, name, email) VALUES (?, ?, ?)',
    [id, name, email],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }

      const newPerson = { id, name, email };
      res.status(201).json(newPerson);

      // Broadcast the new person to all connected clients
      broadcastChange('person_created', newPerson);
    }
  );
});

// PUT (update) a person
app.put('/api/people/:id', (req, res) => {
  const { name, email } = req.body;

  if (!name || !email) {
    res.status(400).json({ error: 'Name and email are required' });
    return;
  }

  db.run(
    'UPDATE people SET name = ?, email = ? WHERE id = ?',
    [name, email, req.params.id],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }

      if (this.changes === 0) {
        res.status(404).json({ error: 'Person not found' });
        return;
      }

      const updatedPerson = { id: req.params.id, name, email };
      res.json(updatedPerson);

      // Broadcast the updated person to all connected clients
      broadcastChange('person_updated', updatedPerson);
    }
  );
});

// DELETE a person
app.delete('/api/people/:id', (req, res) => {
  // First check if the person owns any metrics
  db.get('SELECT COUNT(*) as count FROM metrics WHERE owner_id = ?', [req.params.id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    if (row.count > 0) {
      res.status(400).json({
        error: 'Cannot delete person because they own metrics',
        metricCount: row.count
      });
      return;
    }

    // If no metrics are owned, proceed with deletion
    db.run('DELETE FROM people WHERE id = ?', [req.params.id], function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }

      if (this.changes === 0) {
        res.status(404).json({ error: 'Person not found' });
        return;
      }

      res.json({ id: req.params.id, deleted: true });

      // Broadcast the deletion to all connected clients
      broadcastChange('person_deleted', { id: req.params.id });
    });
  });
});

// GET all metrics
app.get('/api/metrics', (req, res) => {
  // Join with people to get the owner details
  db.all(`
    SELECT
      m.id, m.name, m.target_value, m.target_unit, m.target_operator, m.display_order, m.value_type,
      p.id as owner_id, p.name as owner_name, p.email as owner_email
    FROM metrics m
    JOIN people p ON m.owner_id = p.id
    ORDER BY m.display_order ASC
  `, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    // Transform the rows to match the frontend data structure
    const metrics = rows.map(row => ({
      id: row.id,
      name: row.name,
      target: {
        value: row.target_value,
        unit: row.target_unit,
        operator: row.target_operator
      },
      owner: {
        id: row.owner_id,
        name: row.owner_name,
        email: row.owner_email
      },
      displayOrder: row.display_order,
      valueType: row.value_type || 'number'
    }));

    res.json(metrics);
  });
});

// POST a new metric
app.post('/api/metrics', (req, res) => {
  const { name, target, owner, valueType } = req.body;

  if (!name || !target || !owner) {
    res.status(400).json({ error: 'Name, target, and owner are required' });
    return;
  }

  // Default to 'number' if valueType is not provided
  const metricValueType = valueType || 'number';

  const id = uuidv4();

  // Get the highest display_order to append new metric at the end
  db.get('SELECT MAX(display_order) as maxOrder FROM metrics', (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    const displayOrder = (row && row.maxOrder !== null) ? row.maxOrder + 1 : 0;

    db.run(
      'INSERT INTO metrics (id, name, target_value, target_unit, target_operator, owner_id, display_order, value_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, name, target.value, target.unit, target.operator, owner.id, displayOrder, metricValueType],
      function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }

        const newMetric = {
          id,
          name,
          target,
          owner,
          displayOrder,
          valueType: metricValueType
        };

        res.status(201).json(newMetric);

        // Broadcast the new metric to all connected clients
        broadcastChange('metric_created', newMetric);
      }
    );
  });
});

// PUT (update) a metric
app.put('/api/metrics/:id', (req, res) => {
  const { name, target, owner, displayOrder, valueType } = req.body;

  if (!name || !target || !owner) {
    res.status(400).json({ error: 'Name, target, and owner are required' });
    return;
  }

  // Default to 'number' if valueType is not provided
  const metricValueType = valueType || 'number';

  // Build the update query based on which optional fields are provided
  let updateQuery = 'UPDATE metrics SET name = ?, target_value = ?, target_unit = ?, target_operator = ?, owner_id = ?, value_type = ?';
  let params = [name, target.value, target.unit, target.operator, owner.id, metricValueType];

  // Add display_order if provided
  if (displayOrder !== undefined) {
    updateQuery += ', display_order = ?';
    params.push(displayOrder);
  }

  // Add WHERE clause and ID
  updateQuery += ' WHERE id = ?';
  params.push(req.params.id);

  db.run(updateQuery, params, function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    if (this.changes === 0) {
      res.status(404).json({ error: 'Metric not found' });
      return;
    }

    const updatedMetric = {
      id: req.params.id,
      name,
      target,
      owner,
      displayOrder,
      valueType: metricValueType
    };

    res.json(updatedMetric);

    // Broadcast the updated metric to all connected clients
    broadcastChange('metric_updated', updatedMetric);
  });
});

// DELETE a metric
app.delete('/api/metrics/:id', (req, res) => {
  // First delete any weekly values associated with this metric
  db.run('DELETE FROM weekly_values WHERE metric_id = ?', [req.params.id], (err) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    // Then delete the metric
    db.run('DELETE FROM metrics WHERE id = ?', [req.params.id], function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }

      if (this.changes === 0) {
        res.status(404).json({ error: 'Metric not found' });
        return;
      }

      res.json({ id: req.params.id, deleted: true });

      // Broadcast the deletion to all connected clients
      broadcastChange('metric_deleted', { id: req.params.id });
    });
  });
});

// GET all weeks
app.get('/api/weeks', (req, res) => {
  // Get today's date for filtering incomplete weeks
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Use SQL to filter and sort weeks directly in the database query
  db.all(
    `SELECT *
     FROM weeks
     WHERE end_date < ?
     ORDER BY start_date ASC`,
    [today.toISOString()],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }

      // Transform the data to match the frontend structure
      const completedWeeks = rows.map(row => ({
        id: row.id,
        name: row.name,
        startDate: row.start_date,
        endDate: row.end_date
      }));

      res.json(completedWeeks);
    }
  );
});

// Function to check for and create new completed weeks
function checkAndCreateNewWeeks() {
  // Get the latest week from the database
  db.get('SELECT * FROM weeks ORDER BY end_date DESC LIMIT 1', (err, latestWeek) => {
    if (err) {
      console.error('Error checking for new weeks:', err.message);
      return;
    }

    // If no weeks exist, just return (don't auto-initialize)
    if (!latestWeek) {
      console.log('No weeks found - database not initialized yet');
      return;
    }

    const latestEndDate = new Date(latestWeek.end_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let newWeeksAdded = [];

    // Check if the latest week has ended and we need to add more completed weeks
    if (latestEndDate < today) {
      // Find the most recent completed Sunday
      const mostRecentSunday = new Date(today);
      const daysToSubtract = today.getDay() === 0 ? 7 : today.getDay();
      mostRecentSunday.setDate(today.getDate() - daysToSubtract);
      mostRecentSunday.setHours(23, 59, 59, 999);

      // If there's a gap between the latest week end date and the most recent Sunday,
      // we need to add weeks to fill the gap
      if (latestEndDate < mostRecentSunday) {
        // Start from the day after the last recorded week
        let startDate = new Date(latestEndDate);
        startDate.setDate(startDate.getDate() + 1);
        startDate.setHours(0, 0, 0, 0);

        // Make sure we start on a Monday
        if (startDate.getDay() !== 1) {
          const daysToAdd = startDate.getDay() === 0 ? 1 : 8 - startDate.getDay();
          startDate.setDate(startDate.getDate() + daysToAdd);
        }

        // Add weeks until we reach the most recent completed Sunday
        db.serialize(() => {
          // Begin transaction for batch inserts
          db.run('BEGIN TRANSACTION');

          const insertWeekStmt = db.prepare(
            'INSERT INTO weeks (id, name, start_date, end_date) VALUES (?, ?, ?, ?)'
          );

          let index = 0;
          while (startDate <= mostRecentSunday) {
            const endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + 6); // Sunday

            // Only add the week if it's fully in the past (ended before today)
            if (endDate < today) {
              const startDateCopy = new Date(startDate);
              const endDateCopy = new Date(endDate);

              db.get('SELECT COUNT(*) as count FROM weeks', (err, row) => {
                if (err) {
                  console.error('Error getting week count:', err.message);
                  return;
                }

                const weekCount = row.count + 1;
                const weekId = uuidv4();
                const weekName = `Week ${weekCount}`;

                insertWeekStmt.run(
                  weekId,
                  weekName,
                  startDateCopy.toISOString(),
                  endDateCopy.toISOString(),
                  function(err) {
                    if (err) {
                      console.error('Error inserting new week:', err.message);
                      return;
                    }

                    console.log(`Added new week: ${weekName} (${startDateCopy.toDateString()} - ${endDateCopy.toDateString()})`);

                    newWeeksAdded.push({
                      id: weekId,
                      name: weekName,
                      startDate: startDateCopy.toISOString(),
                      endDate: endDateCopy.toISOString()
                    });
                  }
                );

                index++;
              });
            }

            // Move to the next week
            startDate.setDate(startDate.getDate() + 7);
          }

          insertWeekStmt.finalize();

          // Commit transaction
          db.run('COMMIT', (err) => {
            if (err) {
              console.error('Error committing new weeks transaction:', err.message);
              return;
            }

            if (newWeeksAdded.length > 0) {
              console.log(`Created ${newWeeksAdded.length} new completed weeks`);
              // Broadcast the new weeks to all connected clients
              broadcastChange('weeks_updated', newWeeksAdded);
            }
          });
        });
      }
    }
  });
}

// Endpoint to check for new weeks and add them
app.post('/api/weeks/update', async (req, res) => {
  try {
    // Check if database is initialized first
    const isInitialized = await isDatabaseInitialized();
    if (!isInitialized) {
      return res.json({ message: 'Database not initialized yet', newWeeks: [] });
    }

    // Get the latest week from the database
    db.get('SELECT * FROM weeks ORDER BY end_date DESC LIMIT 1', (err, latestWeek) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }

      // If no weeks exist (but database is initialized), something is wrong
      if (!latestWeek) {
        return res.status(500).json({ error: 'Database is initialized but no weeks found' });
      }

      const latestEndDate = new Date(latestWeek.end_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let newWeeksAdded = [];

      // Check if the latest week has ended and we need to add more completed weeks
      if (latestEndDate < today) {
        // Find the most recent completed Sunday
        const mostRecentSunday = new Date(today);
        const daysToSubtract = today.getDay() === 0 ? 7 : today.getDay();
        mostRecentSunday.setDate(today.getDate() - daysToSubtract);
        mostRecentSunday.setHours(23, 59, 59, 999);

      // If there's a gap between the latest week end date and the most recent Sunday,
      // we need to add weeks to fill the gap
      if (latestEndDate < mostRecentSunday) {
        // Start from the day after the last recorded week
        let startDate = new Date(latestEndDate);
        startDate.setDate(startDate.getDate() + 1);
        startDate.setHours(0, 0, 0, 0);

        // Make sure we start on a Monday
        if (startDate.getDay() !== 1) {
          const daysToAdd = startDate.getDay() === 0 ? 1 : 8 - startDate.getDay();
          startDate.setDate(startDate.getDate() + daysToAdd);
        }

        // Add weeks until we reach the most recent completed Sunday
        db.serialize(() => {
          // Begin transaction for batch inserts
          db.run('BEGIN TRANSACTION');

          const insertWeekStmt = db.prepare(
            'INSERT INTO weeks (id, name, start_date, end_date) VALUES (?, ?, ?, ?)'
          );

          let index = 0;
          while (startDate <= mostRecentSunday) {
            const endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + 6); // Sunday

            // Only add the week if it's fully in the past (ended before today)
            if (endDate < today) {
              const startDateCopy = new Date(startDate);
              const endDateCopy = new Date(endDate);

              db.get('SELECT COUNT(*) as count FROM weeks', (err, row) => {
                if (err) throw err;

                const weekCount = row.count + 1;
                const weekId = uuidv4();
                const weekName = `Week ${weekCount}`;

                insertWeekStmt.run(
                  weekId,
                  weekName,
                  startDateCopy.toISOString(),
                  endDateCopy.toISOString()
                );

                newWeeksAdded.push({
                  id: weekId,
                  name: weekName,
                  startDate: startDateCopy.toISOString(),
                  endDate: endDateCopy.toISOString()
                });

                index++;
              });
            }

            // Move to the next week
            startDate.setDate(startDate.getDate() + 7);
          }

          insertWeekStmt.finalize();

          // Commit transaction
          db.run('COMMIT', (err) => {
            if (err) {
              res.status(500).json({ error: err.message });
              return;
            }

            if (newWeeksAdded.length > 0) {
              // Broadcast the new weeks to all connected clients
              broadcastChange('weeks_updated', newWeeksAdded);
            }

            res.json({ message: 'Weeks updated', newWeeks: newWeeksAdded });
          });
        });
      } else {
        res.json({ message: 'No new weeks needed', newWeeks: [] });
      }
    } else {
      res.json({ message: 'No new weeks needed', newWeeks: [] });
    }
  });
} catch (err) {
  res.status(500).json({ error: err.message });
}
});

// GET all weekly values
app.get('/api/weekly-values', (req, res) => {
  db.all('SELECT * FROM weekly_values', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    // Transform to match frontend structure
    const values = rows.map(row => ({
      metricId: row.metric_id,
      weekId: row.week_id,
      value: row.value,
      unit: row.unit
    }));

    res.json(values);
  });
});

// Add endpoint to reorder metrics
app.post('/api/metrics/reorder', (req, res) => {
  const { metrics } = req.body;

  if (!metrics || !Array.isArray(metrics)) {
    res.status(400).json({ error: 'Invalid metrics array' });
    return;
  }

  // Start a transaction to update all metrics
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');

    const updateStmt = db.prepare('UPDATE metrics SET display_order = ? WHERE id = ?');

    let hasError = false;

    // Update the display order of each metric
    metrics.forEach((metric, index) => {
      updateStmt.run(index, metric.id, (err) => {
        if (err) {
          console.error('Error updating metric order:', err);
          hasError = true;
        }
      });
    });

    updateStmt.finalize();

    if (hasError) {
      db.run('ROLLBACK');
      res.status(500).json({ error: 'Failed to update metrics order' });
      return;
    }

    db.run('COMMIT', (err) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }

      res.json({ message: 'Metrics reordered successfully' });

      // Broadcast the reorder event to all connected clients
      broadcastChange('metrics_reordered', { metrics });
    });
  });
});

// POST (update) a weekly value
app.post('/api/weekly-values', (req, res) => {
  const { metricId, weekId, value, unit } = req.body;

  if (!metricId || !weekId || value === undefined) {
    res.status(400).json({ error: 'metricId, weekId, and value are required' });
    return;
  }

  // First check if the value already exists
  db.get(
    'SELECT * FROM weekly_values WHERE metric_id = ? AND week_id = ?',
    [metricId, weekId],
    (err, row) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }

      const unitValue = unit || '';

      if (row) {
        // Update existing value
        db.run(
          'UPDATE weekly_values SET value = ?, unit = ? WHERE metric_id = ? AND week_id = ?',
          [value, unitValue, metricId, weekId],
          function(err) {
            if (err) {
              res.status(500).json({ error: err.message });
              return;
            }

            const updatedValue = { metricId, weekId, value, unit: unitValue };
            res.json(updatedValue);

            // Broadcast the updated value to all connected clients
            broadcastChange('weekly_value_updated', updatedValue);
          }
        );
      } else {
        // Insert new value with UUID
        const id = uuidv4();
        db.run(
          'INSERT INTO weekly_values (id, metric_id, week_id, value, unit) VALUES (?, ?, ?, ?, ?)',
          [id, metricId, weekId, value, unitValue],
          function(err) {
            if (err) {
              res.status(500).json({ error: err.message });
              return;
            }

            const newValue = { id, metricId, weekId, value, unit: unitValue };
            res.status(201).json(newValue);

            // Broadcast the new value to all connected clients
            broadcastChange('weekly_value_created', newValue);
          }
        );
      }
    }
  );
});

// If we're in production, serve the static files from the React build directory
if (isProduction) {
  const buildPath = path.join(__dirname, '..', 'build');
  console.log(`Serving static files from: ${buildPath}`);

  app.use(express.static(buildPath));

  // For any unknown API request, send the React app
  app.get('*', (req, res) => {
    // Skip API routes
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ error: 'API endpoint not found' });
    }
    res.sendFile(path.join(buildPath, 'index.html'));
  });
}

// Start the server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Database location: ${dbPath}`);
  console.log(`Environment: ${isProduction ? 'production' : 'development'}`);
});

// Import data from EOS One format
async function importEosData(eosData) {
  return new Promise((resolve, reject) => {
    // Start a transaction to ensure data consistency
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');

      try {
        // Step 1: Process owners (people)
        const ownerMap = new Map();
        const owners = [...new Set(eosData.measurables.map(m => m.ownerId))];

        function processOwners(index) {
          if (index >= owners.length) {
            processWeeks(0);
            return;
          }

          const ownerId = owners[index];
          const measurable = eosData.measurables.find(m => m.ownerId === ownerId);
          const ownerName = measurable.ownerName;
          const email = `${ownerName.toLowerCase().replace(/\s+/g, '.')}@example.com`;
          const id = uuidv4();

          db.run(
            'INSERT INTO people (id, name, email) VALUES (?, ?, ?)',
            [id, ownerName, email],
            (err) => {
              if (err) {
                console.error(`Error inserting person ${ownerName}:`, err.message);
                processOwners(index + 1);
                return;
              }

              ownerMap.set(ownerId, { id, name: ownerName, email });
              console.log(`Imported person: ${ownerName}`);
              processOwners(index + 1);
            }
          );
        }

        // Step 2: Process weeks from EOS dates
        function processWeeks(index) {
          if (index >= eosData.dates.length) {
            processMetrics(0);
            return;
          }

          const week = eosData.dates[index];
          const id = uuidv4();
          const name = `Week ${week.intervalNo}`;

          db.run(
            'INSERT INTO weeks (id, name, start_date, end_date) VALUES (?, ?, ?, ?)',
            [id, name, week.fromDate, week.toDate],
            (err) => {
              if (err) {
                console.error(`Error inserting week ${name}:`, err.message);
                processWeeks(index + 1);
                return;
              }

              // Map EOS intervalId to our week id for later use
              week.mappedId = id;
              console.log(`Imported week: ${name}`);
              processWeeks(index + 1);
            }
          );
        }

        // Step 3: Process metrics and their values
        function processMetrics(index) {
          if (index >= eosData.measurables.length) {
            // All done, commit transaction
            db.run('COMMIT', (err) => {
              if (err) {
                console.error('Error committing transaction:', err.message);
                reject(err);
                return;
              }
              console.log('EOS data import completed successfully');
              resolve();
            });
            return;
          }

          const measurable = eosData.measurables[index];
          const ownerId = ownerMap.get(measurable.ownerId)?.id;

          if (!ownerId) {
            console.error(`No owner found for measurable ${measurable.title}`);
            processMetrics(index + 1);
            return;
          }

          // Map EOS comparison types to our format
          const operatorMap = {
            'Greater': 'gt',
            'GreaterOrEqual': 'gte',
            'Less': 'lt',
            'LessOrEqual': 'lte',
            'Equal': 'eq'
          };

          // Map EOS unit types to our format
          const unitMap = {
            'Number': '',
            'Percent': '%',
            'Dollar': '$',
            'Hours': 'hour'
          };

          // Map EOS valueScale to our unit format
          const valueScaleMap = {
            'One': '',
            'Thousand': 'k',
            'Million': 'm',
            'Billion': 'b'
          };

          // Map EOS unit types to our valueType
          const valueTypeMap = {
            'Number': 'number',
            'Percent': 'percent',
            'Dollar': 'dollars',
            'Hours': 'time'
          };

          const metricId = uuidv4();
          const operator = operatorMap[measurable.comparison] || 'gte';

          // Combine unit from unitOfMeasure and scale from valueScale
          let unit = unitMap[measurable.unitOfMeasure] || '';
          // Only apply scale for Number type measurements
          if (measurable.unitOfMeasure === 'Number' && measurable.valueScale) {
            unit = valueScaleMap[measurable.valueScale] || '';
          }

          const valueType = valueTypeMap[measurable.unitOfMeasure] || 'number';

          db.run(
            'INSERT INTO metrics (id, name, target_value, target_unit, target_operator, owner_id, display_order, value_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [
              metricId,
              measurable.title,
              measurable.goalValue,
              unit,
              operator,
              ownerId,
              measurable.sequence,
              valueType
            ],
            (err) => {
              if (err) {
                console.error(`Error inserting metric ${measurable.title}:`, err.message);
                processMetrics(index + 1);
                return;
              }

              console.log(`Imported metric: ${measurable.title}`);

              // Now process all values for this metric
              processValues(0, measurable.values, metricId, measurable, () => {
                processMetrics(index + 1);
              });
            }
          );
        }

        // Step 4: Process values for a metric
        function processValues(valIndex, values, metricId, measurable, callback) {
          if (valIndex >= values.length) {
            callback();
            return;
          }

          const value = values[valIndex];
          const week = eosData.dates.find(d => d.intervalId === value.intervalId);

          if (!week || !week.mappedId) {
            console.error(`No week found for interval ${value.intervalId}`);
            processValues(valIndex + 1, values, metricId, measurable, callback);
            return;
          }

          // Map EOS unit types to our format
          const unitMap = {
            'Number': '',
            'Percent': '%',
            'Dollar': '$',
            'Hours': 'hour'
          };

          // Map EOS valueScale to our unit format
          const valueScaleMap = {
            'One': '',
            'Thousand': 'k',
            'Million': 'm',
            'Billion': 'b'
          };

          const metric = eosData.measurables.find(m => m.values.some(v => v.id === value.id));

          // Combine unit from unitOfMeasure and scale from valueScale
          let unit = unitMap[metric.unitOfMeasure] || '';
          // Only apply scale for Number type measurements
          if (metric.unitOfMeasure === 'Number' && metric.valueScale) {
            unit = valueScaleMap[metric.valueScale] || '';
          }

          db.run(
            'INSERT INTO weekly_values (id, metric_id, week_id, value, unit) VALUES (?, ?, ?, ?, ?)',
            [uuidv4(), metricId, week.mappedId, value.value, unit],
            (err) => {
              if (err) {
                console.error(`Error inserting value for metric ${metricId}, week ${week.mappedId}:`, err.message);
              } else {
                console.log(`Imported value for metric ${metricId}, week ${week.mappedId}`);
              }
              processValues(valIndex + 1, values, metricId, measurable, callback);
            }
          );
        }

        // Start the import process
        processOwners(0);

      } catch (error) {
        db.run('ROLLBACK');
        console.error('Error in EOS data import:', error);
        reject(error);
      }
    });
  });
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Closing database connection...');
  db.close();
  process.exit(0);
});
