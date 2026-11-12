from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0052_add_company_platoon_and_institution_unit_types"),
    ]

    operations = [
        migrations.CreateModel(
            name="ModuleTemplate",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("module_key", models.CharField(db_index=True, max_length=64, verbose_name="Раздел")),
                ("title", models.CharField(max_length=255, verbose_name="Название")),
                ("file", models.FileField(upload_to="module_templates/%Y/%m/", verbose_name="PDF-файл")),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="Загружено")),
                ("uploaded_by", models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="module_templates", to=settings.AUTH_USER_MODEL, verbose_name="Загрузил")),
            ],
            options={
                "verbose_name": "Үлгү раздела",
                "verbose_name_plural": "Үлгү разделов",
                "ordering": ("-created_at", "-id"),
            },
        ),
    ]
