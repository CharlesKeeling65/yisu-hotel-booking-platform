import React, { useEffect, useRef } from 'react'
import '../styles/login.css'

export default function Login(){
  const modalRef = useRef(null)
  useEffect(()=>{
    const loginForm = document.getElementById('loginForm')
    const errorModal = document.getElementById('errorModal')
    const closeModal = document.getElementById('closeModal')
    const DEFAULT_USER = 'user'
    const DEFAULT_ADMIN = 'admin'
    const DEFAULT_PWD = '123456'

    function onSubmit(e){
      e.preventDefault()
      const username = document.getElementById('username').value.trim()
      const password = document.getElementById('password').value.trim()
      if (username === DEFAULT_USER && password === DEFAULT_PWD) {
        sessionStorage.setItem('role', 'user')
        sessionStorage.setItem('username', username)
        window.location.href = '/dashboard'
      } else if (username === DEFAULT_ADMIN && password === DEFAULT_PWD) {
        sessionStorage.setItem('role', 'admin')
        sessionStorage.setItem('username', username)
        window.location.href = '/admin'
      } else {
        if (errorModal) errorModal.style.display = 'flex'
      }
    }

    function onClose(){ if (errorModal) errorModal.style.display = 'none' }

    if (loginForm) loginForm.addEventListener('submit', onSubmit)
    if (closeModal) closeModal.addEventListener('click', onClose)
    function onWindowClick(e){ if (e.target === errorModal) onClose() }
    window.addEventListener('click', onWindowClick)

    return ()=>{
      if (loginForm) loginForm.removeEventListener('submit', onSubmit)
      if (closeModal) closeModal.removeEventListener('click', onClose)
      window.removeEventListener('click', onWindowClick)
    }
  }, [])

  return (
    <div className="login-page">
      <div className="top-bar">
        <div>旅游酒店商家管理后台</div>
        <div className="lang-switch">简体中文</div>
      </div>

      <div className="login-container">
        <div className="login-form">
          <div className="logo">
            <div className="logo-icon">🏨</div>
            <span>易宿</span>
          </div>
          <form id="loginForm">
            <div className="form-group">
              <input 
                type="text" 
                id="username" 
                placeholder="输入用户名" 
                required 
              />
            </div>
            <div className="form-group">
              <input 
                type="password" 
                id="password" 
                placeholder="输入密码" 
                required 
              />
            </div>
            <div className="forgot-pwd">忘记密码?</div>
            <button type="submit" className="login-btn">登录</button>
          </form>
          <div className="divider">或通过以下方式</div>
          <div className="other-login">
            <button className="other-btn">📱 短信验证码</button>
            <button className="other-btn">📧 邮箱验证码</button>
          </div>
          <div className="wechat-login">💬 使用微信扫一扫登录</div>
          <div className="privacy">
            登录或注册表示同意我们的 <a href="#" className="privacy-link">隐私政策</a>
          </div>
        </div>

        <div className="login-banner">
          <p className="banner-welcome">欢迎使用易宿 ebooking</p>
          <h2 className="banner-title">您的酒店管理专家</h2>
          <p className="banner-desc">
            易宿酒店商家管理系统为各类型酒店提供客源拓展、接待经营、口碑维护、数据指导、宣传营销、客户管理等一站式解决方案
          </p>
          <button className="register-btn">立即入驻 &gt;</button>
        </div>
      </div>

      <div className="modal" id="errorModal" ref={modalRef}>
        <div className="modal-content">
          <p>用户名或密码错误，请重新输入！</p>
          <button className="modal-btn" id="closeModal">确定</button>
        </div>
      </div>
    </div>
  )
}