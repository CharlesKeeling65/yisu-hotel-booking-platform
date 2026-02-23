import AsyncStorage from "@react-native-async-storage/async-storage";

const API_BASE_URL = "http://localhost:3000";

type ApiResponse<T> = {
  code: number;
  data?: T;
  msg?: string;
  page?: number;
  pageSize?: number;
  total?: number;
  hasMore?: boolean;
};

export type ReverseGeocodePayload = {
  provider: string;
  normalized?: {
    provider?: string;
    province?: string;
    city?: string;
    district?: string;
    cityOrCounty?: string;
    street?: string;
    displayText?: string;
    hasResult?: boolean;
  };
  reverse: {
    region?: string;
    city?: string;
    district?: string;
    street?: string;
    name?: string;
    subregion?: string;
    streetNumber?: string;
  }[];
};

export type LocationSuggestion = {
  type: "city" | "area" | "scenic" | "hotel" | string;
  city: string;
  county?: string;
  label: string;
};

export type ListParams = {
  page?: number;
  pageSize?: number;
  city?: string;
  keyword?: string;
  priceStar?: string;
  priceMin?: number;
  priceMax?: number;
  stars?: number[];
  tags?: string[];
  scenicSpots?: string[];
  sort?: "price_asc" | "price_desc" | "star_desc";
};

async function getJson<T>(
  path: string,
  options?: RequestInit,
): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string> | undefined),
  };

  try {
    const token = await AsyncStorage.getItem("customer_token");
    if (token) headers["Authorization"] = `Bearer ${token}`;
  } catch (_e) {
    // ignore storage errors
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });
  const data = (await res.json().catch(() => null)) as ApiResponse<T> | null;
  if (!res.ok) {
    const message = data?.msg || res.statusText || "Request failed";
    throw new Error(message);
  }
  return data ?? { code: res.status };
}

export async function fetchMobileHomeBanners<T>() {
  const res = await getJson<T[]>("/api/mobile/home-banner");
  return res.data ?? [];
}

export async function fetchMobileHotels<T>(params: ListParams = {}) {
  const search = new URLSearchParams();
  search.set("page", String(params.page || 1));
  search.set("pageSize", String(params.pageSize || 10));
  if (params.city) search.set("city", params.city);
  if (params.keyword) search.set("keyword", params.keyword);
  if (params.priceMin !== undefined)
    search.set("priceMin", String(params.priceMin));
  if (params.priceMax !== undefined)
    search.set("priceMax", String(params.priceMax));
  if (params.stars?.length) {
    search.set("stars", params.stars.join(","));
  }
  if (params.priceStar) {
    if (!params.stars?.length && params.priceStar.includes("3")) {
      search.set("starMin", "3");
      search.set("starMax", "3");
    }
    if (!params.stars?.length && params.priceStar.includes("4")) {
      search.set("starMin", "4");
      search.set("starMax", "4");
    }
    if (!params.stars?.length && params.priceStar.includes("5")) {
      search.set("starMin", "5");
      search.set("starMax", "5");
    }
  }
  if (params.tags?.length) search.set("tags", params.tags.join(","));
  if (params.scenicSpots?.length)
    search.set("scenicSpots", params.scenicSpots.join(","));
  if (params.sort) search.set("sort", params.sort);

  const res = await getJson<T[]>(`/api/mobile/hotels?${search.toString()}`);
  return {
    list: res.data ?? [],
    page: res.page ?? 1,
    pageSize: res.pageSize ?? 10,
    total: res.total ?? 0,
    hasMore: Boolean(res.hasMore),
  };
}

export async function fetchMobileHotelById<T>(id: string) {
  const res = await getJson<T>(`/api/mobile/hotels/${id}`);
  return res.data ?? null;
}

export async function loginMobile(username: string, password: string) {
  const res = await getJson<{
    token: string;
    user: { username?: string; name: string };
  }>("/api/mobile/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  return res.data ?? null;
}

export async function customerRegister(
  password: string,
  phone: string,
  name?: string,
  email?: string,
) {
  const res = await getJson<any>(`/api/customer/register`, {
    method: "POST",
    body: JSON.stringify({ password, phone, name, email }),
  });
  return res.data ?? null;
}

export async function customerLogin(identifier: string, password: string) {
  const res = await getJson<{ token: string; customer: any }>(
    `/api/customer/login`,
    {
      method: "POST",
      body: JSON.stringify({ identifier, password }),
    },
  );
  return res.data ?? null;
}

export async function fetchReverseGeocode(lat: number, lon: number) {
  const search = new URLSearchParams();
  search.set("lat", String(lat));
  search.set("lon", String(lon));
  const res = await getJson<ReverseGeocodePayload>(
    `/api/geocode/reverse?${search.toString()}`,
  );
  return res.data ?? { provider: "none", reverse: [] };
}

export async function fetchLocationSuggestions(params: {
  q: string;
  city?: string;
  limit?: number;
}) {
  const search = new URLSearchParams();
  search.set("q", params.q);
  if (params.city) search.set("city", params.city);
  if (params.limit) search.set("limit", String(params.limit));
  const res = await getJson<LocationSuggestion[]>(
    `/api/location/suggest?${search.toString()}`,
  );
  return res.data ?? [];
}

export type MobileOrder = {
  id: string;
  customerId: string;
  hotelId: string;
  roomId: string;
  status: string;
  statusLabel: string;
  paymentStatus: string;
  paymentStatusLabel: string;
  checkIn: string | null;
  checkOut: string | null;
  nights: number;
  roomsCount: number;
  adultsCount: number;
  childrenCount: number;
  guestName: string;
  guestPhone: string;
  priceSubtotal: number;
  couponAmount: number;
  payableAmount: number;
  currency: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  hotelName: string;
  hotelCity: string;
  hotelCounty: string;
  hotelAddress: string;
  roomName: string;
};

export type CreateOrderPayload = {
  customerId: string;
  hotelId: string;
  roomId: string;
  checkIn: string;
  checkOut: string;
  nights?: number;
  roomsCount: number;
  adultsCount: number;
  childrenCount: number;
  guestName: string;
  guestPhone: string;
  priceSubtotal: number;
  couponAmount: number;
  payableAmount: number;
  currency?: string;
  paymentMethod?: string;
  notes?: string;
};

export async function createMobileOrder(payload: CreateOrderPayload) {
  const res = await getJson<MobileOrder>(`/api/mobile/orders`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.data ?? null;
}

export async function payMobileOrder(orderId: string, customerId: string) {
  const res = await getJson<MobileOrder>(`/api/mobile/orders/${orderId}/pay`, {
    method: "POST",
    body: JSON.stringify({ customerId }),
  });
  return res.data ?? null;
}

export async function fetchMobileOrders(params: {
  customerId?: string; // optional, server uses token
  status?: string;
  page?: number;
  pageSize?: number;
}) {
  const search = new URLSearchParams();
  // Do not send customerId from client; server will resolve from Authorization token.
  if (params.status) search.set("status", params.status);
  if (params.page) search.set("page", String(params.page));
  if (params.pageSize) search.set("pageSize", String(params.pageSize));

  const res = await getJson<MobileOrder[]>(
    `/api/mobile/orders?${search.toString()}`,
  );
  return {
    list: res.data ?? [],
    page: res.page ?? 1,
    pageSize: res.pageSize ?? 10,
    total: res.total ?? 0,
    hasMore: Boolean(res.hasMore),
  };
}
