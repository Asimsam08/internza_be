import { ConflictException, Injectable } from '@nestjs/common'
import { PrismaService } from '@/prisma/prisma.service'
import { JoinWaitlistDto } from './dto/join-waitlist.dto'

const DUPLICATE_MESSAGE =
  'This email has already been added to our waitlist. We will notify you when early access opens.'

@Injectable()
export class WaitlistService {
  constructor(private readonly prisma: PrismaService) {}

  async join(dto: JoinWaitlistDto) {
    const email = dto.email.trim().toLowerCase()

    const existing = await this.prisma.waitlistEntry.findUnique({
      where: { email },
    })

    if (existing) {
      throw new ConflictException(DUPLICATE_MESSAGE)
    }

    return this.prisma.waitlistEntry.create({
      data: { email },
      select: {
        id: true,
        email: true,
        createdAt: true,
      },
    })
  }

  async listAll() {
    const [entries, total] = await Promise.all([
      this.prisma.waitlistEntry.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          createdAt: true,
        },
      }),
      this.prisma.waitlistEntry.count(),
    ])

    return { entries, total }
  }
}
