"use client"
import React, { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('alice@example.com')
  const [name, setName] = useState('Alice Tester')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const res = await signIn('credentials', { email, name, redirect: false })
    setLoading(false)
    if (res && !(res as any).error) {
      router.push('/profile')
    } else {
      alert((res as any)?.error || '登录失败')
    }
  }

  return (
    <div className="max-w-md mx-auto mt-24 p-6 border rounded">
      <h1 className="text-2xl mb-4">登录 (Credentials)</h1>
      <form onSubmit={handleSubmit}>
        <label className="block mb-2">
          <span className="text-sm">Email</span>
          <input value={email} onChange={(e) => setEmail(e.target.value)} className="w-full border px-2 py-1 mt-1" />
        </label>
        <label className="block mb-4">
          <span className="text-sm">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full border px-2 py-1 mt-1" />
        </label>
        <button className="bg-blue-600 text-white px-4 py-2 rounded" disabled={loading}>
          {loading ? '登录中...' : '登录'}
        </button>
      </form>
    </div>
  )
}
