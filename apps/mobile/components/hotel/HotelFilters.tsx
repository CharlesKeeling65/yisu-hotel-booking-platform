import { useState } from "react";
import { Pressable, Text, View } from "react-native";

const FILTERS = ["Recommended", "Price", "Rating", "Distance"];

export default function HotelFilters() {
  const [active, setActive] = useState(FILTERS[0]);

  return (
    <View className="flex-row flex-wrap gap-2">
      {FILTERS.map((filter) => {
        const isActive = active === filter;
        return (
          <Pressable
            key={filter}
            onPress={() => setActive(filter)}
            className={`rounded-full px-3 py-2 ${
              isActive ? "bg-neutral-900" : "bg-neutral-100"
            }`}>
            <Text className={`${isActive ? "text-white" : "text-neutral-600"} text-xs`}>
              {filter}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
