/**
 * 列表页（搜索结果页）
 * 关键能力：
 * 1) 接收首页传入的查询参数并回填 UI
 * 2) 支持排序与分页加载（FlatList onEndReached）
 * 3) 顶部紧凑搜索条 + 日历弹层，支持二次筛选
 */
import { useEffect, useMemo, useState } from "react";
import { FlatList, Modal, Pressable, Text, View } from "react-native";
import { Calendar, DateData } from "react-native-calendars";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Location from "expo-location";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import HotelCard from "@/components/hotel/HotelCard";
import CompactSearchPanel from "@/components/hotel/CompactSearchPanel";
import HotelFilters from "@/components/hotel/HotelFilters";
import type { Hotel } from "@yisu/shared";
import { fetchMobileHotels } from "@/lib/api";

const buildMarkedDates = (start: string, end: string) => {
  // 与首页保持一致：生成“区间高亮”给 Calendar 组件
  if (!start || !end) return {};
  const marked: Record<string, { color: string; textColor: string; startingDay?: boolean; endingDay?: boolean }> = {};
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return {};
  const cursor = new Date(startDate);
  while (cursor <= endDate) {
    const key = cursor.toISOString().slice(0, 10);
    marked[key] = { color: "#E6F4FF", textColor: "#1890FF" };
    cursor.setDate(cursor.getDate() + 1);
  }
  marked[start] = { color: "#1890FF", textColor: "#fff", startingDay: true };
  marked[end] = { color: "#1890FF", textColor: "#fff", endingDay: true };
  return marked;
};

export default function ListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    city?: string;
    location?: string;
    keyword?: string;
    checkIn?: string;
    checkOut?: string;
    priceStar?: string;
    tags?: string;
  }>();

  const [city, setCity] = useState(params.city || "上海市");
  const [location, setLocation] = useState(params.location || params.keyword || "");
  const [checkInDate, setCheckInDate] = useState(params.checkIn || "2026-02-12");
  const [checkOutDate, setCheckOutDate] = useState(params.checkOut || "2026-02-13");
  const [priceStar] = useState(params.priceStar || "不限星级");
  const [tags] = useState(params.tags || "");

  const [list, setList] = useState<Hotel[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [sort, setSort] = useState<"price_asc" | "price_desc" | "star_desc" | undefined>(undefined);
  const [locating, setLocating] = useState(false);

  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [stage, setStage] = useState<"checkIn" | "checkOut">("checkIn");

  const nights = useMemo(() => {
    const diff = Math.ceil((new Date(checkOutDate).getTime() - new Date(checkInDate).getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(1, diff);
  }, [checkInDate, checkOutDate]);
  const markedDates = useMemo(() => buildMarkedDates(checkInDate, checkOutDate), [checkInDate, checkOutDate]);
  const tagList = useMemo(() => (tags ? tags.split(",").map((x) => x.trim()).filter(Boolean) : []), [tags]);

  useEffect(() => {
    if (typeof params.city === "string") setCity(params.city);
    if (typeof params.location === "string") setLocation(params.location);
    if (!params.location && typeof params.keyword === "string") setLocation(params.keyword);
  }, [params.city, params.location, params.keyword]);

  async function handleLocate() {
    // 在列表页直接定位并重载结果，减少返回首页的操作成本
    if (locating) return;
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const pos = await Location.getCurrentPositionAsync({});
      const info = await Location.reverseGeocodeAsync({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
      const cityName = info[0]?.city ?? city;
      const address = [info[0]?.district, info[0]?.street, info[0]?.name].filter(Boolean).join("");
      setCity(cityName);
      setLocation(address || "当前位置");
    } finally {
      setLocating(false);
    }
  }

  async function load(targetPage: number, append: boolean) {
    // 统一数据加载入口：既支持首次加载，也支持分页追加
    if (append) setLoadingMore(true); else setLoading(true);
    setError("");
    try {
      const data = await fetchMobileHotels<Hotel>({
        page: targetPage,
        pageSize: 8,
        city,
        keyword: location,
        priceStar,
        tags: tagList,
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
    // 任何检索条件变化都重跑首屏查询
    load(1, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city, location, checkInDate, checkOutDate, priceStar, tags, sort]);

  return (
    <>
      <FlatList
        className="flex-1 bg-neutral-50"
        contentContainerClassName="px-4 pb-24"
        contentContainerStyle={{ paddingTop: insets.top + 8 }}
        data={list}
        keyExtractor={(item) => item.id}
        stickyHeaderIndices={[0]}
        ListHeaderComponent={
          <View className="pb-3 bg-[#F5F8FC]">
            <View className="mb-2 flex-row items-center justify-between rounded-2xl bg-white px-3 py-3">
              <Pressable onPress={() => router.back()}>
                <Text className="text-sm font-semibold text-[#1890FF]">返回</Text>
              </Pressable>
              <Text className="text-base font-semibold text-slate-900">酒店查询</Text>
              <View style={{ width: 40 }} />
            </View>
            <CompactSearchPanel
              city={city}
              location={location}
              checkInDate={checkInDate}
              checkOutDate={checkOutDate}
              nights={nights}
              onCityPress={() => router.push({ pathname: "/location", params: { city } })}
              onLocationPress={() =>
                router.push({
                  pathname: "/location",
                  params: { city, location, from: "list", checkIn: checkInDate, checkOut: checkOutDate, priceStar, tags },
                })}
              onLocatePress={() => handleLocate()}
              onDatePress={() => { setStage("checkIn"); setIsCalendarOpen(true); }}
              onSearch={() => load(1, false)}
            />
            <Text className="mt-4 text-2xl font-semibold text-neutral-900">酒店列表</Text>
            {loading ? <Text className="mt-2 text-xs text-neutral-400">加载中...</Text> : null}
            {error ? <Text className="mt-2 text-xs text-red-400">加载失败：{error}</Text> : null}
            <View className="mt-3"><HotelFilters onChange={setSort} /></View>
          </View>
        }
        renderItem={({ item }) => (
          <HotelCard
            hotel={item}
            onPress={() => router.push({ pathname: "/hotel/[id]", params: { id: item.id, checkIn: checkInDate, checkOut: checkOutDate, nights: String(nights) } })}
          />
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

      <Modal transparent visible={isCalendarOpen} animationType="fade">
        <View className="flex-1 items-center justify-center bg-black/40 px-4">
          <View className="w-full rounded-3xl bg-white p-4">
            <View className="flex-row items-center justify-between pb-2"><Text className="text-base font-semibold text-slate-900">选择入住和离店日期</Text><Pressable onPress={() => setIsCalendarOpen(false)}><Text className="text-sm text-slate-400">关闭</Text></Pressable></View>
            <Calendar
              markingType="period"
              markedDates={markedDates}
              onDayPress={(day: DateData) => {
                if (stage === "checkIn") {
                  setCheckInDate(day.dateString);
                  setCheckOutDate(day.dateString);
                  setStage("checkOut");
                  return;
                }
                if (day.dateString > checkInDate) {
                  setCheckOutDate(day.dateString);
                  setStage("checkIn");
                  setIsCalendarOpen(false);
                  return;
                }
                setCheckInDate(day.dateString);
                setCheckOutDate(day.dateString);
              }}
              theme={{ todayTextColor: "#1890FF", arrowColor: "#1890FF", textDayFontWeight: "500", textMonthFontWeight: "600" }}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}
