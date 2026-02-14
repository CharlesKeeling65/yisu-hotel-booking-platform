export type SearchSession = {
  city: string;
  location: string;
  checkIn: string;
  checkOut: string;
  rooms: number;
  adults: number;
  children: number;
  priceStar: string;
  tags: string;
  scenicSpots: string;
  sort: string;
};

const pad = (n: number) => String(n).padStart(2, "0");
const toDateString = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function buildDefaultSession(): SearchSession {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  return {
    city: "上海市",
    location: "",
    checkIn: toDateString(today),
    checkOut: toDateString(tomorrow),
    rooms: 1,
    adults: 1,
    children: 0,
    priceStar: "不限星级",
    tags: "",
    scenicSpots: "",
    sort: "",
  };
}

let sessionState: SearchSession = buildDefaultSession();

export function getSearchSession() {
  return { ...sessionState };
}

export function setSearchSession(patch: Partial<SearchSession>) {
  sessionState = { ...sessionState, ...patch };
}

export function getDefaultSearchSession() {
  return buildDefaultSession();
}
