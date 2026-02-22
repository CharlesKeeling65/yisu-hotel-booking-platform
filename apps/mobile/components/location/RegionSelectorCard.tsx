import { Pressable, Text, View } from "react-native";

type Props = {
  selectedProvinceName?: string;
  selectedCityName?: string;
  selectedCountyName?: string;
  provinceCode: string;
  cityCode: string;
  onOpenProvince: () => void;
  onOpenCity: () => void;
  onOpenCounty: () => void;
  onConfirmCityOrCounty: () => void;
};

export default function RegionSelectorCard({
  selectedProvinceName,
  selectedCityName,
  selectedCountyName,
  provinceCode,
  cityCode,
  onOpenProvince,
  onOpenCity,
  onOpenCounty,
  onConfirmCityOrCounty,
}: Props) {
  return (
    <View className="mt-3 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3">
      <View className="flex-row items-center justify-between">
        <Text className="text-xs text-slate-500">
          行政区选择（省、市必填，县/区可选）
        </Text>
        <Text className="text-[11px] text-slate-400">手动兜底</Text>
      </View>
      <View className="mt-2 flex-row items-center gap-2">
        <Pressable
          className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2"
          onPress={onOpenProvince}
        >
          <Text
            numberOfLines={1}
            className={`text-sm ${selectedProvinceName ? "text-slate-700" : "text-slate-400"}`}
          >
            {selectedProvinceName || "请选择省"}
          </Text>
        </Pressable>
        <Pressable
          className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2"
          onPress={onOpenCity}
          disabled={!provinceCode}
        >
          <Text
            numberOfLines={1}
            className={`text-sm ${selectedCityName ? "text-slate-700" : "text-slate-400"}`}
          >
            {selectedCityName || "请选择市"}
          </Text>
        </Pressable>
        <Pressable
          className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2"
          onPress={onOpenCounty}
          disabled={!cityCode}
        >
          <Text
            numberOfLines={1}
            className={`text-sm ${selectedCountyName ? "text-slate-700" : "text-slate-400"}`}
          >
            {selectedCountyName || "县/区(可选)"}
          </Text>
        </Pressable>
      </View>
      <View className="mt-3 flex-row items-center gap-3">
        <Pressable
          disabled={!provinceCode || !cityCode}
          className={`flex-1 rounded-xl py-2.5 ${provinceCode && cityCode ? "bg-[#1890FF]" : "bg-slate-200"}`}
          onPress={onConfirmCityOrCounty}
        >
          <Text className="text-center text-sm font-semibold text-white">
            仅返回市/县名
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
