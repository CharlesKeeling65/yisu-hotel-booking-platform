/**
 * 酒店列表卡片
 * 由列表页复用：负责单条酒店摘要信息展示与点击跳转入口。
 */
import { Image } from 'expo-image'
import { Pressable, Text, View } from 'react-native'
import { useEffect, useState } from 'react'

import type { Hotel } from '@yisu/shared'

type HotelCardProps = {
  hotel: Hotel
  onPress?: () => void
}

export default function HotelCard({ hotel, onPress }: HotelCardProps) {
  const cover = hotel.coverImage || 'https://picsum.photos/seed/mobile_cover/1200/700'
  const fallbackCover = `https://picsum.photos/seed/mobile_cover_${hotel.id}/1200/700`
  const [imageUri, setImageUri] = useState(cover)

  useEffect(() => {
    setImageUri(cover)
  }, [cover])

  return (
    <Pressable onPress={onPress} className="mb-3 flex-row overflow-hidden rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm">
      <Image
        source={{ uri: imageUri }}
        style={{ width: 128, height: 108, borderRadius: 12 }}
        contentFit="cover"
        transition={120}
        onError={() => {
          if (imageUri !== fallbackCover) setImageUri(fallbackCover)
        }}
      />
      <View className="ml-3 flex-1 justify-between">
        <View>
          <View className="flex-row items-center justify-between">
            <Text className="mr-2 flex-1 text-base font-semibold text-neutral-900" numberOfLines={1}>
              {hotel.name}
            </Text>
            <View className="rounded-full bg-amber-100 px-2 py-1">
              <Text className="text-xs font-semibold text-amber-700">{hotel.starLevel || hotel.rating}星</Text>
            </View>
          </View>
          <Text className="mt-1 text-xs text-neutral-500" numberOfLines={2}>
            {hotel.city} · {hotel.address}
          </Text>
          <View className="mt-2 flex-row flex-wrap gap-1">
            {(hotel.tags || []).slice(0, 3).map(tag => (
              <View key={tag} className="rounded-full bg-neutral-100 px-2 py-1">
                <Text className="text-[10px] text-neutral-600">{tag}</Text>
              </View>
            ))}
          </View>
        </View>
        <View className="flex-row items-end justify-between">
          <Text className="text-sm font-semibold text-[#E65100]">¥{hotel.priceFrom} 起</Text>
          <Text className="text-xs font-semibold text-[#1890FF]">查看详情</Text>
        </View>
      </View>
    </Pressable>
  )
}
