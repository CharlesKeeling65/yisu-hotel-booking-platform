"use client"
import React, { useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function ProfilePage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  if (status === 'loading') return <div className="p-6">加载中...</div>

  return (
    <div className="max-w-md mx-auto mt-24 p-6 border rounded">
      <h1 className="text-2xl mb-4">个人中心</h1>
      <p className="mb-2">已登录用户: {session?.user?.email}</p>
      <div className="flex gap-2">
        <button className="bg-red-600 text-white px-4 py-2 rounded" onClick={() => signOut({ callbackUrl: '/' })}>
          登出
        </button>
        <button className="bg-gray-200 px-4 py-2 rounded" onClick={() => router.push('/')}>返回首页</button>
      </div>
    </div>
  )
}
