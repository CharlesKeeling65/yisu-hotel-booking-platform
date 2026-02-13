import { Pressable, Text, View } from "react-native";

import { IconSymbol } from "@/components/ui/icon-symbol";

type Props = {
  city: string;
  location: string;
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  onCityPress?: () => void;
  onDatePress?: () => void;
  onSearch?: () => void;
  onLocationPress?: () => void;
  onLocatePress?: () => void;
};

const formatMonthDay = (dateString: string) => {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return dateString;
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${month}月${day}日`;
};

export default function CompactSearchPanel({
  city,
  location,
  checkInDate,
  checkOutDate,
  nights,
  onCityPress,
  onDatePress,
  onSearch,
  onLocationPress,
  onLocatePress,
}: Props) {
  return (
    <View className="rounded-2xl border border-slate-100 bg-white p-3">
      <View className="flex-row items-center rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
        <Pressable className="flex-row items-center" onPress={onCityPress}>
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

      <View className="mt-3 flex-row items-center gap-2">
        <Pressable className="flex-1 rounded-xl border border-slate-100 bg-slate-50 px-3 py-3" onPress={onDatePress}>
          <Text className="text-[11px] text-slate-400">入住日期</Text>
          <View className="mt-1.5 flex-row items-center">
            <Text className="text-sm font-semibold text-slate-900">{formatMonthDay(checkInDate)}</Text>
            <Text className="mx-2 text-xs font-medium text-slate-400">-</Text>
            <Text className="text-sm font-semibold text-slate-900">{formatMonthDay(checkOutDate)}</Text>
            <Text className="ml-3 text-xs font-semibold text-[#1890FF]">共{nights}晚</Text>
          </View>
        </Pressable>
        <Pressable className="rounded-xl bg-[#1890FF] px-4 py-3" onPress={onSearch}>
          <Text className="text-sm font-semibold text-white">查询</Text>
        </Pressable>
      </View>
    </View>
  );
}
