/**
 * 订单列表页（替换原“购物车” Tab）。
 * 功能：
 * - 登录态下展示当前客户在移动端创建的订单列表
 * - 顶部提供“全部 / 待付款 / 未出行 / 待点评”筛选
 * - 支持下拉刷新
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fetchMobileOrders, type MobileOrder } from "@/lib/api";

type StatusKey = "all" | "pending" | "upcoming" | "completed";

const STATUS_TABS: Array<{ key: StatusKey; label: string }> = [
  { key: "all", label: "全部" },
  { key: "pending", label: "待付款" },
  { key: "upcoming", label: "未出行" },
  { key: "completed", label: "待点评" },
];

function OrderCard({ order }: { order: MobileOrder }) {
  const dateText =
    order.checkIn && order.checkOut
      ? `${order.checkIn}至${order.checkOut}`
      : "";
  const metaText = `${order.nights || 1}晚${order.roomsCount || 1}间${
    order.roomName ? ` · ${order.roomName}` : ""
  }`;

  const amountText = `¥${order.payableAmount.toFixed(2)}`;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <Text style={styles.cardType}>酒店</Text>
        <Text style={[styles.statusTag]}>{order.statusLabel}</Text>
      </View>
      <Text style={styles.hotelName} numberOfLines={2}>
        {order.hotelName || "酒店名称加载中"}
      </Text>
      <Text style={styles.hotelAddr} numberOfLines={1}>
        {order.hotelCity || order.hotelCounty
          ? `${order.hotelCity || ""}${order.hotelCounty || ""} · ${order.hotelAddress || ""}`
          : order.hotelAddress || ""}
      </Text>
      <View style={styles.dateRow}>
        <Text style={styles.dateText}>{dateText}</Text>
        <Text style={styles.dateText}>{metaText}</Text>
      </View>
      <View style={styles.footerRow}>
        <Text style={styles.tipText}>
          {order.paymentStatus === "unpaid" ? "延迟付款" : "已支付"}
        </Text>
        <Text style={styles.amountText}>{amountText}</Text>
      </View>
    </View>
  );
}

export default function OrdersScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [customerId, setCustomerId] = useState<string | null>(null);
  const [orders, setOrders] = useState<MobileOrder[]>([]);
  const [activeStatus, setActiveStatus] = useState<StatusKey>("all");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const info = await AsyncStorage.getItem("customer_info");
        if (!mounted) return;
        if (info) {
          const parsed = JSON.parse(info);
          if (parsed?.id) {
            setCustomerId(String(parsed.id));
          }
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!customerId) return;
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const { list } = await fetchMobileOrders({
          customerId,
          status: activeStatus === "all" ? undefined : activeStatus,
          page: 1,
          pageSize: 20,
        });
        if (!cancelled) setOrders(list);
      } catch {
        if (!cancelled) setOrders([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [customerId, activeStatus]);

  const handleRefresh = async () => {
    if (!customerId) return;
    setRefreshing(true);
    try {
      const { list } = await fetchMobileOrders({
        customerId,
        status: activeStatus === "all" ? undefined : activeStatus,
        page: 1,
        pageSize: 20,
      });
      setOrders(list);
    } finally {
      setRefreshing(false);
    }
  };

  const renderContent = () => {
    if (!customerId) {
      return (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>暂未登录</Text>
          <Text style={styles.emptyDesc}>登录后可查看近一年内的订单。</Text>
          <Pressable
            style={styles.primaryBtn}
            onPress={() => router.push("/login")}
          >
            <Text style={styles.primaryBtnText}>去登录</Text>
          </Pressable>
        </View>
      );
    }

    if (loading && !orders.length) {
      return (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color="#1890FF" />
          <Text style={styles.loadingText}>加载订单中...</Text>
        </View>
      );
    }

    if (!loading && !orders.length) {
      return (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>暂无订单</Text>
          <Text style={styles.emptyDesc}>点击酒店列表中的房型即可下单。</Text>
        </View>
      );
    }

    return (
      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <OrderCard order={item} />}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={["#1890FF"]}
          />
        }
      />
    );
  };

  return (
    <View
      style={[
        styles.screen,
        { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8 },
      ]}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>订单</Text>
        <Text style={styles.headerSub}>只展示最近一年内订单</Text>
      </View>

      <View style={styles.tabRow}>
        {STATUS_TABS.map((tab) => {
          const active = tab.key === activeStatus;
          return (
            <Pressable
              key={tab.key}
              style={[styles.tabItem, active && styles.tabItemActive]}
              onPress={() => setActiveStatus(tab.key)}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.divider} />

      <View style={styles.body}>{renderContent()}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F7F8FA",
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#111827",
  },
  headerSub: {
    marginTop: 4,
    fontSize: 12,
    color: "#6B7280",
  },
  tabRow: {
    flexDirection: "row",
    paddingHorizontal: 12,
    marginBottom: 4,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 999,
  },
  tabItemActive: {
    backgroundColor: "#E6F4FF",
  },
  tabText: {
    fontSize: 14,
    color: "#6B7280",
  },
  tabTextActive: {
    color: "#1890FF",
    fontWeight: "600",
  },
  divider: {
    height: 0.5,
    backgroundColor: "#E5E7EB",
  },
  body: {
    flex: 1,
  },
  listContent: {
    padding: 12,
    paddingBottom: 24,
  },
  card: {
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  cardType: {
    fontSize: 13,
    color: "#6B7280",
  },
  statusTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#F3F4F6",
    fontSize: 12,
    color: "#4B5563",
  },
  hotelName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
  },
  hotelAddr: {
    marginTop: 4,
    fontSize: 12,
    color: "#6B7280",
  },
  dateRow: {
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  dateText: {
    fontSize: 12,
    color: "#4B5563",
  },
  footerRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  tipText: {
    fontSize: 12,
    color: "#F97316",
  },
  amountText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 4,
  },
  emptyDesc: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 16,
  },
  primaryBtn: {
    minWidth: 140,
    borderRadius: 999,
    backgroundColor: "#1890FF",
    paddingVertical: 10,
    paddingHorizontal: 24,
    alignItems: "center",
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 8,
    fontSize: 13,
    color: "#6B7280",
  },
});
