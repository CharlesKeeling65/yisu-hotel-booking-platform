import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
// 【修改1】：将 Code 改为 Lock
import { Lock, User } from 'lucide-react';
import '../styles/login.css';

import bg1 from '../assets/images/bg1.jpg'; // 确认后缀为 .jpg
import bg2 from '../assets/images/bg2.jpg';
import bg3 from '../assets/images/bg3.jpg';

async function sha256Hex(text) {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export default function Login() {
  const navigate = useNavigate()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    if (!identifier || !password) {
      setError("请输入账号与密码");
      return;
    }

    setLoading(true);
    try {
      const passwordCipher = await sha256Hex(password);
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, passwordCipher }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.msg || "登录失败");

      const user = json?.data?.user;
      if (!user) throw new Error("登录结果异常");
      sessionStorage.setItem("authUser", JSON.stringify(user));
      sessionStorage.setItem("authToken", json?.data?.token || "");
      navigate("/dashboard");
    } catch (err) {
      setError(err?.message || "登录失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="bg-slider">
        <div className="bg-overlay"></div>
        <div className="bg-slide slide-1" style={{ backgroundImage: `url(${bg1})` }}></div>
        <div className="bg-slide slide-2" style={{ backgroundImage: `url(${bg2})` }}></div>
        <div className="bg-slide slide-3" style={{ backgroundImage: `url(${bg3})` }}></div>
      </div>

      <div className="global-top-right">
        <span className="lang-icon">🌐</span> 简体中文
      </div>

      <div className="login-content-wrapper">
        <div className="login-card">
          <div className="card-header">
            <h1 className="brand-logo">
              <span className="brand-primary">易宿酒店平台</span>
              <span className="brand-divider">|</span>
              <span className="brand-secondary">eBooking.</span>
            </h1>
          </div>

          <form onSubmit={onSubmit} className="login-form-inner">
            <div className="form-group">
              <span className="input-icon">
                <User size={20} strokeWidth={1.5} />
              </span>
              <input
                type="text"
                placeholder="输入用户名 / 邮箱 / ID"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              {/* 【修改2】：使用 Lock 组件 */}
              <span className="input-icon">
                <Lock size={20} strokeWidth={1.5} />
              </span>
              <input
                type="password"
                placeholder="输入密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {error ? <div className="form-error">{error}</div> : null}

            <button type="submit" className="login-btn" disabled={loading}>
              {loading ? '登录中...' : '登录'}
            </button>
          </form>

          <div className="form-footer">
            <div className="register-link-wrapper">
              <Link to="/register" className="secondary-link">还没有账号？去注册（需选择角色）</Link>
            </div>
            <p className="privacy-text">
              登录成功后系统将自动识别并进入对应角色工作台。<br />
              登录或注册表示您同意我们的<a href="#">隐私政策</a>。
            </p>
          </div>
        </div>

        <div className="login-banner">
          <p className="banner-welcome">欢迎使用易宿 eBooking</p>
          <h2 className="banner-title">商家录入 · 管理员审核 ·<br />用户查询一体化</h2>

          <p className="banner-subdesc">覆盖酒店录入、审核发布、上/下线、用户查询与详情展示全流程。</p>

          <div className="banner-action">
            <Link to="/register" className="ghost-btn">立即入驻</Link>
          </div>
        </div>
      </div>
    </div>
  );
}