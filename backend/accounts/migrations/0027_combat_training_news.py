from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("accounts", "0026_rename_command_training_section"),
    ]

    operations = [
        migrations.CreateModel(
            name="CombatTrainingNews",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(max_length=255, verbose_name="Заголовок")),
                ("body", models.TextField(blank=True, verbose_name="Текст")),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="Опубликовано")),
                ("updated_at", models.DateTimeField(auto_now=True, verbose_name="Обновлено")),
                ("author", models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="combat_training_news", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ("-created_at", "-id"),
                "verbose_name": "Новость о боевой подготовке",
                "verbose_name_plural": "Новости о боевой подготовке",
            },
        ),
        migrations.CreateModel(
            name="CombatTrainingNewsAttachment",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("file", models.FileField(upload_to="combat_training_news/%Y/%m/", verbose_name="Файл")),
                ("original_name", models.CharField(max_length=255, verbose_name="Имя файла")),
                ("kind", models.CharField(default="file", max_length=20, verbose_name="Тип")),
                ("size", models.PositiveBigIntegerField(default=0, verbose_name="Размер")),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="Загружен")),
                ("news", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="attachments", to="accounts.combattrainingnews")),
            ],
            options={"ordering": ("id",)},
        ),
        migrations.CreateModel(
            name="CombatTrainingNewsLike",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("news", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="likes", to="accounts.combattrainingnews")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="combat_training_news_likes", to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.CreateModel(
            name="CombatTrainingNewsRead",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("read_at", models.DateTimeField(auto_now=True)),
                ("news", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="reads", to="accounts.combattrainingnews")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="combat_training_news_reads", to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.AddConstraint(
            model_name="combattrainingnewslike",
            constraint=models.UniqueConstraint(fields=("news", "user"), name="unique_combat_training_news_like"),
        ),
        migrations.AddConstraint(
            model_name="combattrainingnewsread",
            constraint=models.UniqueConstraint(fields=("news", "user"), name="unique_combat_training_news_read"),
        ),
    ]
