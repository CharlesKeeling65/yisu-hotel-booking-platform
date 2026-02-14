/**
 * 首页搜索面板（完整版本）
 * 职责：
 * - 承载酒店搜索的主要输入项
 * - 通过 props 回调把交互事件上抛给页面容器处理
 */
import { Pressable, Text, View } from "react-native";
import { IconSymbol } from "@/components/ui/icon-symbol";

type Props = {
  city: string;
  location: string;
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  rooms: number;
  adults: number;
  childCount: number;
  starLabel: string;
  onCityPress?: () => void;
  onLocationPress?: () => void;
  onLocatePress?: () => void;
  onDatePress?: () => void;
  onStarPress?: () => void;
  onStepRooms?: (delta: number) => void;
  onStepAdults?: (delta: number) => void;
  onStepChildren?: (delta: number) => void;
  onSearch?: () => void;
};

const formatMonthDay = (dateString: string) => {
  // UI 只显示“月/日”，避免输入区信息密度过高
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return dateString;
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${month}月${day}日`;
};

function Stepper({ label, value, onSub, onAdd }: { label: string; value: number; onSub: () => void; onAdd: () => void }) {
  // 数量步进器是纯展示+交互组件，具体 state 在父组件管理
  return (
    <View className="min-w-[96px] flex-1 rounded-2xl bg-[#F4F7FB] px-2 py-2">
      <Text className="text-center text-[11px] text-slate-500">{label}</Text>
      <View className="mt-1.5 flex-row items-center justify-center">
        <Pressable onPress={onSub} className="h-7 w-7 items-center justify-center rounded-full bg-slate-200">
          <Text className="text-base font-semibold text-slate-700">-</Text>
        </Pressable>
        <Text className="mx-2 w-5 text-center text-sm font-semibold text-slate-900">{value}</Text>
        <Pressable onPress={onAdd} className="h-7 w-7 items-center justify-center rounded-full bg-[#E6F4FF]">
          <Text className="text-base font-semibold text-[#1890FF]">+</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function SearchPanel(props: Props) {
  const {
    city,
    location,
    checkInDate,
    checkOutDate,
    nights,
    rooms,
    adults,
    childCount,
    starLabel,
    onCityPress,
    onLocationPress,
    onLocatePress,
    onDatePress,
    onStarPress,
    onStepRooms,
    onStepAdults,
    onStepChildren,
    onSearch,
  } = props;

  return (
    <View className="rounded-3xl border border-slate-100 bg-white p-4 shadow-lg">
      <View className="flex-row items-center gap-2">
        <Text className="rounded-full bg-[#E6F4FF] px-3 py-1 text-xs font-semibold text-[#1890FF]">国内酒店</Text>
      </View>

      <View className="mt-4 flex-row items-center rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2">
        <Pressable className="flex-row items-center pr-2" onPress={onCityPress}>
          <Text className="text-sm font-semibold text-slate-900">{city}</Text>
          <Text className="ml-1 text-xs text-slate-400">▼</Text>
        </Pressable>
        <Text className="mx-2 text-xs text-slate-300">|</Text>
        <Pressable className="flex-1 py-2" onPress={onLocationPress}>
          <Text className={`text-sm ${location ? "font-medium text-slate-700" : "text-slate-400"}`}>
            {location || "位置/商圈/酒店"}
          </Text>
        </Pressable>
        <Pressable
          onPress={onLocatePress}
          className="ml-2 h-9 w-9 items-center justify-center rounded-full bg-[#E6F4FF]">
          <IconSymbol size={18} name="location.fill" color="#1890FF" />
        </Pressable>
      </View>

      <Pressable className="mt-3 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3" onPress={onDatePress}>
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-[11px] uppercase text-slate-400">入住日期</Text>
            <View className="mt-1.5 flex-row items-center">
              <Text className="text-sm font-semibold text-slate-900">{formatMonthDay(checkInDate)}</Text>
              <Text className="mx-2 text-xs font-medium text-slate-400">-</Text>
              <Text className="text-sm font-semibold text-slate-900">{formatMonthDay(checkOutDate)}</Text>
            </View>
          </View>
          <Text className="mr-1 text-sm font-semibold text-[#1890FF]">共{nights}晚</Text>
        </View>
      </Pressable>

      <View className="mt-3 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3">
        <View className="flex-row flex-wrap gap-2">
          <Stepper label="间数" value={rooms} onSub={() => onStepRooms?.(-1)} onAdd={() => onStepRooms?.(1)} />
          <Stepper label="成人" value={adults} onSub={() => onStepAdults?.(-1)} onAdd={() => onStepAdults?.(1)} />
          <Stepper label="儿童" value={childCount} onSub={() => onStepChildren?.(-1)} onAdd={() => onStepChildren?.(1)} />
        </View>
        <Pressable onPress={onStarPress} className="mt-2.5 self-end flex-row items-center rounded-full bg-[#FFF7E6] px-3 py-2">
          <Text className="text-xs font-semibold text-[#FFA940]">{starLabel}</Text>
          <Text className="ml-1 text-xs text-[#FFA940]">▼</Text>
        </Pressable>
      </View>

      <View className="mt-4 flex-row items-center gap-2">
        <View className="flex-1" />
        <Pressable className="rounded-xl bg-[#1890FF] px-5 py-3" onPress={onSearch}>
          <Text className="text-sm font-semibold text-white">查询</Text>
        </Pressable>
      </View>
    </View>
  );
}
