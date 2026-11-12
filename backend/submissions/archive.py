import copy

from django.utils import timezone

from submissions.models import SubmissionArchiveCopy


def archive_submission(submission):
    sent_at = timezone.now()
    return SubmissionArchiveCopy.objects.create(
        source_submission_id=submission.id,
        sender_id_snapshot=submission.sender_id,
        sender_name=submission.sender.full_name or submission.sender.email,
        unit_number=submission.unit_number,
        outpost_name=submission.outpost_name,
        document_title=submission.document_title,
        section_slug=submission.section_slug,
        period_slug=submission.period_slug,
        table_data=copy.deepcopy(submission.table_data),
        year=timezone.localtime(sent_at).year,
        archived_at=sent_at,
    )
