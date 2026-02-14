/**
 * 首页（酒店搜索入口）
 * 关键功能：
 * 1) 顶部 Banner 轮播（自动 + 手势）
 * 2) 酒店搜索面板（城市、位置、日期、人数、星级）
 * 3) 快捷标签（点击即触发搜索）
 * 4) 日历与星级选择弹层
 *
 * 阅读顺序建议：
 * - 先看 state 定义（页面有哪些“可变数据”）
 * - 再看 useEffect（页面如何初始化和联动）
 * - 最后看 runSearch（如何把筛选条件带去列表页）
 */
import { Image } from 'expo-image'
import * as Location from 'expo-location'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { Modal, Pressable, ScrollView, Text, View } from 'react-native'
import { Calendar, DateData } from 'react-native-calendars'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import SearchPanel from '@/components/hotel/SearchPanel'
import MeasuredPagingCarousel from '@/components/ui/measured-paging-carousel'
import { fetchMobileHomeBanners } from '@/lib/api'

const QUICK_TAGS = ['亲子友好', '豪华酒店', '免费停车', '近地铁', '含早餐', '江景海景']
const PRICE_STAR_OPTIONS = ['不限星级', '3星', '4星', '5星']

const diffNights = (start: string, end: string) => {
  // 计算入住到离店之间的晚数，最少为 1 晚，避免 UI 出现 0 晚
  const startTime = new Date(start).getTime()
  const endTime = new Date(end).getTime()
  if (Number.isNaN(startTime) || Number.isNaN(endTime)) return 1
  return Math.max(1, Math.ceil((endTime - startTime) / (1000 * 60 * 60 * 24)))
}

const buildMarkedDates = (start: string, end: string) => {
  // 生成日历组件需要的“区间高亮”数据结构（react-native-calendars）
  if (!start || !end) return {}
  const marked: Record<string, { color: string; textColor: string; startingDay?: boolean; endingDay?: boolean }> = {}
  const startDate = new Date(start)
  const endDate = new Date(end)
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return {}
  const cursor = new Date(startDate)
  while (cursor <= endDate) {
    const key = cursor.toISOString().slice(0, 10)
    marked[key] = { color: '#E6F4FF', textColor: '#1890FF' }
    cursor.setDate(cursor.getDate() + 1)
  }
  marked[start] = { color: '#1890FF', textColor: '#fff', startingDay: true }
  marked[end] = { color: '#1890FF', textColor: '#fff', endingDay: true }
  return marked
}

const toDateString = (value: Date) => value.toISOString().slice(0, 10)

type HomeBanner = {
  id: string
  hotelId: string
  title: string
  subtitle: string
  image: string
}

export default function HomeScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()

  const { location: locationParam, city: cityParam } = useLocalSearchParams<{ location?: string; city?: string }>()

  const [city, setCity] = useState('上海市')
  const [location, setLocation] = useState('')
  const [checkInDate, setCheckInDate] = useState('2026-02-12')
  const [checkOutDate, setCheckOutDate] = useState('2026-02-13')
  const [rooms, setRooms] = useState(1)
  const [adults, setAdults] = useState(2)
  const [children, setChildren] = useState(0)
  const [priceStar, setPriceStar] = useState('不限星级')
  const [selectedTags, setSelectedTags] = useState<string[]>([])

  const [banners, setBanners] = useState<HomeBanner[]>([{ id: 'fallback', hotelId: '', title: '易宿精选酒店', subtitle: '品质酒店限时优惠', image: 'https://picsum.photos/seed/home_banner/1400/700' }])

  const [isCalendarOpen, setIsCalendarOpen] = useState(false)
  const [isStarOpen, setIsStarOpen] = useState(false)
  const [selectStage, setSelectStage] = useState<'checkIn' | 'checkOut'>('checkIn')
  const [locating, setLocating] = useState(false)

  const nights = diffNights(checkInDate, checkOutDate)
  const markedDates = useMemo(() => buildMarkedDates(checkInDate, checkOutDate), [checkInDate, checkOutDate])

  useEffect(() => {
    // 首次加载轮播数据；失败时保留 fallback banner，不阻断页面渲染
    fetchMobileHomeBanners<HomeBanner>()
      .then(list => {
        if (list?.length) setBanners(list)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (typeof locationParam === 'string') setLocation(locationParam)
  }, [locationParam])

  useEffect(() => {
    if (typeof cityParam === 'string') setCity(cityParam)
  }, [cityParam])

  const openCalendar = () => {
    // 打开日历时，默认重置到“今天-明天”，让选择路径更明确
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(today.getDate() + 1)
    setCheckInDate(toDateString(today))
    setCheckOutDate(toDateString(tomorrow))
    setSelectStage('checkIn')
    setIsCalendarOpen(true)
  }

  const handleLocate = async () => {
    // 位置按钮：申请权限 -> 获取经纬度 -> 逆地理编码 -> 回填城市与位置
    if (locating) return
    setLocating(true)
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') return
      const pos = await Location.getCurrentPositionAsync({})
      const info = await Location.reverseGeocodeAsync({ latitude: pos.coords.latitude, longitude: pos.coords.longitude })
      const cityName = info[0]?.city ?? '上海市'
      const address = [info[0]?.district, info[0]?.street, info[0]?.name].filter(Boolean).join('')
      setCity(cityName)
      setLocation(address || '当前位置')
    } finally {
      setLocating(false)
    }
  }

  function runSearch(extraTags?: string[]) {
    // 将当前筛选状态序列化为路由参数，跳转到列表页
    router.push({
      pathname: '/list',
      params: {
        city,
        location,
        keyword: location,
        checkIn: checkInDate,
        checkOut: checkOutDate,
        rooms: String(rooms),
        adults: String(adults),
        children: String(children),
        priceStar,
        tags: (extraTags || selectedTags).join(',')
      }
    })
  }

  return (
    <ScrollView className="flex-1 bg-[#F5F8FC]" contentContainerClassName="px-4 pb-24" style={{ paddingTop: insets.top + 8 }}>
      <MeasuredPagingCarousel
        data={banners}
        autoPlayMs={4800}
        slideHeight={192}
        containerClassName="overflow-hidden rounded-3xl bg-slate-200"
        keyExtractor={(banner) => banner.id}
        renderSlide={(banner, _idx, width) => (
          <Pressable
            style={{ width, height: 192 }}
            onPress={() => {
              if (banner.hotelId) router.push({ pathname: '/hotel/[id]', params: { id: banner.hotelId } })
            }}>
            <Image source={{ uri: banner.image }} style={{ width, height: 192 }} contentFit="cover" />
            <View className="absolute inset-0 bg-black/25" />
            <View className="absolute left-4 right-4 top-4">
              <Text className="text-lg font-semibold text-white">{banner.title}</Text>
              <Text className="mt-1 text-sm text-white/90">{banner.subtitle}</Text>
            </View>
          </Pressable>
        )}
      />

      <View className="mt-4">
        <SearchPanel
          city={city}
          location={location}
          checkInDate={checkInDate}
          checkOutDate={checkOutDate}
          nights={nights}
          rooms={rooms}
          adults={adults}
          childCount={children}
          starLabel={priceStar}
          onCityPress={() => router.push({ pathname: '/location', params: { city } })}
          onLocationPress={() => router.push({ pathname: '/location', params: { city, location } })}
          onLocatePress={() => handleLocate()}
          onDatePress={openCalendar}
          onStarPress={() => setIsStarOpen(true)}
          onStepRooms={delta => setRooms(x => Math.max(1, x + delta))}
          onStepAdults={delta => setAdults(x => Math.max(1, x + delta))}
          onStepChildren={delta => setChildren(x => Math.max(0, x + delta))}
          onSearch={() => runSearch()}
        />
      </View>

      <View className="mt-4 rounded-2xl border border-slate-100 bg-white p-4">
        <Text className="text-sm font-semibold text-slate-800">快捷标签</Text>
        <View className="mt-3 flex-row flex-wrap gap-2">
          {QUICK_TAGS.map(tag => {
            const active = selectedTags.includes(tag)
            return (
              <Pressable
                key={tag}
                className={`rounded-full px-3 py-2 ${active ? 'bg-[#DDF5ED]' : 'bg-[#F5F7FB]'}`}
                onPress={() => {
                  const next = active ? selectedTags.filter(x => x !== tag) : [...selectedTags, tag]
                  setSelectedTags(next)
                  runSearch(next)
                }}>
                <Text className="text-xs text-slate-600">{tag}</Text>
              </Pressable>
            )
          })}
        </View>
      </View>

      <Modal transparent visible={isCalendarOpen} animationType="fade">
        <View className="flex-1 items-center justify-center bg-black/40 px-4">
          <View className="w-full rounded-3xl bg-white p-4">
            <View className="flex-row items-center justify-between pb-2">
              <Text className="text-base font-semibold text-slate-900">选择入住和离店日期</Text>
              <Pressable onPress={() => setIsCalendarOpen(false)}>
                <Text className="text-sm text-slate-400">关闭</Text>
              </Pressable>
            </View>
            <Calendar
              markingType="period"
              markedDates={markedDates}
              onDayPress={(day: DateData) => {
                if (selectStage === 'checkIn') {
                  setCheckInDate(day.dateString)
                  setCheckOutDate(day.dateString)
                  setSelectStage('checkOut')
                  return
                }
                if (day.dateString > checkInDate) {
                  setCheckOutDate(day.dateString)
                  setSelectStage('checkIn')
                  setIsCalendarOpen(false)
                  return
                }
                setCheckInDate(day.dateString)
                setCheckOutDate(day.dateString)
              }}
              theme={{ todayTextColor: '#1890FF', arrowColor: '#1890FF', textDayFontWeight: '500', textMonthFontWeight: '600' }}
            />
          </View>
        </View>
      </Modal>

      <Modal transparent visible={isStarOpen} animationType="fade">
        <View className="flex-1 items-center justify-center bg-black/40 px-6">
          <View className="w-full rounded-3xl bg-white p-4">
            <View className="flex-row items-center justify-between pb-2">
              <Text className="text-base font-semibold text-slate-900">选择星级</Text>
              <Pressable onPress={() => setIsStarOpen(false)}>
                <Text className="text-sm text-slate-400">关闭</Text>
              </Pressable>
            </View>
            {PRICE_STAR_OPTIONS.map(option => (
              <Pressable
                key={option}
                onPress={() => {
                  setPriceStar(option)
                  setIsStarOpen(false)
                }}
                className="mt-2 rounded-2xl border border-slate-100 px-3 py-3">
                <Text className="text-sm text-slate-700">{option}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>
    </ScrollView>
  )
}
