from submissions.models import ThematicAccountSubmission, SubmissionArchiveCopy
from training.models import TrainingPeriod

def subject_has_documents(subject):
    suffix=f":subject:{subject.pk}"
    return (ThematicAccountSubmission.objects.filter(unit_number=subject.unit_number,period_slug__endswith=suffix).exists()
        or SubmissionArchiveCopy.objects.filter(unit_number=subject.unit_number,period_slug__endswith=suffix).exists()
        or TrainingPeriod.objects.filter(slug__endswith=suffix).exists())
