const crypto = require("crypto");
const express = require("express");
const path = require("path");
const cors = require("cors");
const fs = require("fs");
const mysql = require("mysql2/promise");
const { sha256Hex: sha256, resolvePasswordCipher } = require("./lib/password-cipher");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const app = express();
const PORT = Number(process.env.PORT || 3000);

const DB_HOST = process.env.DB_HOST || "127.0.0.1";
const DB_PORT = Number(process.env.DB_PORT || 3306);
const DB_USER = process.env.DB_USER || "root";
const DB_PASS = process.env.DB_PASS || "";
const DB_NAME = process.env.DB_NAME || "yisu_db";

let pool;

function formatDateForMySQL(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

function genId(prefix) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeTextList(value) {
  if (Array.isArray(value))
    return value.filter(Boolean).map((x) => String(x).trim());
  if (typeof value === "string") {
    return value
      .split(/[;,，；\n]/)
      .map((x) => x.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeRegionName(value) {
  return String(value || "")
    .trim()
    .replace(/(省|市|县)$/g, "")
    .toLowerCase();
}

function stripRegionSuffix(value) {
  return String(value || "")
    .trim()
    .replace(/(省|市|县)$/g, "");
}

const GEO_TIMEOUT_MS = Math.max(
  1200,
  Number(process.env.GEO_TIMEOUT_MS || 4500),
);
const AMAP_WEB_KEY = String(process.env.AMAP_WEB_KEY || "");
const GEO_PROVIDER_MODE = String(process.env.GEO_PROVIDER_MODE || "auto")
  .trim()
  .toLowerCase();

async function fetchJsonWithTimeout(
  url,
  init = {},
  timeoutMs = GEO_TIMEOUT_MS,
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch (_e) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function reverseByNominatim(lat, lon) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&accept-language=zh-CN&lat=${lat}&lon=${lon}`;
  const data = await fetchJsonWithTimeout(url, {
    headers: { Accept: "application/json" },
  });
  if (!data || typeof data !== "object") return null;
  const a = data.address || {};
  // city: 优先县级市/城市名；不要优先使用地级市 region，避免前端回退时显示成“临汾”。
  const city = a.city || a.town || a.county || a.region || "";
  const district = a.county || a.city_district || a.suburb || a.city || "";
  const street = a.road || "";
  return {
    provider: "nominatim",
    reverse: [
      {
        city: city || "",
        district: district || "",
        region: a.state || "",
        street: street || "",
        name: data.name || "",
      },
    ],
  };
}

async function reverseByBigDataCloud(lat, lon) {
  const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=zh`;
  const data = await fetchJsonWithTimeout(url);
  if (!data || typeof data !== "object") return null;
  const admins = data.localityInfo?.administrative || [];
  const prefecture = admins.find((x) => Number(x.adminLevel) === 5)?.name || "";
  const countyLevel =
    admins.find((x) => Number(x.adminLevel) === 6)?.name || "";
  const district = String(data.locality || countyLevel || "");
  const city = String(data.city || prefecture || "");
  return {
    provider: "bigdatacloud",
    reverse: [
      {
        region: String(data.principalSubdivision || ""),
        city,
        district: String(district || ""),
        street: "",
        name: "",
      },
    ],
  };
}

async function reverseByAmap(lat, lon) {
  if (!AMAP_WEB_KEY) return null;
  const url = `https://restapi.amap.com/v3/geocode/regeo?key=${encodeURIComponent(AMAP_WEB_KEY)}&location=${lon},${lat}&extensions=base`;
  const data = await fetchJsonWithTimeout(url);
  if (!data || String(data.status) !== "1") return null;
  const c = data.regeocode?.addressComponent || {};
  const city = Array.isArray(c.city) ? c.city[0] : c.city || "";
  const street = c.streetNumber?.street || c.township || "";
  return {
    provider: "amap",
    reverse: [
      {
        region: String(c.province || ""),
        city: String(city || ""),
        district: String(c.district || ""),
        street: String(street || c.township || ""),
        name: String(data.regeocode?.formatted_address || ""),
      },
    ],
  };
}

async function reverseGeocodeByStrategy(lat, lon) {
  if (GEO_PROVIDER_MODE === "amap_only") {
    return (await reverseByAmap(lat, lon)) || { provider: "none", reverse: [] };
  }

  if (GEO_PROVIDER_MODE === "amap") {
    return (
      (await reverseByAmap(lat, lon)) ||
      (await reverseByNominatim(lat, lon)) ||
      (await reverseByBigDataCloud(lat, lon)) || {
        provider: "none",
        reverse: [],
      }
    );
  }

  return (
    (await reverseByNominatim(lat, lon)) ||
    (await reverseByBigDataCloud(lat, lon)) ||
    (await reverseByAmap(lat, lon)) || { provider: "none", reverse: [] }
  );
}

function normalizeReverseGeocodePayload(payload) {
  const first = payload?.reverse?.[0] || {};
  const province = String(first.region || "").trim();
  const city = String(first.city || first.subregion || "").trim();
  const district = String(first.district || "").trim();
  const districtAsCity = /(县|市)$/.test(district);
  const cityOrCountyRaw = districtAsCity
    ? district
    : city || district || province;
  const cityOrCounty = stripRegionSuffix(cityOrCountyRaw);
  const rawStreet = String(first.street || "").trim();
  const streetNorm = stripRegionSuffix(rawStreet);
  const cityNorm = stripRegionSuffix(city);
  const districtNorm = stripRegionSuffix(district);
  const street =
    !rawStreet ||
      streetNorm === cityOrCounty ||
      streetNorm === cityNorm ||
      streetNorm === districtNorm
      ? ""
      : rawStreet;

  return {
    provider: String(payload?.provider || "none"),
    province,
    city,
    district,
    cityOrCounty,
    street,
    displayText: [cityOrCounty, street].filter(Boolean).join(" "),
    hasResult: Boolean(payload?.reverse?.length),
  };
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

function diffNightsSafe(checkIn, checkOut) {
  const start = new Date(String(checkIn || "").slice(0, 10)).getTime();
  const end = new Date(String(checkOut || "").slice(0, 10)).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 1;
  const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
  return Math.max(1, days);
}

function toDateOnly(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(d.getTime())) return null;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function hashPassword(passwordCipher) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .scryptSync(String(passwordCipher || ""), salt, 64)
    .toString("hex");
  return `scrypt$${salt}$${hash}`;
}

function verifyPassword(passwordCipher, hashedPassword) {
  if (!hashedPassword) return false;
  if (hashedPassword.startsWith("scrypt$")) {
    const parts = hashedPassword.split("$");
    if (parts.length !== 3) return false;
    const salt = parts[1];
    const digest = parts[2];
    const target = crypto
      .scryptSync(String(passwordCipher || ""), salt, 64)
      .toString("hex");
    return crypto.timingSafeEqual(
      Buffer.from(target, "hex"),
      Buffer.from(digest, "hex"),
    );
  }
  return String(passwordCipher || "") === String(hashedPassword || "");
}

function strongPasswordMessage(password) {
  const pwd = String(password || "");
  const tips = [];
  if (pwd.length < 10) tips.push("至少 10 位");
  if (!/[A-Z]/.test(pwd)) tips.push("至少 1 个大写字母");
  if (!/[a-z]/.test(pwd)) tips.push("至少 1 个小写字母");
  if (!/\d/.test(pwd)) tips.push("至少 1 个数字");
  if (!/[`~!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]/.test(pwd))
    tips.push("至少 1 个特殊符号");
  return tips;
}

function rolePrefix(role) {
  if (role === "admin") return "admin";
  if (role === "merchant") return "merchant";
  return "user";
}

const TEST_USERS = [
  {
    id: "admin_001",
    account: "admin.ops",
    email: "admin.ops@yisu.com",
    role: "admin",
    name: "运营管理员",
    realName: "王运营",
    companyName: "易宿平台",
    password: "Admin#2026!Ops",
  },
  {
    id: "admin_002",
    account: "admin.audit",
    email: "admin.audit@yisu.com",
    role: "admin",
    name: "审核管理员",
    realName: "李审核",
    companyName: "易宿平台",
    password: "Admin#2026!Audit",
  },
  {
    id: "admin_003",
    account: "admin.release",
    email: "admin.release@yisu.com",
    role: "admin",
    name: "发布管理员",
    realName: "周发布",
    companyName: "易宿平台",
    password: "Admin#2026!Release",
  },
  {
    id: "merchant_001",
    account: "m.shanghai",
    email: "merchant.shanghai@yisu.com",
    role: "merchant",
    name: "上海商家",
    realName: "张宁",
    companyName: "沪上旅宿集团",
    password: "Merchant#2026!SH",
  },
  {
    id: "merchant_002",
    account: "m.beijing",
    email: "merchant.beijing@yisu.com",
    role: "merchant",
    name: "北京商家",
    realName: "陈璐",
    companyName: "京华酒店管理",
    password: "Merchant#2026!BJ",
  },
  {
    id: "merchant_003",
    account: "m.shenzhen",
    email: "merchant.shenzhen@yisu.com",
    role: "merchant",
    name: "深圳商家",
    realName: "黄涛",
    companyName: "深湾旅业有限公司",
    password: "Merchant#2026!SZ",
  },
  {
    id: "merchant_004",
    account: "m.hangzhou",
    email: "merchant.hangzhou@yisu.com",
    role: "merchant",
    name: "杭州商家",
    realName: "杨帆",
    companyName: "杭城智选酒店",
    password: "Merchant#2026!HZ",
  },
  {
    id: "merchant_005",
    account: "m.chengdu",
    email: "merchant.chengdu@yisu.com",
    role: "merchant",
    name: "成都商家",
    realName: "何然",
    companyName: "蓉城酒店运营中心",
    password: "Merchant#2026!CD",
  },
  {
    id: "user_001",
    account: "user.demo",
    email: "user.demo@yisu.com",
    role: "user",
    name: "示例用户",
    realName: "赵可",
    companyName: null,
    password: "User#2026!Demo",
  },
];

const TEST_CUSTOMERS = [
  {
    id: "customer_demo_001",
    phone: "13800138000",
    name: "user_test",
    email: "customer.demo@yisu.com",
    password: "123456",
  },
];

async function initDbPool() {
  const tmpConn = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASS,
  });
  try {
    await tmpConn.query(
      `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
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
    charset: "utf8mb4",
  });

  async function runSqlFileStatements(filePath, ignoreComment = "") {
    if (!fs.existsSync(filePath)) return;
    const sql = fs.readFileSync(filePath, "utf8");
    const stmts = sql
      .split(/;\s*\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    for (const s of stmts) {
      try {
        await pool.query(s);
      } catch {
        // ignore single statement errors for compatibility / repeatable init
        if (ignoreComment) {
          // keep branch for readability and future debugging hooks
        }
      }
    }
  }

  const schemaPath = path.join(__dirname, "sql", "init_schema.sql");
  await runSqlFileStatements(schemaPath, "schema init");

  // Ensure orders table exists for mobile booking flow
  const ordersSchemaPath = path.join(
    __dirname,
    "sql",
    "create_orders_table.sql",
  );
  await runSqlFileStatements(ordersSchemaPath, "orders schema init");

  // Best-effort lightweight migration for orders table to ensure new columns exist
  try {
    // 添加 customer_id 兼容字段（如果已存在会抛错，忽略即可）
    await pool.query(
      "ALTER TABLE `orders` ADD COLUMN `customer_id` VARCHAR(64) NULL COMMENT '下单客户ID，对应 Customer.id' AFTER `id`",
    );
  } catch (_e) {
    // ignore when column already exists or table missing
  }

  // Best-effort: add token column to Customer table for session tokens
  try {
    await pool.query(
      "ALTER TABLE `Customer` ADD COLUMN `token` VARCHAR(128) NULL COMMENT '登录会话 token' AFTER `password`",
    );
  } catch (_e) {
    // ignore when column already exists or table missing
  }

  // Align orders table collation with main schema to avoid collation mix errors
  try {
    await pool.query(
      "ALTER TABLE `orders` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
    );
  } catch (_e) {
    // ignore if table missing or already converted
  }

  // Ensure Customer table exists (non-destructive).
  // SQL file note: create_customers_table.sql 包含建表与手机号索引语句；
  // 这里不再 DROP，避免 dev:api 重启时清空移动端注册用户。
  try {
    const customerSchemaPath = path.join(
      __dirname,
      "sql",
      "create_customers_table.sql",
    );
    if (fs.existsSync(customerSchemaPath)) {
      await runSqlFileStatements(customerSchemaPath, "customer schema init");
    } else {
      await pool.query(`
        CREATE TABLE \`Customer\` (
          \`id\` VARCHAR(80) NOT NULL PRIMARY KEY,
          \`password\` VARCHAR(255) NOT NULL,
          \`phone\` VARCHAR(32) DEFAULT NULL,
          \`name\` VARCHAR(128) DEFAULT NULL,
          \`email\` VARCHAR(128) DEFAULT NULL,
          \`createdAt\` DATETIME DEFAULT CURRENT_TIMESTAMP,
          \`updatedAt\` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
      `);
    }
  } catch (e) {
    // ignore
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
      ],
    );
  }

  for (const customer of TEST_CUSTOMERS) {
    const hashed = hashPassword(sha256(customer.password));
    await pool.query(
      `INSERT INTO \`Customer\` (id, password, phone, name, email)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
       password = VALUES(password),
       phone = VALUES(phone),
       name = VALUES(name),
       email = VALUES(email)`,
      [
        customer.id,
        hashed,
        customer.phone,
        customer.name,
        customer.email,
      ],
    );
  }

  const [hotelCountRows] = await pool.query(
    "SELECT COUNT(*) AS c FROM `Hotel_Base`",
  );
  const hotelCount = Number(hotelCountRows?.[0]?.c || 0);
  if (hotelCount < 20) {
    const seedPath = path.join(__dirname, "sql", "seed_sample.sql");
    await runSqlFileStatements(seedPath, "seed sample");

    // add_20_hotels_data.sql 注释说明为“新增20条酒店测试数据”，按初始化种子流程放在 seed_sample 之后。
    // 使用同一条件块：首次初始化 Hotel_Base 通常为 0，会先灌基础样例，再尝试追加 20 条扩展样例。
    const add20HotelsSeedPath = path.join(
      __dirname,
      "sql",
      "add_20_hotels_data.sql",
    );
    await runSqlFileStatements(
      add20HotelsSeedPath,
      "seed additional 20 hotels",
    );
  }

  // migrate_add_room_fields.sql 注释说明为“向 Room 表添加缺失字段（安全执行，可重复运行）”。
  // 按要求放在 seed_sample 之后执行；即使多次启动也应保持幂等。
  const roomMigratePath = path.join(
    __dirname,
    "sql",
    "migrate_add_room_fields.sql",
  );
  await runSqlFileStatements(roomMigratePath, "room field migration");
}

async function getHotelRelations(hotelIds) {
  if (!hotelIds.length) {
    return {
      roomsByHotel: {},
      hotelImagesByHotel: {},
      roomImageByRoom: {},
      labelsByHotel: {},
      labelCodesByHotel: {},
    };
  }
  const placeholders = hotelIds.map(() => "?").join(",");

  const [rooms] = await pool.query(
    `SELECT * FROM \`Room\` WHERE hotel_id IN (${placeholders}) ORDER BY price ASC`,
    hotelIds,
  );
  const roomIds = rooms.map((r) => r.id);

  const [hotelImages] = await pool.query(
    `SELECT * FROM \`Image_Storage\` WHERE related_type='hotel' AND related_id IN (${placeholders}) ORDER BY sort ASC`,
    hotelIds,
  );

  let roomImages = [];
  if (roomIds.length) {
    const roomP = roomIds.map(() => "?").join(",");
    const [tmp] = await pool.query(
      `SELECT * FROM \`Image_Storage\` WHERE related_type='room' AND related_id IN (${roomP}) ORDER BY sort ASC`,
      roomIds,
    );
    roomImages = tmp;
  }

  const [labels] = await pool.query(
    `SELECT rel.hotel_id, l.label_name, l.label_code
     FROM \`Hotel_Label_Rel\` rel
     JOIN \`Facility_Label\` l ON rel.label_id = l.id
     WHERE rel.hotel_id IN (${placeholders})`,
    hotelIds,
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

  return {
    roomsByHotel,
    hotelImagesByHotel,
    roomImageByRoom,
    labelsByHotel,
    labelCodesByHotel,
  };
}

function derivePriceRange(rooms) {
  const prices = rooms
    .map((r) => Number(r.price || 0))
    .filter((x) => Number.isFinite(x) && x > 0)
    .sort((a, b) => a - b);
  if (!prices.length) return { min: 0, max: 0, text: "" };
  if (prices[0] === prices[prices.length - 1])
    return { min: prices[0], max: prices[0], text: `${prices[0]}元/晚` };
  return {
    min: prices[0],
    max: prices[prices.length - 1],
    text: `${prices[0]}元 - ${prices[prices.length - 1]}元/晚`,
  };
}

function toLegacyRoom(row = {}, image) {
  const remainVal = row.remain != null ? Number(row.remain) : null;
  // 状态优先由 remain 判断：有剩余(>0)为可订，否则为售罄；
  // 若 remain 缺失则退回到数据库的 status 字段作为回退（但不再虚构一个默认可订的 remain=10）
  const status =
    remainVal != null
      ? remainVal > 0
        ? "available"
        : "soldout"
      : row.status === 0
        ? "available"
        : "soldout";
  const remain = remainVal != null ? remainVal : 0;

  return {
    id: row.id,
    hotel_id: row.hotel_id,
    type: row.name,
    original: Number(
      row.original_price != null ? row.original_price : row.price || 0,
    ),
    current: Number(row.price || 0),
    discount: row.discount || "",
    remain,
    status,
    remark: row.remark || "",
    image: image || "",
    occupancy: Number(row.occupancy || 2),
    size: row.size,
    breakfastIncluded: Number(row.breakfast_included || 0) === 1,
  };
}

function inferBedType(name = "") {
  const n = String(name || "").toLowerCase();
  if (/(双床|双人床|twin)/.test(n)) return "双床";
  if (/(大床|queen|king)/.test(n)) return "大床";
  if (/(家庭|family)/.test(n)) return "家庭床";
  if (/(榻榻米|tatami)/.test(n)) return "榻榻米";
  return "标准床";
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
    fullAddress: `${base.province || ""}${base.city || ""}${base.county || ""}${base.address || ""}`,
    openTime: String(base.start_date || "").slice(0, 10),
    start_date: base.start_date,
    star: Number(base.star_level || 0),
    starLevel: Number(base.star_level || 0),
    scenicSpots,
    intro: base.intro || "",
    latitude: base.latitude,
    longitude: base.longitude,
    featuredWeight: Number(base.featured_weight || 0),
    image: images[0] || "",
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
    audit_reason: audit?.audit_reason || "",
    auditor_id: audit?.auditor_id || null,
    audit_time: audit?.audit_time || null,
    online_time: audit?.online_time || null,
    createdAt: base.created_time,
  };
}

function hasRequiredFields(payload, fields) {
  return fields.every((f) => String(payload?.[f] || "").trim().length > 0);
}

async function upsertHotelLabels(hotelId, labels, conn = pool) {
  await conn.query("DELETE FROM `Hotel_Label_Rel` WHERE hotel_id = ?", [
    hotelId,
  ]);
  if (!labels.length) return;
  const [rows] = await conn.query(
    `SELECT id, label_name FROM \`Facility_Label\` WHERE label_name IN (${labels.map(() => "?").join(",")})`,
    labels,
  );
  for (const r of rows) {
    await conn.query(
      "INSERT INTO `Hotel_Label_Rel` (id, hotel_id, label_id) VALUES (?, ?, ?)",
      [genId("rel"), hotelId, r.id],
    );
  }
}

async function replaceHotelImages(hotelId, images, conn = pool) {
  await conn.query(
    "DELETE FROM `Image_Storage` WHERE related_type = ? AND related_id = ?",
    ["hotel", hotelId],
  );
  for (let i = 0; i < images.length; i += 1) {
    await conn.query(
      "INSERT INTO `Image_Storage` (id, related_type, related_id, image_url, sort) VALUES (?, ?, ?, ?, ?)",
      [genId("img"), "hotel", hotelId, images[i], i],
    );
  }
}

async function getHotelWithRelations(hotelId) {
  const [rows] = await pool.query(
    `SELECT b.*, a.audit_status, a.online_status, a.status, a.audit_reason, a.auditor_id, a.audit_time, a.online_time
     FROM \`Hotel_Base\` b
     LEFT JOIN \`Hotel_Audit\` a ON a.hotel_id = b.id
     WHERE b.id = ?`,
    [hotelId],
  );
  if (!rows[0]) return null;
  const rel = await getHotelRelations([hotelId]);
  return toHotel(rows[0], rows[0], rel);
}

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use("/", express.static(path.join(__dirname)));

app.get("/api/health", (_req, res) => {
  res.json({ code: 200, data: { ok: true, ts: formatDateForMySQL() } });
});

// Customer register/login for mobile app (simple flow)
app.post("/api/customer/register", async (req, res) => {
  const p = req.body || {};
  const passwordCipher = resolvePasswordCipher(p);
  const phone = p.phone ? String(p.phone).trim() : "";
  if (!phone || !passwordCipher)
    return res.status(400).json({ code: 400, msg: "手机号与密码必填" });
  try {
    // generate customer id server-side with prefix (prefer UUID)
    const cid = crypto.randomUUID
      ? `customer_${crypto.randomUUID()}`
      : genId("customer");
    // ensure phone unique
    const [dupPhone] = await pool.query(
      "SELECT id FROM `Customer` WHERE phone = ? LIMIT 1",
      [phone],
    );
    if (dupPhone && dupPhone.length)
      return res.status(409).json({ code: 409, msg: "手机号已被注册" });
    const hashed = hashPassword(passwordCipher);
    await pool.query(
      "INSERT INTO `Customer` (id, password, phone, name, email) VALUES (?, ?, ?, ?, ?)",
      [
        cid,
        hashed,
        phone,
        p.name ? String(p.name).trim() : null,
        p.email ? String(p.email).trim() : null,
      ],
    );
    const [rows] = await pool.query(
      "SELECT id, phone, name, email, createdAt, updatedAt FROM `Customer` WHERE id = ?",
      [cid],
    );
    return res.json({ code: 200, data: rows[0] });
  } catch (e) {
    return res.status(500).json({ code: 500, msg: e.message });
  }
});

app.post("/api/customer/login", async (req, res) => {
  const { identifier } = req.body || {};
  const idv = String(identifier || "").trim();
  const passwordCipher = resolvePasswordCipher(req.body || {});
  if (!idv || !passwordCipher)
    return res
      .status(400)
      .json({ code: 400, msg: "手机号/邮箱 与密码必填" });
  try {
    // 支持通过手机号、邮箱、id 或 名称（用户名）登录
    const [rows] = await pool.query(
      "SELECT id, password, phone, name, email, createdAt FROM `Customer` WHERE phone = ? OR email = ? OR id = ? OR name = ? LIMIT 1",
      [idv, idv, idv, idv],
    );
    const customer = rows[0];
    if (!customer)
      return res.status(401).json({ code: 401, msg: "用户名或密码错误" });
    if (!verifyPassword(passwordCipher, customer.password))
      return res.status(401).json({ code: 401, msg: "用户名或密码错误" });

    // 生成 token 并保存到 Customer 表（轻量 session 方案）
    const token = `cust-${customer.id}-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    try {
      await pool.query("UPDATE `Customer` SET token = ? WHERE id = ?", [
        token,
        customer.id,
      ]);
    } catch (_e) {
      // ignore storage error, 仍然返回 token 给客户端
    }

    return res.json({
      code: 200,
      data: {
        token,
        customer: {
          id: customer.id,
          phone: customer.phone,
          name: customer.name,
          email: customer.email,
          createdAt: customer.createdAt,
        },
      },
    });
  } catch (e) {
    return res.status(500).json({ code: 500, msg: e.message });
  }
});

app.get("/api/geocode/reverse", async (req, res) => {
  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    Math.abs(lat) > 90 ||
    Math.abs(lon) > 180
  ) {
    return res.status(400).json({ code: 400, msg: "Invalid lat/lon" });
  }
  try {
    const data = await reverseGeocodeByStrategy(lat, lon);
    return res.json({
      code: 200,
      data: {
        ...data,
        normalized: normalizeReverseGeocodePayload(data),
      },
    });
  } catch (_e) {
    const fallback = { provider: "none", reverse: [] };
    return res.json({
      code: 200,
      data: {
        ...fallback,
        normalized: normalizeReverseGeocodePayload(fallback),
      },
    });
  }
});

app.get("/api/location/suggest", async (req, res) => {
  const q = String(req.query.q || "").trim();
  const preferredCity = stripRegionSuffix(String(req.query.city || "").trim());
  const limit = Math.min(
    20,
    Math.max(1, parseIntSafe(req.query.limit || 12, 12)),
  );
  if (!q) return res.json({ code: 200, data: [] });

  const kw = `%${q}%`;

  try {
    const [rows] = await pool.query(
      `SELECT b.id, b.name_cn, b.name_en, b.city, b.county, b.address, b.scenic_spots
       FROM \`Hotel_Base\` b
       JOIN \`Hotel_Audit\` a ON a.hotel_id = b.id
       WHERE a.audit_status = 1
         AND a.online_status = 1
         AND (
           b.name_cn LIKE ?
           OR b.name_en LIKE ?
           OR b.city LIKE ?
           OR b.county LIKE ?
           OR b.address LIKE ?
           OR b.scenic_spots LIKE ?
         )
       ORDER BY b.featured_weight DESC, b.created_time DESC
       LIMIT 60`,
      [kw, kw, kw, kw, kw, kw],
    );

    const seen = new Set();
    const items = [];
    const qNorm = q.toLowerCase();

    function pushItem(item) {
      const city = stripRegionSuffix(item.city || "");
      const label = String(item.label || "").trim();
      if (!label) return;
      const key = `${item.type}|${city}|${label}`;
      if (seen.has(key)) return;
      seen.add(key);

      let score = Number(item.score || 0);
      const labelLower = label.toLowerCase();
      if (label === q) score += 90;
      else if (label.startsWith(q)) score += 55;
      else if (labelLower.includes(qNorm)) score += 25;
      if (preferredCity && city === preferredCity) score += 18;

      items.push({
        type: item.type,
        city,
        county: stripRegionSuffix(item.county || ""),
        label,
        score,
      });
    }

    for (const row of rows) {
      const city = String(row.city || "");
      const county = String(row.county || "");
      const nameCn = String(row.name_cn || "").trim();
      const nameEn = String(row.name_en || "").trim();
      const scenicSpots = normalizeTextList(row.scenic_spots);

      if (stripRegionSuffix(city).includes(stripRegionSuffix(q))) {
        pushItem({
          type: "city",
          city,
          county,
          label: stripRegionSuffix(city),
          score: 60,
        });
      }
      if (stripRegionSuffix(county).includes(stripRegionSuffix(q))) {
        pushItem({
          type: "area",
          city,
          county,
          label: stripRegionSuffix(county),
          score: 58,
        });
      }
      if (nameCn && nameCn.toLowerCase().includes(qNorm)) {
        pushItem({ type: "hotel", city, county, label: nameCn, score: 50 });
      }
      if (nameEn && nameEn.toLowerCase().includes(qNorm)) {
        pushItem({ type: "hotel", city, county, label: nameEn, score: 38 });
      }
      for (const spot of scenicSpots) {
        if (String(spot).toLowerCase().includes(qNorm)) {
          pushItem({ type: "scenic", city, county, label: spot, score: 52 });
        }
      }
    }

    items.sort((a, b) => b.score - a.score || a.label.length - b.label.length);
    return res.json({
      code: 200,
      data: items.slice(0, limit).map(({ score, ...item }) => item),
    });
  } catch (e) {
    return res.status(500).json({ code: 500, msg: e.message });
  }
});

app.post("/api/auth/register", async (req, res) => {
  const p = req.body || {};
  const role = ["admin", "merchant", "user"].includes(p.role) ? p.role : "user";

  if (!hasRequiredFields(p, ["account", "email"])) {
    return res.status(400).json({ code: 400, msg: "账号与邮箱必填" });
  }

  if (
    role === "merchant" &&
    !hasRequiredFields(p, ["companyName", "realName"])
  ) {
    return res
      .status(400)
      .json({ code: 400, msg: "商家注册需填写企业名称与联系人" });
  }

  const plainPassword = String(p.password || "");
  const strengthTips = plainPassword
    ? strongPasswordMessage(plainPassword)
    : [];
  if (plainPassword && strengthTips.length) {
    return res
      .status(400)
      .json({ code: 400, msg: `密码强度不足：${strengthTips.join("、")}` });
  }

  const passwordCipher = resolvePasswordCipher(p);
  if (!passwordCipher)
    return res.status(400).json({ code: 400, msg: "密码不能为空" });

  try {
    const [dupRows] = await pool.query(
      "SELECT id FROM `User` WHERE account = ? OR email = ? LIMIT 1",
      [String(p.account).trim(), String(p.email).trim()],
    );
    if (dupRows.length) {
      return res.status(409).json({ code: 409, msg: "账号或邮箱已存在" });
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
      ],
    );

    const [rows] = await pool.query(
      "SELECT id, account, email, phone, name, real_name, company_name, role, createdAt FROM `User` WHERE id = ?",
      [userId],
    );
    return res.json({ code: 200, data: rows[0] });
  } catch (e) {
    return res.status(500).json({ code: 500, msg: e.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { identifier, account, passwordCipher, password } = req.body || {};
  const idValue = String(identifier || account || "").trim();
  if (!idValue)
    return res.status(400).json({ code: 400, msg: "请输入账号/邮箱/ID" });

  try {
    const [rows] = await pool.query(
      "SELECT id, account, email, phone, name, real_name, company_name, role, password, createdAt FROM `User` WHERE account = ? OR email = ? OR id = ? LIMIT 1",
      [idValue, idValue, idValue],
    );
    const user = rows[0];
    if (!user)
      return res.status(401).json({ code: 401, msg: "账号不存在或密码错误" });

    const cipher = resolvePasswordCipher({ passwordCipher, password });
    if (!verifyPassword(cipher, user.password)) {
      return res.status(401).json({ code: 401, msg: "账号不存在或密码错误" });
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

app.get("/api/auth/test-accounts", async (_req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, account, email, role, name, real_name, company_name, createdAt FROM `User` WHERE role IN ('admin','merchant') ORDER BY role, createdAt ASC",
    );
    res.json({ code: 200, data: rows });
  } catch (e) {
    res.status(500).json({ code: 500, msg: e.message });
  }
});

async function queryHotels(req) {
  const q = req.query || {};
  const scope = String(q.scope || "public");

  const where = [];
  const params = [];

  if (scope === "public") {
    where.push("a.audit_status = 1 AND a.online_status = 1");
  }

  if (scope === "merchant") {
    const merchantId = String(q.merchantId || "").trim();
    if (merchantId) {
      where.push("b.merchantId = ?");
      params.push(merchantId);
    }
  }

  // 保存在添加 auditStatus/onlineStatus 之前的过滤条件，用于统计所有状态的计数（status-independent）
  const whereBeforeStatus = [...where];
  const paramsBeforeStatus = [...params];

  if (q.auditStatus !== undefined && q.auditStatus !== "") {
    where.push("a.audit_status = ?");
    params.push(parseIntSafe(q.auditStatus, 0));
  }
  if (q.onlineStatus !== undefined && q.onlineStatus !== "") {
    where.push("a.online_status = ?");
    params.push(parseIntSafe(q.onlineStatus, 0));
  }

  if (q.city) {
    const cityRaw = String(q.city).trim();
    const cityNorm = normalizeRegionName(cityRaw);
    where.push(`(
      b.city = ?
      OR b.county = ?
      OR LOWER(REPLACE(REPLACE(REPLACE(b.city,'省',''),'市',''),'县','')) = ?
      OR LOWER(REPLACE(REPLACE(REPLACE(b.county,'省',''),'市',''),'县','')) = ?
    )`);
    params.push(cityRaw, cityRaw, cityNorm, cityNorm);
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
    where.push(
      `(${scenicSpots.map(() => "b.scenic_spots LIKE ?").join(" OR ")})`,
    );
    scenicSpots.forEach((spot) => params.push(`%${spot}%`));
  }

  if (q.starMin !== undefined && q.starMin !== "") {
    where.push("b.star_level >= ?");
    params.push(parseIntSafe(q.starMin, 1));
  }
  if (q.starMax !== undefined && q.starMax !== "") {
    where.push("b.star_level <= ?");
    params.push(parseIntSafe(q.starMax, 5));
  }
  const stars = normalizeTextList(q.stars)
    .map((x) => parseIntSafe(x, 0))
    .filter((x) => Number.isFinite(x) && x >= 1 && x <= 5);
  if (stars.length) {
    where.push(`b.star_level IN (${stars.map(() => "?").join(",")})`);
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
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY b.featured_weight DESC, b.created_time DESC`,
    params,
  );

  const rel = await getHotelRelations(rows.map((r) => r.id));
  let data = rows.map((r) => toHotel(r, r, rel));

  if (q.priceMin !== undefined && q.priceMin !== "") {
    const min = parseFloatSafe(q.priceMin, 0);
    data = data.filter((item) => item.priceFrom >= min);
  }
  if (q.priceMax !== undefined && q.priceMax !== "") {
    const max = parseFloatSafe(q.priceMax, 999999);
    data = data.filter((item) => (item.priceFrom || 0) <= max);
  }

  if (q.sort === "price_asc")
    data.sort((a, b) => (a.priceFrom || 0) - (b.priceFrom || 0));
  if (q.sort === "price_desc")
    data.sort((a, b) => (b.priceFrom || 0) - (a.priceFrom || 0));
  if (q.sort === "star_desc")
    data.sort((a, b) => (b.starLevel || 0) - (a.starLevel || 0));

  const page = Math.max(1, parseIntSafe(q.page, 1));
  const pageSize = Math.min(20, Math.max(1, parseIntSafe(q.pageSize, 10)));
  const offset = (page - 1) * pageSize;
  const paged = data.slice(offset, offset + pageSize);

  // 统计：基于不包含 auditStatus/onlineStatus 的基础过滤条件，返回所有状态分布（与页面顶部计数需求一致）
  const statSql = `SELECT
      COUNT(*) AS total,
      SUM(a.audit_status = 0) AS pending,
      SUM(a.audit_status = 1 AND a.online_status = 0) AS approvedOffline,
      SUM(a.audit_status = 1 AND a.online_status = 1) AS online,
      SUM(a.audit_status = 2) AS rejected
    FROM \`Hotel_Base\` b
    LEFT JOIN \`Hotel_Audit\` a ON a.hotel_id = b.id
    ${whereBeforeStatus.length ? `WHERE ${whereBeforeStatus.join(" AND ")}` : ""}`;

  const [statRows] = await pool.query(statSql, paramsBeforeStatus);
  const statRow =
    statRows && statRows[0]
      ? statRows[0]
      : { total: 0, pending: 0, approvedOffline: 0, online: 0, rejected: 0 };
  const stats = {
    total: Number(statRow.total || 0),
    pending: Number(statRow.pending || 0),
    approvedOffline: Number(statRow.approvedOffline || 0),
    online: Number(statRow.online || 0),
    rejected: Number(statRow.rejected || 0),
  };

  return {
    page,
    pageSize,
    total: data.length,
    hasMore: offset + pageSize < data.length,
    records: paged,
    stats,
  };
}

app.get("/api/hotels", async (req, res) => {
  try {
    const result = await queryHotels(req);
    res.json({
      code: 200,
      data: result.records,
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      hasMore: result.hasMore,
      stats: result.stats,
    });
  } catch (e) {
    res.status(500).json({ code: 500, msg: e.message });
  }
});

// 统计接口：按当前筛选条件返回各状态数量（total / pending / approvedOffline / online / rejected）
app.get("/api/hotels/stats", async (req, res) => {
  try {
    const q = req.query || {};
    const scope = String(q.scope || "public");

    const where = [];
    const params = [];

    if (scope === "public") {
      where.push("a.audit_status = 1 AND a.online_status = 1");
    }

    if (scope === "merchant") {
      const merchantId = String(q.merchantId || "").trim();
      if (merchantId) {
        where.push("b.merchantId = ?");
        params.push(merchantId);
      }
    }

    if (q.auditStatus !== undefined && q.auditStatus !== "") {
      where.push("a.audit_status = ?");
      params.push(parseIntSafe(q.auditStatus, 0));
    }
    if (q.onlineStatus !== undefined && q.onlineStatus !== "") {
      where.push("a.online_status = ?");
      params.push(parseIntSafe(q.onlineStatus, 0));
    }

    if (q.city) {
      const cityRaw = String(q.city).trim();
      const cityNorm = normalizeRegionName(cityRaw);
      where.push(`(
      b.city = ?
      OR b.county = ?
      OR LOWER(REPLACE(REPLACE(REPLACE(b.city,'省',''),'市',''),'县','')) = ?
      OR LOWER(REPLACE(REPLACE(REPLACE(b.county,'省',''),'市',''),'县','')) = ?
    )`);
      params.push(cityRaw, cityRaw, cityNorm, cityNorm);
    }

    if (q.keyword) {
      where.push(
        `(
      b.name_cn LIKE ?
      OR b.name_en LIKE ?
      OR b.address LIKE ?
      OR b.scenic_spots LIKE ?
      OR EXISTS (
        SELECT 1
        FROM ` +
        "`Hotel_Label_Rel`" +
        ` rel
        JOIN ` +
        "`Facility_Label`" +
        ` l ON rel.label_id = l.id
        WHERE rel.hotel_id = b.id
          AND (l.label_name LIKE ? OR l.label_code LIKE ?)
      )
    )`,
      );
      const kw = `%${String(q.keyword).trim()}%`;
      params.push(kw, kw, kw, kw, kw, kw);
    }

    // 统计查询，使用 MySQL 的条件求和避免拉取大量记录
    const statSql = `SELECT
      COUNT(*) AS total,
      SUM(a.audit_status = 0) AS pending,
      SUM(a.audit_status = 1 AND a.online_status = 0) AS approvedOffline,
      SUM(a.audit_status = 1 AND a.online_status = 1) AS online,
      SUM(a.audit_status = 2) AS rejected
      FROM \`Hotel_Base\` b
      LEFT JOIN \`Hotel_Audit\` a ON a.hotel_id = b.id
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}`;

    const [rows] = await pool.query(statSql, params);
    const r =
      rows && rows[0]
        ? rows[0]
        : { total: 0, pending: 0, approvedOffline: 0, online: 0, rejected: 0 };
    // ensure numbers
    const out = {
      total: Number(r.total || 0),
      pending: Number(r.pending || 0),
      approvedOffline: Number(r.approvedOffline || 0),
      online: Number(r.online || 0),
      rejected: Number(r.rejected || 0),
    };
    res.json({ code: 200, data: out });
  } catch (e) {
    res.status(500).json({ code: 500, msg: e.message });
  }
});

app.get("/api/hotels/:id", async (req, res) => {
  try {
    const item = await getHotelWithRelations(req.params.id);
    if (!item) return res.status(404).json({ code: 404, msg: "not found" });
    res.json({ code: 200, data: item });
  } catch (e) {
    res.status(500).json({ code: 500, msg: e.message });
  }
});

app.post("/api/hotels", async (req, res) => {
  const p = req.body || {};
  if (
    !hasRequiredFields(p, [
      "name",
      "nameEn",
      "province",
      "city",
      "county",
      "address",
    ])
  ) {
    return res.status(400).json({ code: 400, msg: "酒店基础信息不完整" });
  }

  const id = genId("hotel");
  const auditId = genId("audit");
  const merchantId = p.merchantId || p.createdBy || "merchant_001";
  const images = Array.isArray(p.images)
    ? p.images.filter(Boolean)
    : p.image
      ? [p.image]
      : [];
  const labels = normalizeTextList(p.labels || p.facilities || []);
  const scenicSpots = normalizeTextList(p.scenicSpots).join(",");

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
        p.intro || "",
        scenicSpots,
        p.latitude ? parseFloatSafe(p.latitude, null) : null,
        p.longitude ? parseFloatSafe(p.longitude, null) : null,
        parseIntSafe(p.featuredWeight, 0),
        toDateTime(p.openTime || p.start_date),
        formatDateForMySQL(),
      ],
    );

    await conn.query(
      `INSERT INTO \`Hotel_Audit\` (id, hotel_id, audit_status, online_status, status)
       VALUES (?, ?, 0, 0, 0)`,
      [auditId, id],
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

app.put("/api/hotels/:id", async (req, res) => {
  const { id } = req.params;
  const p = req.body || {};
  const images = Array.isArray(p.images)
    ? p.images.filter(Boolean)
    : p.image
      ? [p.image]
      : [];
  const labels = normalizeTextList(p.labels || p.facilities || []);
  const scenicSpots = normalizeTextList(p.scenicSpots).join(",");

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      `UPDATE \`Hotel_Base\`
       SET name_cn=?, name_en=?, province=?, city=?, county=?, address=?,
           star_level=?, intro=?, scenic_spots=?, latitude=?, longitude=?, featured_weight=?, start_date=?
       WHERE id=?`,
      [
        p.name || p.name_cn || "",
        p.nameEn || p.name_en || "",
        p.province || "",
        p.city || "",
        p.county || "",
        p.address || "",
        parseIntSafe(p.starLevel || p.star || 3, 3),
        p.intro || "",
        scenicSpots,
        p.latitude ? parseFloatSafe(p.latitude, null) : null,
        p.longitude ? parseFloatSafe(p.longitude, null) : null,
        parseIntSafe(p.featuredWeight, 0),
        toDateTime(p.openTime || p.start_date),
        id,
      ],
    );

    await conn.query(
      `UPDATE \`Hotel_Audit\`
       SET audit_status=0, online_status=0, status=0, audit_reason=NULL, auditor_id=NULL, audit_time=NULL, online_time=NULL
       WHERE hotel_id = ?`,
      [id],
    );

    await replaceHotelImages(id, images, conn);
    await upsertHotelLabels(id, labels, conn);
    await conn.commit();

    const item = await getHotelWithRelations(id);
    if (!item)
      return res.status(404).json({ code: 404, msg: "hotel not found" });
    res.json({ code: 200, data: item });
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ code: 500, msg: e.message });
  } finally {
    conn.release();
  }
});

app.delete("/api/hotels/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query(
      "UPDATE `Hotel_Audit` SET online_status = 0, status = 2 WHERE hotel_id = ?",
      [id],
    );
    res.json({ code: 200, msg: "offline success" });
  } catch (e) {
    res.status(500).json({ code: 500, msg: e.message });
  }
});

app.get("/api/hotels/:id/rooms", async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.query(
      "SELECT * FROM `Room` WHERE hotel_id = ? ORDER BY price ASC",
      [id],
    );
    const roomIds = rows.map((r) => r.id);
    let imgs = [];
    if (roomIds.length) {
      const [tmp] = await pool.query(
        `SELECT related_id, image_url FROM \`Image_Storage\` WHERE related_type='room' AND related_id IN (${roomIds
          .map(() => "?")
          .join(",")}) ORDER BY sort ASC`,
        roomIds,
      );
      imgs = tmp;
    }
    const map = imgs.reduce((acc, r) => {
      if (!acc[r.related_id]) acc[r.related_id] = r.image_url;
      return acc;
    }, {});
    res.json({
      code: 200,
      data: rows.map((r) => toLegacyRoom(r, map[r.id] || "")),
    });
  } catch (e) {
    res.status(500).json({ code: 500, msg: e.message });
  }
});

app.post("/api/hotels/:id/rooms", async (req, res) => {
  const { id: hotelId } = req.params;
  const p = req.body || {};
  console.log(
    "[debug] POST /api/hotels/%s/rooms payload:",
    hotelId,
    JSON.stringify(p).slice(0, 200),
  );
  const roomId = genId("room");
  try {
    await pool.query(
      `INSERT INTO \`Room\` (id, hotel_id, name, price, original_price, discount, remain, occupancy, size, breakfast_included, status, remark)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        roomId,
        hotelId,
        p.type || p.name || "标准房",
        Number(p.price != null ? p.price : p.current != null ? p.current : 0),
        p.original != null ? Number(p.original) : null,
        p.discount || null,
        Number(p.remain != null ? p.remain : 0),
        Number(p.occupancy || 2),
        p.size ? Number(p.size) : null,
        p.breakfastIncluded ? 1 : 0,
        String(p.status || "").toLowerCase() === "soldout" ? 1 : 0,
        p.remark || null,
      ],
    );
    if (p.image) {
      await pool.query(
        "INSERT INTO `Image_Storage` (id, related_type, related_id, image_url, sort) VALUES (?, ?, ?, ?, 0)",
        [genId("img"), "room", roomId, p.image],
      );
    }
    const [rows] = await pool.query("SELECT * FROM `Room` WHERE id = ?", [
      roomId,
    ]);
    if (!rows[0])
      return res.status(500).json({ code: 500, msg: "房型保存后读取失败" });
    res.json({ code: 200, data: toLegacyRoom(rows[0], p.image || "") });
  } catch (e) {
    res.status(500).json({ code: 500, msg: e.message });
  }
});

async function handleBulkRoomSave(req, res) {
  const { id: hotelId } = req.params;
  const rooms = Array.isArray(req.body?.rooms) ? req.body.rooms : [];
  console.log("[debug] bulk-save rooms count:", rooms.length);
  if (rooms.length)
    console.log(
      "[debug] first item sample:",
      JSON.stringify(rooms[0]).slice(0, 200),
    );
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [oldRows] = await conn.query(
      "SELECT id FROM `Room` WHERE hotel_id = ?",
      [hotelId],
    );
    for (const r of oldRows) {
      await conn.query(
        "DELETE FROM `Image_Storage` WHERE related_type = ? AND related_id = ?",
        ["room", r.id],
      );
    }
    await conn.query("DELETE FROM `Room` WHERE hotel_id = ?", [hotelId]);

    for (const item of rooms) {
      const roomId = item.id || genId("room");
      await conn.query(
        `INSERT INTO \`Room\` (id, hotel_id, name, price, original_price, discount, remain, occupancy, size, breakfast_included, status, remark)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          roomId,
          hotelId,
          item.type || item.name || "标准房",
          Number(
            item.price != null
              ? item.price
              : item.current != null
                ? item.current
                : 0,
          ),
          item.original != null ? Number(item.original) : null,
          item.discount || null,
          Number(item.remain != null ? item.remain : 0),
          Number(item.occupancy || 2),
          item.size ? Number(item.size) : null,
          item.breakfastIncluded ? 1 : 0,
          String(item.status || "").toLowerCase() === "soldout" ? 1 : 0,
          item.remark || null,
        ],
      );
      if (item.image) {
        await conn.query(
          "INSERT INTO `Image_Storage` (id, related_type, related_id, image_url, sort) VALUES (?, ?, ?, ?, 0)",
          [genId("img"), "room", roomId, item.image],
        );
      }
    }
    await conn.commit();

    const [savedRows] = await pool.query(
      "SELECT * FROM `Room` WHERE hotel_id = ? ORDER BY price ASC",
      [hotelId],
    );
    console.log(
      "[debug] bulk-save committed, fetched savedRows count:",
      savedRows.length,
    );
    const roomIds = savedRows.map((x) => x.id);
    let images = [];
    if (roomIds.length) {
      const [tmp] = await pool.query(
        `SELECT related_id, image_url FROM \`Image_Storage\` WHERE related_type='room' AND related_id IN (${roomIds
          .map(() => "?")
          .join(",")}) ORDER BY sort ASC`,
        roomIds,
      );
      images = tmp;
    }
    const imageMap = images.reduce((acc, row) => {
      if (!acc[row.related_id]) acc[row.related_id] = row.image_url;
      return acc;
    }, {});

    const safeRows = savedRows.filter(Boolean);
    return res.json({
      code: 200,
      msg: "rooms updated",
      data: safeRows.map((r) => toLegacyRoom(r, imageMap[r.id] || "")),
    });
  } catch (e) {
    await conn.rollback();
    return res.status(500).json({ code: 500, msg: e.message });
  } finally {
    conn.release();
  }
}

app.put("/api/hotels/:id/rooms/bulk", handleBulkRoomSave);
app.put("/api/hotels/:id/rooms/bulk-save", handleBulkRoomSave);

app.put("/api/hotels/:id/rooms/:roomId", async (req, res) => {
  const { roomId } = req.params;
  const p = req.body || {};
  try {
    await pool.query(
      `UPDATE \`Room\`
       SET name=?, price=?, original_price=?, discount=?, remain=?, occupancy=?, size=?, breakfast_included=?, status=?, remark=?
       WHERE id=?`,
      [
        p.type || p.name || "标准房",
        Number(p.price != null ? p.price : p.current != null ? p.current : 0),
        p.original != null ? Number(p.original) : null,
        p.discount || null,
        Number(p.remain != null ? p.remain : 0),
        Number(p.occupancy || 2),
        p.size ? Number(p.size) : null,
        p.breakfastIncluded ? 1 : 0,
        String(p.status || "").toLowerCase() === "soldout" ? 1 : 0,
        p.remark || null,
        roomId,
      ],
    );
    if (p.image) {
      await pool.query(
        "DELETE FROM `Image_Storage` WHERE related_type = ? AND related_id = ?",
        ["room", roomId],
      );
      await pool.query(
        "INSERT INTO `Image_Storage` (id, related_type, related_id, image_url, sort) VALUES (?, ?, ?, ?, 0)",
        [genId("img"), "room", roomId, p.image],
      );
    }
    const [rows] = await pool.query("SELECT * FROM `Room` WHERE id = ?", [
      roomId,
    ]);
    if (!rows[0]) return res.status(404).json({ code: 404, msg: "房型不存在" });
    res.json({ code: 200, data: toLegacyRoom(rows[0], p.image || "") });
  } catch (e) {
    res.status(500).json({ code: 500, msg: e.message });
  }
});

app.delete("/api/hotels/:id/rooms/:roomId", async (req, res) => {
  const { roomId } = req.params;
  try {
    await pool.query(
      "DELETE FROM `Image_Storage` WHERE related_type = ? AND related_id = ?",
      ["room", roomId],
    );
    await pool.query("DELETE FROM `Room` WHERE id = ?", [roomId]);
    res.json({ code: 200, msg: "deleted" });
  } catch (e) {
    res.status(500).json({ code: 500, msg: e.message });
  }
});

app.get("/api/admin/hotels/pending", async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT b.*, a.audit_status, a.online_status, a.status, a.audit_reason, a.auditor_id, a.audit_time, a.online_time
       FROM \`Hotel_Base\` b
       JOIN \`Hotel_Audit\` a ON a.hotel_id = b.id
       WHERE a.audit_status = 0
       ORDER BY b.created_time DESC`,
    );
    const rel = await getHotelRelations(rows.map((r) => r.id));
    res.json({ code: 200, data: rows.map((r) => toHotel(r, r, rel)) });
  } catch (e) {
    res.status(500).json({ code: 500, msg: e.message });
  }
});

app.post("/api/admin/hotels/:id/audit", async (req, res) => {
  const { id } = req.params;
  const action = String(req.body?.action || "").toLowerCase();
  const reason = String(req.body?.reason || "").trim();
  const auditorId = String(req.body?.auditorId || "admin_001");

  if (!["approve", "reject"].includes(action)) {
    return res
      .status(400)
      .json({ code: 400, msg: "action 必须为 approve/reject" });
  }

  try {
    if (action === "approve") {
      await pool.query(
        `UPDATE \`Hotel_Audit\`
         SET audit_status = 1, online_status = 0, status = 2, audit_reason = ?, auditor_id = ?, audit_time = ?, online_time = NULL
         WHERE hotel_id = ?`,
        [
          reason || "审核通过，待发布上线。",
          auditorId,
          formatDateForMySQL(),
          id,
        ],
      );
    } else {
      await pool.query(
        `UPDATE \`Hotel_Audit\`
         SET audit_status = 2, online_status = 0, status = 3, audit_reason = ?, auditor_id = ?, audit_time = ?, online_time = NULL
         WHERE hotel_id = ?`,
        [
          reason || "审核未通过，请根据备注修改后重新提交。",
          auditorId,
          formatDateForMySQL(),
          id,
        ],
      );
    }
    const item = await getHotelWithRelations(id);
    res.json({ code: 200, data: item });
  } catch (e) {
    res.status(500).json({ code: 500, msg: e.message });
  }
});

app.post("/api/admin/hotels/:id/publish", async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.query(
      "SELECT audit_status FROM `Hotel_Audit` WHERE hotel_id = ? LIMIT 1",
      [id],
    );
    if (!rows[0])
      return res.status(404).json({ code: 404, msg: "未找到审核记录" });
    if (Number(rows[0].audit_status) !== 1) {
      return res
        .status(400)
        .json({ code: 400, msg: "酒店尚未审核通过，不能上线" });
    }

    await pool.query(
      `UPDATE \`Hotel_Audit\`
       SET online_status = 1, status = 1, online_time = ?
       WHERE hotel_id = ?`,
      [formatDateForMySQL(), id],
    );

    const item = await getHotelWithRelations(id);
    res.json({ code: 200, data: item });
  } catch (e) {
    res.status(500).json({ code: 500, msg: e.message });
  }
});

app.post("/api/admin/hotels/:id/offline", async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query(
      `UPDATE \`Hotel_Audit\`
       SET online_status = 0, status = 2
       WHERE hotel_id = ?`,
      [id],
    );
    const item = await getHotelWithRelations(id);
    res.json({ code: 200, data: item });
  } catch (e) {
    res.status(500).json({ code: 500, msg: e.message });
  }
});

app.get("/api/submissions", async (req, res) => {
  req.query.scope = "admin";
  req.query.auditStatus = "0";
  try {
    const result = await queryHotels(req);
    res.json({ code: 200, data: result.records });
  } catch (e) {
    res.status(500).json({ code: 500, msg: e.message });
  }
});

app.post("/api/submissions", async (req, res) => {
  const p = req.body || {};
  if (
    !hasRequiredFields(p, [
      "name",
      "nameEn",
      "province",
      "city",
      "county",
      "address",
    ])
  ) {
    return res.status(400).json({ code: 400, msg: "酒店基础信息不完整" });
  }

  const id = genId("hotel");
  const auditId = genId("audit");
  const merchantId = p.merchantId || p.createdBy || "merchant_001";
  const images = Array.isArray(p.images)
    ? p.images.filter(Boolean)
    : p.image
      ? [p.image]
      : [];
  const labels = normalizeTextList(p.labels || p.facilities || []);
  const scenicSpots = normalizeTextList(p.scenicSpots).join(",");

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
        p.intro || "",
        scenicSpots,
        p.latitude ? parseFloatSafe(p.latitude, null) : null,
        p.longitude ? parseFloatSafe(p.longitude, null) : null,
        parseIntSafe(p.featuredWeight, 0),
        toDateTime(p.openTime || p.start_date),
        formatDateForMySQL(),
      ],
    );

    await conn.query(
      `INSERT INTO \`Hotel_Audit\` (id, hotel_id, audit_status, online_status, status)
       VALUES (?, ?, 0, 0, 0)`,
      [auditId, id],
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

app.post("/api/submissions/:id/approve", async (req, res) => {
  const { id } = req.params;
  const auditorId = String(req.body?.auditorId || "admin_001");
  const reason = String(req.body?.reason || "").trim();
  try {
    await pool.query(
      `UPDATE \`Hotel_Audit\`
       SET audit_status = 1, online_status = 0, status = 2, audit_reason = ?, auditor_id = ?, audit_time = ?, online_time = NULL
       WHERE hotel_id = ?`,
      [reason || "审核通过，待发布上线。", auditorId, formatDateForMySQL(), id],
    );
    const item = await getHotelWithRelations(id);
    return res.json({ code: 200, data: item });
  } catch (e) {
    return res.status(500).json({ code: 500, msg: e.message });
  }
});

app.post("/api/submissions/:id/reject", async (req, res) => {
  const { id } = req.params;
  const auditorId = String(req.body?.auditorId || "admin_001");
  const reason = String(req.body?.reason || "").trim();
  try {
    await pool.query(
      `UPDATE \`Hotel_Audit\`
       SET audit_status = 2, online_status = 0, status = 3, audit_reason = ?, auditor_id = ?, audit_time = ?, online_time = NULL
       WHERE hotel_id = ?`,
      [
        reason || "审核未通过，请根据备注修改后重新提交。",
        auditorId,
        formatDateForMySQL(),
        id,
      ],
    );
    return res.json({ code: 200, msg: "rejected" });
  } catch (e) {
    return res.status(500).json({ code: 500, msg: e.message });
  }
});

app.get("/api/mobile/home-banner", async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT b.*, a.audit_status, a.online_status
       FROM \`Hotel_Base\` b
       JOIN \`Hotel_Audit\` a ON a.hotel_id = b.id
       WHERE a.audit_status = 1 AND a.online_status = 1
       ORDER BY b.featured_weight DESC, b.created_time DESC
       LIMIT 5`,
    );
    const rel = await getHotelRelations(rows.map((r) => r.id));
    const data = rows.map((r) => {
      const item = toHotel(r, r, rel);
      return {
        id: item.id,
        hotelId: item.id,
        title: `${item.name} 限时特惠`,
        subtitle: `${item.city} · ${item.priceFrom ? `${item.priceFrom}元起` : "优选推荐"}`,
        image: item.image,
        featuredWeight: item.featuredWeight,
      };
    });
    res.json({ code: 200, data });
  } catch (e) {
    res.status(500).json({ code: 500, msg: e.message });
  }
});

app.get("/api/mobile/hotels", async (req, res) => {
  try {
    req.query.scope = "public";
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
          // 不再默认把缺失的 remain 当作可订库存 (如之前用 status===0 -> 10)，
          // 优先根据数据库字段 remain 判断可售状态，缺失时退回到 status 字段。
          remain: Number(x.remain != null ? x.remain : 0),
          status:
            x.remain != null
              ? Number(x.remain) > 0
                ? "available"
                : "soldout"
              : Number(x.status || 0) === 0
                ? "available"
                : "soldout",
          breakfastIncluded: Number(x.breakfast_included || 0) === 1,
          raw: x,
          image:
            rel.roomImageByRoom[x.id] ||
            `https://picsum.photos/seed/room_${x.id}/800/500`,
        })),
      });
    }

    res.json({
      code: 200,
      data,
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      hasMore: result.hasMore,
    });
  } catch (e) {
    res.status(500).json({ code: 500, msg: e.message });
  }
});

app.get("/api/mobile/hotels/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT b.*, a.audit_status, a.online_status, a.status, a.audit_reason, a.auditor_id, a.audit_time, a.online_time
       FROM \`Hotel_Base\` b
       JOIN \`Hotel_Audit\` a ON a.hotel_id = b.id
       WHERE b.id = ? AND a.audit_status = 1 AND a.online_status = 1`,
      [id],
    );
    if (!rows[0]) return res.status(404).json({ code: 404, msg: "not found" });

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
        remain: Number(x.remain != null ? x.remain : x.status === 0 ? 10 : 0),
        status: Number(x.status || 0) === 0 ? "available" : "soldout",
        breakfastIncluded: Number(x.breakfast_included || 0) === 1,
        raw: x,
        image:
          rel.roomImageByRoom[x.id] ||
          `https://picsum.photos/seed/room_${x.id}/800/500`,
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

function mapMobileOrderRow(row) {
  const statusTextMap = {
    pending: "待付款",
    upcoming: "未出行",
    completed: "已完成",
    reviewing: "待点评",
    cancelled: "已取消",
  };
  const payStatusTextMap = {
    unpaid: "未支付",
    paid: "已支付",
    refunded: "已退款",
  };

  const checkIn = toDateOnly(row.check_in);
  const checkOut = toDateOnly(row.check_out);
  const nights = Number(row.nights || diffNightsSafe(checkIn, checkOut));

  return {
    id: row.id,
    customerId: row.customer_id,
    hotelId: row.hotel_id,
    roomId: row.room_id,
    status: row.status,
    // 统一前端主要展示的状态为：未支付 / 已支付 / 已取消
    // 优先依据 payment_status 决定未支付/已支付；若订单状态为 cancelled 则显示已取消
    statusLabel:
      (row.payment_status === "unpaid" && "未支付") ||
      (row.status === "cancelled" && "已取消") ||
      (row.payment_status === "paid" && "已支付") ||
      statusTextMap[row.status] ||
      row.status ||
      "",
    paymentStatus: row.payment_status,
    paymentStatusLabel:
      payStatusTextMap[row.payment_status] || row.payment_status || "",
    checkIn,
    checkOut,
    nights,
    roomsCount: Number(row.rooms_count || 1),
    adultsCount: Number(row.adults_count || 1),
    childrenCount: Number(row.children_count || 0),
    guestName: row.guest_name,
    guestPhone: row.guest_phone,
    priceSubtotal: Number(row.price_subtotal || 0),
    couponAmount: Number(row.coupon_amount || 0),
    payableAmount: Number(row.payable_amount || 0),
    currency: row.currency || "CNY",
    notes: row.notes || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    hotelName: row.hotel_name || "",
    hotelCity: row.hotel_city || "",
    hotelCounty: row.hotel_county || "",
    hotelAddress: row.hotel_address || "",
    roomName: row.room_name || "",
  };
}

// 从请求头或自定义 header 中解析 token 并查出对应 customer id
async function getCustomerIdFromReq(req) {
  const authHeader =
    req.headers?.authorization ||
    req.headers?.["x-customer-token"] ||
    req.headers?.["x-token"] ||
    "";
  const token = String(authHeader || "")
    .replace(/^Bearer\s*/i, "")
    .trim();
  if (!token) return null;
  try {
    const [rows] = await pool.query(
      "SELECT id FROM `Customer` WHERE token = ? LIMIT 1",
      [token],
    );
    return rows && rows[0] && rows[0].id ? rows[0].id : null;
  } catch (_e) {
    return null;
  }
}

app.post("/api/mobile/orders", async (req, res) => {
  const p = req.body || {};
  // 强制使用已登录用户的 customer_id（从 token 中解析），不能由客户端任意指定
  const tokenCustomerId = await getCustomerIdFromReq(req);
  if (!tokenCustomerId)
    return res.status(401).json({ code: 401, msg: "请先登录后再下单" });
  const customerId = tokenCustomerId;

  if (
    !hasRequiredFields(p, [
      "hotelId",
      "roomId",
      "checkIn",
      "checkOut",
      "guestName",
      "guestPhone",
    ])
  ) {
    return res.status(400).json({
      code: 400,
      msg: "缺少必填字段：酒店、房型、入住离店与联系人信息",
    });
  }

  const checkIn = String(p.checkIn).slice(0, 10);
  const checkOut = String(p.checkOut).slice(0, 10);
  const nights = p.nights
    ? parseIntSafe(p.nights, 1)
    : diffNightsSafe(checkIn, checkOut);
  const roomsCount = parseIntSafe(p.roomsCount || p.rooms_count || 1, 1);
  const adultsCount = parseIntSafe(
    p.adultsCount || p.adults_count || roomsCount,
    roomsCount,
  );
  const childrenCount = parseIntSafe(
    p.childrenCount || p.children_count || 0,
    0,
  );
  const priceSubtotal = parseFloatSafe(p.priceSubtotal ?? p.price_subtotal, 0);
  const couponAmount = parseFloatSafe(p.couponAmount ?? p.coupon_amount, 0);
  const payableAmount = parseFloatSafe(
    p.payableAmount ?? p.payable_amount ?? priceSubtotal - couponAmount,
    0,
  );

  const id = genId("order");
  const now = formatDateForMySQL();

  try {
    const insertRow = {
      id,
      customer_id: customerId,
      hotel_id: String(p.hotelId),
      room_id: String(p.roomId),
      check_in: checkIn,
      check_out: checkOut,
      nights,
      rooms_count: roomsCount,
      adults_count: adultsCount,
      children_count: childrenCount,
      guest_name: String(p.guestName || "").trim(),
      guest_phone: String(p.guestPhone || "").trim(),
      price_subtotal: priceSubtotal,
      coupon_amount: couponAmount,
      payable_amount: payableAmount,
      currency: String(p.currency || "CNY"),
      status: "pending",
      payment_method: String(p.paymentMethod || "online"),
      payment_status: "unpaid",
      notes: String(p.notes || ""),
      created_at: now,
      updated_at: now,
    };

    // 使用事务：先检查并更新房型剩余数量，再插入订单，保证并发安全
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // 查询房型剩余数量并加锁（基于事务）
      const [roomRows] = await conn.query(
        "SELECT remain FROM `Room` WHERE id = ? LIMIT 1",
        [String(p.roomId)],
      );
      const roomRow = roomRows[0] || {};
      const remainVal = roomRow.remain;

      // 如果数据库中存在明确的剩余数量（number），则需校验是否足够
      if (typeof remainVal === "number") {
        if (remainVal < roomsCount) {
          await conn.rollback();
          conn.release();
          return res
            .status(400)
            .json({ code: 400, msg: "房间数量不足，无法下单" });
        }

        // 扣减剩余房间数
        const [upd] = await conn.query(
          "UPDATE `Room` SET remain = remain - ? WHERE id = ? AND remain >= ?",
          [roomsCount, String(p.roomId), roomsCount],
        );
        if (!upd || !upd.affectedRows) {
          await conn.rollback();
          conn.release();
          return res
            .status(409)
            .json({ code: 409, msg: "房间数量变动，当前库存不足，请重试" });
        }
      }

      // 插入订单
      await conn.query("INSERT INTO `orders` SET ?", [insertRow]);

      const [rows] = await conn.query(
        "SELECT o.*, h.name_cn AS hotel_name, h.city AS hotel_city, h.county AS hotel_county, h.address AS hotel_address, r.name AS room_name FROM `orders` o LEFT JOIN `Hotel_Base` h ON o.hotel_id = h.id LEFT JOIN `Room` r ON o.room_id = r.id WHERE o.id = ? LIMIT 1",
        [id],
      );

      const orderRow = rows[0];

      await conn.commit();
      conn.release();
      return res.json({ code: 200, data: mapMobileOrderRow(orderRow) });
    } catch (err) {
      await conn.rollback();
      conn.release();
      throw err;
    }
  } catch (e) {
    return res.status(500).json({ code: 500, msg: e.message });
  }
});

// 移动端：订单支付成功，更新支付状态为已支付
app.post("/api/mobile/orders/:id/pay", async (req, res) => {
  const id = String(req.params.id || "").trim();
  if (!id) {
    return res.status(400).json({ code: 400, msg: "缺少必要参数：订单 id" });
  }

  const now = formatDateForMySQL();

  try {
    // 验证 token 并使用 token 对应的 customer_id，防止越权
    const tokenCustomerId = await getCustomerIdFromReq(req);
    if (!tokenCustomerId) {
      return res.status(401).json({ code: 401, msg: "请先登录" });
    }

    let sql =
      "UPDATE `orders` SET status = ?, payment_status = ?, updated_at = ? WHERE id = ?";
    const params = ["upcoming", "paid", now, id];
    sql += " AND customer_id = ?";
    params.push(tokenCustomerId);

    const [result] = await pool.query(sql, params);

    if (!result || !result.affectedRows) {
      return res
        .status(404)
        .json({ code: 404, msg: "订单不存在或不属于当前用户" });
    }

    const [rows] = await pool.query(
      "SELECT o.*, h.name_cn AS hotel_name, h.city AS hotel_city, h.county AS hotel_county, h.address AS hotel_address, r.name AS room_name FROM `orders` o LEFT JOIN `Hotel_Base` h ON o.hotel_id = h.id LEFT JOIN `Room` r ON o.room_id = r.id WHERE o.id = ? LIMIT 1",
      [id],
    );
    const orderRow = rows[0];
    return res.json({ code: 200, data: mapMobileOrderRow(orderRow) });
  } catch (e) {
    return res.status(500).json({ code: 500, msg: e.message });
  }
});

// 移动端：取消订单
app.put("/api/mobile/orders/:id/cancel", async (req, res) => {
  const id = String(req.params.id || "").trim();
  if (!id) {
    return res.status(400).json({ code: 400, msg: "缺少必要参数：订单 id" });
  }
  try {
    const tokenCustomerId = await getCustomerIdFromReq(req);
    if (!tokenCustomerId) {
      return res.status(401).json({ code: 401, msg: "请先登录" });
    }

    // 使用事务：先读取订单并回滚房型 remain，再更新订单状态，保证并发安全
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // 锁定订单行
      const [orderRows] = await conn.query(
        "SELECT * FROM `orders` WHERE id = ? LIMIT 1 FOR UPDATE",
        [id],
      );
      const orderRow = orderRows[0];
      if (!orderRow) {
        await conn.rollback();
        conn.release();
        return res.status(404).json({ code: 404, msg: "订单不存在" });
      }
      if (String(orderRow.customer_id) !== String(tokenCustomerId)) {
        await conn.rollback();
        conn.release();
        return res.status(403).json({ code: 403, msg: "无权限取消该订单" });
      }
      if (orderRow.status === "cancelled") {
        await conn.rollback();
        conn.release();
        return res.status(400).json({ code: 400, msg: "订单已取消" });
      }

      // 回滚房型库存：将 orders.rooms_count 加回到 Room.remain
      const roomsCount = Number(orderRow.rooms_count || 0);
      const roomId = String(orderRow.room_id);
      if (roomsCount > 0 && roomId) {
        await conn.query(
          "UPDATE `Room` SET remain = COALESCE(remain,0) + ? WHERE id = ?",
          [roomsCount, roomId],
        );
      }

      // 更新订单状态为 cancelled
      const now = formatDateForMySQL();
      const [upd] = await conn.query(
        "UPDATE `orders` SET status = ?, updated_at = ? WHERE id = ? AND customer_id = ?",
        ["cancelled", now, id, tokenCustomerId],
      );
      if (!upd || !upd.affectedRows) {
        await conn.rollback();
        conn.release();
        return res.status(500).json({ code: 500, msg: "取消订单失败" });
      }

      // 返回更新后的订单信息
      const [rows] = await conn.query(
        "SELECT o.*, h.name_cn AS hotel_name, h.city AS hotel_city, h.county AS hotel_county, h.address AS hotel_address, r.name AS room_name FROM `orders` o LEFT JOIN `Hotel_Base` h ON o.hotel_id = h.id LEFT JOIN `Room` r ON o.room_id = r.id WHERE o.id = ? LIMIT 1",
        [id],
      );
      const updatedOrder = rows[0];

      await conn.commit();
      conn.release();
      return res.json({ code: 200, data: mapMobileOrderRow(updatedOrder) });
    } catch (err) {
      await conn.rollback();
      conn.release();
      throw err;
    }
  } catch (e) {
    return res.status(500).json({ code: 500, msg: e.message });
  }
});

// 获取订单费用明细（按房价、晚数、优惠项汇总）
app.get("/api/mobile/orders/:id/breakdown", async (req, res) => {
  const id = String(req.params.id || "").trim();
  if (!id) return res.status(400).json({ code: 400, msg: "缺少订单 id" });
  try {
    const tokenCustomerId = await getCustomerIdFromReq(req);
    if (!tokenCustomerId)
      return res.status(401).json({ code: 401, msg: "请先登录" });

    const [rows] = await pool.query(
      "SELECT o.*, r.price AS room_price, r.original_price AS room_original_price FROM `orders` o LEFT JOIN `Room` r ON o.room_id = r.id WHERE o.id = ? LIMIT 1",
      [id],
    );
    const order = rows[0];
    if (!order) return res.status(404).json({ code: 404, msg: "订单不存在" });
    if (String(order.customer_id) !== String(tokenCustomerId))
      return res.status(403).json({ code: 403, msg: "无权限查看该订单" });

    const checkIn = toDateOnly(order.check_in) || null;
    const checkOut = toDateOnly(order.check_out) || null;
    const nights = Number(order.nights || 1);
    const unit = Number(
      order.room_price || order.price_subtotal / Math.max(1, nights) || 0,
    );
    const originalUnit = Number(order.room_original_price || 0);

    // 聚合为一行房费（显示房价总额），并从数据库读取折扣（如 coupon_amount）
    const roomsCount = Number(order.rooms_count || 1);
    const nightsCount = Number(order.nights || nights || 1);
    const subtotal = Number(order.price_subtotal || 0);
    const unitPriceComputed = Number(order.room_price || 0);

    const items = [];
    // 房费：显示为 "房费 × {rooms}间 × {nights}晚"，金额来自 price_subtotal
    items.push({
      label: `房费 × ${roomsCount}间 × ${nightsCount}晚`,
      unitPrice: unitPriceComputed,
      amount: subtotal,
    });

    const discounts = [];
    // 将数据库中的 coupon_amount 映射为限时优惠（若有）
    if (order.coupon_amount && Number(order.coupon_amount) !== 0) {
      discounts.push({
        label: "限时优惠",
        amount: -Number(order.coupon_amount),
      });
    }

    const total = Number(order.payable_amount || 0);
    // 折扣合计（discounts 中的金额通常为负数）
    const discountsSum = (discounts || []).reduce(
      (s, d) => s + Number(d.amount || 0),
      0,
    );
    // 要求：第一行价格等于 总计 + 限时优惠（注意 discounts 中为负值），
    // 等价于：items[0].amount = total - discountsSum
    if (items.length > 0) {
      items[0].amount = Number(total - discountsSum || 0);
      // 若 unitPrice 未提供且有 nights/rooms，则尝试计算每间每晚单价
      try {
        const denom = Math.max(1, roomsCount * nightsCount);
        items[0].unitPrice = Number(
          items[0].amount / denom || items[0].unitPrice || 0,
        );
      } catch (_e) { }
    }

    return res.json({
      code: 200,
      data: {
        items,
        discounts,
        total,
        currency: order.currency || "CNY",
      },
    });
  } catch (e) {
    return res.status(500).json({ code: 500, msg: e.message });
  }
});

app.get("/api/mobile/orders", async (req, res) => {
  // 强制从 token 中解析 customer_id，拒绝客户端传入任意 customerId
  const tokenCustomerId = await getCustomerIdFromReq(req);
  if (!tokenCustomerId)
    return res.status(401).json({ code: 401, msg: "请先登录" });
  const customerId = tokenCustomerId;

  const page = parseIntSafe(req.query.page || 1, 1) || 1;
  const pageSize = parseIntSafe(req.query.pageSize || 10, 10) || 10;
  const status = String(req.query.status || "").trim();

  const where = ["o.customer_id = ?"];
  const params = [customerId];
  if (status && status !== "all") {
    // 支持按 payment_status 过滤（unpaid/paid/refunded）或按订单状态过滤（cancelled 等）
    if (status === "unpaid" || status === "paid" || status === "refunded") {
      where.push("o.payment_status = ?");
      params.push(status);
    } else if (status === "cancelled") {
      where.push("o.status = ?");
      params.push("cancelled");
    } else {
      // 兼容旧的 status 值（pending/upcoming/completed 等）
      where.push("o.status = ?");
      params.push(status);
    }
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const offset = (page - 1) * pageSize;
  try {
    const listParams = params.slice();
    // 查询列表
    const [rows] = await pool.query(
      "SELECT o.*, h.name_cn AS hotel_name, h.city AS hotel_city, h.county AS hotel_county, h.address AS hotel_address, r.name AS room_name FROM `orders` o LEFT JOIN `Hotel_Base` h ON o.hotel_id = h.id LEFT JOIN `Room` r ON o.room_id = r.id " +
      whereSql +
      " ORDER BY o.created_at DESC LIMIT ? OFFSET ?",
      listParams.concat([pageSize, offset]),
    );
    if (process.env.NODE_ENV !== "production") {
      try {
        console.log(
          "[orders:list] where=",
          whereSql,
          "params=",
          listParams,
          "limit=",
          pageSize,
          "offset=",
          offset,
        );
      } catch (_e) { }
    }

    // 查询总数
    const [countRows] = await pool.query(
      "SELECT COUNT(*) AS total FROM `orders` o " + whereSql,
      params,
    );
    const total = (countRows && countRows[0] && countRows[0].total) || 0;

    const mapped = (rows || []).map((r) => mapMobileOrderRow(r));
    return res.json({
      code: 200,
      data: mapped,
      page,
      pageSize,
      total,
      hasMore: offset + (mapped.length || 0) < total,
    });
  } catch (e) {
    return res.status(500).json({ code: 500, msg: e.message });
  }
});

app.post("/api/mobile/login", async (req, res) => {
  const { username, identifier, password, passwordCipher } = req.body || {};
  const idValue = String(identifier || username || "").trim();
  if (!idValue) return res.status(400).json({ code: 400, msg: "请输入账号" });
  try {
    const [rows] = await pool.query(
      "SELECT id, account, email, phone, name, real_name, company_name, role, password, createdAt FROM `User` WHERE account = ? OR email = ? OR id = ? LIMIT 1",
      [idValue, idValue, idValue],
    );
    const user = rows[0];
    if (!user)
      return res.status(401).json({ code: 401, msg: "账号不存在或密码错误" });
    const cipher = resolvePasswordCipher({ passwordCipher, password });
    if (!verifyPassword(cipher, user.password)) {
      return res.status(401).json({ code: 401, msg: "账号不存在或密码错误" });
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

app.get("/api/orders/:hotelId", async (_req, res) => {
  res.json({ code: 200, data: [] });
});

app.put("/api/orders/:hotelId", async (_req, res) => {
  res.json({ code: 200, msg: "orders disabled in strict schema" });
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
        server.on("error", (err) => reject(err));
      });
      return port;
    } catch (err) {
      if (err && err.code === "EADDRINUSE") {
        port += 1;
        continue;
      }
      throw err;
    }
  }
  throw new Error("Unable to bind server to any port");
}

initDbPool()
  .then(async () => {
    try {
      const usedPort = await startServerWithRetry(PORT, 8);
      console.log(`Server started on port ${usedPort}`);
    } catch (err) {
      console.error("Failed to start server:", err);
      process.exit(1);
    }
  })
  .catch((err) => {
    console.error("Failed to initialize DB pool:", err);
    process.exit(1);
  });
