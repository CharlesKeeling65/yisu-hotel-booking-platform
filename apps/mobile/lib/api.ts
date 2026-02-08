const API_BASE_URL = "http://localhost:3000";

type ApiResponse<T> = {
  code: number;
  data?: T;
  msg?: string;
};

async function getJson<T>(path: string, options?: RequestInit): Promise<ApiResponse<T>> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
  });
  const data = (await res.json().catch(() => null)) as ApiResponse<T> | null;
  if (!res.ok) {
    const message = data?.msg || res.statusText || "Request failed";
    throw new Error(message);
  }
  return data ?? { code: res.status };
}

export async function fetchMobileHotels<T>() {
  const res = await getJson<T[]>("/api/mobile/hotels");
  return res.data ?? [];
}

export async function fetchMobileHotelById<T>(id: string) {
  const res = await getJson<T>(`/api/mobile/hotels/${id}`);
  return res.data ?? null;
}

export async function loginMobile(username: string, password: string) {
  const res = await getJson<{ token: string; user: { username: string; name: string } }>(
    "/api/mobile/login",
    {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }
  );
  return res.data ?? null;
}
