import { ReactNode, useEffect, useRef, useState } from 'react'
import { Pressable, ScrollView, View } from 'react-native'

type MeasuredPagingCarouselProps<T> = {
  data: T[]
  slideHeight: number
  keyExtractor: (item: T, index: number) => string
  renderSlide: (item: T, index: number, width: number) => ReactNode
  autoPlayMs?: number
  containerClassName?: string
  showDots?: boolean
}

/**
 * 通用分页轮播：
 * - onLayout 实测宽度，规避 iOS 子像素拼接缝
 * - paging + snapToInterval 保持每页严格对齐
 * - 可选自动轮播与分页点
 */
export default function MeasuredPagingCarousel<T>({ data, slideHeight, keyExtractor, renderSlide, autoPlayMs, containerClassName, showDots = true }: MeasuredPagingCarouselProps<T>) {
  const scrollRef = useRef<ScrollView | null>(null)
  const [width, setWidth] = useState(0)
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (!autoPlayMs || !width || data.length <= 1) return
    const timer = setInterval(() => {
      const next = (index + 1) % data.length
      scrollRef.current?.scrollTo({ x: next * width, animated: true })
      setIndex(next)
    }, autoPlayMs)
    return () => clearInterval(timer)
  }, [autoPlayMs, data.length, index, width])

  return (
    <View
      className={containerClassName}
      onLayout={e => {
        const nextWidth = Math.floor(e.nativeEvent.layout.width)
        if (nextWidth > 0 && nextWidth !== width) setWidth(nextWidth)
      }}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        snapToInterval={width || undefined}
        disableIntervalMomentum
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        bounces={false}
        onMomentumScrollEnd={e => {
          if (!width) return
          const x = e.nativeEvent.contentOffset.x
          const next = Math.max(0, Math.min(data.length - 1, Math.round(x / width)))
          setIndex(next)
        }}>
        {data.map((item, idx) => (
          <View key={keyExtractor(item, idx)} style={{ width: width || 1, height: slideHeight }}>
            {renderSlide(item, idx, width || 1)}
          </View>
        ))}
      </ScrollView>

      {showDots && data.length > 1 ? (
        <View className="absolute bottom-3 left-0 right-0 flex-row items-center justify-center gap-1">
          {data.map((_, idx) => (
            <Pressable
              key={idx}
              onPress={() => {
                if (!width) return
                // 点击定位条后，滚动到对应页；自动轮播与手势滑动逻辑保持不变
                scrollRef.current?.scrollTo({ x: idx * width, animated: true })
                // 提前切换高亮态，交互反馈更及时
                setIndex(idx)
              }}
              className="h-4 w-4 items-center justify-center">
              <View className={`h-1.5 w-3 rounded-full ${idx === index ? 'bg-white' : 'bg-white/45'}`} />
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  )
}
