import { customerLogin } from "@/lib/api";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";

export default function LoginScreen() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!identifier.trim() || !password) {
      Alert.alert("请输入手机号/邮箱与密码");
      return;
    }
    setLoading(true);
    try {
      const data = await customerLogin(identifier.trim(), password);
      if (!data) throw new Error("登录失败");
      Alert.alert(
        "登录成功",
        `欢迎 ${data.customer?.name || data.customer?.id || ""}`,
      );
      router.back();
    } catch (e: any) {
      Alert.alert("登录失败", e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-neutral-50 px-4 pt-16">
      <Text className="text-2xl font-semibold text-neutral-900 mt-6">登录</Text>
      <View className="mt-6">
        <Text className="text-sm text-neutral-700">手机号或邮箱</Text>
        <TextInput
          value={identifier}
          onChangeText={setIdentifier}
          placeholder="手机号或邮箱"
          className="mt-2 rounded-md border border-neutral-200 bg-white px-3 py-2"
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
        className={`mt-6 rounded-xl py-3 items-center ${
          loading ? "bg-slate-200" : "bg-[#2B7FC7]"
        }`}
      >
        <Text
          className={`text-base font-semibold ${
            loading ? "text-slate-500" : "text-white"
          }`}
        >
          登录
        </Text>
      </Pressable>
    </View>
  );
}
