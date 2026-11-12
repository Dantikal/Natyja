from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("accounts", "0021_chat_message_soft_delete"),
    ]

    operations = [
        migrations.CreateModel(
            name="MethodicalManualDocument",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(max_length=255, verbose_name="Название")),
                ("file", models.FileField(upload_to="methodical_manuals/%Y/%m/", verbose_name="Word-файл")),
                ("original_name", models.CharField(max_length=255, verbose_name="Имя файла")),
                ("preview_html", models.TextField(blank=True, verbose_name="Содержимое для просмотра")),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="Создан")),
                ("updated_at", models.DateTimeField(auto_now=True, verbose_name="Обновлен")),
                ("subject", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="documents", to="accounts.methodicalmanualsubject")),
                ("uploaded_by", models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="methodical_manual_documents", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "verbose_name": "Документ учебной программы",
                "verbose_name_plural": "Документы учебных программ",
                "ordering": ("-created_at", "-id"),
            },
        ),
    ]
