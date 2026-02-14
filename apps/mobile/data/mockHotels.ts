import type { Hotel, Room } from "@yisu/shared";

const rooms: Record<string, Room[]> = {
  h1: [
    {
      id: "r1",
      name: "Deluxe King",
      price: 680,
      capacity: 2,
      bedType: "King",
      breakfastIncluded: true,
      refundable: true,
    },
    {
      id: "r2",
      name: "City View Twin",
      price: 520,
      capacity: 2,
      bedType: "Twin",
      breakfastIncluded: false,
      refundable: false,
    },
  ],
  h2: [
    {
      id: "r3",
      name: "Executive Suite",
      price: 980,
      capacity: 3,
      bedType: "King",
      breakfastIncluded: true,
      refundable: true,
    },
    {
      id: "r4",
      name: "Superior Queen",
      price: 720,
      capacity: 2,
      bedType: "Queen",
      breakfastIncluded: true,
      refundable: false,
    },
  ],
  h3: [
    {
      id: "r5",
      name: "Family Room",
      price: 640,
      capacity: 4,
      bedType: "Twin",
      breakfastIncluded: true,
      refundable: true,
    },
    {
      id: "r6",
      name: "Standard Queen",
      price: 420,
      capacity: 2,
      bedType: "Queen",
      breakfastIncluded: false,
      refundable: false,
    },
  ],
};

export const hotels: Hotel[] = [
  {
    id: "h1",
    name: "Bund Riverside Hotel",
    city: "Shanghai",
    rating: 4.8,
    address: "No. 88 Zhongshan East Rd",
    coverImage:
      "https://images.unsplash.com/photo-1501117716987-c8e1ecb2105f?auto=format&fit=crop&w=1400&q=80",
    images: [
      "https://images.unsplash.com/photo-1501117716987-c8e1ecb2105f?auto=format&fit=crop&w=1400&q=80",
      "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1400&q=80",
      "https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=1400&q=80",
    ],
    tags: ["Popular", "Business"],
    facilities: ["Wifi", "Parking", "Gym", "Restaurant"],
    priceFrom: 520,
    rooms: rooms.h1,
  },
  {
    id: "h2",
    name: "Skyline Executive",
    city: "Beijing",
    rating: 4.6,
    address: "Tower A, Chaoyang Park",
    coverImage:
      "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1400&q=80",
    images: [
      "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1400&q=80",
      "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1400&q=80",
      "https://images.unsplash.com/photo-1505691723518-36a5ac3be353?auto=format&fit=crop&w=1400&q=80",
    ],
    tags: ["Luxury", "Business"],
    facilities: ["Wifi", "Pool", "Gym", "Laundry"],
    priceFrom: 720,
    rooms: rooms.h2,
  },
  {
    id: "h3",
    name: "West Lake Garden",
    city: "Hangzhou",
    rating: 4.5,
    address: "Longjing Rd 18",
    coverImage:
      "https://images.unsplash.com/photo-1505691723518-36a5ac3be353?auto=format&fit=crop&w=1400&q=80",
    images: [
      "https://images.unsplash.com/photo-1505691723518-36a5ac3be353?auto=format&fit=crop&w=1400&q=80",
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1400&q=80",
      "https://images.unsplash.com/photo-1444201983204-c43cbd584d93?auto=format&fit=crop&w=1400&q=80",
    ],
    tags: ["Family", "Popular"],
    facilities: ["Wifi", "Restaurant", "Parking"],
    priceFrom: 420,
    rooms: rooms.h3,
  },
];

export const getHotelById = (id: string) => hotels.find((hotel) => hotel.id === id);

export const getSortedRooms = (hotel: Hotel | undefined) => {
  if (!hotel) return [];
  return [...hotel.rooms].sort((a, b) => a.price - b.price);
};
