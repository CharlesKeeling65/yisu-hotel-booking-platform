import React, { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import '../styles/hotel-detail.css'

function authUser() {
  try { return JSON.parse(localStorage.getItem('authUser') || 'null') } catch { return null }
}

export default function HotelDetail(){
  const { id } = useParams()
  const navigate = useNavigate()
  const user = authUser()

  const [hotel, setHotel] = useState(null)
  const [rooms, setRooms] = useState([])
  const [currentImageIndex, setCurrentImageIndex] = useState(0)

  const isAdmin = user?.role === 'admin'

  function formatCnDate(value) {
    if (!value) return ''
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return String(value).slice(0, 10)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}年${m}月${day}日`
  }

  async function load() {
    if (!id) return
    const [hRes, rRes] = await Promise.all([fetch(`/api/hotels/${id}`), fetch(`/api/hotels/${id}/rooms`)])
    const hJson = await hRes.json().catch(() => null)
    const rJson = await rRes.json().catch(() => null)
    if (hRes.ok && hJson?.data) setHotel(hJson.data)
    if (rRes.ok && Array.isArray(rJson?.data)) setRooms(rJson.data)
  }

  useEffect(() => {
    if (!user) { navigate('/login', { replace: true }); return }
    load().catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user])

  useEffect(() => setCurrentImageIndex(0), [hotel?.id])

  const bannerImages = useMemo(() => {
    if (Array.isArray(hotel?.images) && hotel.images.length) return hotel.images
    if (hotel?.image) return [hotel.image]
    return []
  }, [hotel])

  async function approve() {
    await fetch(`/api/admin/hotels/${id}/audit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve', reason: '审核通过，待发布上线。', auditorId: user.id }),
    })
    await load()
  }

  async function reject() {
    const reason = prompt('请输入驳回原因：')
    if (!reason) return
    await fetch(`/api/admin/hotels/${id}/audit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reject', reason, auditorId: user.id }),
    })
    await load()
  }

  async function publish() {
    await fetch(`/api/admin/hotels/${id}/publish`, { method: 'POST' })
    await load()
  }

  async function offline() {
    const endpoint = isAdmin ? `/api/admin/hotels/${id}/offline` : `/api/hotels/${id}`
    await fetch(endpoint, { method: isAdmin ? 'POST' : 'DELETE' })
    await load()
  }

  if (!hotel) return <div className="container"><div className="empty-tip">加载中...</div></div>

  return (
    <div className="hotel-detail-page">
      <div className="top-nav">
        <div className="nav-logo"><div className="logo-icon">🏨</div><span>酒店详情</span></div>
        <div className="user-info"><button className="logout-btn" onClick={()=>navigate('/dashboard')}>返回工作台</button></div>
      </div>

      <div className="container">
        <div className="tab-content">
          <button className="back-btn" onClick={()=>navigate('/dashboard')}>← 返回酒店列表</button>

          <div className="content-title">
            <span>{hotel.name}</span>
            <span className="title-actions">
              {user?.role === 'merchant' ? <button className="btn-mini btn-primary-mini" onClick={()=>navigate(`/hotels/${id}/edit`)}>编辑信息</button> : null}
              {user?.role === 'merchant' ? <button className="btn-mini btn-primary-mini" onClick={()=>navigate(`/hotels/${id}/rooms`)}>编辑房型</button> : null}
              {isAdmin && Number(hotel.audit_status) === 0 ? <button className="btn-mini btn-primary-mini" onClick={approve}>审核通过</button> : null}
              {isAdmin && Number(hotel.audit_status) === 0 ? <button className="btn-mini btn-danger-mini" onClick={reject}>驳回</button> : null}
              {isAdmin && Number(hotel.audit_status) === 1 && Number(hotel.online_status) === 0 ? <button className="btn-mini btn-primary-mini" onClick={publish}>发布上线</button> : null}
              {(Number(hotel.online_status) === 1 || user?.role === 'merchant') ? <button className="btn-mini btn-danger-mini" onClick={offline}>下线</button> : null}
            </span>
          </div>

          <div className="hero-row">
            <div className="image-hero">
              {bannerImages.length
                ? <img src={bannerImages[currentImageIndex]} alt="hotel" onError={(e)=>{ e.currentTarget.src = 'https://picsum.photos/seed/yisu_web_hotel/1280/720' }} />
                : <div className="thumb-empty">暂无图片</div>}
              {bannerImages.length > 1 ? (
                <>
                  <button className="hero-arrow left" onClick={() => setCurrentImageIndex((prev) => (prev - 1 + bannerImages.length) % bannerImages.length)}>‹</button>
                  <button className="hero-arrow right" onClick={() => setCurrentImageIndex((prev) => (prev + 1) % bannerImages.length)}>›</button>
                </>
              ) : null}
            </div>

            <div className="hotel-title-block">
              <div className="hotel-title-cn">{hotel.name}</div>
              <div className="hotel-title-en">{hotel.nameEn}</div>
              <div className="hotel-subline">星级：{hotel.starLevel}星</div>
              <div className="hotel-subline">开业时间：{formatCnDate(hotel.openTime)}</div>
              <div className="hotel-subline">地址：{hotel.fullAddress}</div>
              <div className="hotel-subline">
                当前状态：
                {Number(hotel.audit_status) === 0 ? '待审核' : ''}
                {Number(hotel.audit_status) === 1 && Number(hotel.online_status) === 0 ? '待上线' : ''}
                {Number(hotel.audit_status) === 1 && Number(hotel.online_status) === 1 ? '已上线' : ''}
                {Number(hotel.audit_status) === 2 ? '审核未通过' : ''}
              </div>
              {Number(hotel.audit_status) === 2 && hotel.audit_reason ? (
                <div className="hotel-subline" style={{ color: '#b42318', fontWeight: 700 }}>
                  审核备注：{hotel.audit_reason}
                </div>
              ) : null}
              <div className="tag-group">{(hotel.labels || []).map((l) => <span className="tag" key={l}>{l}</span>)}</div>
            </div>
          </div>

          <h3 className="content-sub-title">房型价格（从低到高）</h3>
          <table className="price-table">
            <thead>
              <tr><th>房型图片</th><th>房型名称</th><th>入住人数</th><th>面积</th><th>状态</th><th>价格</th></tr>
            </thead>
            <tbody>
              {rooms.length ? [...rooms].sort((a,b)=>Number(a.current)-Number(b.current)).map((r) => (
                <tr key={r.id}>
                  <td className="room-thumb">{r.image ? <img src={r.image} alt="r" onError={(e)=>{ e.currentTarget.src = 'https://picsum.photos/seed/yisu_web_room/800/500' }} /> : <div className="thumb-empty">无图</div>}</td>
                  <td>{r.type}</td>
                  <td>{r.occupancy}人</td>
                  <td>{r.size || '-'}㎡</td>
                  <td><span className={`room-status ${r.status}`}>{r.status==='soldout'?'已售罄':'可预订'}</span></td>
                  <td><span className="price-current">{r.current}元</span></td>
                </tr>
              )) : <tr><td colSpan={6} className="empty-tip">暂无房型数据</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
