// Simple seed script to create a demo user and room
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const email = process.env.SEED_USER_EMAIL || 'demo@example.com'
  const name = process.env.SEED_USER_NAME || 'Demo User'
  // NOTE: Replace with bcrypt hash once auth step is implemented
  const passwordHash = process.env.SEED_USER_PASSWORD_HASH || 'changeme-hash'

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name, passwordHash }
  })

  const room = await prisma.room.create({
    data: { userId: user.id, name: 'Minu tuba' }
  })

  await prisma.storageUnit.createMany({
    data: [
      { roomId: room.id, type: 'box', x: 100, y: 100, w: 56, h: 56, rotation: 0, emoji: '📦', name: 'Kast' },
      { roomId: room.id, type: 'table', x: 200, y: 180, w: 56, h: 56, rotation: 0, emoji: '🛋️', name: 'Laud' }
    ]
  })

  console.log('Seed complete:', { userId: user.id, roomId: room.id })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
}).finally(async () => {
  await prisma.$disconnect()
})

