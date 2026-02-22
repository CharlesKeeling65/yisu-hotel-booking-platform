import { customerRegister } from "@/lib/api";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Modal, Pressable, Text, TextInput, View } from "react-native";

export default function RegisterScreen() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleClose = () => {
    router.back();
  };

  const handleRegister = async () => {
    if (!username.trim() || !phone.trim() || !password) {
      Alert.alert("请填写用户名、手机号与密码");
      return;
    }
    setLoading(true);
    try {
      const data = await customerRegister(
        password,
        phone.trim(),
        username.trim() || undefined,
        email.trim() || undefined,
      );
      if (!data) throw new Error("注册失败");
      Alert.alert("注册成功", `账号 ${data.id} 已创建`);
      router.replace("/login");
    } catch (e: any) {
      Alert.alert("注册失败", e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal transparent visible animationType="fade">
      <View className="flex-1 justify-center items-center bg-black/35 px-4">
        <View className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-lg">
          <View className="flex-row items-center justify-between">
            <Text className="text-lg font-semibold text-slate-900">注册</Text>
            <Pressable
              onPress={handleClose}
              className="h-8 w-8 items-center justify-center rounded-full bg-slate-100"
            >
              <Text className="text-base text-slate-500">×</Text>
            </Pressable>
          </View>

          <View className="mt-4">
            <Text className="text-sm text-neutral-700">用户名（必填）</Text>
            <TextInput
              value={username}
              onChangeText={setUsername}
              placeholder="用户名"
              className="mt-2 rounded-md border border-neutral-200 bg-white px-3 py-2"
              autoCapitalize="none"
            />
          </View>

          <View className="mt-4">
            <Text className="text-sm text-neutral-700">密码（必填）</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="密码"
              secureTextEntry
              className="mt-2 rounded-md border border-neutral-200 bg-white px-3 py-2"
            />
          </View>

          <View className="mt-4">
            <Text className="text-sm text-neutral-700">手机号（必填）</Text>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="手机号"
              keyboardType="phone-pad"
              className="mt-2 rounded-md border border-neutral-200 bg-white px-3 py-2"
            />
          </View>

          <View className="mt-4">
            <Text className="text-sm text-neutral-700">邮箱（选填）</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="邮箱"
              keyboardType="email-address"
              className="mt-2 rounded-md border border-neutral-200 bg-white px-3 py-2"
              autoCapitalize="none"
            />
          </View>

          <Pressable
            onPress={handleRegister}
            disabled={loading}
            className={`mt-6 rounded-xl py-3 items-center ${loading ? "bg-slate-200" : "bg-[#2B7FC7]"}`}
          >
            <Text
              className={`text-base font-semibold ${loading ? "text-slate-500" : "text-white"}`}
            >
              注册
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
