import { Module } from '@nestjs/common';
import { StudentsController } from './students.controller';
import { StudentsService } from './students.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { CohortSharedModule } from '@/common/cohort-shared.module';

@Module({
  imports: [PrismaModule, CohortSharedModule],
  controllers: [StudentsController],
  providers: [StudentsService],
  exports: [StudentsService],
})
export class StudentsModule {}
