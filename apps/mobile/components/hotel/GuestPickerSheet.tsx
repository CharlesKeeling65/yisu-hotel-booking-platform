import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";

import FilterBottomSheet from "@/components/hotel/FilterBottomSheet";

export type GuestDraft = {
  rooms: number;
  adults: number;
  children: number;
};

type Props = {
  visible: boolean;
  initial: GuestDraft;
  onClose: () => void;
  onConfirm: (next: GuestDraft) => void;
};

// 经过视觉绝对居中校准的步进器行组件
function StepRow({
  label,
  subtitle,
  value,
  min,
  onChange,
}: {
  label: string;
  subtitle?: string;
  value: number;
  min: number;
  onChange: (next: number) => void;
}) {
  const isAtMin = value <= min;

  return (
    <View className="flex-row items-center justify-between py-3 border-b border-slate-50">
      <View>
        <Text className="text-[16px] font-bold text-slate-800">{label}</Text>
        {subtitle && (
          <Text className="mt-0.5 text-[11px] font-medium text-slate-400">{subtitle}</Text>
        )}
      </View>
      <View className="flex-row items-center">

        <Pressable
          onPress={() => !isAtMin && onChange(value - 1)}
          className={`h-10 w-10 items-center justify-center rounded-full ${
            isAtMin 
              ? "bg-slate-50 opacity-40" 
              : "bg-slate-100 active:bg-slate-200"
          }`}
        >

          <Text 
            className={`text-[24px] font-medium ${isAtMin ? "text-slate-300" : "text-slate-600"}`}
            style={{ 
              includeFontPadding: false, 
              textAlignVertical: 'center',
              marginTop: -3 
            }}
          >
            -
          </Text>
        </Pressable>
        
 
        <Text className="w-12 text-center text-[18px] font-extrabold text-slate-900">
          {value}
        </Text>
        

        <Pressable
          onPress={() => onChange(value + 1)}
          className="h-10 w-10 items-center justify-center rounded-full bg-[#E6F4FF] active:bg-[#D6EFFF]"
        >

          <Text 
            className="text-[24px] font-medium text-[#1890FF]"
            style={{ 
              includeFontPadding: false, 
              textAlignVertical: 'center',
              marginTop: -3 
            }}
          >
            +
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

/**
 * 客房与入住人数弹窗
 */
export default function GuestPickerSheet({ visible, initial, onClose, onConfirm }: Props) {
  const [draft, setDraft] = useState<GuestDraft>(initial);

  useEffect(() => {
    if (visible) setDraft(initial);
  }, [visible, initial]);

  return (
    <FilterBottomSheet visible={visible} title="选择客房和入住人数" onClose={onClose}>
      <View className="px-1">
        <StepRow
          label="房间数"
          value={draft.rooms}
          min={1}
          onChange={(rooms) => setDraft((x) => ({ ...x, rooms, adults: Math.max(x.adults, rooms) }))}
        />
        <StepRow
          label="成人数"
          subtitle="每间客房至少1名成人"
          value={draft.adults}
          min={draft.rooms}
          onChange={(adults) => setDraft((x) => ({ ...x, adults: Math.max(adults, x.rooms) }))}
        />
        <StepRow
          label="儿童数"
          subtitle="17岁及以下"
          value={draft.children}
          min={0}
          onChange={(children) => setDraft((x) => ({ ...x, children }))}
        />
      </View>

      <View className="mt-8 mb-2">
        <Pressable
          onPress={() => onConfirm({ ...draft, adults: Math.max(draft.adults, draft.rooms) })}
          className="items-center justify-center rounded-full bg-[#1890FF] py-3.5 active:bg-[#096DD9]"
        >
          <Text className="text-[16px] font-bold tracking-[1px] text-white">确定</Text>
        </Pressable>
      </View>
    </FilterBottomSheet>
  );
}