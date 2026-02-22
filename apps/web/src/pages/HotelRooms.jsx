import { cn } from "@/lib/utils";
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  Image as ImageIcon,
  LogOut,
  Plus,
  Save,
  Trash2,
  UploadCloud,
  UserCircle,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import "../styles/hotel-rooms.css";

function toFiniteNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function normalizeRow(row = {}) {
  return {
    ...row,
    id: row.id ? String(row.id) : undefined,
    // 保持原始字段的可回显性：当服务器返回 0 时也应显示为 0，而不是被空字符串覆盖
    original:
      row.original === undefined || row.original === null || row.original === ""
        ? ""
        : toFiniteNumber(row.original),
    current:
      row.current === undefined || row.current === null || row.current === ""
        ? ""
        : toFiniteNumber(row.current),
    remain:
      row.remain === undefined || row.remain === null || row.remain === ""
        ? ""
        : toFiniteNumber(row.remain),
    // Treat display placeholder "无" as empty value for persistence
    discount: row.discount && row.discount !== "无" ? row.discount : "",
    // 保留 area 字段并同步 size，避免规范化后页面绑定到 `area` 的输入框无法读取初始值
    area: row.area || row.size || "",
    size: row.area || row.size || "",
    // 支持新字段 `occupancy`（可入住人数），向后兼容 `capacity`
    occupancy: row.occupancy || row.capacity || "",
    capacity: row.capacity || row.occupancy || "",
    status: row.status || "available",
    // remark is stored as a comma-joined string for server compatibility
    remark: Array.isArray(row.remarkTags)
      ? row.remarkTags.join(",")
      : row.remark || "",
  };
}

function normalizeRows(list) {
  return Array.isArray(list)
    ? list.filter(Boolean).map((item) => normalizeRow({ ...item }))
    : [];
}

const EMPTY_ROW = {
  type: "",
  area: "",
  size: "",
  capacity: "",
  original: "",
  current: "",
  discount: "",
  remain: "",
  status: "available",
  remark: "",
  image: "",
};

// 常用的房型备注可选标签（可编辑、可增减）
const PRESET_TAGS = [
  "含早餐",
  "双早",
  "免费取消",
  "可加床",
  "靠窗",
  "高楼层",
  "无窗",
];
export default function HotelRooms() {
  const { id } = useParams();
  const navigate = useNavigate();
  const hotelId = String(id || "");
  const [rows, setRows] = useState([]);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [isDirty, setIsDirty] = useState(false);
  const [hotelLabels, setHotelLabels] = useState([]);

  const loadedRef = useRef(false);
  const listRef = useRef(null);
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const editRoomId = params.get("editRoomId");

  const [toast, setToast] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const mergeLocalExtras = (apiRooms) => {
    try {
      const localExtras = JSON.parse(
        localStorage.getItem(`roomExtras:${hotelId}`) || "{}",
      );
      return apiRooms.map((r) => {
        const idKey = r.id ? String(r.id) : "";
        const typeKey = r.type ? String(r.type).trim() : "";
        const matched = localExtras[idKey] || localExtras[typeKey] || {};
        // Only apply non-empty local overrides so不会覆盖服务器返回的有效值
        const safeMatched = {};
        Object.keys(matched || {}).forEach((k) => {
          const v = matched[k];
          if (v !== undefined && v !== null && String(v) !== "")
            safeMatched[k] = v;
        });
        const patched = { ...r, ...safeMatched };
        if (patched.remark && !patched.remarkTags) {
          patched.remarkTags = String(patched.remark)
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
        }
        return patched;
      });
    } catch (e) {
      return apiRooms;
    }
  };

  const persistExtrasToLocal = (roomsList) => {
    if (!hotelId || hotelId === "0") return;
    const extras = {};
    roomsList.forEach((r) => {
      const payload = {
        discount: r.discount,
        area: r.area,
        size: r.size || r.area,
        // persist occupancy 优先，向后兼容 capacity
        occupancy: r.occupancy || r.capacity,
        capacity: r.occupancy || r.capacity,
        remark: r.remark,
      };
      // keep remarkTags in runtime but persist remark string for compatibility
      if (Array.isArray(r.remarkTags)) payload.remark = r.remarkTags.join(",");
      if (r.id) extras[String(r.id)] = payload;
      if (r.type) extras[String(r.type).trim()] = payload;
    });
    const key = `roomExtras:${hotelId}`;
    const existing = JSON.parse(localStorage.getItem(key) || "{}");
    localStorage.setItem(key, JSON.stringify({ ...existing, ...extras }));
  };

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    const draft = loadDraft();
    if (draft.length) {
      setRows(draft);
      highlightIfNeeded(draft);
      return;
    }
    if (!hotelId) return;
    (async () => {
      let apiRooms = normalizeRows(await fetchRoomsFromApi(hotelId));
      apiRooms = mergeLocalExtras(apiRooms);
      if (apiRooms.length) {
        setRows(apiRooms);
        highlightIfNeeded(apiRooms);
        return;
      }
      let fallbackRooms = normalizeRows(await fetchRoomsFromHotel(hotelId));
      fallbackRooms = mergeLocalExtras(fallbackRooms);
      setRows(fallbackRooms);
      highlightIfNeeded(fallbackRooms);
    })();
  }, [hotelId, editRoomId]);

  function getStorageKey() {
    return "priceListDraft:" + (hotelId || "");
  }

  function loadDraft() {
    try {
      const raw = localStorage.getItem(getStorageKey());
      if (raw) return normalizeRows(JSON.parse(raw));
    } catch (e) {}
    return [];
  }

  function persistDraft(list) {
    try {
      localStorage.setItem(
        getStorageKey(),
        JSON.stringify(normalizeRows(list)),
      );
    } catch (e) {}
  }

  async function fetchRoomsFromApi(targetId) {
    try {
      const res = await fetch(`/api/hotels/${targetId}/rooms`);
      const json = await res.json();
      if (Array.isArray(json && json.data)) return json.data;
      if (Array.isArray(json)) return json;
      if (json && Array.isArray(json.rows)) return json.rows;
    } catch (err) {
      console.warn("load rooms api failed", err);
    }
    return [];
  }

  async function fetchRoomsFromHotel(targetId) {
    try {
      const res = await fetch(`/api/hotels/${targetId}`);
      const json = await res.json();
      const detail = json && json.data;
      if (!detail) return [];
      // store hotel labels for tag suggestions
      try {
        setHotelLabels(
          Array.isArray(detail.labels) ? detail.labels.slice() : [],
        );
      } catch (e) {}
      if (Array.isArray(detail.rooms) && detail.rooms.length)
        return detail.rooms;
      if (detail.priceData && Array.isArray(detail.priceData.roomPriceList))
        return detail.priceData.roomPriceList.slice();
    } catch (err) {
      console.warn("load hotel fallback failed", err);
    }
    return [];
  }

  function highlightIfNeeded(list) {
    if (!editRoomId) return;
    const idx = list.findIndex((x) => String(x.id) === String(editRoomId));
    if (idx < 0) return;
    setTimeout(() => {
      setHighlightIndex(idx);
      try {
        const node =
          listRef.current &&
          listRef.current.children &&
          listRef.current.children[idx];
        if (node) {
          node.scrollIntoView({ behavior: "smooth", block: "center" });
          const input = node.querySelector("input.type");
          if (input) input.focus();
        }
      } catch (e) {}
    }, 120);
  }

  function handleSafeBack(targetPath) {
    if (isDirty) {
      setConfirmModal({
        title: "未保存提示",
        msg: "您有未保存的编辑内容。直接离开会导致修改丢失，是否要先保存再离开？",
        cancelText: "直接离开",
        confirmText: "保存并返回",
        onCancel: () => navigate(targetPath),
        onConfirm: async () => {
          const success = await saveAll();
          if (success) {
            setTimeout(() => navigate(targetPath), 800);
          }
        },
      });
    } else {
      navigate(targetPath);
    }
  }

  function addRow() {
    setRows((prev) => [...prev, { ...EMPTY_ROW }]);
    setIsDirty(true);
  }

  function clearAll() {
    setConfirmModal({
      title: "清空确认",
      msg: "确认要清空当前所有房型草稿吗？此操作不可恢复。",
      onConfirm: () => {
        setRows([]);
        persistDraft([]);
        setIsDirty(true);
        showToast("已清空房型草稿，请点击全部保存以生效");
      },
    });
  }

  async function saveAll() {
    persistDraft(rows);
    if (!hotelId || hotelId === "0") {
      showToast("当前为新酒店草稿，房型已保存至本地，请先创建酒店。", "error");
      setTimeout(() => navigate("/dashboard"), 2000);
      return false;
    }
    try {
      const payloadRooms = normalizeRows(rows);
      const res = await fetch(`/api/hotels/${hotelId}/rooms/bulk-save`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rooms: payloadRooms }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error((json && json.msg) || "同步失败");

      const saved = Array.isArray(json && json.data) ? json.data : payloadRooms;
      const merged = rows.map((r, i) => ({ ...r, ...(saved[i] || {}) }));
      const sanitized = normalizeRows(merged);

      setRows(sanitized);
      persistExtrasToLocal(sanitized);
      setIsDirty(false);
      try {
        localStorage.removeItem(getStorageKey());
      } catch (e) {}

      showToast("所有房型已成功同步至数据库！", "success");
      return true;
    } catch (err) {
      console.error(err);
      showToast(
        err && err.message ? err.message : "同步失败，请检查网络或服务端",
        "error",
      );
      return false;
    }
  }

  function updateRow(idx, patch) {
    setRows((prev) => {
      const copy = prev.slice();
      if (!copy[idx]) copy[idx] = { ...EMPTY_ROW };
      copy[idx] = { ...copy[idx], ...patch };
      return copy;
    });
    setIsDirty(true);
  }

  function handleFieldChange(idx, field, value) {
    const row = rows[idx];
    let patch = { [field]: value };

    // 1. 如果修改的是房量，自动判定状态
    if (field === "remain") {
      const remain = parseInt(value, 10);
      if (!isNaN(remain)) {
        if (remain === 0) patch.status = "soldout";
        else if (remain > 0 && remain < 5) patch.status = "low";
        else patch.status = "available";
      } else if (value === "") {
        patch.status = "available"; // 留空时默认状态
      }
    }

    // 2. 如果修改的是原价或折扣，自动计算今日售价
    if (field === "original" || field === "discount") {
      const newOriginal =
        field === "original"
          ? toFiniteNumber(value)
          : toFiniteNumber(row.original);
      const newDiscount =
        field === "discount" ? String(value) : String(row.discount || "");

      if (newOriginal > 0 && newDiscount) {
        const match = newDiscount.match(/([\d.]+)/);
        if (match) {
          const num = parseFloat(match[1]);
          let calcCurrent = row.current;
          if (num > 0 && num <= 10) {
            calcCurrent = Math.round(newOriginal * (num / 10));
          } else if (num > 10 && num <= 100) {
            calcCurrent = Math.round(newOriginal * (num / 100));
          }
          patch.current = calcCurrent;
        }
      }
    }

    updateRow(idx, patch);
  }

  async function handleImgFile(file, idx) {
    if (!file) return;
    const data = await readFileAsDataURL(file);
    const img = new Image();
    img.src = data;
    await new Promise((r) => (img.onload = r));
    const resized = resizeTo16x9(img, 1280, 720);
    updateRow(idx, { image: resized });
  }

  function readFileAsDataURL(f) {
    return new Promise((resolve, reject) => {
      const rd = new FileReader();
      rd.onload = (e) => resolve(e.target.result);
      rd.onerror = reject;
      rd.readAsDataURL(f);
    });
  }

  function deleteRow(idx) {
    setConfirmModal({
      title: "删除房型",
      msg: "确定要删除该房型信息吗？此操作将立即从界面移除。",
      onConfirm: () => {
        try {
          const target = rows[idx];
          if (target && target.id) {
            const delKey = `deletedRooms:${hotelId}`;
            const deleted = JSON.parse(localStorage.getItem(delKey) || "[]");
            if (!deleted.includes(String(target.id))) {
              deleted.push(String(target.id));
              localStorage.setItem(delKey, JSON.stringify(deleted));
            }
          }
          const copy = [...rows];
          copy.splice(idx, 1);
          setRows(copy);
          persistDraft(copy);
          persistExtrasToLocal(copy);
          setIsDirty(true);
          showToast("已删除该房型");
        } catch (err) {
          console.error("Delete Error: ", err);
        }
      },
    });
  }

  async function saveRowToServer(idx) {
    const row = rows[idx];
    try {
      persistDraft(rows);
      if (!hotelId || hotelId === "0") {
        showToast("新酒店草稿已保存到本地，请先创建酒店。", "error");
        return;
      }
      const payload = normalizeRow(row);
      let res;
      if (payload.id) {
        res = await fetch(`/api/hotels/${hotelId}/rooms/${payload.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`/api/hotels/${hotelId}/rooms`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error((json && json.msg) || "保存失败");
      const saved = json && json.data ? json.data : json;

      if (saved) {
        setRows((prev) => {
          const copy = prev.slice();
          copy[idx] = normalizeRow({ ...copy[idx], ...saved });
          try {
            persistDraft(copy);
          } catch (e) {}
          persistExtrasToLocal(copy);
          return copy;
        });
        showToast("房型单条数据已保存！", "success");
      } else {
        showToast("保存失败，服务端未返回数据", "error");
      }
    } catch (err) {
      console.error(err);
      showToast(err && err.message ? err.message : "保存失败", "error");
    }
  }

  function logout() {
    sessionStorage.clear();
    navigate("/login", { replace: true });
  }

  const user = JSON.parse(sessionStorage.getItem("authUser") || "{}");

  const labelClass = "block text-[13px] font-bold text-slate-500 mb-1.5 ml-1";
  const inputClass =
    "w-full px-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-[14px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 focus:bg-white transition-all";

  // 合并预设标签与酒店自身标签作为建议选项（去重）
  const suggestionTags = Array.from(
    new Set([...(PRESET_TAGS || []), ...(hotelLabels || [])]),
  );
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 pb-24">
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
                onClick={() => {
                  if (confirmModal.onCancel) confirmModal.onCancel();
                  setConfirmModal(null);
                }}
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
              <button
                className="btn-modal cancel text-[15px]"
                onClick={() => {
                  if (confirmModal.onCancel) confirmModal.onCancel();
                  setConfirmModal(null);
                }}
              >
                {confirmModal.cancelText || "取消"}
              </button>
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

      {/* 玻璃拟态导航栏 */}
      <nav className="sticky top-0 z-40 w-full backdrop-blur-md bg-white/80 border-b border-slate-200/60 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 shadow-inner flex items-center justify-center text-white font-bold text-lg">
              <Building2 size={20} />
            </div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-600 tracking-tight">
              易宿平台{" "}
              <span className="font-normal text-slate-400 mx-2">|</span>{" "}
              房型库存管理
            </span>
          </div>
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100/80 rounded-full border border-slate-200/50">
              <UserCircle size={18} className="text-slate-500" />
              <span className="text-sm font-medium text-slate-600">
                {user?.name || user?.account || "商家"}
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

      {/* 页面主干 */}
      <main className="max-w-7xl mx-auto px-6 mt-10">
        {/* 顶部标题与工具栏 */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight mb-2">
              房型与库存设置
            </h1>
            <p className="text-[15px] text-slate-500">
              {hotelId && hotelId !== "0"
                ? `当前管理资产 ID: ${hotelId}`
                : "当前为新资产草稿状态"}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() =>
                handleSafeBack(
                  hotelId === "0" ? "/dashboard" : `/hotels/${hotelId}`,
                )
              }
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-xl text-[15px] font-semibold shadow-sm transition-colors"
            >
              <ArrowLeft size={16} /> 返回资产页
            </button>
            <button
              onClick={clearAll}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-rose-500 hover:bg-rose-50 hover:border-rose-200 rounded-xl text-[15px] font-semibold shadow-sm transition-colors"
            >
              <Trash2 size={16} /> 清空草稿
            </button>
            <button
              onClick={addRow}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-50 border border-blue-100 text-blue-700 hover:bg-blue-100 rounded-xl text-[15px] font-semibold transition-colors"
            >
              <Plus size={16} /> 新增房型
            </button>
            <button
              onClick={saveAll}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-[15px] font-bold shadow-md transition-colors"
            >
              <Save size={16} /> 全部保存生效
            </button>
          </div>
        </div>

        {/* 房型卡片列表 */}
        <div className="space-y-6" ref={listRef}>
          {rows.map((r, idx) => (
            <div
              key={idx}
              className={cn(
                "flex flex-col md:flex-row gap-6 lg:gap-8 bg-white border rounded-3xl p-6 lg:p-8 shadow-sm transition-all duration-300",
                highlightIndex === idx
                  ? "border-blue-400 ring-4 ring-blue-500/10 shadow-lg"
                  : "border-slate-200/70 hover:shadow-md hover:border-blue-200",
              )}
            >
              {/* 左侧：图片上传区 */}
              <div className="w-full md:w-64 shrink-0 flex flex-col gap-3">
                <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-slate-100 border border-slate-200/60 shadow-sm group">
                  {r.image ? (
                    <img
                      src={r.image}
                      alt="房型配图"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
                      <ImageIcon size={32} className="mb-2 opacity-50" />
                      <span className="text-sm font-medium">暂无配图</span>
                    </div>
                  )}
                  <div className="absolute inset-0 shadow-inner rounded-2xl pointer-events-none"></div>
                </div>

                <label className="cursor-pointer inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-[14px] font-semibold transition-colors border border-blue-100">
                  <UploadCloud size={16} />
                  {r.image ? "重新上传图片" : "上传房型配图"}
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={(e) => {
                      const f = e.target.files && e.target.files[0];
                      if (f) handleImgFile(f, idx);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>

              {/* 右侧：表单网格区 */}
              <div className="flex-1 flex flex-col">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-5">
                  {/* ====== 调整后：将剩余房量换到第一排，预订状态换到第二排 ====== */}
                  {/* 第一排 */}
                  <div>
                    <label className={labelClass}>房型名称</label>
                    <input
                      className={cn(
                        inputClass,
                        "type font-bold text-slate-900",
                      )}
                      placeholder="如：高级大床房"
                      value={r.type || ""}
                      onChange={(e) => updateRow(idx, { type: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>房型面积</label>
                    <input
                      className={inputClass}
                      placeholder="如：30"
                      value={r.area || ""}
                      onChange={(e) => updateRow(idx, { area: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>可入住人数</label>
                    <input
                      type="number"
                      className={inputClass}
                      placeholder="如：2"
                      value={r.occupancy || r.capacity || ""}
                      onChange={(e) =>
                        updateRow(idx, { occupancy: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className={labelClass}>实际剩余房量 (间)</label>
                    <input
                      type="number"
                      className={inputClass}
                      placeholder="0"
                      value={r.remain === "" ? "" : r.remain}
                      onChange={(e) =>
                        handleFieldChange(idx, "remain", e.target.value)
                      }
                    />
                  </div>

                  {/* 第二排 */}
                  <div>
                    <label className={labelClass}>日常原价 (¥)</label>
                    <input
                      type="number"
                      className={inputClass}
                      placeholder="0.00"
                      value={r.original || ""}
                      onChange={(e) =>
                        handleFieldChange(idx, "original", e.target.value)
                      }
                    />
                  </div>
                  <div>
                    <label className={labelClass}>房型折扣</label>
                    <input
                      className={inputClass}
                      placeholder="如：8折或85折"
                      value={
                        r.discount === "" || r.discount == null
                          ? "无"
                          : r.discount
                      }
                      onChange={(e) =>
                        handleFieldChange(idx, "discount", e.target.value)
                      }
                    />
                  </div>
                  <div>
                    <label className={labelClass}>今日挂牌价 (¥)</label>
                    <input
                      type="number"
                      className={cn(
                        inputClass,
                        "text-blue-600 font-bold bg-blue-50/40 border-blue-100",
                      )}
                      placeholder="自动计算或手填"
                      value={r.current || ""}
                      onChange={(e) =>
                        updateRow(idx, { current: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className={labelClass}>预订状态</label>
                    {/* ====== 去除下拉箭头，统一成普通输入框的样式，禁用点击事件 ====== */}
                    <div
                      className={cn(
                        inputClass,
                        "flex items-center font-medium pointer-events-none",
                      )}
                    >
                      {r.status === "soldout"
                        ? "🔴 满房售罄"
                        : r.status === "low"
                          ? "🟡 房量紧张"
                          : "🟢 开放预订"}
                    </div>
                  </div>

                  {/* 第三排 */}
                  <div className="sm:col-span-2 lg:col-span-4">
                    <label className={labelClass}>房型备注与政策说明</label>
                    <div>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {(Array.isArray(r.remarkTags)
                          ? r.remarkTags
                          : r.remark
                            ? String(r.remark)
                                .split(",")
                                .map((s) => s.trim())
                                .filter(Boolean)
                            : []
                        ).map((tag) => (
                          <span
                            key={tag}
                            className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-medium border border-slate-200/60 flex items-center gap-2"
                          >
                            {tag}
                            <button
                              type="button"
                              onClick={() => {
                                const exist = Array.isArray(r.remarkTags)
                                  ? r.remarkTags.slice()
                                  : r.remark
                                    ? String(r.remark)
                                        .split(",")
                                        .map((s) => s.trim())
                                        .filter(Boolean)
                                    : [];
                                const idxTag = exist.indexOf(tag);
                                if (idxTag >= 0) exist.splice(idxTag, 1);
                                updateRow(idx, { remarkTags: exist });
                              }}
                              className="text-rose-400 hover:text-rose-600"
                            >
                              ✕
                            </button>
                          </span>
                        ))}
                      </div>

                      <div className="flex items-center gap-2 mb-2">
                        <input
                          className={cn(inputClass, "flex-1")}
                          placeholder="输入自定义标签并回车，或从下方选择已有标签"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              const v = e.target.value.trim();
                              if (v) {
                                const exist = Array.isArray(r.remarkTags)
                                  ? r.remarkTags.slice()
                                  : r.remark
                                    ? String(r.remark)
                                        .split(",")
                                        .map((s) => s.trim())
                                        .filter(Boolean)
                                    : [];
                                if (!exist.includes(v)) exist.push(v);
                                updateRow(idx, { remarkTags: exist });
                                e.target.value = "";
                              }
                              e.preventDefault();
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            updateRow(idx, { remarkTags: [] });
                          }}
                          className="px-3 py-2 bg-white border border-slate-200 rounded-md text-sm text-rose-500"
                        >
                          清空
                        </button>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {suggestionTags && suggestionTags.length ? (
                          suggestionTags.map((l) => {
                            const selected = Array.isArray(r.remarkTags)
                              ? r.remarkTags.includes(l)
                              : (r.remark || "")
                                  .split(",")
                                  .map((s) => s.trim())
                                  .includes(l);
                            return (
                              <button
                                key={l}
                                type="button"
                                onClick={() => {
                                  const exist = Array.isArray(r.remarkTags)
                                    ? r.remarkTags.slice()
                                    : r.remark
                                      ? String(r.remark)
                                          .split(",")
                                          .map((s) => s.trim())
                                          .filter(Boolean)
                                      : [];
                                  if (selected) {
                                    const i = exist.indexOf(l);
                                    if (i >= 0) exist.splice(i, 1);
                                  } else {
                                    if (!exist.includes(l)) exist.push(l);
                                  }
                                  updateRow(idx, { remarkTags: exist });
                                }}
                                className={cn(
                                  "px-3 py-1.5 rounded-lg text-xs font-medium border",
                                  selected
                                    ? "bg-blue-50 text-blue-700 border-blue-100"
                                    : "bg-slate-50 text-slate-600 border-slate-100",
                                )}
                              >
                                {l}
                              </button>
                            );
                          })
                        ) : (
                          <div className="text-sm text-slate-400">
                            暂无可选标签，可直接输入自定义标签。
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-auto pt-6 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteRow(idx);
                    }}
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-white border border-rose-200 text-rose-500 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-300 rounded-xl text-[14px] font-semibold shadow-sm transition-all"
                  >
                    <Trash2 size={16} /> 删除房型
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      saveRowToServer(idx);
                    }}
                    className="inline-flex items-center gap-1.5 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[14px] font-semibold shadow-md shadow-blue-500/20 transition-all"
                  >
                    <Save size={16} /> 保存此房型
                  </button>
                </div>
              </div>
            </div>
          ))}

          {rows.length === 0 && (
            <div className="py-24 flex flex-col items-center justify-center text-center bg-white rounded-3xl border border-dashed border-slate-300 shadow-sm">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                <Plus size={28} className="text-slate-400" />
              </div>
              <h3 className="text-lg font-bold text-slate-700 mb-1">
                暂无任何房型数据
              </h3>
              <p className="text-[15px] text-slate-500 mb-6">
                您需要至少添加一个房型，酒店才能正常展示与售卖。
              </p>
              <button
                onClick={addRow}
                className="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-[15px] font-bold shadow-md transition-colors"
              >
                <Plus size={18} /> 立即新增房型
              </button>
            </div>
          )}
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
  const srcW = img.naturalWidth || img.width,
    srcH = img.naturalHeight || img.height;
  const targetRatio = targetW / targetH,
    srcRatio = srcW / srcH;
  let sx = 0,
    sy = 0,
    sW = srcW,
    sH = srcH;
  if (srcRatio > targetRatio) {
    sH = srcH;
    sW = Math.floor(srcH * targetRatio);
    sx = Math.floor((srcW - sW) / 2);
    sy = 0;
  } else {
    sW = srcW;
    sH = Math.floor(srcW / targetRatio);
    sx = 0;
    sy = Math.floor((srcH - sH) / 2);
  }
  ctx.drawImage(img, sx, sy, sW, sH, 0, 0, targetW, targetH);
  return canvas.toDataURL("image/jpeg", 0.9);
}
