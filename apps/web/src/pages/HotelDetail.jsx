import React, { useEffect, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import '../styles/hotel-detail.css'

export default function HotelDetail(){
  const { id } = useParams()
  const navigate = useNavigate()
  const hid = Number(id) || 0
  const [hotel, setHotel] = useState(null)
  const [rooms, setRooms] = useState([])
  const [orders, setOrders] = useState([])
  const [activeTab, setActiveTab] = useState('baseInfo')
  const location = useLocation()

  // read optional ?tab=... parameter to switch to a specific tab when arriving
  useEffect(()=>{
    try{
      const params = new URLSearchParams(location.search)
      const t = params.get('tab')
      if (t) setActiveTab(t)
    }catch(e){}
  },[location.search])

  useEffect(()=>{
    async function load(){
      let target = hid
      if (!target){
        try{ const res = await fetch('/api/hotels'); const j = await res.json(); if (j && Array.isArray(j.data) && j.data.length) target = j.data[0].id }catch(e){}
      }
      if (!target) return
      try{
        const r1 = await fetch(`/api/hotels/${target}`)
        const j1 = await r1.json()
        if (j1 && j1.data) setHotel(j1.data)
      }catch(e){ console.warn(e) }
      try{ const r3 = await fetch(`/api/orders/${target}`); const j3 = await r3.json(); if (j3 && Array.isArray(j3.data)) setOrders(j3.data) }catch(e){ console.warn('orders fetch failed', e) }
    }
    load()
  },[id])

  useEffect(()=>{
    const resolved = resolveRooms(hotel)
    if (resolved.length){
      setRooms(resolved)
      return
    }
    if (!hid) return
    let cancelled = false
    async function fetchRoomsFallback(){
      try{
        const res = await fetch(`/api/hotels/${hid}/rooms`)
        const json = await res.json()
        const list = Array.isArray(json && json.data) ? json.data : (Array.isArray(json) ? json : Array.isArray(json && json.rows) ? json.rows : [])
        if (!cancelled) setRooms(list)
      }catch(err){ console.warn('rooms fallback failed', err) }
    }
    fetchRoomsFallback()
    return ()=>{ cancelled = true }
  },[hotel, hid])

  function renderTag(item, idx){
    const text = String(item).replace(/\(|\)|热门/g,'')
    const cls = String(item).includes('热门')? 'tag hot' : 'tag'
    const key = typeof item === 'string' && item.length ? item : idx
    return (<span className={cls} key={key}>{text}</span>)
  }

  function resolveRooms(h){
    if (!h) return []
    if (Array.isArray(h.rooms) && h.rooms.length) return h.rooms
    if (h.priceData && Array.isArray(h.priceData.roomPriceList)) return h.priceData.roomPriceList
    return []
  }

  function priceStats(){
    const list = rooms
    const total = list ? list.length : 0
    const currents = (list||[]).map(r=>Number(r.current||0)).filter(n=>!isNaN(n))
    const originals = (list||[]).map(r=>Number(r.original||0)).filter(n=>!isNaN(n))
    const all = currents.concat(originals)
    const max = all.length? Math.max(...all): 0
    const min = all.length? Math.min(...all): 0
    const avg = currents.length? Math.round(currents.reduce((a,b)=>a+b,0)/currents.length): 0
    return { total, min, max, avg }
  }

  async function handleDeleteHotel(){ if (!hid) return; if (!confirm('确认删除该酒店？')) return; try{ const res = await fetch(`/api/hotels/${hid}`,{ method:'DELETE' }); if (res.ok) navigate('/dashboard') }catch(e){ alert('删除失败') } }

  // 订单与房态统计计算
  function formatYMD(d){ if (!d) return null; try{ const dt = new Date(d); if (isNaN(dt)) return null; return dt.toISOString().slice(0,10); }catch(e){ return null } }
  function orderStats(){
    const today = new Date(); const todayStr = today.toISOString().slice(0,10);
    const ords = Array.isArray(orders)? orders : [];
    const roomsList = Array.isArray(rooms)? rooms : [];
    const todayCheckins = ords.filter(o => {
      const c = formatYMD(o.checkIn)||formatYMD(o.checkInDate)||formatYMD(o.createdAt);
      return c === todayStr;
    }).length;
    const todayCheckouts = ords.filter(o => {
      const l = formatYMD(o.leave)||formatYMD(o.leaveDate);
      return l === todayStr;
    }).length;
    const totalAvailable = roomsList.reduce((s,r)=> s + (Number(r.remain)||0), 0);
    const totalOccupied = ords.filter(o => String(o.status) === 'checked').length;
    return { todayCheckins, todayCheckouts, totalAvailable, totalOccupied };
  }

  return (
    <div className="hotel-detail-page">
      <div className="top-nav">
        <div className="nav-logo"><div className="logo-icon">🏨</div><span>易宿酒店商家管理后台</span></div>
        <div className="user-info"><span id="userWelcome">欢迎</span><button className="logout-btn" onClick={()=>{ sessionStorage.removeItem('username'); sessionStorage.removeItem('role'); navigate('/login') }}>退出登录</button></div>
      </div>
      <div className="container">
        <div className="tab-nav">
          <div className={`tab-item ${activeTab==='baseInfo'?'active':''}`} onClick={()=>setActiveTab('baseInfo')}>🏨 酒店基本情况</div>
          <div className={`tab-item ${activeTab==='priceOverview'?'active':''}`} onClick={()=>setActiveTab('priceOverview')}>🛏️ 房型概览</div>
          <div className={`tab-item ${activeTab==='orderStatus'?'active':''}`} onClick={()=>setActiveTab('orderStatus')}>📋 当日订单情况</div>
        </div>

        <div className="tab-content">
          <button className="back-btn" onClick={()=>navigate('/dashboard')}>← 返回酒店列表</button>
          <button className="btn-default-mini" style={{background:'#f56c6c',color:'#fff',border:'none',marginLeft:8}} onClick={handleDeleteHotel}>删除酒店</button>

          <div id="baseInfo" className="tab-panel" style={{display: activeTab==='baseInfo' ? 'block' : 'none'}}>
            <h2 className="content-title">酒店基本情况</h2>
            <div className="hero-row">
              <div className="image-hero" id="detailImageHero">
                {hotel && (hotel.image ? <img src={hotel.image} alt="hotel"/> : <img src={`pic/hotel_${hotel.id||0}.png`} alt="hotel"/>) }
              </div>
              <div className="hotel-title-block" id="hotelTitleBlock">
                <div className="hotel-title-cn">{hotel?.name || ''}</div>
                <div className="hotel-title-en">{hotel?.nameEn || ''}</div>
                <div className="hotel-subline"><strong>地址：</strong>{hotel?.address || ''}</div>
                <div className="hotel-subline"><strong>星级：</strong>{hotel?.star || ''}</div>
                <div className="hotel-subline"><strong>基础价格区间：</strong>{hotel?.priceRange || ''}</div>
                <div className="hotel-subline"><strong>开业时间：</strong>{hotel?.openTime || ''}</div>
                <div style={{marginTop:8}} className="tag-group">{(hotel?.roomTypes || []).map(renderTag)}</div>
              </div>
            </div>
            <div className="below-tags-row">
              <div className="below-line"><span className="below-label">附近热门景点</span><div className="tag-group">{(hotel?.scenicSpots || []).map(s=> <span className="tag" key={s}>{s}</span>)}</div></div>
              <div className="below-line"><span className="below-label">交通及商场</span><div className="tag-group">{(hotel?.trafficMall || []).map(s=> <span className="tag" key={s}>{s}</span>)}</div></div>
            </div>
            <div className="base-info" id="baseInfoContainer">
              <div className="info-item" style={{gridColumn:'1 / -1'}}>
                <span className="info-label"><strong>当前优惠活动</strong></span>
                <div className="info-value tag-group">{(hotel?.discounts || []).map((d,i)=> <span className="tag discount-tag" key={i}>{d}</span>)}</div>
              </div>
            </div>
          </div>

          <div id="priceOverview" className="tab-panel" style={{display: activeTab==='priceOverview' ? 'block' : 'none'}}>
            <h2 className="content-title">房型概览 <span className="title-actions"><button className="btn-mini btn-primary-mini" onClick={()=>navigate(hid?`/hotels/${hid}/rooms`:'/hotels/0/rooms')}>新增房型</button></span></h2>
            <div className="price-overview" id="priceOverviewContainer">
              <div className="price-stats" id="priceStatsContainer">
                {(()=>{ const s = priceStats(); return (
                  <>
                    <div className="price-stat-card"><div className="price-stat-label">房型总数</div><div className="price-stat-num total">{s.total}</div></div>
                    <div className="price-stat-card"><div className="price-stat-label">可预订房型</div><div className="price-stat-num available">{rooms.filter(r=>r.status==='available').length}</div></div>
                    <div className="price-stat-card"><div className="price-stat-label">紧张房型</div><div className="price-stat-num low">{rooms.filter(r=>r.status==='low').length}</div></div>
                    <div className="price-stat-card"><div className="price-stat-label">已售罄房型</div><div className="price-stat-num soldout">{rooms.filter(r=>r.status==='soldout').length}</div></div>
                  </>
                )})()}
              </div>
              <table className="price-table">
                <thead>
                  <tr><th>房型图片</th><th>房型名称</th><th>剩余房量</th><th>房态</th><th>当日价格</th><th>折扣</th><th>备注</th><th>操作</th></tr>
                </thead>
                <tbody id="priceTableBody">
                  {rooms && rooms.length? rooms.map(r=> (
                    <tr key={r.id} data-room-id={r.id}>
                      <td className="room-thumb">{r.image? <img src={r.image} alt="r"/> : <div className="thumb-empty">无图</div>}</td>
                      <td>{r.type}</td>
                      <td>{r.remain}间</td>
                      <td><span className={`room-status ${r.status}`}>{r.status==='available'?'可预订': r.status==='low'?'房量紧张':'已售罄'}</span></td>
                      <td><span className="price-current">{r.current}元</span>{r.original? <span className="price-original">{r.original}元</span> : null}</td>
                      <td>{r.discount}</td>
                      <td>{r.remark}</td>
                      <td><div className="room-ops"><button className="action-mini delete" onClick={async ()=>{ if (!confirm('确认删除该房型？')) return; try{ await fetch(`/api/hotels/${hid}/rooms/${r.id}`,{ method:'DELETE' }); setRooms(rooms.filter(x=>x.id!==r.id)) }catch(e){ alert('删除失败') } }}>删除房型</button><button className="action-mini edit" onClick={()=>{ const url = hid ? `/hotels/${hid}/rooms${r && r.id ? '?editRoomId=' + r.id : ''}` : '/hotels/0/rooms'; navigate(url) }}>修改信息</button></div></td>
                    </tr>
                  )) : (<tr><td colSpan={8} className="empty-tip">未找到房型数据</td></tr>)}
                </tbody>
              </table>
            </div>
          </div>

          <div id="orderStatus" className="tab-panel" style={{display: activeTab==='orderStatus' ? 'block' : 'none'}}>
            <h2 className="content-title">当日订单情况（<span id="orderDate">{new Date().toLocaleDateString()}</span>）</h2>
            <div className="order-list" id="orderListContainer">
              <div className="order-overview" id="orderOverviewContainer">
                {/* 四项概览统计：今日入住 / 今日退房 / 全部可用 / 全部已占用 */}
                {(()=>{ const s = orderStats(); return (
                  <>
                    <div className="overview-item"><div className="overview-label">今日入住</div><div className="overview-num">{s.todayCheckins}</div></div>
                    <div className="overview-item"><div className="overview-label">今日退房</div><div className="overview-num">{s.todayCheckouts}</div></div>
                    <div className="overview-item"><div className="overview-label">全部可用</div><div className="overview-num">{s.totalAvailable}</div></div>
                    <div className="overview-item"><div className="overview-label">全部已占用</div><div className="overview-num">{s.totalOccupied}</div></div>
                  </>
                )})()}
              </div>
              <table className="order-table">
                <thead><tr><th>订单编号</th><th>房间号</th><th>房型</th><th>入住客人</th><th>预订电话</th><th>订单金额</th><th>订单状态</th><th>预计离店</th><th>支付方式</th></tr></thead>
                <tbody id="orderTableBody">{orders && orders.length? orders.map(o=> (<tr key={o.orderNo}><td>{o.orderNo}</td><td>{o.room}</td><td>{o.type}</td><td>{o.guest}</td><td>{o.phone}</td><td className="order-amount">{o.amount}</td><td><span className={`order-status ${o.status}`}>{o.status}</span></td><td>{o.leaveDate||''}</td><td>{o.payType||''}</td></tr>)) : (<tr><td colSpan={9} className="empty-tip">暂无订单</td></tr>)}</tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
