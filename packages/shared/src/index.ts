export type Room = {
  id: string;
  name: string;
  price: number;
  capacity: number;
  bedType: string;
  /** 后端 db 字段：剩余房间数，可能未返回 */
  remain?: number | null;
  size?: number | null;
  status?: "available" | "soldout";
  breakfastIncluded: boolean;
  refundable: boolean;
  image?: string;
  /** 原始数据库行，包含 snake_case 字段（如 remain, refundable, breakfast_included, status 等） */
  raw?: any;
};

export type Hotel = {
  id: string;
  name: string;
  nameEn?: string;
  city: string;
  county?: string;
  rating: number;
  starLevel?: number;
  address: string;
  fullAddress?: string;
  coverImage: string;
  images: string[];
  tags: string[];
  scenicSpots?: string[];
  facilities: string[];
  priceFrom: number;
  rooms: Room[];
};

export const HOTEL_TAGS = ["Popular", "Business", "Family", "Luxury"] as const;
export const HOTEL_FACILITIES = [
  "Wifi",
  "Parking",
  "Gym",
  "Pool",
  "Restaurant",
  "Laundry",
] as const;
export const HOTEL_CITIES = ["Shanghai", "Beijing", "Hangzhou"] as const;
