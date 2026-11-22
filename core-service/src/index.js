require('dotenv').config();
const express = require('express');
const cors = require('cors');

const db = require('./db');
const authRoutes = require('./routes/auth');
const destinationRoutes = require('./routes/destinations');
const recommendationRoutes = require('./routes/recommendations');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'delighttravel-core' }));

app.use('/auth', authRoutes);
app.use('/destinations', destinationRoutes);
app.use('/recommendations', recommendationRoutes);

app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

// Seed data contoh kalau tabel destinations masih kosong
const count = db.prepare('SELECT COUNT(*) AS c FROM destinations').get().c;
if (count === 0) {
  const seed = db.prepare(
    `INSERT INTO destinations (title, category, description, lat, lng, city, open_hours, image_url)
     VALUES (?,?,?,?,?,?,?,?)`
  );
  seed.run('Festival Kuliner Braga', 'kuliner', 'Festival kuliner tahunan di kawasan Braga', -6.9175, 107.6191, 'Bandung', '16:00-22:00', '');
  seed.run('Museum Geologi', 'budaya', 'Museum sejarah geologi Indonesia', -6.9023, 107.6186, 'Bandung', '09:00-15:00', '');
  seed.run('Taman Hutan Raya Djuanda', 'alam', 'Taman hutan kota dengan jalur trekking', -6.8529, 107.6267, 'Bandung', '07:00-17:00', '');
  console.log('Seed data destinasi contoh berhasil ditambahkan');
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`core-service listening on :${PORT}`));
