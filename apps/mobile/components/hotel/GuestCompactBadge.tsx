import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Pressable, Text, View } from "react-native";

type Props = {
  rooms: number;
  adults: number;
  childCount: number;
  onPress?: () => void;
};

/**
 * 紧凑住客信息组件（可复用）：
 * - 仅展示图标 + 数字，避免文字占位
 * - 点击后由外层打开人数编辑弹窗
 */
export default function GuestCompactBadge({ rooms, adults, childCount, onPress }: Props) {
  return (
    <Pressable onPress={onPress} className="h-14 rounded-xl border border-slate-100 bg-slate-50 px-3 justify-center">
      <View className="flex-row items-center justify-center gap-3">
        <View className="flex-row items-center">
          <MaterialIcons name="hotel" size={16} color="#64748B" />
          <Text className="ml-1 text-base font-bold leading-5 text-slate-700">{rooms}</Text>
        </View>
        <View className="flex-row items-center">
          <MaterialIcons name="person" size={16} color="#64748B" />
          <Text className="ml-1 text-base font-bold leading-5 text-slate-700">{adults}</Text>
        </View>
        <View className="flex-row items-center">
          <MaterialIcons name="child-care" size={16} color="#64748B" />
          <Text className="ml-1 text-base font-bold leading-5 text-slate-700">{childCount}</Text>
        </View>
      </View>
    </Pressable>
  );
}
