-- Customers table for MySQL
CREATE TABLE IF NOT EXISTS `Customer` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `password` VARCHAR(255) NOT NULL,
  `phone` VARCHAR(32) DEFAULT NULL,
  `name` VARCHAR(128) DEFAULT NULL,
  `email` VARCHAR(128) DEFAULT NULL,
  `createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Create an index on phone (MySQL older versions do not support IF NOT EXISTS for CREATE INDEX)
CREATE INDEX idx_customer_phone ON `Customer`(phone);
