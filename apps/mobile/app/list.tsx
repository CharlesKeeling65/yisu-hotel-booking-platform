import { useEffect, useState } from "react";
import { FlatList, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import HotelCard from "@/components/hotel/HotelCard";
import HotelFilters from "@/components/hotel/HotelFilters";
import type { Hotel } from "@yisu/shared";
import { fetchMobileHotels } from "@/lib/api";

export default function ListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { city, location, checkIn, checkOut, rooms, adults, children, priceStar } =
    useLocalSearchParams<{
      city?: string;
      location?: string;
      checkIn?: string;
      checkOut?: string;
      rooms?: string;
      adults?: string;
      children?: string;
      priceStar?: string;
    }>();
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [error, setError] = useState("");

  const nights =
    checkIn && checkOut
      ? Math.max(
          1,
          Math.ceil(
            (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24)
          )
        )
      : 1;

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError("");
    fetchMobileHotels<Hotel>()
      .then((data) => {
        if (!mounted) return;
        setHotels(data);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "加载失败");
        setHotels([]);
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <FlatList
      className="flex-1 bg-neutral-50"
      contentContainerClassName="px-4 pb-24"
      contentContainerStyle={{ paddingTop: insets.top + 12 }}
      data={hotels}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={
        <View className="pt-6 pb-4">
          <View className="rounded-2xl bg-white p-4 shadow-sm">
            <Text className="text-xs uppercase tracking-wide text-neutral-400">搜索条件</Text>
            <Text className="mt-2 text-lg font-semibold text-neutral-900">
              {city ?? "目的地"}
            </Text>
            <Text className="mt-1 text-sm text-neutral-600">{location ?? "选择位置"}</Text>
            <Text className="mt-1 text-sm text-neutral-600">
              {checkIn && checkOut ? `${checkIn} - ${checkOut} · 共${nights}晚` : "选择日期"}
            </Text>
            <Text className="mt-1 text-sm text-neutral-600">
              {rooms && adults
                ? `${rooms}间房 ${adults}成人 ${children ?? "0"}儿童`
                : "选择人数"}
            </Text>
            <Text className="mt-1 text-sm text-neutral-600">
              {priceStar ?? "选择价格/星级"}
            </Text>
          </View>
          <Text className="mt-5 text-2xl font-semibold text-neutral-900">酒店列表</Text>
          {loading ? (
            <Text className="mt-2 text-xs text-neutral-400">加载中...</Text>
          ) : null}
          {error ? (
            <Text className="mt-2 text-xs text-red-400">加载失败：{error}</Text>
          ) : null}
          <View className="mt-4">
            <HotelFilters />
          </View>
        </View>
      }
      renderItem={({ item }) => (
        <HotelCard
          hotel={item}
          onPress={() => router.push({ pathname: "/hotel/[id]", params: { id: item.id } })}
        />
      )}
      onEndReached={() => {
        if (loadingMore) return;
        setLoadingMore(true);
        setTimeout(() => setLoadingMore(false), 800);
      }}
      onEndReachedThreshold={0.4}
      ListEmptyComponent={
        loading ? null : (
          <View className="items-center py-8">
            <Text className="text-xs text-neutral-400">暂无酒店数据</Text>
          </View>
        )
      }
      ListFooterComponent={
        <View className="items-center py-6">
          <Text className="text-xs text-neutral-400">
            {loadingMore ? "Loading more..." : "No more hotels"}
          </Text>
        </View>
      }
    />
  );
}
