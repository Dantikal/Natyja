from django.db import migrations, models

class Migration(migrations.Migration):
    dependencies = [("accounts", "0070_subdivision_unit_type")]
    operations = [migrations.AddConstraint(
        model_name="submissionarchivecopy",
        constraint=models.UniqueConstraint(fields=("sender_id_snapshot", "year", "period_slug"),
            condition=models.Q(source_submission_id=0), name="unique_annual_draft_archive"),
    )]
