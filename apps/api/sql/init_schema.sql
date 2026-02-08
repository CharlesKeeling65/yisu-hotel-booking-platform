-- init_schema.sql: create tables for hotels, rooms, submissions, orders
SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;
CREATE DATABASE IF NOT EXISTS yisu_db;

use yisu_db;

CREATE TABLE IF NOT EXISTS hotels (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  name TEXT,
  nameEn TEXT,
  star TEXT,
  openTime TEXT,
  address TEXT,
  priceRange TEXT,
  totalRooms INT,
  roomTypes TEXT,
  scenicSpots TEXT,
  trafficMall TEXT,
  discounts TEXT,
  image TEXT,
  priceData TEXT,
  createdBy TEXT,
  createdAt DATETIME
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS rooms (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  hotel_id BIGINT,
  type TEXT,
  original INT,
  current INT,
  discount TEXT,
  remain INT,
  status TEXT,
  remark TEXT,
  image TEXT,
  FOREIGN KEY (hotel_id) REFERENCES hotels(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS submissions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  name TEXT,
  nameEn TEXT,
  star TEXT,
  openTime TEXT,
  address TEXT,
  priceRange TEXT,
  totalRooms INT,
  roomTypes TEXT,
  scenicSpots TEXT,
  trafficMall TEXT,
  discounts TEXT,
  image TEXT,
  priceData TEXT,
  status VARCHAR(32) DEFAULT 'pending',
  createdBy TEXT,
  createdAt DATETIME
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS orders (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  hotel_id BIGINT,
  orderNo TEXT,
  room TEXT,
  type TEXT,
  guest TEXT,
  phone TEXT,
  amount TEXT,
  status TEXT,
  leaveDate TEXT,
  payType TEXT,
  createdAt DATETIME
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
