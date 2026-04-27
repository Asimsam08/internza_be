import { PrismaClient, Role } from '@prisma/client'
import * as bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting seed...')

  // Check if super admin already exists
  const existingAdmin = await prisma.user.findUnique({
    where: { email: process.env.SUPER_ADMIN_EMAIL || 'admin@internza.com' },
  })

  if (existingAdmin) {
    console.log('✅ Super admin already exists')
    return
  }

  // Hash password
  const password = await bcrypt.hash(
    process.env.SUPER_ADMIN_PASSWORD || 'ChangeThisPassword123!',
    10,
  )

  // Create super admin
  const superAdmin = await prisma.user.create({
    data: {
      email: process.env.SUPER_ADMIN_EMAIL || 'admin@internza.com',
      password,
      role: Role.SUPER_ADMIN,
      isActive: true,
    },
  })

  console.log('✅ Super admin created:', superAdmin.email)

  // Create some sample project templates
  const projectTemplate1 = await prisma.projectTemplate.create({
    data: {
      title: 'Full-Stack Architecture Internship',
      description:
        'Learn to build scalable web applications from scratch. This comprehensive internship covers database design, API development, frontend implementation, and deployment strategies.',
      shortDescription:
        'Build production-ready web applications with modern architecture patterns.',
      category: 'Web Development',
      difficulty: 'Intermediate',
      duration: 8,
      skills: ['TypeScript', 'React', 'Node.js', 'PostgreSQL', 'Docker'],
      imageUrl: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c',
      status: 'PUBLISHED',
      version: 1,
    },
  })

  const projectTemplate2 = await prisma.projectTemplate.create({
    data: {
      title: 'Data Science Fellowship',
      description:
        'Master data analysis, machine learning, and statistical modeling. Work with real-world datasets and build predictive models that drive business decisions.',
      shortDescription:
        'Transform raw data into actionable insights with advanced analytics.',
      category: 'Data Science',
      difficulty: 'Advanced',
      duration: 12,
      skills: ['Python', 'Pandas', 'Scikit-learn', 'SQL', 'TensorFlow'],
      imageUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71',
      status: 'PUBLISHED',
      version: 1,
    },
  })

  const projectTemplate3 = await prisma.projectTemplate.create({
    data: {
      title: 'UX Research Mastery',
      description:
        'Learn user research methodologies, usability testing, and design thinking. Create meaningful user experiences backed by data-driven insights.',
      shortDescription:
        'Design user-centered products with research-driven methodologies.',
      category: 'UX/UI Design',
      difficulty: 'Beginner',
      duration: 4,
      skills: ['User Research', 'Figma', 'Usability Testing', 'Prototyping'],
      imageUrl: 'https://images.unsplash.com/photo-1586717791821-3f44a5638d48',
      status: 'PUBLISHED',
      version: 1,
    },
  })

  console.log('✅ Created sample project templates')

  console.log('🎉 Seed completed successfully!')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
