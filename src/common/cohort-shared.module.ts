import { Module } from '@nestjs/common'
import { CohortEnrollmentService } from '@/common/services/cohort-enrollment.service'
import { CohortReviewerAssignmentService } from '@/common/services/cohort-reviewer-assignment.service'
import { ReviewerScopeService } from '@/common/services/reviewer-scope.service'
import { EmailService } from '@/common/services/email.service'
import { InviteTokenService } from '@/common/services/invite-token.service'

@Module({
  providers: [
    CohortEnrollmentService,
    CohortReviewerAssignmentService,
    ReviewerScopeService,
    EmailService,
    InviteTokenService,
  ],
  exports: [
    CohortEnrollmentService,
    CohortReviewerAssignmentService,
    ReviewerScopeService,
    EmailService,
    InviteTokenService,
  ],
})
export class CohortSharedModule {}
