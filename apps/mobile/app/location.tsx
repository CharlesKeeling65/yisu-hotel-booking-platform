/**
 * 位置选择页（极致排版与交互版 + 高德定位逻辑合并版）
 */
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import FilterBottomSheet from "@/components/hotel/FilterBottomSheet";
import { IconSymbol } from "@/components/ui/icon-symbol";
import TopNavBar from "@/components/ui/top-nav-bar";
import { fetchLocationSuggestions, type LocationSuggestion } from "@/lib/api";
import {
  parseReverseGeocode,
  reverseGeocodeWithProvider,
  stripCityCountySuffix,
} from "@/lib/location-utils";
import { setSearchSession } from "@/lib/search-session";

const HOT_CITIES = ["扬州", "上海", "北京", "南京", "杭州", "广州", "深圳", "成都"];
const HOT_AREAS = ["外滩", "陆家嘴", "西湖", "新街口", "夫子庙", "瘦西湖", "春熙路", "天河城"];
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
  try {
    const local = require("china-area-data/pcaa.json");
    const tree = parsePcaaToTree(local);
    if (tree.length) return tree;
  } catch { }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const local = require("china-area-data");
    const tree = parsePcaaObjectToTree(local);
    if (tree.length) return tree;
  } catch { }

  for (const url of REGION_URLS) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const json = await res.json();
      const tree = parsePcaaToTree(json).length
        ? parsePcaaToTree(json)
        : parsePcaaObjectToTree(json);
      if (tree.length) return tree;
    } catch { }
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
    } catch { }
    router.replace("/");
  };

  const navigateWithSelection = (nextCity: string, nextLocation: string) => {
    const targetPath = from === "list" ? "/list" : "/";
    const normalizedCity = stripCityCountySuffix(nextCity || "");
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

  // 👉 核心逻辑融合点：保留师兄的高德 API 错误处理和数据提取逻辑
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

      const info = via.reverse as Location.LocationGeocodedAddress[];
      const provider = via.provider;
      const normalized = via.normalized || {};

      if (__DEV__)
        console.log("[location-page-locate:raw]", {
          provider,
          coords: pos.coords,
          reverse: info,
          normalized: via.normalized,
        });

      const parsed = parseReverseGeocode(info?.[0]);
      if (__DEV__) console.log("[location-page-locate:parsed]", parsed);

      const nextCity = stripCityCountySuffix(
        String(normalized.cityOrCounty || parsed.cityOrCounty || ""),
      );
      const nextStreet = String(normalized.street || parsed.detailText || "").trim();

      if (!nextCity) {
        setErrorText(
          "已获取坐标，但未获取到地址。可用省市县下拉或手动输入。",
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
        : "选择区/县";

  return (
    <View className="flex-1 bg-white">
      <TopNavBar title="地点选择 / 定位" onBack={handleBack} />

      <ScrollView className="flex-1 px-4" keyboardShouldPersistTaps="handled">

        <View className="mt-3 flex-row items-center rounded-full bg-slate-100/80 px-4 py-2.5">
          <IconSymbol size={16} name="magnifyingglass" color="#94A3B8" />
          <TextInput
            ref={inputRef}
            value={keyword}
            onChangeText={setKeyword}
            className="flex-1 ml-2 text-[14px] font-medium text-slate-900 min-w-0"
            style={{ outlineStyle: 'none' } as any}
            placeholder="关键字/位置/品牌/酒店名"
            placeholderTextColor="#94A3B8"
            returnKeyType="search"
            autoFocus
            onSubmitEditing={handleSubmit}
          />
          {keyword.length > 0 ? (
            <Pressable onPress={() => setKeyword("")} className="ml-2 h-5 w-5 items-center justify-center rounded-full bg-slate-300">
              <Text className="text-[11px] font-bold text-white">×</Text>
            </Pressable>
          ) : null}
        </View>

        {keyword.trim().length > 0 ? (
          <View className="mt-6">
            <Text className="text-[14px] font-bold text-slate-800 mb-3">输入联想</Text>
            {suggestions.length === 0 ? (
              <Text className="text-[13px] text-slate-400">
                {suggestionsLoading ? "搜索中..." : "暂无匹配结果，可直接点击键盘回车搜索"}
              </Text>
            ) : (
              suggestions.map((item) => (
                <Pressable
                  key={`${item.type}-${item.city}-${item.label}`}
                  onPress={() => handleSelect(stripCityCountySuffix(item.city), item.label)}
                  className="mt-2 flex-row items-center rounded-xl bg-slate-50 px-4 py-3.5 border border-slate-100"
                >
                  <IconSymbol size={16} name="location.fill" color="#94A3B8" />
                  <Text className="ml-2 text-[15px] font-bold text-slate-700">
                    {item.label}
                  </Text>

                  <Text className="ml-2 text-[12px] font-medium text-slate-400">
                    {item.city}
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
                </Pressable>
              ))
            )}
          </View>
        ) : (
          <>

            <View className="mt-6 flex-row items-center justify-between mb-3">
              <Text className="text-[14px] font-bold text-slate-800">当前定位与切换</Text>
            </View>

            <View className="rounded-2xl border border-[#E2E8F0] bg-white shadow-sm shadow-slate-100 overflow-hidden">

              <Pressable
                onPress={() => {
                  if (locatedCity) handleSelect(locatedCity, locatedDetail || locatedCity);
                  else handleLocate();
                }}
                className="flex-row items-center justify-between bg-[#F8FAFC] px-4 py-3.5 border-b border-[#F1F5F9]"
              >
                <View className="flex-row items-center flex-1 pr-4">
                  <IconSymbol size={16} name="location.fill" color="#1890FF" />
                  <Text className="ml-1.5 text-[14px] font-bold text-[#1890FF]" numberOfLines={1}>
                    {locating
                      ? "正在定位中..."
                      : locatedCity
                        ? `${locatedCity} ${locatedDetail}`
                        : (errorText || "点击获取当前位置")}
                  </Text>
                </View>
                {!locating && locatedCity ? (
                  <Text className="text-[11px] font-bold text-[#1890FF]/60 shrink-0">点击使用</Text>
                ) : null}
              </Pressable>

              <View className="flex-row items-center justify-between px-2 py-1">
                <Pressable onPress={() => setActiveLevel("province")} className="flex-1 items-center py-2.5">
                  <Text className={`text-[13px] font-bold ${selectedProvince ? 'text-slate-800' : 'text-slate-400'}`}>
                    {selectedProvince?.name || "选择省份"}
                  </Text>
                </Pressable>
                <View className="w-[1px] h-3 bg-slate-200" />
                <Pressable onPress={() => setActiveLevel("city")} disabled={!provinceCode} className="flex-1 items-center py-2.5">
                  <Text className={`text-[13px] font-bold ${selectedCity ? 'text-slate-800' : 'text-slate-400'}`}>
                    {selectedCity?.name || "选择城市"}
                  </Text>
                </Pressable>
                <View className="w-[1px] h-3 bg-slate-200" />
                <Pressable onPress={() => setActiveLevel("county")} disabled={!cityCode} className="flex-1 items-center py-2.5">
                  <Text className={`text-[13px] font-bold ${selectedCounty ? 'text-[#1890FF]' : 'text-slate-400'}`}>
                    {selectedCounty?.name || "区/县 (可选)"}
                  </Text>
                </Pressable>
              </View>

              {provinceCode && cityCode ? (
                <Pressable
                  className="bg-[#1890FF] items-center py-2.5 mx-3 mb-3 rounded-xl active:bg-[#096DD9]"
                  onPress={() => {
                    const target = stripCityCountySuffix(selectedCounty?.name || selectedCity?.name || "");
                    if (target) handleSelect(target, "");
                  }}
                >
                  <Text className="text-[13px] font-bold text-white tracking-[1px]">确定切换</Text>
                </Pressable>
              ) : null}
            </View>

            {historyItems.length > 0 ? (
              <View className="mt-7">
                <View className="mb-3 flex-row items-center justify-between">
                  <Text className="text-[14px] font-bold text-slate-800">历史记录</Text>
                  <Pressable onPress={() => setHistoryItems([])} className="flex-row items-center">
                    <IconSymbol size={12} name="trash" color="#94A3B8" />
                    <Text className="ml-1 text-[12px] text-slate-400">清空</Text>
                  </Pressable>
                </View>
                <View className="flex-row flex-wrap gap-2.5">
                  {historyItems.map((item) => (
                    <Pressable
                      key={item}
                      onPress={() => handleSelect(stripCityCountySuffix(String(city || "上海")), item)}
                      className="rounded-full bg-[#F4F5F8] px-3.5 py-1.5 active:bg-slate-200"
                    >
                      <Text className="text-[12px] text-[#333333]">{item}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            <View className="mt-7">
              <Text className="mb-3 text-[14px] font-bold text-slate-800">热门城市</Text>
              <View className="flex-row flex-wrap gap-2.5">
                {HOT_CITIES.map((item) => (
                  <Pressable
                    key={item}
                    onPress={() => handleSelect(stripCityCountySuffix(item), "")}
                    className="rounded-full bg-[#F4F5F8] px-3.5 py-1.5 active:bg-slate-200"
                  >
                    <Text className="text-[12px] text-[#333333]">{item}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View className="mt-7 mb-12">
              <Text className="mb-3 text-[14px] font-bold text-slate-800">热门行政区/商圈</Text>
              <View className="flex-row flex-wrap gap-2.5">
                {HOT_AREAS.map((item) => (
                  <Pressable
                    key={item}
                    onPress={() => handleSelect(stripCityCountySuffix(String(city || "上海")), item)}
                    className="rounded-full bg-[#F4F5F8] px-3.5 py-1.5 active:bg-slate-200"
                  >
                    <Text className="text-[12px] text-[#333333]">{item}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </>
        )}
      </ScrollView>

      <FilterBottomSheet
        visible={Boolean(activeLevel)}
        title={activeTitle}
        onClose={() => setActiveLevel(null)}
      >
        {regionLoading ? (
          <Text className="py-4 text-center text-[13px] font-medium text-slate-400">
            加载全国省市数据中...
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
                className="border-b border-slate-50 py-3.5 px-2 active:bg-slate-50"
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
                <Text className="text-[14px] font-medium text-slate-700">{item.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </FilterBottomSheet>
    </View>
  );
}