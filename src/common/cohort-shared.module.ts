import { Module } from '@nestjs/common'
import { CohortEnrollmentService } from '@/common/services/cohort-enrollment.service'
import { CohortReviewerAssignmentService } from '@/common/services/cohort-reviewer-assignment.service'
import { ReviewerScopeService } from '@/common/services/reviewer-scope.service'
import { EmailService } from '@/common/services/email.service'

@Module({
  providers: [
    CohortEnrollmentService,
    CohortReviewerAssignmentService,
    ReviewerScopeService,
    EmailService,
  ],
  exports: [
    CohortEnrollmentService,
    CohortReviewerAssignmentService,
    ReviewerScopeService,
    EmailService,
  ],
})
export class CohortSharedModule {}
