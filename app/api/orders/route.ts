import { NextResponse } from 'next/server'
import prisma from '../../../lib/prismadb'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')
  if (!userId) return NextResponse.json({ data: [] })
  const orders = await prisma.order.findMany({ where: { userId }, include: { hotel: true, roomType: true } })
  return NextResponse.json({ data: orders })
}

export async function POST(req: Request) {
  const body = await req.json()
  const { userId, hotelId, roomTypeId, checkIn, checkOut, totalPrice } = body
  const order = await prisma.order.create({ data: { userId, hotelId, roomTypeId, checkIn: new Date(checkIn), checkOut: new Date(checkOut), totalPrice } })
  return NextResponse.json({ data: order })
}
