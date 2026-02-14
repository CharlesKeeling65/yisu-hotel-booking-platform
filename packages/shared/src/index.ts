export type Room = {
  id: string;
  name: string;
  price: number;
  capacity: number;
  bedType: string;
  breakfastIncluded: boolean;
  refundable: boolean;
};

export type Hotel = {
  id: string;
  name: string;
  city: string;
  rating: number;
  address: string;
  coverImage: string;
  images: string[];
  tags: string[];
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
