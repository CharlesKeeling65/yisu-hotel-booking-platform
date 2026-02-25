import { Pressable, Text, View } from "react-native";

import { IconSymbol } from "@/components/ui/icon-symbol";

type Props = {
  locating: boolean;
  errorText?: string;
  locatedCity: string;
  locatedDetail: string;
  onLocate: () => void;
  onSelectCity: () => void;
  onSelectStreet: () => void;
};

export default function LocateQuickCard({
  locating,
  errorText,
  locatedCity,
  locatedDetail,
  onLocate,
  onSelectCity,
  onSelectStreet,
}: Props) {
  return (
    <View>
      <View className="mt-3 rounded-3xl border border-[#DCEBFB] bg-[#F4FAFF] px-4 py-4">
        <View className="flex-row items-start justify-between">
          <View className="flex-1 pr-3">
            <Text className="text-base font-semibold text-slate-900">
              使用当前位置
            </Text>
            <Text className="mt-1 text-xs leading-5 text-slate-500">
              一键定位当前城市，若定位不可用，可使用下方输入检索或行政区选择
            </Text>
          </View>
          <Pressable
            disabled={locating}
            onPress={onLocate}
            className={`h-11 w-11 items-center justify-center rounded-2xl ${locating ? "bg-[#D7E9FB]" : "bg-[#E6F4FF]"}`}
          >
            <IconSymbol size={19} name="location.fill" color="#1890FF" />
          </Pressable>
        </View>

        <View className="mt-3">
          {locating ? (
            <View className="rounded-2xl border border-[#D8E8FA] bg-white px-3 py-3">
              <Text className="text-sm font-medium text-slate-700">
                正在定位并解析地址...
              </Text>
            </View>
          ) : locatedCity ? (
            <View className="gap-2">
              <Pressable
                onPress={onSelectCity}
                className="rounded-2xl border border-[#D8E8FA] bg-white px-3 py-3"
              >
                <Text className="text-xs text-slate-400">当前城市</Text>
                <Text className="mt-1 text-sm font-semibold text-slate-800">
                  {locatedCity}
                </Text>
              </Pressable>
              {locatedDetail ? (
                <Pressable
                  onPress={onSelectStreet}
                  className="rounded-2xl border border-[#D8E8FA] bg-white px-3 py-3"
                >
                  <Text className="text-xs text-slate-400">街道/位置</Text>
                  <Text className="mt-1 text-sm text-slate-700">
                    {locatedCity} {locatedDetail}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : (
            <View className="rounded-2xl border border-dashed border-[#D8E8FA] bg-white px-3 py-3">
              <Text className="text-sm text-slate-500">
                暂未获取到定位结果，可点击右上角按钮重试
              </Text>
            </View>
          )}
        </View>
      </View>

      {errorText ? <Text className="mt-2 text-xs text-red-500">{errorText}</Text> : null}
    </View>
  );
}
