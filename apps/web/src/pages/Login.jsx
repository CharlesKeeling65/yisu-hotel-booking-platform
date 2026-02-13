import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import '../styles/login.css'

async function sha256Hex(text) {
  const data = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export default function Login(){
  const navigate = useNavigate()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function onSubmit(e){
    e.preventDefault()
    setError('')
    if (!identifier || !password) {
      setError('请输入账号与密码')
      return
    }

    setLoading(true)
    try {
      const passwordCipher = await sha256Hex(password)
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, passwordCipher }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.msg || '登录失败')

      const user = json?.data?.user
      if (!user) throw new Error('登录结果异常')
      localStorage.setItem('authUser', JSON.stringify(user))
      localStorage.setItem('authToken', json?.data?.token || '')
      navigate('/dashboard')
    } catch (err) {
      setError(err?.message || '登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="top-bar">
        <div>易宿酒店平台</div>
        <div className="lang-switch">简体中文</div>
      </div>

      <div className="login-container">
        <div className="login-form">
          <div className="logo">
            <div className="logo-icon">🏨</div>
            <span>易宿登录</span>
          </div>
          <form onSubmit={onSubmit}>
            <div className="form-group">
              <input
                type="text"
                placeholder="账号 / 邮箱 / ID"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <input
                type="password"
                placeholder="密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error ? <div className="form-error">{error}</div> : null}
            <button type="submit" className="login-btn" disabled={loading}>{loading ? '登录中...' : '登录'}</button>
          </form>

          <div className="divider">还没有账号？</div>
          <Link to="/register" className="secondary-link">去注册（需选择角色）</Link>
          <div className="privacy">登录成功后系统将自动识别并进入对应角色工作台</div>
        </div>

        <div className="login-banner">
          <p className="banner-welcome">欢迎使用易宿 eBooking</p>
          <h2 className="banner-title">商家录入 · 管理员审核 · 用户查询一体化</h2>
          <p className="banner-desc">覆盖酒店录入、审核发布、上/下线、用户查询与详情展示全流程。</p>
        </div>
      </div>
    </div>
  )
}
