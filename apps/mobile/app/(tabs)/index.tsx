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
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import DateRangePickerSheet from '@/components/hotel/DateRangePickerSheet'
import GuestPickerSheet, { GuestDraft } from '@/components/hotel/GuestPickerSheet'
import PriceStarPickerSheet, { PriceStarDraft } from '@/components/hotel/PriceStarPickerSheet'
import SearchPanel from '@/components/hotel/SearchPanel'
import MeasuredPagingCarousel from '@/components/ui/measured-paging-carousel'
import { fetchMobileHomeBanners } from '@/lib/api'
import { getDefaultSearchSession, getSearchSession, setSearchSession } from '@/lib/search-session'

const QUICK_TAGS = ['亲子友好', '豪华酒店', '免费停车', '近地铁', '含早餐', '江景海景']
const DEFAULT_PRICE_STAR_FILTER: PriceStarDraft = { min: 0, max: 800, stars: [] }

const diffNights = (start: string, end: string) => {
  // 计算入住到离店之间的晚数，最少为 1 晚，避免 UI 出现 0 晚
  const startTime = new Date(start).getTime()
  const endTime = new Date(end).getTime()
  if (Number.isNaN(startTime) || Number.isNaN(endTime)) return 1
  return Math.max(1, Math.ceil((endTime - startTime) / (1000 * 60 * 60 * 24)))
}

function toPriceStarLabel(filter: PriceStarDraft) {
  const pricePart = filter.min === 0 && filter.max === 800 ? '' : filter.max === 800 ? `¥${filter.min}-¥800+` : `¥${filter.min}-¥${filter.max}`
  const starPart = filter.stars.join('、')
  const merged = [pricePart, starPart].filter(Boolean).join(', ')
  return merged || '价格/星级'
}

function parsePriceStarLabel(label: string): PriceStarDraft {
  const text = String(label || '')
  const stars: string[] = []
  if (text.includes('2星及以下')) stars.push('2星及以下')
  if (text.includes('3星')) stars.push('3星')
  if (text.includes('4星')) stars.push('4星')
  const range = text.match(/¥(\d+)-¥(\d+)\+?/)
  if (range?.[1] && range?.[2]) return { min: Number(range[1]), max: Number(range[2]), stars }
  return { ...DEFAULT_PRICE_STAR_FILTER, stars }
}

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
  const defaultSession = getDefaultSearchSession()
  const initSession = getSearchSession()

  const { location: locationParam, city: cityParam } = useLocalSearchParams<{ location?: string; city?: string }>()

  const [city, setCity] = useState(initSession.city || '上海市')
  const [location, setLocation] = useState(initSession.location || '')
  const [checkInDate, setCheckInDate] = useState(initSession.checkIn || defaultSession.checkIn)
  const [checkOutDate, setCheckOutDate] = useState(initSession.checkOut || defaultSession.checkOut)
  const [rooms, setRooms] = useState(Math.max(1, Number(initSession.rooms || 1)))
  const [adults, setAdults] = useState(Math.max(Number(initSession.adults || 1), Math.max(1, Number(initSession.rooms || 1))))
  const [children, setChildren] = useState(Math.max(0, Number(initSession.children || 0)))
  const [priceStarFilter, setPriceStarFilter] = useState<PriceStarDraft>(parsePriceStarLabel(initSession.priceStar || ''))

  const [banners, setBanners] = useState<HomeBanner[]>([{ id: 'fallback', hotelId: '', title: '易宿精选酒店', subtitle: '品质酒店限时优惠', image: 'https://picsum.photos/seed/home_banner/1400/700' }])

  const [isCalendarOpen, setIsCalendarOpen] = useState(false)
  const [isGuestOpen, setIsGuestOpen] = useState(false)
  const [isPriceOpen, setIsPriceOpen] = useState(false)
  const [locating, setLocating] = useState(false)

  const nights = diffNights(checkInDate, checkOutDate)

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

  useFocusEffect(
    useCallback(() => {
      const current = getSearchSession()
      setCity(current.city || '上海市')
      setLocation(current.location || '')
      setCheckInDate(current.checkIn || defaultSession.checkIn)
      setCheckOutDate(current.checkOut || defaultSession.checkOut)
      setRooms(Math.max(1, Number(current.rooms || 1)))
      setAdults(Math.max(Number(current.adults || 1), Math.max(1, Number(current.rooms || 1))))
      setChildren(Math.max(0, Number(current.children || 0)))
      setPriceStarFilter(parsePriceStarLabel(current.priceStar || ''))
    }, [defaultSession.checkIn, defaultSession.checkOut])
  )

  const openCalendar = () => {
    // 保留用户上次已选日期，行为与列表页一致
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

  function runSearch(tag?: string) {
    // 将当前筛选状态序列化为路由参数，跳转到列表页
    const keyword = tag || location
    const nextPrice = toPriceStarLabel(priceStarFilter)
    const currentSession = getSearchSession()
    setSearchSession({
      city,
      location: keyword,
      checkIn: checkInDate,
      checkOut: checkOutDate,
      rooms,
      adults: Math.max(adults, rooms),
      children,
      priceStar: nextPrice,
      tags: tag || '',
    })
    router.push({
      pathname: '/list',
      params: {
        city,
        location: keyword,
        keyword,
        checkIn: checkInDate,
        checkOut: checkOutDate,
        rooms: String(rooms),
        adults: String(Math.max(adults, rooms)),
        children: String(children),
        priceStar: nextPrice,
        tags: tag || '',
        scenicSpots: currentSession.scenicSpots || '',
        sort: ''
      }
    })
  }

  useEffect(() => {
    setSearchSession({
      city,
      location,
      checkIn: checkInDate,
      checkOut: checkOutDate,
      rooms,
      adults: Math.max(adults, rooms),
      children,
      priceStar: toPriceStarLabel(priceStarFilter),
    })
  }, [city, location, checkInDate, checkOutDate, rooms, adults, children, priceStarFilter])

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
          starLabel={toPriceStarLabel(priceStarFilter)}
          onCityPress={() => router.push({ pathname: '/location', params: { city } })}
          onLocationPress={() => router.push({ pathname: '/location', params: { city, location } })}
          onLocationClearPress={() => setLocation('')}
          onLocatePress={() => handleLocate()}
          onDatePress={openCalendar}
          onGuestPress={() => setIsGuestOpen(true)}
          onStarPress={() => setIsPriceOpen(true)}
          onStarClearPress={() => setPriceStarFilter(DEFAULT_PRICE_STAR_FILTER)}
          onSearch={() => runSearch()}
          quickTags={QUICK_TAGS}
          onTagPress={(tag) => runSearch(tag)}
        />
      </View>

      <DateRangePickerSheet
        visible={isCalendarOpen}
        checkInDate={checkInDate}
        checkOutDate={checkOutDate}
        onClose={() => setIsCalendarOpen(false)}
        onConfirm={({ checkInDate: nextIn, checkOutDate: nextOut }) => {
          setCheckInDate(nextIn)
          setCheckOutDate(nextOut)
        }}
      />

      <GuestPickerSheet
        visible={isGuestOpen}
        initial={{ rooms, adults, children } satisfies GuestDraft}
        onClose={() => setIsGuestOpen(false)}
        onConfirm={(next) => {
          setRooms(next.rooms)
          setAdults(next.adults)
          setChildren(next.children)
          setIsGuestOpen(false)
        }}
      />

      <PriceStarPickerSheet
        visible={isPriceOpen}
        initial={priceStarFilter}
        onClose={() => setIsPriceOpen(false)}
        onConfirm={(next) => {
          setPriceStarFilter(next)
          setIsPriceOpen(false)
        }}
      />
    </ScrollView>
  )
}
