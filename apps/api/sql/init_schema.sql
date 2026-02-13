SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;
CREATE DATABASE IF NOT EXISTS yisu_db;
USE yisu_db;

CREATE TABLE IF NOT EXISTS `User` (
  `id` VARCHAR(64) NOT NULL COMMENT '用户唯一标识',
  `account` VARCHAR(64) NOT NULL COMMENT '登录账号',
  `email` VARCHAR(255) NOT NULL COMMENT '登录邮箱',
  `phone` VARCHAR(32) NULL DEFAULT NULL COMMENT '手机号',
  `name` VARCHAR(100) NULL DEFAULT NULL COMMENT '显示名',
  `real_name` VARCHAR(100) NULL DEFAULT NULL COMMENT '联系人姓名',
  `company_name` VARCHAR(255) NULL DEFAULT NULL COMMENT '企业名称（商家）',
  `role` VARCHAR(20) NOT NULL DEFAULT 'user' COMMENT '角色：admin/merchant/user',
  `password` VARCHAR(255) NOT NULL COMMENT '密码密文',
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_email` (`email`),
  UNIQUE KEY `uk_user_account` (`account`),
  KEY `idx_user_role` (`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';

CREATE TABLE IF NOT EXISTS `Hotel_Base` (
  `id` VARCHAR(64) NOT NULL COMMENT '酒店唯一标识',
  `merchantId` VARCHAR(64) NOT NULL COMMENT '创建酒店的商家ID',
  `name_cn` VARCHAR(255) NOT NULL COMMENT '酒店中文名',
  `name_en` VARCHAR(255) NOT NULL COMMENT '酒店英文名',
  `province` VARCHAR(50) NOT NULL COMMENT '省份',
  `city` VARCHAR(50) NOT NULL COMMENT '城市',
  `county` VARCHAR(50) NOT NULL COMMENT '区县',
  `address` VARCHAR(500) NOT NULL COMMENT '详细地址',
  `star_level` TINYINT NOT NULL DEFAULT 3 COMMENT '酒店星级（1-5）',
  `intro` VARCHAR(1200) NULL DEFAULT NULL COMMENT '酒店简介',
  `scenic_spots` VARCHAR(600) NULL DEFAULT NULL COMMENT '附近景点（逗号分隔）',
  `latitude` DECIMAL(10, 6) NULL DEFAULT NULL COMMENT '纬度',
  `longitude` DECIMAL(10, 6) NULL DEFAULT NULL COMMENT '经度',
  `featured_weight` INT NOT NULL DEFAULT 0 COMMENT '首页广告权重，越大越靠前',
  `start_date` DATETIME NOT NULL COMMENT '开业日期',
  `created_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_hotel_merchant` (`merchantId`),
  KEY `idx_hotel_region` (`province`, `city`, `county`),
  KEY `idx_hotel_star` (`star_level`),
  KEY `idx_hotel_featured` (`featured_weight`),
  CONSTRAINT `fk_hotel_merchant` FOREIGN KEY (`merchantId`) REFERENCES `User` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='酒店基础信息表';

CREATE TABLE IF NOT EXISTS `Hotel_Audit` (
  `id` VARCHAR(64) NOT NULL COMMENT '审核记录ID',
  `hotel_id` VARCHAR(64) NOT NULL COMMENT '关联酒店ID',
  `audit_status` INT NOT NULL DEFAULT 0 COMMENT '审核状态：0待审核 1通过 2未通过',
  `online_status` INT NOT NULL DEFAULT 0 COMMENT '上下线状态：0下线 1上线',
  `audit_reason` VARCHAR(500) NULL DEFAULT NULL COMMENT '审核备注/驳回原因',
  `auditor_id` VARCHAR(64) NULL DEFAULT NULL COMMENT '审核人ID',
  `audit_time` DATETIME NULL DEFAULT NULL COMMENT '审核时间',
  `online_time` DATETIME NULL DEFAULT NULL COMMENT '上线时间',
  `status` INT NOT NULL DEFAULT 0 COMMENT '兼容状态：0未审核 1已上架 2下架 3未通过',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_hotel_audit` (`hotel_id`),
  KEY `idx_audit_status` (`audit_status`),
  KEY `idx_online_status` (`online_status`),
  KEY `idx_auditor` (`auditor_id`),
  CONSTRAINT `fk_audit_hotel` FOREIGN KEY (`hotel_id`) REFERENCES `Hotel_Base` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_audit_user` FOREIGN KEY (`auditor_id`) REFERENCES `User` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='酒店审核表';

CREATE TABLE IF NOT EXISTS `Facility_Label` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT '标签ID',
  `label_name` VARCHAR(50) NOT NULL COMMENT '标签名称',
  `label_code` VARCHAR(30) NOT NULL COMMENT '标签编码',
  `created_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_label_code` (`label_code`),
  UNIQUE KEY `uk_label_name` (`label_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='酒店标签字典';

INSERT IGNORE INTO `Facility_Label` (`id`, `label_name`, `label_code`) VALUES
(1, '免费停车', 'free_parking'),
(2, '亲子友好', 'family_friendly'),
(3, '可带宠物', 'pet_friendly'),
(4, '豪华酒店', 'luxury'),
(5, '商务出行', 'business'),
(6, '近地铁', 'near_subway'),
(7, '含早餐', 'breakfast_included'),
(8, '泳池健身', 'pool_gym'),
(9, '江景海景', 'view_room'),
(10, '免费取消', 'free_cancel');

CREATE TABLE IF NOT EXISTS `Hotel_Label_Rel` (
  `id` VARCHAR(64) NOT NULL COMMENT '关联记录ID',
  `hotel_id` VARCHAR(64) NOT NULL COMMENT '酒店ID',
  `label_id` INT NOT NULL COMMENT '标签ID',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_hotel_label` (`hotel_id`, `label_id`),
  KEY `idx_hotel_id` (`hotel_id`),
  KEY `idx_label_id` (`label_id`),
  CONSTRAINT `fk_rel_hotel` FOREIGN KEY (`hotel_id`) REFERENCES `Hotel_Base` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_rel_label` FOREIGN KEY (`label_id`) REFERENCES `Facility_Label` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='酒店标签关联';

CREATE TABLE IF NOT EXISTS `Image_Storage` (
  `id` VARCHAR(64) NOT NULL COMMENT '图片记录ID',
  `related_type` VARCHAR(20) NOT NULL COMMENT 'hotel/room',
  `related_id` VARCHAR(64) NOT NULL COMMENT '关联实体ID',
  `image_url` LONGTEXT NOT NULL COMMENT '图片URL',
  `sort` INT NOT NULL DEFAULT 0 COMMENT '图片排序',
  `created_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '上传时间',
  PRIMARY KEY (`id`),
  KEY `idx_related` (`related_type`, `related_id`),
  KEY `idx_image_sort` (`sort`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='图片存储表';

CREATE TABLE IF NOT EXISTS `Room` (
  `id` VARCHAR(64) NOT NULL COMMENT '房型ID',
  `hotel_id` VARCHAR(64) NOT NULL COMMENT '所属酒店ID',
  `name` VARCHAR(100) NOT NULL COMMENT '房型名称',
  `price` FLOAT NOT NULL COMMENT '房型价格',
  `occupancy` INT NOT NULL COMMENT '建议入住人数',
  `size` INT NULL DEFAULT NULL COMMENT '房间面积（平方米）',
  `breakfast_included` TINYINT NOT NULL DEFAULT 0 COMMENT '是否含早餐',
  `refundable` TINYINT NOT NULL DEFAULT 1 COMMENT '是否可取消',
  `status` INT NOT NULL DEFAULT 0 COMMENT '房态：0可预订 1已售罄',
  `created_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_room_hotel` (`hotel_id`),
  KEY `idx_room_status` (`status`),
  KEY `idx_room_price` (`price`),
  CONSTRAINT `fk_room_hotel` FOREIGN KEY (`hotel_id`) REFERENCES `Hotel_Base` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='酒店房型表';
