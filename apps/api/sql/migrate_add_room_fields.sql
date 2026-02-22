-- 迁移脚本：向 Room 表添加缺失字段（安全执行，可重复运行）
-- 保留原始 init_schema.sql 不变，执行此脚本以补充字段
SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;
USE yisu_db;
-- 使用 INFORMATION_SCHEMA 检查列是否存在，如果不存在则通过动态 SQL 添加列，兼容较旧 MySQL 版本

-- original_price
SELECT COUNT(*) INTO @cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'yisu_db' AND TABLE_NAME = 'Room' AND COLUMN_NAME = 'original_price';
SET @sql = IF(@cnt = 0, 'ALTER TABLE `Room` ADD COLUMN `original_price` FLOAT NULL DEFAULT NULL COMMENT "日常原价（用于展示划线价，可选）"', 'SELECT 0');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- discount
SELECT COUNT(*) INTO @cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'yisu_db' AND TABLE_NAME = 'Room' AND COLUMN_NAME = 'discount';
SET @sql = IF(@cnt = 0, 'ALTER TABLE `Room` ADD COLUMN `discount` VARCHAR(100) NULL DEFAULT NULL COMMENT "折扣信息（如8折、立享8折，可选）"', 'SELECT 0');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- remain
SELECT COUNT(*) INTO @cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'yisu_db' AND TABLE_NAME = 'Room' AND COLUMN_NAME = 'remain';
SET @sql = IF(@cnt = 0, 'ALTER TABLE `Room` ADD COLUMN `remain` INT NOT NULL DEFAULT 0 COMMENT "剩余房量/库存（整数，默认0）"', 'SELECT 0');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- remark
SELECT COUNT(*) INTO @cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'yisu_db' AND TABLE_NAME = 'Room' AND COLUMN_NAME = 'remark';
SET @sql = IF(@cnt = 0, 'ALTER TABLE `Room` ADD COLUMN `remark` VARCHAR(500) NULL DEFAULT NULL COMMENT "备注信息（如包含双早、免费接机、无窗等，可选）"', 'SELECT 0');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 说明：
-- 1) `price` 字段保留为当日/当前售价（单位按业务约定，例如分或元）。
-- 2) 建议在生产环境执行前在测试库验证本脚本。
