import { Module } from '@nestjs/common';
import { StudentsController } from './students.controller';
import { StudentsService } from './students.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { CohortSharedModule } from '@/common/cohort-shared.module';
import { CertificatesModule } from '@/modules/certificates/certificates.module';

@Module({
  imports: [PrismaModule, CohortSharedModule, CertificatesModule],
  controllers: [StudentsController],
  providers: [StudentsService],
  exports: [StudentsService],
})
export class StudentsModule {}
