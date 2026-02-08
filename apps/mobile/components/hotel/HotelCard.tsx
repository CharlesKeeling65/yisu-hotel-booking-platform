import { Image } from "expo-image";
import { Pressable, Text, View } from "react-native";

import type { Hotel } from "@yisu/shared";

type HotelCardProps = {
  hotel: Hotel;
  onPress?: () => void;
};

export default function HotelCard({ hotel, onPress }: HotelCardProps) {
  return (
    <Pressable
      onPress={onPress}
      className="mb-4 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <Image
        source={{ uri: hotel.coverImage }}
        className="h-44 w-full"
        contentFit="cover"
      />
      <View className="gap-2 p-4">
        <View className="flex-row items-center justify-between">
          <Text className="text-lg font-semibold text-neutral-900">{hotel.name}</Text>
          <View className="rounded-full bg-amber-100 px-2 py-1">
            <Text className="text-xs font-semibold text-amber-700">{hotel.rating}</Text>
          </View>
        </View>
        <Text className="text-sm text-neutral-500">{hotel.city} · {hotel.address}</Text>
        <View className="flex-row flex-wrap gap-2">
          {hotel.tags.map((tag) => (
            <View key={tag} className="rounded-full bg-neutral-100 px-2 py-1">
              <Text className="text-xs text-neutral-600">{tag}</Text>
            </View>
          ))}
        </View>
        <View className="flex-row items-end justify-between">
          <Text className="text-sm text-neutral-500">From</Text>
          <Text className="text-lg font-semibold text-neutral-900">¥{hotel.priceFrom}</Text>
        </View>
      </View>
    </Pressable>
  );
}
