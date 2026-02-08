import React, { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import '../styles/hotel-rooms.css'

function toFiniteNumber(value, fallback = 0){
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

function toPositiveId(value){
  const num = Number(value)
  if (!Number.isFinite(num)) return undefined
  const intVal = Math.trunc(num)
  return intVal > 0 ? intVal : undefined
}

function normalizeRow(row = {}){
  return {
    ...row,
    id: toPositiveId(row.id),
    original: toFiniteNumber(row.original),
    current: toFiniteNumber(row.current),
    remain: toFiniteNumber(row.remain),
  }
}

function normalizeRows(list){
  return Array.isArray(list) ? list.map(item => normalizeRow({ ...item })) : []
}

const EMPTY_ROW = { type:'', original:0, current:0, discount:'', remain:0, status:'available', remark:'', image:'' }

export default function HotelRooms(){
  const { id } = useParams()
  const navigate = useNavigate()
  const hotelId = Number(id) || 0
  const [rows, setRows] = useState([])
  const [highlightIndex, setHighlightIndex] = useState(-1)
  const loadedRef = useRef(false)
  const listRef = useRef(null)
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  const editRoomId = params.get('editRoomId')

  useEffect(()=>{
    if (loadedRef.current) return
    loadedRef.current = true
    const draft = loadDraft()
    if (draft.length){
      setRows(draft)
      highlightIfNeeded(draft)
      return
    }
    if (!hotelId) return
    ;(async ()=>{
      const apiRooms = normalizeRows(await fetchRoomsFromApi(hotelId))
      if (apiRooms.length){
        setRows(apiRooms)
        highlightIfNeeded(apiRooms)
        return
      }
      const fallbackRooms = normalizeRows(await fetchRoomsFromHotel(hotelId))
      setRows(fallbackRooms)
      highlightIfNeeded(fallbackRooms)
    })()
  },[hotelId, editRoomId])

  function getStorageKey(){ return 'priceListDraft:' + (hotelId||0) }

  function loadDraft(){
    try{
      const raw = localStorage.getItem(getStorageKey())
      if (raw){
        const parsed = JSON.parse(raw)
        return normalizeRows(parsed)
      }
    }catch(e){}
    try{
      const merchants = JSON.parse(localStorage.getItem('merchantHotels')||'[]')
      const m = merchants.find(h=>h.id===hotelId)
      if (m && m.priceData && Array.isArray(m.priceData.roomPriceList)) return normalizeRows(m.priceData.roomPriceList)
    }catch(e){}
    try{
      const hotels = JSON.parse(localStorage.getItem('hotels')||'[]')
      const h = hotels.find(x=>x.id===hotelId)
      if (h && h.priceData && Array.isArray(h.priceData.roomPriceList)) return normalizeRows(h.priceData.roomPriceList)
    }catch(e){}
    return []
  }

  function persistDraft(list){
    try{ localStorage.setItem(getStorageKey(), JSON.stringify(normalizeRows(list))) }catch(e){}
  }

  async function fetchRoomsFromApi(targetId){
    try{
      const res = await fetch(`/api/hotels/${targetId}/rooms`)
      const json = await res.json()
      if (Array.isArray(json && json.data)) return json.data
      if (Array.isArray(json)) return json
      if (json && Array.isArray(json.rows)) return json.rows
    }catch(err){ console.warn('load rooms api failed', err) }
    return []
  }

  async function fetchRoomsFromHotel(targetId){
    try{
      const res = await fetch(`/api/hotels/${targetId}`)
      const json = await res.json()
      const detail = json && json.data
      if (!detail) return []
      if (Array.isArray(detail.rooms) && detail.rooms.length) return detail.rooms
      if (detail.priceData && Array.isArray(detail.priceData.roomPriceList)) return detail.priceData.roomPriceList.slice()
    }catch(err){ console.warn('load hotel fallback failed', err) }
    return []
  }

  function highlightIfNeeded(list){
    if (!editRoomId) return
    const idx = list.findIndex(x=>String(x.id) === String(editRoomId))
    if (idx < 0) return
    setTimeout(()=>{
      setHighlightIndex(idx)
      try{
        const node = listRef.current && listRef.current.children && listRef.current.children[idx]
        if (node){
          node.scrollIntoView({behavior:'smooth', block:'center'})
          const input = node.querySelector('input.type')
          if (input) input.focus()
        }
      }catch(e){}
    }, 120)
  }

  function addRow(){
    setRows(prev => [...prev, { ...EMPTY_ROW }])
  }

  function clearAll(){
    if (!confirm('清空所有房型草稿？')) return
    setRows([])
    persistDraft([])
  }

  async function saveAndBack(){
    persistDraft(rows)
    if (!hotelId || hotelId === 0){
      alert('当前为新酒店草稿，房型已保存为本地草稿。请先保存或创建酒店，然后在已有酒店下同步房型到数据库。')
      navigate(`/hotels/${hotelId}?tab=priceOverview`)
      return
    }
    try{
      const payloadRooms = normalizeRows(rows)
      const res = await fetch(`/api/hotels/${hotelId}/rooms/bulk`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ rooms: payloadRooms }) })
      const json = await res.json().catch(()=>null)
      if (!res.ok) throw new Error((json && json.msg) || '同步失败')
      const saved = Array.isArray(json && json.data) ? json.data : []
      const sanitized = normalizeRows(saved)
      setRows(sanitized)
      try{
        const editKey = 'hotelEditDraft:' + (hotelId||0)
        const raw = localStorage.getItem(editKey)
        if (raw){
          const draft = JSON.parse(raw)
          draft.priceData = { roomPriceList: sanitized }
          localStorage.setItem(editKey, JSON.stringify(draft))
        }
      }catch(e){ console.warn('update hotelEditDraft failed', e) }
      try{ localStorage.removeItem(getStorageKey()) }catch(e){}
      alert('房型已同步到数据库')
      navigate(`/hotels/${hotelId}?tab=priceOverview`)
    }catch(err){
      console.error(err)
      alert(err && err.message ? err.message : '同步失败，请检查网络或服务端')
    }
  }

  function updateRow(idx, patch){
    setRows(prev => {
      const copy = prev.slice()
      copy[idx] = { ...copy[idx], ...patch }
      return copy
    })
  }

  async function handleImgFile(file, idx){
    if (!file) return
    const data = await readFileAsDataURL(file)
    const img = new Image()
    img.src = data
    await new Promise(r=> img.onload = r)
    const resized = resizeTo16x9(img, 1280, 720)
    updateRow(idx, { image: resized })
  }

  function readFileAsDataURL(f){
    return new Promise((resolve, reject)=>{
      const rd = new FileReader()
      rd.onload = e=>resolve(e.target.result)
      rd.onerror = reject
      rd.readAsDataURL(f)
    })
  }

  function deleteRow(idx){
    if (!confirm('确认删除该房型？')) return
    setRows(prev => {
      const copy = prev.slice()
      copy.splice(idx,1)
      persistDraft(copy)
      return copy
    })
  }

  // 保存单行到后端（支持新增与更新），若为新酒店则只保存本地草稿
  async function saveRowToServer(idx){
    const row = rows[idx]
    try{
      persistDraft(rows)
      if (!hotelId || hotelId === 0){
        alert('当前为新酒店草稿，房型已保存为本地草稿。请先保存或创建酒店，然后再同步到数据库。')
        return
      }
      const payload = normalizeRow(row)
      let res
      if (payload.id){
        res = await fetch(`/api/hotels/${hotelId}/rooms/${payload.id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) })
      } else {
        res = await fetch(`/api/hotels/${hotelId}/rooms`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) })
      }
      const json = await res.json().catch(()=>null)
      if (!res.ok) throw new Error((json && json.msg) || '保存失败')
      const saved = (json && json.data) ? json.data : json
      if (saved) {
        setRows(prev => {
          const copy = prev.slice()
          copy[idx] = normalizeRow(saved)
          try{ persistDraft(copy) }catch(e){}
          return copy
        })
        alert('该房型已保存到数据库')
      } else {
        alert('保存失败')
      }
    }catch(err){ console.error(err); alert(err && err.message? err.message : '保存失败') }
  }

  return (
    <div className="card">
      <h2>编辑房型明细 <span className="small">{hotelId?('(hotel id=' + hotelId + ')'): '(新酒店草稿)'}</span></h2>
      <div className="toolbar">
        <button className="btn primary" onClick={addRow}>新增房型</button>
        <button className="btn" onClick={saveAndBack}>保存并返回</button>
        <button className="btn warn" onClick={clearAll}>清空所有</button>
        <div style={{flex:1}} />
        <a className="back-link" onClick={(e)=>{ e.preventDefault(); navigate(`/hotels/${hotelId}?tab=priceOverview`) }}>返回房型概览</a>
      </div>

      <div className="list" ref={listRef}>
        {rows.map((r, idx)=> (
          <div className={`row ${highlightIndex===idx? 'highlight' : ''}`} key={idx}>
            <div className="thumb">{ r.image ? <img src={r.image} alt="thumb"/> : <span className="thumb-text">无图</span> }</div>
            <div className="meta">
              <input className="type" placeholder="房型名称" value={r.type||''} onChange={e=>updateRow(idx,{type:e.target.value})} />
              <input className="original" placeholder="原价" type="number" value={r.original||0} onChange={e=>updateRow(idx,{original: toFiniteNumber(e.target.value)})} />
              <input className="current" placeholder="当日价" type="number" value={r.current||0} onChange={e=>updateRow(idx,{current: toFiniteNumber(e.target.value)})} />
              <input className="discount" placeholder="折扣，如：8折" value={r.discount||''} onChange={e=>updateRow(idx,{discount:e.target.value})} />
              <input className="remain" placeholder="剩余房量" type="number" value={r.remain||0} onChange={e=>updateRow(idx,{remain: toFiniteNumber(e.target.value)})} />
              <select className="status" value={r.status||'available'} onChange={e=>updateRow(idx,{status:e.target.value})}>
                <option value="available">可预订</option>
                <option value="low">房量紧张</option>
                <option value="soldout">已售罄</option>
              </select>
              <input className="remark" placeholder="备注" style={{gridColumn:'1 / -1'}} value={r.remark||''} onChange={e=>updateRow(idx,{remark:e.target.value})} />
            </div>
            <div className="ops">
              <input type="file" accept="image/*" className="imgInput" onChange={e=>{ const f = e.target.files && e.target.files[0]; if(f) handleImgFile(f, idx); e.target.value = '' }} />
              <div className="actions">
                <button type="button" className="btn saveRow" onClick={(e)=>{ e.stopPropagation(); saveRowToServer(idx); }}>保存行</button>
                <button type="button" className="btn" onClick={(e)=>{ e.stopPropagation(); deleteRow(idx); }}>删除</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function resizeTo16x9(img, targetW, targetH){
  const canvas = document.createElement('canvas')
  canvas.width = targetW; canvas.height = targetH
  const ctx = canvas.getContext('2d')
  const srcW = img.naturalWidth || img.width, srcH = img.naturalHeight || img.height
  const targetRatio = targetW/targetH, srcRatio = srcW/srcH
  let sx=0, sy=0, sW=srcW, sH=srcH
  if (srcRatio > targetRatio){ sH = srcH; sW = Math.floor(srcH * targetRatio); sx = Math.floor((srcW - sW)/2); sy = 0 } else { sW = srcW; sH = Math.floor(srcW / targetRatio); sx = 0; sy = Math.floor((srcH - sH)/2) }
  ctx.drawImage(img, sx, sy, sW, sH, 0, 0, targetW, targetH)
  return canvas.toDataURL('image/jpeg', 0.9)
}
