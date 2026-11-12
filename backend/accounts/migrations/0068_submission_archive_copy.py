from django.db import migrations, models
from django.utils import timezone


def archive_existing_submissions(apps, schema_editor):
    Submission = apps.get_model("accounts", "ThematicAccountSubmission")
    Archive = apps.get_model("accounts", "SubmissionArchiveCopy")
    batch = []
    for submission in Submission.objects.select_related("sender").iterator(chunk_size=500):
        batch.append(Archive(
            source_submission_id=submission.id,
            sender_id_snapshot=submission.sender_id,
            sender_name=submission.sender.email,
            unit_number=submission.unit_number,
            outpost_name=submission.outpost_name,
            document_title=submission.document_title,
            section_slug=submission.section_slug,
            period_slug=submission.period_slug,
            table_data=submission.table_data,
            year=timezone.localtime(submission.created_at).year,
            archived_at=submission.created_at,
        ))
        if len(batch) == 500:
            Archive.objects.bulk_create(batch)
            batch.clear()
    if batch:
        Archive.objects.bulk_create(batch)


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0067_combat_training_news_reactions"),
    ]

    operations = [
        migrations.CreateModel(
            name="SubmissionArchiveCopy",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("source_submission_id", models.PositiveBigIntegerField()),
                ("sender_id_snapshot", models.PositiveBigIntegerField(db_index=True)),
                ("sender_name", models.CharField(blank=True, max_length=255)),
                ("unit_number", models.CharField(blank=True, max_length=120)),
                ("outpost_name", models.CharField(blank=True, max_length=160)),
                ("document_title", models.CharField(max_length=255)),
                ("section_slug", models.CharField(max_length=80)),
                ("period_slug", models.CharField(blank=True, max_length=100)),
                ("table_data", models.JSONField(default=dict)),
                ("year", models.PositiveSmallIntegerField(db_index=True)),
                ("archived_at", models.DateTimeField(default=timezone.now)),
            ],
            options={"ordering": ("-archived_at", "-id")},
        ),
        migrations.RunPython(archive_existing_submissions, migrations.RunPython.noop),
    ]
