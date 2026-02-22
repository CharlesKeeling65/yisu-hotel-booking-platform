import AsyncStorage from "@react-native-async-storage/async-storage";
import { customerLogin } from "@/lib/api";
import { useState } from "react";
import { Alert, Modal, Pressable, Text, TextInput, View } from "react-native";

type Props = {
  visible: boolean;
  onClose: () => void;
  onSuccess?: (data: any) => void;
};

export default function LoginModal({ visible, onClose, onSuccess }: Props) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!identifier.trim() || !password) {
      Alert.alert("请输入用户名/邮箱/手机号 与 密码");
      return;
    }
    setLoading(true);
    try {
      const data = await customerLogin(identifier.trim(), password);
      if (!data) throw new Error("登录失败");
      // persist token/info
      try {
        await AsyncStorage.setItem("customer_token", data.token || "");
        await AsyncStorage.setItem("customer_info", JSON.stringify(data.customer || {}));
      } catch (_e) {
        // ignore storage error
      }
      Alert.alert("登录成功", `欢迎 ${data.customer?.name || data.customer?.id || ""}`);
      onSuccess?.(data);
      onClose();
    } catch (e: any) {
      Alert.alert("登录失败", e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal transparent visible={visible} animationType="fade">
      <View className="flex-1 justify-center items-center bg-black/35 px-4">
        <View className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-lg">
          <View className="flex-row items-center justify-between">
            <Text className="text-lg font-semibold text-slate-900">登录</Text>
            <Pressable onPress={onClose} className="h-8 w-8 items-center justify-center rounded-full bg-slate-100">
              <Text className="text-base text-slate-500">×</Text>
            </Pressable>
          </View>

          <View className="mt-4">
            <Text className="text-sm text-neutral-700">用户名 / 邮箱 / 手机号</Text>
            <TextInput
              value={identifier}
              onChangeText={setIdentifier}
              placeholder="用户名 / 邮箱 / 手机号"
              className="mt-2 rounded-md border border-neutral-200 bg-white px-3 py-2"
              autoCapitalize="none"
            />
          </View>

          <View className="mt-4">
            <Text className="text-sm text-neutral-700">密码</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="密码"
              secureTextEntry
              className="mt-2 rounded-md border border-neutral-200 bg-white px-3 py-2"
            />
          </View>

          <Pressable
            onPress={handleLogin}
            disabled={loading}
            className={`mt-6 rounded-xl py-3 items-center ${loading ? "bg-slate-200" : "bg-[#2B7FC7]"}`}
          >
            <Text className={`text-base font-semibold ${loading ? "text-slate-500" : "text-white"}`}>
              登录
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
