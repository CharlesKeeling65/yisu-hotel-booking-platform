/**
 * 根路由布局（Root Layout）
 * 作用：
 * 1) 挂载全局主题（亮色/暗色）
 * 2) 定义整个 App 的主导航栈（Stack）
 * 3) 注册全局样式与状态栏
 *
 * 学习建议：
 * - 新增一个页面时，先在 app 目录创建文件，再根据是否需要显式控制 header 在这里配置 Screen options。
 */
import {
    DarkTheme,
    DefaultTheme,
    ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Platform } from "react-native";
import { useEffect } from "react";
import "react-native-reanimated";

import { useColorScheme } from "@/hooks/use-color-scheme";
import "../global.css";

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  useEffect(() => {
    if (Platform.OS === "web" && typeof document !== "undefined") {
      document.title = "驿宿酒店移动端";
    }
  }, []);

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="list"
          options={{
            headerShown: false,
            title: "酒店列表",
            animation: "slide_from_right",
          }}
        />
        <Stack.Screen
          name="hotel/[id]"
          options={{
            headerShown: false,
            title: "酒店详情",
            animation: "slide_from_right",
          }}
        />
        <Stack.Screen
          name="booking"
          options={{
            headerShown: false,
            title: "预订",
            animation: "slide_from_right",
          }}
        />
        <Stack.Screen
          name="order/[id]"
          options={{
            title: "我的订单",
            animation: "slide_from_right",
          }}
        />
        <Stack.Screen
          name="login"
          options={{ headerShown: false, presentation: "modal", title: "登录" }}
        />
        <Stack.Screen
          name="register"
          options={{ headerShown: false, presentation: "modal", title: "注册" }}
        />
        <Stack.Screen
          name="location"
          options={{
            headerShown: false,
            title: "位置选择",
            animation: "slide_from_right",
          }}
        />
        <Stack.Screen
          name="modal"
          options={{ presentation: "modal", title: "更多功能" }}
        />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
