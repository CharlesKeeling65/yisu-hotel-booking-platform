import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { loginMobile } from "@/lib/api";

const BENEFITS = ["专属优惠", "积分兑礼", "优先客服"];
const QUICK_STATS = [
  { label: "订单", value: "12" },
  { label: "收藏", value: "6" },
  { label: "优惠", value: "3" },
];

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between border-b border-slate-100 py-3">
      <Text className="text-sm text-slate-500">{label}</Text>
      <Text className="text-sm font-semibold text-slate-900">{value}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState("mobile");
  const [password, setPassword] = useState("123456");
  const [error, setError] = useState("");
  const [user, setUser] = useState({
    name: "旅行达人小易",
    phone: "138****2468",
    city: "上海",
    memberLevel: "黄金会员",
    points: 3280,
    status: "正常",
  });

  const handleLogin = async () => {
    setError("");
    try {
      const data = await loginMobile(username.trim(), password);
      if (!data) {
        setError("登录失败");
        return;
      }
      setUser((prev) => ({ ...prev, name: data.user?.name || prev.name }));
      setIsLoggedIn(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "用户名或密码错误");
    }
  };

  return (
    <ScrollView
      className="flex-1 bg-white"
      contentContainerClassName="px-4 pb-24"
      contentContainerStyle={{ paddingTop: insets.top + 12 }}>
      <View className="mt-6 rounded-3xl bg-[#E6F4FF] p-5">
        <View className="flex-row items-center gap-4">
          <View className="h-14 w-14 items-center justify-center rounded-full bg-white">
            <Text className="text-lg font-semibold text-[#1890FF]">易</Text>
          </View>
          <View className="flex-1">
            <Text className="text-lg font-semibold text-slate-900">
              {isLoggedIn ? user.name : "登录后解锁更多权益"}
            </Text>
            <Text className="mt-1 text-sm text-slate-600">
              {isLoggedIn ? user.memberLevel : "首单立减 · 会员专属优惠"}
            </Text>
          </View>
          <View className="rounded-full bg-[#FFF7E6] px-3 py-1">
            <Text className="text-xs font-semibold text-[#FFA940]">积分 {user.points}</Text>
          </View>
        </View>

        {!isLoggedIn && (
          <Pressable
            className="mt-5 rounded-2xl bg-[#1890FF] py-3"
            onPress={handleLogin}>
            <Text className="text-center text-sm font-semibold text-white">登录 / 注册</Text>
          </Pressable>
        )}

        {!isLoggedIn && (
          <View className="mt-4 gap-3">
            <TextInput
              value={username}
              onChangeText={setUsername}
              placeholder="用户名"
              className="rounded-2xl border border-slate-100 px-4 py-3 text-sm text-slate-900"
              autoCapitalize="none"
            />
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="密码"
              secureTextEntry
              className="rounded-2xl border border-slate-100 px-4 py-3 text-sm text-slate-900"
            />
            {error ? (
              <Text className="text-xs text-red-500">登录失败：{error}</Text>
            ) : null}
          </View>
        )}

        {!isLoggedIn && (
          <View className="mt-4 flex-row flex-wrap gap-2">
            {BENEFITS.map((item) => (
              <View key={item} className="rounded-full bg-white px-3 py-2">
                <Text className="text-xs text-slate-600">{item}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {isLoggedIn && (
        <>
          <View className="mt-5 flex-row justify-between rounded-2xl border border-slate-100 bg-white p-4">
            {QUICK_STATS.map((stat) => (
              <View key={stat.label} className="items-center flex-1">
                <Text className="text-lg font-semibold text-slate-900">{stat.value}</Text>
                <Text className="mt-1 text-xs text-slate-500">{stat.label}</Text>
              </View>
            ))}
          </View>

          <View className="mt-5 rounded-2xl border border-slate-100 bg-white px-4">
            <InfoRow label="手机号" value={user.phone} />
            <InfoRow label="常用城市" value={user.city} />
            <InfoRow label="会员等级" value={user.memberLevel} />
            <InfoRow label="账户状态" value={user.status} />
          </View>

          <Pressable
            className="mt-5 rounded-2xl border border-[#1890FF] py-3"
            onPress={() => setIsLoggedIn(false)}>
            <Text className="text-center text-sm font-semibold text-[#1890FF]">
              退出登录
            </Text>
          </Pressable>
        </>
      )}

      {!isLoggedIn && (
        <View className="mt-6 rounded-2xl border border-slate-100 bg-white p-4">
          <Text className="text-base font-semibold text-slate-900">我的旅行计划</Text>
          <Text className="mt-2 text-sm text-slate-600">
            登录后可查看订单、收藏与优惠券。
          </Text>
        </View>
      )}
    </ScrollView>
  );
}
