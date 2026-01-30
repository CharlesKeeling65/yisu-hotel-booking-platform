import prisma from '../lib/prismadb'
import { randomUUID } from 'crypto'

async function main() {
  // clean existing test data (safe for local dev)
  await prisma.order.deleteMany()
  await prisma.session.deleteMany()
  await prisma.account.deleteMany()
  await prisma.roomType.deleteMany()
  await prisma.hotel.deleteMany()
  await prisma.user.deleteMany()

  const user = await prisma.user.create({
    data: { email: 'alice@example.com', name: 'Alice Tester' }
  })

  const hotel = await prisma.hotel.create({
    data: {
      name_cn: '海景酒店',
      name_en: 'Ocean View Hotel',
      address: 'No.1 Beach Road, Sanya',
      star_rating: 4,
      images: JSON.stringify(['/images/hotel1.jpg', '/images/hotel1-2.jpg']),
      facilities: JSON.stringify(['Free WiFi', 'Breakfast included', 'Swimming Pool']),
      status: 'published'
    }
  })

  const roomType = await prisma.roomType.create({
    data: {
      hotelId: hotel.id,
      name: 'Deluxe Sea View',
      price: 120.0,
      amenities: JSON.stringify(['WiFi', 'Breakfast included', 'Air conditioning']),
      availableCount: 5,
      occupancy: 2
    }
  })

  const account = await prisma.account.create({
    data: {
      userId: user.id,
      type: 'credentials',
      provider: 'credentials',
      providerAccountId: `credentials-${user.id}`
    }
  })

  const session = await prisma.session.create({
    data: {
      sessionToken: randomUUID(),
      userId: user.id,
      expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30) // 30 days
    }
  })

  const order = await prisma.order.create({
    data: {
      userId: user.id,
      hotelId: hotel.id,
      roomTypeId: roomType.id,
      totalPrice: 360.0,
      checkIn: new Date(),
      checkOut: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3),
      status: 'CONFIRMED'
    }
  })

  console.log('Seed completed:')
  console.log({
    user: { id: user.id, email: user.email },
    hotel: { id: hotel.id, name_en: hotel.name_en, name_cn: hotel.name_cn },
    roomType: { id: roomType.id, name: roomType.name },
    account: { id: account.id },
    session: { id: session.id },
    order: { id: order.id }
  })
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
