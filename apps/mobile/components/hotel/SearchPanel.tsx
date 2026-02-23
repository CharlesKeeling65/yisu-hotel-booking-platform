
import { IconSymbol } from '@/components/ui/icon-symbol'
import { Pressable, ScrollView, Text, View } from 'react-native'
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
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return dateString
  const month = date.getMonth() + 1
  const day = date.getDate()
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

  const guestSummary = `${rooms}间 ${adults}成人 ${childCount ? childCount + '儿童' : ''}`
  const cityLabel = stripCityCountySuffix(city)

  return (
    <View className="rounded-[20px] bg-white px-5 py-5 shadow-sm shadow-slate-200/50">
      
      {/* 1. 目的地与搜索栏 */}
      <View className="flex-row items-center border-b border-slate-100 pb-3.5">
        <Pressable className="flex-row items-center pr-3" onPress={onCityPress}>
          <Text className="text-[18px] font-bold text-slate-900">{cityLabel || city}</Text>
          <Text className="ml-1 text-[10px] text-slate-400">▼</Text>
        </Pressable>
        
        <View className="mx-2 h-3.5 w-[1px] bg-slate-200" />
        
        <Pressable className="min-w-0 flex-1 flex-row items-center pl-2" onPress={onLocationPress}>
          <Text numberOfLines={1} className={`flex-1 text-[14px] ${location ? 'font-medium text-slate-800' : 'text-slate-400'}`}>
            {location || '位置/商圈/酒店名'}
          </Text>
          {location ? (
            <Pressable onPress={onLocationClearPress} className="ml-2 h-4 w-4 items-center justify-center rounded-full bg-slate-200/80">
              <Text className="text-[9px] font-bold text-slate-500">×</Text>
            </Pressable>
          ) : null}
        </Pressable>

        <Pressable onPress={onLocatePress} className="ml-2 flex-row items-center justify-center rounded-full bg-[#F0F7FF] px-2 py-1.5">
          <IconSymbol size={15} name="location.fill" color="#1890FF" />
        </Pressable>
      </View>

      {/* 2. 日期选择 */}
      <Pressable className="flex-row items-center justify-between border-b border-slate-100 py-3.5" onPress={onDatePress}>
        {/* 左侧：入住 */}
        <View className="flex-1">
          <Text className="mb-0.5 text-[10px] text-slate-400">入住日期</Text>
          <View className="flex-row items-baseline gap-1.5">
            <Text className="text-[18px] font-bold text-slate-900">{formatMonthDay(checkInDate)}</Text>
            <Text className="text-[11px] font-medium text-slate-500">{getDateMetaLabel(checkInDate)}</Text>
          </View>
        </View>

        {/* 中间：晚数胶囊 */}
        <View className="px-2">
          <View className="items-center justify-center rounded-full border border-slate-200/60 bg-slate-50 px-2.5 py-0.5">
            <Text className="text-[10px] font-medium text-slate-500">共 {nights} 晚</Text>
          </View>
        </View>

        {/* 右侧：离店 */}
        <View className="flex-1 items-end">
          <Text className="mb-0.5 text-[10px] text-slate-400">离店日期</Text>
          <View className="flex-row items-baseline gap-1.5">
            <Text className="text-[11px] font-medium text-slate-500">{getDateMetaLabel(checkOutDate)}</Text>
            <Text className="text-[18px] font-bold text-slate-900">{formatMonthDay(checkOutDate)}</Text>
          </View>
        </View>
      </Pressable>

      {/* 3. 人数与星级价格 */}
      <View className="flex-row items-center border-b border-slate-50 py-3.5">
        <Pressable className="flex-1 flex-row items-center justify-between pr-3" onPress={onGuestPress}>
          <View>
            <Text className="mb-0.5 text-[10px] text-slate-400">住客与房型</Text>
            <Text className="text-[15px] font-bold text-slate-900">{guestSummary}</Text>
          </View>
          <Text className="text-[10px] text-slate-300">▼</Text>
        </Pressable>

        <View className="h-6 w-[1px] bg-slate-100" />

        <Pressable className="flex-1 flex-row items-center justify-between pl-4" onPress={onStarPress}>
          <View className="flex-1 pr-2">
            <Text className="mb-0.5 text-[10px] text-slate-400">价格/星级</Text>
            <Text numberOfLines={1} className={`text-[15px] font-bold ${starLabel && starLabel !== '价格/星级' ? 'text-[#1890FF]' : 'text-slate-900'}`}>
              {starLabel || '不限'}
            </Text>
          </View>
          {starLabel && starLabel !== '价格/星级' ? (
            <Pressable onPress={onStarClearPress} className="h-4 w-4 items-center justify-center rounded-full bg-slate-200/80">
              <Text className="text-[9px] font-bold text-slate-500">×</Text>
            </Pressable>
          ) : (
             <Text className="text-[10px] text-slate-300">▼</Text>
          )}
        </Pressable>
      </View>

      {/* 4. 快捷标签 */}
      {quickTags.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mt-2"
          contentContainerStyle={{ paddingRight: 4, paddingBottom: 4 }}
        >
          <View className="flex-row items-center">
            {quickTags.map((tag) => (
              <Pressable
                key={tag}
                className="mr-2 rounded bg-slate-50 px-2.5 py-1"
                onPress={() => onTagPress?.(tag)}
              >
                <Text className="text-[11px] text-slate-500">{tag}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      ) : null}

      {/* 5. 核心查询按钮 */}
      <View className="mt-4">
        <Pressable 
          className="items-center justify-center rounded-full bg-[#1890FF] py-3 active:bg-[#096DD9]" 
          onPress={onSearch}
        >
          <Text className="text-[16px] font-bold tracking-[1px] text-white">搜索酒店</Text>
        </Pressable>
      </View>
    </View>
  )
}