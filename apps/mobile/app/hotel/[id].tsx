/**
 * 酒店详情页
 * 核心流程：
 * 1) 根据路由 id 拉取单酒店详情
 * 2) 轮播展示酒店图片
 * 3) 展示设施与房型，并支持改入住日期
 */
import { Image } from 'expo-image'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import DateRangePickerSheet from '@/components/hotel/DateRangePickerSheet'
import RoomList from '@/components/hotel/RoomList'
import MeasuredPagingCarousel from '@/components/ui/measured-paging-carousel'
import { fetchMobileHotelById } from '@/lib/api'
import { getDefaultSearchSession, setSearchSession } from '@/lib/search-session'
import type { Hotel } from '@yisu/shared'

function toCnMonthDay(s: string) {
  // 将 yyyy-mm-dd 转为 mm月dd日，提升可读性
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${m}月${day}日`
}

function getDateMetaLabel(s: string) {
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return ''
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  d.setHours(0, 0, 0, 0)
  const diff = Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (diff === 0) return '今天'
  if (diff === 1) return '明天'
  if (diff === 2) return '后天'
  const week = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return week[d.getDay()]
}

function getDisplayAddress(hotel?: Hotel | null) {
  const city = String(hotel?.city || '').trim()
  let address = String(hotel?.address || '').trim()
  if (city && address.startsWith(city)) address = address.slice(city.length)
  address = address.replace(/^(上海市|北京市|天津市|重庆市)/, '')
  if (address) return [city, address].filter(Boolean).join(' · ')
  const full = String(hotel?.fullAddress || '').trim()
  if (!full) return ''
  return full
    .replace(/^上海市上海市/, '上海市')
    .replace(/^北京市北京市/, '北京市')
    .replace(/^天津市天津市/, '天津市')
    .replace(/^重庆市重庆市/, '重庆市')
}

export default function HotelDetailScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const defaultSession = getDefaultSearchSession()

  const { id, checkIn, checkOut, from, city, location, priceStar, tags, scenicSpots, sort, rooms, adults, children } = useLocalSearchParams<{
    id: string
    checkIn?: string
    checkOut?: string
    from?: 'list' | 'home'
    city?: string
    location?: string
    priceStar?: string
    tags?: string
    scenicSpots?: string
    sort?: 'price_asc' | 'price_desc' | 'star_desc'
    rooms?: string
    adults?: string
    children?: string
  }>()

  const [hotel, setHotel] = useState<Hotel | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [isCalendarOpen, setIsCalendarOpen] = useState(false)
  const [checkInDate, setCheckInDate] = useState(checkIn || defaultSession.checkIn)
  const [checkOutDate, setCheckOutDate] = useState(checkOut || defaultSession.checkOut)

  const nights = useMemo(() => {
    const diff = Math.ceil((new Date(checkOutDate).getTime() - new Date(checkInDate).getTime()) / (1000 * 60 * 60 * 24))
    return Math.max(1, diff)
  }, [checkInDate, checkOutDate])

  const images = useMemo(() => {
    if (!hotel) return ['https://picsum.photos/seed/hotel_detail_fallback/1400/700']
    return hotel.images?.length ? hotel.images : [hotel.coverImage || 'https://picsum.photos/seed/hotel_detail_fallback/1400/700']
  }, [hotel])
  const star = Math.max(1, Math.min(5, Number(hotel?.starLevel || hotel?.rating || 0)))
  const starText = '★'.repeat(star)

  useEffect(() => {
    // 首次进入与 id 变化时，重新请求酒店详情
    if (!id) return
    let mounted = true
    setLoading(true)
    setError('')
    fetchMobileHotelById<Hotel>(id)
      .then(data => {
        if (!mounted) return
        setHotel(data)
      })
      .catch(err => {
        if (!mounted) return
        setError(err instanceof Error ? err.message : '加载失败')
        setHotel(null)
      })
      .finally(() => {
        if (!mounted) return
        setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [id])

  const handleBack = () => {
    // 优先返回栈，若无历史再按来源兜底。
    try {
      router.back()
      return
    } catch {}
    if (from === 'list') {
      router.replace({
        pathname: '/list',
        params: {
          city: city ?? '',
          location: location ?? '',
          checkIn: checkInDate,
          checkOut: checkOutDate,
          priceStar: priceStar ?? '',
          tags: tags ?? '',
          rooms: rooms ?? '',
          adults: adults ?? '',
          children: children ?? '',
          scenicSpots: scenicSpots ?? '',
          sort: sort ?? ''
        }
      })
      return
    }
    router.replace('/')
  }

  useEffect(() => {
    setSearchSession({
      city: city || '',
      location: location || '',
      checkIn: checkInDate,
      checkOut: checkOutDate,
      rooms: Math.max(1, Number(rooms || '1')),
      adults: Math.max(Math.max(1, Number(adults || '1')), Math.max(1, Number(rooms || '1'))),
      children: Math.max(0, Number(children || '0')),
      priceStar: priceStar || '不限星级',
      tags: tags || '',
      scenicSpots: scenicSpots || '',
      sort: sort || ''
    })
  }, [city, location, checkInDate, checkOutDate, rooms, adults, children, priceStar, tags, scenicSpots, sort])

  if (loading)
    return (
      <View className="flex-1 items-center justify-center bg-neutral-50">
        <Text className="text-base text-neutral-500">加载中...</Text>
      </View>
    )
  if (!hotel)
    return (
      <View className="flex-1 items-center justify-center bg-neutral-50">
        <Text className="text-base text-neutral-500">{error ? `加载失败：${error}` : '酒店不存在'}</Text>
      </View>
    )

  return (
    <View className="flex-1 bg-neutral-50">
      <ScrollView className="flex-1 bg-neutral-50" contentContainerStyle={{ paddingTop: insets.top + 54, paddingBottom: 96 }}>
        <MeasuredPagingCarousel
          data={images}
          autoPlayMs={5000}
          slideHeight={210}
          containerClassName="overflow-hidden rounded-3xl mx-4 bg-slate-200"
          keyExtractor={(image, idx) => `${idx}-${image}`}
          renderSlide={(image, _idx, width) => <Image source={{ uri: image }} style={{ width, height: 210 }} contentFit="cover" />}
        />

        <View className="px-4 pt-4">
          <View className="flex-1 pr-3">
            <View className="flex-row flex-wrap items-end">
              <Text className="text-2xl font-semibold text-neutral-900">{hotel.name}</Text>
              {hotel.nameEn ? <Text className="ml-2 text-sm text-neutral-500">{hotel.nameEn}</Text> : null}
            </View>
            <Text className="mt-1 text-sm tracking-[1px] text-amber-600">{starText}</Text>
          </View>

          <Text className="mt-2 text-sm text-neutral-500">{getDisplayAddress(hotel)}</Text>

          <View className="mt-4 flex-row flex-wrap gap-2">
            {(hotel.tags || []).map(tag => (
              <View key={tag} className="rounded-full bg-neutral-100 px-3 py-1">
                <Text className="text-xs text-neutral-600">{tag}</Text>
              </View>
            ))}
          </View>

          <Pressable className="mt-5 rounded-2xl border border-[#BFDFFF] bg-[#F8FCFF] px-3 py-3" onPress={() => setIsCalendarOpen(true)}>
            <View className="flex-row items-center justify-between">
              <Text className="text-xs font-semibold text-[#4D6B80]">入住日期与间夜</Text>
              <Text className="text-[11px] text-[#7FA2BA]">点击修改</Text>
            </View>
            <View className="mt-1.5 flex-row items-center">
              <Text className="text-base font-semibold text-[#183B56]">{toCnMonthDay(checkInDate)}</Text>
              <Text className="ml-1 text-xs text-[#6B8FA8]">{getDateMetaLabel(checkInDate)}</Text>
              <Text className="mx-2 text-xs font-medium text-[#8FA8BA]">-</Text>
              <Text className="text-base font-semibold text-[#183B56]">{toCnMonthDay(checkOutDate)}</Text>
              <Text className="ml-1 text-xs text-[#6B8FA8]">{getDateMetaLabel(checkOutDate)}</Text>
              <Text className="ml-4 text-xs font-semibold text-[#245F8B]">共{nights}晚</Text>
            </View>
          </Pressable>

          <View className="mt-6">
            <Text className="text-base font-semibold text-neutral-900">酒店设施</Text>
            <View className="mt-3 flex-row flex-wrap gap-2">
              {(hotel.facilities || []).map(facility => (
                <View key={facility} className="rounded-full bg-white px-3 py-2 shadow-sm">
                  <Text className="text-xs text-neutral-600">{facility}</Text>
                </View>
              ))}
            </View>
          </View>

          <View className="mt-6">
            <Text className="text-base font-semibold text-neutral-900">房型价格</Text>
            <View className="mt-4">
              <RoomList rooms={[...(hotel.rooms || [])].sort((a, b) => a.price - b.price)} />
            </View>
          </View>
        </View>

        <DateRangePickerSheet
          visible={isCalendarOpen}
          checkInDate={checkInDate}
          checkOutDate={checkOutDate}
          onClose={() => setIsCalendarOpen(false)}
          onConfirm={({ checkInDate: nextCheckIn, checkOutDate: nextCheckOut }) => {
            setCheckInDate(nextCheckIn)
            setCheckOutDate(nextCheckOut)
          }}
        />
      </ScrollView>

      <View className="absolute left-0 right-0 z-20 border-b border-slate-100 bg-white/95 px-4 pb-2" style={{ paddingTop: insets.top + 8 }}>
        <View className="flex-row items-center">
          <Pressable onPress={handleBack} className="mr-1.5 py-1 pr-1">
            <Text className="text-sm font-semibold text-[#1890FF]">‹ 返回</Text>
          </Pressable>
          <Text className="flex-1 text-base font-semibold text-slate-900" numberOfLines={1}>
            {hotel.name}
          </Text>
        </View>
      </View>
    </View>
  )
}
