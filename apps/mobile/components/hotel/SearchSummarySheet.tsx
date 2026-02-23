/**
 * 列表页：集成式搜索下拉面板 (无缝衔接版 + 圆圈定位标)
 */
import { Modal, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { stripCityCountySuffix } from '@/lib/location-utils';

type Props = {
  visible: boolean;
  city: string;
  location: string;
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  rooms: number;
  adults: number;
  childCount: number;
  onClose: () => void;
  onCityPress: () => void;
  onDatePress: () => void;
  onGuestPress: () => void;
  onConfirm: () => void;
};

const formatShortDate = (dateString: string) => {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "";
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${month}.${day}`;
};

const formatDay = (dateStr: string) => {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getMonth() + 1}月${d.getDate()}日`;
};

const getWeekDay = (dateStr: string) => {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  return ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][d.getDay()];
};

const getMetaPrefix = (dateStr: string) => {
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000);
  return diff === 0 ? "今天" : diff === 1 ? "明天" : diff === 2 ? "后天" : "";
};

export default function SearchSummarySheet(props: Props) {
  const {
    visible, city, location, checkInDate, checkOutDate, nights, rooms, adults, childCount,
    onClose, onCityPress, onDatePress, onGuestPress, onConfirm
  } = props;
  
  const insets = useSafeAreaInsets();
  const cityLabel = stripCityCountySuffix(city);

  return (
    <Modal transparent visible={visible} animationType="fade">
      <View className="flex-1">
        
        {/* === 1. 假头部 === */}
        <View className="bg-[#EEF3F8]" style={{ paddingTop: insets.top }}>
          <View className="flex-row items-center px-2 pt-2 pb-3">
            <Pressable className="px-2 py-1" onPress={onClose}>
              <Text className="text-[26px] font-light text-slate-800 leading-none mt-[-2px]">‹</Text>
            </Pressable>
            
            <Pressable 
              className="flex-1 flex-row items-center bg-white rounded-full pl-4 pr-3 py-2 shadow-sm shadow-slate-200/50"
              onPress={onClose}
            >
              <Text numberOfLines={1} className="max-w-[56px] text-[15px] font-extrabold text-slate-900">{cityLabel}</Text>
              
              <View className="mx-2 h-7 w-[1px] bg-slate-100" />
              
              <View className="justify-center mr-1">
                <View className="flex-row items-center">
                  <Text className="text-[10px] text-slate-400 font-medium">住</Text>
                  <Text className="ml-1 text-[12px] font-bold text-[#1890FF]">{formatShortDate(checkInDate)}</Text>
                </View>
                <View className="flex-row items-center mt-[2px]">
                  <Text className="text-[10px] text-slate-400 font-medium">离</Text>
                  <Text className="ml-1 text-[12px] font-bold text-[#1890FF]">{formatShortDate(checkOutDate)}</Text>
                </View>
              </View>

              <View className="flex-1 ml-2 flex-row items-center pr-1">
                <IconSymbol name="magnifyingglass" size={15} color="#94A3B8" />
                <Text numberOfLines={1} className={`flex-1 ml-1.5 text-[15px] ${location ? 'text-slate-800' : 'text-slate-400'}`}>
                  {location || '关键字/位置/酒店名'}
                </Text>
              </View>
            </Pressable>

            {/* 👉 核心修改：右侧定位图标 (与 CompactSearchPanel 保持一致的带背景圆圈) */}
            <Pressable 
              className="ml-2.5 mr-0.5 h-8 w-8 items-center justify-center rounded-full bg-[#E6F4FF]" 
              onPress={() => {
                onClose();
                onCityPress();
              }}
            >
              <IconSymbol name="location.fill" size={16} color="#1890FF" />
            </Pressable>

          </View>
        </View>

        {/* === 2. 白底的下拉内容区 === */}
        <View className="bg-white rounded-b-3xl px-5 pb-6 pt-1 z-10 shadow-md shadow-slate-300">
          <Pressable className="flex-row items-center justify-between py-4 border-b border-slate-100" onPress={onCityPress}>
            <Text className="text-[18px] font-extrabold text-slate-900">{city}</Text>
            <Text className="text-[18px] font-light text-slate-300">›</Text>
          </Pressable>

          <Pressable className="flex-row items-center py-4 border-b border-slate-100" onPress={onDatePress}>
            <View className="flex-[4]">
              <Text className="mb-1 text-[12px] font-medium text-slate-500">{getMetaPrefix(checkInDate)}入住</Text>
              <View className="flex-row items-baseline">
                <Text className="text-[20px] font-extrabold text-slate-900">{formatDay(checkInDate)}</Text>
                <Text className="ml-1.5 text-[13px] font-medium text-slate-700">{getWeekDay(checkInDate)}</Text>
              </View>
            </View>
            <View className="flex-[4]">
              <Text className="mb-1 text-[12px] font-medium text-slate-500">{getMetaPrefix(checkOutDate)}离店</Text>
              <View className="flex-row items-baseline">
                <Text className="text-[20px] font-extrabold text-slate-900">{formatDay(checkOutDate)}</Text>
                <Text className="ml-1.5 text-[13px] font-medium text-slate-700">{getWeekDay(checkOutDate)}</Text>
              </View>
            </View>
            <View className="flex-[3] flex-row items-center justify-end">
              <Text className="text-[14px] font-medium text-slate-600">共 {nights} 晚</Text>
              <Text className="ml-2 text-[18px] font-light text-slate-300">›</Text>
            </View>
          </Pressable>

          <Pressable className="flex-row items-center justify-between py-4" onPress={onGuestPress}>
            <Text className="text-[16px] font-bold text-slate-800">{rooms}间·{adults}成人·{childCount}儿童</Text>
            <Text className="text-[18px] font-light text-slate-300">›</Text>
          </Pressable>

          <View className="mt-5 mb-1">
            <Pressable onPress={onConfirm} className="items-center justify-center rounded-full bg-[#1890FF] py-3.5 active:bg-[#096DD9]">
              <Text className="text-[17px] font-bold tracking-[2px] text-white">完成</Text>
            </Pressable>
          </View>
        </View>

        {/* === 3. 黑底遮罩区 === */}
        <Pressable className="flex-1 bg-black/40" onPress={onClose} />
      </View>
    </Modal>
  );
}