import { AlertCircle, Building2, CheckCircle2, ChevronLeft, ChevronRight, LogOut, MapPin, Plus, Search, Star, UserCircle, X } from 'lucide-react';
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

// 引入 shadcn 的 Popover 组件
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import "../styles/dashboard.css";

const STATUS_FILTERS = [
  { key: "all", label: "全部酒店" },
  { key: "pending", label: "待审核" },
  { key: "approvedOffline", label: "待发布" },
  { key: "online", label: "营业中" },
  { key: "rejected", label: "被驳回" },
];

function getAuthUser() {
  try { return JSON.parse(sessionStorage.getItem("authUser") || "null"); }
  catch { return null; }
}

function getStatusMeta(hotel) {
  const audit = Number(hotel?.audit_status);
  const online = Number(hotel?.online_status);
  if (audit === 0) return { label: "待审核", bg: "bg-amber-100", text: "text-amber-700", ring: "ring-amber-200" };
  if (audit === 1 && online === 0) return { label: "待发布", bg: "bg-blue-100", text: "text-blue-700", ring: "ring-blue-200" };
  if (audit === 1 && online === 1) return { label: "营业中", bg: "bg-emerald-100", text: "text-emerald-700", ring: "ring-emerald-200" };
  if (audit === 2) return { label: "被驳回", bg: "bg-rose-100", text: "text-rose-700", ring: "ring-rose-200" };
  return { label: "未知", bg: "bg-slate-100", text: "text-slate-700", ring: "ring-slate-200" };
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(getAuthUser());
  const [hotels, setHotels] = useState([]);
  const [loading, setLoading] = useState(false);

  // 查询参数
  const [keyword, setKeyword] = useState("");
  const [city, setCity] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const PAGE_SIZE = 12;

  const [statsCount, setStatsCount] = useState({
    total: 0, pending: 0, approvedOffline: 0, online: 0, rejected: 0,
  });

  const isAdmin = user?.role === "admin";
  const isMerchant = user?.role === "merchant";

  const [toast, setToast] = useState(null);
  const [promptModal, setPromptModal] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const current = getAuthUser();
    if (!current) { navigate("/login", { replace: true }); return; }
    setUser(current);
  }, [navigate]);

  async function loadHotels() {
    if (!user) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(currentPage));
      params.set("pageSize", String(PAGE_SIZE));

      if (keyword.trim()) params.set("keyword", keyword.trim());
      if (city.trim()) params.set("city", city.trim());
      if (isAdmin) params.set("scope", "admin");
      else { params.set("scope", "merchant"); params.set("merchantId", user.id); }

      if (statusFilter === "pending") params.set("auditStatus", "0");
      if (statusFilter === "approvedOffline") { params.set("auditStatus", "1"); params.set("onlineStatus", "0"); }
      if (statusFilter === "online") { params.set("auditStatus", "1"); params.set("onlineStatus", "1"); }
      if (statusFilter === "rejected") params.set("auditStatus", "2");

      const statParams = new URLSearchParams(params);
      statParams.delete("auditStatus"); statParams.delete("onlineStatus"); statParams.set("pageSize", "200");
      statParams.set("page", "1");

      const [res, statRes] = await Promise.all([
        fetch(`/api/hotels?${params.toString()}`),
        fetch(`/api/hotels?${statParams.toString()}`),
      ]);

      const j = await res.json().catch(() => null);
      const statJson = await statRes.json().catch(() => null);
      if (!res.ok) throw new Error(j?.msg || "加载失败");

      setHotels(Array.isArray(j?.data) ? j.data : []);

      const totalCount = j?.total || 0;
      setTotalPages(Math.max(1, Math.ceil(totalCount / PAGE_SIZE)));

      const all = Array.isArray(statJson?.data) ? statJson.data : [];
      setStatsCount({
        total: all.length,
        pending: all.filter((h) => Number(h.audit_status) === 0).length,
        approvedOffline: all.filter((h) => Number(h.audit_status) === 1 && Number(h.online_status) === 0).length,
        online: all.filter((h) => Number(h.audit_status) === 1 && Number(h.online_status) === 1).length,
        rejected: all.filter((h) => Number(h.audit_status) === 2).length,
      });
    } catch (err) { showToast(err?.message || "加载失败", "error"); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadHotels(); }, [user, statusFilter, currentPage]);

  const countByFilter = {
    all: statsCount.total, pending: statsCount.pending, approvedOffline: statsCount.approvedOffline,
    online: statsCount.online, rejected: statsCount.rejected,
  };

  const handleSearch = () => {
    if (currentPage === 1) loadHotels();
    else setCurrentPage(1);
  };

  const handleFilterChange = (key) => {
    setStatusFilter(key);
    setCurrentPage(1);
  };

  function triggerAudit(hotelId, action) {
    if (action === "reject") {
      setPromptModal({
        title: '驳回审核', msg: '请输入驳回该酒店的原因：', placeholder: '如：资质图片不清晰、名称不合规等',
        isCritical: true, showInput: true,
        onConfirm: async (reason) => {
          if (!reason.trim()) { showToast('驳回原因不能为空', 'error'); return false; }
          await executeAudit(hotelId, action, reason); return true;
        }
      });
    } else {
      setPromptModal({
        title: '审核通过', msg: '可填写审核备注（选填）：', placeholder: '如：已核实资质无误',
        defaultValue: '审核通过，待发布上线。', showInput: true,
        onConfirm: async (reason) => { await executeAudit(hotelId, action, reason); return true; }
      });
    }
  }

  // ====== 核心修改：下线拦截函数 ======
  function confirmOffline(hotelId) {
    setPromptModal({
      title: '确认下线资产',
      msg: '将该资产下线后，客户端用户将无法搜索和预订此酒店的所有房型。您确定要执行此操作吗？',
      isCritical: true,
      showInput: false, // 隐藏输入框
      onConfirm: async () => {
        await offlineHotel(hotelId);
        return true;
      }
    });
  }

  async function executeAudit(hotelId, action, reason) {
    try {
      const res = await fetch(`/api/admin/hotels/${hotelId}/audit`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason: reason || "", auditorId: user.id }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) throw new Error(j?.msg || "操作失败");
      showToast(`操作成功：已${action === 'reject' ? '驳回' : '通过'}`);
      await loadHotels();
    } catch (err) { showToast(err?.message || "操作失败", "error"); }
  }

  async function publishHotel(hotelId) {
    const res = await fetch(`/api/admin/hotels/${hotelId}/publish`, { method: "POST" });
    if (!res.ok) throw new Error((await res.json())?.msg || "发布失败");
    showToast("酒店已成功发布上线！");
    await loadHotels();
  }

  async function offlineHotel(hotelId) {
    const res = await fetch(isAdmin ? `/api/admin/hotels/${hotelId}/offline` : `/api/hotels/${hotelId}`, { method: isAdmin ? "POST" : "DELETE" });
    if (!res.ok) throw new Error((await res.json())?.msg || "下线失败");
    showToast("酒店已下线");
    await loadHotels();
  }

  async function handleAction(fn) {
    try { await fn(); } catch (err) { }
  }

  function logout() {
    sessionStorage.clear();
    navigate("/login", { replace: true });
  }

  const cover = (h) => Array.isArray(h.images) && h.images.length ? h.images[0] : h.image || "";

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 pb-12">

      {toast && (
        <div className={`custom-toast ${toast.type}`}>
          {toast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{toast.msg}</span>
        </div>
      )}

      {promptModal && (
        <div className="custom-modal-overlay">
          <div className="custom-modal">
            <div className="modal-header">
              <h3>{promptModal.title}</h3>
              <button className="close-btn" onClick={() => setPromptModal(null)}><X size={20} /></button>
            </div>
            <p>{promptModal.msg}</p>
            {/* ====== 优化点：通过 showInput 控制是否渲染输入框 ====== */}
            {promptModal.showInput !== false && (
              <input type="text" className="modal-input" placeholder={promptModal.placeholder} defaultValue={promptModal.defaultValue || ''} id="prompt-input" autoFocus />
            )}
            <div className="modal-actions">
              <button className="btn-modal cancel" onClick={() => setPromptModal(null)}>取消</button>
              <button className={`btn-modal confirm ${promptModal.isCritical ? 'danger' : ''}`} onClick={async () => {
                const inputElement = document.getElementById('prompt-input');
                const inputVal = inputElement ? inputElement.value : '';
                const shouldClose = await promptModal.onConfirm(inputVal);
                if (shouldClose) setPromptModal(null);
              }}>
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
              易宿平台 <span className="font-normal text-slate-400 mx-2">|</span> {isAdmin ? "管理中枢" : "商家控制台"}
            </span>
          </div>
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100/80 rounded-full border border-slate-200/50">
              <UserCircle size={18} className="text-slate-500" />
              <span className="text-sm font-medium text-slate-600">
                {user?.name || user?.account} <span className="text-slate-400 text-xs ml-1">({isAdmin ? "Admin" : "Merchant"})</span>
              </span>
            </div>
            <button onClick={logout} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-full transition-colors group">
              <LogOut size={18} className="group-hover:-translate-x-0.5 transition-transform" />
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-8">

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight mb-1">酒店资产管理</h1>
            <p className="text-sm text-slate-500">管理、追踪并发布您旗下的所有旅宿资产。</p>
          </div>
          {isMerchant && (
            <button onClick={() => navigate("/hotels/0/edit")} className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-lg shadow-blue-600/20 transition-all hover:shadow-blue-600/30 hover:-translate-y-0.5 active:translate-y-0">
              <Plus size={18} /> 新增资产
            </button>
          )}
        </div>

        <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-200/60 mb-8 flex flex-col xl:flex-row gap-2">

          <div className="flex flex-wrap items-center gap-1.5 p-2 bg-slate-50/50 rounded-xl flex-1">
            {STATUS_FILTERS.map((item) => {
              const isActive = statusFilter === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => handleFilterChange(item.key)}
                  className={`relative px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ease-out overflow-hidden
                    ${isActive ? 'text-blue-700 shadow-sm ring-1 ring-blue-600/20 bg-white' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}
                >
                  {isActive && <div className="absolute inset-0 bg-blue-50/50 pointer-events-none" />}
                  <span className="relative z-10 flex items-center gap-2">
                    {item.label}
                    <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold
                      ${isActive ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-500'}`}>
                      {countByFilter[item.key] ?? 0}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 p-2">
            <div className="relative group flex-1 xl:w-64">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
              <input
                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 focus:bg-white rounded-xl text-sm transition-all outline-none"
                placeholder="搜索名称 / 英文 / 景点..."
                value={keyword} onChange={(e) => setKeyword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>
            <div className="relative group w-32 xl:w-40">
              <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
              <input
                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 focus:bg-white rounded-xl text-sm transition-all outline-none"
                placeholder="限定城市"
                value={city} onChange={(e) => setCity(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>
            <button onClick={handleSearch} className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-xl shadow-md transition-colors whitespace-nowrap">
              {loading ? "检索中..." : "查 询"}
            </button>
          </div>
        </div>

        {hotels.length === 0 && !loading ? (
          <div className="py-32 flex flex-col items-center justify-center text-center bg-white rounded-3xl border border-slate-200 border-dashed">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4"><Search className="text-slate-400" size={24} /></div>
            <h3 className="text-lg font-bold text-slate-700 mb-1">未找到匹配的资产</h3>
            <p className="text-sm text-slate-400">尝试调整筛选条件或使用不同的搜索关键词</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {hotels.map((h) => {
                const meta = getStatusMeta(h);
                return (
                  <div key={h.id} className="group bg-white rounded-2xl border border-slate-200/70 overflow-hidden hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-300 flex flex-col hover:-translate-y-1">

                    <div
                      className="relative aspect-[16/9] w-full bg-slate-100 overflow-hidden cursor-pointer"
                      onClick={() => navigate(`/hotels/${h.id}`)}
                    >
                      <img src={cover(h)} alt={h.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" onError={(e) => { e.currentTarget.src = "https://picsum.photos/seed/fallback/800/600"; }} />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                      <div className="absolute top-3 right-3">
                        <span className={`inline-flex px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm ring-1 ${meta.bg} ${meta.text} ${meta.ring} backdrop-blur-md`}>
                          {meta.label}
                        </span>
                      </div>
                    </div>

                    <div className="p-5 flex-1 flex flex-col min-w-0">
                      <div className="flex justify-between items-start mb-1.5 gap-2">
                        <h3
                          className="text-lg font-extrabold text-slate-800 leading-tight truncate cursor-pointer hover:text-blue-600 transition-colors"
                          title={h.name}
                          onClick={() => navigate(`/hotels/${h.id}`)}
                        >
                          {h.name}
                        </h3>
                        <div className="flex items-center gap-1 text-amber-500 shrink-0 bg-amber-50 px-2 py-1 rounded-md text-xs font-bold ring-1 ring-amber-200/50">
                          <Star size={12} className="fill-amber-500" /> {h.starLevel}
                        </div>
                      </div>

                      <p className="text-xs text-slate-400 font-medium mb-4 truncate font-mono">{h.nameEn || "No English Name"}</p>

                      <div className="space-y-2.5 mb-auto overflow-hidden">

                        <div className="flex items-center gap-2 text-[13px] text-slate-600">
                          <MapPin size={15} className="shrink-0 text-slate-400" />
                          <span className="truncate flex-1" title={`${h.city}${h.county}${h.address}`}>
                            {h.city}{h.county}{h.address}
                          </span>
                        </div>

                        {isAdmin && (
                          <div className="flex items-center gap-2 text-[13px] text-blue-700">
                            <UserCircle size={15} className="shrink-0 text-blue-500" />
                            <span className="truncate flex-1 font-medium" title={h.merchantName || h.merchantEmail}>
                              {h.merchantName || h.merchantEmail || `ID: ${h.merchantId || '未知'}`}
                            </span>
                          </div>
                        )}

                        {Number(h.audit_status) === 2 && h.audit_reason && (
                          <div className="pt-2">
                            <Popover>
                              <PopoverTrigger asChild>
                                <button className="w-full flex items-center justify-between px-3 py-2 bg-rose-50/60 hover:bg-rose-100/60 border border-dashed border-rose-200 rounded-lg text-rose-600 transition-colors focus:outline-none group/reject">
                                  <span className="flex items-center gap-1.5 text-xs font-bold">
                                    <AlertCircle size={14} className="text-rose-500" /> 审核未通过原因
                                  </span>
                                  <span className="text-[11px] font-semibold bg-white px-2 py-0.5 rounded shadow-sm border border-rose-100 group-hover/reject:border-rose-300">点击查看</span>
                                </button>
                              </PopoverTrigger>
                              <PopoverContent className="w-72 p-4 rounded-xl shadow-xl border-rose-100/50" align="start" sideOffset={8}>
                                <div className="space-y-2">
                                  <h4 className="font-bold text-rose-600 flex items-center gap-1.5 text-sm">
                                    <AlertCircle size={16} /> 审核驳回说明
                                  </h4>
                                  <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                                    {h.audit_reason}
                                  </p>
                                </div>
                              </PopoverContent>
                            </Popover>
                          </div>
                        )}
                      </div>

                      <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-end gap-2 flex-wrap">
                        <button onClick={() => navigate(`/hotels/${h.id}`)} className="px-3 py-1.5 text-[13px] font-semibold rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors">
                          详情
                        </button>

                        {isMerchant && (
                          <button onClick={() => navigate(`/hotels/${h.id}/edit`)} className="px-3 py-1.5 text-[13px] font-semibold rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors">
                            编辑
                          </button>
                        )}

                        {isAdmin && Number(h.audit_status) === 0 && (
                          <>
                            <button onClick={() => triggerAudit(h.id, "approve")} className="px-3 py-1.5 text-[13px] font-semibold rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors">
                              批准
                            </button>
                            <button onClick={() => triggerAudit(h.id, "reject")} className="px-3 py-1.5 text-[13px] font-semibold rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 transition-colors">
                              驳回
                            </button>
                          </>
                        )}

                        {isAdmin && Number(h.audit_status) === 1 && Number(h.online_status) === 0 && (
                          <button onClick={() => handleAction(() => publishHotel(h.id))} className="px-3 py-1.5 text-[13px] font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm shadow-blue-500/20">
                            上线
                          </button>
                        )}

                        {/* ====== 核心修改：将直接执行改为拦截弹窗 ====== */}
                        {(Number(h.online_status) === 1 || isMerchant) && (
                          <button onClick={() => confirmOffline(h.id)} className="px-3 py-1.5 text-[13px] font-semibold rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors">
                            下线
                          </button>
                        )}
                      </div>

                    </div>
                  </div>
                );
              })}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-6 mt-12 mb-6">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 disabled:opacity-40 disabled:bg-transparent disabled:cursor-not-allowed hover:bg-slate-50 hover:text-blue-600 transition-all font-semibold text-sm shadow-sm"
                >
                  <ChevronLeft size={16} /> 上一页
                </button>
                <span className="text-sm font-medium text-slate-500 bg-slate-100 px-4 py-1.5 rounded-lg">
                  第 <span className="text-slate-900 font-bold mx-0.5">{currentPage}</span> / {totalPages} 页
                </span>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 disabled:opacity-40 disabled:bg-transparent disabled:cursor-not-allowed hover:bg-slate-50 hover:text-blue-600 transition-all font-semibold text-sm shadow-sm"
                >
                  下一页 <ChevronRight size={16} />
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}