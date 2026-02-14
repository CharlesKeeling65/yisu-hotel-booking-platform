export type Room = {
  id: string;
  name: string;
  price: number;
  capacity: number;
  bedType: string;
  breakfastIncluded: boolean;
  refundable: boolean;
  image?: string;
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
