import { NextResponse } from 'next/server'
import prisma from '../../../lib/prismadb'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') || undefined
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '10')
  const where: any = { status: 'published' }
  if (q) {
    where.OR = [
      { name_cn: { contains: q, mode: 'insensitive' } },
      { name_en: { contains: q, mode: 'insensitive' } },
      { address: { contains: q, mode: 'insensitive' } }
    ]
  }

  const hotels = await prisma.hotel.findMany({
    where,
    skip: (page - 1) * limit,
    take: limit,
    include: { rooms: true }
  })

  return NextResponse.json({ data: hotels })
}

export async function POST(req: Request) {
  const body = await req.json()
  const hotel = await prisma.hotel.create({ data: body })
  return NextResponse.json({ data: hotel })
}
