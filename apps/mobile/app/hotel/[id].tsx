/**
 * 酒店详情页
 * 核心流程：
 * 1) 根据路由 id 拉取单酒店详情
 * 2) 轮播展示酒店图片
 * 3) 展示设施与房型，并支持改入住日期
 */
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { Calendar, DateData } from "react-native-calendars";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import RoomList from "@/components/hotel/RoomList";
import type { Hotel } from "@yisu/shared";
import { fetchMobileHotelById } from "@/lib/api";

const buildMarkedDates = (start: string, end: string) => {
  // 构建日期区间高亮，供详情页日历弹层复用
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

function toCnMonthDay(s: string) {
  // 将 yyyy-mm-dd 转为 mm月dd日，提升可读性
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${m}月${day}日`;
}

export default function HotelDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const bannerWidth = Math.max(280, Math.round(width - 32));
  const carouselRef = useRef<ScrollView | null>(null);

  const { id, checkIn, checkOut } = useLocalSearchParams<{ id: string; checkIn?: string; checkOut?: string }>();

  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [bannerIndex, setBannerIndex] = useState(0);

  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [stage, setStage] = useState<"checkIn" | "checkOut">("checkIn");
  const [checkInDate, setCheckInDate] = useState(checkIn || "2026-02-12");
  const [checkOutDate, setCheckOutDate] = useState(checkOut || "2026-02-13");

  const nights = useMemo(() => {
    const diff = Math.ceil((new Date(checkOutDate).getTime() - new Date(checkInDate).getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(1, diff);
  }, [checkInDate, checkOutDate]);
  const markedDates = useMemo(() => buildMarkedDates(checkInDate, checkOutDate), [checkInDate, checkOutDate]);

  const images = useMemo(() => {
    if (!hotel) return ["https://picsum.photos/seed/hotel_detail_fallback/1400/700"];
    return hotel.images?.length ? hotel.images : [hotel.coverImage || "https://picsum.photos/seed/hotel_detail_fallback/1400/700"];
  }, [hotel]);

  useEffect(() => {
    // 首次进入与 id 变化时，重新请求酒店详情
    if (!id) return;
    let mounted = true;
    setLoading(true);
    setError("");
    fetchMobileHotelById<Hotel>(id)
      .then((data) => {
        if (!mounted) return;
        setHotel(data);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "加载失败");
        setHotel(null);
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [id]);

  useEffect(() => {
    // 自动轮播酒店图片
    if (!images.length) return;
    const timer = setInterval(() => {
      const next = (bannerIndex + 1) % images.length;
      carouselRef.current?.scrollTo({ x: next * bannerWidth, animated: true });
      setBannerIndex(next);
    }, 5000);
    return () => clearInterval(timer);
  }, [bannerIndex, images.length, bannerWidth]);

  if (loading) return <View className="flex-1 items-center justify-center bg-neutral-50"><Text className="text-base text-neutral-500">加载中...</Text></View>;
  if (!hotel) return <View className="flex-1 items-center justify-center bg-neutral-50"><Text className="text-base text-neutral-500">{error ? `加载失败：${error}` : "酒店不存在"}</Text></View>;

  return (
    <ScrollView className="flex-1 bg-neutral-50" contentContainerClassName="pb-24">
      <View className="flex-row items-center justify-between bg-white px-4 py-3" style={{ paddingTop: insets.top + 8 }}>
        <Pressable onPress={() => router.back()}><Text className="text-sm font-semibold text-[#1890FF]">返回</Text></Pressable>
        <Text className="max-w-[220px] text-center text-base font-semibold text-neutral-900" numberOfLines={1}>{hotel.name}</Text>
        <View style={{ width: 56 }} />
      </View>

      <View className="mt-3 overflow-hidden rounded-3xl mx-4 bg-slate-200">
        <ScrollView
          ref={carouselRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          bounces
          onMomentumScrollEnd={(e) => {
            const x = e.nativeEvent.contentOffset.x;
            const idx = Math.max(0, Math.min(images.length - 1, Math.round(x / bannerWidth)));
            setBannerIndex(idx);
          }}
        >
          {images.map((image, idx) => (
            <Image key={`${idx}-${image}`} source={{ uri: image }} style={{ width: bannerWidth, height: 210 }} contentFit="cover" />
          ))}
        </ScrollView>
        <View className="absolute bottom-3 left-0 right-0 flex-row items-center justify-center gap-1">
          {images.map((_, idx) => (
            <View key={idx} className={`h-1.5 w-4 rounded-full ${idx === bannerIndex ? "bg-white" : "bg-white/45"}`} />
          ))}
        </View>
      </View>

      <View className="px-4 pt-4">
        <View className="flex-row items-center justify-between">
          <View className="flex-1 pr-3">
            <Text className="text-2xl font-semibold text-neutral-900">{hotel.name}</Text>
            {hotel.nameEn ? <Text className="mt-1 text-sm text-neutral-500">{hotel.nameEn}</Text> : null}
          </View>
          <View className="rounded-full bg-amber-100 px-2 py-1"><Text className="text-xs font-semibold text-amber-700">{hotel.starLevel || hotel.rating}星</Text></View>
        </View>

        <Text className="mt-2 text-sm text-neutral-500">{hotel.fullAddress || `${hotel.city} · ${hotel.address}`}</Text>

        <View className="mt-4 flex-row flex-wrap gap-2">
          {(hotel.tags || []).map((tag) => (
            <View key={tag} className="rounded-full bg-neutral-100 px-3 py-1"><Text className="text-xs text-neutral-600">{tag}</Text></View>
          ))}
        </View>

        <Pressable className="mt-5 rounded-2xl border border-[#BFDFFF] bg-[#F8FCFF] px-3 py-3" onPress={() => { setStage("checkIn"); setIsCalendarOpen(true); }}>
          <View className="flex-row items-center justify-between">
            <Text className="text-xs font-semibold text-[#4D6B80]">入住日期与间夜</Text>
            <Text className="text-[11px] text-[#7FA2BA]">点击修改</Text>
          </View>
          <View className="mt-1.5 flex-row items-center">
            <Text className="text-base font-semibold text-[#183B56]">{toCnMonthDay(checkInDate)}</Text>
            <Text className="mx-2 text-xs font-medium text-[#8FA8BA]">-</Text>
            <Text className="text-base font-semibold text-[#183B56]">{toCnMonthDay(checkOutDate)}</Text>
            <Text className="ml-4 text-sm font-semibold text-[#245F8B]">共{nights}晚</Text>
          </View>
        </Pressable>

        <View className="mt-6">
          <Text className="text-base font-semibold text-neutral-900">酒店设施</Text>
          <View className="mt-3 flex-row flex-wrap gap-2">
            {(hotel.facilities || []).map((facility) => (
              <View key={facility} className="rounded-full bg-white px-3 py-2 shadow-sm"><Text className="text-xs text-neutral-600">{facility}</Text></View>
            ))}
          </View>
        </View>

        <View className="mt-6">
          <Text className="text-base font-semibold text-neutral-900">房型价格</Text>
          <View className="mt-4"><RoomList rooms={[...(hotel.rooms || [])].sort((a, b) => a.price - b.price)} /></View>
        </View>
      </View>

      <Modal transparent visible={isCalendarOpen} animationType="fade">
        <View className="flex-1 items-center justify-center bg-black/40 px-4">
          <View className="w-full rounded-3xl bg-white p-4">
            <View className="flex-row items-center justify-between pb-2"><Text className="text-base font-semibold text-slate-900">选择日期</Text><Pressable onPress={() => setIsCalendarOpen(false)}><Text className="text-sm text-slate-400">关闭</Text></Pressable></View>
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
                  setIsCalendarOpen(false);
                  setStage("checkIn");
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
    </ScrollView>
  );
}
