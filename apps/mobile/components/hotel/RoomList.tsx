/**
 * 房型列表组件
 * 输入 rooms 后，逐项渲染房型名称、可住人数、餐食/取消策略与价格。
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
  const available = (room.status || "available") === "available";
  const areaText = room.size ? `${room.size}㎡` : "面积待定";

  useEffect(() => {
    setImageUri(cover);
  }, [cover]);

  return (
    <View
      key={room.id}
      className="flex-row rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm"
    >
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
              className="font-semibold text-neutral-900"
              style={{ fontSize: nameSize }}
              numberOfLines={1}
            >
              {room.name}
            </Text>
            <Text
              className="mt-1 text-neutral-500"
              style={{ fontSize: metaSize }}
              numberOfLines={1}
            >
              {room.bedType} · 可住 {room.capacity} 人 · {areaText}
            </Text>
            <Text
              className="mt-1.5 text-neutral-500"
              style={{ fontSize: metaSize }}
              numberOfLines={1}
            >
              {room.breakfastIncluded ? "含早餐" : "不含早餐"} ·{" "}
              {room.refundable ? "可取消" : "不可取消"}
            </Text>
          </View>
        </View>

        <View className="mt-1.5 flex-row items-end justify-end">
          <View className="flex-row items-end gap-2.5">
            <Text>
              <Text
                className="font-semibold text-amber-500"
                style={{ fontSize: Math.max(13, Math.floor(priceSize * 0.54)) }}
              >
                ¥
              </Text>
              <Text
                className="font-semibold text-amber-600"
                style={{ fontSize: priceSize - 1 }}
              >
                {room.price}
              </Text>
            </Text>
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
  return (
    <View className="gap-3">
      {rooms.map((room) => (
        <RoomRow key={room.id} room={room} onBook={onBook} />
      ))}
    </View>
  );
}
