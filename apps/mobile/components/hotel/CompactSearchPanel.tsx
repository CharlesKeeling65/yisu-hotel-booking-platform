/**
 * 列表页搜索面板（紧凑版本）
 * 与 SearchPanel 的区别：
 * - 信息层级更紧凑，适合 sticky header 场景
 * - 保留核心筛选能力（城市/位置/日期/搜索）
 */
import { Pressable, Text, View } from 'react-native'

import GuestCompactBadge from '@/components/hotel/GuestCompactBadge'
import { IconSymbol } from '@/components/ui/icon-symbol'
import { stripCityCountySuffix } from '@/lib/location-utils'

type Props = {
  city: string
  location: string
  checkInDate: string
  checkOutDate: string
  nights: number
  rooms: number
  adults: number
  childCount: number
  onBackPress?: () => void
  onCityPress?: () => void
  onDatePress?: () => void
  onGuestPress?: () => void
  onSearch?: () => void
  onLocationPress?: () => void
  onLocationClearPress?: () => void
  onLocatePress?: () => void
  filterButtons?: {
    key: string
    label: string
    active?: boolean
    count?: number
    onPress: () => void
  }[]
  flat?: boolean
}

const formatMonthDay = (dateString: string) => {
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return dateString
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${month}-${day}`
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

export default function CompactSearchPanel({ city, location, checkInDate, checkOutDate, nights, rooms, adults, childCount, onBackPress, onCityPress, onDatePress, onGuestPress, onSearch, onLocationPress, onLocationClearPress, onLocatePress, filterButtons = [], flat = false }: Props) {
  const cityLabel = stripCityCountySuffix(city)
  return (
    <View className={flat ? '' : 'rounded-2xl border border-slate-100 bg-white p-2.5'}>
      <View className="flex-row items-center rounded-xl border border-slate-100 bg-slate-50 px-3 py-1.5">
        {onBackPress ? (
          <>
            <Pressable className="mr-1.5 py-1 pr-1" onPress={onBackPress}>
              <Text className="text-sm font-semibold text-[#1890FF]">‹ 返回</Text>
            </Pressable>
            <Text className="mr-2 text-xs text-slate-300">|</Text>
          </>
        ) : null}
        <Pressable className="flex-row items-center" onPress={onCityPress}>
          <Text numberOfLines={1} className="max-w-[54px] text-sm font-semibold text-slate-900">
            {cityLabel || city}
          </Text>
          <Text className="ml-1 text-xs text-slate-400">▼</Text>
        </Pressable>
        <Text className="mx-2 text-xs text-slate-300">|</Text>
        <Pressable className="flex-1 py-1.5" onPress={onLocationPress}>
          <Text className={`text-sm ${location ? 'font-medium text-slate-700' : 'text-slate-400'}`}>{location || '位置/商圈/酒店'}</Text>
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

      <View className="mt-2 flex-row items-center gap-2">
        <Pressable className="h-14 flex-[4] rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 justify-center" onPress={onDatePress}>
          <View className="flex-row items-center justify-center">
            <View className="w-[78%]">
              <View className="flex-row items-center">
                <Text className="text-sm font-bold text-slate-900">{formatMonthDay(checkInDate)}</Text>
                <Text className="ml-1 text-xs text-slate-500">{getDateMetaLabel(checkInDate)}</Text>
              </View>
              <View className="mt-1 flex-row items-center">
                <Text className="text-sm font-bold text-slate-900">{formatMonthDay(checkOutDate)}</Text>
                <Text className="ml-1 text-xs text-slate-500">{getDateMetaLabel(checkOutDate)}</Text>
              </View>
            </View>
            <Text className="ml-2 w-[22%] text-center text-sm font-semibold text-[#1890FF]">{nights}晚</Text>
          </View>
        </Pressable>
        <View className="flex-[6] flex-row items-center gap-2">
          <View className="flex-1">
            <GuestCompactBadge rooms={rooms} adults={adults} childCount={childCount} onPress={onGuestPress} />
          </View>
          <Pressable className="h-14 rounded-xl bg-[#1890FF] px-4 items-center justify-center" onPress={onSearch}>
            <IconSymbol name="magnifyingglass" size={21} color="#FFFFFF" weight="bold" />
          </Pressable>
        </View>
      </View>

      {filterButtons.length ? (
        <View className="mt-2 flex-row items-center">
          {filterButtons.map((item, idx) => (
            <View key={item.key} className="flex-1 flex-row items-center">
              {idx > 0 ? <View className="h-3.5 w-px bg-slate-200" /> : null}
              <Pressable onPress={item.onPress} className="min-w-0 flex-1 flex-row items-center justify-center py-1.5">
                <Text numberOfLines={1} className={`text-xs ${item.active ? 'font-semibold text-[#1890FF]' : 'text-slate-600'}`}>
                  {item.label}
                </Text>
                {item.count ? <Text className="ml-1 rounded-full bg-[#1890FF] px-1.5 py-[1px] text-[10px] text-white">{item.count}</Text> : null}
                <Text className="ml-1 text-[10px] text-slate-400">▼</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  )
}
