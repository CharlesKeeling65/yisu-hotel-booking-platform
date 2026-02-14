const crypto = require('crypto');
const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = Number(process.env.PORT || 3000);

const DB_HOST = process.env.DB_HOST || '127.0.0.1';
const DB_PORT = Number(process.env.DB_PORT || 3306);
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

function genId(prefix) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeTextList(value) {
  if (Array.isArray(value)) return value.filter(Boolean).map((x) => String(x).trim());
  if (typeof value === 'string') {
    return value
      .split(/[;,，；\n]/)
      .map((x) => x.trim())
      .filter(Boolean);
  }
  return [];
}

function toDateTime(value) {
  if (!value) return `${formatDateForMySQL().slice(0, 10)} 00:00:00`;
  const d = String(value).slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return `${d} 00:00:00`;
  return `${formatDateForMySQL().slice(0, 10)} 00:00:00`;
}

function parseIntSafe(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function parseFloatSafe(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function sha256(input) {
  return crypto.createHash('sha256').update(String(input || '')).digest('hex');
}

function hashPassword(passwordCipher) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(passwordCipher || ''), salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

function verifyPassword(passwordCipher, hashedPassword) {
  if (!hashedPassword) return false;
  if (hashedPassword.startsWith('scrypt$')) {
    const parts = hashedPassword.split('$');
    if (parts.length !== 3) return false;
    const salt = parts[1];
    const digest = parts[2];
    const target = crypto.scryptSync(String(passwordCipher || ''), salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(target, 'hex'), Buffer.from(digest, 'hex'));
  }
  return String(passwordCipher || '') === String(hashedPassword || '');
}

function strongPasswordMessage(password) {
  const pwd = String(password || '');
  const tips = [];
  if (pwd.length < 10) tips.push('至少 10 位');
  if (!/[A-Z]/.test(pwd)) tips.push('至少 1 个大写字母');
  if (!/[a-z]/.test(pwd)) tips.push('至少 1 个小写字母');
  if (!/\d/.test(pwd)) tips.push('至少 1 个数字');
  if (!/[`~!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]/.test(pwd)) tips.push('至少 1 个特殊符号');
  return tips;
}

function rolePrefix(role) {
  if (role === 'admin') return 'admin';
  if (role === 'merchant') return 'merchant';
  return 'user';
}

const TEST_USERS = [
  { id: 'admin_001', account: 'admin.ops', email: 'admin.ops@yisu.com', role: 'admin', name: '运营管理员', realName: '王运营', companyName: '易宿平台', password: 'Admin#2026!Ops' },
  { id: 'admin_002', account: 'admin.audit', email: 'admin.audit@yisu.com', role: 'admin', name: '审核管理员', realName: '李审核', companyName: '易宿平台', password: 'Admin#2026!Audit' },
  { id: 'admin_003', account: 'admin.release', email: 'admin.release@yisu.com', role: 'admin', name: '发布管理员', realName: '周发布', companyName: '易宿平台', password: 'Admin#2026!Release' },
  { id: 'merchant_001', account: 'm.shanghai', email: 'merchant.shanghai@yisu.com', role: 'merchant', name: '上海商家', realName: '张宁', companyName: '沪上旅宿集团', password: 'Merchant#2026!SH' },
  { id: 'merchant_002', account: 'm.beijing', email: 'merchant.beijing@yisu.com', role: 'merchant', name: '北京商家', realName: '陈璐', companyName: '京华酒店管理', password: 'Merchant#2026!BJ' },
  { id: 'merchant_003', account: 'm.shenzhen', email: 'merchant.shenzhen@yisu.com', role: 'merchant', name: '深圳商家', realName: '黄涛', companyName: '深湾旅业有限公司', password: 'Merchant#2026!SZ' },
  { id: 'merchant_004', account: 'm.hangzhou', email: 'merchant.hangzhou@yisu.com', role: 'merchant', name: '杭州商家', realName: '杨帆', companyName: '杭城智选酒店', password: 'Merchant#2026!HZ' },
  { id: 'merchant_005', account: 'm.chengdu', email: 'merchant.chengdu@yisu.com', role: 'merchant', name: '成都商家', realName: '何然', companyName: '蓉城酒店运营中心', password: 'Merchant#2026!CD' },
  { id: 'user_001', account: 'user.demo', email: 'user.demo@yisu.com', role: 'user', name: '示例用户', realName: '赵可', companyName: null, password: 'User#2026!Demo' },
];

async function initDbPool() {
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
        // ignore single statement errors for compatibility
      }
    }
  }

  for (const user of TEST_USERS) {
    const hashed = hashPassword(sha256(user.password));
    await pool.query(
      `INSERT INTO \`User\` (id, account, email, phone, name, real_name, company_name, role, password)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
       account = VALUES(account),
       email = VALUES(email),
       role = VALUES(role),
       name = VALUES(name),
       real_name = VALUES(real_name),
       company_name = VALUES(company_name),
       password = VALUES(password)`,
      [
        user.id,
        user.account,
        user.email,
        null,
        user.name,
        user.realName,
        user.companyName,
        user.role,
        hashed,
      ]
    );
  }

  const [hotelCountRows] = await pool.query('SELECT COUNT(*) AS c FROM `Hotel_Base`');
  const hotelCount = Number(hotelCountRows?.[0]?.c || 0);
  if (hotelCount < 20) {
    const seedPath = path.join(__dirname, 'sql', 'seed_sample.sql');
    if (fs.existsSync(seedPath)) {
      const seedSql = fs.readFileSync(seedPath, 'utf8');
      const seedStmts = seedSql
        .split(/;\s*\n/)
        .map((s) => s.trim())
        .filter(Boolean);
      for (const s of seedStmts) {
        try {
          await pool.query(s);
        } catch {
          // ignore single seed statement errors
        }
      }
    }
  }
}

async function getHotelRelations(hotelIds) {
  if (!hotelIds.length) {
    return { roomsByHotel: {}, hotelImagesByHotel: {}, roomImageByRoom: {}, labelsByHotel: {}, labelCodesByHotel: {} };
  }
  const placeholders = hotelIds.map(() => '?').join(',');

  const [rooms] = await pool.query(
    `SELECT * FROM \`Room\` WHERE hotel_id IN (${placeholders}) ORDER BY price ASC`,
    hotelIds
  );
  const roomIds = rooms.map((r) => r.id);

  const [hotelImages] = await pool.query(
    `SELECT * FROM \`Image_Storage\` WHERE related_type='hotel' AND related_id IN (${placeholders}) ORDER BY sort ASC`,
    hotelIds
  );

  let roomImages = [];
  if (roomIds.length) {
    const roomP = roomIds.map(() => '?').join(',');
    const [tmp] = await pool.query(
      `SELECT * FROM \`Image_Storage\` WHERE related_type='room' AND related_id IN (${roomP}) ORDER BY sort ASC`,
      roomIds
    );
    roomImages = tmp;
  }

  const [labels] = await pool.query(
    `SELECT rel.hotel_id, l.label_name, l.label_code
     FROM \`Hotel_Label_Rel\` rel
     JOIN \`Facility_Label\` l ON rel.label_id = l.id
     WHERE rel.hotel_id IN (${placeholders})`,
    hotelIds
  );

  const roomsByHotel = rooms.reduce((acc, r) => {
    if (!acc[r.hotel_id]) acc[r.hotel_id] = [];
    acc[r.hotel_id].push(r);
    return acc;
  }, {});

  const hotelImagesByHotel = hotelImages.reduce((acc, r) => {
    if (!acc[r.related_id]) acc[r.related_id] = [];
    acc[r.related_id].push(r.image_url);
    return acc;
  }, {});

  const roomImageByRoom = roomImages.reduce((acc, r) => {
    if (!acc[r.related_id]) acc[r.related_id] = r.image_url;
    return acc;
  }, {});

  const labelsByHotel = labels.reduce((acc, r) => {
    if (!acc[r.hotel_id]) acc[r.hotel_id] = [];
    acc[r.hotel_id].push(r.label_name);
    return acc;
  }, {});

  const labelCodesByHotel = labels.reduce((acc, r) => {
    if (!acc[r.hotel_id]) acc[r.hotel_id] = [];
    acc[r.hotel_id].push(r.label_code);
    return acc;
  }, {});

  return { roomsByHotel, hotelImagesByHotel, roomImageByRoom, labelsByHotel, labelCodesByHotel };
}

function derivePriceRange(rooms) {
  const prices = rooms
    .map((r) => Number(r.price || 0))
    .filter((x) => Number.isFinite(x) && x > 0)
    .sort((a, b) => a - b);
  if (!prices.length) return { min: 0, max: 0, text: '' };
  if (prices[0] === prices[prices.length - 1]) return { min: prices[0], max: prices[0], text: `${prices[0]}元/晚` };
  return { min: prices[0], max: prices[prices.length - 1], text: `${prices[0]}元 - ${prices[prices.length - 1]}元/晚` };
}

function toLegacyRoom(row = {}, image) {
  return {
    id: row.id,
    hotel_id: row.hotel_id,
    type: row.name,
    original: Number(row.price || 0),
    current: Number(row.price || 0),
    discount: '',
    remain: row.status === 0 ? 10 : 0,
    status: row.status === 0 ? 'available' : 'soldout',
    remark: '',
    image: image || '',
    occupancy: Number(row.occupancy || 2),
    size: row.size,
    breakfastIncluded: Number(row.breakfast_included || 0) === 1,
    refundable: Number(row.refundable || 1) === 1,
  };
}

function inferBedType(name = '') {
  const n = String(name || '').toLowerCase();
  if (/(双床|双人床|twin)/.test(n)) return '双床';
  if (/(大床|queen|king)/.test(n)) return '大床';
  if (/(家庭|family)/.test(n)) return '家庭床';
  if (/(榻榻米|tatami)/.test(n)) return '榻榻米';
  return '标准床';
}

function toHotel(base, audit, rel) {
  const rooms = rel.roomsByHotel[base.id] || [];
  const images = rel.hotelImagesByHotel[base.id] || [];
  const roomTypes = [...new Set(rooms.map((r) => r.name).filter(Boolean))];
  const scenicSpots = normalizeTextList(base.scenic_spots);
  const priceRange = derivePriceRange(rooms);

  return {
    id: base.id,
    merchantId: base.merchantId,
    name: base.name_cn,
    nameEn: base.name_en,
    province: base.province,
    city: base.city,
    county: base.county,
    address: base.address,
    fullAddress: `${base.province || ''}${base.city || ''}${base.county || ''}${base.address || ''}`,
    openTime: String(base.start_date || '').slice(0, 10),
    start_date: base.start_date,
    star: Number(base.star_level || 0),
    starLevel: Number(base.star_level || 0),
    scenicSpots,
    intro: base.intro || '',
    latitude: base.latitude,
    longitude: base.longitude,
    featuredWeight: Number(base.featured_weight || 0),
    image: images[0] || '',
    images,
    roomTypes,
    totalRooms: rooms.length,
    labels: rel.labelsByHotel[base.id] || [],
    labelCodes: rel.labelCodesByHotel[base.id] || [],
    priceRange: priceRange.text,
    priceFrom: priceRange.min,
    priceTo: priceRange.max,
    status: Number(audit?.status || 0),
    audit_status: Number(audit?.audit_status || 0),
    online_status: Number(audit?.online_status || 0),
    audit_reason: audit?.audit_reason || '',
    auditor_id: audit?.auditor_id || null,
    audit_time: audit?.audit_time || null,
    online_time: audit?.online_time || null,
    createdAt: base.created_time,
  };
}

function hasRequiredFields(payload, fields) {
  return fields.every((f) => String(payload?.[f] || '').trim().length > 0);
}

async function upsertHotelLabels(hotelId, labels, conn = pool) {
  await conn.query('DELETE FROM `Hotel_Label_Rel` WHERE hotel_id = ?', [hotelId]);
  if (!labels.length) return;
  const [rows] = await conn.query(
    `SELECT id, label_name FROM \`Facility_Label\` WHERE label_name IN (${labels.map(() => '?').join(',')})`,
    labels
  );
  for (const r of rows) {
    await conn.query(
      'INSERT INTO `Hotel_Label_Rel` (id, hotel_id, label_id) VALUES (?, ?, ?)',
      [genId('rel'), hotelId, r.id]
    );
  }
}

async function replaceHotelImages(hotelId, images, conn = pool) {
  await conn.query('DELETE FROM `Image_Storage` WHERE related_type = ? AND related_id = ?', ['hotel', hotelId]);
  for (let i = 0; i < images.length; i += 1) {
    await conn.query(
      'INSERT INTO `Image_Storage` (id, related_type, related_id, image_url, sort) VALUES (?, ?, ?, ?, ?)',
      [genId('img'), 'hotel', hotelId, images[i], i]
    );
  }
}

async function getHotelWithRelations(hotelId) {
  const [rows] = await pool.query(
    `SELECT b.*, a.audit_status, a.online_status, a.status, a.audit_reason, a.auditor_id, a.audit_time, a.online_time
     FROM \`Hotel_Base\` b
     LEFT JOIN \`Hotel_Audit\` a ON a.hotel_id = b.id
     WHERE b.id = ?`,
    [hotelId]
  );
  if (!rows[0]) return null;
  const rel = await getHotelRelations([hotelId]);
  return toHotel(rows[0], rows[0], rel);
}

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/', express.static(path.join(__dirname)));

app.get('/api/health', (_req, res) => {
  res.json({ code: 200, data: { ok: true, ts: formatDateForMySQL() } });
});

app.post('/api/auth/register', async (req, res) => {
  const p = req.body || {};
  const role = ['admin', 'merchant', 'user'].includes(p.role) ? p.role : 'user';

  if (!hasRequiredFields(p, ['account', 'email'])) {
    return res.status(400).json({ code: 400, msg: '账号与邮箱必填' });
  }

  if (role === 'merchant' && !hasRequiredFields(p, ['companyName', 'realName'])) {
    return res.status(400).json({ code: 400, msg: '商家注册需填写企业名称与联系人' });
  }

  const plainPassword = String(p.password || '');
  const strengthTips = plainPassword ? strongPasswordMessage(plainPassword) : [];
  if (plainPassword && strengthTips.length) {
    return res.status(400).json({ code: 400, msg: `密码强度不足：${strengthTips.join('、')}` });
  }

  const passwordCipher = String(p.passwordCipher || sha256(plainPassword || ''));
  if (!passwordCipher) return res.status(400).json({ code: 400, msg: '密码不能为空' });

  try {
    const [dupRows] = await pool.query(
      'SELECT id FROM `User` WHERE account = ? OR email = ? LIMIT 1',
      [String(p.account).trim(), String(p.email).trim()]
    );
    if (dupRows.length) {
      return res.status(409).json({ code: 409, msg: '账号或邮箱已存在' });
    }

    const userId = p.id || genId(rolePrefix(role));
    await pool.query(
      `INSERT INTO \`User\` (id, account, email, phone, name, real_name, company_name, role, password)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        String(p.account).trim(),
        String(p.email).trim(),
        p.phone ? String(p.phone).trim() : null,
        p.name ? String(p.name).trim() : null,
        p.realName ? String(p.realName).trim() : null,
        p.companyName ? String(p.companyName).trim() : null,
        role,
        hashPassword(passwordCipher),
      ]
    );

    const [rows] = await pool.query(
      'SELECT id, account, email, phone, name, real_name, company_name, role, createdAt FROM `User` WHERE id = ?',
      [userId]
    );
    return res.json({ code: 200, data: rows[0] });
  } catch (e) {
    return res.status(500).json({ code: 500, msg: e.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { identifier, account, passwordCipher, password } = req.body || {};
  const idValue = String(identifier || account || '').trim();
  if (!idValue) return res.status(400).json({ code: 400, msg: '请输入账号/邮箱/ID' });

  try {
    const [rows] = await pool.query(
      'SELECT id, account, email, phone, name, real_name, company_name, role, password, createdAt FROM `User` WHERE account = ? OR email = ? OR id = ? LIMIT 1',
      [idValue, idValue, idValue]
    );
    const user = rows[0];
    if (!user) return res.status(401).json({ code: 401, msg: '账号不存在或密码错误' });

    const cipher = String(passwordCipher || sha256(String(password || '')));
    if (!verifyPassword(cipher, user.password)) {
      return res.status(401).json({ code: 401, msg: '账号不存在或密码错误' });
    }

    return res.json({
      code: 200,
      data: {
        token: `token-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        user: {
          id: user.id,
          account: user.account,
          email: user.email,
          phone: user.phone,
          name: user.name,
          realName: user.real_name,
          companyName: user.company_name,
          role: user.role,
          createdAt: user.createdAt,
        },
      },
    });
  } catch (e) {
    return res.status(500).json({ code: 500, msg: e.message });
  }
});

app.get('/api/auth/test-accounts', async (_req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, account, email, role, name, real_name, company_name, createdAt FROM `User` WHERE role IN (\'admin\',\'merchant\') ORDER BY role, createdAt ASC'
    );
    res.json({ code: 200, data: rows });
  } catch (e) {
    res.status(500).json({ code: 500, msg: e.message });
  }
});

async function queryHotels(req) {
  const q = req.query || {};
  const scope = String(q.scope || 'public');

  const where = [];
  const params = [];

  if (scope === 'public') {
    where.push('a.audit_status = 1 AND a.online_status = 1');
  }

  if (scope === 'merchant') {
    const merchantId = String(q.merchantId || '').trim();
    if (merchantId) {
      where.push('b.merchantId = ?');
      params.push(merchantId);
    }
  }

  if (q.auditStatus !== undefined && q.auditStatus !== '') {
    where.push('a.audit_status = ?');
    params.push(parseIntSafe(q.auditStatus, 0));
  }
  if (q.onlineStatus !== undefined && q.onlineStatus !== '') {
    where.push('a.online_status = ?');
    params.push(parseIntSafe(q.onlineStatus, 0));
  }

  if (q.city) {
    where.push('b.city = ?');
    params.push(String(q.city));
  }

  if (q.keyword) {
    where.push(`(
      b.name_cn LIKE ?
      OR b.name_en LIKE ?
      OR b.address LIKE ?
      OR b.scenic_spots LIKE ?
      OR EXISTS (
        SELECT 1
        FROM \`Hotel_Label_Rel\` rel
        JOIN \`Facility_Label\` l ON rel.label_id = l.id
        WHERE rel.hotel_id = b.id
          AND (l.label_name LIKE ? OR l.label_code LIKE ?)
      )
    )`);
    const kw = `%${String(q.keyword).trim()}%`;
    params.push(kw, kw, kw, kw, kw, kw);
  }

  const scenicSpots = normalizeTextList(q.scenicSpots);
  if (scenicSpots.length) {
    where.push(`(${scenicSpots.map(() => 'b.scenic_spots LIKE ?').join(' OR ')})`);
    scenicSpots.forEach((spot) => params.push(`%${spot}%`));
  }

  if (q.starMin !== undefined && q.starMin !== '') {
    where.push('b.star_level >= ?');
    params.push(parseIntSafe(q.starMin, 1));
  }
  if (q.starMax !== undefined && q.starMax !== '') {
    where.push('b.star_level <= ?');
    params.push(parseIntSafe(q.starMax, 5));
  }
  const stars = normalizeTextList(q.stars)
    .map((x) => parseIntSafe(x, 0))
    .filter((x) => Number.isFinite(x) && x >= 1 && x <= 5);
  if (stars.length) {
    where.push(`b.star_level IN (${stars.map(() => '?').join(',')})`);
    params.push(...stars);
  }

  const tags = normalizeTextList(q.tags).map((x) => x.toLowerCase());
  for (const tag of tags) {
    // 每个标签都要求命中（AND 关系），支持 label_name / label_code 模糊匹配
    where.push(`EXISTS (
      SELECT 1
      FROM \`Hotel_Label_Rel\` rel
      JOIN \`Facility_Label\` l ON rel.label_id = l.id
      WHERE rel.hotel_id = b.id
        AND (LOWER(l.label_name) LIKE ? OR LOWER(l.label_code) LIKE ?)
    )`);
    const t = `%${tag}%`;
    params.push(t, t);
  }

  const [rows] = await pool.query(
    `SELECT b.*, a.audit_status, a.online_status, a.status, a.audit_reason, a.auditor_id, a.audit_time, a.online_time
     FROM \`Hotel_Base\` b
     LEFT JOIN \`Hotel_Audit\` a ON a.hotel_id = b.id
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY b.featured_weight DESC, b.created_time DESC`,
    params
  );

  const rel = await getHotelRelations(rows.map((r) => r.id));
  let data = rows.map((r) => toHotel(r, r, rel));

  if (q.priceMin !== undefined && q.priceMin !== '') {
    const min = parseFloatSafe(q.priceMin, 0);
    data = data.filter((item) => item.priceFrom >= min);
  }
  if (q.priceMax !== undefined && q.priceMax !== '') {
    const max = parseFloatSafe(q.priceMax, 999999);
    data = data.filter((item) => (item.priceFrom || 0) <= max);
  }

  if (q.sort === 'price_asc') data.sort((a, b) => (a.priceFrom || 0) - (b.priceFrom || 0));
  if (q.sort === 'price_desc') data.sort((a, b) => (b.priceFrom || 0) - (a.priceFrom || 0));
  if (q.sort === 'star_desc') data.sort((a, b) => (b.starLevel || 0) - (a.starLevel || 0));

  const page = Math.max(1, parseIntSafe(q.page, 1));
  const pageSize = Math.min(20, Math.max(1, parseIntSafe(q.pageSize, 10)));
  const offset = (page - 1) * pageSize;
  const paged = data.slice(offset, offset + pageSize);

  return {
    page,
    pageSize,
    total: data.length,
    hasMore: offset + pageSize < data.length,
    records: paged,
  };
}

app.get('/api/hotels', async (req, res) => {
  try {
    const result = await queryHotels(req);
    res.json({ code: 200, data: result.records, page: result.page, pageSize: result.pageSize, total: result.total, hasMore: result.hasMore });
  } catch (e) {
    res.status(500).json({ code: 500, msg: e.message });
  }
});

app.get('/api/hotels/:id', async (req, res) => {
  try {
    const item = await getHotelWithRelations(req.params.id);
    if (!item) return res.status(404).json({ code: 404, msg: 'not found' });
    res.json({ code: 200, data: item });
  } catch (e) {
    res.status(500).json({ code: 500, msg: e.message });
  }
});

app.post('/api/hotels', async (req, res) => {
  const p = req.body || {};
  if (!hasRequiredFields(p, ['name', 'nameEn', 'province', 'city', 'county', 'address'])) {
    return res.status(400).json({ code: 400, msg: '酒店基础信息不完整' });
  }

  const id = genId('hotel');
  const auditId = genId('audit');
  const merchantId = p.merchantId || p.createdBy || 'merchant_001';
  const images = Array.isArray(p.images) ? p.images.filter(Boolean) : p.image ? [p.image] : [];
  const labels = normalizeTextList(p.labels || p.facilities || []);
  const scenicSpots = normalizeTextList(p.scenicSpots).join(',');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      `INSERT INTO \`Hotel_Base\` (
        id, merchantId, name_cn, name_en, province, city, county, address,
        star_level, intro, scenic_spots, latitude, longitude, featured_weight, start_date, created_time
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        merchantId,
        p.name || p.name_cn,
        p.nameEn || p.name_en,
        p.province,
        p.city,
        p.county,
        p.address,
        parseIntSafe(p.starLevel || p.star || 3, 3),
        p.intro || '',
        scenicSpots,
        p.latitude ? parseFloatSafe(p.latitude, null) : null,
        p.longitude ? parseFloatSafe(p.longitude, null) : null,
        parseIntSafe(p.featuredWeight, 0),
        toDateTime(p.openTime || p.start_date),
        formatDateForMySQL(),
      ]
    );

    await conn.query(
      `INSERT INTO \`Hotel_Audit\` (id, hotel_id, audit_status, online_status, status)
       VALUES (?, ?, 0, 0, 0)`,
      [auditId, id]
    );

    await replaceHotelImages(id, images, conn);
    await upsertHotelLabels(id, labels, conn);
    await conn.commit();

    const item = await getHotelWithRelations(id);
    res.json({ code: 200, data: item });
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ code: 500, msg: e.message });
  } finally {
    conn.release();
  }
});

app.put('/api/hotels/:id', async (req, res) => {
  const { id } = req.params;
  const p = req.body || {};
  const images = Array.isArray(p.images) ? p.images.filter(Boolean) : p.image ? [p.image] : [];
  const labels = normalizeTextList(p.labels || p.facilities || []);
  const scenicSpots = normalizeTextList(p.scenicSpots).join(',');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      `UPDATE \`Hotel_Base\`
       SET name_cn=?, name_en=?, province=?, city=?, county=?, address=?,
           star_level=?, intro=?, scenic_spots=?, latitude=?, longitude=?, featured_weight=?, start_date=?
       WHERE id=?`,
      [
        p.name || p.name_cn || '',
        p.nameEn || p.name_en || '',
        p.province || '',
        p.city || '',
        p.county || '',
        p.address || '',
        parseIntSafe(p.starLevel || p.star || 3, 3),
        p.intro || '',
        scenicSpots,
        p.latitude ? parseFloatSafe(p.latitude, null) : null,
        p.longitude ? parseFloatSafe(p.longitude, null) : null,
        parseIntSafe(p.featuredWeight, 0),
        toDateTime(p.openTime || p.start_date),
        id,
      ]
    );

    await conn.query(
      `UPDATE \`Hotel_Audit\`
       SET audit_status=0, online_status=0, status=0, audit_reason=NULL, auditor_id=NULL, audit_time=NULL, online_time=NULL
       WHERE hotel_id = ?`,
      [id]
    );

    await replaceHotelImages(id, images, conn);
    await upsertHotelLabels(id, labels, conn);
    await conn.commit();

    const item = await getHotelWithRelations(id);
    if (!item) return res.status(404).json({ code: 404, msg: 'hotel not found' });
    res.json({ code: 200, data: item });
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ code: 500, msg: e.message });
  } finally {
    conn.release();
  }
});

app.delete('/api/hotels/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('UPDATE `Hotel_Audit` SET online_status = 0, status = 2 WHERE hotel_id = ?', [id]);
    res.json({ code: 200, msg: 'offline success' });
  } catch (e) {
    res.status(500).json({ code: 500, msg: e.message });
  }
});

app.get('/api/hotels/:id/rooms', async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.query('SELECT * FROM `Room` WHERE hotel_id = ? ORDER BY price ASC', [id]);
    const roomIds = rows.map((r) => r.id);
    let imgs = [];
    if (roomIds.length) {
      const [tmp] = await pool.query(
        `SELECT related_id, image_url FROM \`Image_Storage\` WHERE related_type='room' AND related_id IN (${roomIds
          .map(() => '?')
          .join(',')}) ORDER BY sort ASC`,
        roomIds
      );
      imgs = tmp;
    }
    const map = imgs.reduce((acc, r) => {
      if (!acc[r.related_id]) acc[r.related_id] = r.image_url;
      return acc;
    }, {});
    res.json({ code: 200, data: rows.map((r) => toLegacyRoom(r, map[r.id] || '')) });
  } catch (e) {
    res.status(500).json({ code: 500, msg: e.message });
  }
});

app.post('/api/hotels/:id/rooms', async (req, res) => {
  const { id: hotelId } = req.params;
  const p = req.body || {};
  const roomId = genId('room');
  try {
    await pool.query(
      `INSERT INTO \`Room\` (id, hotel_id, name, price, occupancy, size, breakfast_included, refundable, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        roomId,
        hotelId,
        p.type || p.name || '标准房',
        Number(p.current || p.price || p.original || 0),
        Number(p.occupancy || 2),
        p.size ? Number(p.size) : null,
        p.breakfastIncluded ? 1 : 0,
        p.refundable === false ? 0 : 1,
        String(p.status || '').toLowerCase() === 'soldout' ? 1 : 0,
      ]
    );
    if (p.image) {
      await pool.query(
        'INSERT INTO `Image_Storage` (id, related_type, related_id, image_url, sort) VALUES (?, ?, ?, ?, 0)',
        [genId('img'), 'room', roomId, p.image]
      );
    }
    const [rows] = await pool.query('SELECT * FROM `Room` WHERE id = ?', [roomId]);
    if (!rows[0]) return res.status(500).json({ code: 500, msg: '房型保存后读取失败' });
    res.json({ code: 200, data: toLegacyRoom(rows[0], p.image || '') });
  } catch (e) {
    res.status(500).json({ code: 500, msg: e.message });
  }
});

async function handleBulkRoomSave(req, res) {
  const { id: hotelId } = req.params;
  const rooms = Array.isArray(req.body?.rooms) ? req.body.rooms : [];
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [oldRows] = await conn.query('SELECT id FROM `Room` WHERE hotel_id = ?', [hotelId]);
    for (const r of oldRows) {
      await conn.query('DELETE FROM `Image_Storage` WHERE related_type = ? AND related_id = ?', ['room', r.id]);
    }
    await conn.query('DELETE FROM `Room` WHERE hotel_id = ?', [hotelId]);

    for (const item of rooms) {
      const roomId = item.id || genId('room');
      await conn.query(
        `INSERT INTO \`Room\` (id, hotel_id, name, price, occupancy, size, breakfast_included, refundable, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          roomId,
          hotelId,
          item.type || item.name || '标准房',
          Number(item.current || item.price || item.original || 0),
          Number(item.occupancy || 2),
          item.size ? Number(item.size) : null,
          item.breakfastIncluded ? 1 : 0,
          item.refundable === false ? 0 : 1,
          String(item.status || '').toLowerCase() === 'soldout' ? 1 : 0,
        ]
      );
      if (item.image) {
        await conn.query(
          'INSERT INTO `Image_Storage` (id, related_type, related_id, image_url, sort) VALUES (?, ?, ?, ?, 0)',
          [genId('img'), 'room', roomId, item.image]
        );
      }
    }

    await conn.commit();

    const [savedRows] = await pool.query('SELECT * FROM `Room` WHERE hotel_id = ? ORDER BY price ASC', [hotelId]);
    const roomIds = savedRows.map((x) => x.id);
    let images = [];
    if (roomIds.length) {
      const [tmp] = await pool.query(
        `SELECT related_id, image_url FROM \`Image_Storage\` WHERE related_type='room' AND related_id IN (${roomIds
          .map(() => '?')
          .join(',')}) ORDER BY sort ASC`,
        roomIds
      );
      images = tmp;
    }
    const imageMap = images.reduce((acc, row) => {
      if (!acc[row.related_id]) acc[row.related_id] = row.image_url;
      return acc;
    }, {});

    const safeRows = savedRows.filter(Boolean);
    return res.json({ code: 200, msg: 'rooms updated', data: safeRows.map((r) => toLegacyRoom(r, imageMap[r.id] || '')) });
  } catch (e) {
    await conn.rollback();
    return res.status(500).json({ code: 500, msg: e.message });
  } finally {
    conn.release();
  }
}

app.put('/api/hotels/:id/rooms/bulk', handleBulkRoomSave);
app.put('/api/hotels/:id/rooms/bulk-save', handleBulkRoomSave);

app.put('/api/hotels/:id/rooms/:roomId', async (req, res) => {
  const { roomId } = req.params;
  const p = req.body || {};
  try {
    await pool.query(
      `UPDATE \`Room\`
       SET name=?, price=?, occupancy=?, size=?, breakfast_included=?, refundable=?, status=?
       WHERE id=?`,
      [
        p.type || p.name || '标准房',
        Number(p.current || p.price || p.original || 0),
        Number(p.occupancy || 2),
        p.size ? Number(p.size) : null,
        p.breakfastIncluded ? 1 : 0,
        p.refundable === false ? 0 : 1,
        String(p.status || '').toLowerCase() === 'soldout' ? 1 : 0,
        roomId,
      ]
    );
    if (p.image) {
      await pool.query('DELETE FROM `Image_Storage` WHERE related_type = ? AND related_id = ?', ['room', roomId]);
      await pool.query(
        'INSERT INTO `Image_Storage` (id, related_type, related_id, image_url, sort) VALUES (?, ?, ?, ?, 0)',
        [genId('img'), 'room', roomId, p.image]
      );
    }
    const [rows] = await pool.query('SELECT * FROM `Room` WHERE id = ?', [roomId]);
    if (!rows[0]) return res.status(404).json({ code: 404, msg: '房型不存在' });
    res.json({ code: 200, data: toLegacyRoom(rows[0], p.image || '') });
  } catch (e) {
    res.status(500).json({ code: 500, msg: e.message });
  }
});

app.delete('/api/hotels/:id/rooms/:roomId', async (req, res) => {
  const { roomId } = req.params;
  try {
    await pool.query('DELETE FROM `Image_Storage` WHERE related_type = ? AND related_id = ?', ['room', roomId]);
    await pool.query('DELETE FROM `Room` WHERE id = ?', [roomId]);
    res.json({ code: 200, msg: 'deleted' });
  } catch (e) {
    res.status(500).json({ code: 500, msg: e.message });
  }
});

app.get('/api/admin/hotels/pending', async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT b.*, a.audit_status, a.online_status, a.status, a.audit_reason, a.auditor_id, a.audit_time, a.online_time
       FROM \`Hotel_Base\` b
       JOIN \`Hotel_Audit\` a ON a.hotel_id = b.id
       WHERE a.audit_status = 0
       ORDER BY b.created_time DESC`
    );
    const rel = await getHotelRelations(rows.map((r) => r.id));
    res.json({ code: 200, data: rows.map((r) => toHotel(r, r, rel)) });
  } catch (e) {
    res.status(500).json({ code: 500, msg: e.message });
  }
});

app.post('/api/admin/hotels/:id/audit', async (req, res) => {
  const { id } = req.params;
  const action = String(req.body?.action || '').toLowerCase();
  const reason = String(req.body?.reason || '').trim();
  const auditorId = String(req.body?.auditorId || 'admin_001');

  if (!['approve', 'reject'].includes(action)) {
    return res.status(400).json({ code: 400, msg: 'action 必须为 approve/reject' });
  }

  try {
    if (action === 'approve') {
      await pool.query(
        `UPDATE \`Hotel_Audit\`
         SET audit_status = 1, online_status = 0, status = 2, audit_reason = ?, auditor_id = ?, audit_time = ?, online_time = NULL
         WHERE hotel_id = ?`,
        [reason || '审核通过，待发布上线。', auditorId, formatDateForMySQL(), id]
      );
    } else {
      await pool.query(
        `UPDATE \`Hotel_Audit\`
         SET audit_status = 2, online_status = 0, status = 3, audit_reason = ?, auditor_id = ?, audit_time = ?, online_time = NULL
         WHERE hotel_id = ?`,
        [reason || '审核未通过，请根据备注修改后重新提交。', auditorId, formatDateForMySQL(), id]
      );
    }
    const item = await getHotelWithRelations(id);
    res.json({ code: 200, data: item });
  } catch (e) {
    res.status(500).json({ code: 500, msg: e.message });
  }
});

app.post('/api/admin/hotels/:id/publish', async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.query('SELECT audit_status FROM `Hotel_Audit` WHERE hotel_id = ? LIMIT 1', [id]);
    if (!rows[0]) return res.status(404).json({ code: 404, msg: '未找到审核记录' });
    if (Number(rows[0].audit_status) !== 1) {
      return res.status(400).json({ code: 400, msg: '酒店尚未审核通过，不能上线' });
    }

    await pool.query(
      `UPDATE \`Hotel_Audit\`
       SET online_status = 1, status = 1, online_time = ?
       WHERE hotel_id = ?`,
      [formatDateForMySQL(), id]
    );

    const item = await getHotelWithRelations(id);
    res.json({ code: 200, data: item });
  } catch (e) {
    res.status(500).json({ code: 500, msg: e.message });
  }
});

app.post('/api/admin/hotels/:id/offline', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query(
      `UPDATE \`Hotel_Audit\`
       SET online_status = 0, status = 2
       WHERE hotel_id = ?`,
      [id]
    );
    const item = await getHotelWithRelations(id);
    res.json({ code: 200, data: item });
  } catch (e) {
    res.status(500).json({ code: 500, msg: e.message });
  }
});

app.get('/api/submissions', async (req, res) => {
  req.query.scope = 'admin';
  req.query.auditStatus = '0';
  try {
    const result = await queryHotels(req);
    res.json({ code: 200, data: result.records });
  } catch (e) {
    res.status(500).json({ code: 500, msg: e.message });
  }
});

app.post('/api/submissions', async (req, res) => {
  const p = req.body || {};
  if (!hasRequiredFields(p, ['name', 'nameEn', 'province', 'city', 'county', 'address'])) {
    return res.status(400).json({ code: 400, msg: '酒店基础信息不完整' });
  }

  const id = genId('hotel');
  const auditId = genId('audit');
  const merchantId = p.merchantId || p.createdBy || 'merchant_001';
  const images = Array.isArray(p.images) ? p.images.filter(Boolean) : p.image ? [p.image] : [];
  const labels = normalizeTextList(p.labels || p.facilities || []);
  const scenicSpots = normalizeTextList(p.scenicSpots).join(',');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      `INSERT INTO \`Hotel_Base\` (
        id, merchantId, name_cn, name_en, province, city, county, address,
        star_level, intro, scenic_spots, latitude, longitude, featured_weight, start_date, created_time
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        merchantId,
        p.name || p.name_cn,
        p.nameEn || p.name_en,
        p.province,
        p.city,
        p.county,
        p.address,
        parseIntSafe(p.starLevel || p.star || 3, 3),
        p.intro || '',
        scenicSpots,
        p.latitude ? parseFloatSafe(p.latitude, null) : null,
        p.longitude ? parseFloatSafe(p.longitude, null) : null,
        parseIntSafe(p.featuredWeight, 0),
        toDateTime(p.openTime || p.start_date),
        formatDateForMySQL(),
      ]
    );

    await conn.query(
      `INSERT INTO \`Hotel_Audit\` (id, hotel_id, audit_status, online_status, status)
       VALUES (?, ?, 0, 0, 0)`,
      [auditId, id]
    );

    await replaceHotelImages(id, images, conn);
    await upsertHotelLabels(id, labels, conn);
    await conn.commit();
    const item = await getHotelWithRelations(id);
    return res.json({ code: 200, data: item });
  } catch (e) {
    await conn.rollback();
    return res.status(500).json({ code: 500, msg: e.message });
  } finally {
    conn.release();
  }
});

app.post('/api/submissions/:id/approve', async (req, res) => {
  const { id } = req.params;
  const auditorId = String(req.body?.auditorId || 'admin_001');
  const reason = String(req.body?.reason || '').trim();
  try {
    await pool.query(
      `UPDATE \`Hotel_Audit\`
       SET audit_status = 1, online_status = 0, status = 2, audit_reason = ?, auditor_id = ?, audit_time = ?, online_time = NULL
       WHERE hotel_id = ?`,
      [reason || '审核通过，待发布上线。', auditorId, formatDateForMySQL(), id]
    );
    const item = await getHotelWithRelations(id);
    return res.json({ code: 200, data: item });
  } catch (e) {
    return res.status(500).json({ code: 500, msg: e.message });
  }
});

app.post('/api/submissions/:id/reject', async (req, res) => {
  const { id } = req.params;
  const auditorId = String(req.body?.auditorId || 'admin_001');
  const reason = String(req.body?.reason || '').trim();
  try {
    await pool.query(
      `UPDATE \`Hotel_Audit\`
       SET audit_status = 2, online_status = 0, status = 3, audit_reason = ?, auditor_id = ?, audit_time = ?, online_time = NULL
       WHERE hotel_id = ?`,
      [reason || '审核未通过，请根据备注修改后重新提交。', auditorId, formatDateForMySQL(), id]
    );
    return res.json({ code: 200, msg: 'rejected' });
  } catch (e) {
    return res.status(500).json({ code: 500, msg: e.message });
  }
});

app.get('/api/mobile/home-banner', async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT b.*, a.audit_status, a.online_status
       FROM \`Hotel_Base\` b
       JOIN \`Hotel_Audit\` a ON a.hotel_id = b.id
       WHERE a.audit_status = 1 AND a.online_status = 1
       ORDER BY b.featured_weight DESC, b.created_time DESC
       LIMIT 5`
    );
    const rel = await getHotelRelations(rows.map((r) => r.id));
    const data = rows.map((r) => {
      const item = toHotel(r, r, rel);
      return {
        id: item.id,
        hotelId: item.id,
        title: `${item.name} 限时特惠`,
        subtitle: `${item.city} · ${item.priceFrom ? `${item.priceFrom}元起` : '优选推荐'}`,
        image: item.image,
        featuredWeight: item.featuredWeight,
      };
    });
    res.json({ code: 200, data });
  } catch (e) {
    res.status(500).json({ code: 500, msg: e.message });
  }
});

app.get('/api/mobile/hotels', async (req, res) => {
  try {
    req.query.scope = 'public';
    const result = await queryHotels(req);
    const hotelIds = result.records.map((item) => item.id);
    const rel = await getHotelRelations(hotelIds);
    const data = [];
    for (const item of result.records) {
      const roomRows = rel.roomsByHotel[item.id] || [];
      data.push({
        id: item.id,
        name: item.name,
        nameEn: item.nameEn,
        city: item.city,
        county: item.county,
        rating: item.starLevel,
        starLevel: item.starLevel,
        address: item.address,
        fullAddress: item.fullAddress,
        coverImage: item.image,
        images: item.images,
        tags: item.labels,
        scenicSpots: item.scenicSpots,
        facilities: item.labels,
        priceFrom: item.priceFrom,
        rooms: roomRows.map((x) => ({
          id: x.id,
          name: x.name,
          price: Number(x.price || 0),
          capacity: Number(x.occupancy || 2),
          bedType: inferBedType(x.name),
          size: x.size ? Number(x.size) : null,
          status: Number(x.status || 0) === 0 ? 'available' : 'soldout',
          breakfastIncluded: Number(x.breakfast_included || 0) === 1,
          refundable: Number(x.refundable || 1) === 1,
          image: rel.roomImageByRoom[x.id] || `https://picsum.photos/seed/room_${x.id}/800/500`,
        })),
      });
    }

    res.json({ code: 200, data, page: result.page, pageSize: result.pageSize, total: result.total, hasMore: result.hasMore });
  } catch (e) {
    res.status(500).json({ code: 500, msg: e.message });
  }
});

app.get('/api/mobile/hotels/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT b.*, a.audit_status, a.online_status, a.status, a.audit_reason, a.auditor_id, a.audit_time, a.online_time
       FROM \`Hotel_Base\` b
       JOIN \`Hotel_Audit\` a ON a.hotel_id = b.id
       WHERE b.id = ? AND a.audit_status = 1 AND a.online_status = 1`,
      [id]
    );
    if (!rows[0]) return res.status(404).json({ code: 404, msg: 'not found' });

    const rel = await getHotelRelations([id]);
    const item = toHotel(rows[0], rows[0], rel);
    const rooms = (rel.roomsByHotel[id] || [])
      .map((x) => ({
        id: x.id,
        name: x.name,
        price: Number(x.price || 0),
        capacity: Number(x.occupancy || 2),
        bedType: inferBedType(x.name),
        size: x.size ? Number(x.size) : null,
        status: Number(x.status || 0) === 0 ? 'available' : 'soldout',
        breakfastIncluded: Number(x.breakfast_included || 0) === 1,
        refundable: Number(x.refundable || 1) === 1,
        image: rel.roomImageByRoom[x.id] || `https://picsum.photos/seed/room_${x.id}/800/500`,
      }))
      .sort((a, b) => a.price - b.price);

    res.json({
      code: 200,
      data: {
        id: item.id,
        name: item.name,
        nameEn: item.nameEn,
        city: item.city,
        county: item.county,
        rating: item.starLevel,
        starLevel: item.starLevel,
        address: item.address,
        fullAddress: item.fullAddress,
        coverImage: item.image,
        images: item.images,
        tags: item.labels,
        scenicSpots: item.scenicSpots,
        facilities: item.labels,
        priceFrom: item.priceFrom,
        rooms,
      },
    });
  } catch (e) {
    res.status(500).json({ code: 500, msg: e.message });
  }
});

app.post('/api/mobile/login', async (req, res) => {
  const { username, identifier, password, passwordCipher } = req.body || {};
  const idValue = String(identifier || username || '').trim();
  if (!idValue) return res.status(400).json({ code: 400, msg: '请输入账号' });
  try {
    const [rows] = await pool.query(
      'SELECT id, account, email, phone, name, real_name, company_name, role, password, createdAt FROM `User` WHERE account = ? OR email = ? OR id = ? LIMIT 1',
      [idValue, idValue, idValue]
    );
    const user = rows[0];
    if (!user) return res.status(401).json({ code: 401, msg: '账号不存在或密码错误' });
    const cipher = String(passwordCipher || sha256(String(password || '')));
    if (!verifyPassword(cipher, user.password)) {
      return res.status(401).json({ code: 401, msg: '账号不存在或密码错误' });
    }
    return res.json({
      code: 200,
      data: {
        token: `token-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        user: {
          id: user.id,
          account: user.account,
          name: user.name,
          role: user.role,
        },
      },
    });
  } catch (e) {
    return res.status(500).json({ code: 500, msg: e.message });
  }
});

app.get('/api/orders/:hotelId', async (_req, res) => {
  res.json({ code: 200, data: [] });
});

app.put('/api/orders/:hotelId', async (_req, res) => {
  res.json({ code: 200, msg: 'orders disabled in strict schema' });
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
      console.error('Failed to start server:', err);
      process.exit(1);
    }
  })
  .catch((err) => {
    console.error('Failed to initialize DB pool:', err);
    process.exit(1);
  });
