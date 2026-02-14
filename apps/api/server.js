const express = require('express');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const mysql = require('mysql2/promise');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// mysql pool
const DB_HOST = process.env.DB_HOST || '127.0.0.1';
const DB_PORT = process.env.DB_PORT || 3306;
const DB_USER = process.env.DB_USER || 'root';
const DB_PASS = process.env.DB_PASS || '';
const DB_NAME = process.env.DB_NAME || 'yisu_db';

let pool;
// helper: format Date to MySQL DATETIME `YYYY-MM-DD HH:MM:SS`
function formatDateForMySQL(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

function safeJsonParse(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  try {
    return typeof value === 'string' ? JSON.parse(value) : value;
  } catch (e) {
    return fallback;
  }
}

function normalizeTextList(value) {
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  if (typeof value === 'string') {
    const parsed = safeJsonParse(value, null);
    if (Array.isArray(parsed)) return parsed.filter(Boolean).map(String);
    return value.split(',').map(s => s.trim()).filter(Boolean);
  }
  return [];
}

function deriveRating(star) {
  const raw = String(star || '').replace(/[^\d.]/g, '');
  const num = Number(raw);
  if (Number.isFinite(num) && num > 0) {
    return Math.min(5, Math.max(1, num));
  }
  return 4.5;
}

function inferBedType(type) {
  const t = String(type || '').toLowerCase();
  if (t.includes('king') || t.includes('大床')) return 'King';
  if (t.includes('twin') || t.includes('双床')) return 'Twin';
  if (t.includes('queen')) return 'Queen';
  return 'Queen';
}

function buildMobileImages(coverImage) {
  const fallback = 'https://images.unsplash.com/photo-1501117716987-c8e1ecb2105f?auto=format&fit=crop&w=1400&q=80';
  const base = coverImage || fallback;
  return [base];
}

function buildMobileTags(roomTypes, discounts) {
  const list = [...normalizeTextList(roomTypes), ...normalizeTextList(discounts)];
  const unique = [...new Set(list.filter(Boolean))];
  return unique.length ? unique.slice(0, 5) : ['Popular', 'Business'];
}

function buildMobileFacilities(scenicSpots, trafficMall) {
  const list = [...normalizeTextList(scenicSpots), ...normalizeTextList(trafficMall)];
  const unique = [...new Set(list.filter(Boolean))];
  return unique.length ? unique.slice(0, 6) : ['Wifi', 'Parking', 'Restaurant'];
}

function resolvePriceFrom(roomRows, priceData) {
  if (Array.isArray(roomRows) && roomRows.length) {
    const prices = roomRows
      .map(r => Number(r.current || r.original || 0))
      .filter(v => Number.isFinite(v) && v > 0);
    if (prices.length) return Math.min(...prices);
  }
  const parsed = safeJsonParse(priceData, { roomPriceList: [] });
  const list = Array.isArray(parsed?.roomPriceList) ? parsed.roomPriceList : [];
  const prices = list
    .map(r => Number(r.current || r.original || 0))
    .filter(v => Number.isFinite(v) && v > 0);
  return prices.length ? Math.min(...prices) : 0;
}
async function initDbPool() {
  // ensure database exists: connect without database first
  const tmpConn = await mysql.createConnection({ host: DB_HOST, port: DB_PORT, user: DB_USER, password: DB_PASS });
  try {
    await tmpConn.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci`);
  } finally {
    await tmpConn.end();
  }

  pool = await mysql.createPool({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASS,
    database: DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    charset: 'utf8mb4'
  });
  // ensure schema executed if file exists
  const schemaPath = path.join(__dirname, 'sql', 'init_schema.sql');
  if (fs.existsSync(schemaPath)) {
    const sql = fs.readFileSync(schemaPath, 'utf8');
    // Split statements by ; and execute sequentially
    const stmts = sql.split(/;\s*\n/).map(s => s.trim()).filter(Boolean);
    for (const s of stmts) {
      try { await pool.query(s); } catch (e) { /* ignore individual errors */ }
    }
    // Ensure text columns that may hold large base64 images are LONGTEXT
    const alterStmts = [
      `ALTER TABLE hotels MODIFY COLUMN image LONGTEXT`,
      `ALTER TABLE hotels MODIFY COLUMN priceData LONGTEXT`,
      `ALTER TABLE submissions MODIFY COLUMN image LONGTEXT`,
      `ALTER TABLE submissions MODIFY COLUMN priceData LONGTEXT`,
      `ALTER TABLE rooms MODIFY COLUMN image LONGTEXT`
    ];
    for (const a of alterStmts) {
      try {
        await pool.query(a);
        console.log('Executed:', a);
      } catch (e) {
        // ignore if column/table doesn't exist or already correct
      }
    }
  }
}

// ensure data dir for uploads
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// serve static frontend files from workspace root
app.use('/', express.static(path.join(__dirname)));

// multer for image upload (if frontend later posts images)
const upload = multer({ dest: path.join(dataDir, 'uploads/') });

// -------------------- Hotels API --------------------
app.get('/api/hotels', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM hotels');
    const parsed = rows.map(r => ({
      ...r,
      roomTypes: r.roomTypes ? JSON.parse(r.roomTypes) : [],
      scenicSpots: r.scenicSpots ? JSON.parse(r.scenicSpots) : [],
      trafficMall: r.trafficMall ? JSON.parse(r.trafficMall) : [],
      discounts: r.discounts ? JSON.parse(r.discounts) : [],
      priceData: r.priceData ? JSON.parse(r.priceData) : { roomPriceList: [] }
    }));
    res.json({ code:200, data: parsed });
  } catch (e) { res.status(500).json({ code:500, msg: e.message }); }
});

app.get('/api/hotels/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const [rows] = await pool.query('SELECT * FROM hotels WHERE id = ?', [id]);
    const row = rows[0];
    if (!row) return res.status(404).json({ code:404, msg: 'not found' });
    const parsed = { ...row, roomTypes: row.roomTypes ? JSON.parse(row.roomTypes) : [], scenicSpots: row.scenicSpots ? JSON.parse(row.scenicSpots) : [], trafficMall: row.trafficMall ? JSON.parse(row.trafficMall) : [], discounts: row.discounts ? JSON.parse(row.discounts) : [], priceData: row.priceData ? JSON.parse(row.priceData) : { roomPriceList: [] } };
    res.json({ code:200, data: parsed });
  } catch (e) { res.status(500).json({ code:500, msg: e.message }); }
});

app.post('/api/hotels', async (req, res) => {
  const payload = req.body || {};
  // normalize list fields: accept comma-separated strings from frontend
  function normalizeList(v) {
    if (!v && v !== 0) return [];
    if (Array.isArray(v)) return v;
    if (typeof v === 'string') return v.split(',').map(s => s.trim()).filter(Boolean);
    return [];
  }
  const roomTypesVal = normalizeList(payload.roomTypes);
  const scenicSpotsVal = normalizeList(payload.scenicSpots);
  const trafficMallVal = normalizeList(payload.trafficMall);
  const discountsVal = normalizeList(payload.discounts);
  const now = formatDateForMySQL();
  try {
    console.log('/api/hotels POST payload:', JSON.stringify(payload).slice(0,2000));
    const [result] = await pool.query('INSERT INTO hotels (name,nameEn,star,openTime,address,priceRange,totalRooms,roomTypes,scenicSpots,trafficMall,discounts,image,priceData,createdBy,createdAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [payload.name||'', payload.nameEn||'', payload.star||'', payload.openTime||'', payload.address||'', payload.priceRange||'', payload.totalRooms||0, JSON.stringify(roomTypesVal), JSON.stringify(scenicSpotsVal), JSON.stringify(trafficMallVal), JSON.stringify(discountsVal), payload.image||'', JSON.stringify(payload.priceData||{roomPriceList:[]}), payload.createdBy||'user', now]);
    console.log('/api/hotels inserted id:', result && result.insertId);
    const insertId = result.insertId;
    const [rows] = await pool.query('SELECT * FROM hotels WHERE id = ?', [insertId]);
    const row = rows[0] || null;
    if (row) {
      const parsed = {
        ...row,
        roomTypes: row.roomTypes ? JSON.parse(row.roomTypes) : [],
        scenicSpots: row.scenicSpots ? JSON.parse(row.scenicSpots) : [],
        trafficMall: row.trafficMall ? JSON.parse(row.trafficMall) : [],
        discounts: row.discounts ? JSON.parse(row.discounts) : [],
        priceData: row.priceData ? JSON.parse(row.priceData) : { roomPriceList: [] }
      };
      res.json({ code:200, data: parsed });
    } else {
      res.json({ code:500, msg: 'failed to fetch created hotel' });
    }
  } catch (e) { res.status(500).json({ code:500, msg: e.message }); }
});

app.put('/api/hotels/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  const p = req.body || {};
  function normalizeList(v) {
    if (!v && v !== 0) return [];
    if (Array.isArray(v)) return v;
    if (typeof v === 'string') return v.split(',').map(s => s.trim()).filter(Boolean);
    return [];
  }
  const roomTypesVal = normalizeList(p.roomTypes);
  const scenicSpotsVal = normalizeList(p.scenicSpots);
  const trafficMallVal = normalizeList(p.trafficMall);
  const discountsVal = normalizeList(p.discounts);
  try {
    console.log(`/api/hotels/${id} PUT payload:`, JSON.stringify(p).slice(0,2000));
    await pool.query('UPDATE hotels SET name=?,nameEn=?,star=?,openTime=?,address=?,priceRange=?,totalRooms=?,roomTypes=?,scenicSpots=?,trafficMall=?,discounts=?,image=?,priceData=? WHERE id=?', [p.name||'', p.nameEn||'', p.star||'', p.openTime||'', p.address||'', p.priceRange||'', p.totalRooms||0, JSON.stringify(roomTypesVal), JSON.stringify(scenicSpotsVal), JSON.stringify(trafficMallVal), JSON.stringify(discountsVal), p.image||'', JSON.stringify(p.priceData||{roomPriceList:[]}), id]);
    console.log(`/api/hotels/${id} updated`);
    const [rows] = await pool.query('SELECT * FROM hotels WHERE id = ?', [id]);
    const row = rows[0] || null;
    if (row) {
      const parsed = {
        ...row,
        roomTypes: row.roomTypes ? JSON.parse(row.roomTypes) : [],
        scenicSpots: row.scenicSpots ? JSON.parse(row.scenicSpots) : [],
        trafficMall: row.trafficMall ? JSON.parse(row.trafficMall) : [],
        discounts: row.discounts ? JSON.parse(row.discounts) : [],
        priceData: row.priceData ? JSON.parse(row.priceData) : { roomPriceList: [] }
      };
      res.json({ code:200, data: parsed });
    } else {
      res.json({ code:404, msg: 'hotel not found' });
    }
  } catch (e) { res.status(500).json({ code:500, msg: e.message }); }
});

app.delete('/api/hotels/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    await pool.query('DELETE FROM rooms WHERE hotel_id = ?', [id]);
    await pool.query('DELETE FROM orders WHERE hotel_id = ?', [id]);
    await pool.query('DELETE FROM hotels WHERE id = ?', [id]);
    res.json({ code:200, msg:'deleted' });
  } catch (e) { res.status(500).json({ code:500, msg: e.message }); }
});

// -------------------- Rooms API --------------------
app.get('/api/hotels/:id/rooms', async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const [rows] = await pool.query('SELECT * FROM rooms WHERE hotel_id = ?', [id]);
    res.json({ code:200, data: rows });
  } catch (e) { res.status(500).json({ code:500, msg: e.message }); }
});

app.post('/api/hotels/:id/rooms', async (req, res) => {
  const id = parseInt(req.params.id);
  const p = req.body || {};
  try {
    const [result] = await pool.query('INSERT INTO rooms (hotel_id,type,original,current,discount,remain,status,remark,image) VALUES (?,?,?,?,?,?,?,?,?)', [id, p.type||'', p.original||0, p.current||0, p.discount||'', p.remain||0, p.status||'available', p.remark||'', p.image||'']);
    const [rows] = await pool.query('SELECT * FROM rooms WHERE id = ?', [result.insertId]);
    res.json({ code:200, data: rows[0] });
  } catch (e) { res.status(500).json({ code:500, msg: e.message }); }
});

app.put('/api/hotels/:id/rooms/:roomId', async (req, res) => {
  const roomId = parseInt(req.params.roomId);
  const p = req.body || {};
  try {
    await pool.query('UPDATE rooms SET type=?,original=?,current=?,discount=?,remain=?,status=?,remark=?,image=? WHERE id=?', [p.type||'', p.original||0, p.current||0, p.discount||'', p.remain||0, p.status||'available', p.remark||'', p.image||'', roomId]);
    const [rows] = await pool.query('SELECT * FROM rooms WHERE id = ?', [roomId]);
    res.json({ code:200, data: rows[0] });
  } catch (e) { res.status(500).json({ code:500, msg: e.message }); }
});

app.delete('/api/hotels/:id/rooms/:roomId', async (req, res) => {
  const roomId = parseInt(req.params.roomId);
  try {
    await pool.query('DELETE FROM rooms WHERE id = ?', [roomId]);
    res.json({ code:200, msg:'deleted' });
  } catch (e) { res.status(500).json({ code:500, msg: e.message }); }
});

// -------------------- Mobile API --------------------
app.get('/api/mobile/hotels', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM hotels');
    if (!rows.length) return res.json({ code:200, data: [] });

    const ids = rows.map(r => r.id).filter(Boolean);
    let roomMinMap = {};
    if (ids.length) {
      const placeholders = ids.map(() => '?').join(',');
      const [roomMins] = await pool.query(
        `SELECT hotel_id, MIN(CASE WHEN current > 0 THEN current ELSE original END) AS minPrice FROM rooms WHERE hotel_id IN (${placeholders}) GROUP BY hotel_id`,
        ids
      );
      roomMinMap = roomMins.reduce((acc, row) => {
        acc[row.hotel_id] = row.minPrice;
        return acc;
      }, {});
    }

    const data = rows.map(r => {
      const coverImage = r.image || '';
      return {
        id: String(r.id),
        name: r.name || '',
        city: r.address ? String(r.address).split(' ')[0] : '未知',
        rating: deriveRating(r.star),
        address: r.address || '',
        coverImage: coverImage || buildMobileImages('')[0],
        images: buildMobileImages(coverImage),
        tags: buildMobileTags(r.roomTypes, r.discounts),
        facilities: buildMobileFacilities(r.scenicSpots, r.trafficMall),
        priceFrom: Number(roomMinMap[r.id] || resolvePriceFrom([], r.priceData) || 0),
        rooms: []
      };
    });

    res.json({ code:200, data });
  } catch (e) { res.status(500).json({ code:500, msg: e.message }); }
});

app.get('/api/mobile/hotels/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const [rows] = await pool.query('SELECT * FROM hotels WHERE id = ?', [id]);
    const row = rows[0];
    if (!row) return res.status(404).json({ code:404, msg:'not found' });

    const [roomRows] = await pool.query('SELECT * FROM rooms WHERE hotel_id = ?', [id]);
    const rooms = roomRows.map(r => ({
      id: String(r.id),
      name: r.type || 'Standard',
      price: Number(r.current || r.original || 0),
      capacity: 2,
      bedType: inferBedType(r.type),
      breakfastIncluded: false,
      refundable: false
    }));

    const coverImage = row.image || '';
    const data = {
      id: String(row.id),
      name: row.name || '',
      city: row.address ? String(row.address).split(' ')[0] : '未知',
      rating: deriveRating(row.star),
      address: row.address || '',
      coverImage: coverImage || buildMobileImages('')[0],
      images: buildMobileImages(coverImage),
      tags: buildMobileTags(row.roomTypes, row.discounts),
      facilities: buildMobileFacilities(row.scenicSpots, row.trafficMall),
      priceFrom: resolvePriceFrom(roomRows, row.priceData),
      rooms
    };

    res.json({ code:200, data });
  } catch (e) { res.status(500).json({ code:500, msg: e.message }); }
});

app.post('/api/mobile/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (username === 'mobile' && password === '123456') {
    const token = `mobile-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    return res.json({ code:200, data: { token, user: { username: 'mobile', name: '移动端用户' } } });
  }
  return res.status(401).json({ code:401, msg:'invalid credentials' });
});

// -------------------- Submissions (merchant) --------------------
app.get('/api/submissions', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM submissions');
    const parsed = rows.map(r => ({ ...r, priceData: r.priceData ? JSON.parse(r.priceData) : { roomPriceList: [] } }));
    res.json({ code:200, data: parsed });
  } catch (e) { res.status(500).json({ code:500, msg: e.message }); }
});

app.post('/api/submissions', async (req, res) => {
  const p = req.body || {};
  const now = formatDateForMySQL();
  try {
    const [result] = await pool.query('INSERT INTO submissions (name,nameEn,star,openTime,address,priceRange,totalRooms,roomTypes,scenicSpots,trafficMall,discounts,image,priceData,createdBy,createdAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [p.name||'', p.nameEn||'', p.star||'', p.openTime||'', p.address||'', p.priceRange||'', p.totalRooms||0, JSON.stringify(p.roomTypes||[]), JSON.stringify(p.scenicSpots||[]), JSON.stringify(p.trafficMall||[]), JSON.stringify(p.discounts||[]), p.image||'', JSON.stringify(p.priceData||{roomPriceList:[]}), p.createdBy||'user', now]);
    const [rows] = await pool.query('SELECT * FROM submissions WHERE id = ?', [result.insertId]);
    res.json({ code:200, data: rows[0] });
  } catch (e) { res.status(500).json({ code:500, msg: e.message }); }
});

app.post('/api/submissions/:id/approve', async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const [subs] = await pool.query('SELECT * FROM submissions WHERE id = ?', [id]);
    const sub = subs[0];
    if (!sub) return res.status(404).json({ code:404, msg:'submission not found' });
    const now = formatDateForMySQL();
    const [result] = await pool.query('INSERT INTO hotels (name,nameEn,star,openTime,address,priceRange,totalRooms,roomTypes,scenicSpots,trafficMall,discounts,image,priceData,createdBy,createdAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [sub.name, sub.nameEn, sub.star, sub.openTime, sub.address, sub.priceRange, sub.totalRooms, sub.roomTypes, sub.scenicSpots, sub.trafficMall, sub.discounts, sub.image, sub.priceData, sub.createdBy||'merchant', now]);
    await pool.query('DELETE FROM submissions WHERE id = ?', [id]);
    const [rows] = await pool.query('SELECT * FROM hotels WHERE id = ?', [result.insertId]);
    res.json({ code:200, data: rows[0] });
  } catch (e) { res.status(500).json({ code:500, msg: e.message }); }
});

app.post('/api/submissions/:id/reject', async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    await pool.query('DELETE FROM submissions WHERE id = ?', [id]);
    res.json({ code:200, msg:'rejected' });
  } catch (e) { res.status(500).json({ code:500, msg: e.message }); }
});

// -------------------- Orders --------------------
app.get('/api/orders/:hotelId', async (req, res) => {
  const hotelId = parseInt(req.params.hotelId);
  try {
    const [rows] = await pool.query('SELECT * FROM orders WHERE hotel_id = ?', [hotelId]);
    res.json({ code:200, data: rows });
  } catch (e) { res.status(500).json({ code:500, msg: e.message }); }
});

app.put('/api/orders/:hotelId', async (req, res) => {
  const hotelId = parseInt(req.params.hotelId);
  const list = req.body || [];
  try {
    await pool.query('DELETE FROM orders WHERE hotel_id = ?', [hotelId]);
    const now = formatDateForMySQL();
    for (const o of list) {
      await pool.query('INSERT INTO orders (hotel_id,orderNo,room,type,guest,phone,amount,status,leaveDate,payType,createdAt) VALUES (?,?,?,?,?,?,?,?,?,?,?)', [hotelId, o.orderNo||'', o.room||'', o.type||'', o.guest||'', o.phone||'', o.amount||'', o.status||'unchecked', o.leave||'', o.payType||'', now]);
    }
    res.json({ code:200, msg:'orders updated' });
  } catch (e) { res.status(500).json({ code:500, msg: e.message }); }
});

// -------------------- start server --------------------
// start server after db initialized
async function startServerWithRetry(startPort, maxAttempts = 5) {
  let port = startPort;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      await new Promise((resolve, reject) => {
        const server = app.listen(port, () => {
          console.log(`Server listening on http://localhost:${port}`);
          resolve();
        });
        server.on('error', (err) => {
          reject(err);
        });
      });
      return port;
    } catch (err) {
      if (err && err.code === 'EADDRINUSE') {
        console.warn(`Port ${port} in use, trying ${port + 1}...`);
        port = port + 1;
        continue;
      }
      console.error('Failed to start server:', err);
      throw err;
    }
  }
  throw new Error('Unable to bind server to any port');
}

initDbPool().then(async () => {
  try {
    const usedPort = await startServerWithRetry(PORT, 8);
    console.log(`Server started on port ${usedPort}`);
  } catch (err) {
    console.error('Failed to start server after retries:', err);
    process.exit(1);
  }
}).catch(err=>{
  console.error('Failed to initialize DB pool:', err);
  process.exit(1);
});
