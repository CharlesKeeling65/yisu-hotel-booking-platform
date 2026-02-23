/**
 * 列表页搜索面板组件
 */
import { Pressable, Text, View } from 'react-native'
import { Ionicons, Feather } from '@expo/vector-icons'
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

// 格式化为 MM.DD 格式
const formatShortDate = (dateString: string) => {
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return ''
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${month}.${day}`
}

export default function CompactSearchPanel({ 
  city, location, checkInDate, checkOutDate, 
  onBackPress, onCityPress, onDatePress, filterButtons = [] 
}: Props) {
  
  const cityLabel = stripCityCountySuffix(city)

  return (
    <View className="bg-[#EEF3F8]">
      
      {/* 主搜索栏 */}
      <View className="flex-row items-center px-2 pt-2 pb-3">
        {/* 返回按钮 */}
        {onBackPress ? (
          <Pressable className="px-2 py-1" onPress={onBackPress}>
            <Feather name="chevron-left" size={26} color="#1E293B" />
          </Pressable>
        ) : null}

        {/* 搜索信息展示区 */}
        <Pressable 
          className="flex-1 flex-row items-center bg-white rounded-full pl-4 pr-3 py-2 shadow-sm shadow-slate-200/50"
          onPress={onDatePress}
        >
          <Text numberOfLines={1} className="max-w-[56px] text-[15px] font-extrabold text-slate-900">
            {cityLabel || city}
          </Text>

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
            <Feather name="search" size={15} color="#94A3B8" />
            <Text numberOfLines={1} className={`flex-1 ml-1.5 text-[15px] ${location ? 'text-slate-800' : 'text-slate-400'}`}>
              {location || '关键字/位置/酒店名'}
            </Text>
          </View>
        </Pressable>

        {/* 定位按钮 */}
        <Pressable 
          className="ml-2.5 mr-0.5 h-8 w-8 items-center justify-center rounded-full bg-[#E6F4FF]" 
          onPress={onCityPress}
        >
          <Ionicons name="location" size={16} color="#1890FF" />
        </Pressable>
      </View>

      {/* 筛选标签栏 */}
      {filterButtons.length > 0 ? (
        <View className="bg-white rounded-t-[16px] px-3 pt-3 pb-1 flex-row items-center justify-between">
          {filterButtons.map((item) => (
            <Pressable key={item.key} onPress={item.onPress} className="flex-row items-center py-1 px-2">
              <Text className={`text-[12px] ${item.active ? 'font-bold text-[#1890FF]' : 'font-medium text-slate-600'}`}>
                {item.label}
              </Text>
              <View className="ml-0.5 items-center justify-center mt-[1px]">
                <Text className={`text-[8px] ${item.active ? 'text-[#1890FF]' : 'text-slate-400'}`}>▼</Text>
              </View>
              {item.count ? (
                <View className="absolute right-0 top-0 items-center justify-center rounded-full bg-[#FF4D4F] min-w-[14px] h-[14px] px-1 shadow-sm shadow-red-200">
                  <Text className="text-[9px] font-bold text-white leading-none">{item.count}</Text>
                </View>
              ) : null}
            </Pressable>
          ))}
        </View>
      ) : null}

    </View>
  )
}