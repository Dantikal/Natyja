from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0053_moduletemplate"),
    ]

    operations = [
        migrations.CreateModel(
            name="ModuleBanner",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("module_key", models.CharField(db_index=True, max_length=64, verbose_name="Раздел")),
                ("title", models.CharField(max_length=255, verbose_name="Название")),
                ("description", models.TextField(blank=True, verbose_name="Дополнительная информация")),
                ("file", models.FileField(upload_to="module_banners/%Y/%m/", verbose_name="Фото или видео")),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="Опубликовано")),
                ("uploaded_by", models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="module_banners", to=settings.AUTH_USER_MODEL, verbose_name="Опубликовал")),
            ],
            options={
                "verbose_name": "Баннер раздела",
                "verbose_name_plural": "Баннеры разделов",
                "ordering": ("-created_at", "-id"),
            },
        ),
    ]
