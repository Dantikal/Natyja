from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0066_training_center_and_platoon"),
    ]

    operations = [
        migrations.AddField(
            model_name="combattrainingnewslike",
            name="reaction_type",
            field=models.CharField(
                choices=[
                    ("like", "Нравится"),
                    ("love", "Люблю"),
                    ("laugh", "Смешно"),
                    ("wow", "Удивительно"),
                    ("clap", "Аплодисменты"),
                ],
                default="like",
                max_length=10,
            ),
        ),
        migrations.RemoveConstraint(
            model_name="combattrainingnewslike",
            name="unique_combat_training_news_like",
        ),
        migrations.AddConstraint(
            model_name="combattrainingnewslike",
            constraint=models.UniqueConstraint(
                fields=("news", "user", "reaction_type"),
                name="unique_combat_news_reaction",
            ),
        ),
    ]
