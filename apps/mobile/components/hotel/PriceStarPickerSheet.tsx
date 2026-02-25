import { useEffect, useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import FilterBottomSheet from "@/components/hotel/FilterBottomSheet";

const MAX_PRICE = 800;
const PRICE_PRESETS: { label: string; min: number; max: number }[] = [
  { label: "¥100以下", min: 0, max: 100 },
  { label: "¥100-200", min: 100, max: 200 },
  { label: "¥200-300", min: 200, max: 300 },
  { label: "¥300-500", min: 300, max: 500 },
  { label: "¥500以上", min: 500, max: MAX_PRICE },
];
const STAR_OPTIONS = [
  { key: "2星及以下", desc: "经济" },
  { key: "3星", desc: "舒适" },
  { key: "4星", desc: "高档" },
] as const;

export type PriceStarDraft = {
  min: number;
  max: number;
  stars: string[];
};

type Props = {
  visible: boolean;
  initial: PriceStarDraft;
  onClose: () => void;
  onConfirm: (next: PriceStarDraft) => void;
};

function clampPrice(v: number) {
  if (Number.isNaN(v)) return 0;
  return Math.max(0, Math.min(MAX_PRICE, Math.floor(v)));
}

function formatPriceSummary(min: number, max: number) {
  if (min === 0 && max === MAX_PRICE) return "不限";
  if (max === MAX_PRICE) return `¥${min} - ¥${MAX_PRICE}+`;
  return `¥${min} - ¥${max}`;
}

/**
 * 价格 / 星级弹窗（视觉重构版）
 */
export default function PriceStarPickerSheet({ visible, initial, onClose, onConfirm }: Props) {
  const [draft, setDraft] = useState<PriceStarDraft>(initial);
  const [trackWidth, setTrackWidth] = useState(0);
  const [activeThumb, setActiveThumb] = useState<"min" | "max" | null>(null);

  useEffect(() => {
    if (visible) setDraft(initial);
  }, [visible, initial]);

  const priceSummary = useMemo(() => formatPriceSummary(draft.min, draft.max), [draft.min, draft.max]);
  const rangeLeft = (draft.min / MAX_PRICE) * 100;
  const rangeRight = 100 - (draft.max / MAX_PRICE) * 100;
  const minThumbLeft = trackWidth * (draft.min / MAX_PRICE);
  const maxThumbLeft = trackWidth * (draft.max / MAX_PRICE);

  const valueFromX = (x: number) => {
    if (!trackWidth) return 0;
    const ratio = Math.max(0, Math.min(1, x / trackWidth));
    return Math.round(ratio * MAX_PRICE);
  };

  const updateByThumb = (thumb: "min" | "max", value: number) => {
    const next = clampPrice(value);
    if (thumb === "min") {
      setDraft((x) => ({ ...x, min: Math.min(next, x.max) }));
      return;
    }
    setDraft((x) => ({ ...x, max: Math.max(next, x.min) }));
  };

  return (
    <FilterBottomSheet visible={visible} title="选择价格与星级" onClose={onClose}>
      <View className="px-1">

        {/* === 1. 价格区间模块 === */}
        <View className="py-4 border-b border-slate-50">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-[16px] font-bold text-slate-800">价格区间</Text>
            <Text className="text-[13px] font-bold text-[#1890FF]">{priceSummary}</Text>
          </View>

          {/* 拖动滑块 */}
          <View className="px-2">
            <View
              className="h-8 justify-center"
              onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
              onStartShouldSetResponder={() => true}
              onResponderGrant={(e) => {
                const x = e.nativeEvent.locationX;
                const value = valueFromX(x);
                const nearest = Math.abs(value - draft.min) <= Math.abs(value - draft.max) ? "min" : "max";
                setActiveThumb(nearest);
                updateByThumb(nearest, value);
              }}
              onResponderMove={(e) => {
                if (!activeThumb) return;
                const x = e.nativeEvent.locationX;
                updateByThumb(activeThumb, valueFromX(x));
              }}
              onResponderRelease={() => setActiveThumb(null)}
            >
              <View className="h-1.5 rounded-full bg-slate-100">
                <View
                  className="absolute h-1.5 rounded-full bg-[#1890FF]"
                  style={{ left: `${rangeLeft}%`, right: `${rangeRight}%` }}
                />
              </View>

              <View
                className="absolute -ml-3.5 h-7 w-7 items-center justify-center rounded-full bg-white shadow-sm shadow-slate-300 border border-slate-100"
                style={{ left: minThumbLeft }}
              >
                <View className="h-2.5 w-2.5 rounded-full bg-[#1890FF]" />
              </View>
              <View
                className="absolute -ml-3.5 h-7 w-7 items-center justify-center rounded-full bg-white shadow-sm shadow-slate-300 border border-slate-100"
                style={{ left: maxThumbLeft }}
              >
                <View className="h-2.5 w-2.5 rounded-full bg-[#1890FF]" />
              </View>
            </View>
            <View className="mt-1 flex-row items-center justify-between">
              <Text className="text-[11px] font-medium text-slate-400">¥0</Text>
              <Text className="text-[11px] font-medium text-slate-400">¥800以上</Text>
            </View>
          </View>

          {/* 手动输入与快捷选项 */}
          <View className="mt-5 flex-row items-center">
            <TextInput
              keyboardType="number-pad"
              value={String(draft.min)}
              onChangeText={(v) => {
                const min = clampPrice(Number(v || "0"));
                setDraft((x) => ({ ...x, min: Math.min(min, x.max) }));
              }}

              className="flex-1 min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-center text-[13px] font-bold text-slate-700"
              placeholder="最低价"
            />
            
            <Text className="mx-4 text-slate-300">--</Text>
            
            <TextInput
              keyboardType="number-pad"
              value={String(draft.max)}
              onChangeText={(v) => {
                const max = clampPrice(Number(v || String(MAX_PRICE)));
                setDraft((x) => ({ ...x, max: Math.max(max, x.min) }));
              }}

              className="flex-1 min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-center text-[13px] font-bold text-slate-700"
              placeholder="最高价"
            />
          </View>

          <View className="mt-4 flex-row flex-wrap gap-2">
            {PRICE_PRESETS.map((p) => {
              const active = draft.min === p.min && draft.max === p.max;
              return (
                <Pressable
                  key={p.label}
                  onPress={() => setDraft((x) => ({ ...x, min: p.min, max: p.max }))}
                  className={`rounded-full px-3.5 py-1.5 border ${active ? "border-[#1890FF] bg-[#F0F7FF]" : "border-slate-200 bg-white"
                    }`}
                >
                  <Text className={`text-[12px] font-medium ${active ? "text-[#1890FF]" : "text-slate-600"}`}>
                    {p.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* === 2. 星级模块 (网格重构版) === */}
        <View className="py-5">
          <Text className="mb-4 text-[16px] font-bold text-slate-800">酒店星级</Text>
          <View className="flex-row flex-wrap justify-between">
            {STAR_OPTIONS.map((star) => {
              const active = draft.stars.includes(star.key);
              return (
                <Pressable
                  key={star.key}
                  onPress={() =>
                    setDraft((x) => ({
                      ...x,
                      stars: active ? x.stars.filter((v) => v !== star.key) : [...x.stars, star.key],
                    }))
                  }
                  // w-[31%] 刚好均分三列，流出间隙
                  className={`mb-2 w-[31%] items-center justify-center rounded-xl border py-3 ${active ? "border-[#1890FF] bg-[#F0F7FF]" : "border-slate-200 bg-white"
                    }`}
                >
                  <Text className={`text-[13px] font-bold ${active ? "text-[#1890FF]" : "text-slate-700"}`}>
                    {star.key}
                  </Text>
                  <Text className={`mt-0.5 text-[10px] ${active ? "text-[#1890FF]/70" : "text-slate-400"}`}>
                    {star.desc}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>

      {/* === 3. 底部操作按钮 === */}
      <View className="mt-4 mb-2 flex-row items-center gap-3">
        <Pressable
          onPress={() => setDraft({ min: 0, max: MAX_PRICE, stars: [] })}
          className="flex-1 items-center justify-center rounded-full bg-slate-100 py-3.5 active:bg-slate-200"
        >
          <Text className="text-[16px] font-bold text-slate-600">重置</Text>
        </Pressable>
        <Pressable
          onPress={() => onConfirm(draft)}
          className="flex-[2] items-center justify-center rounded-full bg-[#1890FF] py-3.5 active:bg-[#096DD9]"
        >
          <Text className="text-[16px] font-bold tracking-[1px] text-white">确定</Text>
        </Pressable>
      </View>
    </FilterBottomSheet>
  );
}