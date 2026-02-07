-- seed_sample.sql: insert 3 sample hotels with rooms, one submission and sample orders
SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;
USE `yisu_db`;


-- Hotel A: 海景度假酒店
INSERT INTO hotels (name,nameEn,star,openTime,address,priceRange,totalRooms,roomTypes,scenicSpots,trafficMall,discounts,image,priceData,createdBy,createdAt)
VALUES (
  '海景度假酒店', 'Seaview Resort Hotel', '⭐⭐⭐ 五星级', '2018-06-18', '上海市浦东新区滨海大道188号', '880元 - 6880元/晚', 280,
  '["海景大床房","海景双床房","豪华套房","亲子主题房","海景别墅（热门）"]',
  '["东方明珠（1.2km)","外滩（2.5km)"]',
  '["地铁2号线滨海站（300m)","滨海万达广场（500m)"]',
  '["春节特惠：全场房型8折","连住3晚赠早餐"]', 'pic/hotel_1.png', '{"roomPriceList":[]}', 'system', NOW()
);
SET @h1 = LAST_INSERT_ID();

INSERT INTO rooms (hotel_id,type,original,current,discount,remain,status,remark,image)
VALUES
  (@h1, '海景大床房', 1100, 880, '8折', 18, 'available', '含双人早餐', 'pic/room_1_1.png'),
  (@h1, '海景别墅', 5000, 3880, '', 2, 'available', '独立花园', 'pic/room_1_2.png');

INSERT INTO orders (hotel_id,orderNo,room,type,guest,phone,amount,status,leaveDate,payType,createdAt)
VALUES (@h1, 'ORD-1001', '海景大床房', '预订', '李四', '13800138000', '880', 'checked', '2026-02-10', '支付宝', NOW());

-- Hotel B: 城市商务酒店
INSERT INTO hotels (name,nameEn,star,openTime,address,priceRange,totalRooms,roomTypes,scenicSpots,trafficMall,discounts,image,priceData,createdBy,createdAt)
VALUES (
  '城市商务酒店', 'City Business Hotel', '⭐⭐⭐⭐ 四星级', '2015-10-01', '北京市朝阳区建国门外大街66号', '580元 - 2880元/晚', 320,
  '["商务大床房","商务双床房","行政套房"]',
  '["国贸三期（0.3km)"]',
  '["地铁1号线国贸站（200m)","SKP购物中心（0.5km)"]',
  '["商务出行特惠：连住2晚立减150元"]', 'pic/hotel_2.png', '{"roomPriceList":[]}', 'system', NOW()
);
SET @h2 = LAST_INSERT_ID();

INSERT INTO rooms (hotel_id,type,original,current,discount,remain,status,remark,image)
VALUES
  (@h2, '商务大床房', 900, 750, '85折', 12, 'available', '带办公区', 'pic/room_2_1.png');

-- Hotel C: 山水温泉酒店
INSERT INTO hotels (name,nameEn,star,openTime,address,priceRange,totalRooms,roomTypes,scenicSpots,trafficMall,discounts,image,priceData,createdBy,createdAt)
VALUES (
  '山水温泉酒店', 'Shanshui Hot Spring Hotel', '⭐⭐⭐⭐ 四星级', '2017-08-15', '杭州市西湖区龙井路128号', '680元 - 3880元/晚', 200,
  '["温泉大床房","温泉双床房","山景套房"]',
  '["西湖（1.8km)","灵隐寺（3.2km)"]',
  '["地铁10号线龙井站（800m)","西湖银泰城（2.0km)"]',
  '["温泉+酒店套餐：立减260元/2人"]', 'pic/hotel_3.png', '{"roomPriceList":[]}', 'system', NOW()
);
SET @h3 = LAST_INSERT_ID();

INSERT INTO rooms (hotel_id,type,original,current,discount,remain,status,remark,image)
VALUES
  (@h3, '温泉大床房', 1200, 980, '', 8, 'available', '含温泉票', 'pic/room_3_1.png');

-- done
