from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0036_expand_methodical_manual_materials"),
    ]

    operations = [
        migrations.AlterField(
            model_name="thematicaccountsubmission",
            name="sender",
            field=models.ForeignKey(
                on_delete=models.CASCADE,
                related_name="thematic_account_submissions",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AlterField(
            model_name="submissioneditrequest",
            name="requester",
            field=models.ForeignKey(
                on_delete=models.CASCADE,
                related_name="submission_edit_requests",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
