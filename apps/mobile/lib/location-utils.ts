import type { LocationGeocodedAddress } from "expo-location";
import { fetchReverseGeocode } from "@/lib/api";

export type ParsedLocationParts = {
  province: string;
  city: string;
  district: string;
  cityOrCounty: string;
  detailText: string;
  fullText: string;
};

export type ReverseLookupResult = {
  provider: string;
  reverse: Partial<LocationGeocodedAddress>[];
};

export function stripCityCountySuffix(input: string) {
  return String(input || "").trim().replace(/(省|市|县)$/g, "");
}

export function parseReverseGeocode(addr?: Partial<LocationGeocodedAddress> | null): ParsedLocationParts {
  const province = String(addr?.region || "").trim();
  const city = String(addr?.city || addr?.subregion || "").trim();
  const district = String(addr?.district || "").trim();
  const districtAsCity = /(县|市)$/.test(district);
  const cityOrCountyRaw = districtAsCity ? district : (city || district || province);
  const cityOrCounty = stripCityCountySuffix(cityOrCountyRaw);

  // 关键词输入框优先仅使用道路名（OSM 的 road）。
  const detailText = String(addr?.street || "").trim();
  const fullText = [cityOrCounty, detailText].filter(Boolean).join(" ");

  return {
    province,
    city,
    district,
    cityOrCounty,
    detailText,
    fullText,
  };
}

export async function reverseGeocodeWithProvider(latitude: number, longitude: number): Promise<ReverseLookupResult> {
  try {
    const data = await fetchReverseGeocode(latitude, longitude);
    if (data?.reverse?.length) {
      return {
        provider: data.provider || "none",
        reverse: (data.reverse || []) as Partial<LocationGeocodedAddress>[],
      };
    }
  } catch {
    // 后端不可达时保持 graceful fallback
  }
  return { provider: "none", reverse: [] };
}
