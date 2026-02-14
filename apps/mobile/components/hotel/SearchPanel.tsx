/**
 * 首页搜索面板（完整版本）
 * 职责：
 * - 承载酒店搜索的主要输入项
 * - 通过 props 回调把交互事件上抛给页面容器处理
 */
import { IconSymbol } from '@/components/ui/icon-symbol'
import { Pressable, ScrollView, Text, View } from 'react-native'

type Props = {
  city: string
  location: string
  checkInDate: string
  checkOutDate: string
  nights: number
  rooms: number
  adults: number
  childCount: number
  starLabel: string
  onCityPress?: () => void
  onLocationPress?: () => void
  onLocationClearPress?: () => void
  onLocatePress?: () => void
  onDatePress?: () => void
  onGuestPress?: () => void
  onStarPress?: () => void
  onStarClearPress?: () => void
  onSearch?: () => void
  quickTags?: string[]
  onTagPress?: (tag: string) => void
}

const formatMonthDay = (dateString: string) => {
  // UI 只显示“月/日”，避免输入区信息密度过高
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return dateString
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${month}月${day}日`
}

const getDateMetaLabel = (dateString: string) => {
  const target = new Date(dateString)
  if (Number.isNaN(target.getTime())) return ''
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  target.setHours(0, 0, 0, 0)
  const diff = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (diff === 0) return '今天'
  if (diff === 1) return '明天'
  if (diff === 2) return '后天'
  const week = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return week[target.getDay()]
}

export default function SearchPanel(props: Props) {
  const { city, location, checkInDate, checkOutDate, nights, rooms, adults, childCount, starLabel, onCityPress, onLocationPress, onLocationClearPress, onLocatePress, onDatePress, onGuestPress, onStarPress, onStarClearPress, onSearch, quickTags = [], onTagPress } = props

  const guestSummary = `${rooms}间房 ${adults}成人 ${childCount}儿童`

  return (
    <View className="rounded-3xl border border-slate-100 bg-white p-4 shadow-lg">
      <View className="flex-row items-center rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2">
        <Pressable className="shrink-0 flex-row items-center justify-center pr-2" onPress={onCityPress}>
          <Text className="text-center text-[15px] font-semibold text-slate-900">{city}</Text>
          <Text className="ml-1 text-xs text-slate-400">▼</Text>
        </Pressable>
        <Text className="mx-2 text-xs text-slate-300">|</Text>
        <Pressable className="min-w-0 flex-1 py-2" onPress={onLocationPress}>
          <Text numberOfLines={1} className={`text-left text-[15px] ${location ? 'font-medium text-slate-700' : 'text-slate-400'}`}>
            {location || '位置/商圈/酒店'}
          </Text>
        </Pressable>
        {location ? (
          <Pressable onPress={onLocationClearPress} className="ml-2 h-7 w-7 items-center justify-center rounded-full bg-slate-200">
            <Text className="text-xs text-slate-500">×</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={onLocatePress} className="ml-2 h-9 w-9 items-center justify-center rounded-full bg-[#E6F4FF]">
          <IconSymbol size={18} name="location.fill" color="#1890FF" />
        </Pressable>
      </View>

      <Pressable className="mt-3 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3" onPress={onDatePress}>
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-[11px] uppercase text-slate-400">入住日期</Text>
            <View className="mt-1.5 flex-row items-center">
              <Text className="text-[15px] font-semibold text-slate-900">{formatMonthDay(checkInDate)}</Text>
              <Text className="ml-1 text-xs text-slate-500">{getDateMetaLabel(checkInDate)}</Text>
              <Text className="mx-2 text-[12px] font-medium text-slate-400">-</Text>
              <Text className="text-[15px] font-semibold text-slate-900">{formatMonthDay(checkOutDate)}</Text>
              <Text className="ml-1 text-xs text-slate-500">{getDateMetaLabel(checkOutDate)}</Text>
            </View>
          </View>
          <Text className="mr-1 text-xs font-semibold text-[#1890FF]">共{nights}晚</Text>
        </View>
      </Pressable>

      <View className="mt-3 flex-row items-center rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2">
        <Pressable className="shrink-0 flex-row items-center justify-center pr-2" onPress={onGuestPress}>
          <Text className="text-center text-[15px] font-semibold text-slate-900">{guestSummary}</Text>
          <Text className="ml-1 text-xs text-slate-400">▼</Text>
        </Pressable>
        <Text className="mx-2 text-xs text-slate-300">|</Text>
        <Pressable className="min-w-0 flex-1 py-2" onPress={onStarPress}>
          <Text numberOfLines={1} className={`text-left text-[14px] ${starLabel ? 'text-slate-700' : 'text-slate-400'}`}>
            {starLabel || '价格/星级'}
          </Text>
        </Pressable>
        {starLabel && starLabel !== '价格/星级' ? (
          <Pressable onPress={onStarClearPress} className="ml-2 h-7 w-7 items-center justify-center rounded-full bg-slate-200">
            <Text className="text-xs text-slate-500">×</Text>
          </Pressable>
        ) : null}
      </View>

      {quickTags.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mt-3"
          contentContainerStyle={{ paddingRight: 4 }}
        >
          <View className="flex-row items-center">
            {quickTags.map((tag) => {
              return (
                <Pressable
                  key={tag}
                  className="mr-2 rounded-full bg-[#F5F7FB] px-3 py-2"
                  onPress={() => onTagPress?.(tag)}
                >
                  <Text className="text-xs text-slate-600">{tag}</Text>
                </Pressable>
              )
            })}
          </View>
        </ScrollView>
      ) : null}

      <View className="mt-4 flex-row items-center justify-center">
        <Pressable className="rounded-xl bg-[#1890FF] px-7 py-3 w-full" onPress={onSearch}>
          <Text className="text-center text-[15px] font-semibold text-white">查询</Text>
        </Pressable>
      </View>
    </View>
  )
}
