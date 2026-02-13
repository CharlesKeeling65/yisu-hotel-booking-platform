import React, { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import '../styles/login.css'

const ROLES = [
  { value: 'merchant', label: '商家账号' },
  { value: 'admin', label: '管理员账号' },
]

function passwordTips(password) {
  const tips = []
  if (password.length < 10) tips.push('至少 10 位')
  if (!/[A-Z]/.test(password)) tips.push('至少 1 个大写字母')
  if (!/[a-z]/.test(password)) tips.push('至少 1 个小写字母')
  if (!/\d/.test(password)) tips.push('至少 1 个数字')
  if (!/[`~!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]/.test(password)) tips.push('至少 1 个特殊符号')
  return tips
}

async function sha256Hex(text) {
  const data = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export default function Register() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    role: 'merchant',
    account: '',
    email: '',
    phone: '',
    name: '',
    realName: '',
    companyName: '',
    password: '',
    confirmPassword: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const tips = useMemo(() => passwordTips(form.password), [form.password])
  const strong = tips.length === 0 && form.password.length > 0

  async function onSubmit(e) {
    e.preventDefault()
    setError('')

    if (!form.account || !form.email || !form.password || !form.confirmPassword || !form.realName) {
      setError('请完整填写必填项')
      return
    }
    if (form.role === 'merchant' && !form.companyName) {
      setError('商家账号需填写企业名称')
      return
    }
    if (form.password !== form.confirmPassword) {
      setError('两次输入密码不一致')
      return
    }
    if (!strong) {
      setError('密码强度不足，请根据提示调整')
      return
    }

    setSubmitting(true)
    try {
      const passwordCipher = await sha256Hex(form.password)
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: form.role,
          account: form.account,
          email: form.email,
          phone: form.phone,
          name: form.name,
          realName: form.realName,
          companyName: form.companyName,
          passwordCipher,
          password: form.password,
        }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.msg || '注册失败')
      navigate('/login')
    } catch (err) {
      setError(err?.message || '注册失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-page register-page">
      <div className="login-container register-container">
        <div className="login-form register-form">
          <div className="logo">
            <div className="logo-icon">🏨</div>
            <span>易宿账号注册</span>
          </div>
          <form onSubmit={onSubmit}>
            <div className="form-group">
              <label className="field-label">注册角色</label>
              <select
                className="form-select"
                value={form.role}
                onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))}
              >
                {ROLES.map((role) => (
                  <option value={role.value} key={role.value}>{role.label}</option>
                ))}
              </select>
            </div>

            <div className="form-group"><input placeholder="账号（登录用）" value={form.account} onChange={(e)=>setForm((p)=>({...p, account: e.target.value}))} /></div>
            <div className="form-group"><input placeholder="邮箱" value={form.email} onChange={(e)=>setForm((p)=>({...p, email: e.target.value}))} /></div>
            <div className="form-group"><input placeholder="手机号（可选）" value={form.phone} onChange={(e)=>setForm((p)=>({...p, phone: e.target.value}))} /></div>
            <div className="form-group"><input placeholder="显示名称（可选）" value={form.name} onChange={(e)=>setForm((p)=>({...p, name: e.target.value}))} /></div>
            <div className="form-group"><input placeholder="联系人姓名" value={form.realName} onChange={(e)=>setForm((p)=>({...p, realName: e.target.value}))} /></div>
            {form.role === 'merchant' ? (
              <div className="form-group"><input placeholder="企业名称" value={form.companyName} onChange={(e)=>setForm((p)=>({...p, companyName: e.target.value}))} /></div>
            ) : null}

            <div className="form-group"><input type="password" placeholder="密码" value={form.password} onChange={(e)=>setForm((p)=>({...p, password: e.target.value}))} /></div>
            <div className="form-group"><input type="password" placeholder="确认密码" value={form.confirmPassword} onChange={(e)=>setForm((p)=>({...p, confirmPassword: e.target.value}))} /></div>

            <div className={`pwd-tips ${strong ? 'ok' : ''}`}>
              {strong ? '密码强度：强' : `密码需满足：${tips.join('、')}`}
            </div>
            {error ? <div className="form-error">{error}</div> : null}

            <button type="submit" className="login-btn" disabled={submitting}>
              {submitting ? '注册中...' : '提交注册'}
            </button>
          </form>
          <div className="privacy">
            已有账号？<Link to="/login" className="privacy-link">前往登录</Link>
          </div>
        </div>

        <div className="login-banner">
          <p className="banner-welcome">易宿统一账号中心</p>
          <h2 className="banner-title">注册后按角色进入对应工作台</h2>
          <p className="banner-desc">登录只需账号+密码，系统会根据 ID/账号自动识别管理员或商家角色。</p>
        </div>
      </div>
    </div>
  )
}
