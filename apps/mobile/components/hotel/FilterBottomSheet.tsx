import { Modal, Pressable, Text, View } from "react-native";

type Props = {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
};

/**
 * 可复用底部弹窗容器：
 * - 点击背景或右上角关闭，均视为取消（不保存）
 * - 内容区域由业务组件自行传入
 */
export default function FilterBottomSheet({ visible, title, onClose, children }: Props) {
  return (
    <Modal transparent visible={visible} animationType="fade">
      <View className="flex-1 justify-end bg-black/35">
        <Pressable className="flex-1" onPress={onClose} />
        <View className="rounded-t-3xl bg-white px-4 pb-5 pt-4">
          <View className="flex-row items-center justify-between pb-2">
            <Text className="text-base font-semibold text-slate-900">{title}</Text>
            <Pressable onPress={onClose} className="h-8 w-8 items-center justify-center rounded-full bg-slate-100">
              <Text className="text-base text-slate-500">×</Text>
            </Pressable>
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );
}
