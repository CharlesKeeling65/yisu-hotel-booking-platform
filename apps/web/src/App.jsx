import React, { useEffect } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import HotelDetail from './pages/HotelDetail'
import HotelEdit from './pages/HotelEdit'
import HotelRooms from './pages/HotelRooms'

export default function App() {
  const RedirectToLogin = () => {
    const nav = useNavigate();
    useEffect(()=>{
      const t = setTimeout(()=> nav('/login', { replace: true }), 600);
      return ()=> clearTimeout(t);
    }, [nav]);
    return (
      <div style={{padding:20, minHeight:'60vh', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column'}}>
        <div style={{width:40,height:40,borderRadius:20,border:'4px solid rgba(0,0,0,0.08)',borderTopColor:'#409eff',animation:'spin 1s linear infinite'}} />
        <div style={{marginTop:12,fontSize:18,fontWeight:600}}>正在跳转中...</div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  return (
    <div>
      {/* header/navigation removed per design: keep main content only */}
      <main style={{padding:20}}>
        <Routes>
          <Route path="/" element={<RedirectToLogin/>} />
          <Route path="/login" element={<Login/>} />
          <Route path="/register" element={<Register/>} />
          <Route path="/dashboard" element={<Dashboard/>} />
          <Route path="/hotels/:id" element={<HotelDetail/>} />
          <Route path="/hotels/:id/edit" element={<HotelEdit/>} />
          <Route path="/hotels/:id/rooms" element={<HotelRooms/>} />
        </Routes>
      </main>
    </div>
  )
}
