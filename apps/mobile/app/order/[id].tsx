import {
  fetchMobileOrders,
  fetchOrderBreakdown,
  payMobileOrder,
  type MobileOrder,
} from "@/lib/api";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function OrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [customerId, setCustomerId] = useState<string | null>(null);
  const [order, setOrder] = useState<MobileOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [payVisible, setPayVisible] = useState(false);
  const [processingPay, setProcessingPay] = useState(false);
  const [breakdownVisible, setBreakdownVisible] = useState(false);
  const [breakdown, setBreakdown] = useState<any | null>(null);
  const [cancelVisible, setCancelVisible] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const info = await AsyncStorage.getItem("customer_info");
        if (info) {
          const parsed = JSON.parse(info);
          if (parsed?.id) setCustomerId(String(parsed.id));
        }
      } catch {}
    })();
  }, []);

  useEffect(() => {
    let mounted = true;
    if (!id || !customerId) return;
    setLoading(true);
    (async () => {
      try {
        const { list } = await fetchMobileOrders({
          customerId,
          page: 1,
          pageSize: 200,
        });
        if (!mounted) return;
        const found = list.find((o) => o.id === id) || null;
        setOrder(found);
      } catch (e) {
        setOrder(null);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id, customerId]);

  const handlePay = async () => {
    if (!order || !customerId) {
      Alert.alert("无法支付", "缺少订单或未登录");
      return;
    }
    setProcessingPay(true);
    try {
      await payMobileOrder(order.id, customerId);
      // refresh by re-fetching
      const { list } = await fetchMobileOrders({
        customerId,
        page: 1,
        pageSize: 200,
      });
      const found = list.find((o) => o.id === id) || null;
      setOrder(found);
      setPayVisible(false);
      Alert.alert("支付成功", "已成功支付");
    } catch (e: any) {
      Alert.alert("支付失败", e?.message || String(e));
    } finally {
      setProcessingPay(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="small" color="#1890FF" />
        <Text style={{ marginTop: 8 }}>加载订单中...</Text>
      </View>
    );
  }

  if (!order) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <Text style={{ fontSize: 18, fontWeight: "600" }}>订单不存在</Text>
        <Text style={{ marginTop: 8, color: "#6B7280" }}>
          无法找到该订单或不属于当前用户。
        </Text>
        <Pressable
          style={{ marginTop: 16 }}
          onPress={() => router.replace("/(tabs)/cart")}
        >
          <Text style={{ color: "#1890FF" }}>返回订单页</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 0, paddingTop: insets.top }}>
      <View
        style={{ padding: 16, backgroundColor: "#fff", alignItems: "center" }}
      >
        <Text style={{ color: "#111827", fontSize: 14 }}>订单号{order.id}</Text>
        <Text
          style={{
            marginTop: 12,
            fontSize: 28,
            fontWeight: "700",
            color: "#111827",
          }}
        >
          {order.statusLabel}
        </Text>
      </View>

      <View style={{ padding: 16, backgroundColor: "#fff", marginTop: 8 }}>
        <Text style={{ color: "#6B7280" }}>
          在线付{" "}
          <Text style={{ color: "#1890FF", fontWeight: "700" }}>
            ¥{order.payableAmount.toFixed(2)}
          </Text>
        </Text>
        <View style={{ marginTop: 8, flexDirection: "row" }}>
          <Pressable
            onPress={async () => {
              try {
                const data = await fetchOrderBreakdown(order.id);
                setBreakdown(data);
                setBreakdownVisible(true);
              } catch (e: any) {
                Alert.alert("获取费用明细失败", e?.message || String(e));
              }
            }}
            style={{ marginRight: 16 }}
          >
            <Text style={{ color: "#1890FF" }}>费用明细</Text>
          </Pressable>
          <Pressable onPress={() => setCancelVisible(true)}>
            <Text style={{ color: "#1890FF" }}>取消政策</Text>
          </Pressable>
        </View>
      </View>

      <View style={{ backgroundColor: "#fff", marginTop: 8, padding: 16 }}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Pressable
            style={{ flex: 1 }}
            onPress={() => {
              if (!order?.hotelId) return;
              router.push({
                pathname: "/hotel/[id]",
                params: {
                  id: String(order.hotelId),
                  checkIn: String(order.checkIn || ""),
                  checkOut: String(order.checkOut || ""),
                  from: "order",
                },
              });
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: "600", color: "#111827" }}>
              {order.hotelName}
            </Text>
            <Text style={{ marginTop: 6, color: "#1890FF" }}>酒店详情</Text>
          </Pressable>
          <Image
            source={{
              uri: order.hotelName
                ? `https://picsum.photos/seed/hotel_${order.id}/120/80`
                : "",
            }}
            style={{ width: 80, height: 60, borderRadius: 8 }}
          />
        </View>

        <View
          style={{
            flexDirection: "row",
            marginTop: 12,
            justifyContent: "space-between",
          }}
        >
          <Pressable
            style={{
              flex: 1,
              marginRight: 8,
              paddingVertical: 10,
              borderRadius: 8,
              backgroundColor: "#F3F4F6",
              alignItems: "center",
            }}
          >
            <Text>发消息给酒店</Text>
          </Pressable>
          <Pressable
            style={{
              flex: 1,
              marginLeft: 8,
              paddingVertical: 10,
              borderRadius: 8,
              backgroundColor: "#F3F4F6",
              alignItems: "center",
            }}
          >
            <Text>致电酒店</Text>
          </Pressable>
        </View>

        <View
          style={{
            marginTop: 16,
            borderTopWidth: 1,
            borderTopColor: "#F3F4F6",
            paddingTop: 12,
          }}
        >
          <Text style={{ fontSize: 14 }}>
            📅 {order.checkIn} 至 {order.checkOut} | {order.nights} 晚
          </Text>
          <Text style={{ marginTop: 6, color: "#6B7280" }}>
            入住：14:00后 离店：14:00前
          </Text>
        </View>

        <View style={{ marginTop: 12 }}>
          <Text style={{ fontSize: 14, fontWeight: "600" }}>酒店位置</Text>
          <Text style={{ marginTop: 6, color: "#6B7280" }}>
            {order.hotelCity}
            {order.hotelAddress ? ` ${order.hotelAddress}` : ""}
          </Text>
          
        </View>
      </View>

      <View style={{ backgroundColor: "#fff", marginTop: 8, padding: 16 }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: "600" }}>
                {order.roomName} {order.roomsCount}间{order.nights}晚
              </Text>
              {(() => {
                const raw = (order as any).raw;
                let tags: string[] = [];
                if (Array.isArray(raw?.remarkTags)) tags = raw.remarkTags;
                else if (raw?.remark)
                  tags = String(raw.remark)
                    .split(",")
                    .map((s: string) => s.trim())
                    .filter(Boolean);
                else if (Array.isArray((order as any).remarkTags))
                  tags = (order as any).remarkTags;
                else if ((order as any).remark)
                  tags = String((order as any).remark)
                    .split(",")
                    .map((s: string) => s.trim())
                    .filter(Boolean);
                else if (order?.notes)
                  tags = String(order.notes)
                    .split(",")
                    .map((s: string) => s.trim())
                    .filter(Boolean);

                if (!tags || tags.length === 0) return null;
                return (
                  <View style={{ marginTop: 8, flexDirection: "row", flexWrap: "wrap" }}>
                    {tags.map((t, idx) => (
                      <View
                        key={`${t}-${idx}`}
                        style={{
                          paddingHorizontal: 8,
                          paddingVertical: 4,
                          backgroundColor: "#F3F4F6",
                          borderRadius: 6,
                          borderWidth: 1,
                          borderColor: "#E5E7EB",
                          marginRight: 8,
                          marginBottom: 8,
                        }}
                      >
                        <Text style={{ fontSize: 12, color: "#374151" }}>{t}</Text>
                      </View>
                    ))}
                  </View>
                );
              })()}
            </View>
            <Image
              source={{
                uri: `https://picsum.photos/seed/room_${order.id}/88/64`,
              }}
              style={{ width: 88, height: 64, borderRadius: 8 }}
            />
          </View>

        <View
          style={{
            marginTop: 12,
            borderTopWidth: 1,
            borderTopColor: "#F3F4F6",
            paddingTop: 12,
          }}
        >
          <Text style={{ marginBottom: 8 }}>👤 {order.guestName}</Text>
          <Text>
            📞{" "}
            {String(order.guestPhone || "").replace(
              /(\d{3})\d{4}(\d{4})/,
              "$1****$2",
            )}
          </Text>
        </View>
      </View>

      <View style={{ height: 60 }} />

      <Modal
        visible={payVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPayVisible(false)}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "flex-end",
            backgroundColor: "rgba(0,0,0,0.4)",
          }}
        >
          <View
            style={{
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              backgroundColor: "#fff",
              padding: 20,
            }}
          >
            <Text
              style={{ textAlign: "center", fontSize: 16, fontWeight: "600" }}
            >
              微信支付
            </Text>
            <Text
              style={{
                marginTop: 8,
                textAlign: "center",
                color: "#6B7280",
                fontSize: 12,
              }}
            >
              模拟微信支付（不会真实扣款）
            </Text>
            <Text
              style={{
                marginTop: 16,
                textAlign: "center",
                fontSize: 28,
                color: "#10B981",
                fontWeight: "700",
              }}
            >
              ¥{order.payableAmount.toFixed(2)}
            </Text>

            <View style={{ flexDirection: "row", marginTop: 20 }}>
              <Pressable
                style={{
                  flex: 1,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: "#E5E7EB",
                  paddingVertical: 12,
                  alignItems: "center",
                  marginRight: 8,
                }}
                onPress={() => setPayVisible(false)}
              >
                <Text style={{ color: "#374151" }}>取消</Text>
              </Pressable>
              <Pressable
                style={{
                  flex: 1,
                  borderRadius: 999,
                  backgroundColor: "#1890FF",
                  paddingVertical: 12,
                  alignItems: "center",
                  marginLeft: 8,
                }}
                onPress={handlePay}
              >
                <Text style={{ color: "#fff", fontWeight: "600" }}>
                  {processingPay ? "支付中..." : "确认支付"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <Modal
        visible={breakdownVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setBreakdownVisible(false)}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "flex-end",
            backgroundColor: "rgba(0,0,0,0.4)",
          }}
        >
          <View
            style={{
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              backgroundColor: "#fff",
              padding: 16,
              maxHeight: "70%",
            }}
          >
            <Text
              style={{ fontSize: 16, fontWeight: "700", textAlign: "center" }}
            >
              费用明细
            </Text>
            <ScrollView style={{ marginTop: 12 }}>
              {breakdown?.items?.map((it: any, idx: number) => (
                <View
                  key={idx}
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    paddingVertical: 8,
                  }}
                >
                  <Text>{it.label}</Text>
                  <Text>¥{Number(it.amount).toFixed(2)}</Text>
                </View>
              ))}
              {breakdown?.discounts?.map((d: any, idx: number) => (
                <View
                  key={`d${idx}`}
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    paddingVertical: 8,
                  }}
                >
                  <Text style={{ color: "#6B7280" }}>{d.label}</Text>
                  <Text style={{ color: "#6B7280" }}>
                    ¥{Number(d.amount).toFixed(2)}
                  </Text>
                </View>
              ))}
              <View style={{ height: 8 }} />
              <View
                style={{
                  borderTopWidth: 1,
                  borderTopColor: "#F3F4F6",
                  paddingTop: 12,
                  flexDirection: "row",
                  justifyContent: "space-between",
                }}
              >
                <Text style={{ fontWeight: "700" }}>总计</Text>
                <Text style={{ color: "#1890FF", fontWeight: "700" }}>
                  ¥{Number(breakdown?.total || 0).toFixed(2)}
                </Text>
              </View>
            </ScrollView>
            <Pressable
              onPress={() => setBreakdownVisible(false)}
              style={{
                position: "absolute",
                top: 12,
                right: 12,
                width: 36,
                height: 36,
                borderRadius: 6,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#EF4444",
              }}
              accessibilityLabel="关闭"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text
                style={{
                  fontSize: 18,
                  lineHeight: 18,
                  color: "#FFFFFF",
                  fontWeight: "700",
                }}
              >
                ×
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      <Modal
        visible={cancelVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCancelVisible(false)}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            backgroundColor: "rgba(0,0,0,0.4)",
            padding: 24,
          }}
        >
          <View
            style={{
              borderRadius: 12,
              backgroundColor: "#fff",
              padding: 16,
            }}
          >
            <Text
              style={{ fontSize: 16, fontWeight: "700", textAlign: "center" }}
            >
              取消政策
            </Text>
            <Text style={{ marginTop: 12, color: "#6B7280", lineHeight: 20 }}>
              {order?.notes || "请联系商家确认该房型是否可取消！"}
            </Text>
            <Pressable
              onPress={() => setCancelVisible(false)}
              style={{
                position: "absolute",
                top: 12,
                right: 12,
                width: 36,
                height: 36,
                borderRadius: 6,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#EF4444",
              }}
              accessibilityLabel="关闭"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text
                style={{
                  fontSize: 18,
                  lineHeight: 18,
                  color: "#FFFFFF",
                  fontWeight: "700",
                }}
              >
                ×
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
