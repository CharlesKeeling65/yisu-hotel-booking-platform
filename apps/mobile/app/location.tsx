import { useEffect, useMemo, useRef, useState } from "react";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { IconSymbol } from "@/components/ui/icon-symbol";

const HOT_CITIES = ["扬州", "上海", "南京", "杭州"];
const HOT_AREAS = ["外滩", "陆家嘴", "西湖", "新街口", "夫子庙", "瘦西湖"];
const HISTORY_ITEMS = ["东关街", "万象城", "近地铁", "亲子房"];
const SUGGESTIONS = [
  { city: "上海", label: "外滩" },
  { city: "上海", label: "陆家嘴" },
  { city: "杭州", label: "西湖" },
  { city: "南京", label: "新街口" },
  { city: "南京", label: "夫子庙" },
  { city: "扬州", label: "瘦西湖" },
  { city: "扬州", label: "东关街" },
];

export default function LocationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { city } = useLocalSearchParams<{ city?: string }>();
  const inputRef = useRef<TextInput>(null);
  const [keyword, setKeyword] = useState("");
  const [historyItems, setHistoryItems] = useState(HISTORY_ITEMS);
  const [locating, setLocating] = useState(false);
  const [errorText, setErrorText] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = () => {
    if (!keyword.trim()) {
      router.back();
      return;
    }
    router.navigate({
      pathname: "/",
      params: { location: keyword.trim(), city: city ?? "扬州" },
    });
  };

  const handleSelect = (selectedCity: string, selectedLocation: string) => {
    router.navigate({
      pathname: "/",
      params: { city: selectedCity, location: selectedLocation },
    });
  };

  const handleLocate = async () => {
    setErrorText("");
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setErrorText("定位权限未开启");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      const info = await Location.reverseGeocodeAsync({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
      const cityName = info[0]?.city ?? city ?? "扬州";
      const address = [info[0]?.district, info[0]?.street, info[0]?.name]
        .filter(Boolean)
        .join("");
      handleSelect(cityName, address || "当前位置");
    } catch (error) {
      setErrorText("定位失败，请重试");
    } finally {
      setLocating(false);
    }
  };

  const suggestions = useMemo(() => {
    if (!keyword.trim()) return [];
    return SUGGESTIONS.filter((item) => item.label.includes(keyword.trim()));
  }, [keyword]);

  return (
    <View className="flex-1 bg-white px-4" style={{ paddingTop: insets.top + 12 }}>
      <View className="flex-row items-center justify-between">
        <Text className="text-lg font-semibold text-slate-900">地点选择 / 定位</Text>
        <Pressable onPress={() => router.back()}>
          <Text className="text-sm text-[#1890FF]">返回</Text>
        </Pressable>
      </View>

      <View className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
        <TextInput
          ref={inputRef}
          value={keyword}
          onChangeText={setKeyword}
          className="text-base text-slate-900"
          placeholder="位置/商圈/酒店"
          placeholderTextColor="#C0C4CC"
          returnKeyType="search"
          autoFocus
          onSubmitEditing={handleSubmit}
        />
      </View>

      <View className="mt-4 flex-row items-center justify-between">
        <Text className="text-sm text-slate-500">定位当前城市</Text>
        <Pressable
          onPress={handleLocate}
          className="h-9 w-9 items-center justify-center rounded-full bg-[#E6F4FF]">
          <IconSymbol size={18} name="location.fill" color="#1890FF" />
        </Pressable>
      </View>
      {errorText ? <Text className="mt-2 text-xs text-red-500">{errorText}</Text> : null}

      {keyword.trim().length > 0 ? (
        <>
          <Text className="mt-6 text-sm text-slate-500">输入联想</Text>
          <View className="mt-3">
            {suggestions.length === 0 ? (
              <Text className="text-xs text-slate-400">暂无匹配结果</Text>
            ) : (
              suggestions.map((item) => (
                <Pressable
                  key={`${item.city}-${item.label}`}
                  onPress={() => handleSelect(item.city, item.label)}
                  className="rounded-2xl border border-slate-100 bg-white px-3 py-3 mt-2">
                  <Text className="text-sm text-slate-700">
                    {item.label}
                    <Text className="text-xs text-slate-400"> · {item.city}</Text>
                  </Text>
                </Pressable>
              ))
            )}
          </View>
        </>
      ) : (
        <>
          <View className="mt-6 flex-row items-center justify-between">
            <Text className="text-sm text-slate-500">历史搜索</Text>
            <Pressable onPress={() => setHistoryItems([])}>
              <Text className="text-xs text-slate-400">清空</Text>
            </Pressable>
          </View>
          <View className="mt-3 flex-row flex-wrap gap-2">
            {historyItems.length === 0 ? (
              <Text className="text-xs text-slate-400">暂无历史记录</Text>
            ) : (
              historyItems.map((item) => (
                <Pressable
                  key={item}
                  onPress={() => handleSelect((city as string) ?? "扬州", item)}
                  className="rounded-full bg-white border border-slate-100 px-3 py-2">
                  <Text className="text-xs text-slate-600">{item}</Text>
                </Pressable>
              ))
            )}
          </View>

          <Text className="mt-6 text-sm text-slate-500">热门城市</Text>
          <View className="mt-3 flex-row flex-wrap gap-2">
            {HOT_CITIES.map((item) => (
              <Pressable
                key={item}
                onPress={() => handleSelect(item, "")}
                className="rounded-full bg-[#F5F7FB] px-3 py-2">
                <Text className="text-xs text-slate-600">{item}</Text>
              </Pressable>
            ))}
          </View>

          <Text className="mt-6 text-sm text-slate-500">热门商圈</Text>
          <View className="mt-3 flex-row flex-wrap gap-2">
            {HOT_AREAS.map((item) => (
              <Pressable
                key={item}
                onPress={() => handleSelect((city as string) ?? "扬州", item)}
                className="rounded-full bg-[#F5F7FB] px-3 py-2">
                <Text className="text-xs text-slate-600">{item}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}
    </View>
  );
}
