/**
 * 列表排序条
 * 本地维护 active 标签；变更后将排序值通过 onChange 通知父组件触发重查。
 */
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

const FILTERS = [
  { label: "推荐", value: undefined },
  { label: "价格升序", value: "price_asc" as const },
  { label: "价格降序", value: "price_desc" as const },
  { label: "星级优先", value: "star_desc" as const },
];

type Props = {
  onChange?: (value: "price_asc" | "price_desc" | "star_desc" | undefined) => void;
};

export default function HotelFilters({ onChange }: Props) {
  const [active, setActive] = useState(FILTERS[0].label);

  return (
    <View className="flex-row flex-wrap gap-2">
      {FILTERS.map((filter) => {
        const isActive = active === filter.label;
        return (
          <Pressable
            key={filter.label}
            onPress={() => {
              setActive(filter.label);
              onChange?.(filter.value);
            }}
            className={`rounded-full px-3 py-2 ${isActive ? "bg-neutral-900" : "bg-neutral-100"}`}
          >
            <Text className={`${isActive ? "text-white" : "text-neutral-600"} text-xs`}>{filter.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
