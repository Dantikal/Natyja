from django.utils import timezone

from submissions.models import SubmissionEditRequest


def thematic_submission_payload(submission, viewing_user=None):
    try:
        edit_request = submission.edit_request
    except SubmissionEditRequest.DoesNotExist:
        edit_request = None
    submitted_at = timezone.localtime(submission.created_at)
    registration_code = (
        f'"{submitted_at.day:02d}"{submitted_at.month:02d}"{submitted_at.year}-ж '
        f'{submitted_at.month:02d}/{submission.id}'
    )
    payload = {
        "id": submission.id,
        "registrationNumber": submission.id,
        "registrationCode": registration_code,
        "senderId": submission.sender_id,
        "senderRole": submission.sender.role,
        "senderUnitType": submission.sender.unit_type,
        "trainingCenterId": submission.sender.training_center_id,
        "documentTitle": submission.document_title,
        "unitNumber": submission.unit_number,
        "outpostName": submission.outpost_name,
        "senderName": submission.sender.full_name,
        "sectionId": submission.section_slug,
        "periodId": submission.period_slug,
        "table": submission.table_data,
        "createdAt": submission.created_at.isoformat(),
        "updatedAt": submission.updated_at.isoformat(),
        "isCorrected": submission.is_corrected,
        "isRead": bool(
            viewing_user
            and any(read.user_id == viewing_user.id for read in submission.reads.all())
        ),
        "editRequestStatus": edit_request.status if edit_request else None,
        "canEdit": bool(edit_request and edit_request.status == SubmissionEditRequest.Status.APPROVED),
    }
    if submission.section_slug in {
        "combat-training-personnel-journal",
        "combat-training-command-journal",
        "meetings-combat-training-journal",
        "young-soldier-combat-training-journal",
    }:
        payload["revisions"] = [
            {
                "id": revision.id,
                "documentTitle": revision.document_title,
                "table": revision.table_data,
                "createdAt": revision.created_at.isoformat(),
                "isRead": bool(
                    viewing_user
                    and any(read.user_id == viewing_user.id for read in revision.reads.all())
                ),
            }
            for revision in submission.revisions.all()
            if not (
                viewing_user
                and any(
                    hidden.user_id == viewing_user.id
                    for hidden in revision.hidden_by.all()
                )
            )
        ]
    return payload


def submission_edit_request_payload(item):
    return {
        "id": item.id,
        "status": item.status,
        "createdAt": item.created_at.isoformat(),
        "updatedAt": item.updated_at.isoformat(),
        "requesterId": item.requester_id,
        "requesterName": item.requester.full_name or item.requester.email,
        "requesterRole": item.requester.role,
        "requesterEmail": item.requester.email,
        "requesterUnitNumber": item.requester.region,
        "requesterOutpostName": item.requester.outpost_name,
        "submission": thematic_submission_payload(item.submission),
    }


def thematic_submission_metadata(submission, viewing_user=None):
    return {
        "id": submission.id,
        "registrationNumber": submission.id,
        "documentTitle": submission.document_title,
        "senderId": submission.sender_id,
        "senderRole": submission.sender.role,
        "senderUnitType": submission.sender.unit_type,
        "senderName": submission.sender.full_name,
        "outpostName": submission.outpost_name,
        "unitNumber": submission.unit_number,
        "sectionId": submission.section_slug,
        "periodId": submission.period_slug,
        "createdAt": submission.created_at.isoformat(),
        "updatedAt": submission.updated_at.isoformat(),
        "isRead": bool(viewing_user and any(read.user_id == viewing_user.id for read in submission.reads.all())),
    }
