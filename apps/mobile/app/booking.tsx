/**
 * 订单预订页
 */
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

// 👉 核心修复：直接引入原生自带、全平台兼容的 Vector Icons
import { Ionicons, Feather } from "@expo/vector-icons";

import DateRangePickerSheet from "@/components/hotel/DateRangePickerSheet";
import {
  createMobileOrder,
  fetchMobileHotelById,
  payMobileOrder,
} from "@/lib/api";
import type { Hotel, Room } from "@yisu/shared";

const ARRIVAL_TIME_OPTIONS = ["14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00", "23:00", "次日00:00"];
const REGION_CODES = ["+86", "+852", "+853", "+886", "+1"];

function toCnMonthDay(s: string) {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s || "";
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
  const diff = Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return "今天";
  if (diff === 1) return "明天";
  if (diff === 2) return "后天";
  const week = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  return week[d.getDay()];
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

  // 弹窗状态
  const [infoNoticeVisible, setInfoNoticeVisible] = useState(false);
  const [regionVisible, setRegionVisible] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState("+86");
  const [timePickerVisible, setTimePickerVisible] = useState(false);
  const [arrivalTime, setArrivalTime] = useState("14:00");

  const [payVisible, setPayVisible] = useState(false);
  const autoBackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  const [currentCustomerId, setCurrentCustomerId] = useState<string | null>(null);
  const [successVisible, setSuccessVisible] = useState(false);
  const [successCountdown, setSuccessCountdown] = useState(5);
  const successTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [confirmLoginVisible, setConfirmLoginVisible] = useState(false);
  const [validationModalVisible, setValidationModalVisible] = useState(false);
  const [validationModalMsg, setValidationModalMsg] = useState("");

  const [roomsCount, setRoomsCount] = useState(Math.max(1, Number(rooms || 1)));
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [localCheckIn, setLocalCheckIn] = useState(String(checkIn ?? ""));
  const [localCheckOut, setLocalCheckOut] = useState(String(checkOut ?? ""));
  const adultCount = Math.max(roomsCount, Number(adults || 1));
  const childCount = Math.max(0, Number(children || 0));
  
  const nights = useMemo(
    () => diffNights(localCheckIn, localCheckOut),
    [localCheckIn, localCheckOut]
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

  useEffect(() => {
    const remain = room?.remain;
    if (typeof remain === "number" && remain > 0) {
      const remainNum = remain as number;
      setRoomsCount((c) => Math.min(c, remainNum));
    }
  }, [room?.remain]);

  const originalUnit = Number(room?.raw?.original_price ?? room?.price ?? 0);
  const priceUnit = Number(room?.price ?? 0);
  const originalTotal = originalUnit * nights * roomsCount;
  const priceTotal = priceUnit * nights * roomsCount;
  const coupon = Math.max(0, originalTotal - priceTotal);
  const payable = Math.max(0, priceTotal);

  const handlePay = async () => {
    if (!room || !hotel) { Alert.alert("无法支付", "房型信息缺失，请返回重试。"); return; }
    if (!guestName.trim()) { Alert.alert("请输入姓名", "请填写预订人姓名"); return; }
    if (!guestPhone.trim()) { Alert.alert("请输入手机号", "请填写预订人手机号"); return; }
    
    setPhoneError("");
    const onlyDigits = guestPhone.replace(/\D/g, "");
    if (!/^1\d{10}$/.test(onlyDigits)) {
      setPhoneError("手机号格式不正确");
      return;
    }

    let customerId = "";
    try {
      const info = await AsyncStorage.getItem("customer_info");
      if (info) {
        const parsed = JSON.parse(info);
        customerId = String(parsed.id || "");
      }
    } catch {}

    if (!customerId) {
      setConfirmLoginVisible(true);
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
        priceSubtotal: priceTotal,
        couponAmount: coupon,
        payableAmount: payable,
      });

      if (!order) throw new Error("创建订单失败，请稍后重试");

      setCurrentOrderId(order.id);
      setCurrentCustomerId(customerId);
      setPayVisible(true);
    } catch (e: any) {
      Alert.alert("下单失败", e?.message || String(e));
    }
  };

  const handleConfirmPay = async () => {
    if (!currentOrderId || !currentCustomerId) {
      router.replace("/(tabs)/cart");
      return;
    }

    try {
      await payMobileOrder(currentOrderId, currentCustomerId);
    } catch (e: any) {
      Alert.alert("支付失败", e?.message || String(e));
      return;
    }
    setPayVisible(false);
    if (autoBackTimerRef.current) clearTimeout(autoBackTimerRef.current);
    if (successTimerRef.current) clearInterval(successTimerRef.current);

    setSuccessCountdown(5);
    setSuccessVisible(true);
    successTimerRef.current = setInterval(() => {
      setSuccessCountdown((c) => {
        if (c <= 1) {
          if (successTimerRef.current) clearInterval(successTimerRef.current);
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
      if (autoBackTimerRef.current) clearTimeout(autoBackTimerRef.current);
      if (successTimerRef.current) clearInterval(successTimerRef.current);
    };
  }, []);

  const renderContent = () => {
    if (loading) return <View className="flex-1 items-center justify-center"><Text className="text-base text-neutral-500">加载中...</Text></View>;
    if (error || !hotel) return <View className="flex-1 items-center justify-center"><Text className="text-base text-neutral-500">{error || "加载失败"}</Text></View>;
    if (!room) return <View className="flex-1 items-center justify-center"><Text className="text-base text-neutral-500">房型不存在或已售罄</Text></View>;

    const remainMax: number = typeof room?.remain === "number" ? (room.remain as number) : Infinity;

    // 解析房型标签
    const raw = (room as any).raw;
    const capacity = raw?.occupancy ?? room.capacity;
    const area = raw?.size ?? room.size ?? raw?.area;
    const bedType = room.bedType || "标准床";
    const breakfast = room.breakfastIncluded ? "含早餐" : "无早餐";
    
    // 生成蓝底方块标签数组
    const metaTags = [
      bedType, 
      breakfast, 
      capacity ? `最多${capacity}人` : null, 
      area ? `${area}㎡` : null
    ].filter(Boolean);

    return (
      <ScrollView
        className="flex-1 bg-[#F5F8FC]"
        contentContainerStyle={{
          paddingTop: insets.top + 54,
          paddingBottom: insets.bottom + 120,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-3">
          
          {/* ================= 版块 1：房型与日期 ================= */}
          <View className="rounded-2xl bg-white p-4 shadow-sm shadow-slate-200/50">
            
            {/* 日期选择区 */}
            <Pressable 
              className="flex-row items-center mb-4"
              onPress={() => setDatePickerVisible(true)}
            >
              <Text className="text-[15px] font-bold text-slate-900">
                {toCnMonthDay(localCheckIn)} {getDateMetaLabel(localCheckIn)} - {toCnMonthDay(localCheckOut)} {getDateMetaLabel(localCheckOut)}
              </Text>
              <View className="ml-2 rounded-full border border-slate-200 px-1.5 py-0.5">
                <Text className="text-[10px] text-slate-500">{nights}晚</Text>
              </View>
            </Pressable>

            {/* 房型名称 */}
            <Text className="text-[20px] font-black text-slate-900 leading-tight mb-3">
              {room.name}
            </Text>
            
            {/* 蓝底方格标签 */}
            <View className="flex-row flex-wrap gap-2 mb-3">
              {metaTags.map((tag, i) => (
                <View key={i} className="bg-[#F0F7FF] rounded-md px-2 py-1">
                  <Text className="text-[11px] font-medium text-[#1890FF]">{tag}</Text>
                </View>
              ))}
            </View>

            {/* 政策标签 (使用跨平台支持极好的 Ionicons) */}
            <View className="flex-row items-center flex-wrap gap-y-1 mt-1">
              <View className="flex-row items-center mr-3">
                <Ionicons name="checkmark-circle" size={13} color="#1890FF" />
                <Text className="text-[12px] text-[#1890FF] ml-1">30分钟内免费取消</Text>
              </View>
              <View className="flex-row items-center">
                <Ionicons name="flash" size={13} color="#1890FF" />
                <Text className="text-[12px] text-[#1890FF] ml-1">预计5分钟确认</Text>
              </View>
            </View>

          </View>


          {/* ================= 版块 2：入住信息表单 ================= */}
          <View className="mt-3 rounded-2xl bg-white px-4 py-2 shadow-sm shadow-slate-200/50">
            
            {/* 标题与房间数量增减 */}
            <View className="flex-row items-center justify-between py-3 border-b border-slate-100">
              <View className="flex-row items-center">
                <Text className="text-[16px] font-extrabold text-slate-900">入住信息</Text>
                <Pressable onPress={() => setInfoNoticeVisible(true)} className="ml-2 p-1">
                  <Feather name="info" size={14} color="#94A3B8" />
                </Pressable>
              </View>

              <View className="flex-row items-center rounded-full bg-slate-50 border border-slate-100 p-0.5">
                <Pressable
                  onPress={() => setRoomsCount((c) => Math.max(1, c - 1))}
                  disabled={roomsCount <= 1}
                  className="h-7 w-7 items-center justify-center rounded-full"
                >
                  <Text className={`text-lg leading-none mt-[-2px] ${roomsCount <= 1 ? "text-slate-300" : "text-slate-600"}`}>-</Text>
                </Pressable>
                <View className="w-8 items-center justify-center">
                  <Text className="text-[14px] font-bold text-slate-900">{roomsCount}间</Text>
                </View>
                <Pressable
                  onPress={() => setRoomsCount((c) => Math.min(remainMax, c + 1))}
                  disabled={remainMax !== Infinity && roomsCount >= remainMax}
                  className="h-7 w-7 items-center justify-center rounded-full"
                >
                  <Text className={`text-lg leading-none mt-[-2px] ${remainMax !== Infinity && roomsCount >= remainMax ? "text-slate-300" : "text-slate-600"}`}>+</Text>
                </Pressable>
              </View>
            </View>

            {/* 住客姓名 */}
            <View className="flex-row items-center py-4 border-b border-slate-100">
              <Text className="w-20 text-[14px] font-medium text-slate-700">住客姓名</Text>
              <TextInput
                value={guestName}
                onChangeText={setGuestName}
                placeholder="须与证件一致"
                placeholderTextColor="#94A3B8"
                className="flex-1 text-[15px] font-bold text-slate-900 p-0"
                style={{ outlineStyle: 'none' } as any}
              />
              <Feather name="user-plus" size={16} color="#1890FF" />
            </View>

            {/* 联系手机 (带地区下拉) */}
            <View className="flex-row items-center py-4 border-b border-slate-100">
              <Text className="w-20 text-[14px] font-medium text-slate-700">联系手机</Text>
              <Pressable onPress={() => setRegionVisible(true)} className="flex-row items-center mr-3 bg-slate-50 px-2 py-1.5 rounded-md border border-slate-100">
                <Text className="text-[14px] font-bold text-slate-700 mr-1">{selectedRegion}</Text>
                <Feather name="chevron-down" size={12} color="#94A3B8" />
              </Pressable>
              <TextInput
                value={guestPhone}
                onChangeText={(text) => {
                  setGuestPhone(text);
                  if (phoneError) setPhoneError("");
                }}
                placeholder="用于接收通知"
                placeholderTextColor="#94A3B8"
                keyboardType="phone-pad"
                className="flex-1 text-[15px] font-bold text-slate-900 p-0"
                style={{ outlineStyle: 'none' } as any}
              />
            </View>
            {phoneError ? <Text className="mt-1 ml-20 text-[11px] text-[#FF4D4F]">{phoneError}</Text> : null}

            {/* 预计到店 */}
            <Pressable onPress={() => setTimePickerVisible(true)} className="flex-row items-center py-4">
              <Text className="w-20 text-[14px] font-medium text-slate-700">预计到店</Text>
              <Text className="text-[14px] font-bold text-slate-900 mr-2">{arrivalTime} 之前</Text>
              <Text className="flex-1 text-[12px] text-slate-400">房间将整晚保留</Text>
              <Feather name="chevron-right" size={14} color="#CBD5E1" />
            </Pressable>

          </View>

          {/* ================= 版块 3：价格明细 ================= */}
          <View className="mt-3 mb-6 rounded-2xl bg-white p-4 shadow-sm shadow-slate-200/50">
            <Text className="text-[16px] font-extrabold text-slate-900 mb-3">
              价格明细
            </Text>
            <View className="flex-row items-center justify-between py-1.5">
              <Text className="text-[13px] text-slate-600">
                房费 ({roomsCount}间 × {nights}晚)
              </Text>
              <Text className="text-[13px] font-medium text-slate-900">
                ¥{originalTotal.toFixed(2)}
              </Text>
            </View>
            {coupon > 0 && (
              <View className="flex-row items-center justify-between py-1.5">
                <Text className="text-[13px] text-slate-600">可享优惠</Text>
                <Text className="text-[13px] font-bold text-[#FF4D4F]">
                  -¥{coupon.toFixed(2)}
                </Text>
              </View>
            )}
            <View className="mt-3 pt-3 border-t border-slate-100 flex-row items-center justify-between">
              <Text className="text-[14px] font-bold text-slate-900">合计应付</Text>
              <View className="flex-row items-baseline">
                <Text className="text-[12px] font-bold text-[#FF4D4F]">¥</Text>
                <Text className="text-[18px] font-black text-[#FF4D4F] tracking-tight">{payable.toFixed(2)}</Text>
              </View>
            </View>
          </View>

        </View>
      </ScrollView>
    );
  };

  const validateBooking = () => {
    if (loading) return { ok: false, reason: "正在加载，请稍后再试" };
    if (!hotel) return { ok: false, reason: "酒店信息缺失" };
    if (!room) return { ok: false, reason: "房型信息缺失" };
    if (!guestName.trim()) return { ok: false, reason: "请填写预订人姓名" };
    const onlyDigits = String(guestPhone || "").replace(/\D/g, "");
    if (!guestPhone.trim()) return { ok: false, reason: "请填写手机号" };
    if (!/^1\d{10}$/.test(onlyDigits))
      return { ok: false, reason: "手机号格式不正确" };
    if (typeof room?.remain === "number" && room.remain <= 0)
      return { ok: false, reason: "该房型已售罄" };
    return { ok: true, reason: "" };
  };

  const bookingValidation = validateBooking();
  const finalCanPay = bookingValidation.ok;

  return (
    <View className="flex-1 bg-[#F5F8FC]">
      
      {/* 顶部导航 */}
      <View
        className="absolute left-0 right-0 z-20 bg-[#F5F8FC] px-3 pb-3"
        style={{ paddingTop: insets.top + 8 }}
      >
        <View className="flex-row items-center relative h-10">
          <Pressable onPress={() => router.back()} className="px-2 py-1 z-10">
            <Feather name="chevron-left" size={28} color="#1E293B" />
          </Pressable>
          <Text className="absolute left-10 right-10 text-[16px] font-bold text-slate-900 text-center" numberOfLines={1}>
            {hotel?.name || '填写订单'}
          </Text>
        </View>
      </View>

      {renderContent()}

      {/* 吸底支付栏 */}
      <View
        className="absolute bottom-0 left-0 right-0 flex-row items-center bg-white px-5 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]"
        style={{ paddingBottom: insets.bottom + 12, paddingTop: 12 }}
      >
        <View className="flex-1 flex-row items-baseline">
           <Text className="text-[16px] font-bold text-[#FF4D4F]">¥</Text>
           <Text className="text-[28px] font-black text-[#FF4D4F] tracking-tighter mr-2">{payable.toFixed(2)}</Text>
           {coupon > 0 && <Text className="text-[11px] text-[#FF4D4F] font-medium bg-red-50 px-1.5 py-0.5 rounded">已优惠¥{coupon.toFixed(2)}</Text>}
        </View>
        
        <Pressable
          onPress={() => {
            if (!bookingValidation.ok) {
              setValidationModalMsg(bookingValidation.reason || "请检查填写项");
              setValidationModalVisible(true);
              return;
            }
            handlePay();
          }}
          className={`h-[44px] px-8 items-center justify-center rounded-full ${
            finalCanPay ? "bg-[#1890FF] active:opacity-80" : "bg-slate-200"
          }`}
        >
          <Text className={`text-[16px] font-bold ${finalCanPay ? "text-white" : "text-slate-400"}`}>
            提交订单
          </Text>
        </Pressable>
      </View>

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

      {/* ================= 各种弹窗 ================= */}
      
      {/* 隐私声明弹窗 */}
      <Modal visible={infoNoticeVisible} transparent animationType="fade" onRequestClose={() => setInfoNoticeVisible(false)}>
        <View className="flex-1 bg-black/50 items-center justify-center px-8">
          <View className="bg-white rounded-3xl p-6 w-full shadow-xl">
            <View className="items-center mb-4">
               <Ionicons name="shield-checkmark" size={44} color="#1890FF" />
            </View>
            <Text className="text-[18px] font-bold text-slate-900 text-center mb-3">隐私安全声明</Text>
            <Text className="text-[14px] text-slate-500 leading-6 text-center">
              您填写的预订信息仅用于酒店入住登记及接收确认通知。我们承诺严格保护您的隐私，搜集的信息绝对不会用于任何商业及额外用途。
            </Text>
            <Pressable onPress={() => setInfoNoticeVisible(false)} className="mt-8 bg-[#1890FF] py-3.5 rounded-full items-center active:opacity-80">
              <Text className="text-white font-bold text-[15px]">我已了解</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* 地区选择弹窗 */}
      <Modal visible={regionVisible} transparent animationType="fade" onRequestClose={() => setRegionVisible(false)}>
        <View className="flex-1 bg-black/50 justify-end">
          <Pressable className="flex-1" onPress={() => setRegionVisible(false)} />
          <View className="bg-white rounded-t-[24px] p-6 shadow-2xl">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-[17px] font-bold text-slate-900">选择国家/地区码</Text>
              <Pressable onPress={() => setRegionVisible(false)} className="p-1">
                <Ionicons name="close-circle" size={24} color="#E2E8F0" />
              </Pressable>
            </View>
            {REGION_CODES.map(code => (
              <Pressable key={code} onPress={() => { setSelectedRegion(code); setRegionVisible(false); }} className="py-4 border-b border-slate-50 flex-row justify-between items-center">
                <Text className={`text-[16px] ${selectedRegion === code ? 'text-[#1890FF] font-bold' : 'text-slate-700'}`}>{code}</Text>
                {selectedRegion === code && <Feather name="check" size={18} color="#1890FF" />}
              </Pressable>
            ))}
            <View style={{ height: insets.bottom }} />
          </View>
        </View>
      </Modal>

      {/* 到店时间弹窗 */}
      <Modal visible={timePickerVisible} transparent animationType="fade" onRequestClose={() => setTimePickerVisible(false)}>
        <View className="flex-1 bg-black/50 justify-end">
          <Pressable className="flex-1" onPress={() => setTimePickerVisible(false)} />
          <View className="bg-white rounded-t-[24px] max-h-[45%] shadow-2xl">
            <View className="p-5 border-b border-slate-100 flex-row justify-between items-center">
              <Pressable onPress={() => setTimePickerVisible(false)}><Text className="text-slate-400 font-medium">取消</Text></Pressable>
              <Text className="font-bold text-slate-900 text-[16px]">预计到店时间</Text>
              <Pressable onPress={() => setTimePickerVisible(false)}><Text className="text-[#1890FF] font-bold">确定</Text></Pressable>
            </View>
            <ScrollView className="px-5 py-2" showsVerticalScrollIndicator={false}>
              {ARRIVAL_TIME_OPTIONS.map(time => (
                <Pressable 
                  key={time} 
                  onPress={() => { setArrivalTime(time); setTimePickerVisible(false); }} 
                  className="py-4 border-b border-slate-50 flex-row justify-between items-center active:bg-slate-50"
                >
                  <Text className={`text-[16px] ${arrivalTime === time ? 'text-[#1890FF] font-bold' : 'text-slate-700'}`}>{time}</Text>
                  {arrivalTime === time && <Feather name="check" size={18} color="#1890FF" />}
                </Pressable>
              ))}
              <View style={{ height: insets.bottom + 20 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 模拟支付弹窗 */}
      <Modal visible={payVisible} transparent animationType="fade" onRequestClose={() => setPayVisible(false)}>
        <View className="flex-1 justify-end bg-black/50">
          <Pressable className="flex-1" onPress={() => setPayVisible(false)} />
          <View className="bg-white rounded-t-[24px] px-6 pb-10 pt-5">
            <Text className="text-center text-[17px] font-bold text-slate-900">模拟微信支付</Text>
            <Text className="mt-2 text-center text-[12px] text-slate-400">测试环境，不会产生真实扣款</Text>
            <View className="mt-8 mb-1 flex-row items-baseline justify-center">
               <Text className="text-[20px] font-bold text-emerald-500">¥</Text>
               <Text className="text-[40px] font-black text-emerald-500 tracking-tighter">{payable.toFixed(2)}</Text>
            </View>
            <View className="mt-10 flex-row justify-between gap-3">
              <Pressable className="flex-1 rounded-full bg-slate-100 py-3.5 items-center active:bg-slate-200" onPress={() => { setPayVisible(false); if (autoBackTimerRef.current) { clearTimeout(autoBackTimerRef.current); autoBackTimerRef.current = null; } router.replace("/(tabs)/cart"); }}>
                <Text className="text-[15px] font-bold text-slate-600">稍后支付</Text>
              </Pressable>
              <Pressable className="flex-1 rounded-full bg-[#07C160] py-3.5 items-center flex-row justify-center active:opacity-80" onPress={handleConfirmPay}>
                <Ionicons name="shield-checkmark" size={18} color="white" />
                <Text className="text-[15px] font-bold text-white ml-1.5">确认支付</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* 支付成功弹窗 */}
      <Modal visible={successVisible} transparent animationType="fade" onRequestClose={() => { if (successTimerRef.current) clearInterval(successTimerRef.current); setSuccessVisible(false); router.replace("/(tabs)/cart"); }}>
        <View className="flex-1 justify-center items-center bg-black/40 px-8">
          <View className="w-full rounded-[24px] bg-white p-6 items-center">
            <View className="h-12 w-12 rounded-full bg-emerald-100 items-center justify-center mb-4">
              <Ionicons name="checkmark-circle" size={40} color="#10B981" />
            </View>
            <Text className="text-[18px] font-bold text-slate-900">支付成功</Text>
            <Text className="mt-2 text-center text-[13px] text-slate-500">您的订单已确认，{successCountdown} 秒后返回订单页</Text>
            <Pressable className="mt-6 w-full rounded-full bg-[#1890FF] py-3.5 items-center active:opacity-80" onPress={() => { if (successTimerRef.current) clearInterval(successTimerRef.current); setSuccessVisible(false); router.replace("/(tabs)/cart"); }}>
              <Text className="text-[15px] font-bold text-white">查看订单</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* 校验提示弹窗 */}
      <Modal visible={validationModalVisible} transparent animationType="fade" onRequestClose={() => setValidationModalVisible(false)}>
        <View className="flex-1 justify-center items-center bg-black/40 px-10">
          <View className="w-full rounded-[20px] bg-white p-6 items-center">
            <Text className="text-[17px] font-bold text-slate-900">提示</Text>
            <Text className="mt-3 text-center text-[14px] text-slate-600 leading-relaxed">{validationModalMsg}</Text>
            <Pressable className="mt-6 w-full rounded-full bg-[#1890FF] py-3 items-center" onPress={() => setValidationModalVisible(false)}>
              <Text className="text-[15px] font-bold text-white">知道了</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* 未登录弹窗 */}
      <Modal visible={confirmLoginVisible} transparent animationType="fade" onRequestClose={() => setConfirmLoginVisible(false)}>
        <View className="flex-1 justify-center items-center bg-black/40 px-10">
          <View className="w-full rounded-[20px] bg-white p-6 items-center">
            <Text className="text-[17px] font-bold text-slate-900">请先登录</Text>
            <Text className="mt-3 text-center text-[14px] text-slate-600">登录后才能继续下单和管理订单</Text>
            <View className="mt-6 flex-row w-full gap-3">
              <Pressable className="flex-1 rounded-full bg-slate-100 py-3 items-center" onPress={() => setConfirmLoginVisible(false)}>
                <Text className="text-[15px] font-bold text-slate-600">取消</Text>
              </Pressable>
              <Pressable className="flex-1 rounded-full bg-[#1890FF] py-3 items-center" onPress={() => { setConfirmLoginVisible(false); router.push("/login"); }}>
                <Text className="text-[15px] font-bold text-white">去登录</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}