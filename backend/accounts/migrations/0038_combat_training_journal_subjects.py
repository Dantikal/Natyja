from django.db import migrations, models


SUBJECT_TITLES = (
    "Автобронетанктык даярдык",
    "Аскердик топография",
    "Аскердик-медициналык даярдык",
    "Тоо даярдыгы",
    "Инженердик даярдык",
    "Усулдук даярдык",
    "Жалпы аскердик уставдар",
    "Коомдук-мамлекеттик даярдык",
    "Ок атуу даярдыгы",
    "Аскердик мыйзамдардын жана укуктун негиздери",
    "Мамлекеттик сырды коргоонун жана жашыруундук режиминин негиздери",
    "Эл аралык гуманитардык укуктун негиздери",
    "Аскерлерди (бөлүкчөлөрдү) башкаруу жана штаб кызматтары боюнча даярдык",
    "Байланыш боюнча даярдык",
    "Радиациялык, химиялык жана биологиялык (РХБ) коргонуу боюнча даярдык",
    "Укуктук даярдык",
    "Кесиптик даярдык",
    "Өрткө каршы даярдык",
    "Психологиялык даярдык",
    "Чалгындоо даярдыгы",
    "Ракеталык-артиллериялык даярдык",
    "Атайын даярдык",
    "Саптык даярдык",
    "Чек ара аскерлеринин тактикасы",
    "Чек ара көзөмөл органдарынын тактикасы",
    "Тактикалык даярдык",
    "Тактикалык-атайын даярдык",
    "Техникалык даярдык",
    "Чек ара көзөмөлүнүн техникалык каражаттары",
    "Дене тарбия даярдыгы",
)


def seed_subjects(apps, schema_editor):
    subject_model = apps.get_model("accounts", "CombatTrainingJournalSubject")
    for order, title in enumerate(SUBJECT_TITLES, start=1):
        subject_model.objects.update_or_create(
            title=title,
            defaults={"order": order, "is_active": True},
        )


class Migration(migrations.Migration):
    dependencies = [("accounts", "0037_allow_user_deletion_with_submissions")]

    operations = [
        migrations.CreateModel(
            name="CombatTrainingJournalSubject",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(max_length=255, unique=True, verbose_name="Название предмета")),
                ("order", models.PositiveIntegerField(default=0, verbose_name="Порядок")),
                ("is_active", models.BooleanField(default=True, verbose_name="Активен")),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="Создано")),
                ("updated_at", models.DateTimeField(auto_now=True, verbose_name="Обновлено")),
            ],
            options={
                "verbose_name": "Предмет журнала боевой подготовки",
                "verbose_name_plural": "Предметы журнала боевой подготовки",
                "ordering": ("order", "id"),
            },
        ),
        migrations.RunPython(seed_subjects, migrations.RunPython.noop),
    ]
