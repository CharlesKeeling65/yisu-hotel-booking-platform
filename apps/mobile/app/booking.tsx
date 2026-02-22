import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AsyncStorage from "@react-native-async-storage/async-storage";

import DateRangePickerSheet from "@/components/hotel/DateRangePickerSheet";
import {
  createMobileOrder,
  fetchMobileHotelById,
  payMobileOrder,
} from "@/lib/api";
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
  const [phoneError, setPhoneError] = useState("");

  const [payVisible, setPayVisible] = useState(false);
  const autoBackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  const [currentCustomerId, setCurrentCustomerId] = useState<string | null>(
    null,
  );
  const [successVisible, setSuccessVisible] = useState(false);
  const [successCountdown, setSuccessCountdown] = useState(5);
  const successTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [roomsCount, setRoomsCount] = useState(Math.max(1, Number(rooms || 1)));
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [localCheckIn, setLocalCheckIn] = useState(String(checkIn ?? ""));
  const [localCheckOut, setLocalCheckOut] = useState(String(checkOut ?? ""));
  const adultCount = Math.max(roomsCount, Number(adults || 1));
  const childCount = Math.max(0, Number(children || 0));
  const nights = useMemo(
    () => diffNights(localCheckIn, localCheckOut),
    [localCheckIn, localCheckOut],
  );

  useEffect(() => {
    setLocalCheckIn(String(checkIn ?? ""));
    setLocalCheckOut(String(checkOut ?? ""));
  }, [checkIn, checkOut]);

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

  // 当房型剩余房间数变化时，保证本地选择的 roomsCount 在可用范围内
  useEffect(() => {
    const remain = room?.remain;
    if (typeof remain === "number" && remain > 0) {
      const remainNum = remain as number;
      setRoomsCount((c) => Math.min(c, remainNum));
    }
  }, [room?.remain]);

  // 价格计算：
  // - 原始价（用于展示划线价）优先使用数据库的 original_price（room.raw.original_price），
  //   若不存在则回退到当前售价 room.price。
  // - 原始总额 = original_unit * roomsCount * nights
  // - 现价总额 = price_unit * roomsCount * nights
  // - 优惠 = max(0, 原始总额 - 现价总额)
  // - 应付 = 现价总额
  const originalUnit = Number(room?.raw?.original_price ?? room?.price ?? 0);
  const priceUnit = Number(room?.price ?? 0);
  const originalTotal = originalUnit * nights * roomsCount;
  const priceTotal = priceUnit * nights * roomsCount;
  const coupon = Math.max(0, originalTotal - priceTotal);
  const payable = Math.max(0, priceTotal);

  const handlePay = async () => {
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
    setPhoneError("");
    const onlyDigits = guestPhone.replace(/\D/g, "");
    if (onlyDigits.length < 7) {
      setPhoneError("手机号格式错误，请输入有效手机号");
      return;
    }

    let customerId = "";
    try {
      const info = await AsyncStorage.getItem("customer_info");
      if (info) {
        const parsed = JSON.parse(info);
        customerId = String(parsed.id || "");
      }
    } catch {
      // ignore storage error
    }

    if (!customerId) {
      Alert.alert("请先登录", "登录后才能查看和管理订单", [
        {
          text: "去登录",
          onPress: () => router.push("/login"),
        },
        { text: "取消", style: "cancel" },
      ]);
      return;
    }

    try {
      const order = await createMobileOrder({
        customerId,
        hotelId: String(hotel.id),
        roomId: String(room.id),
        checkIn: String(localCheckIn),
        checkOut: String(localCheckOut),
        nights,
        roomsCount: roomsCount,
        adultsCount: adultCount,
        childrenCount: childCount,
        guestName: guestName.trim(),
        guestPhone: guestPhone.trim(),
        // priceSubtotal 使用现价总额（即顾客实际计费前的小计），coupon 为原价与现价差值
        priceSubtotal: priceTotal,
        couponAmount: coupon,
        payableAmount: payable,
      });

      if (!order) {
        throw new Error("创建订单失败，请稍后重试");
      }

      // 订单创建成功后，记录订单与客户信息，并弹出“模拟微信支付”页面
      setCurrentOrderId(order.id);
      setCurrentCustomerId(customerId);
      setPayVisible(true);
    } catch (e: any) {
      Alert.alert("下单失败", e?.message || String(e));
    }
  };

  const handleConfirmPay = async () => {
    if (!currentOrderId || !currentCustomerId) {
      // 理论上不会发生，兜底直接当作已支付成功跳转
      router.replace("/(tabs)/cart");
      return;
    }

    try {
      await payMobileOrder(currentOrderId, currentCustomerId);
    } catch (e: any) {
      Alert.alert("支付失败", e?.message || String(e));
      return;
    }
    // 关闭支付模态并显示 5s 倒计时弹窗；倒计时结束或手动点击将跳转到订单页
    setPayVisible(false);
    if (autoBackTimerRef.current) {
      clearTimeout(autoBackTimerRef.current);
      autoBackTimerRef.current = null;
    }

    // clear any existing success timer
    if (successTimerRef.current) {
      clearInterval(successTimerRef.current);
      successTimerRef.current = null;
    }

    setSuccessCountdown(5);
    setSuccessVisible(true);
    successTimerRef.current = setInterval(() => {
      setSuccessCountdown((c) => {
        if (c <= 1) {
          if (successTimerRef.current) {
            clearInterval(successTimerRef.current);
            successTimerRef.current = null;
          }
          setSuccessVisible(false);
          router.replace("/(tabs)/cart");
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    return () => {
      if (autoBackTimerRef.current) {
        clearTimeout(autoBackTimerRef.current);
      }
      if (successTimerRef.current) {
        clearInterval(successTimerRef.current);
      }
    };
  }, []);

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

    const remainMax: number =
      typeof room?.remain === "number" ? (room.remain as number) : Infinity;

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
                <Pressable onPress={() => setDatePickerVisible(true)}>
                  <Text className="mt-0.5 text-base font-semibold text-neutral-900">
                    {toCnDate(String(localCheckIn))}
                  </Text>
                </Pressable>
              </View>
              <Text className="px-2 text-sm text-neutral-500">
                共 {nights} 晚
              </Text>
              <View className="items-end">
                <Text className="text-xs text-neutral-500">离店</Text>
                <Pressable onPress={() => setDatePickerVisible(true)}>
                  <Text className="mt-0.5 text-base font-semibold text-neutral-900">
                    {toCnDate(String(localCheckOut))}
                  </Text>
                </Pressable>
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
                {(() => {
                  const raw = (room as any).raw;
                  const capacity = raw?.occupancy ?? room.capacity;
                  const area = raw?.size ?? room.size ?? raw?.area;
                  let tags: string[] = [];
                  if (Array.isArray(raw?.remarkTags)) tags = raw.remarkTags;
                  else if (raw?.remark)
                    tags = String(raw.remark)
                      .split(",")
                      .map((s: string) => s.trim())
                      .filter(Boolean);
                  else if ((room as any).remarkTags)
                    tags = (room as any).remarkTags;
                  else if ((room as any).remark)
                    tags = String((room as any).remark)
                      .split(",")
                      .map((s: string) => s.trim())
                      .filter(Boolean);

                  return (
                    <View className="mt-2 flex-row flex-wrap items-center gap-2">
                      <View className="flex-row items-center gap-1.5 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                        <Text className="text-xs text-slate-600">
                          最多 {capacity ?? "-"} 人
                        </Text>
                      </View>
                      <View className="flex-row items-center gap-1.5 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                        <Text className="text-xs text-slate-600">
                          面积 {area ?? "-"} ㎡
                        </Text>
                      </View>
                      {tags.length > 0 &&
                        tags.map((t) => (
                          <Text
                            key={t}
                            className="px-2 py-0.5 bg-slate-50 text-slate-600 rounded-md text-xs font-medium border border-slate-100/60"
                          >
                            {t}
                          </Text>
                        ))}
                    </View>
                  );
                })()}
                {typeof room.remain === "number" ? (
                  room.remain === 0 ? (
                    <Text className="mt-2 text-sm text-red-500">
                      该房型已售罄，不可预订
                    </Text>
                  ) : room.remain > 0 && room.remain <= 4 ? (
                    <Text className="mt-2 text-sm text-amber-600">
                      仅剩 {room.remain} 间
                    </Text>
                  ) : null
                ) : null}
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
                <View className="flex-row items-center">
                  <Pressable
                    onPress={() => setRoomsCount((c) => Math.max(1, c - 1))}
                    disabled={roomsCount <= 1}
                    className={`h-8 w-8 items-center justify-center rounded-md border ${
                      roomsCount <= 1
                        ? "border-neutral-200"
                        : "border-neutral-300"
                    } bg-white`}
                  >
                    <Text
                      className={`${roomsCount <= 1 ? "text-neutral-300" : "text-neutral-700"}`}
                    >
                      -
                    </Text>
                  </Pressable>
                  <View className="mx-3 items-center justify-center">
                    <Text className="text-sm font-semibold text-neutral-900">
                      {roomsCount} 间
                    </Text>
                  </View>
                  <Pressable
                    onPress={() =>
                      setRoomsCount((c) => Math.min(remainMax, c + 1))
                    }
                    disabled={remainMax !== Infinity && roomsCount >= remainMax}
                    className={`h-8 w-8 items-center justify-center rounded-md border ${
                      remainMax !== Infinity && roomsCount >= remainMax
                        ? "border-neutral-200"
                        : "border-neutral-300"
                    } bg-white`}
                  >
                    <Text
                      className={`${remainMax !== Infinity && roomsCount >= remainMax ? "text-neutral-300" : "text-neutral-700"}`}
                    >
                      +
                    </Text>
                  </Pressable>
                </View>
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
                  onChangeText={(text) => {
                    setGuestPhone(text);
                    if (phoneError) setPhoneError("");
                  }}
                  placeholder="手机号"
                  keyboardType="phone-pad"
                  className="mt-2 rounded-md border border-neutral-200 bg-white px-3 py-2"
                />
                {phoneError ? (
                  <Text className="mt-1 text-xs text-red-500">
                    {phoneError}
                  </Text>
                ) : null}
              </View>

              <Text className="mt-3 text-sm text-neutral-700">
                下单后可在订单中查看进度。
              </Text>
            </View>
          </View>

          <View className="mt-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
            <Text className="text-base font-semibold text-neutral-900">
              价格明细
            </Text>
            <View className="mt-3 flex-row items-center justify-between">
              <Text className="text-sm text-neutral-700">
                房费 × {roomsCount} 间 × {nights} 晚
              </Text>
              <Text className="text-sm font-semibold text-neutral-900">
                ¥{originalTotal.toFixed(2)}
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

  const canPay =
    !loading &&
    !!hotel &&
    !!room &&
    guestName.trim().length > 0 &&
    guestPhone.trim().length > 0 &&
    (room?.remain == null || room?.remain > 0);

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

      <Modal
        visible={payVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPayVisible(false)}
      >
        <View className="flex-1 justify-end bg-black/40">
          <View className="rounded-t-3xl bg-white px-6 pb-8 pt-4">
            <Text className="text-center text-base font-semibold text-neutral-900">
              微信支付
            </Text>
            <Text className="mt-2 text-center text-xs text-neutral-500">
              模拟微信支付页面（仅为演示，不会真实扣款）
            </Text>
            <Text className="mt-6 text-center text-3xl font-semibold text-emerald-600">
              ¥{payable.toFixed(2)}
            </Text>
            <Text className="mt-2 text-center text-xs text-neutral-500">
              订单金额
            </Text>

            <View className="mt-8 flex-row justify-between">
              <Pressable
                className="flex-1 rounded-full border border-neutral-300 py-3 mr-2 items-center justify-center"
                onPress={() => {
                  setPayVisible(false);
                  if (autoBackTimerRef.current) {
                    clearTimeout(autoBackTimerRef.current);
                    autoBackTimerRef.current = null;
                  }
                  router.replace("/(tabs)/cart");
                }}
              >
                <Text className="text-sm font-medium text-neutral-700">
                  取消
                </Text>
              </Pressable>
              <Pressable
                className="flex-1 rounded-full bg-[#07C160] py-3 ml-2 items-center justify-center"
                onPress={handleConfirmPay}
              >
                <Text className="text-sm font-semibold text-white">
                  确认支付
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={successVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (successTimerRef.current) {
            clearInterval(successTimerRef.current);
            successTimerRef.current = null;
          }
          setSuccessVisible(false);
          router.replace("/(tabs)/cart");
        }}
      >
        <View className="flex-1 justify-center items-center bg-black/40">
          <View className="mx-6 w-[90%] rounded-2xl bg-white px-6 py-6">
            <Text className="text-center text-base font-semibold text-neutral-900">
              支付成功
            </Text>
            <Text className="mt-2 text-center text-sm text-neutral-500">
              已成功支付，{successCountdown} 秒后自动跳转订单页
            </Text>

            <View className="mt-6">
              <Pressable
                className="rounded-full bg-[#07C160] py-3 items-center justify-center"
                onPress={() => {
                  if (successTimerRef.current) {
                    clearInterval(successTimerRef.current);
                    successTimerRef.current = null;
                  }
                  setSuccessVisible(false);
                  router.replace("/(tabs)/cart");
                }}
              >
                <Text className="text-sm font-semibold text-white">
                  查看订单
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <DateRangePickerSheet
        visible={datePickerVisible}
        checkInDate={localCheckIn}
        checkOutDate={localCheckOut}
        onClose={() => setDatePickerVisible(false)}
        onConfirm={(next) => {
          setLocalCheckIn(next.checkInDate);
          setLocalCheckOut(next.checkOutDate);
          setDatePickerVisible(false);
        }}
      />

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
          disabled={!canPay}
          onPress={handlePay}
          className={`rounded-xl px-5 py-3 ${
            canPay ? "bg-[#2B7FC7]" : "bg-slate-200"
          }`}
        >
          <Text
            className={`text-base font-semibold ${
              canPay ? "text-white" : "text-slate-500"
            }`}
          >
            去支付
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
