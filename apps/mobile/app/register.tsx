import { customerRegister, customerLogin } from "@/lib/api";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  const handleClose = () => {
    router.back();
  };

  const handleRegister = async () => {
    // basic client-side validation
    setPhoneError(null);
    setEmailError(null);
    if (!username.trim() || !phone.trim() || !password) {
      Alert.alert("请填写用户名、手机号与密码");
      return;
    }
    // 手机号校验（中国手机号 11 位，简单校验）
    const phoneDigits = phone.replace(/\D/g, "");
    if (!/^1\d{10}$/.test(phoneDigits)) {
      setPhoneError("手机号格式不正确");
      return;
    }
    // 邮箱如果填写则校验格式
    if (email.trim()) {
      const emailVal = email.trim();
      const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRe.test(emailVal)) {
        setEmailError("邮箱格式不正确");
        return;
      }
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

      // 自动使用刚注册的账号登录
      try {
        const loginRes = await customerLogin(phone.trim(), password);
      if (loginRes && loginRes.token && loginRes.customer) {
          await AsyncStorage.setItem("customer_token", String(loginRes.token));
          await AsyncStorage.setItem(
            "customer_info",
            JSON.stringify(loginRes.customer),
          );
          Alert.alert("注册并登录成功", "已使用新账号登录");
          router.replace("/(tabs)/profile");
        } else {
          // fallback
          Alert.alert("注册成功", `账号 ${data.id} 已创建`);
          router.replace("/login");
        }
      } catch (le: any) {
        // 注册成功但登录失败
        Alert.alert("注册成功", `账号 ${data.id} 已创建，请手动登录`);
        router.replace("/login");
      }
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
              onChangeText={(v) => {
                setPhone(v);
                // 实时校验清理
                if (phoneError) setPhoneError(null);
              }}
              placeholder="手机号"
              keyboardType="phone-pad"
              className={`mt-2 rounded-md px-3 py-2 ${phoneError ? "border border-red-500" : "border border-neutral-200"} bg-white`}
            />
            {phoneError ? (
              <Text style={{ color: "#EF4444", marginTop: 6, fontSize: 12 }}>
                {phoneError}
              </Text>
            ) : null}
          </View>

          <View className="mt-4">
            <Text className="text-sm text-neutral-700">邮箱（选填）</Text>
            <TextInput
              value={email}
              onChangeText={(v) => {
                setEmail(v);
                if (emailError) setEmailError(null);
              }}
              placeholder="邮箱"
              keyboardType="email-address"
              className={`mt-2 rounded-md px-3 py-2 ${emailError ? "border border-red-500" : "border border-neutral-200"} bg-white`}
              autoCapitalize="none"
            />
            {emailError ? (
              <Text style={{ color: "#EF4444", marginTop: 6, fontSize: 12 }}>
                {emailError}
              </Text>
            ) : null}
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
