import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '../styles/dashboard.css'

const STATUS_FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '待审核' },
  { key: 'approvedOffline', label: '待上线' },
  { key: 'online', label: '已上线' },
  { key: 'rejected', label: '未通过' },
]

function getAuthUser() {
  try {
    return JSON.parse(localStorage.getItem('authUser') || 'null')
  } catch {
    return null
  }
}

function getStatusMeta(hotel) {
  const audit = Number(hotel?.audit_status)
  const online = Number(hotel?.online_status)
  if (audit === 0) return { label: '待审核', className: 'pending' }
  if (audit === 1 && online === 0) return { label: '待上线', className: 'approvedOffline' }
  if (audit === 1 && online === 1) return { label: '已上线', className: 'online' }
  if (audit === 2) return { label: '未通过', className: 'rejected' }
  return { label: '未知状态', className: 'unknown' }
}

export default function Dashboard(){
  const navigate = useNavigate()
  const [user, setUser] = useState(getAuthUser())
  const [hotels, setHotels] = useState([])
  const [loading, setLoading] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [city, setCity] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [statsCount, setStatsCount] = useState({ total: 0, pending: 0, approvedOffline: 0, online: 0, rejected: 0 })

  const isAdmin = user?.role === 'admin'
  const isMerchant = user?.role === 'merchant'

  useEffect(() => {
    const current = getAuthUser()
    if (!current) {
      navigate('/login', { replace: true })
      return
    }
    setUser(current)
  }, [navigate])

  async function loadHotels() {
    if (!user) return
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', '1')
      params.set('pageSize', '20')
      if (keyword.trim()) params.set('keyword', keyword.trim())
      if (city.trim()) params.set('city', city.trim())

      if (isAdmin) {
        params.set('scope', 'admin')
      } else {
        params.set('scope', 'merchant')
        params.set('merchantId', user.id)
      }

      if (statusFilter === 'pending') params.set('auditStatus', '0')
      if (statusFilter === 'approvedOffline') { params.set('auditStatus', '1'); params.set('onlineStatus', '0') }
      if (statusFilter === 'online') { params.set('auditStatus', '1'); params.set('onlineStatus', '1') }
      if (statusFilter === 'rejected') params.set('auditStatus', '2')

      const statParams = new URLSearchParams()
      statParams.set('page', '1')
      statParams.set('pageSize', '200')
      if (isAdmin) {
        statParams.set('scope', 'admin')
      } else {
        statParams.set('scope', 'merchant')
        statParams.set('merchantId', user.id)
      }
      if (keyword.trim()) statParams.set('keyword', keyword.trim())
      if (city.trim()) statParams.set('city', city.trim())

      const [res, statRes] = await Promise.all([
        fetch(`/api/hotels?${params.toString()}`),
        fetch(`/api/hotels?${statParams.toString()}`),
      ])
      const j = await res.json().catch(() => null)
      const statJson = await statRes.json().catch(() => null)
      if (!res.ok) throw new Error(j?.msg || '加载失败')

      setHotels(Array.isArray(j?.data) ? j.data : [])
      const all = Array.isArray(statJson?.data) ? statJson.data : []
      setStatsCount({
        total: all.length,
        pending: all.filter((h) => Number(h.audit_status) === 0).length,
        approvedOffline: all.filter((h) => Number(h.audit_status) === 1 && Number(h.online_status) === 0).length,
        online: all.filter((h) => Number(h.audit_status) === 1 && Number(h.online_status) === 1).length,
        rejected: all.filter((h) => Number(h.audit_status) === 2).length,
      })
    } catch (err) {
      alert(err?.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadHotels()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, statusFilter])

  const countByFilter = {
    all: statsCount.total,
    pending: statsCount.pending,
    approvedOffline: statsCount.approvedOffline,
    online: statsCount.online,
    rejected: statsCount.rejected,
  }

  async function auditHotel(hotelId, action) {
    const reason = action === 'reject' ? prompt('请输入驳回原因：') : prompt('可填写审核备注（可为空）：', '审核通过，待发布上线。')
    if (action === 'reject' && !reason) return
    const res = await fetch(`/api/admin/hotels/${hotelId}/audit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, reason: reason || '', auditorId: user.id }),
    })
    const j = await res.json().catch(() => null)
    if (!res.ok) throw new Error(j?.msg || '操作失败')
  }

  async function publishHotel(hotelId) {
    const res = await fetch(`/api/admin/hotels/${hotelId}/publish`, { method: 'POST' })
    const j = await res.json().catch(() => null)
    if (!res.ok) throw new Error(j?.msg || '发布失败')
  }

  async function offlineHotel(hotelId) {
    const res = await fetch(isAdmin ? `/api/admin/hotels/${hotelId}/offline` : `/api/hotels/${hotelId}`, { method: isAdmin ? 'POST' : 'DELETE' })
    const j = await res.json().catch(() => null)
    if (!res.ok) throw new Error(j?.msg || '下线失败')
  }

  async function handleAction(fn) {
    try {
      await fn()
      await loadHotels()
    } catch (err) {
      alert(err?.message || '操作失败')
    }
  }

  function logout() {
    localStorage.removeItem('authUser')
    localStorage.removeItem('authToken')
    navigate('/login', { replace: true })
  }

  const cover = (h) => (Array.isArray(h.images) && h.images.length ? h.images[0] : (h.image || ''))

  return (
    <div className="dashboard-page">
      <div className="top-nav">
        <div className="nav-logo"><div className="logo-icon">🏨</div><span>易宿平台 · {isAdmin ? '管理员工作台' : '商家工作台'}</span></div>
        <div className="user-info">
          <span>{user?.name || user?.account}（{isAdmin ? '管理员' : '商家'}）</span>
          <button className="logout-btn" onClick={logout}>退出登录</button>
        </div>
      </div>

      <div className="container">
        <div className="title-row">
          <div className="page-title">酒店管理</div>
          {isMerchant ? <button className="btn-add" onClick={()=> navigate('/hotels/0/edit')}>+ 新增酒店</button> : null}
        </div>

        <div className="filter-row">
          {STATUS_FILTERS.map((item) => (
            <button
              key={item.key}
              className={`filter-btn ${statusFilter === item.key ? 'active' : ''}`}
              onClick={() => setStatusFilter(item.key)}
            >
              {item.label} {countByFilter[item.key] ?? 0}
            </button>
          ))}
        </div>

        <div className="search-row">
          <input
            className="form-input"
            placeholder="关键字：酒店名/英文名/地址/景点"
            value={keyword}
            onChange={(e)=>setKeyword(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') loadHotels() }}
          />
          <input
            className="form-input"
            placeholder="城市"
            value={city}
            onChange={(e)=>setCity(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') loadHotels() }}
          />
          <button className="btn-ghost" onClick={() => { setKeyword(''); setCity(''); }}>清空</button>
          <button className="btn-add" onClick={loadHotels}>{loading ? '查询中...' : '查询'}</button>
        </div>

        <div className="hotel-list">
          {hotels.map((h) => (
            <div className="hotel-card" key={h.id}>
              <div className="card-thumb">
                {cover(h)
                  ? <img src={cover(h)} alt={h.name} onError={(e)=>{ e.currentTarget.src = 'https://picsum.photos/seed/yisu_web_fallback/1280/720' }} />
                  : <div className="thumb-empty">暂无图片</div>}
              </div>
              <div className="hotel-name">{h.name}</div>
              <div className="hotel-attr">{h.nameEn}</div>
              <div className="hotel-attr">{h.starLevel}星 · {h.city}{h.county}</div>
              <div className="hotel-attr">{h.address}</div>
              <div className={`status-chip ${getStatusMeta(h).className}`}>{getStatusMeta(h).label}</div>
              {Number(h.audit_status) === 2 && h.audit_reason ? (
                <div className="hotel-attr" style={{ color: '#b42318', fontWeight: 600 }}>审核备注：{h.audit_reason}</div>
              ) : null}

              <div className="card-btn-group">
                <button className="action-btn detail" onClick={()=>navigate(`/hotels/${h.id}`)}>详情</button>
                {isMerchant ? <button className="action-btn edit" onClick={()=>navigate(`/hotels/${h.id}/edit`)}>编辑</button> : null}

                {isAdmin && Number(h.audit_status) === 0 ? (
                  <>
                    <button className="action-btn approve" onClick={()=>handleAction(() => auditHotel(h.id, 'approve'))}>审核通过</button>
                    <button className="action-btn reject" onClick={()=>handleAction(() => auditHotel(h.id, 'reject'))}>驳回</button>
                  </>
                ) : null}

                {isAdmin && Number(h.audit_status) === 1 && Number(h.online_status) === 0 ? (
                  <button className="action-btn approve" onClick={()=>handleAction(() => publishHotel(h.id))}>发布上线</button>
                ) : null}

                {(Number(h.online_status) === 1 || isMerchant) ? (
                  <button className="action-btn delete" onClick={()=>handleAction(() => offlineHotel(h.id))}>下线</button>
                ) : null}
              </div>
            </div>
          ))}
          {!hotels.length && !loading ? <div className="empty-tip">暂无酒店数据</div> : null}
        </div>
      </div>
    </div>
  )
}
