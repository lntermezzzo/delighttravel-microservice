const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /destinations  - publik, filter opsional ?category=&city=
router.get('/', (req, res) => {
  const { category, city } = req.query;
  let sql = 'SELECT * FROM destinations WHERE 1=1';
  const params = [];
  if (category) { sql += ' AND category = ?'; params.push(category); }
  if (city) { sql += ' AND city = ?'; params.push(city); }
  sql += ' ORDER BY id DESC';
  const rows = db.prepare(sql).all(...params);
  res.json({ items: rows, total: rows.length });
});

// GET /destinations/:id - publik
router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM destinations WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Tidak ditemukan' });
  res.json(row);
});

// POST /destinations - perlu login (bonus auth)
router.post('/', requireAuth, (req, res) => {
  const { title, category, description, lat, lng, city, open_hours, image_url } = req.body || {};
  if (!title || !category) {
    return res.status(400).json({ error: 'title dan category wajib diisi' });
  }
  const info = db
    .prepare(
      `INSERT INTO destinations (title, category, description, lat, lng, city, open_hours, image_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(title, category, description || '', lat ?? null, lng ?? null, city || '', open_hours || '', image_url || '');
  res.status(201).json({ id: info.lastInsertRowid });
});

// PUT /destinations/:id - perlu login
router.put('/:id', requireAuth, (req, res) => {
  const existing = db.prepare('SELECT * FROM destinations WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Tidak ditemukan' });
  const merged = { ...existing, ...req.body };
  db.prepare(
    `UPDATE destinations SET title=?, category=?, description=?, lat=?, lng=?, city=?, open_hours=?, image_url=? WHERE id=?`
  ).run(
    merged.title,
    merged.category,
    merged.description,
    merged.lat,
    merged.lng,
    merged.city,
    merged.open_hours,
    merged.image_url,
    req.params.id
  );
  res.json({ ok: true });
});

// DELETE /destinations/:id - perlu login
router.delete('/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM destinations WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
