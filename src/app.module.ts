import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ThrottlerModule } from '@nestjs/throttler'
import { PrismaModule } from './prisma/prisma.module'
import { AuthModule } from './modules/auth/auth.module'
import { StudentsModule } from './modules/students/students.module'
import { AdminModule } from './modules/admin/admin.module'
import { CollegesModule } from './modules/colleges/colleges.module'
import { InviteModule } from './modules/invite/invite.module'
import { CollegeAdminModule } from './modules/college-admin/college-admin.module'
import { CertificatesModule } from './modules/certificates/certificates.module'
import { StorageModule } from './common/storage.module'
// import { UsersModule } from './modules/users/users.module'
// import { ReviewersModule } from './modules/reviewers/reviewers.module'
// import { InternshipsModule } from './modules/internships/internships.module'
// import { ProjectTemplatesModule } from './modules/project-templates/project-templates.module'
// import { MilestonesModule } from './modules/milestones/milestones.module'
// import { SubmissionsModule } from './modules/submissions/submissions.module'
// import { ReviewsModule } from './modules/reviews/reviews.module'
// import { NotificationsModule } from './modules/notifications/notifications.module'
// import { AuditLogsModule } from './modules/audit-logs/audit-logs.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ThrottlerModule.forRoot([
      {
        ttl: parseInt(process.env.THROTTLE_TTL || '60') * 1000,
        limit: parseInt(process.env.THROTTLE_LIMIT || '100'),
      },
    ]),
    PrismaModule,
    StorageModule,
    AuthModule,
    StudentsModule,
    AdminModule,
    CollegesModule,
    InviteModule,
    CollegeAdminModule,
    CertificatesModule,
    // UsersModule,
    // ReviewersModule,
    // InternshipsModule,
    // ProjectTemplatesModule,
    // MilestonesModule,
    // SubmissionsModule,
    // ReviewsModule,
    // NotificationsModule,
    // AuditLogsModule,
  ],
})
export class AppModule {}
