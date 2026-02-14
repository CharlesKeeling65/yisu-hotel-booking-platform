import { Image } from "expo-image";
import { Text, View } from "react-native";

import type { Room } from "@yisu/shared";

type RoomListProps = {
  rooms: Room[];
};

export default function RoomList({ rooms }: RoomListProps) {
  return (
    <View className="gap-3">
      {rooms.map((room) => (
        <View key={room.id} className="flex-row rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm">
          <Image
            source={{ uri: room.image || `https://picsum.photos/seed/mobile_room_${room.id}/320/220` }}
            className="h-[86px] w-[112px] rounded-xl"
            contentFit="cover"
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
      ))}
    </View>
  );
}
