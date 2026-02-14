import React, { useEffect } from 'react'
import '../styles/admin.css'

export default function Admin(){
  useEffect(()=>{
    async function loadSubmissions(){
      try { const r = await fetch('/api/submissions'); if (r.ok) { const j = await r.json(); return Array.isArray(j.data)? j.data:[] } } catch(e){ console.warn('load submissions api failed', e); }
      try { return JSON.parse(localStorage.getItem('merchantHotels') || '[]') } catch(e){ return [] }
    }
    async function loadApprovedHotels(){
      try { const r = await fetch('/api/hotels'); if (r.ok) { const j = await r.json(); return Array.isArray(j.data)? j.data:[] } } catch(e){ console.warn('load hotels api failed', e) }
      try { return JSON.parse(localStorage.getItem('hotels') || '[]') } catch(e){ return [] }
    }
    async function renderAll(){
      const pending = await loadSubmissions(); const approved = await loadApprovedHotels();
      const pendingPane = document.getElementById('pendingPane'); const approvedPane = document.getElementById('approvedPane');
      function renderList(arr, el, isPending=false){ if (!el) return; if (!arr.length) { el.innerHTML = '<div class="empty">暂无数据</div>'; return } el.innerHTML = arr.map(item => `
            <div class="card" data-merchant-id="${item.id}">
                <div class="thumb">${item.image ? `<img src="${item.image}" alt="hotel">` : `<img src="pic/hotel_${item.id || 0}.png" alt="${item.name}">`}</div>
                <div class="name">${item.name}</div>
                <div class="line"><span>${item.star || ''}</span> ${item.address || ''}</div>
                <div class="line">价格区间：${item.priceRange || ''}</div>
                <div class="line">总客房数：${item.totalRooms || ''}</div>
                <div class="line">热门房型：${(item.roomTypes && (Array.isArray(item.roomTypes)? item.roomTypes.join('、') : item.roomTypes)) || ''}</div>
                <div class="line">${item.discounts ? (Array.isArray(item.discounts)? item.discounts.join('，') : item.discounts) : ''}</div>
                ${isPending ? `
                <div class="ops">
                    <button class="btn pass" data-id="${item.id}" data-op="pass">通过审核</button>
                    <button class="btn reject" data-id="${item.id}" data-op="reject">驳回</button>
                </div>` : ''}
            </div>
        `).join('') }
      renderList(pending, pendingPane, true); renderList(approved, approvedPane, false);
    }

    document.body.addEventListener('click', async function(ev){ const t = ev.target; if (t && t.dataset && t.dataset.op) { const id = parseInt(t.dataset.id); if (t.dataset.op === 'pass') { try { const r = await fetch(`/api/submissions/${id}/approve`, { method:'POST' }); if (r.ok) { await renderAll(); return; } } catch(e){ console.warn('approve api failed', e); } try { let list = JSON.parse(localStorage.getItem('merchantHotels') || '[]'); const idx = list.findIndex(x=>x.id===id); if (idx===-1) return; const hotels = JSON.parse(localStorage.getItem('hotels') || '[]'); const newId = list[idx].id || (hotels.length? Math.max(...hotels.map(h=>h.id))+1 : Date.now()); hotels.push({ ...list[idx], id:newId }); localStorage.setItem('hotels', JSON.stringify(hotels)); list.splice(idx,1); localStorage.setItem('merchantHotels', JSON.stringify(list)); await renderAll(); } catch(e){ console.error(e); } }
      if (t.dataset.op === 'reject') { try { const r = await fetch(`/api/submissions/${id}/reject`, { method:'POST' }); if (r.ok) { await renderAll(); return; } } catch(e){ console.warn('reject api failed', e); } try { let list = JSON.parse(localStorage.getItem('merchantHotels') || '[]'); list = list.filter(x=>x.id!==id); localStorage.setItem('merchantHotels', JSON.stringify(list)); await renderAll(); } catch(e){ console.error(e); } } }
    })

    function bindTabs(){ const tabs = document.querySelectorAll('.tab'); tabs.forEach(tb => tb.addEventListener('click', ()=>{ tabs.forEach(t=>t.classList.remove('active')); tb.classList.add('active'); const key = tb.getAttribute('data-tab'); document.getElementById('pendingPane').style.display = key==='pending' ? 'grid' : 'none'; document.getElementById('approvedPane').style.display = key==='approved' ? 'grid' : 'none'; })); }

    renderAll(); bindTabs();

    (function(){ const welcome = document.getElementById('userWelcome'); const logoutBtn = document.getElementById('logoutBtn'); const name = sessionStorage.getItem('username') || ''; const role = sessionStorage.getItem('role') || 'admin'; if (welcome) welcome.textContent = name ? `欢迎，${name}（${role}）` : '欢迎，管理员'; if (logoutBtn) logoutBtn.addEventListener('click', ()=>{ try { sessionStorage.removeItem('username'); sessionStorage.removeItem('role'); } catch(e){} window.location.href = '/login' }); })()
  }, [])

  return (
    <div>
      <div className="top-nav">
        <div className="nav-logo"><div className="logo-icon">🛡️</div><span>易宿管理员审核中心</span></div>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <span id="userWelcome">欢迎</span>
          <button className="logout-btn" id="logoutBtn" onClick={()=>{ sessionStorage.removeItem('username'); sessionStorage.removeItem('role'); window.location.href = '/login' }}>退出登录</button>
        </div>
      </div>
      <div className="container">
        <div className="tabs">
          <div className="tab active" data-tab="pending">未审核</div>
          <div className="tab" data-tab="approved">已审核</div>
        </div>
        <div id="pendingPane" className="list"></div>
        <div id="approvedPane" className="list" style={{display:'none'}}></div>
      </div>
    </div>
  )
}
