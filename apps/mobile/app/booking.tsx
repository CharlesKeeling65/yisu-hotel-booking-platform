import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
    Alert,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fetchMobileHotelById } from "@/lib/api";
import type { Hotel, Room } from "@yisu/shared";

function toCnDate(s: string) {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s || "";
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${m}月${day}日`;
}

function diffNights(checkIn?: string, checkOut?: string) {
  const start = new Date(checkIn || "").getTime();
  const end = new Date(checkOut || "").getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return 1;
  return Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
}

export default function BookingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { hotelId, roomId, checkIn, checkOut, rooms, adults, children } =
    useLocalSearchParams<{
      hotelId?: string;
      roomId?: string;
      checkIn?: string;
      checkOut?: string;
      rooms?: string;
      adults?: string;
      children?: string;
    }>();

  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");

  const roomCount = Math.max(1, Number(rooms || 1));
  const adultCount = Math.max(roomCount, Number(adults || 1));
  const childCount = Math.max(0, Number(children || 0));
  const nights = useMemo(
    () => diffNights(checkIn, checkOut),
    [checkIn, checkOut],
  );

  useEffect(() => {
    if (!hotelId) {
      setError("缺少酒店信息");
      setLoading(false);
      return;
    }
    let mounted = true;
    setLoading(true);
    fetchMobileHotelById<Hotel>(String(hotelId))
      .then((data) => {
        if (!mounted) return;
        setHotel(data);
        const target = data?.rooms?.find((r) => r.id === roomId);
        setRoom(target ?? null);
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
  }, [hotelId, roomId]);

  const roomTotal = (room?.price || 0) * nights * roomCount;
  const coupon = roomTotal >= 200 ? 26 : 0;
  const payable = Math.max(0, roomTotal - coupon);

  const handlePay = () => {
    if (!room || !hotel) {
      Alert.alert("无法支付", "房型信息缺失，请返回重试。");
      return;
    }
    if (!guestName.trim()) {
      Alert.alert("请输入姓名", "请填写预订人姓名");
      return;
    }
    if (!guestPhone.trim()) {
      Alert.alert("请输入手机号", "请填写预订人手机号");
      return;
    }
    // 简单手机号格式校验（中国手机号 11 位）
    const onlyDigits = guestPhone.replace(/\D/g, "");
    if (onlyDigits.length < 7) {
      Alert.alert("手机号格式错误", "请输入有效的手机号");
      return;
    }

    Alert.alert(
      "已提交预订",
      `模拟下单成功\n\n预订人：${guestName}\n联系方式：${guestPhone}`,
      [
        {
          text: "查看酒店",
          onPress: () => router.back(),
        },
        {
          text: "完成",
          style: "default",
        },
      ],
    );
  };

  const renderContent = () => {
    if (loading) {
      return (
        <View className="flex-1 items-center justify-center">
          <Text className="text-base text-neutral-500">加载中...</Text>
        </View>
      );
    }
    if (error || !hotel) {
      return (
        <View className="flex-1 items-center justify-center">
          <Text className="text-base text-neutral-500">
            {error || "加载失败"}
          </Text>
        </View>
      );
    }
    if (!room) {
      return (
        <View className="flex-1 items-center justify-center">
          <Text className="text-base text-neutral-500">房型不存在或已售罄</Text>
        </View>
      );
    }

    return (
      <ScrollView
        className="flex-1 bg-neutral-50"
        contentContainerStyle={{
          paddingTop: insets.top + 56,
          paddingBottom: insets.bottom + 140,
        }}
        showsVerticalScrollIndicator={true}
        persistentScrollbar={true}
      >
        <View className="px-4">
          <View className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
            <Text
              className="text-lg font-semibold text-neutral-900"
              numberOfLines={2}
            >
              {hotel.name}
            </Text>
            <Text className="mt-1 text-sm text-neutral-600" numberOfLines={1}>
              {hotel.city} · {hotel.address}
            </Text>
            <View className="mt-3 flex-row items-center justify-between">
              <View>
                <Text className="text-xs text-neutral-500">入住</Text>
                <Text className="mt-0.5 text-base font-semibold text-neutral-900">
                  {toCnDate(String(checkIn))}
                </Text>
              </View>
              <Text className="px-2 text-sm text-neutral-500">
                共 {nights} 晚
              </Text>
              <View className="items-end">
                <Text className="text-xs text-neutral-500">离店</Text>
                <Text className="mt-0.5 text-base font-semibold text-neutral-900">
                  {toCnDate(String(checkOut))}
                </Text>
              </View>
            </View>
          </View>

          <View className="mt-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
            <Text className="text-base font-semibold text-neutral-900">
              房型
            </Text>
            <View className="mt-2 flex-row items-start justify-between">
              <View className="flex-1 pr-3">
                <Text
                  className="text-sm font-semibold text-neutral-900"
                  numberOfLines={2}
                >
                  {room.name}
                </Text>
                <Text
                  className="mt-1 text-xs text-neutral-500"
                  numberOfLines={2}
                >
                  {room.bedType} · 可住 {room.capacity} 人 ·{" "}
                  {room.breakfastIncluded ? "含早餐" : "不含早餐"}
                </Text>
                <Text
                  className="mt-1 text-xs text-neutral-500"
                  numberOfLines={2}
                >
                  {room.refundable ? "可免费取消" : "不可取消"}
                </Text>
              </View>
              <Text className="shrink-0 text-lg font-semibold text-amber-600">
                ¥{room.price}
              </Text>
            </View>
          </View>

          <View className="mt-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
            <Text className="text-base font-semibold text-neutral-900">
              入住信息
            </Text>
            <View className="mt-3">
              <View className="flex-row items-center justify-between">
                <Text className="text-sm text-neutral-700">订房间数</Text>
                <Text className="text-sm font-semibold text-neutral-900">
                  {roomCount} 间
                </Text>
              </View>

              <View className="mt-3">
                <Text className="text-sm text-neutral-700">预订人姓名</Text>
                <TextInput
                  value={guestName}
                  onChangeText={setGuestName}
                  placeholder="请输入预订人姓名"
                  className="mt-2 rounded-md border border-neutral-200 bg-white px-3 py-2"
                />
              </View>

              <View className="mt-3">
                <Text className="text-sm text-neutral-700">联系方式</Text>
                <TextInput
                  value={guestPhone}
                  onChangeText={setGuestPhone}
                  placeholder="手机号"
                  keyboardType="phone-pad"
                  className="mt-2 rounded-md border border-neutral-200 bg-white px-3 py-2"
                />
              </View>

              <Text className="mt-3 text-sm text-neutral-700">
                下单后可在“我的-订单”查看进度。
              </Text>
            </View>
          </View>

          <View className="mt-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
            <Text className="text-base font-semibold text-neutral-900">
              价格明细
            </Text>
            <View className="mt-3 flex-row items-center justify-between">
              <Text className="text-sm text-neutral-700">
                房费 × {roomCount} 间 × {nights} 晚
              </Text>
              <Text className="text-sm font-semibold text-neutral-900">
                ¥{roomTotal.toFixed(2)}
              </Text>
            </View>
            <View className="mt-2 flex-row items-center justify-between">
              <Text className="text-sm text-neutral-700">限时优惠</Text>
              <Text className="text-sm font-semibold text-amber-600">
                -¥{coupon.toFixed(2)}
              </Text>
            </View>
            <View className="mt-3 h-[1px] bg-neutral-200" />
            <View className="mt-3 flex-row items-center justify-between">
              <Text className="text-base font-semibold text-neutral-900">
                应付
              </Text>
              <Text className="text-xl font-semibold text-amber-600">
                ¥{payable.toFixed(2)}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    );
  };

  return (
    <View className="flex-1 bg-neutral-50">
      <View
        className="absolute left-0 right-0 z-20 border-b border-slate-100 bg-white/95 px-4 pb-2"
        style={{ paddingTop: insets.top + 8 }}
      >
        <View className="flex-row items-center">
          <Pressable onPress={() => router.back()} className="mr-1.5 py-1 pr-1">
            <Text className="text-sm font-semibold text-[#1890FF]">‹ 返回</Text>
          </Pressable>
          <Text
            className="flex-1 text-base font-semibold text-slate-900"
            numberOfLines={1}
          >
            确认预订
          </Text>
        </View>
      </View>

      {renderContent()}

      <View
        className="absolute bottom-0 left-0 right-0 flex-row items-center border-t border-neutral-200 bg-white px-4"
        style={{ paddingBottom: insets.bottom + 10, paddingTop: 12 }}
      >
        <View className="flex-1">
          <Text className="text-xs text-neutral-500">在线付</Text>
          <Text className="text-xl font-semibold text-amber-600">
            ¥{payable.toFixed(2)}
          </Text>
        </View>
        <Pressable
          disabled={
            loading ||
            !hotel ||
            !room ||
            !guestName.trim() ||
            !guestPhone.trim()
          }
          onPress={handlePay}
          className={`rounded-xl px-5 py-3 ${
            loading ||
            !hotel ||
            !room ||
            !guestName.trim() ||
            !guestPhone.trim()
              ? "bg-slate-200"
              : "bg-[#2B7FC7]"
          }`}
        >
          <Text
            className={`text-base font-semibold ${
              loading ||
              !hotel ||
              !room ||
              !guestName.trim() ||
              !guestPhone.trim()
                ? "text-slate-500"
                : "text-white"
            }`}
          >
            去支付
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
