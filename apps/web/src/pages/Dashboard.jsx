import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '../styles/dashboard.css'

export default function Dashboard(){
  const [hotels, setHotels] = useState([])
  const [submissions, setSubmissions] = useState([])
  const [filter, setFilter] = useState('all')
  const mountedRef = useRef(true)
  const navigate = useNavigate()

  useEffect(()=>{
    mountedRef.current = true
    async function load(){
      try {
        const res = await fetch('/api/hotels')
        const j = await res.json()
        if (j && Array.isArray(j.data)) {
          if (mountedRef.current) setHotels(j.data)
        }
      } catch(e){ console.warn('load hotels failed', e) }
    }
    load()
    return ()=>{ mountedRef.current = false }
  }, [])

  async function loadSubmissions(){
    try{
      const res = await fetch('/api/submissions')
      const j = await res.json()
      if (j && Array.isArray(j.data)) setSubmissions(j.data)
    }catch(e){ console.warn('load submissions failed', e) }
  }

  function imgFor(h){ try { if (h.image) return h.image } catch(e){} return 'pic/hotel_' + (h.id||0) + '.png' }

  const handleDetail = (id) => { navigate(`/hotels/${id}`) }
  const handleEdit = (id) => { navigate(`/hotels/${id}/edit`) }
  const handleDelete = async (id) => {
    if (!confirm('确认删除该酒店？')) return;
    try {
      const res = await fetch(`/api/hotels/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setHotels(prev => prev.filter(h => h.id !== id))
        return
      }
    } catch(e){}
    try { await fetch(`/api/submissions/${id}/reject`, { method: 'POST' }); setHotels(prev => prev.filter(h => h.id !== id)) } catch(e){ console.error(e); alert('删除失败'); }
  }

  return (
    <div className="dashboard-page">
      <div className="top-nav">
        <div className="nav-logo"><div className="logo-icon">🏨</div><span>易宿酒店商家管理后台</span></div>
        <div className="user-info"><span id="userWelcome">欢迎</span><button className="logout-btn" id="logoutBtn" onClick={()=>{ sessionStorage.removeItem('username'); sessionStorage.removeItem('role'); window.location.href = '/login' }}>退出登录</button></div>
      </div>
      <div className="container">
        <div className="title-row">
          <div className="page-title"><span>我的酒店</span></div>
          <button className="btn-add" onClick={()=> navigate('/hotels/0/edit')}>➕ 新增酒店</button>
        </div>
        <div id="filterRow" className="filter-row">
          <button id="tabAll" type="button" className={`filter-btn all ${filter==='all'?'active':''}`} onClick={()=>{ setFilter('all') }}>全部</button>
          <button id="tabApproved" type="button" className={`filter-btn approved ${filter==='approved'?'active':''}`} onClick={()=>{ setFilter('approved') }}>已审核</button>
          <button id="tabPending" type="button" className={`filter-btn pending ${filter==='pending'?'active':''}`} onClick={()=>{ setFilter('pending'); if (!submissions.length) loadSubmissions() }}>未审核</button>
        </div>
        <div className="hotel-list">
          {filter === 'pending' ? (
            submissions.length ? submissions.map(s => (
              <div className="hotel-card" key={`s-${s.id}`} data-approved="false">
                <div className="card-thumb"><img src={s.image || imgFor(s)} alt={s.name||''} /></div>
                <div className="hotel-name">{s.name||''}</div>
                <div className="hotel-attr"><span>{s.star||''}</span> {s.address||''}</div>
                <div className="hotel-attr">价格区间：{s.priceRange||''}</div>
                <div className="hotel-attr">总客房数：{s.totalRooms||''}</div>
                <div className="hotel-attr">热门房型：{(s.roomTypes && Array.isArray(s.roomTypes)) ? s.roomTypes.join('、') : (s.roomTypes||'')}</div>
                <div className="hotel-desc">{(s.discounts && Array.isArray(s.discounts)) ? s.discounts.join('，') : (s.discounts||'')}</div>
                <div className="card-btn-group">
                  <button className="action-btn approve" onClick={async ()=>{
                    try { const res = await fetch(`/api/submissions/${s.id}/approve`, { method: 'POST' }); if (res.ok){ const j = await res.json(); setSubmissions(prev=>prev.filter(x=>x.id!==s.id)); if (j && j.data) setHotels(prev=>[j.data, ...prev]); } } catch(e){ console.error(e); alert('通过失败') }
                  }}>通过</button>
                  <button className="action-btn reject" onClick={async ()=>{ try { const res = await fetch(`/api/submissions/${s.id}/reject`, { method: 'POST' }); if (res.ok) setSubmissions(prev=>prev.filter(x=>x.id!==s.id)); } catch(e){ console.error(e); alert('驳回失败') } }}>驳回</button>
                </div>
              </div>
            )) : <div className="empty-tip">暂无未审核的提交</div>
          ) : (
            hotels.map(h => (
              <div className="hotel-card" key={h.id} data-approved="true">
                <div className="card-thumb"><img src={imgFor(h)} alt={h.name||''} /></div>
                <div className="hotel-name">{h.name||''}</div>
                <div className="hotel-attr"><span>{h.star||''}</span> {h.address||''}</div>
                <div className="hotel-attr">价格区间：{h.priceRange||''}</div>
                <div className="hotel-attr">总客房数：{h.totalRooms||''}</div>
                <div className="hotel-attr">热门房型：{(h.roomTypes && Array.isArray(h.roomTypes)) ? h.roomTypes.join('、') : (h.roomTypes||'')}</div>
                <div className="hotel-desc">{(h.discounts && Array.isArray(h.discounts)) ? h.discounts.join('，') : (h.discounts||'')}</div>
                <div className="card-btn-group">
                  <button className="action-btn detail" onClick={()=>handleDetail(h.id)}>酒店详情</button>
                  <button className="action-btn edit" onClick={()=>handleEdit(h.id)}>修改</button>
                  <button className="action-btn delete" onClick={()=>handleDelete(h.id)}>删除</button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
