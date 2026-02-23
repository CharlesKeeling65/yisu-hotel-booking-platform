import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  CalendarIcon,
  CheckCircle2,
  LogOut,
  Trash2,
  UploadCloud,
  UserCircle,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

// ======= 引入 shadcn 高级组件 =======
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

import "../styles/hotel-edit.css";

const LABEL_OPTIONS = [
  "免费停车",
  "亲子友好",
  "可带宠物",
  "豪华酒店",
  "商务出行",
  "近地铁",
  "含早餐",
  "泳池健身",
  "江景海景",
  "免费取消",
];

const REQUIRED_FIELDS = [
  { key: "name", label: "酒店中文名" },
  { key: "nameEn", label: "酒店英文名" },
  { key: "province", label: "省份" },
  { key: "city", label: "城市" },
  { key: "county", label: "区县" },
  { key: "openTime", label: "开业日期" },
  { key: "longitude", label: "经度" },
  { key: "latitude", label: "纬度" },
  { key: "address", label: "详细地址" },
];

function authUser() {
  try {
    return JSON.parse(sessionStorage.getItem("authUser") || "null");
  } catch {
    return null;
  }
}

export default function HotelEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [hotel, setHotel] = useState(null);
  // 【核心修复 1】新增 originalHotel 用于存储初始数据快照
  const [originalHotel, setOriginalHotel] = useState(null);

  const [saving, setSaving] = useState(false);
  const user = useMemo(() => authUser(), []);

  const [toast, setToast] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);
  const [customLabel, setCustomLabel] = useState("");

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    if (!user) {
      navigate("/login", { replace: true });
      return;
    }

    if (id === "0") {
      setHotel({
        id: "0",
        name: "",
        nameEn: "",
        province: "",
        city: "",
        county: "",
        address: "",
        longitude: "",
        latitude: "",
        openTime: "",
        starLevel: 4,
        intro: "",
        scenicSpots: [],
        featuredWeight: 0,
        labels: [],
        images: [],
      });
      return;
    }

    fetch(`/api/hotels/${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("not found"))))
      .then((j) => {
        const h = j?.data;
        if (!h) return;

        const initData = {
          id: h.id,
          name: h.name || "",
          nameEn: h.nameEn || "",
          province: h.province || "",
          city: h.city || "",
          county: h.county || "",
          address: h.address || "",
          longitude: h.longitude || "",
          latitude: h.latitude || "",
          openTime: h.openTime ? String(h.openTime).slice(0, 10) : "",
          starLevel: Number(h.starLevel || h.star || 4),
          intro: h.intro || "",
          scenicSpots: Array.isArray(h.scenicSpots) ? h.scenicSpots : [],
          featuredWeight: Number(h.featuredWeight || 0),
          labels: Array.isArray(h.labels) ? h.labels : [],
          images: Array.isArray(h.images) ? h.images : h.image ? [h.image] : [],
        };

        setHotel(initData);
        // 【核心修复 2】深拷贝一份初始数据作为比对基准
        setOriginalHotel(JSON.parse(JSON.stringify(initData)));
      })
      .catch(() => setHotel(null));
  }, [id, navigate, user]);

  function updateField(key, value) {
    setHotel((prev) => ({ ...prev, [key]: value }));
  }

  function handleFiles(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    Promise.all(
      files.map(
        (file) =>
          new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (ev) => {
              const img = new Image();
              img.onload = () => resolve(resizeTo16x9(img, 1280, 720));
              img.src = ev.target.result;
            };
            reader.readAsDataURL(file);
          }),
      ),
    ).then((images) => {
      setHotel((prev) => ({
        ...prev,
        images: [...prev.images, ...images.filter(Boolean)],
      }));
    });
    e.target.value = "";
  }

  function removeImage(idx) {
    setHotel((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== idx),
    }));
  }

  function toggleLabel(label) {
    setHotel((prev) => {
      const has = prev.labels.includes(label);
      return {
        ...prev,
        labels: has
          ? prev.labels.filter((x) => x !== label)
          : [...prev.labels, label],
      };
    });
  }

  function handleAddCustomLabel() {
    const val = customLabel.trim();
    if (!val) return;
    if (hotel.labels.includes(val)) {
      showToast("该标签已存在", "error");
      return;
    }
    setHotel((prev) => ({ ...prev, labels: [...prev.labels, val] }));
    setCustomLabel("");
  }

  // 【核心修复 3】抽离统一的 Payload 构造函数，方便进行精准比对
  const buildPayload = (data) => ({
    merchantId: user?.id,
    name: data.name,
    nameEn: data.nameEn,
    province: data.province,
    city: data.city,
    county: data.county,
    address: data.address,
    longitude: Number(data.longitude) || 0,
    latitude: Number(data.latitude) || 0,
    openTime: data.openTime,
    starLevel: Number(data.starLevel || 4),
    intro: data.intro,
    scenicSpots: (data.scenicSpots || [])
      .map((x) => String(x).trim())
      .filter(Boolean),
    featuredWeight: Number(data.featuredWeight || 0),
    labels: data.labels || [],
    image: data.images && data.images[0] ? data.images[0] : "",
    images: data.images || [],
  });

  function triggerSubmit() {
    const missingFields = REQUIRED_FIELDS.filter((f) => !hotel[f.key]);
    if (missingFields.length > 0) {
      const missingLabels = missingFields.map((f) => `• ${f.label}`).join("\n");
      setConfirmModal({
        title: "缺少必填信息",
        msg: `请完善以下必填项后再提交审核：\n${missingLabels}`,
        confirmText: "去补充",
        hideCancel: true,
        onConfirm: () => {},
      });
      return;
    }

    // 【核心修复 4】在弹窗前，比对当前数据与快照数据
    if (id !== "0" && originalHotel) {
      const currentPayload = buildPayload(hotel);
      const oldPayload = buildPayload(originalHotel);

      // 如果两个 JSON 完全一致，说明毫无修改
      if (JSON.stringify(currentPayload) === JSON.stringify(oldPayload)) {
        showToast("未检测到任何修改，酒店状态保持不变");
        // 延时返回详情页，完美规避重新审核
        setTimeout(() => navigate(`/hotels/${id}`), 1200);
        return;
      }
    }

    // 修改了弹窗的警示文案，告知用户改动会触发重新审核
    setConfirmModal({
      title: "确认提交修改",
      msg:
        id === "0"
          ? "确认酒店信息填写无误并提交审核吗？"
          : "修改酒店信息将导致其重新进入管理员审核队列，且酒店会暂时下线。确认修改无误并提交吗？",
      confirmText: "确认提交",
      hideCancel: false,
      onConfirm: () => executeSubmit(),
    });
  }

  async function executeSubmit() {
    const payload = buildPayload(hotel);

    setSaving(true);
    try {
      if (id === "0") {
        const res = await fetch("/api/hotels", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const j = await res.json();
        if (!res.ok) throw new Error(j?.msg || "保存失败");
        showToast("创建成功，即将前往配置房型...");
        setTimeout(() => {
          if (j?.data?.id) navigate(`/hotels/${j.data.id}/rooms`);
        }, 1500);
      } else {
        const res = await fetch(`/api/hotels/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const j = await res.json().catch(() => null);
        if (!res.ok) throw new Error(j?.msg || "保存失败");
        showToast("酒店信息更新成功，请等待审核！");
        setTimeout(() => navigate(`/hotels/${id}`), 1500);
      }
    } catch (e) {
      showToast(e?.message || "保存失败，请检查网络", "error");
    } finally {
      setSaving(false);
    }
  }

  function logout() {
    sessionStorage.clear();
    navigate("/login", { replace: true });
  }

  if (!hotel)
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-400">
        加载中...
      </div>
    );

  const allLabels = [...new Set([...LABEL_OPTIONS, ...hotel.labels])];

  const labelClass = "block text-[15px] font-bold text-slate-700 mb-2.5";
  const inputClass =
    "w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-xl text-base text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 focus:bg-white transition-all";

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 pb-20">
      {toast && (
        <div className={`custom-toast ${toast.type}`}>
          {toast.type === "success" ? (
            <CheckCircle2 size={20} />
          ) : (
            <AlertCircle size={20} />
          )}
          <span>{toast.msg}</span>
        </div>
      )}

      {confirmModal && (
        <div className="custom-modal-overlay">
          <div className="custom-modal">
            <div className="modal-header">
              <h3 className="text-xl font-bold">{confirmModal.title}</h3>
              <button
                className="close-btn"
                onClick={() => setConfirmModal(null)}
              >
                <X size={22} />
              </button>
            </div>
            <p
              style={{
                marginBottom: "28px",
                whiteSpace: "pre-wrap",
                lineHeight: "1.6",
                color: "#47586e",
                fontSize: "15px",
              }}
            >
              {confirmModal.msg}
            </p>
            <div className="modal-actions">
              {!confirmModal.hideCancel && (
                <button
                  className="btn-modal cancel text-[15px]"
                  onClick={() => setConfirmModal(null)}
                >
                  取消
                </button>
              )}
              <button
                className="btn-modal confirm text-[15px]"
                onClick={() => {
                  confirmModal.onConfirm();
                  setConfirmModal(null);
                }}
              >
                {confirmModal.confirmText || "确认"}
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
              录入系统
            </span>
          </div>
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100/80 rounded-full border border-slate-200/50">
              <UserCircle size={18} className="text-slate-500" />
              <span className="text-sm font-medium text-slate-600">
                {user?.name || user?.account}{" "}
                <span className="text-slate-400 text-xs ml-1">
                  ({user?.role === "admin" ? "Admin" : "Merchant"})
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

      <main className="max-w-6xl mx-auto px-6 mt-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight mb-2">
              {id === "0" ? "新增资产档案" : "编辑资产信息"}
            </h1>
            <p className="text-[15px] text-slate-500">
              完善酒店基础资料与配图，带{" "}
              <span className="text-rose-500 font-bold">*</span> 号为必填项。
            </p>
          </div>

          <button
            onClick={() =>
              navigate(id === "0" ? "/dashboard" : `/hotels/${id}`)
            }
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-xl text-[15px] font-semibold shadow-sm transition-colors w-fit"
          >
            <ArrowLeft size={18} /> {id === "0" ? "返回工作台" : "返回详情页"}
          </button>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200/70 shadow-sm p-8 md:p-12 mb-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-8">
            <div>
              <label className={labelClass}>
                酒店中文名 <span className="text-rose-500">*</span>
              </label>
              <input
                className={inputClass}
                placeholder="如：北京国贸大酒店"
                value={hotel.name}
                onChange={(e) => updateField("name", e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>
                酒店英文名 <span className="text-rose-500">*</span>
              </label>
              <input
                className={inputClass}
                placeholder="如：Beijing World Summit Wing"
                value={hotel.nameEn}
                onChange={(e) => updateField("nameEn", e.target.value)}
              />
            </div>

            <div className="md:col-span-2">
              <label className={labelClass}>
                所在省市区 <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-3 gap-5">
                <input
                  className={inputClass}
                  placeholder="省份 (如: 北京市)"
                  value={hotel.province}
                  onChange={(e) => updateField("province", e.target.value)}
                />
                <input
                  className={inputClass}
                  placeholder="城市 (如: 北京市)"
                  value={hotel.city}
                  onChange={(e) => updateField("city", e.target.value)}
                />
                <input
                  className={inputClass}
                  placeholder="区县 (如: 朝阳区)"
                  value={hotel.county}
                  onChange={(e) => updateField("county", e.target.value)}
                />
              </div>
            </div>

            <div className="md:col-span-2">
              <label className={labelClass}>
                开业日期 <span className="text-rose-500">*</span>
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    className={cn(
                      inputClass,
                      "flex items-center text-left font-normal",
                      !hotel.openTime && "text-slate-400",
                    )}
                  >
                    <CalendarIcon className="mr-3 h-5 w-5 text-slate-400" />
                    {hotel.openTime ? (
                      format(new Date(hotel.openTime), "PPP", { locale: zhCN })
                    ) : (
                      <span>请选择酒店开业日期</span>
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={
                      hotel.openTime ? new Date(hotel.openTime) : undefined
                    }
                    onSelect={(date) =>
                      updateField(
                        "openTime",
                        date ? format(date, "yyyy-MM-dd") : "",
                      )
                    }
                    initialFocus
                    locale={zhCN}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="md:col-span-2">
              <label className={labelClass}>
                地理坐标 (经纬度) <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-5">
                <div className="relative group">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[15px] text-slate-400 font-medium select-none">
                    经度
                  </span>
                  <input
                    type="number"
                    step="0.000001"
                    className={cn(inputClass, "pl-16")}
                    placeholder="116.397128"
                    value={hotel.longitude}
                    onChange={(e) => updateField("longitude", e.target.value)}
                  />
                </div>
                <div className="relative group">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[15px] text-slate-400 font-medium select-none">
                    纬度
                  </span>
                  <input
                    type="number"
                    step="0.000001"
                    className={cn(inputClass, "pl-16")}
                    placeholder="39.916527"
                    value={hotel.latitude}
                    onChange={(e) => updateField("latitude", e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div>
              <label className={labelClass}>
                酒店星级 <span className="text-rose-500">*</span>
              </label>
              <Select
                value={String(hotel.starLevel)}
                onValueChange={(val) => updateField("starLevel", Number(val))}
              >
                <SelectTrigger className={cn(inputClass, "h-auto bg-white")}>
                  <SelectValue placeholder="选择星级" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3" className="text-base">
                    3星级 (舒适型)
                  </SelectItem>
                  <SelectItem value="4" className="text-base">
                    4星级 (高档型)
                  </SelectItem>
                  <SelectItem value="5" className="text-base">
                    5星级 (豪华型)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className={labelClass}>
                广告权重{" "}
                <span className="text-slate-400 text-sm font-normal ml-1">
                  (仅管理员可设)
                </span>
              </label>
              <input
                type="number"
                className={cn(
                  inputClass,
                  "disabled:opacity-60 disabled:cursor-not-allowed",
                )}
                placeholder="数字越大排名越靠前"
                value={hotel.featuredWeight}
                onChange={(e) => updateField("featuredWeight", e.target.value)}
                disabled={user?.role !== "admin"}
              />
            </div>

            <div className="md:col-span-2">
              <label className={labelClass}>
                详细地址 <span className="text-rose-500">*</span>
              </label>
              <input
                className={inputClass}
                placeholder="如：建国门外大街1号"
                value={hotel.address}
                onChange={(e) => updateField("address", e.target.value)}
              />
            </div>

            <div className="md:col-span-2">
              <label className={labelClass}>
                附近景点{" "}
                <span className="text-slate-400 text-sm font-normal ml-1">
                  (请使用回车键换行分隔)
                </span>
              </label>
              <textarea
                className={cn(
                  inputClass,
                  "resize-y min-h-[120px] leading-relaxed",
                )}
                placeholder="如：&#10;天安门广场&#10;故宫博物院"
                value={(hotel.scenicSpots || []).join("\n")}
                onChange={(e) =>
                  updateField("scenicSpots", e.target.value.split("\n"))
                }
              />
            </div>

            <div className="md:col-span-2">
              <label className={labelClass}>酒店简介</label>
              <textarea
                className={cn(
                  inputClass,
                  "resize-y min-h-[140px] leading-relaxed",
                )}
                placeholder="向客人介绍您的酒店特色..."
                value={hotel.intro}
                onChange={(e) => updateField("intro", e.target.value)}
              />
            </div>

            <div className="md:col-span-2">
              <label className={labelClass}>酒店配套标签</label>
              <div className="flex flex-wrap items-center gap-3">
                {allLabels.map((label) => {
                  const isSelected = hotel.labels.includes(label);
                  return (
                    <label
                      key={label}
                      className={`px-4 py-2 rounded-xl text-[15px] font-medium transition-all duration-200 border cursor-pointer select-none flex items-center justify-center
                      ${isSelected ? "bg-blue-50 border-blue-300 text-blue-700 shadow-sm shadow-blue-500/10" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300"}`}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={isSelected}
                        onChange={() => toggleLabel(label)}
                      />
                      {label}
                    </label>
                  );
                })}

                <div className="flex items-center gap-2 ml-1">
                  <input
                    className="w-52 px-4 py-2 bg-slate-50/50 border border-slate-200 rounded-xl text-[15px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 focus:bg-white transition-all"
                    placeholder="输入自定义标签(回车)"
                    value={customLabel}
                    onChange={(e) => setCustomLabel(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddCustomLabel();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomLabel}
                    className="px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:text-blue-600 hover:bg-blue-50 hover:border-blue-200 rounded-xl text-[15px] font-semibold shadow-sm transition-all whitespace-nowrap"
                  >
                    + 添加标签
                  </button>
                </div>
              </div>
            </div>

            <div className="md:col-span-2 mt-4">
              <div className="flex items-center justify-between mb-5">
                <label className={labelClass} style={{ marginBottom: 0 }}>
                  酒店配图{" "}
                </label>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-[15px] font-semibold shadow-md transition-colors"
                >
                  <UploadCloud size={18} /> 上传新图片
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept="image/*"
                  multiple
                  onChange={handleFiles}
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
                {hotel.images.length ? (
                  hotel.images.map((image, idx) => (
                    <div
                      key={`${idx}-${image.slice(0, 24)}`}
                      className="group relative aspect-[4/3] rounded-xl overflow-hidden bg-slate-100 border border-slate-200/60 shadow-sm"
                    >
                      <img
                        src={image}
                        alt={`hotel-${idx}`}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300" />
                      <button
                        type="button"
                        onClick={() => removeImage(idx)}
                        className="absolute top-3 right-3 p-2 bg-rose-500/90 hover:bg-rose-600 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-sm transform translate-y-1 group-hover:translate-y-0"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="col-span-full py-16 flex flex-col items-center justify-center text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-300">
                    <UploadCloud size={32} className="text-slate-300 mb-3" />
                    <p className="text-[15px] font-medium text-slate-500">
                      暂未上传任何配图
                    </p>
                    <p className="text-sm text-slate-400 mt-1">
                      建议上传 16:9 比例的高清大图
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="md:col-span-2 mt-6 pt-6 border-t border-slate-100 flex flex-wrap items-center justify-end gap-4">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-6 py-2.5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-[15px] font-semibold transition-colors"
              >
                放弃修改
              </button>

              {id !== "0" && (
                <button
                  type="button"
                  onClick={() => navigate(`/hotels/${id}/rooms`)}
                  className="px-6 py-2.5 bg-white border border-slate-200 text-slate-700 hover:text-blue-600 hover:bg-blue-50 hover:border-blue-200 rounded-xl text-[15px] font-semibold shadow-sm transition-all"
                >
                  前往编辑房型
                </button>
              )}

              <button
                type="button"
                onClick={triggerSubmit}
                disabled={saving}
                className="px-8 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl text-[15px] font-bold shadow-md shadow-blue-500/20 transition-all"
              >
                {saving ? "正在提交..." : "保存并提交审核"}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function resizeTo16x9(img, targetW, targetH) {
  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  const srcW = img.naturalWidth,
    srcH = img.naturalHeight;
  const targetRatio = targetW / targetH,
    srcRatio = srcW / srcH;
  let drawW, drawH;
  if (srcRatio > targetRatio) {
    drawH = targetH;
    drawW = srcW * (drawH / srcH);
  } else {
    drawW = targetW;
    drawH = srcH * (drawW / srcW);
  }
  const offsetX = (targetW - drawW) / 2,
    offsetY = (targetH - drawH) / 2;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
  return canvas.toDataURL("image/jpeg", 0.9);
}
