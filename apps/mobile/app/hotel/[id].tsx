import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useEffect, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import RoomList from "@/components/hotel/RoomList";
import type { Hotel } from "@yisu/shared";
import { fetchMobileHotelById } from "@/lib/api";

export default function HotelDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    let mounted = true;
    setLoading(true);
    setError("");
    fetchMobileHotelById<Hotel>(id)
      .then((data) => {
        if (!mounted) return;
        setHotel(data);
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
  }, [id]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-neutral-50">
        <Text className="text-base text-neutral-500">Loading...</Text>
      </View>
    );
  }

  if (!hotel) {
    return (
      <View className="flex-1 items-center justify-center bg-neutral-50">
        <Text className="text-base text-neutral-500">
          {error ? `加载失败：${error}` : "Hotel not found."}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-neutral-50" contentContainerClassName="pb-24">
      <View className="relative" style={{ paddingTop: insets.top }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="h-64"
          contentContainerClassName="gap-2 px-4 pt-4">
          {hotel.images.map((image) => (
            <Image
              key={image}
              source={{ uri: image }}
              className="h-60 w-80 rounded-2xl"
              contentFit="cover"
            />
          ))}
        </ScrollView>
        <Pressable
          onPress={() => router.back()}
          className="absolute left-6 rounded-full bg-white/90 px-3 py-2"
          style={{ top: insets.top + 12 }}>
          <Text className="text-xs font-semibold text-neutral-700">Back</Text>
        </Pressable>
      </View>

      <View className="px-4 pt-4">
        <View className="flex-row items-center justify-between">
          <Text className="text-2xl font-semibold text-neutral-900">{hotel.name}</Text>
          <View className="rounded-full bg-amber-100 px-2 py-1">
            <Text className="text-xs font-semibold text-amber-700">{hotel.rating}</Text>
          </View>
        </View>
        <Text className="mt-2 text-sm text-neutral-500">{hotel.city} · {hotel.address}</Text>

        <View className="mt-4 flex-row flex-wrap gap-2">
          {hotel.tags.map((tag) => (
            <View key={tag} className="rounded-full bg-neutral-100 px-3 py-1">
              <Text className="text-xs text-neutral-600">{tag}</Text>
            </View>
          ))}
        </View>

        <View className="mt-6">
          <Text className="text-base font-semibold text-neutral-900">Facilities</Text>
          <View className="mt-3 flex-row flex-wrap gap-2">
            {hotel.facilities.map((facility) => (
              <View key={facility} className="rounded-full bg-white px-3 py-2 shadow-sm">
                <Text className="text-xs text-neutral-600">{facility}</Text>
              </View>
            ))}
          </View>
        </View>

        <View className="mt-6">
          <Text className="text-base font-semibold text-neutral-900">Room Types</Text>
          <View className="mt-4">
            <RoomList rooms={[...hotel.rooms].sort((a, b) => a.price - b.price)} />
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
