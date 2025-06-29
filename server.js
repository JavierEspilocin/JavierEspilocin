const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'site')));

const db = new sqlite3.Database(path.join(__dirname, 'database.db'));

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS volunteers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS preferences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    volunteer_id INTEGER,
    location TEXT,
    shift_index INTEGER,
    preferred INTEGER,
    FOREIGN KEY(volunteer_id) REFERENCES volunteers(id)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS shifts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    location TEXT,
    date TEXT,
    shift_index INTEGER,
    start_time TEXT,
    end_time TEXT,
    volunteer_id INTEGER,
    FOREIGN KEY(volunteer_id) REFERENCES volunteers(id)
  )`);
});

function weekRange(dateStr) {
  const date = new Date(dateStr);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  const monday = new Date(date.setDate(diff));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: monday.toISOString().slice(0,10), end: sunday.toISOString().slice(0,10) };
}

app.get('/api/volunteers', (req, res) => {
  db.all('SELECT * FROM volunteers', (err, rows) => {
    if (err) return res.status(500).json({error: err.message});
    res.json(rows);
  });
});

app.post('/api/volunteers', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({error: 'Nombre requerido'});
  db.run('INSERT INTO volunteers(name) VALUES(?)', [name], function(err) {
    if (err) return res.status(500).json({error: err.message});
    res.json({ id: this.lastID });
  });
});

app.post('/api/preferences', (req, res) => {
  const { volunteer_id, location, shift_index, preferred } = req.body;
  db.run(`REPLACE INTO preferences(volunteer_id, location, shift_index, preferred)
          VALUES(?,?,?,?)`, [volunteer_id, location, shift_index, preferred ? 1 : 0], function(err){
    if (err) return res.status(500).json({error: err.message});
    res.json({changed: this.changes});
  });
});

app.get('/api/preferences/:volunteer_id', (req, res) => {
  const id = req.params.volunteer_id;
  db.all('SELECT * FROM preferences WHERE volunteer_id=?', [id], (err, rows) => {
    if (err) return res.status(500).json({error: err.message});
    res.json(rows);
  });
});

app.post('/api/assign', (req, res) => {
  const { volunteer_id, location, date, shift_index, start_time, end_time } = req.body;
  const { start, end } = weekRange(date);
  db.get(`SELECT * FROM shifts WHERE volunteer_id=? AND date BETWEEN ? AND ?`, [volunteer_id, start, end], (err, row) => {
    if (err) return res.status(500).json({error: err.message});
    if (row) return res.status(400).json({error: 'El voluntario ya tiene un turno esta semana'});

    db.run(`INSERT OR REPLACE INTO shifts(location, date, shift_index, start_time, end_time, volunteer_id)
            VALUES(?,?,?,?,?,?)`, [location, date, shift_index, start_time, end_time, volunteer_id], function(err){
      if (err) return res.status(500).json({error: err.message});
      res.json({assigned: true});
    });
  });
});

app.get('/api/shifts', (req, res) => {
  const { location, start, end } = req.query;
  db.all(`SELECT * FROM shifts WHERE location=? AND date BETWEEN ? AND ?`, [location, start, end], (err, rows) => {
    if (err) return res.status(500).json({error: err.message});
    res.json(rows);
  });
});

app.get('/api/preferred_volunteers', (req, res) => {
  const { location, shift_index } = req.query;
  db.all(`SELECT v.* FROM volunteers v JOIN preferences p ON v.id=p.volunteer_id
          WHERE p.location=? AND p.shift_index=? AND p.preferred=1`, [location, shift_index], (err, rows) => {
    if (err) return res.status(500).json({error: err.message});
    res.json(rows);
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Server running on port', PORT);
});

