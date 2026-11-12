from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0054_modulebanner"),
    ]

    operations = [
        migrations.CreateModel(
            name="ModuleBannerMedia",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("file", models.FileField(upload_to="module_banners/%Y/%m/", verbose_name="Фото или видео")),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="Загружено")),
                ("banner", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="additional_media", to="accounts.modulebanner", verbose_name="Баннер")),
            ],
            options={
                "verbose_name": "Дополнительный файл баннера",
                "verbose_name_plural": "Дополнительные файлы баннеров",
                "ordering": ("id",),
            },
        ),
    ]
