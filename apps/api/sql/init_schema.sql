SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;
CREATE DATABASE IF NOT EXISTS yisu_db;
USE yisu_db;

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) NOT NULL,
  email VARCHAR(255) NOT NULL,
  name VARCHAR(100) NULL DEFAULT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'merchant',
  password VARCHAR(255) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_users_email (email),
  KEY idx_users_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS hotel_base (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  merchant_id VARCHAR(64) NULL DEFAULT NULL,
  legacy_submission_id BIGINT NULL DEFAULT NULL,
  name_cn VARCHAR(255) NOT NULL,
  name_en VARCHAR(255) NOT NULL DEFAULT '',
  province VARCHAR(50) NOT NULL DEFAULT '',
  city VARCHAR(50) NOT NULL DEFAULT '',
  county VARCHAR(50) NOT NULL DEFAULT '',
  address VARCHAR(500) NOT NULL,
  star_rating DECIMAL(2,1) NOT NULL DEFAULT 4.5,
  opening_date DATE NOT NULL,
  nearby_attractions JSON NULL,
  transportation_info TEXT NULL,
  discount_info TEXT NULL,
  created_by VARCHAR(100) NULL DEFAULT 'merchant',
  created_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  is_deleted TINYINT NOT NULL DEFAULT 0,
  KEY idx_hotel_merchant (merchant_id),
  KEY idx_hotel_region (province, city, county),
  KEY idx_hotel_deleted (is_deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS hotel_audit (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  hotel_id BIGINT NOT NULL,
  audit_status TINYINT NOT NULL DEFAULT 0 COMMENT '0-待审核 1-通过 2-不通过',
  online_status TINYINT NOT NULL DEFAULT 0 COMMENT '0-下架 1-上架',
  status TINYINT NOT NULL DEFAULT 0 COMMENT '0-待审 1-上架 2-下架 3-驳回',
  audit_reason VARCHAR(500) NULL DEFAULT NULL,
  auditor_id VARCHAR(64) NULL DEFAULT NULL,
  audit_time DATETIME NULL DEFAULT NULL,
  created_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_audit_hotel (hotel_id),
  KEY idx_audit_status (audit_status),
  KEY idx_online_status (online_status),
  CONSTRAINT fk_audit_hotel FOREIGN KEY (hotel_id) REFERENCES hotel_base(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS facility_label (
  id INT AUTO_INCREMENT PRIMARY KEY,
  label_name VARCHAR(50) NOT NULL,
  label_code VARCHAR(20) NOT NULL,
  created_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_label_name (label_name),
  UNIQUE KEY uk_label_code (label_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS hotel_label_rel (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  hotel_id BIGINT NOT NULL,
  label_id INT NOT NULL,
  UNIQUE KEY uk_hotel_label (hotel_id, label_id),
  KEY idx_rel_hotel (hotel_id),
  KEY idx_rel_label (label_id),
  CONSTRAINT fk_rel_hotel FOREIGN KEY (hotel_id) REFERENCES hotel_base(id) ON DELETE CASCADE,
  CONSTRAINT fk_rel_label FOREIGN KEY (label_id) REFERENCES facility_label(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS image_storage (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  related_type VARCHAR(20) NOT NULL,
  related_id BIGINT NOT NULL,
  image_url LONGTEXT NOT NULL,
  sort INT NOT NULL DEFAULT 0,
  created_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_image_related (related_type, related_id),
  KEY idx_image_sort (sort)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS room (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  hotel_id BIGINT NOT NULL,
  name VARCHAR(120) NOT NULL,
  description VARCHAR(500) NULL DEFAULT NULL,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  available_count INT NOT NULL DEFAULT 0,
  occupancy INT NOT NULL DEFAULT 2,
  size INT NULL DEFAULT NULL,
  amenities JSON NULL,
  status TINYINT NOT NULL DEFAULT 0 COMMENT '0-可预订 1-售罄',
  created_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_room_hotel (hotel_id),
  KEY idx_room_status (status),
  CONSTRAINT fk_room_hotel FOREIGN KEY (hotel_id) REFERENCES hotel_base(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS orders (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  hotel_id BIGINT NOT NULL,
  order_no VARCHAR(64) NOT NULL,
  room VARCHAR(120) NOT NULL,
  type VARCHAR(40) NOT NULL DEFAULT '',
  guest VARCHAR(80) NOT NULL DEFAULT '',
  phone VARCHAR(32) NOT NULL DEFAULT '',
  amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  status VARCHAR(32) NOT NULL DEFAULT 'unchecked',
  leave_date DATE NULL,
  pay_type VARCHAR(40) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_order_hotel (hotel_id),
  KEY idx_order_no (order_no),
  CONSTRAINT fk_order_hotel FOREIGN KEY (hotel_id) REFERENCES hotel_base(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO facility_label (label_name, label_code) VALUES
('有停车场', 'parking'),
('有家庭房', 'family_room'),
('允许宠物入住', 'pet_allowed');

ALTER TABLE image_storage MODIFY COLUMN image_url LONGTEXT;

INSERT INTO hotel_base (
  id, name_cn, name_en, province, city, county, address, star_rating, opening_date,
  nearby_attractions, transportation_info, discount_info, created_by, created_time
)
SELECT
  h.id,
  COALESCE(NULLIF(h.name, ''), CONCAT('酒店', h.id)),
  COALESCE(h.nameEn, ''),
  '',
  '',
  '',
  COALESCE(h.address, ''),
  CASE
    WHEN REPLACE(REPLACE(COALESCE(h.star, ''), '⭐', ''), '星级', '') REGEXP '^[0-9]+(\\.[0-9]+)?$'
      THEN LEAST(5, GREATEST(1, CAST(REPLACE(REPLACE(h.star, '⭐', ''), '星级', '') AS DECIMAL(2,1))))
    ELSE 4.5
  END,
  CASE WHEN h.openTime REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN CAST(h.openTime AS DATE) ELSE CURRENT_DATE END,
  h.scenicSpots,
  h.trafficMall,
  h.discounts,
  COALESCE(h.createdBy, 'merchant'),
  COALESCE(h.createdAt, CURRENT_TIMESTAMP)
FROM hotels h
WHERE NOT EXISTS (SELECT 1 FROM hotel_base hb WHERE hb.id = h.id);

INSERT INTO hotel_audit (hotel_id, audit_status, online_status, status, audit_time)
SELECT
  hb.id,
  1,
  1,
  1,
  NOW()
FROM hotel_base hb
LEFT JOIN hotel_audit ha ON ha.hotel_id = hb.id
WHERE ha.hotel_id IS NULL;

INSERT INTO hotel_base (
  legacy_submission_id, name_cn, name_en, province, city, county, address, star_rating, opening_date,
  nearby_attractions, transportation_info, discount_info, created_by, created_time
)
SELECT
  s.id,
  COALESCE(NULLIF(s.name, ''), CONCAT('待审酒店', s.id)),
  COALESCE(s.nameEn, ''),
  '',
  '',
  '',
  COALESCE(s.address, ''),
  CASE
    WHEN REPLACE(REPLACE(COALESCE(s.star, ''), '⭐', ''), '星级', '') REGEXP '^[0-9]+(\\.[0-9]+)?$'
      THEN LEAST(5, GREATEST(1, CAST(REPLACE(REPLACE(s.star, '⭐', ''), '星级', '') AS DECIMAL(2,1))))
    ELSE 4.5
  END,
  CASE WHEN s.openTime REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN CAST(s.openTime AS DATE) ELSE CURRENT_DATE END,
  s.scenicSpots,
  s.trafficMall,
  s.discounts,
  COALESCE(s.createdBy, 'merchant'),
  COALESCE(s.createdAt, CURRENT_TIMESTAMP)
FROM submissions s
WHERE NOT EXISTS (SELECT 1 FROM hotel_base hb WHERE hb.legacy_submission_id = s.id);

INSERT INTO hotel_audit (hotel_id, audit_status, online_status, status)
SELECT
  hb.id,
  0,
  0,
  0
FROM hotel_base hb
LEFT JOIN hotel_audit ha ON ha.hotel_id = hb.id
WHERE hb.legacy_submission_id IS NOT NULL AND ha.hotel_id IS NULL;

INSERT INTO room (id, hotel_id, name, description, price, available_count, occupancy, status)
SELECT
  r.id,
  r.hotel_id,
  COALESCE(NULLIF(r.type, ''), '标准房'),
  COALESCE(r.remark, ''),
  COALESCE(NULLIF(r.current, 0), r.original, 0),
  COALESCE(r.remain, 0),
  2,
  CASE WHEN COALESCE(r.remain, 0) > 0 THEN 0 ELSE 1 END
FROM rooms r
WHERE NOT EXISTS (SELECT 1 FROM room nr WHERE nr.id = r.id);

INSERT INTO image_storage (related_type, related_id, image_url, sort)
SELECT
  'hotel',
  h.id,
  h.image,
  0
FROM hotels h
WHERE h.image IS NOT NULL AND h.image <> ''
  AND NOT EXISTS (
    SELECT 1 FROM image_storage i
    WHERE i.related_type = 'hotel' AND i.related_id = h.id AND i.sort = 0
  );

INSERT INTO image_storage (related_type, related_id, image_url, sort)
SELECT
  'room',
  r.id,
  r.image,
  0
FROM rooms r
WHERE r.image IS NOT NULL AND r.image <> ''
  AND NOT EXISTS (
    SELECT 1 FROM image_storage i
    WHERE i.related_type = 'room' AND i.related_id = r.id AND i.sort = 0
  );
