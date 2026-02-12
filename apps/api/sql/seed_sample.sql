SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;
USE `yisu_db`;

INSERT INTO hotel_base (
  name_cn, name_en, province, city, county, address, star_rating, opening_date,
  nearby_attractions, transportation_info, discount_info, created_by
)
VALUES (
  '海景度假酒店',
  'Seaview Resort Hotel',
  '上海市',
  '上海市',
  '浦东新区',
  '滨海大道188号',
  5.0,
  '2018-06-18',
  JSON_ARRAY('东方明珠（1.2km）', '外滩（2.5km）'),
  '地铁2号线滨海站（300m）,滨海万达广场（500m）',
  '春节特惠：全场房型8折；连住3晚赠早餐',
  'system'
);
SET @h1 = LAST_INSERT_ID();

INSERT INTO hotel_audit (hotel_id, audit_status, online_status, status, audit_time)
VALUES (@h1, 1, 1, 1, NOW());

INSERT INTO room (hotel_id, name, description, price, available_count, occupancy, size, amenities, status)
VALUES
(@h1, '海景大床房', '含双人早餐', 880, 18, 2, 40, JSON_ARRAY('WiFi', '早餐'), 0),
(@h1, '海景别墅', '独立花园', 3880, 2, 4, 120, JSON_ARRAY('私汤', '露台'), 0);

INSERT INTO image_storage (related_type, related_id, image_url, sort) VALUES
('hotel', @h1, 'pic/hotel_1.png', 0),
('room', (SELECT id FROM room WHERE hotel_id = @h1 AND name = '海景大床房' LIMIT 1), 'pic/room_1_1.png', 0),
('room', (SELECT id FROM room WHERE hotel_id = @h1 AND name = '海景别墅' LIMIT 1), 'pic/room_1_2.png', 0);

INSERT INTO hotel_base (
  name_cn, name_en, province, city, county, address, star_rating, opening_date,
  nearby_attractions, transportation_info, discount_info, created_by
)
VALUES (
  '城市商务酒店',
  'City Business Hotel',
  '北京市',
  '北京市',
  '朝阳区',
  '建国门外大街66号',
  4.0,
  '2015-10-01',
  JSON_ARRAY('国贸三期（0.3km）'),
  '地铁1号线国贸站（200m）,SKP购物中心（0.5km）',
  '商务出行特惠：连住2晚立减150元',
  'system'
);
SET @h2 = LAST_INSERT_ID();

INSERT INTO hotel_audit (hotel_id, audit_status, online_status, status, audit_time)
VALUES (@h2, 1, 1, 1, NOW());

INSERT INTO room (hotel_id, name, description, price, available_count, occupancy, size, amenities, status)
VALUES (@h2, '商务大床房', '带办公区', 750, 12, 2, 32, JSON_ARRAY('办公桌', 'WiFi'), 0);

INSERT INTO image_storage (related_type, related_id, image_url, sort) VALUES
('hotel', @h2, 'pic/hotel_2.png', 0),
('room', (SELECT id FROM room WHERE hotel_id = @h2 AND name = '商务大床房' LIMIT 1), 'pic/room_2_1.png', 0);

INSERT INTO hotel_base (
  name_cn, name_en, province, city, county, address, star_rating, opening_date,
  nearby_attractions, transportation_info, discount_info, created_by
)
VALUES (
  '山水温泉酒店',
  'Shanshui Hot Spring Hotel',
  '浙江省',
  '杭州市',
  '西湖区',
  '龙井路128号',
  4.0,
  '2017-08-15',
  JSON_ARRAY('西湖（1.8km）', '灵隐寺（3.2km）'),
  '地铁10号线龙井站（800m）,西湖银泰城（2.0km）',
  '温泉+酒店套餐：立减260元/2人',
  'system'
);
SET @h3 = LAST_INSERT_ID();

INSERT INTO hotel_audit (hotel_id, audit_status, online_status, status, audit_time)
VALUES (@h3, 1, 1, 1, NOW());

INSERT INTO room (hotel_id, name, description, price, available_count, occupancy, size, amenities, status)
VALUES (@h3, '温泉大床房', '含温泉票', 980, 8, 2, 35, JSON_ARRAY('温泉', '早餐'), 0);

INSERT INTO image_storage (related_type, related_id, image_url, sort) VALUES
('hotel', @h3, 'pic/hotel_3.png', 0),
('room', (SELECT id FROM room WHERE hotel_id = @h3 AND name = '温泉大床房' LIMIT 1), 'pic/room_3_1.png', 0);

INSERT INTO orders (hotel_id, order_no, room, type, guest, phone, amount, status, leave_date, pay_type, created_at)
VALUES (@h1, 'ORD-1001', '海景大床房', '预订', '李四', '13800138000', 880, 'checked', '2026-02-10', '支付宝', NOW());
