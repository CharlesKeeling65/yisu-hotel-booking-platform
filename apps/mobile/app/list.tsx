/**
 * 列表页（搜索结果页）
 */
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import CompactSearchPanel from "@/components/hotel/CompactSearchPanel";
import DateRangePickerSheet from "@/components/hotel/DateRangePickerSheet";
import FilterBottomSheet from "@/components/hotel/FilterBottomSheet";
import GuestPickerSheet, { GuestDraft } from "@/components/hotel/GuestPickerSheet";
import HotelCard from "@/components/hotel/HotelCard";
import PriceStarPickerSheet, { PriceStarDraft } from "@/components/hotel/PriceStarPickerSheet";
import SearchSummarySheet from "@/components/hotel/SearchSummarySheet"; // 👉 新增引入
import { fetchMobileHotels } from "@/lib/api";
import { stripCityCountySuffix } from "@/lib/location-utils";
import { getDefaultSearchSession, getSearchSession, setSearchSession } from "@/lib/search-session";
import type { Hotel } from "@yisu/shared";

const SORT_OPTIONS = [
  { label: "推荐", value: undefined as "price_asc" | "price_desc" | "star_desc" | undefined },
  { label: "价格升序", value: "price_asc" as const },
  { label: "价格降序", value: "price_desc" as const },
  { label: "星级优先", value: "star_desc" as const },
];
const SCENIC_SPOT_OPTIONS = ["外滩", "东方明珠", "迪士尼", "人民广场", "南京路", "豫园", "鸟巢", "三里屯", "颐和园", "西湖"];
const TAG_OPTIONS = ["亲子友好", "豪华酒店", "免费停车", "近地铁", "含早餐", "江景海景"];
const DEFAULT_PRICE: PriceStarDraft = { min: 0, max: 800, stars: [] };
const STAR_MAP: Record<string, number> = { "2星及以下": 2, "3星": 3, "4星": 4 };

function parsePriceStar(label: string): PriceStarDraft {
  const text = String(label || "");
  const stars: string[] = [];
  if (text.includes("2星及以下")) stars.push("2星及以下");
  if (text.includes("3星")) stars.push("3星");
  if (text.includes("4星")) stars.push("4星");

  const range = text.match(/¥(\d+)-¥(\d+)\+?/);
  if (range?.[1] && range?.[2]) return { min: Number(range[1]), max: Number(range[2]), stars };
  return { ...DEFAULT_PRICE, stars };
}

export default function ListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const defaultSession = getDefaultSearchSession();
  const session = getSearchSession();
  const params = useLocalSearchParams<{
    city?: string;
    location?: string;
    keyword?: string;
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
  const firstTag = typeof params.tags === "string" ? params.tags.split(",").map((x) => x.trim()).filter(Boolean)[0] : "";

  const [city, setCity] = useState(stripCityCountySuffix(params.city || session.city || "上海市"));
  const [location, setLocation] = useState(params.location || params.keyword || firstTag || session.location || "");
  const [checkInDate, setCheckInDate] = useState(params.checkIn || session.checkIn || defaultSession.checkIn);
  const [checkOutDate, setCheckOutDate] = useState(params.checkOut || session.checkOut || defaultSession.checkOut);
  const [rooms, setRooms] = useState(Math.max(1, Number(params.rooms || session.rooms || "1")));
  const [adults, setAdults] = useState(Math.max(Math.max(1, Number(params.adults || session.adults || "1")), Math.max(1, Number(params.rooms || session.rooms || "1"))));
  const [children, setChildren] = useState(Math.max(0, Number(params.children || session.children || "0")));
  const [priceStar, setPriceStar] = useState(params.priceStar || session.priceStar || "不限星级");
  const [tags, setTags] = useState(params.tags || session.tags || "");
  const [priceDraft, setPriceDraft] = useState<PriceStarDraft>(parsePriceStar(params.priceStar || session.priceStar || ""));
  const [selectedSpots, setSelectedSpots] = useState<string[]>(
    typeof params.scenicSpots === "string"
      ? params.scenicSpots.split(",").map((x) => x.trim()).filter(Boolean)
      : session.scenicSpots
        ? session.scenicSpots.split(",").map((x) => x.trim()).filter(Boolean)
        : []
  );

  const [list, setList] = useState<Hotel[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [sort, setSort] = useState<"price_asc" | "price_desc" | "star_desc" | undefined>(params.sort || (session.sort as "price_asc" | "price_desc" | "star_desc" | undefined));
  const [locating, setLocating] = useState(false);

  // 👉 弹窗控制状态
  const [isSummarySheetOpen, setIsSummarySheetOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isGuestOpen, setIsGuestOpen] = useState(false);
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [isScenicOpen, setIsScenicOpen] = useState(false);
  const [isPriceOpen, setIsPriceOpen] = useState(false);
  const [isTagOpen, setIsTagOpen] = useState(false);

  const nights = useMemo(() => {
    const diff = Math.ceil((new Date(checkOutDate).getTime() - new Date(checkInDate).getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(1, diff);
  }, [checkInDate, checkOutDate]);
  const tagList = useMemo(() => (tags ? tags.split(",").map((x) => x.trim()).filter(Boolean) : []), [tags]);
  const sortLabel = useMemo(
    () => SORT_OPTIONS.find((item) => item.value === sort)?.label || "排序",
    [sort]
  );
  const scenicCount = selectedSpots.length;
  const tagCount = tagList.length;
  const priceCount = (priceDraft.min !== 0 || priceDraft.max !== 800 ? 1 : 0) + (priceDraft.stars.length ? 1 : 0);

  useEffect(() => {
    if (typeof params.city === "string") setCity(stripCityCountySuffix(params.city));
    if (typeof params.location === "string") setLocation(params.location);
    if (!params.location && typeof params.keyword === "string") setLocation(params.keyword);
    if (!params.location && !params.keyword && firstTag) setLocation(firstTag);
    if (typeof params.priceStar === "string") {
      setPriceStar(params.priceStar || "不限星级");
      setPriceDraft(parsePriceStar(params.priceStar || ""));
    }
    if (typeof params.tags === "string") setTags(params.tags);
    if (params.tags === undefined) setTags("");
    const roomParam = typeof params.rooms === "string" ? Math.max(1, Number(params.rooms || "1")) : null;
    const adultParam = typeof params.adults === "string" ? Math.max(1, Number(params.adults || "1")) : null;
    if (roomParam !== null) {
      setRooms(roomParam);
      setAdults((prev) => Math.max(adultParam ?? prev, roomParam));
    } else if (adultParam !== null) {
      setAdults((prev) => Math.max(adultParam, prev));
    }
    if (typeof params.children === "string") setChildren(Math.max(0, Number(params.children || "0")));
    if (typeof params.scenicSpots === "string") {
      setSelectedSpots(params.scenicSpots.split(",").map((x) => x.trim()).filter(Boolean));
    }
    if (params.scenicSpots === undefined) setSelectedSpots([]);
    if (typeof params.sort === "string") setSort(params.sort);
  }, [params.city, params.location, params.keyword, params.priceStar, params.tags, params.rooms, params.adults, params.children, params.scenicSpots, params.sort, firstTag]);

  async function load(targetPage: number, append: boolean) {
    if (append) setLoadingMore(true); else setLoading(true);
    setError("");
    try {
      const data = await fetchMobileHotels<Hotel>({
        page: targetPage,
        pageSize: 8,
        city,
        keyword: location,
        priceStar,
        priceMin: priceDraft.min,
        priceMax: priceDraft.max,
        stars: priceDraft.stars.map((x) => STAR_MAP[x]).filter(Boolean),
        tags: tagList,
        scenicSpots: selectedSpots,
        sort,
      });
      setList((prev) => (append ? [...prev, ...data.list] : data.list));
      setPage(targetPage);
      setHasMore(data.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
      if (!append) setList([]);
    } finally {
      if (append) setLoadingMore(false); else setLoading(false);
    }
  }

  useEffect(() => {
    load(1, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city, location, checkInDate, checkOutDate, priceStar, tags, selectedSpots, sort, priceDraft]);

  useEffect(() => {
    setSearchSession({
      city,
      location,
      checkIn: checkInDate,
      checkOut: checkOutDate,
      rooms,
      adults: Math.max(adults, rooms),
      children,
      priceStar,
      tags,
      scenicSpots: selectedSpots.join(","),
      sort: sort || "",
    });
  }, [city, location, checkInDate, checkOutDate, rooms, adults, children, priceStar, tags, selectedSpots, sort]);

  return (
    <>
      <FlatList
        className="flex-1 bg-neutral-50"
        contentContainerClassName="px-4 pb-24"
        contentContainerStyle={{ paddingTop: 0 }}
        data={list}
        keyExtractor={(item) => item.id}
        stickyHeaderIndices={[0]}
        ListHeaderComponent={
          <View className="bg-neutral-50">
            <View
              className="-mx-4 bg-[#EEF3F8]"
              style={{ paddingTop: insets.top }}
            >
              <CompactSearchPanel
                city={city}
                location={location}
                checkInDate={checkInDate}
                checkOutDate={checkOutDate}
                nights={nights}
                rooms={rooms}
                adults={adults}
                childCount={children}
                onBackPress={() => {
                  setSearchSession({ sort: "" });
                  try {
                    router.back();
                    return;
                  } catch { }
                  router.replace("/");
                }}
                onCityPress={() => router.replace({ pathname: "/location", params: { city, from: "list" } })}
                onLocationPress={() => router.replace({ pathname: "/location", params: { city, location, from: "list" } })}
                onLocationClearPress={() => { setLocation(""); setTags(""); }}

                onDatePress={() => setIsSummarySheetOpen(true)}
                onGuestPress={() => setIsSummarySheetOpen(true)}

                onSearch={() => load(1, false)}
                flat
                filterButtons={[
                  { key: "sort", label: sortLabel, active: Boolean(sort), onPress: () => setIsSortOpen(true) },
                  { key: "scenic", label: "附近景点", active: scenicCount > 0, count: scenicCount || undefined, onPress: () => setIsScenicOpen(true) },
                  { key: "price", label: "价格/星级", active: priceCount > 0, count: priceCount || undefined, onPress: () => setIsPriceOpen(true) },
                  { key: "tag", label: "标签", active: tagCount > 0, count: tagCount || undefined, onPress: () => setIsTagOpen(true) },
                ]}
              />
            </View>
            {loading ? <Text className="mt-2 text-xs text-neutral-400">加载中...</Text> : null}
            {error ? <Text className="mt-2 text-xs text-red-400">加载失败：{error}</Text> : null}
          </View>
        }
        renderItem={({ item, index }) => (
          <View className={index === 0 ? "mt-3" : ""}>
            <HotelCard
              hotel={item}
              onPress={() =>
                router.push({
                  pathname: "/hotel/[id]",
                  params: {
                    id: item.id, from: "list", city, location, checkIn: checkInDate, checkOut: checkOutDate,
                    rooms: String(rooms), adults: String(adults), children: String(children), priceStar,
                    tags, scenicSpots: selectedSpots.join(","), sort: sort || "", nights: String(nights),
                  },
                })
              }
            />
          </View>
        )}
        onEndReached={() => {
          if (loadingMore || loading || !hasMore) return;
          load(page + 1, true);
        }}
        onEndReachedThreshold={0.45}
        ListEmptyComponent={
          loading ? null : <View className="items-center py-8"><Text className="text-xs text-neutral-400">暂无酒店数据</Text></View>
        }
        ListFooterComponent={<View className="items-center py-6"><Text className="text-xs text-neutral-400">{loadingMore ? "加载更多中..." : hasMore ? "上滑加载更多" : "没有更多酒店了"}</Text></View>}
      />


      {/* ============ 核心弹窗逻辑区 ============ */}
      <SearchSummarySheet
        visible={isSummarySheetOpen}
        city={city}
        location={location} // 👉 必须传入 location，保证假头部有搜索关键字
        checkInDate={checkInDate}
        checkOutDate={checkOutDate}
        nights={nights}
        rooms={rooms}
        adults={adults}
        childCount={children}
        onClose={() => setIsSummarySheetOpen(false)}
        onConfirm={() => setIsSummarySheetOpen(false)}

        // 1. 点击地点：因地址选择是一个全新复杂页面，必须跳转新页 (大厂也这么做以保证性能)
        onCityPress={() => {
          setIsSummarySheetOpen(false);
          router.replace({ pathname: "/location", params: { city, from: "list" } });
        }}

        onDatePress={() => setIsCalendarOpen(true)}
        onGuestPress={() => setIsGuestOpen(true)}
      />

      <DateRangePickerSheet
        visible={isCalendarOpen}
        checkInDate={checkInDate}
        checkOutDate={checkOutDate}
        onClose={() => setIsCalendarOpen(false)} 
        onConfirm={({ checkInDate: nextIn, checkOutDate: nextOut }) => {
          setCheckInDate(nextIn);
          setCheckOutDate(nextOut);
          setIsCalendarOpen(false); 
        }}
      />

      <GuestPickerSheet
        visible={isGuestOpen}
        initial={{ rooms, adults, children } satisfies GuestDraft}
        onClose={() => setIsGuestOpen(false)} 
        onConfirm={(next) => {
          setRooms(next.rooms);
          setAdults(Math.max(next.adults, next.rooms));
          setChildren(next.children);
          setIsGuestOpen(false); 
        }}
      />

      {/* 原有的日历、人数弹窗保持不变，修改 onClose/onConfirm 逻辑 */}
      <DateRangePickerSheet
        visible={isCalendarOpen}
        checkInDate={checkInDate}
        checkOutDate={checkOutDate}
        onClose={() => setIsCalendarOpen(false)}
        onConfirm={({ checkInDate: nextIn, checkOutDate: nextOut }) => {
          setCheckInDate(nextIn);
          setCheckOutDate(nextOut);
          setIsCalendarOpen(false);
        }}
      />

      <GuestPickerSheet
        visible={isGuestOpen}
        initial={{ rooms, adults, children } satisfies GuestDraft}
        onClose={() => setIsGuestOpen(false)}
        onConfirm={(next) => {
          setRooms(next.rooms);
          setAdults(Math.max(next.adults, next.rooms));
          setChildren(next.children);
          setIsGuestOpen(false);
        }}
      />

      <FilterBottomSheet visible={isSortOpen} title="排序" onClose={() => setIsSortOpen(false)}>
        <View className="mt-1 gap-2">
          {SORT_OPTIONS.map((item) => {
            const active = sort === item.value;
            return (
              <Pressable
                key={item.label}
                onPress={() => {
                  setSort(item.value);
                  setIsSortOpen(false);
                }}
                className={`rounded-xl border px-3 py-3 ${active ? "border-[#1890FF] bg-[#E6F4FF]" : "border-slate-200 bg-white"}`}
              >
                <Text className={`text-sm ${active ? "font-semibold text-[#1890FF]" : "text-slate-700"}`}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </FilterBottomSheet>

      <FilterBottomSheet visible={isScenicOpen} title="附近景点" onClose={() => setIsScenicOpen(false)}>
        <View className="mt-1 flex-row flex-wrap gap-2">
          {SCENIC_SPOT_OPTIONS.map((item) => {
            const active = selectedSpots.includes(item);
            return (
              <Pressable
                key={item}
                onPress={() =>
                  setSelectedSpots((prev) => (active ? prev.filter((x) => x !== item) : [...prev, item]))
                }
                className={`rounded-full px-3 py-2 ${active ? "bg-[#E6F4FF]" : "border border-slate-200 bg-white"}`}
              >
                <Text className={`text-xs ${active ? "text-[#1890FF]" : "text-slate-600"}`}>{item}</Text>
              </Pressable>
            );
          })}
        </View>
        <View className="mt-4 flex-row items-center gap-3">
          <Pressable onPress={() => setSelectedSpots([])} className="flex-1 rounded-xl border border-slate-200 py-3">
            <Text className="text-center text-sm font-semibold text-slate-600">清空</Text>
          </Pressable>
          <Pressable onPress={() => setIsScenicOpen(false)} className="flex-1 rounded-xl bg-[#1890FF] py-3">
            <Text className="text-center text-sm font-semibold text-white">完成</Text>
          </Pressable>
        </View>
      </FilterBottomSheet>

      <PriceStarPickerSheet
        visible={isPriceOpen}
        initial={priceDraft}
        onClose={() => setIsPriceOpen(false)}
        onConfirm={(next) => {
          setPriceDraft(next);
          const starPart = next.stars.join("、");
          const pricePart = next.min === 0 && next.max === 800 ? "" : next.max === 800 ? `¥${next.min}-¥800+` : `¥${next.min}-¥${next.max}`;
          const merged = [pricePart, starPart].filter(Boolean).join(", ");
          setPriceStar(merged || "不限星级");
          setIsPriceOpen(false);
        }}
      />

      <FilterBottomSheet visible={isTagOpen} title="标签" onClose={() => setIsTagOpen(false)}>
        <View className="mt-1 flex-row flex-wrap gap-2">
          {TAG_OPTIONS.map((item) => {
            const active = tagList.includes(item);
            return (
              <Pressable
                key={item}
                onPress={() => {
                  const next = active ? tagList.filter((x) => x !== item) : [...tagList, item];
                  setTags(next.join(","));
                }}
                className={`rounded-full px-3 py-2 ${active ? "bg-[#E6F4FF]" : "border border-slate-200 bg-white"}`}
              >
                <Text className={`text-xs ${active ? "text-[#1890FF]" : "text-slate-600"}`}>{item}</Text>
              </Pressable>
            );
          })}
        </View>
        <View className="mt-4 flex-row items-center gap-3">
          <Pressable onPress={() => setTags("")} className="flex-1 rounded-xl border border-slate-200 py-3">
            <Text className="text-center text-sm font-semibold text-slate-600">清空</Text>
          </Pressable>
          <Pressable onPress={() => setIsTagOpen(false)} className="flex-1 rounded-xl bg-[#1890FF] py-3">
            <Text className="text-center text-sm font-semibold text-white">完成</Text>
          </Pressable>
        </View>
      </FilterBottomSheet>
    </>
  );
}