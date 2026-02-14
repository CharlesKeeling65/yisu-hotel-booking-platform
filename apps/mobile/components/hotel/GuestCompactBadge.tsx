import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useState } from "react";
import { Pressable, Text, useWindowDimensions, View } from "react-native";

type Props = {
  rooms: number;
  adults: number;
  childCount: number;
  onPress?: () => void;
  flat?: boolean;
  className?: string;
};

/**
 * 紧凑住客信息组件（可复用）：
 * - 仅展示图标 + 数字，避免文字占位
 * - 点击后由外层打开人数编辑弹窗
 */
export default function GuestCompactBadge({ rooms, adults, childCount, onPress, flat = false, className = "" }: Props) {
  const { width } = useWindowDimensions();
  const [containerWidth, setContainerWidth] = useState(0);
  const effectiveWidth = containerWidth || width;
  const iconSize = effectiveWidth < 130 ? 13 : effectiveWidth < 150 ? 14 : effectiveWidth < 180 ? 15 : 16;
  const textSize = effectiveWidth < 130 ? 13 : effectiveWidth < 150 ? 14 : effectiveWidth < 180 ? 15 : 16;
  const containerClassName = flat
    ? `h-14 justify-center px-0.5 ${className}`.trim()
    : `h-14 rounded-xl border border-slate-100 bg-slate-50 px-3 justify-center ${className}`.trim();

  return (
    <Pressable onPress={onPress} className={containerClassName} onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}>
      <View className="flex-row items-center">
        <View className="min-w-0 flex-1 flex-row items-center justify-center">
          <MaterialIcons name="hotel" size={iconSize} color="#64748B" />
          <Text className="ml-0.5 font-bold leading-5 text-slate-700" style={{ fontSize: textSize }}>{rooms}</Text>
        </View>
        <View className="min-w-0 flex-1 flex-row items-center justify-center">
          <MaterialIcons name="person" size={iconSize} color="#64748B" />
          <Text className="ml-0.5 font-bold leading-5 text-slate-700" style={{ fontSize: textSize }}>{adults}</Text>
        </View>
        <View className="min-w-0 flex-1 flex-row items-center justify-center">
          <MaterialIcons name="child-care" size={iconSize} color="#64748B" />
          <Text className="ml-0.5 font-bold leading-5 text-slate-700" style={{ fontSize: textSize }}>{childCount}</Text>
        </View>
      </View>
    </Pressable>
  );
}
