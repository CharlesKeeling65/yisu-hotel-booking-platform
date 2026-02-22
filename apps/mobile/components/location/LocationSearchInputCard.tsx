import type { RefObject } from "react";
import { TextInput, type TextInputSubmitEditingEventData, type NativeSyntheticEvent, View } from "react-native";

type Props = {
  inputRef: RefObject<TextInput | null>;
  keyword: string;
  onChangeKeyword: (value: string) => void;
  onSubmit: (e: NativeSyntheticEvent<TextInputSubmitEditingEventData>) => void;
};

export default function LocationSearchInputCard({
  inputRef,
  keyword,
  onChangeKeyword,
  onSubmit,
}: Props) {
  return (
    <View className="mt-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
      <TextInput
        ref={inputRef}
        value={keyword}
        onChangeText={onChangeKeyword}
        className="text-base text-slate-900"
        placeholder="位置/商圈/酒店"
        placeholderTextColor="#C0C4CC"
        returnKeyType="search"
        autoFocus
        onSubmitEditing={onSubmit}
      />
    </View>
  );
}
