const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { signToken } = require('../middleware/auth');

const router = express.Router();

// POST /auth/register
router.post('/register', (req, res) => {
  const { email, password, name } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'email dan password wajib diisi' });
  }
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(409).json({ error: 'Email sudah terdaftar' });

  const hash = bcrypt.hashSync(password, 10);
  const info = db
    .prepare('INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)')
    .run(email, hash, name || '');
  const user = { id: info.lastInsertRowid, email, name: name || '' };
  res.status(201).json({ user, token: signToken(user) });
});

// POST /auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password || '', user.password_hash)) {
    return res.status(401).json({ error: 'Email atau password salah' });
  }
  res.json({
    user: { id: user.id, email: user.email, name: user.name },
    token: signToken(user),
  });
});

// POST /auth/interests  (perlu login) - simpan minat kategori user buat rekomendasi
router.post('/interests', (req, res, next) => {
  const { requireAuth } = require('../middleware/auth');
  requireAuth(req, res, next);
}, (req, res) => {
  const { categories } = req.body || {};
  if (!Array.isArray(categories)) {
    return res.status(400).json({ error: 'categories harus array string' });
  }
  const userId = req.user.sub;
  const del = db.prepare('DELETE FROM user_interests WHERE user_id = ?');
  const ins = db.prepare('INSERT OR IGNORE INTO user_interests (user_id, category) VALUES (?, ?)');
  const tx = db.transaction((cats) => {
    del.run(userId);
    for (const c of cats) ins.run(userId, c);
  });
  tx(categories);
  res.json({ ok: true, categories });
});

module.exports = router;
