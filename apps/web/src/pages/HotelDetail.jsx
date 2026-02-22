import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertCircle,
  ArrowLeft,
  Ban,
  BedDouble,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Coffee,
  Edit,
  EyeOff,
  LogOut,
  MapPin,
  Maximize,
  Star,
  UserCircle,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "../styles/hotel-detail.css";

function authUser() {
  try {
    return JSON.parse(sessionStorage.getItem("authUser") || "null");
  } catch {
    return null;
  }
}

function getStatusMeta(hotel) {
  const audit = Number(hotel?.audit_status);
  const online = Number(hotel?.online_status);
  if (audit === 0)
    return {
      label: "待审核",
      bg: "bg-amber-100",
      text: "text-amber-700",
      ring: "ring-amber-200",
    };
  if (audit === 1 && online === 0)
    return {
      label: "待发布",
      bg: "bg-blue-100",
      text: "text-blue-700",
      ring: "ring-blue-200",
    };
  if (audit === 1 && online === 1)
    return {
      label: "营业中",
      bg: "bg-emerald-100",
      text: "text-emerald-700",
      ring: "ring-emerald-200",
    };
  if (audit === 2)
    return {
      label: "被驳回",
      bg: "bg-rose-100",
      text: "text-rose-700",
      ring: "ring-rose-200",
    };
  return {
    label: "未知",
    bg: "bg-slate-100",
    text: "text-slate-700",
    ring: "ring-slate-200",
  };
}

export default function HotelDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = authUser();

  const [hotel, setHotel] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const isAdmin = user?.role === "admin";
  const [toast, setToast] = useState(null);
  const [promptModal, setPromptModal] = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  function formatCnDate(value) {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}年${m}月${day}日`;
  }

  async function load() {
    if (!id) return;
    const [hRes, rRes] = await Promise.all([
      fetch(`/api/hotels/${id}`),
      fetch(`/api/hotels/${id}/rooms`),
    ]);

    const hJson = await hRes.json().catch(() => null);
    const rJson = await rRes.json().catch(() => null);

    if (hRes.ok && hJson?.data) setHotel(hJson.data);

    if (rRes.ok && Array.isArray(rJson?.data)) {
      const deleted = JSON.parse(
        localStorage.getItem(`deletedRooms:${id}`) || "[]",
      );
      const extras = JSON.parse(
        localStorage.getItem(`roomExtras:${id}`) || "{}",
      );

      const activeRooms = rJson.data
        .filter((r) => !deleted.includes(String(r.id)))
        .map((r) => {
          const idKey = r.id ? String(r.id) : "";
          const typeKey = r.type ? String(r.type).trim() : "";
          const matched = extras[idKey] || extras[typeKey] || {};
          return { ...r, ...matched };
        });
      setRooms(activeRooms);
    }
  }

  useEffect(() => {
    if (!user) {
      navigate("/login", { replace: true });
      return;
    }
    load().catch(() => {});
  }, [id, user]);

  const bannerImages = useMemo(() => {
    if (Array.isArray(hotel?.images) && hotel.images.length)
      return hotel.images;
    if (hotel?.image) return [hotel.image];
    return [];
  }, [hotel]);

  // ====== 自动轮播图逻辑 ======
  useEffect(() => {
    if (bannerImages.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % bannerImages.length);
    }, 3500);
    return () => clearInterval(timer);
  }, [bannerImages.length]);

  function triggerAudit(action) {
    if (action === "reject") {
      setPromptModal({
        title: "驳回审核",
        msg: "请输入驳回该酒店的原因：",
        placeholder: "必填，如：资质图片不清晰",
        isCritical: true,
        onConfirm: async (reason) => {
          if (!reason.trim()) {
            showToast("驳回原因不能为空", "error");
            return false;
          }
          await executeAudit(action, reason);
          return true;
        },
      });
    } else {
      setPromptModal({
        title: "审核通过",
        msg: "可填写审核备注（选填）：",
        placeholder: "如：已核实资质无误",
        defaultValue: "审核通过，待发布上线。",
        onConfirm: async (reason) => {
          await executeAudit(action, reason);
          return true;
        },
      });
    }
  }

  // ====== 核心修改：下线拦截函数 ======
  function confirmOffline() {
    setPromptModal({
      title: "确认下线资产",
      msg: "将该资产下线后，客户端用户将无法搜索和预订此酒店的所有房型。您确定要执行此操作吗？",
      placeholder: "请输入下线原因 (选填)",
      isCritical: true,
      onConfirm: async () => {
        await offline();
        return true;
      },
    });
  }

  async function executeAudit(action, reason) {
    try {
      await fetch(`/api/admin/hotels/${id}/audit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          reason: reason || "",
          auditorId: user.id,
        }),
      });
      showToast(`操作成功：已${action === "reject" ? "驳回" : "通过"}`);
      await load();
    } catch (e) {
      showToast("审核操作失败", "error");
    }
  }

  async function publish() {
    try {
      await fetch(`/api/admin/hotels/${id}/publish`, { method: "POST" });
      showToast("酒店已成功发布上线！");
      await load();
    } catch (e) {
      showToast("发布上线失败", "error");
    }
  }

  async function offline() {
    try {
      const endpoint = isAdmin
        ? `/api/admin/hotels/${id}/offline`
        : `/api/hotels/${id}`;
      await fetch(endpoint, { method: isAdmin ? "POST" : "DELETE" });
      showToast("酒店已成功下线隐藏");
      await load();
    } catch (e) {
      showToast("下线操作失败", "error");
    }
  }

  function logout() {
    sessionStorage.clear();
    navigate("/login", { replace: true });
  }

  if (!hotel)
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-400">
        正在加载资产数据...
      </div>
    );

  const statusMeta = getStatusMeta(hotel);

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 pb-16">
      {toast && (
        <div className={`custom-toast ${toast.type}`}>
          {toast.type === "success" ? (
            <CheckCircle2 size={18} />
          ) : (
            <AlertCircle size={18} />
          )}
          <span>{toast.msg}</span>
        </div>
      )}

      {promptModal && (
        <div className="custom-modal-overlay">
          <div className="custom-modal">
            <div className="modal-header">
              <h3>{promptModal.title}</h3>
              <button
                className="close-btn"
                onClick={() => setPromptModal(null)}
              >
                <X size={20} />
              </button>
            </div>
            <p>{promptModal.msg}</p>
            {/* ====== 针对部分只需确认不需填原因的场景，也可以隐藏输入框。这里保留以便输入下线原因 ====== */}
            <input
              type="text"
              className="modal-input"
              placeholder={promptModal.placeholder}
              defaultValue={promptModal.defaultValue || ""}
              id="prompt-input"
              autoFocus
            />
            <div className="modal-actions">
              <button
                className="btn-modal cancel"
                onClick={() => setPromptModal(null)}
              >
                取消
              </button>
              <button
                className={`btn-modal confirm ${promptModal.isCritical ? "danger" : ""}`}
                onClick={async () => {
                  const inputVal =
                    document.getElementById("prompt-input").value;
                  const shouldClose = await promptModal.onConfirm(inputVal);
                  if (shouldClose) setPromptModal(null);
                }}
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}

      <nav className="sticky top-0 z-40 w-full backdrop-blur-md bg-white/80 border-b border-slate-200/60 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 shadow-inner flex items-center justify-center text-white font-bold text-lg">
              <Building2 size={20} />
            </div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-600 tracking-tight">
              易宿平台{" "}
              <span className="font-normal text-slate-400 mx-2">|</span>{" "}
              资产详情
            </span>
          </div>
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100/80 rounded-full border border-slate-200/50">
              <UserCircle size={18} className="text-slate-500" />
              <span className="text-sm font-medium text-slate-600">
                {user?.name || user?.account}{" "}
                <span className="text-slate-400 text-xs ml-1">
                  ({isAdmin ? "Admin" : "Merchant"})
                </span>
              </span>
            </div>
            <button
              onClick={logout}
              className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-full transition-colors group"
            >
              <LogOut
                size={18}
                className="group-hover:-translate-x-0.5 transition-transform"
              />
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 mt-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <button
            onClick={() => navigate("/dashboard")}
            className="inline-flex items-center gap-2 text-slate-500 hover:text-blue-600 font-medium transition-colors w-fit"
          >
            <ArrowLeft size={18} /> 返回工作台
          </button>

          <div className="flex flex-wrap items-center gap-3">
            {user?.role === "merchant" && (
              <>
                <button
                  onClick={() => navigate(`/hotels/${id}/edit`)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:text-blue-600 hover:bg-blue-50 hover:border-blue-200 rounded-xl text-sm font-semibold shadow-sm transition-all duration-200"
                >
                  <Edit size={16} /> 编辑基本信息
                </button>

                <button
                  onClick={() => navigate(`/hotels/${id}/rooms`)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-700 text-white hover:bg-slate-800 rounded-xl text-sm font-semibold shadow-md hover:shadow-lg transition-all duration-200"
                >
                  <BedDouble size={16} /> 管理房型与库存
                </button>
              </>
            )}

            {isAdmin && Number(hotel.audit_status) === 0 && (
              <>
                <button
                  onClick={() => triggerAudit("approve")}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-500 text-white hover:bg-emerald-600 rounded-xl text-sm font-semibold shadow-md transition-all"
                >
                  <CheckCircle2 size={16} /> 批准
                </button>
                <button
                  onClick={() => triggerAudit("reject")}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 text-rose-600 hover:bg-rose-50 hover:border-rose-200 rounded-xl text-sm font-semibold shadow-sm transition-all"
                >
                  <AlertCircle size={16} /> 驳回
                </button>
              </>
            )}

            {isAdmin &&
              Number(hotel.audit_status) === 1 &&
              Number(hotel.online_status) === 0 && (
                <button
                  onClick={publish}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-xl text-sm font-semibold shadow-md shadow-blue-500/20 transition-all"
                >
                  发布上线
                </button>
              )}

            {/* ====== 核心修改：点击时调用 confirmOffline 触发拦截弹窗 ====== */}
            {(Number(hotel.online_status) === 1 ||
              user?.role === "merchant") && (
              <button
                onClick={confirmOffline}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 text-slate-600 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 rounded-xl text-sm font-semibold shadow-sm transition-all duration-200"
              >
                <EyeOff size={16} /> 下线隐藏
              </button>
            )}
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200/70 shadow-sm overflow-hidden mb-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-0">
            <div className="lg:col-span-7 relative bg-slate-100 aspect-[4/3] lg:aspect-auto group overflow-hidden">
              {bannerImages.length ? (
                bannerImages.map((img, idx) => (
                  <img
                    key={idx}
                    src={img}
                    alt={`hotel cover ${idx}`}
                    className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out ${
                      idx === currentImageIndex
                        ? "opacity-100 z-10"
                        : "opacity-0 z-0"
                    }`}
                    onError={(e) => {
                      e.currentTarget.src =
                        "https://picsum.photos/seed/fallback/1280/720";
                    }}
                  />
                ))
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-slate-400 font-medium">
                  暂无图片
                </div>
              )}

              {bannerImages.length > 1 && (
                <>
                  <button
                    onClick={() =>
                      setCurrentImageIndex(
                        (prev) =>
                          (prev - 1 + bannerImages.length) %
                          bannerImages.length,
                      )
                    }
                    className="absolute z-20 left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/20 hover:bg-black/50 backdrop-blur-md text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300"
                  >
                    <ChevronLeft size={24} />
                  </button>
                  <button
                    onClick={() =>
                      setCurrentImageIndex(
                        (prev) => (prev + 1) % bannerImages.length,
                      )
                    }
                    className="absolute z-20 right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/20 hover:bg-black/50 backdrop-blur-md text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300"
                  >
                    <ChevronRight size={24} />
                  </button>
                  <div className="absolute z-20 bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/30 backdrop-blur-md">
                    {bannerImages.map((_, idx) => (
                      <div
                        key={idx}
                        className={`w-1.5 h-1.5 rounded-full transition-colors ${idx === currentImageIndex ? "bg-white w-3" : "bg-white/40"}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="lg:col-span-5 p-8 lg:p-10 flex flex-col justify-center">
              <div className="flex items-center gap-3 mb-4">
                <span
                  className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-bold ring-1 shadow-sm ${statusMeta.bg} ${statusMeta.text} ${statusMeta.ring}`}
                >
                  {statusMeta.label}
                </span>

                {Number(hotel.audit_status) === 2 && hotel.audit_reason && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="inline-flex items-center gap-1 text-xs text-rose-600 bg-rose-50 hover:bg-rose-100 px-2 py-1 rounded-md border border-rose-100 transition-colors">
                        <AlertCircle size={14} /> 驳回说明
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-72 p-4 rounded-xl shadow-xl border-rose-100/50"
                      align="start"
                    >
                      <div className="space-y-2">
                        <h4 className="font-bold text-rose-600 flex items-center gap-1.5 text-sm">
                          <AlertCircle size={16} /> 驳回说明
                        </h4>
                        <p className="text-sm text-slate-600 whitespace-pre-wrap">
                          {hotel.audit_reason}
                        </p>
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
              </div>

              <h1 className="text-3xl font-extrabold text-slate-900 mb-1 leading-tight">
                {hotel.name}
              </h1>
              <p className="text-sm text-slate-400 font-mono mb-6">
                {hotel.nameEn || "English Name Not Provided"}
              </p>

              <div className="space-y-4 mb-8">
                <div className="flex items-start gap-3">
                  <Star size={18} className="text-amber-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-slate-500 mb-0.5">酒店星级</p>
                    <p className="font-semibold text-slate-700">
                      {hotel.starLevel} 星级标准
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Building2 size={18} className="text-blue-500 mt-0.5" />
                  <div>
                    <p className="text-sm text-slate-500 mb-0.5">开业日期</p>
                    <p className="font-semibold text-slate-700">
                      {formatCnDate(hotel.openTime) || "未设置"}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <MapPin
                    size={18}
                    className="text-emerald-500 mt-0.5 shrink-0"
                  />
                  <div>
                    <p className="text-sm text-slate-500 mb-0.5">详细地址</p>
                    <p className="font-semibold text-slate-700 leading-snug">
                      {hotel.fullAddress}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-auto">
                <p className="text-xs text-slate-400 mb-3 uppercase tracking-widest font-semibold">
                  酒店设施标签
                </p>
                <div className="flex flex-wrap gap-2">
                  {hotel.labels?.length ? (
                    hotel.labels.map((l) => (
                      <span
                        key={l}
                        className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-medium border border-slate-200/60"
                      >
                        {l}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-slate-400">暂无标签</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200/70 shadow-sm p-6 lg:p-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              房型与库存
            </h3>
            <span className="text-xs font-medium text-slate-500 bg-slate-100 px-3 py-1 rounded-lg">
              价格从低到高排列
            </span>
          </div>

          <div className="flex flex-col gap-4">
            {rooms.length ? (
              [...rooms]
                .sort(
                  (a, b) =>
                    (Number(a.price) || Number(a.current)) -
                    (Number(b.price) || Number(b.current)),
                )
                .map((r) => {
                  const stockVal =
                    r.remain ??
                    r.stock ??
                    r.inventory ??
                    r.available ??
                    r.roomCount;
                  const stock = stockVal !== undefined ? Number(stockVal) : 10;

                  const dbStatus = String(r.status);
                  const isSoldOut =
                    dbStatus === "1" || dbStatus === "soldout" || stock <= 0;
                  const isTight = !isSoldOut && stock > 0 && stock < 5;

                  let statusConfig = {
                    text: "可预订",
                    bg: "bg-emerald-50",
                    textCol: "text-emerald-600",
                    dot: "bg-emerald-500",
                    border: "border-emerald-100",
                  };
                  if (isSoldOut) {
                    statusConfig = {
                      text: "已售罄",
                      bg: "bg-rose-50",
                      textCol: "text-rose-600",
                      dot: "bg-rose-500",
                      border: "border-rose-100",
                    };
                  } else if (isTight) {
                    statusConfig = {
                      text: "房量紧张",
                      bg: "bg-amber-50",
                      textCol: "text-amber-600",
                      dot: "bg-amber-500",
                      border: "border-amber-100",
                    };
                  }

                  return (
                    <div
                      key={r.id}
                      className="group flex flex-col md:flex-row items-center gap-6 p-4 bg-white border border-slate-100 rounded-2xl hover:border-blue-200 hover:shadow-xl hover:shadow-blue-900/5 transition-all duration-300"
                    >
                      <div className="relative w-32 h-24 rounded-xl overflow-hidden bg-slate-100 shadow-sm shrink-0 border border-slate-200/50">
                        {r.image ? (
                          <img
                            src={r.image}
                            alt={r.name || r.type}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                            onError={(e) => {
                              e.currentTarget.src =
                                "https://picsum.photos/seed/room/800/500";
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">
                            暂无配图
                          </div>
                        )}
                        <div className="absolute inset-0 shadow-inner rounded-xl pointer-events-none"></div>
                      </div>

                      <div className="flex-1 w-full flex flex-col gap-2">
                        <span className="text-lg font-bold text-slate-800 group-hover:text-blue-600 transition-colors line-clamp-1">
                          {r.name || r.type}
                        </span>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-600">
                          <span className="flex items-center gap-1.5 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                            <Users size={14} className="text-slate-400" />
                            最多 {r.capacity || r.occupancy || "-"} 人
                          </span>
                          <span className="flex items-center gap-1.5 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                            <Maximize size={14} className="text-slate-400" />
                            面积 {r.size || r.area || "-"} ㎡
                          </span>
                          <span className="flex items-center gap-1.5 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                            <Coffee size={14} className="text-slate-400" />
                            {Number(r.breakfast_included) === 1
                              ? "含双早"
                              : "无早餐"}
                          </span>
                          {Number(r.refundable) === 1 ? (
                            <span className="flex items-center gap-1.5 text-emerald-600 font-medium">
                              <CheckCircle2 size={14} /> 免费取消
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5 text-slate-400">
                              <Ban size={14} /> 不可取消
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0 flex flex-row md:flex-col justify-between md:justify-end items-center md:items-end w-full md:w-auto mt-2 md:mt-0 md:border-l border-slate-100 md:pl-6">
                        <div
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border mb-0 md:mb-2 ${statusConfig.bg} ${statusConfig.textCol} ${statusConfig.border}`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot} ${!isSoldOut ? "animate-pulse" : ""}`}
                          ></span>
                          <span>{statusConfig.text}</span>
                          {!isSoldOut && (
                            <span className="opacity-80">({stock}间)</span>
                          )}
                        </div>

                        <div className="text-right">
                          <div className="flex items-baseline justify-end gap-0.5">
                            <span className="text-sm font-bold text-slate-400">
                              ¥
                            </span>
                            <span className="text-3xl font-black text-slate-800 tracking-tight group-hover:text-blue-600 transition-colors">
                              {r.price || r.current || 0}
                            </span>
                          </div>
                          <div className="text-[11px] font-medium text-slate-400 mt-1">
                            每晚 (含税/费)
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
            ) : (
              <div className="py-16 flex flex-col items-center justify-center text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                <div className="text-slate-400 font-medium mb-1">
                  尚未配置任何房型
                </div>
                <p className="text-xs text-slate-400">
                  请点击右上角“管理房型与库存”进行添加
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
