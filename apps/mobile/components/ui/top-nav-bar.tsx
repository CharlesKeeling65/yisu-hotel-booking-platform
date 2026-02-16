import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  title: string;
  onBack: () => void;
};

/**
 * 统一顶部导航栏：
 * - 左侧返回 + 中间标题
 * - 极简白底，下沿阴影与内容区分层
 */
export default function TopNavBar({ title, onBack }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="bg-white px-4 pb-3"
      style={{
        paddingTop: insets.top + 8,
        borderBottomWidth: 1,
        borderBottomColor: "#F1F5F9",
        shadowColor: "#0F172A",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
        elevation: 2,
      }}
    >
      <View className="flex-row items-center justify-between">
        <Pressable onPress={onBack} className="w-16 py-1">
          <Text className="text-sm font-semibold text-[#1890FF]">‹ 返回</Text>
        </Pressable>
        <Text className="flex-1 text-center text-base font-semibold text-slate-900" numberOfLines={1}>
          {title}
        </Text>
        <View className="w-16" />
      </View>
    </View>
  );
}
