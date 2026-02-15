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

function StepRow({
  label,
  value,
  min,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  onChange: (next: number) => void;
}) {
  return (
    <View className="mt-3 flex-row items-center justify-between">
      <Text className="text-sm text-slate-700">{label}</Text>
      <View className="flex-row items-center">
        <Pressable
          onPress={() => onChange(Math.max(min, value - 1))}
          className="h-8 w-8 items-center justify-center rounded-full bg-slate-200"
        >
          <Text className="text-base font-semibold text-slate-700">-</Text>
        </Pressable>
        <Text className="mx-3 w-6 text-center text-sm font-semibold text-slate-900">{value}</Text>
        <Pressable
          onPress={() => onChange(value + 1)}
          className="h-8 w-8 items-center justify-center rounded-full bg-[#E6F4FF]"
        >
          <Text className="text-base font-semibold text-[#1890FF]">+</Text>
        </Pressable>
      </View>
    </View>
  );
}

/**
 * 客房与入住人数弹窗（可复用）
 * - 完成：保存
 * - 关闭：不保存
 */
export default function GuestPickerSheet({ visible, initial, onClose, onConfirm }: Props) {
  const [draft, setDraft] = useState<GuestDraft>(initial);

  useEffect(() => {
    if (visible) setDraft(initial);
  }, [visible, initial]);

  return (
    <FilterBottomSheet visible={visible} title="请选择客房和入住人数" onClose={onClose}>
      <StepRow
        label="间数"
        value={draft.rooms}
        min={1}
        onChange={(rooms) => setDraft((x) => ({ ...x, rooms, adults: Math.max(x.adults, rooms) }))}
      />
      <StepRow
        label="成人数"
        value={draft.adults}
        min={draft.rooms}
        onChange={(adults) => setDraft((x) => ({ ...x, adults: Math.max(adults, x.rooms) }))}
      />
      <StepRow
        label="儿童数"
        value={draft.children}
        min={0}
        onChange={(children) => setDraft((x) => ({ ...x, children }))}
      />

      <Pressable
        onPress={() => onConfirm({ ...draft, adults: Math.max(draft.adults, draft.rooms) })}
        className="mt-5 rounded-2xl bg-[#1890FF] py-3"
      >
        <Text className="text-center text-sm font-semibold text-white">完成</Text>
      </Pressable>
    </FilterBottomSheet>
  );
}
