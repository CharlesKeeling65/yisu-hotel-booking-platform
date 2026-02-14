import { Image } from "expo-image";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Calendar, DateData } from "react-native-calendars";
import { Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { IconSymbol } from "@/components/ui/icon-symbol";

const QUICK_TAGS = ["外滩", "近地铁", "亲子房", "江景房", "商务区"];
const PRICE_STAR_OPTIONS = ["不限星级", "3星", "4星", "5星"];

type CounterRowProps = {
  label: string;
  value: number;
  onAdd: () => void;
  onSub: () => void;
};

function CounterRow({ label, value, onAdd, onSub }: CounterRowProps) {
  return (
    <View className="items-center">
      <Text className="text-[11px] text-slate-500">{label}</Text>
      <View className="mt-1 flex-row items-center gap-2">
        <Pressable
          onPress={onSub}
          className="h-7 w-7 items-center justify-center rounded-full bg-slate-200">
          <Text className="text-sm font-semibold text-slate-700">-</Text>
        </Pressable>
        <Text className="w-4 text-center text-sm font-semibold text-slate-900">{value}</Text>
        <Pressable
          onPress={onAdd}
          className="h-7 w-7 items-center justify-center rounded-full bg-[#E6F4FF]">
          <Text className="text-sm font-semibold text-[#1890FF]">+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const formatMonthDay = (value: string) => value.slice(5).replace("-", "/");

const diffNights = (start: string, end: string) => {
  const startTime = new Date(start).getTime();
  const endTime = new Date(end).getTime();
  if (Number.isNaN(startTime) || Number.isNaN(endTime)) return 1;
  const diff = Math.ceil((endTime - startTime) / (1000 * 60 * 60 * 24));
  return Math.max(1, diff);
};

const buildMarkedDates = (start: string, end: string) => {
  if (!start || !end) return {};
  const marked: Record<string, { color: string; textColor: string; startingDay?: boolean; endingDay?: boolean }> = {};
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return {};

  const cursor = new Date(startDate);
  while (cursor <= endDate) {
    const key = cursor.toISOString().slice(0, 10);
    marked[key] = {
      color: "#E6F4FF",
      textColor: "#1890FF",
    };
    cursor.setDate(cursor.getDate() + 1);
  }

  marked[start] = { color: "#1890FF", textColor: "#fff", startingDay: true };
  marked[end] = { color: "#1890FF", textColor: "#fff", endingDay: true };
  return marked;
};

const toDateString = (value: Date) => value.toISOString().slice(0, 10);

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [city, setCity] = useState("扬州");
  const { location: locationParam, city: cityParam } = useLocalSearchParams<{
    location?: string;
    city?: string;
  }>();
  const [location, setLocation] = useState("");
  const [checkInDate, setCheckInDate] = useState("2026-02-05");
  const [checkOutDate, setCheckOutDate] = useState("2026-02-06");
  const [rooms, setRooms] = useState(1);
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [priceStar, setPriceStar] = useState("4星");
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isStarOpen, setIsStarOpen] = useState(false);
  const [selectStage, setSelectStage] = useState<"checkIn" | "checkOut">("checkIn");
  const [showPrompt, setShowPrompt] = useState(false);
  const [locating, setLocating] = useState(false);

  const nights = diffNights(checkInDate, checkOutDate);
  const markedDates = useMemo(
    () => buildMarkedDates(checkInDate, checkOutDate),
    [checkInDate, checkOutDate]
  );

  useEffect(() => {
    if (typeof locationParam === "string") {
      setLocation(locationParam);
    }
  }, [locationParam]);

  useEffect(() => {
    if (typeof cityParam === "string") {
      setCity(cityParam);
    }
  }, [cityParam]);

  const openCalendar = () => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    setCheckInDate(toDateString(today));
    setCheckOutDate(toDateString(tomorrow));
    setSelectStage("checkIn");
    setIsCalendarOpen(true);
  };

  const flashPrompt = () => {
    setShowPrompt(true);
    setTimeout(() => setShowPrompt(false), 2000);
  };

  const handleLocate = async () => {
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
      const cityName = info[0]?.city ?? "扬州";
      const address = [info[0]?.district, info[0]?.street, info[0]?.name]
        .filter(Boolean)
        .join("");
      setCity(cityName);
      setLocation(address || "当前位置");
    } finally {
      setLocating(false);
    }
  };

  return (
    <ScrollView
      className="flex-1 bg-white"
      contentContainerClassName="px-4 pb-24"
      style={{ paddingTop: insets.top + 12 }}>
      <View className="overflow-hidden rounded-3xl bg-[#C8F1FF]">
        <View className="px-5 py-6">
          <Text className="text-lg font-semibold text-slate-900">热门目的地酒店优惠出炉</Text>
          <Text className="mt-1 text-sm text-slate-700">限时特卖 · 最佳酒店</Text>
        </View>
        <Image
          source={{
            uri: "https://images.unsplash.com/photo-1505761671935-60b3a7427bad?auto=format&fit=crop&w=1400&q=80",
          }}
          className="h-28 w-full"
          contentFit="cover"
        />
      </View>

      <View className="-mt-10 rounded-3xl border border-slate-100 bg-white p-4 shadow-lg">
        <View className="flex-row items-center gap-2">
          <Text className="rounded-full bg-[#E6F4FF] px-3 py-1 text-xs font-semibold text-[#1890FF]">
            国内
          </Text>
          <Text className="text-xs text-slate-400">|</Text>
          <Text className="text-xs text-slate-500">海外</Text>
        </View>

        <View className="mt-4 flex-row items-center rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3">
          <Pressable
            className="flex-row items-center"
            onPress={() => {
              router.push({ pathname: "/location", params: { city } });
            }}>
            <Text className="text-sm font-semibold text-slate-900">{city}</Text>
            <Text className="ml-1 text-xs text-slate-400">▼</Text>
          </Pressable>
          <Text className="mx-3 text-xs text-slate-300">|</Text>
          <Pressable
            className="flex-1"
            onPress={() => {
              router.push({ pathname: "/location", params: { city } });
            }}>
            <TextInput
              value={location}
              editable={false}
              pointerEvents="none"
              className="text-sm text-slate-900"
              placeholder="位置/商圈/酒店"
              placeholderTextColor="#C0C4CC"
            />
          </Pressable>
          <Pressable
            onPress={handleLocate}
            className="ml-2 h-8 w-8 items-center justify-center rounded-full bg-[#E6F4FF]">
            <IconSymbol size={16} name="location.fill" color="#1890FF" />
          </Pressable>
        </View>

        <Pressable
          className="mt-3 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3"
          onPress={openCalendar}>
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-[11px] uppercase text-slate-400">日期</Text>
              <Text className="mt-1 text-sm font-semibold text-slate-900">
                {formatMonthDay(checkInDate)} - {formatMonthDay(checkOutDate)}
              </Text>
            </View>
            <Text className="text-sm font-semibold text-[#1890FF]">共{nights}晚</Text>
          </View>
        </Pressable>

        <View className="mt-3 flex-row items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3">
          <View className="flex-row items-center gap-4">
            <CounterRow
              label="房间"
              value={rooms}
              onAdd={() => setRooms((value) => value + 1)}
              onSub={() => setRooms((value) => Math.max(1, value - 1))}
            />
            <CounterRow
              label="成人"
              value={adults}
              onAdd={() => setAdults((value) => value + 1)}
              onSub={() => setAdults((value) => Math.max(1, value - 1))}
            />
            <CounterRow
              label="儿童"
              value={children}
              onAdd={() => setChildren((value) => value + 1)}
              onSub={() => setChildren((value) => Math.max(0, value - 1))}
            />
          </View>
          <Pressable
            onPress={() => setIsStarOpen(true)}
            className="ml-3 flex-row items-center rounded-full bg-[#FFF7E6] px-3 py-2">
            <Text className="text-xs font-semibold text-[#FFA940]">{priceStar}</Text>
            <Text className="ml-1 text-xs text-[#FFA940]">▼</Text>
          </Pressable>
        </View>

        <View className="mt-4 flex-row flex-wrap gap-2">
          {QUICK_TAGS.map((tag) => (
            <Pressable
              key={tag}
              onPress={() => {
                setLocation(tag);
                router.push({
                  pathname: "/list",
                  params: {
                    city,
                    location: tag,
                    checkIn: checkInDate,
                    checkOut: checkOutDate,
                    rooms: String(rooms),
                    adults: String(adults),
                    children: String(children),
                    priceStar,
                  },
                });
              }}
              className="rounded-full bg-[#F5F7FB] px-3 py-2">
              <Text className="text-xs text-slate-600">{tag}</Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          className="mt-5 rounded-2xl bg-[#1890FF] py-4"
          onPress={() =>
            router.push({
              pathname: "/list",
              params: {
                city,
                location,
                checkIn: checkInDate,
                checkOut: checkOutDate,
                rooms: String(rooms),
                adults: String(adults),
                children: String(children),
                priceStar,
              },
            })
          }>
          <Text className="text-center text-sm font-semibold text-white">查询</Text>
        </Pressable>
      </View>

      <View className="mt-6 rounded-2xl border border-slate-100 bg-white p-4">
        <View className="flex-row items-center justify-between">
          <Text className="text-base font-semibold text-slate-900">口碑榜</Text>
          <Text className="text-xs text-[#1890FF]">城市精选</Text>
        </View>
        <View className="mt-4 rounded-2xl overflow-hidden">
          <Image
            source={{
              uri: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1400&q=80",
            }}
            className="h-32 w-full"
            contentFit="cover"
          />
          <View className="absolute bottom-3 left-3 rounded-full bg-black/50 px-3 py-1">
            <Text className="text-xs font-semibold text-white">这个夏天一起去看海</Text>
          </View>
        </View>
      </View>

      <Modal transparent visible={isCalendarOpen} animationType="fade">
        <View className="flex-1 items-center justify-center bg-black/40 px-4">
          <View className="w-full rounded-3xl bg-white p-4">
            <View className="flex-row items-center justify-between pb-2">
              <Text className="text-base font-semibold text-slate-900">选择日期</Text>
              <Pressable onPress={() => setIsCalendarOpen(false)}>
                <Text className="text-sm text-slate-400">关闭</Text>
              </Pressable>
            </View>
            <Calendar
              markingType="period"
              markedDates={markedDates}
              onDayPress={(day: DateData) => {
                if (selectStage === "checkIn") {
                  setCheckInDate(day.dateString);
                  setCheckOutDate(day.dateString);
                  setSelectStage("checkOut");
                  flashPrompt();
                  return;
                }

                if (day.dateString > checkInDate) {
                  setCheckOutDate(day.dateString);
                  setSelectStage("checkIn");
                  return;
                }

                setCheckInDate(day.dateString);
                setCheckOutDate(day.dateString);
                setSelectStage("checkOut");
                flashPrompt();
              }}
              theme={{
                todayTextColor: "#1890FF",
                arrowColor: "#1890FF",
                textDayFontWeight: "500",
                textMonthFontWeight: "600",
              }}
            />
            <Pressable
              className="mt-3 rounded-2xl bg-[#1890FF] py-3"
              onPress={() => setIsCalendarOpen(false)}>
              <Text className="text-center text-sm font-semibold text-white">
                确认 · 共{nights}晚
              </Text>
            </Pressable>
          </View>
        </View>
        {showPrompt ? (
          <View className="absolute bottom-20 left-0 right-0 items-center">
            <View className="rounded-full bg-black/70 px-4 py-2">
              <Text className="text-xs text-white">请选择离店日期</Text>
            </View>
          </View>
        ) : null}
      </Modal>

      <Modal transparent visible={isStarOpen} animationType="fade">
        <View className="flex-1 items-center justify-center bg-black/40 px-6">
          <View className="w-full rounded-3xl bg-white p-4">
            <View className="flex-row items-center justify-between pb-2">
              <Text className="text-base font-semibold text-slate-900">选择星级</Text>
              <Pressable onPress={() => setIsStarOpen(false)}>
                <Text className="text-sm text-slate-400">关闭</Text>
              </Pressable>
            </View>
            {PRICE_STAR_OPTIONS.map((option) => (
              <Pressable
                key={option}
                onPress={() => {
                  setPriceStar(option);
                  setIsStarOpen(false);
                }}
                className="rounded-2xl border border-slate-100 px-3 py-3 mt-2">
                <Text className="text-sm text-slate-700">{option}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>

    </ScrollView>
  );
}
