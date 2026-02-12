const express = require('express');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const mysql = require('mysql2/promise');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

const DB_HOST = process.env.DB_HOST || '127.0.0.1';
const DB_PORT = process.env.DB_PORT || 3306;
const DB_USER = process.env.DB_USER || 'root';
const DB_PASS = process.env.DB_PASS || '';
const DB_NAME = process.env.DB_NAME || 'yisu_db';

let pool;

function formatDateForMySQL(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

function formatDateOnly(d = new Date()) {
  return formatDateForMySQL(d).slice(0, 10);
}

function safeJsonParse(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  try {
    return typeof value === 'string' ? JSON.parse(value) : value;
  } catch {
    return fallback;
  }
}

function normalizeTextList(value) {
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  if (typeof value === 'string') {
    const parsed = safeJsonParse(value, null);
    if (Array.isArray(parsed)) return parsed.filter(Boolean).map(String);
    return value
      .split(/[;,，；\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function parseRating(starText) {
  const raw = String(starText || '').replace(/[^\d.]/g, '');
  const num = Number(raw);
  if (!Number.isFinite(num) || num <= 0) return 4.5;
  return Math.min(5, Math.max(1, num));
}

function ratingToStarText(rating) {
  const n = Math.round(normalizeNumber(rating, 4.5));
  return `${'⭐'.repeat(Math.max(1, Math.min(5, n)))} ${n}星级`;
}

function toDateString(value) {
  if (!value) return formatDateOnly();
  const s = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : formatDateOnly();
}

function inferBedType(type) {
  const t = String(type || '').toLowerCase();
  if (t.includes('king') || t.includes('大床')) return 'King';
  if (t.includes('twin') || t.includes('双床')) return 'Twin';
  if (t.includes('queen')) return 'Queen';
  return 'Queen';
}

function stringFromJsonListOrText(value) {
  const list = normalizeTextList(value);
  if (list.length) return list.join(',');
  return String(value || '');
}

function parseAddressAddressOnly(address) {
  return String(address || '').trim();
}

function rowRoomStatusToLegacy(status, availableCount) {
  if (Number(status) === 1 || Number(availableCount) <= 0) return 'soldout';
  if (Number(availableCount) <= 3) return 'low';
  return 'available';
}

function legacyStatusToRoomStatus(status, remain) {
  const s = String(status || '').toLowerCase();
  if (s === 'soldout') return 1;
  if (Number(remain) <= 0) return 1;
  return 0;
}

function derivePriceRangeFromRooms(roomList) {
  if (!Array.isArray(roomList) || !roomList.length) return '';
  const prices = roomList
    .map((r) => normalizeNumber(r.price, 0))
    .filter((p) => p > 0)
    .sort((a, b) => a - b);
  if (!prices.length) return '';
  const min = prices[0];
  const max = prices[prices.length - 1];
  return min === max ? `${min}元/晚` : `${min}元 - ${max}元/晚`;
}

function buildLegacyRoom(room, imageUrl) {
  const current = normalizeNumber(room.price, 0);
  const remain = normalizeNumber(room.available_count, 0);
  return {
    id: room.id,
    hotel_id: room.hotel_id,
    type: room.name,
    original: current,
    current,
    discount: '',
    remain,
    status: rowRoomStatusToLegacy(room.status, remain),
    remark: room.description || '',
    image: imageUrl || '',
    occupancy: normalizeNumber(room.occupancy, 2),
    size: room.size,
    amenities: safeJsonParse(room.amenities, []),
    createdAt: room.created_time,
    updatedAt: room.updated_time,
  };
}

function buildLegacyHotel(base, audit, roomList, imageList) {
  const scenicSpots = safeJsonParse(base.nearby_attractions, []);
  const trafficMall = normalizeTextList(base.transportation_info);
  const discounts = normalizeTextList(base.discount_info);
  const roomTypes = [...new Set((roomList || []).map((r) => r.name).filter(Boolean))];
  const priceRange = derivePriceRangeFromRooms(roomList);
  const totalRooms = (roomList || []).reduce((sum, r) => sum + normalizeNumber(r.available_count, 0), 0);
  const coverImage = (imageList || [])[0] || '';

  return {
    id: base.id,
    name: base.name_cn || '',
    nameEn: base.name_en || '',
    star: ratingToStarText(base.star_rating),
    openTime: base.opening_date,
    address: base.address || '',
    priceRange,
    totalRooms,
    roomTypes,
    scenicSpots: Array.isArray(scenicSpots) ? scenicSpots : [],
    trafficMall,
    discounts,
    image: coverImage,
    images: imageList || [],
    priceData: {
      roomPriceList: (roomList || []).map((r) => ({
        type: r.name,
        original: normalizeNumber(r.price, 0),
        current: normalizeNumber(r.price, 0),
        remain: normalizeNumber(r.available_count, 0),
      })),
    },
    createdBy: base.created_by || 'merchant',
    createdAt: base.created_time,
    updatedAt: base.updated_time,
    status: audit ? Number(audit.status) : 0,
    audit_status: audit ? Number(audit.audit_status) : 0,
    online_status: audit ? Number(audit.online_status) : 0,
    audit_reason: audit?.audit_reason || '',
    auditor_id: audit?.auditor_id || '',
    audit_time: audit?.audit_time || null,
  };
}

function toMobileHotel(base, roomList, imageList) {
  const prices = (roomList || []).map((r) => normalizeNumber(r.price, 0)).filter((p) => p > 0);
  const priceFrom = prices.length ? Math.min(...prices) : 0;

  return {
    id: String(base.id),
    name: base.name_cn || '',
    city: base.city || (base.address ? String(base.address).slice(0, 4) : '未知'),
    rating: normalizeNumber(base.star_rating, 4.5),
    address: base.address || '',
    coverImage: (imageList || [])[0] || '',
    images: imageList || [],
    tags: [...new Set((roomList || []).map((r) => r.name).filter(Boolean))].slice(0, 5),
    facilities: normalizeTextList(base.discount_info).slice(0, 6),
    priceFrom,
    rooms: (roomList || [])
      .map((r) => ({
        id: String(r.id),
        name: r.name,
        price: normalizeNumber(r.price, 0),
        capacity: normalizeNumber(r.occupancy, 2),
        bedType: inferBedType(r.name),
        breakfastIncluded: String(r.description || '').includes('早餐'),
        refundable: true,
      }))
      .sort((a, b) => a.price - b.price),
  };
}

function normalizeHotelPayload(payload) {
  const roomTypes = normalizeTextList(payload.roomTypes);
  const scenicSpots = normalizeTextList(payload.scenicSpots);
  const trafficMall = normalizeTextList(payload.trafficMall);
  const discounts = normalizeTextList(payload.discounts);

  return {
    name_cn: String(payload.name || payload.name_cn || '').trim(),
    name_en: String(payload.nameEn || payload.name_en || '').trim(),
    address: parseAddressAddressOnly(payload.address),
    star_rating: parseRating(payload.star || payload.star_rating),
    opening_date: toDateString(payload.openTime || payload.opening_date),
    nearby_attractions: JSON.stringify(scenicSpots),
    transportation_info: trafficMall.join(','),
    discount_info: discounts.join(','),
    created_by: payload.createdBy || payload.created_by || 'merchant',
    image: String(payload.image || '').trim(),
    roomTypes,
  };
}

async function initDbPool() {
  const tmpConn = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASS,
  });
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
    charset: 'utf8mb4',
  });

  const schemaPath = path.join(__dirname, 'sql', 'init_schema.sql');
  if (fs.existsSync(schemaPath)) {
    const sql = fs.readFileSync(schemaPath, 'utf8');
    const stmts = sql
      .split(/;\s*\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    for (const s of stmts) {
      try {
        await pool.query(s);
      } catch {
        // ignore individual migration errors to keep boot tolerant
      }
    }
  }
}

async function getHotelsWithRelations({
  where = 'hb.is_deleted = 0',
  params = [],
  includeAudit = true,
}) {
  const selectAudit = includeAudit
    ? ', ha.audit_status, ha.online_status, ha.status, ha.audit_reason, ha.auditor_id, ha.audit_time'
    : '';
  const joinAudit = includeAudit
    ? 'LEFT JOIN hotel_audit ha ON ha.hotel_id = hb.id'
    : '';

  const [baseRows] = await pool.query(
    `SELECT hb.* ${selectAudit}
     FROM hotel_base hb
     ${joinAudit}
     WHERE ${where}
     ORDER BY hb.created_time DESC`,
    params
  );

  if (!baseRows.length) return [];

  const hotelIds = baseRows.map((h) => h.id);
  const placeholders = hotelIds.map(() => '?').join(',');

  const [roomRows] = await pool.query(
    `SELECT * FROM room WHERE hotel_id IN (${placeholders}) ORDER BY hotel_id, price ASC`,
    hotelIds
  );

  const [imageRows] = await pool.query(
    `SELECT * FROM image_storage WHERE related_type IN ('hotel', 'room') AND related_id IN (${placeholders}) ORDER BY sort ASC, id ASC`,
    hotelIds
  );

  const roomIds = roomRows.map((r) => r.id);
  let roomImageRows = [];
  if (roomIds.length) {
    const roomPlaceholders = roomIds.map(() => '?').join(',');
    const [rows] = await pool.query(
      `SELECT * FROM image_storage WHERE related_type = 'room' AND related_id IN (${roomPlaceholders}) ORDER BY sort ASC, id ASC`,
      roomIds
    );
    roomImageRows = rows;
  }

  const roomImageMap = roomImageRows.reduce((acc, row) => {
    if (!acc[row.related_id]) acc[row.related_id] = [];
    acc[row.related_id].push(row.image_url);
    return acc;
  }, {});

  const roomsMap = roomRows.reduce((acc, row) => {
    if (!acc[row.hotel_id]) acc[row.hotel_id] = [];
    acc[row.hotel_id].push(row);
    return acc;
  }, {});

  const hotelImageMap = imageRows
    .filter((r) => r.related_type === 'hotel')
    .reduce((acc, row) => {
      if (!acc[row.related_id]) acc[row.related_id] = [];
      acc[row.related_id].push(row.image_url);
      return acc;
    }, {});

  return baseRows.map((row) => {
    const roomList = roomsMap[row.id] || [];
    const roomWithImage = roomList.map((room) => ({
      ...room,
      _image: (roomImageMap[room.id] || [])[0] || '',
    }));

    return {
      base: row,
      audit: includeAudit
        ? {
            audit_status: row.audit_status,
            online_status: row.online_status,
            status: row.status,
            audit_reason: row.audit_reason,
            auditor_id: row.auditor_id,
            audit_time: row.audit_time,
          }
        : null,
      rooms: roomWithImage,
      images: hotelImageMap[row.id] || [],
    };
  });
}

async function createHotelWithAudit(payload, auditInit, conn = pool) {
  const normalized = normalizeHotelPayload(payload);
  const [result] = await conn.query(
    `INSERT INTO hotel_base (
      name_cn, name_en, province, city, county, address, star_rating, opening_date,
      nearby_attractions, transportation_info, discount_info, created_by, created_time
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      normalized.name_cn,
      normalized.name_en,
      '',
      '',
      '',
      normalized.address,
      normalized.star_rating,
      normalized.opening_date,
      normalized.nearby_attractions,
      normalized.transportation_info,
      normalized.discount_info,
      normalized.created_by,
      formatDateForMySQL(),
    ]
  );
  const hotelId = result.insertId;

  await conn.query(
    `INSERT INTO hotel_audit (hotel_id, audit_status, online_status, status, audit_reason, auditor_id, audit_time)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      hotelId,
      auditInit.audit_status,
      auditInit.online_status,
      auditInit.status,
      auditInit.audit_reason || null,
      auditInit.auditor_id || null,
      auditInit.audit_time || null,
    ]
  );

  if (normalized.image) {
    await conn.query(
      `INSERT INTO image_storage (related_type, related_id, image_url, sort) VALUES ('hotel', ?, ?, 0)`,
      [hotelId, normalized.image]
    );
  }

  return hotelId;
}

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/', express.static(path.join(__dirname)));

const upload = multer({ dest: path.join(dataDir, 'uploads/') });
void upload;

app.get('/api/hotels', async (req, res) => {
  try {
    const rows = await getHotelsWithRelations({
      where: 'hb.is_deleted = 0 AND ha.audit_status = 1',
    });

    const data = rows.map((item) => buildLegacyHotel(item.base, item.audit, item.rooms, item.images));
    res.json({ code: 200, data });
  } catch (e) {
    res.status(500).json({ code: 500, msg: e.message });
  }
});

app.get('/api/hotels/:id', async (req, res) => {
  const id = Number(req.params.id);
  try {
    const rows = await getHotelsWithRelations({
      where: 'hb.id = ? AND hb.is_deleted = 0',
      params: [id],
    });
    const row = rows[0];
    if (!row) return res.status(404).json({ code: 404, msg: 'not found' });

    const data = buildLegacyHotel(row.base, row.audit, row.rooms, row.images);
    res.json({ code: 200, data });
  } catch (e) {
    res.status(500).json({ code: 500, msg: e.message });
  }
});

app.post('/api/hotels', async (req, res) => {
  const payload = req.body || {};
  try {
    const hotelId = await createHotelWithAudit(payload, {
      audit_status: 1,
      online_status: 1,
      status: 1,
      audit_time: formatDateForMySQL(),
    });

    const rows = await getHotelsWithRelations({
      where: 'hb.id = ? AND hb.is_deleted = 0',
      params: [hotelId],
    });

    res.json({ code: 200, data: buildLegacyHotel(rows[0].base, rows[0].audit, rows[0].rooms, rows[0].images) });
  } catch (e) {
    res.status(500).json({ code: 500, msg: e.message });
  }
});

app.put('/api/hotels/:id', async (req, res) => {
  const id = Number(req.params.id);
  const payload = req.body || {};
  const normalized = normalizeHotelPayload(payload);

  try {
    await pool.query(
      `UPDATE hotel_base
       SET name_cn = ?, name_en = ?, address = ?, star_rating = ?, opening_date = ?,
           nearby_attractions = ?, transportation_info = ?, discount_info = ?, updated_time = NOW()
       WHERE id = ?`,
      [
        normalized.name_cn,
        normalized.name_en,
        normalized.address,
        normalized.star_rating,
        normalized.opening_date,
        normalized.nearby_attractions,
        normalized.transportation_info,
        normalized.discount_info,
        id,
      ]
    );

    if (normalized.image) {
      await pool.query('DELETE FROM image_storage WHERE related_type = ? AND related_id = ? AND sort = 0', ['hotel', id]);
      await pool.query(
        `INSERT INTO image_storage (related_type, related_id, image_url, sort) VALUES ('hotel', ?, ?, 0)`,
        [id, normalized.image]
      );
    }

    const rows = await getHotelsWithRelations({
      where: 'hb.id = ? AND hb.is_deleted = 0',
      params: [id],
    });
    const row = rows[0];
    if (!row) return res.status(404).json({ code: 404, msg: 'hotel not found' });

    res.json({ code: 200, data: buildLegacyHotel(row.base, row.audit, row.rooms, row.images) });
  } catch (e) {
    res.status(500).json({ code: 500, msg: e.message });
  }
});

app.delete('/api/hotels/:id', async (req, res) => {
  const id = Number(req.params.id);
  try {
    await pool.query('UPDATE hotel_base SET is_deleted = 1, updated_time = NOW() WHERE id = ?', [id]);
    await pool.query('UPDATE hotel_audit SET online_status = 0, status = 2, updated_time = NOW() WHERE hotel_id = ?', [id]);
    res.json({ code: 200, msg: 'offline success' });
  } catch (e) {
    res.status(500).json({ code: 500, msg: e.message });
  }
});

app.post('/api/hotels/:id/restore', async (req, res) => {
  const id = Number(req.params.id);
  try {
    await pool.query('UPDATE hotel_base SET is_deleted = 0, updated_time = NOW() WHERE id = ?', [id]);
    await pool.query('UPDATE hotel_audit SET online_status = 1, status = 1, updated_time = NOW() WHERE hotel_id = ?', [id]);
    res.json({ code: 200, msg: 'restored' });
  } catch (e) {
    res.status(500).json({ code: 500, msg: e.message });
  }
});

app.get('/api/hotels/:id/rooms', async (req, res) => {
  const id = Number(req.params.id);
  try {
    const [rows] = await pool.query('SELECT * FROM room WHERE hotel_id = ? ORDER BY price ASC', [id]);
    const roomIds = rows.map((r) => r.id);
    let imageRows = [];
    if (roomIds.length) {
      const placeholders = roomIds.map(() => '?').join(',');
      const [tmp] = await pool.query(
        `SELECT * FROM image_storage WHERE related_type = 'room' AND related_id IN (${placeholders}) ORDER BY sort ASC, id ASC`,
        roomIds
      );
      imageRows = tmp;
    }

    const imageMap = imageRows.reduce((acc, r) => {
      if (!acc[r.related_id]) acc[r.related_id] = [];
      acc[r.related_id].push(r.image_url);
      return acc;
    }, {});

    const data = rows.map((r) => buildLegacyRoom(r, (imageMap[r.id] || [])[0] || ''));
    res.json({ code: 200, data });
  } catch (e) {
    res.status(500).json({ code: 500, msg: e.message });
  }
});

app.post('/api/hotels/:id/rooms', async (req, res) => {
  const id = Number(req.params.id);
  const p = req.body || {};
  const price = normalizeNumber(p.current ?? p.price, 0);
  const remain = normalizeNumber(p.remain ?? p.available_count, 0);

  try {
    const [result] = await pool.query(
      `INSERT INTO room (hotel_id, name, description, price, available_count, occupancy, size, amenities, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        p.type || p.name || '标准房',
        p.remark || p.description || '',
        price,
        remain,
        normalizeNumber(p.occupancy, 2),
        p.size ? normalizeNumber(p.size, null) : null,
        JSON.stringify(normalizeTextList(p.amenities || [])),
        legacyStatusToRoomStatus(p.status, remain),
      ]
    );

    if (p.image) {
      await pool.query(
        `INSERT INTO image_storage (related_type, related_id, image_url, sort) VALUES ('room', ?, ?, 0)`,
        [result.insertId, p.image]
      );
    }

    const [rows] = await pool.query('SELECT * FROM room WHERE id = ?', [result.insertId]);
    const [imageRows] = await pool.query(
      `SELECT image_url FROM image_storage WHERE related_type = 'room' AND related_id = ? ORDER BY sort ASC, id ASC LIMIT 1`,
      [result.insertId]
    );

    res.json({ code: 200, data: buildLegacyRoom(rows[0], imageRows[0]?.image_url || '') });
  } catch (e) {
    res.status(500).json({ code: 500, msg: e.message });
  }
});

app.put('/api/hotels/:id/rooms/:roomId', async (req, res) => {
  const roomId = Number(req.params.roomId);
  const p = req.body || {};
  const price = normalizeNumber(p.current ?? p.price, 0);
  const remain = normalizeNumber(p.remain ?? p.available_count, 0);

  try {
    await pool.query(
      `UPDATE room
       SET name = ?, description = ?, price = ?, available_count = ?, occupancy = ?, size = ?, amenities = ?, status = ?, updated_time = NOW()
       WHERE id = ?`,
      [
        p.type || p.name || '标准房',
        p.remark || p.description || '',
        price,
        remain,
        normalizeNumber(p.occupancy, 2),
        p.size ? normalizeNumber(p.size, null) : null,
        JSON.stringify(normalizeTextList(p.amenities || [])),
        legacyStatusToRoomStatus(p.status, remain),
        roomId,
      ]
    );

    if (p.image) {
      await pool.query('DELETE FROM image_storage WHERE related_type = ? AND related_id = ? AND sort = 0', ['room', roomId]);
      await pool.query(
        `INSERT INTO image_storage (related_type, related_id, image_url, sort) VALUES ('room', ?, ?, 0)`,
        [roomId, p.image]
      );
    }

    const [rows] = await pool.query('SELECT * FROM room WHERE id = ?', [roomId]);
    const [imageRows] = await pool.query(
      `SELECT image_url FROM image_storage WHERE related_type = 'room' AND related_id = ? ORDER BY sort ASC, id ASC LIMIT 1`,
      [roomId]
    );

    res.json({ code: 200, data: buildLegacyRoom(rows[0], imageRows[0]?.image_url || '') });
  } catch (e) {
    res.status(500).json({ code: 500, msg: e.message });
  }
});

app.put('/api/hotels/:id/rooms/bulk', async (req, res) => {
  const hotelId = Number(req.params.id);
  const rooms = Array.isArray(req.body?.rooms) ? req.body.rooms : [];

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('DELETE FROM image_storage WHERE related_type = ? AND related_id IN (SELECT id FROM room WHERE hotel_id = ?)', ['room', hotelId]);
    await conn.query('DELETE FROM room WHERE hotel_id = ?', [hotelId]);

    for (const item of rooms) {
      const price = normalizeNumber(item.current ?? item.price, 0);
      const remain = normalizeNumber(item.remain ?? item.available_count, 0);
      const [r] = await conn.query(
        `INSERT INTO room (hotel_id, name, description, price, available_count, occupancy, size, amenities, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          hotelId,
          item.type || item.name || '标准房',
          item.remark || item.description || '',
          price,
          remain,
          normalizeNumber(item.occupancy, 2),
          item.size ? normalizeNumber(item.size, null) : null,
          JSON.stringify(normalizeTextList(item.amenities || [])),
          legacyStatusToRoomStatus(item.status, remain),
        ]
      );
      if (item.image) {
        await conn.query(
          `INSERT INTO image_storage (related_type, related_id, image_url, sort) VALUES ('room', ?, ?, 0)`,
          [r.insertId, item.image]
        );
      }
    }

    await conn.commit();
    res.json({ code: 200, msg: 'rooms updated' });
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ code: 500, msg: e.message });
  } finally {
    conn.release();
  }
});

app.delete('/api/hotels/:id/rooms/:roomId', async (req, res) => {
  const roomId = Number(req.params.roomId);
  try {
    await pool.query('DELETE FROM image_storage WHERE related_type = ? AND related_id = ?', ['room', roomId]);
    await pool.query('DELETE FROM room WHERE id = ?', [roomId]);
    res.json({ code: 200, msg: 'deleted' });
  } catch (e) {
    res.status(500).json({ code: 500, msg: e.message });
  }
});

app.get('/api/mobile/hotels', async (req, res) => {
  try {
    const rows = await getHotelsWithRelations({
      where: 'hb.is_deleted = 0 AND ha.audit_status = 1 AND ha.online_status = 1',
    });

    const data = rows.map((item) => toMobileHotel(item.base, item.rooms, item.images));
    res.json({ code: 200, data });
  } catch (e) {
    res.status(500).json({ code: 500, msg: e.message });
  }
});

app.get('/api/mobile/hotels/:id', async (req, res) => {
  const id = Number(req.params.id);
  try {
    const rows = await getHotelsWithRelations({
      where: 'hb.id = ? AND hb.is_deleted = 0 AND ha.audit_status = 1 AND ha.online_status = 1',
      params: [id],
    });

    const row = rows[0];
    if (!row) return res.status(404).json({ code: 404, msg: 'not found' });
    res.json({ code: 200, data: toMobileHotel(row.base, row.rooms, row.images) });
  } catch (e) {
    res.status(500).json({ code: 500, msg: e.message });
  }
});

app.post('/api/mobile/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (username === 'mobile' && password === '123456') {
    const token = `mobile-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    return res.json({ code: 200, data: { token, user: { username: 'mobile', name: '移动端用户' } } });
  }
  return res.status(401).json({ code: 401, msg: 'invalid credentials' });
});

app.get('/api/submissions', async (req, res) => {
  try {
    const rows = await getHotelsWithRelations({
      where: 'hb.is_deleted = 0 AND ha.audit_status = 0',
    });

    const data = rows.map((item) => buildLegacyHotel(item.base, item.audit, item.rooms, item.images));
    res.json({ code: 200, data });
  } catch (e) {
    res.status(500).json({ code: 500, msg: e.message });
  }
});

app.post('/api/submissions', async (req, res) => {
  const payload = req.body || {};
  try {
    const hotelId = await createHotelWithAudit(payload, {
      audit_status: 0,
      online_status: 0,
      status: 0,
      audit_time: null,
    });

    const rows = await getHotelsWithRelations({
      where: 'hb.id = ?',
      params: [hotelId],
    });

    res.json({ code: 200, data: buildLegacyHotel(rows[0].base, rows[0].audit, rows[0].rooms, rows[0].images) });
  } catch (e) {
    res.status(500).json({ code: 500, msg: e.message });
  }
});

app.post('/api/submissions/:id/approve', async (req, res) => {
  const id = Number(req.params.id);
  try {
    await pool.query(
      `UPDATE hotel_audit
       SET audit_status = 1, online_status = 1, status = 1, audit_time = ?, audit_reason = NULL, updated_time = NOW()
       WHERE hotel_id = ?`,
      [formatDateForMySQL(), id]
    );

    const rows = await getHotelsWithRelations({
      where: 'hb.id = ? AND hb.is_deleted = 0',
      params: [id],
    });
    const row = rows[0];
    if (!row) return res.status(404).json({ code: 404, msg: 'submission not found' });

    res.json({ code: 200, data: buildLegacyHotel(row.base, row.audit, row.rooms, row.images) });
  } catch (e) {
    res.status(500).json({ code: 500, msg: e.message });
  }
});

app.post('/api/submissions/:id/reject', async (req, res) => {
  const id = Number(req.params.id);
  const reason = String(req.body?.reason || '').trim();
  try {
    await pool.query(
      `UPDATE hotel_audit
       SET audit_status = 2, online_status = 0, status = 3, audit_reason = ?, audit_time = ?, updated_time = NOW()
       WHERE hotel_id = ?`,
      [reason || '审核未通过', formatDateForMySQL(), id]
    );
    res.json({ code: 200, msg: 'rejected' });
  } catch (e) {
    res.status(500).json({ code: 500, msg: e.message });
  }
});

app.get('/api/orders/:hotelId', async (req, res) => {
  const hotelId = Number(req.params.hotelId);
  try {
    const [rows] = await pool.query('SELECT * FROM orders WHERE hotel_id = ? ORDER BY created_at DESC', [hotelId]);
    const data = rows.map((o) => ({
      id: o.id,
      hotel_id: o.hotel_id,
      orderNo: o.order_no,
      room: o.room,
      type: o.type,
      guest: o.guest,
      phone: o.phone,
      amount: String(o.amount),
      status: o.status,
      leaveDate: o.leave_date,
      payType: o.pay_type,
      createdAt: o.created_at,
    }));
    res.json({ code: 200, data });
  } catch (e) {
    res.status(500).json({ code: 500, msg: e.message });
  }
});

app.put('/api/orders/:hotelId', async (req, res) => {
  const hotelId = Number(req.params.hotelId);
  const list = Array.isArray(req.body) ? req.body : [];

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('DELETE FROM orders WHERE hotel_id = ?', [hotelId]);

    for (const o of list) {
      await conn.query(
        `INSERT INTO orders (hotel_id, order_no, room, type, guest, phone, amount, status, leave_date, pay_type, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          hotelId,
          o.orderNo || '',
          o.room || '',
          o.type || '',
          o.guest || '',
          o.phone || '',
          normalizeNumber(o.amount, 0),
          o.status || 'unchecked',
          toDateString(o.leave || o.leaveDate),
          o.payType || '',
          formatDateForMySQL(),
        ]
      );
    }

    await conn.commit();
    res.json({ code: 200, msg: 'orders updated' });
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ code: 500, msg: e.message });
  } finally {
    conn.release();
  }
});

async function startServerWithRetry(startPort, maxAttempts = 5) {
  let port = startPort;
  for (let i = 0; i < maxAttempts; i += 1) {
    try {
      await new Promise((resolve, reject) => {
        const server = app.listen(port, () => {
          console.log(`Server listening on http://localhost:${port}`);
          resolve();
        });
        server.on('error', (err) => reject(err));
      });
      return port;
    } catch (err) {
      if (err && err.code === 'EADDRINUSE') {
        console.warn(`Port ${port} in use, trying ${port + 1}...`);
        port += 1;
        continue;
      }
      throw err;
    }
  }
  throw new Error('Unable to bind server to any port');
}

initDbPool()
  .then(async () => {
    try {
      const usedPort = await startServerWithRetry(PORT, 8);
      console.log(`Server started on port ${usedPort}`);
    } catch (err) {
      console.error('Failed to start server after retries:', err);
      process.exit(1);
    }
  })
  .catch((err) => {
    console.error('Failed to initialize DB pool:', err);
    process.exit(1);
  });
