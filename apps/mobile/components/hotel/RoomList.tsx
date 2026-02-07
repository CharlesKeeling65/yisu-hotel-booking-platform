import { Text, View } from "react-native";

import type { Room } from "@yisu/shared";

type RoomListProps = {
  rooms: Room[];
};

export default function RoomList({ rooms }: RoomListProps) {
  return (
    <View className="gap-3">
      {rooms.map((room) => (
        <View
          key={room.id}
          className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
          <View className="flex-row items-start justify-between">
            <View className="flex-1 pr-3">
              <Text className="text-base font-semibold text-neutral-900">{room.name}</Text>
              <Text className="mt-1 text-xs text-neutral-500">
                {room.capacity} guests · {room.bedType} bed
              </Text>
              <Text className="mt-2 text-xs text-neutral-500">
                {room.breakfastIncluded ? "Breakfast included" : "No breakfast"} · {
                  room.refundable ? "Refundable" : "Non-refundable"
                }
              </Text>
            </View>
            <Text className="text-lg font-semibold text-neutral-900">¥{room.price}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}
