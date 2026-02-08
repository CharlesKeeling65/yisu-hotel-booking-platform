import React, { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import '../styles/hotel-edit.css'

export default function HotelEdit(){
  const { id } = useParams()
  const navigate = useNavigate()
  const [hotel, setHotel] = useState(null)
  const [saving, setSaving] = useState(false)
  const [imagePreview, setImagePreview] = useState('')
  const fileInputRef = useRef(null)

  useEffect(()=>{
    if (id === '0'){
      setHotel({ id:0, name:'', nameEn:'', star:'', openTime:'', address:'', priceRange:'', totalRooms:0, roomTypes:'', scenicSpots:'', trafficMall:'', discounts:'', priceData:{roomPriceList:[]}, image:'' })
      setImagePreview('')
      return
    }
    fetch(`/api/hotels/${id}`).then(r=>{
      if (!r.ok) throw new Error('not found')
      return r.json()
    }).then(j=>{
      if (j && j.data) {
        const h = j.data
        const base = { ...h, roomTypes: Array.isArray(h.roomTypes)? h.roomTypes.join(',') : (h.roomTypes||''), scenicSpots: Array.isArray(h.scenicSpots)? h.scenicSpots.join(','):(h.scenicSpots||''), trafficMall: Array.isArray(h.trafficMall)? h.trafficMall.join(','):(h.trafficMall||''), discounts: Array.isArray(h.discounts)? h.discounts.join(','):(h.discounts||'') }
        // 优先恢复编辑草稿（若存在），以保留未提交的表单数据
        try{
          const draftKey = 'hotelEditDraft:' + (id||0)
          const raw = localStorage.getItem(draftKey)
          if (raw){ const draft = JSON.parse(raw);
            // merge draft into base so that missing basic info from a minimal draft won't wipe fetched data
            const merged = { ...base, ...draft }
            // ensure priceData merges roomPriceList if present in draft
            if (draft.priceData) merged.priceData = { ...(base.priceData || {}), ...draft.priceData }
            setHotel(merged)
            setImagePreview(draft.image || base.image || `pic/hotel_${base.id}.png`)
            return
          }
        }catch(e){}
        setHotel(base)
        setImagePreview(h.image || `pic/hotel_${h.id}.png`)
      } else setHotel(null)
    }).catch(()=> setHotel(null))
  },[id])

  function validateForm(){
    if (!hotel) return false
    if (!hotel.name || !hotel.star || !hotel.openTime || !hotel.address || !hotel.priceRange || !hotel.totalRooms || !hotel.roomTypes) {
      return false
    }
    return true
  }

  function handleFileChange(e){
    const file = (e.target.files || [])[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const img = new Image()
      img.onload = ()=>{
        const resized = resizeTo16x9(img, 1280, 720)
        setImagePreview(resized)
      }
      img.src = ev.target.result
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  function clearImage(){ setImagePreview('') }

  async function handleSubmit(){
    if (!validateForm()) { alert('请完整填写必填项'); return }
    setSaving(true)
    const payload = {
      name: hotel.name,
      nameEn: hotel.nameEn,
      star: hotel.star,
      openTime: hotel.openTime,
      address: hotel.address,
      priceRange: hotel.priceRange,
      totalRooms: Number(hotel.totalRooms)||0,
      roomTypes: hotel.roomTypes.split(',').map(s=>s.trim()).filter(Boolean),
      scenicSpots: hotel.scenicSpots.split(',').map(s=>s.trim()).filter(Boolean),
      trafficMall: hotel.trafficMall.split(',').map(s=>s.trim()).filter(Boolean),
      discounts: hotel.discounts.split(',').map(s=>s.trim()).filter(Boolean),
      priceData: hotel.priceData || { roomPriceList: [] },
      image: imagePreview || ''
    }
    try{
      if (id === '0'){
        const res = await fetch('/api/hotels', { method:'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) })
        const j = await res.json()
        setSaving(false)
        if (res.ok && j && j.data) {
          navigate(`/hotels/${j.data.id}/edit`)
          return
        }
        alert('创建失败')
      } else {
          try{
            const res = await fetch(`/api/hotels/${id}`, { method:'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) })
            const j2 = await res.json().catch(()=>null)
            setSaving(false)
            if (res.ok) {
              // 提交成功后清除编辑草稿
              try{ localStorage.removeItem('hotelEditDraft:' + (id||0)) }catch(e){}
              alert('保存完成')
              navigate('/dashboard')
              return
            } else {
              alert('保存失败')
            }
          }catch(err){ setSaving(false); console.error(err); alert('保存失败') }
        }
    }catch(e){ setSaving(false); console.error(e); alert('保存失败') }
  }

  async function handleDelete(){
    if (!confirm('确认删除该酒店？')) return
    try{
      const res = await fetch(`/api/hotels/${id}`, { method:'DELETE' })
      if (res.ok) navigate('/dashboard')
    }catch(e){ console.error(e); alert('删除失败') }
  }

  function openEditRooms(){
    const targetId = id === '0' ? 0 : id
    // 在跳转前保存当前表单为草稿，返回时可恢复
    try{ const key = 'hotelEditDraft:' + (id||0); localStorage.setItem(key, JSON.stringify(hotel || {})) }catch(e){}
    navigate(`/hotels/${targetId}/rooms`)
  }

  if (!hotel) return <div className="container"><div className="empty-tip">加载中或未找到酒店</div></div>

  return (
    <div>
      <div className="top-nav">
        <div className="nav-logo"><div className="logo-icon">🏨</div><span>易宿酒店商家管理后台</span></div>
        <div className="user-info"><span id="userWelcome">欢迎</span><button className="logout-btn" onClick={()=>{ sessionStorage.removeItem('username'); sessionStorage.removeItem('role'); navigate('/login') }}>退出登录</button></div>
      </div>
      <div className="container">
        <div className="page-title">
          <button className="btn-back" onClick={()=>navigate('/dashboard')}>← 返回酒店列表</button>
          <span id="pageTitleText">{id==='0' ? '新增酒店信息' : '修改酒店信息'}</span>
        </div>

        <div className="form-card">
          <div className="form-grid">
            <div className="form-item">
              <label className="form-label required">酒店名称（中文）</label>
              <input className="form-input" value={hotel.name||''} onChange={e=>setHotel({...hotel, name:e.target.value})} />
            </div>
            <div className="form-item">
              <label className="form-label">酒店名称（英文）</label>
              <input className="form-input" value={hotel.nameEn||''} onChange={e=>setHotel({...hotel, nameEn:e.target.value})} />
            </div>
            <div className="form-item">
              <label className="form-label required">酒店星级</label>
              <select className="form-select" value={hotel.star||''} onChange={e=>setHotel({...hotel, star:e.target.value})}>
                <option value="">请选择酒店星级</option>
                <option value="⭐⭐⭐ 三星级">⭐⭐⭐ 三星级</option>
                <option value="⭐⭐⭐⭐ 四星级">⭐⭐⭐⭐ 四星级</option>
                <option value="⭐⭐⭐⭐⭐ 五星级">⭐⭐⭐⭐⭐ 五星级</option>
                <option value="轻奢精品 无星级">轻奢精品 无星级</option>
              </select>
            </div>
            <div className="form-item">
              <label className="form-label required">开业时间</label>
              <input type="date" className="form-input" value={hotel.openTime||''} onChange={e=>setHotel({...hotel, openTime:e.target.value})} />
            </div>
            <div className="form-item" style={{gridColumn:'1 / -1'}}>
              <label className="form-label required">酒店详细地址</label>
              <input className="form-input" value={hotel.address||''} onChange={e=>setHotel({...hotel, address:e.target.value})} placeholder="省市区+详细地址" />
            </div>
            <div className="form-item">
              <label className="form-label required">基础价格区间</label>
              <input className="form-input" value={hotel.priceRange||''} onChange={e=>setHotel({...hotel, priceRange:e.target.value})} />
            </div>
            <div className="form-item">
              <label className="form-label required">总客房数</label>
              <input type="number" className="form-input" min="1" value={hotel.totalRooms||0} onChange={e=>setHotel({...hotel, totalRooms: e.target.value})} />
            </div>
            <div className="form-item" style={{gridColumn:'1 / -1'}}>
              <label className="form-label required">酒店房型</label>
              <input className="form-input" value={hotel.roomTypes||''} onChange={e=>setHotel({...hotel, roomTypes:e.target.value})} placeholder="多个房型用英文逗号分隔" />
              <div className="form-tip">多个房型用英文逗号分隔，例：商务大床房,行政套房（热门）</div>
            </div>
            <div className="form-item" style={{gridColumn:'1 / -1'}}>
              <label className="form-label">附近热门景点</label>
              <input className="form-input" value={hotel.scenicSpots||''} onChange={e=>setHotel({...hotel, scenicSpots:e.target.value})} />
            </div>
            <div className="form-item" style={{gridColumn:'1 / -1'}}>
              <label className="form-label">交通及周边商场</label>
              <input className="form-input" value={hotel.trafficMall||''} onChange={e=>setHotel({...hotel, trafficMall:e.target.value})} />
            </div>
            <div className="form-item" style={{gridColumn:'1 / -1'}}>
              <label className="form-label">当前优惠活动</label>
              <textarea className="form-textarea" value={hotel.discounts||''} onChange={e=>setHotel({...hotel, discounts:e.target.value})}></textarea>
            </div>
            <div className="form-item" style={{gridColumn:'1 / -1'}}>
              <label className="form-label">房型明细（JSON 数组）</label>
              <div style={{display:'flex',gap:8,alignItems:'flex-start'}}>
                <textarea className="form-textarea" style={{flex:1}} value={JSON.stringify(hotel.priceData && hotel.priceData.roomPriceList? hotel.priceData.roomPriceList:[], null, 2)} onChange={e=>{
                  try{ const arr = JSON.parse(e.target.value); setHotel({...hotel, priceData:{roomPriceList: Array.isArray(arr)?arr:[]}}) }catch(err){ setHotel({...hotel, priceData:{roomPriceList:[]}}) }
                }} />
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  <button type="button" className="btn btn-default" onClick={openEditRooms}>编辑房型明细</button>
                  <div className="form-tip">点击编辑可在新页面新增/修改多条房型</div>
                </div>
              </div>
              <div className="form-tip">可选：填写房型明细 JSON，提交后将用于房型概览回显</div>
            </div>

            <div className="form-item" style={{gridColumn:'1 / -1'}}>
              <label className="form-label">酒店配图（单张）</label>
              <div className="image-section-title">默认：pic/hotel_{id}.png；上传后覆盖默认图（推荐尺寸：1280×720，16:9）</div>
              <div className="image-uploader">
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} />
                <span className="form-tip">仅支持单张；不上传则使用默认映射图片</span>
              </div>
              <div className="image-gallery">
                {imagePreview ? (
                  <div className="image-item">
                    <img src={imagePreview} alt="hotel" />
                    <button type="button" className="image-remove" onClick={clearImage}>删除</button>
                  </div>
                ) : (<div className="form-tip">当前暂无配图，提交后若未上传将使用默认映射图片。</div>)}
              </div>
            </div>
          </div>

          <div className="btn-group">
            <button type="button" className="btn btn-primary" onClick={handleSubmit}>{saving? '提交中...':'确认提交'}</button>
            <button type="button" className="btn btn-default" onClick={()=>{ window.location.reload() }}>重置表单</button>
            {id !== '0' && (<button type="button" className="btn" style={{background:'#f56c6c',color:'#fff'}} onClick={handleDelete}>删除酒店</button>)}
          </div>
        </div>
      </div>
    </div>
  )
}

// 图片处理函数：裁剪并缩放到 16:9
function resizeTo16x9(img, targetW, targetH){
  const canvas = document.createElement('canvas')
  canvas.width = targetW; canvas.height = targetH
  const ctx = canvas.getContext('2d')
  const srcW = img.naturalWidth, srcH = img.naturalHeight
  const targetRatio = targetW/targetH, srcRatio = srcW/srcH
  let drawW, drawH
  if (srcRatio > targetRatio){
    drawH = targetH; const scale = drawH / srcH; drawW = srcW * scale
  } else { drawW = targetW; const scale = drawW / srcW; drawH = srcH * scale }
  const offsetX = (targetW - drawW)/2, offsetY = (targetH - drawH)/2
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, offsetX, offsetY, drawW, drawH)
  return canvas.toDataURL('image/jpeg', 0.9)
}
