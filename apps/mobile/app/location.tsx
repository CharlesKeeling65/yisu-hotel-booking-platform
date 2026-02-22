/**
 * 位置选择页
 * 目标：
 * - 提供“省/市/县三级选择 + 输入检索 + 一键定位”能力
 * - 选中后，根据来源页面（首页/列表）回跳并带回参数
 */
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import FilterBottomSheet from "@/components/hotel/FilterBottomSheet";
import LocateQuickCard from "@/components/location/LocateQuickCard";
import LocationSearchInputCard from "@/components/location/LocationSearchInputCard";
import RegionSelectorCard from "@/components/location/RegionSelectorCard";
import TopNavBar from "@/components/ui/top-nav-bar";
import { fetchLocationSuggestions, type LocationSuggestion } from "@/lib/api";
import {
    parseReverseGeocode,
    reverseGeocodeWithProvider,
    stripCityCountySuffix,
} from "@/lib/location-utils";
import { setSearchSession } from "@/lib/search-session";

const HOT_CITIES = ["扬州", "上海", "南京", "杭州"];
const HOT_AREAS = ["外滩", "陆家嘴", "西湖", "新街口", "夫子庙", "瘦西湖"];
const HISTORY_ITEMS = ["东关街", "万象城", "近地铁", "亲子房"];
const REGION_URLS = [
  "https://fastly.jsdelivr.net/npm/china-area-data@5.0.0/pcaa.json",
  "https://cdn.jsdelivr.net/npm/china-area-data@5.0.0/pcaa.json",
  "https://unpkg.com/china-area-data@5.0.0/pcaa.json",
];
const MUNICIPALITY_PREFIXES = new Set(["11", "12", "31", "50"]);

type RegionNode = { code: string; name: string; children?: RegionNode[] };
type RegionLevel = "province" | "city" | "county";

function normalizeCityLevelLabelForMunicipality(
  provinceCode: string,
  provinceName: string,
  cityName: string,
) {
  const normalizedCityName = stripCityCountySuffix(cityName || "");
  if (
    MUNICIPALITY_PREFIXES.has(String(provinceCode || "").slice(0, 2)) &&
    ["市辖区", "县"].includes(String(cityName || "").trim())
  ) {
    return stripCityCountySuffix(provinceName || "") || normalizedCityName;
  }
  return normalizedCityName;
}

const FALLBACK_REGION_TREE: RegionNode[] = [
  {
    code: "310000",
    name: "上海",
    children: [
      {
        code: "310100",
        name: "上海",
        children: [
          { code: "310101", name: "黄浦区" },
          { code: "310104", name: "徐汇区" },
          { code: "310105", name: "长宁区" },
          { code: "310112", name: "闵行区" },
          { code: "310115", name: "浦东新区" },
        ],
      },
    ],
  },
  {
    code: "110000",
    name: "北京",
    children: [
      {
        code: "110100",
        name: "北京",
        children: [
          { code: "110101", name: "东城区" },
          { code: "110105", name: "朝阳区" },
          { code: "110108", name: "海淀区" },
        ],
      },
    ],
  },
];

function toNameMap(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  Object.entries(raw as Record<string, unknown>).forEach(([k, v]) => {
    if (typeof v === "string") out[String(k)] = v;
  });
  return out;
}

function parsePcaaToTree(raw: unknown): RegionNode[] {
  if (!Array.isArray(raw) || raw.length < 3) return [];
  const maps = raw.map(toNameMap);
  const provinceMap =
    maps.find((m) =>
      Object.keys(m).some((k) => /^\d{6}$/.test(k) && k.endsWith("0000")),
    ) || {};
  const cityMap =
    maps.find((m) =>
      Object.keys(m).some(
        (k) => /^\d{6}$/.test(k) && k.endsWith("00") && !k.endsWith("0000"),
      ),
    ) || {};
  const countyMap =
    maps.find((m) =>
      Object.keys(m).some((k) => /^\d{6}$/.test(k) && !k.endsWith("00")),
    ) || {};
  if (!Object.keys(provinceMap).length || !Object.keys(cityMap).length)
    return [];

  const provinceCodes = Object.keys(provinceMap).sort(
    (a, b) => Number(a) - Number(b),
  );
  return provinceCodes.map((pCode) => {
    const cityCodes = Object.keys(cityMap)
      .filter((cCode) => cCode.slice(0, 2) === pCode.slice(0, 2))
      .sort((a, b) => Number(a) - Number(b));
    const cityNodes: RegionNode[] = cityCodes.map((cCode) => {
      const countyCodes = Object.keys(countyMap)
        .filter((dCode) => dCode.slice(0, 4) === cCode.slice(0, 4))
        .sort((a, b) => Number(a) - Number(b));
      return {
        code: cCode,
        name: normalizeCityLevelLabelForMunicipality(
          pCode,
          provinceMap[pCode] || "",
          cityMap[cCode] || "",
        ),
        children: countyCodes.map((dCode) => ({
          code: dCode,
          name: countyMap[dCode] || "",
        })),
      };
    });
    return {
      code: pCode,
      name: stripCityCountySuffix(provinceMap[pCode] || ""),
      children: cityNodes,
    };
  });
}

function parsePcaaObjectToTree(raw: unknown): RegionNode[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  const obj = raw as Record<string, Record<string, string>>;
  const provinces = obj["86"];
  if (!provinces || typeof provinces !== "object") return [];
  const provinceCodes = Object.keys(provinces).sort(
    (a, b) => Number(a) - Number(b),
  );
  return provinceCodes.map((pCode) => {
    const pName = stripCityCountySuffix(provinces[pCode] || "");
    const cityMap = obj[pCode] || {};
    const cityCodes = Object.keys(cityMap).sort(
      (a, b) => Number(a) - Number(b),
    );
    const cityNodes: RegionNode[] = cityCodes.map((cCode) => {
      const countyMap = obj[cCode] || {};
      const countyCodes = Object.keys(countyMap).sort(
        (a, b) => Number(a) - Number(b),
      );
      return {
        code: cCode,
        name: normalizeCityLevelLabelForMunicipality(
          pCode,
          provinces[pCode] || "",
          cityMap[cCode] || "",
        ),
        children: countyCodes.map((dCode) => ({
          code: dCode,
          name: countyMap[dCode] || "",
        })),
      };
    });
    return { code: pCode, name: pName, children: cityNodes };
  });
}

async function loadChinaRegionTree() {
  // 1) 优先本地依赖（离线可用）：china-area-data
  try {
    const local = require("china-area-data/pcaa.json");
    const tree = parsePcaaToTree(local);
    if (tree.length) return tree;
  } catch {
    // package 路径不匹配时，继续尝试默认导出
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const local = require("china-area-data");
    const tree = parsePcaaObjectToTree(local);
    if (tree.length) return tree;
  } catch {
    // package 未安装或路径不匹配时，继续走 CDN 兜底
  }

  // 2) 再尝试 CDN
  for (const url of REGION_URLS) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const json = await res.json();
      const tree = parsePcaaToTree(json).length
        ? parsePcaaToTree(json)
        : parsePcaaObjectToTree(json);
      if (tree.length) return tree;
    } catch {
      // ignore and try next URL
    }
  }
  return FALLBACK_REGION_TREE;
}

export default function LocationScreen() {
  const router = useRouter();
  const {
    city,
    location,
    from,
    checkIn,
    checkOut,
    priceStar,
    tags,
    scenicSpots,
    sort,
    rooms,
    adults,
    children,
  } = useLocalSearchParams<{
    city?: string;
    location?: string;
    from?: "home" | "list";
    checkIn?: string;
    checkOut?: string;
    priceStar?: string;
    tags?: string;
    scenicSpots?: string;
    sort?: "price_asc" | "price_desc" | "star_desc";
    rooms?: string;
    adults?: string;
    children?: string;
  }>();
  const inputRef = useRef<TextInput>(null);

  const [keyword, setKeyword] = useState("");
  const [historyItems, setHistoryItems] = useState(HISTORY_ITEMS);
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [locatedCity, setLocatedCity] = useState("");
  const [locatedDetail, setLocatedDetail] = useState("");

  const [regionTree, setRegionTree] = useState<RegionNode[]>([]);
  const [regionLoading, setRegionLoading] = useState(true);
  const [activeLevel, setActiveLevel] = useState<RegionLevel | null>(null);
  const [provinceCode, setProvinceCode] = useState("");
  const [cityCode, setCityCode] = useState("");
  const [countyCode, setCountyCode] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (typeof location === "string" && location.trim()) {
      setKeyword(location);
    }
  }, [location]);

  useEffect(() => {
    let mounted = true;
    setRegionLoading(true);
    loadChinaRegionTree()
      .then((tree) => {
        if (!mounted) return;
        setRegionTree(tree);
      })
      .finally(() => {
        if (!mounted) return;
        setRegionLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const target = stripCityCountySuffix(String(city || ""));
    if (!target || !regionTree.length) return;
    for (const p of regionTree) {
      for (const c of p.children || []) {
        if (stripCityCountySuffix(c.name) === target) {
          setProvinceCode(p.code);
          setCityCode(c.code);
          setCountyCode("");
          return;
        }
        for (const d of c.children || []) {
          if (stripCityCountySuffix(d.name) === target) {
            setProvinceCode(p.code);
            setCityCode(c.code);
            setCountyCode(d.code);
            return;
          }
        }
      }
    }
  }, [regionTree, city]);

  const provinceOptions = regionTree;
  const cityOptions = useMemo(
    () => provinceOptions.find((x) => x.code === provinceCode)?.children || [],
    [provinceOptions, provinceCode],
  );
  const countyOptions = useMemo(
    () => cityOptions.find((x) => x.code === cityCode)?.children || [],
    [cityOptions, cityCode],
  );
  const selectedProvince = provinceOptions.find((x) => x.code === provinceCode);
  const selectedCity = cityOptions.find((x) => x.code === cityCode);
  const selectedCounty = countyOptions.find((x) => x.code === countyCode);
  const selectedReturnCity = stripCityCountySuffix(
    selectedCounty?.name || selectedCity?.name || String(city || ""),
  );

  const handleBack = () => {
    // 若已选择省市，返回时直接带回所选城市，避免“看起来选了但返回仍是旧值”。
    const chosen = stripCityCountySuffix(
      selectedCounty?.name || selectedCity?.name || "",
    );
    if (chosen) {
      navigateWithSelection(chosen, keyword.trim() || "");
      return;
    }
    try {
      router.back();
      return;
    } catch {}
    router.replace("/");
  };

  const navigateWithSelection = (nextCity: string, nextLocation: string) => {
    const targetPath = from === "list" ? "/list" : "/";
    const normalizedCity = stripCityCountySuffix(nextCity || "");
    // 同步会话，避免首页 useFocusEffect 把城市回写成旧值。
    setSearchSession({
      city: normalizedCity,
      location: nextLocation || "",
    });
    if (targetPath === "/list") {
      const prevTag = String(tags ?? "").trim();
      const nextKeyword = String(nextLocation || "").trim();
      const nextTags = prevTag && nextKeyword === prevTag ? prevTag : "";
      router.replace({
        pathname: "/list",
        params: {
          city: normalizedCity,
          location: nextLocation,
          checkIn: checkIn ?? "",
          checkOut: checkOut ?? "",
          priceStar: priceStar ?? "",
          tags: nextTags,
          rooms: rooms ?? "",
          adults: adults ?? "",
          children: children ?? "",
          scenicSpots: scenicSpots ?? "",
          sort: sort ?? "",
        },
      });
      return;
    }
    router.replace({
      pathname: "/",
      params: { city: normalizedCity, location: nextLocation },
    });
  };

  const handleLocate = async () => {
    setErrorText("");
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setErrorText("定位权限未开启");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      const via = await reverseGeocodeWithProvider(
        pos.coords.latitude,
        pos.coords.longitude,
      );
      const provider = via.provider;
      const info = via.reverse as Location.LocationGeocodedAddress[];
      if (__DEV__)
        console.log("[location-page-locate:raw]", {
          provider,
          coords: pos.coords,
          reverse: info,
          normalized: via.normalized,
        });
      const parsed = parseReverseGeocode(info?.[0]);
      const normalized = via.normalized || {};
      if (__DEV__) console.log("[location-page-locate:parsed]", parsed);
      const nextCity = stripCityCountySuffix(
        String(normalized.cityOrCounty || parsed.cityOrCounty || ""),
      );
      const nextStreet = String(normalized.street || parsed.detailText || "").trim();

      if (!nextCity) {
        setErrorText(
          "已获取坐标，但未获取到地址（Web/模拟器常见）。可用省市县下拉或手动输入。",
        );
        setLocatedCity("");
        setLocatedDetail("");
      } else {
        setLocatedCity(nextCity);
        setLocatedDetail(nextStreet);
      }
    } catch {
      setErrorText("定位失败，请重试");
      setLocatedCity("");
      setLocatedDetail("");
    } finally {
      setLocating(false);
    }
  };

  useEffect(() => {
    // 进入地点页后自动尝试定位
    handleLocate();
  }, []);

  const handleSubmit = () => {
    if (!keyword.trim()) {
      handleBack();
      return;
    }
    const selectedCityLabel = stripCityCountySuffix(
      selectedCounty?.name || selectedCity?.name || String(city || "上海"),
    );
    navigateWithSelection(selectedCityLabel, keyword.trim());
  };

  const handleSelect = (selectedCityName: string, selectedLocation: string) => {
    navigateWithSelection(selectedCityName, selectedLocation);
  };

  const localSuggestionFallback = useMemo(() => {
    const q = keyword.trim();
    if (!q) return [] as LocationSuggestion[];
    const qLower = q.toLowerCase();
    const seen = new Set<string>();
    const out: LocationSuggestion[] = [];

    const push = (item: LocationSuggestion) => {
      const cityName = stripCityCountySuffix(item.city || "");
      const label = String(item.label || "").trim();
      if (!label) return;
      const key = `${item.type}|${cityName}|${label}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ ...item, city: cityName });
    };

    for (const c of HOT_CITIES) {
      if (c.toLowerCase().includes(qLower)) {
        push({ type: "city", city: c, label: stripCityCountySuffix(c) });
      }
    }
    for (const area of HOT_AREAS) {
      if (area.toLowerCase().includes(qLower)) {
        push({
          type: "scenic",
          city: selectedReturnCity || stripCityCountySuffix(String(city || "上海")),
          label: area,
        });
      }
    }
    for (const p of regionTree) {
      for (const c of p.children || []) {
        const cityName = stripCityCountySuffix(c.name);
        if (cityName.toLowerCase().includes(qLower)) {
          push({ type: "city", city: cityName, label: cityName });
        }
        for (const d of c.children || []) {
          const countyName = stripCityCountySuffix(d.name);
          if (countyName.toLowerCase().includes(qLower)) {
            push({ type: "area", city: cityName, label: countyName });
          }
        }
      }
      if (out.length >= 12) break;
    }

    return out.slice(0, 12);
  }, [keyword, regionTree, selectedReturnCity, city]);

  useEffect(() => {
    const q = keyword.trim();
    if (!q) {
      setSuggestions([]);
      setSuggestionsLoading(false);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setSuggestionsLoading(true);
      try {
        const list = await fetchLocationSuggestions({
          q,
          city: selectedReturnCity || stripCityCountySuffix(String(city || "")),
          limit: 12,
        });
        if (cancelled) return;
        setSuggestions(list);
      } catch {
        if (cancelled) return;
        setSuggestions(localSuggestionFallback);
      } finally {
        if (!cancelled) setSuggestionsLoading(false);
      }
    }, 220);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [keyword, city, selectedReturnCity, localSuggestionFallback]);

  const activeOptions =
    activeLevel === "province"
      ? provinceOptions
      : activeLevel === "city"
        ? cityOptions
        : countyOptions;
  const activeTitle =
    activeLevel === "province"
      ? "选择省"
      : activeLevel === "city"
        ? "选择市"
        : "选择县/区";

  return (
    <View className="flex-1 bg-white">
      <TopNavBar title="地点选择 / 定位" onBack={handleBack} />
      <View className="px-4">
        <LocateQuickCard
          locating={locating}
          errorText={errorText}
          locatedCity={locatedCity}
          locatedDetail={locatedDetail}
          onLocate={handleLocate}
          onSelectCity={() => handleSelect(locatedCity, "")}
          onSelectStreet={() => handleSelect(locatedCity, locatedDetail)}
        />

        <LocationSearchInputCard
          inputRef={inputRef}
          keyword={keyword}
          onChangeKeyword={setKeyword}
          onSubmit={() => handleSubmit()}
        />

        <RegionSelectorCard
          selectedProvinceName={selectedProvince?.name}
          selectedCityName={selectedCity?.name}
          selectedCountyName={selectedCounty?.name}
          provinceCode={provinceCode}
          cityCode={cityCode}
          onOpenProvince={() => setActiveLevel("province")}
          onOpenCity={() => setActiveLevel("city")}
          onOpenCounty={() => setActiveLevel("county")}
          onConfirmCityOrCounty={() => {
            const target = stripCityCountySuffix(
              selectedCounty?.name || selectedCity?.name || "",
            );
            if (!target) return;
            handleSelect(target, "");
          }}
        />

        {keyword.trim().length > 0 ? (
          <>
            <Text className="mt-6 text-sm text-slate-500">输入联想</Text>
            <View className="mt-3">
              {suggestions.length === 0 ? (
                <Text className="text-xs text-slate-400">
                  {suggestionsLoading ? "搜索中..." : "暂无匹配结果"}
                </Text>
              ) : (
                suggestions.map((item) => (
                  <Pressable
                    key={`${item.type}-${item.city}-${item.label}`}
                    onPress={() =>
                      handleSelect(stripCityCountySuffix(item.city), item.label)
                    }
                    className="mt-2 rounded-2xl border border-slate-100 bg-white px-3 py-3"
                  >
                    <Text className="text-sm text-slate-700">
                      {item.label}
                      <Text className="text-xs text-slate-400">
                        {" "}
                        · {item.city}
                        {item.type === "hotel"
                          ? " · 酒店"
                          : item.type === "scenic"
                            ? " · 景点/商圈"
                            : item.type === "area"
                              ? " · 区县"
                              : item.type === "city"
                                ? " · 城市"
                                : ""}
                      </Text>
                    </Text>
                  </Pressable>
                ))
              )}
            </View>
          </>
        ) : (
          <>
            <View className="mt-6 flex-row items-center justify-between">
              <Text className="text-sm text-slate-500">历史搜索</Text>
              <Pressable onPress={() => setHistoryItems([])}>
                <Text className="text-xs text-slate-400">清空</Text>
              </Pressable>
            </View>
            <View className="mt-3 flex-row flex-wrap gap-2">
              {historyItems.length === 0 ? (
                <Text className="text-xs text-slate-400">暂无历史记录</Text>
              ) : (
                historyItems.map((item) => (
                  <Pressable
                    key={item}
                    onPress={() =>
                      handleSelect(
                        stripCityCountySuffix(String(city || "上海")),
                        item,
                      )
                    }
                    className="rounded-full border border-slate-100 bg-white px-3 py-2"
                  >
                    <Text className="text-xs text-slate-600">{item}</Text>
                  </Pressable>
                ))
              )}
            </View>

            <Text className="mt-6 text-sm text-slate-500">热门城市</Text>
            <View className="mt-3 flex-row flex-wrap gap-2">
              {HOT_CITIES.map((item) => (
                <Pressable
                  key={item}
                  onPress={() => handleSelect(stripCityCountySuffix(item), "")}
                  className="rounded-full bg-[#F5F7FB] px-3 py-2"
                >
                  <Text className="text-xs text-slate-600">{item}</Text>
                </Pressable>
              ))}
            </View>

            <Text className="mt-6 text-sm text-slate-500">热门商圈</Text>
            <View className="mt-3 flex-row flex-wrap gap-2">
              {HOT_AREAS.map((item) => (
                <Pressable
                  key={item}
                  onPress={() =>
                    handleSelect(
                      stripCityCountySuffix(String(city || "上海")),
                      item,
                    )
                  }
                  className="rounded-full bg-[#F5F7FB] px-3 py-2"
                >
                  <Text className="text-xs text-slate-600">{item}</Text>
                </Pressable>
              ))}
            </View>
          </>
        )}
      </View>

      <FilterBottomSheet
        visible={Boolean(activeLevel)}
        title={activeTitle}
        onClose={() => setActiveLevel(null)}
      >
        {regionLoading ? (
          <Text className="py-3 text-xs text-slate-400">
            加载全国省市县数据中...
          </Text>
        ) : (
          <ScrollView
            className="max-h-80"
            showsVerticalScrollIndicator={true}
            persistentScrollbar={true}
          >
            {activeOptions.map((item) => (
              <Pressable
                key={item.code}
                className="border-b border-slate-100 py-3"
                onPress={() => {
                  if (activeLevel === "province") {
                    setProvinceCode(item.code);
                    setCityCode("");
                    setCountyCode("");
                    setActiveLevel("city");
                    return;
                  }
                  if (activeLevel === "city") {
                    setCityCode(item.code);
                    setCountyCode("");
                    setActiveLevel("county");
                    return;
                  }
                  setCountyCode(item.code);
                  setActiveLevel(null);
                }}
              >
                <Text className="text-sm text-slate-700">{item.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </FilterBottomSheet>
    </View>
  );
}
