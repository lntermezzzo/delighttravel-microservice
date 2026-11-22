const express = require('express');
const db = require('../db');
const { optionalAuth } = require('../middleware/auth');

const router = express.Router();

function haversineKm(lat1, lng1, lat2, lng2) {
  if ([lat1, lng1, lat2, lng2].some((v) => v === null || v === undefined || Number.isNaN(v))) {
    return null;
  }
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

// GET /recommendations?lat=&lng=&categories=a,b   (login opsional)
// Kalau login & sudah pernah simpan minat (POST /auth/interests), minat itu dipakai otomatis.
// Kalau belum login / belum ada minat tersimpan, bisa override lewat ?categories=
router.get('/', optionalAuth, (req, res) => {
  const { lat, lng, categories } = req.query;
  const userLat = lat ? parseFloat(lat) : null;
  const userLng = lng ? parseFloat(lng) : null;

  let interestSet = null;
  if (categories) {
    interestSet = categories.split(',').map((s) => s.trim()).filter(Boolean);
  } else if (req.user) {
    const rows = db.prepare('SELECT category FROM user_interests WHERE user_id = ?').all(req.user.sub);
    if (rows.length) interestSet = rows.map((r) => r.category);
  }

  const rows = db.prepare('SELECT * FROM destinations').all();

  const scored = rows.map((d) => {
    let score = 0;
    const reasons = [];

    if (interestSet && interestSet.includes(d.category)) {
      score += 50;
      reasons.push(`Sesuai kategori minat: ${d.category}`);
    }

    const dist = haversineKm(userLat, userLng, d.lat, d.lng);
    if (dist !== null) {
      const proximityScore = Math.max(0, 30 - dist);
      score += proximityScore;
      reasons.push(`Jarak ${dist.toFixed(1)} km dari lokasi kamu`);
    }

    if (reasons.length === 0) reasons.push('Rekomendasi umum (belum ada minat/lokasi)');

    return { ...d, score: Math.round(score * 10) / 10, reasons };
  });

  scored.sort((a, b) => b.score - a.score);
  res.json({ items: scored.slice(0, 20) });
});

module.exports = router;
