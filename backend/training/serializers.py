from training.models import TrainingTable


def library_period_payload(period):
    payload = {
        "id": period.slug,
        "title": period.title,
        "canEdit": True,
        "canDelete": True,
    }
    try:
        table = period.table
    except TrainingTable.DoesNotExist:
        table = None
    if table and table.is_active:
        payload["table"] = table.to_payload()
    return payload
