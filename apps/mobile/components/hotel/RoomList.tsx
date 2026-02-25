/**
 * 房型列表组件
 * 输入 rooms 后，逐项渲染房型名称、可住人数、餐食/取消策略与价格。
 * 新增功能：自动将“可订”房型排在前面，已售罄房型沉底，并添加右上角斜体角标。
 */
import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { Pressable, Text, useWindowDimensions, View } from "react-native";

import type { Room } from "@yisu/shared";

type RoomListProps = {
  rooms: Room[];
  onBook?: (room: Room) => void;
};

function RoomRow({
  room,
  onBook,
}: {
  room: Room;
  onBook?: (room: Room) => void;
}) {
  const { width } = useWindowDimensions();
  const cover =
    room.image || `https://picsum.photos/seed/mobile_room_${room.id}/320/220`;
  const fallbackCover = `https://picsum.photos/seed/mobile_room_fallback_${room.id}/320/220`;
  const [imageUri, setImageUri] = useState(cover);
  const nameSize = width < 380 ? 14 : 16;
  const metaSize = width < 380 ? 11 : 12;
  const priceSize = width < 380 ? 22 : 24;
  const actionSize = width < 380 ? 15 : 16;
  const raw = (room as any).raw;
  const remain =
    typeof room.remain === "number"
      ? room.remain
      : typeof raw?.remain === "number"
        ? raw.remain
        : undefined;
  // 可订性仅基于 remain 字段：remain == null 表示未知（视为可订），remain === 0 表示不可订
  const available = remain == null || remain > 0;
  const areaText = room.size ? `${room.size}㎡` : "面积待定";

  useEffect(() => {
    setImageUri(cover);
  }, [cover]);

  return (
    <View
      key={room.id}
      className={`relative flex-row rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm ${!available ? 'opacity-60' : ''}`}
    >
      {/* 👉 核心修改：添加右上角的灰色斜体“已售罄”角标 */}
      {!available && (
        <View className="absolute top-0 right-0 z-10 rounded-bl-xl rounded-tr-2xl bg-slate-200/70 px-2.5 py-1">
          <Text className="text-[11px] font-bold italic text-slate-500">
            已售罄
          </Text>
        </View>
      )}

      <Image
        source={{ uri: imageUri }}
        style={{ width: 112, height: 86, borderRadius: 12 }}
        contentFit="cover"
        transition={120}
        onError={() => {
          if (imageUri !== fallbackCover) setImageUri(fallbackCover);
        }}
      />
      <View className="ml-3 flex-1">
        <View className="flex-row items-start justify-between">
          <View className="min-w-0 flex-1 pr-2">
            <Text
              className={`font-semibold text-neutral-900 ${!available ? 'pr-10' : ''}`} // 防止和角标重叠
              style={{ fontSize: nameSize }}
              numberOfLines={1}
            >
              {room.name}
            </Text>
            {/* 显示容量、面积与备注标签（优先从 raw 读取） */}
            {(() => {
              const capacity = raw?.occupancy ?? room.capacity;
              const area = raw?.size ?? room.size ?? raw?.area;
              let tags: string[] = [];
              if (Array.isArray(raw?.remarkTags)) tags = raw.remarkTags;
              else if (raw?.remark)
                tags = String(raw.remark)
                  .split(",")
                  .map((s: string) => s.trim())
                  .filter(Boolean);
              else if ((room as any).remarkTags)
                tags = (room as any).remarkTags;
              else if ((room as any).remark)
                tags = String((room as any).remark)
                  .split(",")
                  .map((s: string) => s.trim())
                  .filter(Boolean);

              return (
                <View className="mt-2 flex-row flex-wrap items-center gap-2">
                  {capacity != null && (
                    <View className="flex-row items-center gap-1.5 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                      <Text className="text-xs text-slate-600">
                        最多 {capacity} 人
                      </Text>
                    </View>
                  )}
                  <View className="flex-row items-center gap-1.5 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                    <Text className="text-xs text-slate-600">
                      面积 {area ?? "-"} ㎡
                    </Text>
                  </View>
                  {tags.length > 0 &&
                    tags.map((t) => (
                      <Text
                        key={t}
                        className="px-2 py-0.5 bg-slate-50 text-slate-600 rounded-md text-xs font-medium border border-slate-100/60"
                      >
                        {t}
                      </Text>
                    ))}
                </View>
              );
            })()}
          </View>
          
          {/* 原本的"已售罄"红字逻辑，因为右上角有了角标，这里只保留"仅剩X间"的提示 */}
          <View className="shrink-0 pl-2">
            {typeof remain === "number" ? (
               remain > 0 && remain <= 4 ? (
                <Text className="text-xs font-medium text-amber-600">
                  仅剩 {remain} 间
                </Text>
              ) : null
            ) : null}
          </View>
        </View>

        <View className="mt-1.5 flex-row items-end justify-end">
          <View className="flex-row items-end gap-2.5">
            {(() => {
              const originalUnit = Number(
                raw?.original_price ?? room.price ?? 0,
              );
              const priceUnit = Number(room.price ?? 0);
              const showOriginal = originalUnit > priceUnit;
              return (
                <View className="flex-row items-end">
                  {showOriginal && (
                    <Text
                      style={{
                        textDecorationLine: "line-through",
                        textDecorationColor: "#ef4444",
                        color: "#ef4444",
                        fontSize: Math.max(14, Math.floor(priceSize * 0.7)),
                        marginRight: 6,
                      }}
                    >
                      ¥{originalUnit}
                    </Text>
                  )}
                  <Text>
                    <Text
                      className="font-semibold text-amber-500"
                      style={{
                        fontSize: Math.max(13, Math.floor(priceSize * 0.54)),
                      }}
                    >
                      ¥
                    </Text>
                    <Text
                      className="font-semibold text-amber-600"
                      style={{ fontSize: priceSize }}
                    >
                      {priceUnit}
                    </Text>
                  </Text>
                </View>
              );
            })()}
            <Pressable
              disabled={!available}
              onPress={() => onBook?.(room)}
              className={`rounded-xl border px-3 py-1.5 ${
                available
                  ? "border-[#B7DEFF] bg-[#2B7FC7]"
                  : "border-slate-200 bg-slate-100"
              }`}
            >
              <Text
                className={`font-medium ${
                  available ? "text-[#fff]" : "text-slate-400"
                }`}
                style={{ fontSize: actionSize }}
              >
                订
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

export default function RoomList({ rooms, onBook }: RoomListProps) {
  // 👉 核心修改：根据 remain 字段对房间进行排序，可订的在前，售罄的在后，同状态下按价格排序
  const sortedRooms = [...rooms].sort((a, b) => {
    const rawA = (a as any).raw;
    const rawB = (b as any).raw;
    
    const remainA = typeof a.remain === "number" ? a.remain : typeof rawA?.remain === "number" ? rawA.remain : undefined;
    const remainB = typeof b.remain === "number" ? b.remain : typeof rawB?.remain === "number" ? rawB.remain : undefined;

    const aAvailable = remainA == null || remainA > 0;
    const bAvailable = remainB == null || remainB > 0;

    if (aAvailable && !bAvailable) return -1;
    if (!aAvailable && bAvailable) return 1;
    return (a.price || 0) - (b.price || 0);
  });

  return (
    <View className="gap-3">
      {sortedRooms.map((room) => (
        <RoomRow key={room.id} room={room} onBook={onBook} />
      ))}
    </View>
  );
}