/**
 * 酒店详情页（大厂精调版 V4 - 精致双行带图标排版）
 */
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import DateRangePickerSheet from "@/components/hotel/DateRangePickerSheet";
import GuestPickerSheet, {
  GuestDraft,
} from "@/components/hotel/GuestPickerSheet";
import RoomList from "@/components/hotel/RoomList";
import MeasuredPagingCarousel from "@/components/ui/measured-paging-carousel";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { fetchMobileHotelById } from "@/lib/api";
import {
  getDefaultSearchSession,
  setSearchSession,
} from "@/lib/search-session";
import type { Hotel, Room } from "@yisu/shared";

// 格式化日期：02月23日
function toShortDate(s: string) {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${m}月${day}日`;
}

function getDateMetaLabel(s: string) {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  const diff = Math.round(
    (d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diff === 0) return "今天";
  if (diff === 1) return "明天";
  if (diff === 2) return "后天";
  const week = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  return week[d.getDay()];
}

function getDisplayAddress(hotel?: Hotel | null) {
  const city = String(hotel?.city || "").trim();
  let address = String(hotel?.address || "").trim();
  if (city && address.startsWith(city)) address = address.slice(city.length);
  address = address.replace(/^(上海市|北京市|天津市|重庆市)/, "");
  if (address) return [city, address].filter(Boolean).join(" · ");
  const full = String(hotel?.fullAddress || "").trim();
  if (!full) return "";
  return full
    .replace(/^上海市上海市/, "上海市")
    .replace(/^北京市北京市/, "北京市")
    .replace(/^天津市天津市/, "天津市")
    .replace(/^重庆市重庆市/, "重庆市");
}

export default function HotelDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const defaultSession = getDefaultSearchSession();

  const {
    id,
    checkIn,
    checkOut,
    from,
    city,
    location,
    priceStar,
    tags,
    scenicSpots,
    sort,
    rooms,
    adults,
    children,
  } = useLocalSearchParams<{
    id: string;
    checkIn?: string;
    checkOut?: string;
    from?: "list" | "home";
    city?: string;
    location?: string;
    priceStar?: string;
    tags?: string;
    scenicSpots?: string;
    sort?: "price_asc" | "price_desc" | "star_desc";
    rooms?: string;
    adults?: string;
    children?: string;
  }>();

  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isGuestOpen, setIsGuestOpen] = useState(false);
  const [checkInDate, setCheckInDate] = useState(
    checkIn || defaultSession.checkIn,
  );
  const [checkOutDate, setCheckOutDate] = useState(
    checkOut || defaultSession.checkOut,
  );
  const [roomCount, setRoomCount] = useState(
    Math.max(1, Number(rooms || defaultSession.rooms || 1)),
  );
  const [adultCount, setAdultCount] = useState(
    Math.max(
      Math.max(1, Number(adults || defaultSession.adults || 1)),
      Math.max(1, Number(rooms || defaultSession.rooms || 1)),
    ),
  );
  const [childCount, setChildCount] = useState(
    Math.max(0, Number(children || defaultSession.children || 0)),
  );

  const nights = useMemo(() => {
    const diff = Math.ceil(
      (new Date(checkOutDate).getTime() - new Date(checkInDate).getTime()) /
        (1000 * 60 * 60 * 24),
    );
    return Math.max(1, diff);
  }, [checkInDate, checkOutDate]);

  const images = useMemo(() => {
    if (!hotel)
      return ["https://picsum.photos/seed/hotel_detail_fallback/1400/700"];
    return hotel.images?.length
      ? hotel.images
      : [
          hotel.coverImage ||
            "https://picsum.photos/seed/hotel_detail_fallback/1400/700",
        ];
  }, [hotel]);
  const star = Math.max(
    1,
    Math.min(5, Number(hotel?.starLevel || hotel?.rating || 0)),
  );
  const starText = "★".repeat(star);

  useEffect(() => {
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

  const handleBack = () => {
    try {
      router.back();
      return;
    } catch {}
    if (from === "list") {
      router.replace({
        pathname: "/list",
        params: {
          city: city ?? "",
          location: location ?? "",
          checkIn: checkInDate,
          checkOut: checkOutDate,
          priceStar: priceStar ?? "",
          tags: tags ?? "",
          rooms: String(roomCount),
          adults: String(adultCount),
          children: String(childCount),
          scenicSpots: scenicSpots ?? "",
          sort: sort ?? "",
        },
      });
      return;
    }
    router.replace("/");
  };

  const handleBook = (room: Room) => {
    if (!hotel) return;
    router.push({
      pathname: "/booking",
      params: {
        hotelId: hotel.id,
        roomId: room.id,
        checkIn: checkInDate,
        checkOut: checkOutDate,
        rooms: String(roomCount),
        adults: String(adultCount),
        children: String(childCount),
        from: from || "",
      },
    });
  };

  useEffect(() => {
    setSearchSession({
      city: city || "",
      location: location || "",
      checkIn: checkInDate,
      checkOut: checkOutDate,
      rooms: roomCount,
      adults: Math.max(adultCount, roomCount),
      children: childCount,
      priceStar: priceStar || "不限星级",
      tags: tags || "",
      scenicSpots: scenicSpots || "",
      sort: sort || "",
    });
  }, [
    city,
    location,
    checkInDate,
    checkOutDate,
    roomCount,
    adultCount,
    childCount,
    priceStar,
    tags,
    scenicSpots,
    sort,
  ]);

  if (loading)
    return (
      <View className="flex-1 items-center justify-center bg-[#F5F8FC]">
        <Text className="text-base text-neutral-500">加载中...</Text>
      </View>
    );
  if (!hotel)
    return (
      <View className="flex-1 items-center justify-center bg-[#F5F8FC]">
        <Text className="text-base text-neutral-500">
          {error ? `加载失败：${error}` : "酒店不存在"}
        </Text>
      </View>
    );

  return (
    <View className="flex-1 bg-[#F5F8FC]">
      {/* 沉浸式透明导航栏 */}
      <View
        className="absolute left-0 right-0 z-20 px-2 pb-2"
        style={{ paddingTop: insets.top + 8 }}
      >
        <Pressable 
          onPress={handleBack} 
          className="h-9 w-9 items-center justify-center rounded-full bg-black/40 backdrop-blur-md"
        >
          <Text className="text-2xl font-light text-white leading-none mt-[-2px]">‹</Text>
        </Pressable>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 96 }}
        showsVerticalScrollIndicator={false}
      >
        {/* 顶部无缝大图轮播 */}
        <MeasuredPagingCarousel
          data={images}
          autoPlayMs={5000}
          slideHeight={280}
          containerClassName="bg-slate-200"
          keyExtractor={(image, idx) => `${idx}-${image}`}
          renderSlide={(image, _idx, width) => (
            <Image
              source={{ uri: image }}
              style={{ width, height: 280 }}
              contentFit="cover"
            />
          )}
        />

        {/* 核心信息白板 */}
        <View className="relative -mt-6 rounded-t-[24px] bg-white px-4 pt-6 pb-5 shadow-sm shadow-slate-200">
          
          <View className="flex-row items-start justify-between">
            <View className="flex-1 pr-4">
              <Text className="text-[22px] font-extrabold text-slate-900 leading-tight">
                {hotel.name}
              </Text>
              {hotel.nameEn ? (
                <Text className="mt-1 text-[11px] font-medium text-slate-400 uppercase tracking-widest">
                  {hotel.nameEn}
                </Text>
              ) : null}
            </View>
            <View className="mt-1 flex-row">
               <Text className="text-[12px] tracking-[2px] text-amber-500">{starText}</Text>
            </View>
          </View>

          <View className="mt-3 flex-row items-center">
            <IconSymbol size={14} name="location.fill" color="#94A3B8" />
            <Text className="ml-1 text-[13px] font-medium text-slate-600" numberOfLines={1}>
              {getDisplayAddress(hotel)}
            </Text>
          </View>

          <View className="mt-4 flex-row flex-wrap gap-2">
            {(hotel.tags || []).map((tag) => (
              <View key={tag} className="rounded-md bg-slate-50 border border-slate-100 px-2 py-0.5">
                <Text className="text-[11px] font-medium text-slate-600">{tag}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* 订房选择区 */}
        <View className="px-3 pt-3 pb-6">
          
          <View className="flex-row items-center rounded-2xl bg-white px-2 py-1 shadow-sm shadow-slate-100">
            
            {/* 左侧：日期区域 */}
            <Pressable
              className="flex-[6.5] flex-row items-center justify-between px-2 py-3 rounded-xl active:bg-slate-50"
              onPress={() => setIsCalendarOpen(true)}
            >
              <View className="flex-row items-center flex-1 justify-between">
                {/* 入住 */}
                <View className="items-start">
                  <Text className="text-[11px] text-slate-500 font-medium mb-1">{getDateMetaLabel(checkInDate)}入住</Text>
                  <Text className="text-[16px] font-black text-slate-900">{toShortDate(checkInDate)}</Text>
                </View>
                
                {/* 中间：横线与晚数 */}
                <View className="items-center px-1">
                   <Text className="text-[10px] font-bold text-[#1890FF] bg-[#E6F4FF] px-2 py-0.5 rounded-full">
                     {nights}晚
                   </Text>
                </View>

                {/* 离店 */}
                <View className="items-start">
                  <Text className="text-[11px] text-slate-500 font-medium mb-1">{getDateMetaLabel(checkOutDate)}离店</Text>
                  <Text className="text-[16px] font-black text-slate-900">{toShortDate(checkOutDate)}</Text>
                </View>
              </View>
            </Pressable>

            {/* 分割线 */}
            <View className="mx-1 h-10 w-[1px] bg-slate-100" />

            {/* 👉 核心修改：为右侧客房人数区添加优雅的双行微型徽标 */}
            <Pressable 
              className="flex-[3.5] flex-row items-center justify-between py-2 pl-3 pr-2 rounded-xl active:bg-slate-50"
              onPress={() => setIsGuestOpen(true)}
            >
              <View className="items-start">
                
                {/* 第一行：房间图标 + 数量 */}
                <View className="flex-row items-center mb-1">
                  <IconSymbol size={13} name="bed.double.fill" color="#1890FF" />
                  <Text className="ml-1.5 text-[15px] font-extrabold text-slate-900 mt-[-1px]">
                    {roomCount} 间
                  </Text>
                </View>
                
                {/* 第二行：人物图标 + 数量 */}
                <View className="flex-row items-center">
                  <IconSymbol size={12} name="person.fill" color="#94A3B8" />
                  <Text className="ml-1.5 text-[11px] font-medium text-slate-500 mt-[-1px]">
                    {adultCount}大 {childCount}小
                  </Text>
                </View>

              </View>
              <Text className="text-[16px] text-slate-300 font-light mb-1">›</Text>
            </Pressable>
          </View>

          {/* 房间列表组件 */}
          <View className="mt-3">
            <RoomList
              rooms={[...(hotel.rooms || [])].sort((a, b) => a.price - b.price)}
              onBook={handleBook}
            />
          </View>
        </View>

        <DateRangePickerSheet
          visible={isCalendarOpen}
          checkInDate={checkInDate}
          checkOutDate={checkOutDate}
          onClose={() => setIsCalendarOpen(false)}
          onConfirm={({
            checkInDate: nextCheckIn,
            checkOutDate: nextCheckOut,
          }) => {
            setCheckInDate(nextCheckIn);
            setCheckOutDate(nextCheckOut);
            setIsCalendarOpen(false);
          }}
        />
        <GuestPickerSheet
          visible={isGuestOpen}
          initial={
            {
              rooms: roomCount,
              adults: adultCount,
              children: childCount,
            } satisfies GuestDraft
          }
          onClose={() => setIsGuestOpen(false)}
          onConfirm={(next) => {
            setRoomCount(next.rooms);
            setAdultCount(Math.max(next.adults, next.rooms));
            setChildCount(next.children);
            setIsGuestOpen(false);
          }}
        />
      </ScrollView>
    </View>
  );
}