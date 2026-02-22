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
import { IconSymbol } from "@/components/ui/icon-symbol";
import TopNavBar from "@/components/ui/top-nav-bar";
import {
    parseReverseGeocode,
    reverseGeocodeWithProvider,
    stripCityCountySuffix,
} from "@/lib/location-utils";
import { setSearchSession } from "@/lib/search-session";

const HOT_CITIES = ["扬州", "上海", "南京", "杭州"];
const HOT_AREAS = ["外滩", "陆家嘴", "西湖", "新街口", "夫子庙", "瘦西湖"];
const HISTORY_ITEMS = ["东关街", "万象城", "近地铁", "亲子房"];
const SUGGESTIONS = [
  { city: "上海", label: "外滩" },
  { city: "上海", label: "陆家嘴" },
  { city: "杭州", label: "西湖" },
  { city: "南京", label: "新街口" },
  { city: "南京", label: "夫子庙" },
  { city: "扬州", label: "瘦西湖" },
  { city: "扬州", label: "东关街" },
];
const REGION_URLS = [
  "https://fastly.jsdelivr.net/npm/china-area-data@5.0.0/pcaa.json",
  "https://cdn.jsdelivr.net/npm/china-area-data@5.0.0/pcaa.json",
  "https://unpkg.com/china-area-data@5.0.0/pcaa.json",
];

type RegionNode = { code: string; name: string; children?: RegionNode[] };
type RegionLevel = "province" | "city" | "county";

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
        name: stripCityCountySuffix(cityMap[cCode] || ""),
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
        name: stripCityCountySuffix(cityMap[cCode] || ""),
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
  const [locating, setLocating] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [locatedCity, setLocatedCity] = useState("");
  const [locatedDetail, setLocatedDetail] = useState("");
  const [locatedRawText, setLocatedRawText] = useState("");

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
        });
      const parsed = parseReverseGeocode(info?.[0]);
      if (__DEV__) console.log("[location-page-locate:parsed]", parsed);
      if (!info?.[0]) {
        setErrorText(
          "已获取坐标，但未获取到地址（Web/模拟器常见）。可用省市县下拉或手动输入。",
        );
        setLocatedCity("");
        setLocatedDetail(
          `经度 ${pos.coords.longitude.toFixed(6)} · 纬度 ${pos.coords.latitude.toFixed(6)}`,
        );
      } else {
        setLocatedCity(parsed.cityOrCounty || "");
        setLocatedDetail(parsed.detailText || "");
      }
      setLocatedRawText(
        JSON.stringify({ coords: pos.coords, reverse: info }, null, 2),
      );
    } catch {
      setErrorText("定位失败，请重试");
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

  const suggestions = useMemo(() => {
    if (!keyword.trim()) return [];
    return SUGGESTIONS.filter((item) => item.label.includes(keyword.trim()));
  }, [keyword]);

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
        <View className="mt-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
          <TextInput
            ref={inputRef}
            value={keyword}
            onChangeText={setKeyword}
            className="text-base text-slate-900"
            placeholder="位置/商圈/酒店"
            placeholderTextColor="#C0C4CC"
            returnKeyType="search"
            autoFocus
            onSubmitEditing={handleSubmit}
          />
        </View>

        <View className="mt-3 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3">
          <Text className="text-xs text-slate-500">
            行政区选择（省、市必填，县/区可选）
          </Text>
          <View className="mt-2 flex-row items-center gap-2">
            <Pressable
              className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2"
              onPress={() => setActiveLevel("province")}
            >
              <Text
                numberOfLines={1}
                className={`text-sm ${selectedProvince ? "text-slate-700" : "text-slate-400"}`}
              >
                {selectedProvince?.name || "请选择省"}
              </Text>
            </Pressable>
            <Pressable
              className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2"
              onPress={() => setActiveLevel("city")}
              disabled={!provinceCode}
            >
              <Text
                numberOfLines={1}
                className={`text-sm ${selectedCity ? "text-slate-700" : "text-slate-400"}`}
              >
                {selectedCity?.name || "请选择市"}
              </Text>
            </Pressable>
            <Pressable
              className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2"
              onPress={() => setActiveLevel("county")}
              disabled={!cityCode}
            >
              <Text
                numberOfLines={1}
                className={`text-sm ${selectedCounty ? "text-slate-700" : "text-slate-400"}`}
              >
                {selectedCounty?.name || "县/区(可选)"}
              </Text>
            </Pressable>
          </View>
          <View className="mt-3 flex-row items-center gap-3">
            <Pressable
              disabled={!provinceCode || !cityCode}
              className={`flex-1 rounded-xl py-2.5 ${provinceCode && cityCode ? "bg-[#1890FF]" : "bg-slate-200"}`}
              onPress={() => {
                const target = stripCityCountySuffix(
                  selectedCounty?.name || selectedCity?.name || "",
                );
                if (!target) return;
                handleSelect(target, "");
              }}
            >
              <Text className="text-center text-sm font-semibold text-white">
                仅返回市/县名
              </Text>
            </Pressable>
          </View>
        </View>

        <View className="mt-4 flex-row items-center justify-between">
          <Text className="text-sm text-slate-500">定位当前城市</Text>
          <Pressable
            disabled={locating}
            onPress={handleLocate}
            className={`h-9 w-9 items-center justify-center rounded-full ${locating ? "bg-[#D7E9FB]" : "bg-[#E6F4FF]"}`}
          >
            <IconSymbol size={18} name="location.fill" color="#1890FF" />
          </Pressable>
        </View>
        {errorText ? (
          <Text className="mt-2 text-xs text-red-500">{errorText}</Text>
        ) : null}

        {locatedCity ? (
          <View className="mt-2 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3">
            <Text className="text-xs text-slate-500">
              当前定位结果（可直接返回）
            </Text>
            <View className="mt-2 gap-2">
              <Pressable
                onPress={() => handleSelect(locatedCity, "")}
                className="rounded-xl border border-[#D8E8FA] bg-white px-3 py-2"
              >
                <Text className="text-sm font-semibold text-slate-700">
                  {locatedCity}
                </Text>
              </Pressable>
              <Pressable
                onPress={() =>
                  handleSelect(locatedCity, locatedDetail || locatedCity)
                }
                className="rounded-xl border border-[#D8E8FA] bg-white px-3 py-2"
              >
                <Text className="text-sm text-slate-700">
                  {locatedDetail
                    ? `${locatedCity} ${locatedDetail}`
                    : locatedCity}
                </Text>
              </Pressable>
            </View>
            {__DEV__ && locatedRawText ? (
              <View className="mt-3 rounded-xl bg-white px-2.5 py-2">
                <Text className="text-[11px] text-slate-400">
                  定位原始返回（调试）
                </Text>
                <Text className="mt-1 text-[11px] text-slate-500">
                  {locatedRawText}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {keyword.trim().length > 0 ? (
          <>
            <Text className="mt-6 text-sm text-slate-500">输入联想</Text>
            <View className="mt-3">
              {suggestions.length === 0 ? (
                <Text className="text-xs text-slate-400">暂无匹配结果</Text>
              ) : (
                suggestions.map((item) => (
                  <Pressable
                    key={`${item.city}-${item.label}`}
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
