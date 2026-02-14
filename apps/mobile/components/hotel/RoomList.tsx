/**
 * 房型列表组件
 * 输入 rooms 后，逐项渲染房型名称、可住人数、餐食/取消策略与价格。
 */
import { Image } from "expo-image";
import { Text, View } from "react-native";
import { useEffect, useState } from "react";

import type { Room } from "@yisu/shared";

type RoomListProps = {
  rooms: Room[];
};

function RoomRow({ room }: { room: Room }) {
  const cover = room.image || `https://picsum.photos/seed/mobile_room_${room.id}/320/220`;
  const fallbackCover = `https://picsum.photos/seed/mobile_room_fallback_${room.id}/320/220`;
  const [imageUri, setImageUri] = useState(cover);

  useEffect(() => {
    setImageUri(cover);
  }, [cover]);

  return (
    <View key={room.id} className="flex-row rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm">
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
          <View className="flex-1 pr-2">
            <Text className="text-base font-semibold text-neutral-900">{room.name}</Text>
            <Text className="mt-1 text-xs text-neutral-500">可住 {room.capacity} 人 · {room.bedType}</Text>
            <Text className="mt-2 text-xs text-neutral-500">{room.breakfastIncluded ? "含早餐" : "不含早餐"} · {room.refundable ? "可取消" : "不可取消"}</Text>
          </View>
          <Text className="text-lg font-semibold text-neutral-900">¥{room.price}</Text>
        </View>
      </View>
    </View>
  );
}

export default function RoomList({ rooms }: RoomListProps) {
  return (
    <View className="gap-3">
      {rooms.map((room) => <RoomRow key={room.id} room={room} />)}
    </View>
  );
}
