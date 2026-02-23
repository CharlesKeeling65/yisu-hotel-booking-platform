import { useEffect, useMemo, useState } from "react";
import { Text, View } from "react-native";
import { Calendar, DateData, LocaleConfig } from "react-native-calendars";

import FilterBottomSheet from "@/components/hotel/FilterBottomSheet";

// --- 日历中文本地化配置 ---
LocaleConfig.locales['zh'] = {
  monthNames: ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'],
  monthNamesShort: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
  dayNames: ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'],
  dayNamesShort: ['日', '一', '二', '三', '四', '五', '六'],
  today: '今天'
};
LocaleConfig.defaultLocale = 'zh';
// ------------------------

type Props = {
  visible: boolean;
  title?: string;
  checkInDate: string;
  checkOutDate: string;
  onClose: () => void;
  onConfirm: (next: { checkInDate: string; checkOutDate: string }) => void;
};

const pad = (n: number) => String(n).padStart(2, "0");
const toDateString = (value: Date) => `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;

const buildMarkedDates = (start: string, end: string) => {
  if (!start || !end) return {};
  const marked: Record<string, { color: string; textColor: string; startingDay?: boolean; endingDay?: boolean }> = {};
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return {};
  const cursor = new Date(startDate);
  while (cursor <= endDate) {
    const key = toDateString(cursor);
    marked[key] = { color: "#E6F4FF", textColor: "#1890FF" };
    cursor.setDate(cursor.getDate() + 1);
  }
  marked[start] = { color: "#1890FF", textColor: "#fff", startingDay: true };
  marked[end] = { color: "#1890FF", textColor: "#fff", endingDay: true };
  return marked;
};

/**
 * 可复用日期区间弹窗（底部弹层）
 * - 禁止选择今天之前日期（minDate）
 * - 选择入住后自动进入离店选择阶段
 * - 完成离店选择后自动回传并关闭
 */
export default function DateRangePickerSheet({
  visible,
  title = "选择入住和离店日期",
  checkInDate,
  checkOutDate,
  onClose,
  onConfirm,
}: Props) {
  const todayString = useMemo(() => toDateString(new Date()), []);
  const [stage, setStage] = useState<"checkIn" | "checkOut">("checkIn");
  const [draftCheckIn, setDraftCheckIn] = useState(checkInDate);
  const [draftCheckOut, setDraftCheckOut] = useState(checkOutDate);

  useEffect(() => {
    if (!visible) return;
    const safeCheckIn = checkInDate < todayString ? todayString : checkInDate;
    const safeCheckOut = checkOutDate <= safeCheckIn ? safeCheckIn : checkOutDate;
    setDraftCheckIn(safeCheckIn);
    setDraftCheckOut(safeCheckOut);
    setStage("checkIn");
  }, [visible, checkInDate, checkOutDate, todayString]);

  const markedDates = useMemo(() => buildMarkedDates(draftCheckIn, draftCheckOut), [draftCheckIn, draftCheckOut]);

  return (
    <FilterBottomSheet visible={visible} title={title} onClose={onClose}>
      <View className="pb-2">
        <Text className="pb-1 text-xs text-slate-500">
          {stage === "checkIn" ? "请选择入住日期" : "请选择离店日期"}
        </Text>
        <Calendar
          monthFormat={'yyyy年 MM月'}
          minDate={todayString}
          markingType="period"
          markedDates={markedDates}
          onDayPress={(day: DateData) => {
            if (day.dateString < todayString) return;

            if (stage === "checkIn") {
              setDraftCheckIn(day.dateString);
              setDraftCheckOut(day.dateString);
              setStage("checkOut");
              return;
            }

            if (day.dateString > draftCheckIn) {
              const next = { checkInDate: draftCheckIn, checkOutDate: day.dateString };
              onConfirm(next);
              onClose();
              return;
            }

            setDraftCheckIn(day.dateString);
            setDraftCheckOut(day.dateString);
            setStage("checkOut");
          }}
          theme={{
            todayTextColor: "#1890FF",
            arrowColor: "#1890FF",
            textDayFontWeight: "500",
            textMonthFontWeight: "600",
            textDisabledColor: "#CBD5E1",
          }}
        />
      </View>
    </FilterBottomSheet>
  );
}
