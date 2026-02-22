-- Orders table for hotel bookings (MySQL compatible)

CREATE TABLE IF NOT EXISTS `orders` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `user_id` VARCHAR(64) NULL,
  `hotel_id` VARCHAR(64) NOT NULL,
  `room_id` VARCHAR(64) NOT NULL,
  `check_in` DATE NOT NULL,
  `check_out` DATE NOT NULL,
  `nights` INT NOT NULL,
  `rooms_count` INT NOT NULL DEFAULT 1,
  `adults_count` INT NOT NULL DEFAULT 1,
  `children_count` INT NOT NULL DEFAULT 0,
  `guest_name` VARCHAR(128) NOT NULL,
  `guest_phone` VARCHAR(32) NOT NULL,
  `price_subtotal` DECIMAL(10,2) NOT NULL,
  `coupon_amount` DECIMAL(10,2) NOT NULL DEFAULT 0,
  `payable_amount` DECIMAL(10,2) NOT NULL,
  `currency` VARCHAR(8) NOT NULL DEFAULT 'CNY',
  `status` VARCHAR(32) NOT NULL DEFAULT 'pending',
  `payment_method` VARCHAR(32),
  `payment_status` VARCHAR(32) DEFAULT 'unpaid',
  `notes` TEXT,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Indexes (server initialization tolerates errors if index already exists)
CREATE INDEX idx_orders_user_id ON `orders` (`user_id`);
CREATE INDEX idx_orders_hotel_id ON `orders` (`hotel_id`);
CREATE INDEX idx_orders_status ON `orders` (`status`);
