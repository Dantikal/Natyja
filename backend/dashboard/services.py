from django.utils import timezone

from accounts.models import User
from dashboard.constants import ADMIN_MILITARY_UNIT_NUMBERS, ROLE_LABELS, STATUS_LABELS
from messaging.models import AdminChatMessage
from messaging.services import chat_unread_count_for_user
from methodical.services import methodical_manual_subjects_payload
from submissions.models import SubmissionEditRequest, ThematicAccountSubmission
from training.services import (
    add_regional_command_training_groups,
    add_regional_typical_week_groups,
    build_command_thematic_account_table_title,
    build_lesson_schedule_period_title,
    build_library_sections_from_db,
    build_thematic_account_table_title,
    build_training_table_module_from_db,
)


def build_modules_payload(user):
    scope = "бүтүндөй система"
    if user.role == User.Role.REGIONAL:
        scope = user.region or "облус"
    if user.role == User.Role.OUTPOST:
        scope = user.outpost_name or "застава"

    unit_numbers = list(ADMIN_MILITARY_UNIT_NUMBERS) if user.role == User.Role.ADMIN else []

    month_options = [
        "январь",
        "февраль",
        "март",
        "апрель",
        "май",
        "июнь",
        "июль",
        "август",
        "сентябрь",
        "октябрь",
        "ноябрь",
        "декабрь",
    ]

    def build_training_table(period_number, is_command=False):
        return {
            "title": (
                build_command_thematic_account_table_title(period_number)
                if is_command
                else build_thematic_account_table_title(period_number)
            ),
            "columns": [
                {"key": "number", "label": "№"},
                {"key": "topic", "label": "Сабактардын аталышы"},
                {"key": "hours", "label": "канча саат"},
                {"key": "december", "label": "Декабрь", "type": "datetime-local"},
                {"key": "january", "label": "Январь", "type": "datetime-local"},
                {"key": "february", "label": "Февраль", "type": "datetime-local"},
                {"key": "march", "label": "Март", "type": "datetime-local"},
                {"key": "june", "label": "Июнь", "type": "datetime-local"},
                {"key": "july", "label": "Июль", "type": "datetime-local"},
                {"key": "august", "label": "Август", "type": "datetime-local"},
                {"key": "september", "label": "Сентябрь", "type": "datetime-local"},
            ],
            "rows": [
                {
                    "number": number,
                    "topic": "",
                    "hours": "",
                    "december": "",
                    "january": "",
                    "february": "",
                    "march": "",
                    "june": "",
                    "july": "",
                    "august": "",
                    "september": "",
                }
                for number in range(1, 11)
            ],
        }

    def build_lesson_schedule_table(title=None):
        title = title or build_lesson_schedule_period_title(1)
        day_groups = [
            {"id": "monday", "label": "Дүйшөмбү", "date": "20__ж. «__»____"},
            {"id": "tuesday", "label": "Шейшемби", "date": "20__ж. «__»____"},
            {"id": "wednesday", "label": "Шаршемби", "date": "20__ж. «__»____"},
            {"id": "thursday", "label": "Бейшемби", "date": "20__ж. «__»____"},
            {"id": "friday", "label": "Жума", "date": "20__ж. «__»____"},
            {"id": "saturday", "label": "Ишемби", "date": "20__ж. «__»____"},
            {"id": "sunday", "label": "Жекшемби", "date": "20__ж. «__»____"},
            {"id": "methodical", "label": "Методикалык нускамалоо", "date": "20__ж. «__»____"},
        ]
        columns = [
            {"key": "start_time", "label": "Башталуу убактысы", "type": "time"},
            {"key": "end_time", "label": "Аяктоо убактысы", "type": "time"},
            {"key": "activity", "label": "Өткөрүлүүчү иш-чара"},
        ]

        for group in day_groups:
            columns.extend(
                [
                    {"key": f"{group['id']}_instructor", "label": "Ким өткөрөт"},
                    {"key": f"{group['id']}_place", "label": "Өткөрүү орду"},
                ]
            )

        return {
            "title": title,
            "variant": "lesson-schedule",
            "headerFields": [
                {"key": "from_year", "label": "Башталган жыл", "defaultValue": "20__", "suffix": "-ж."},
                {"key": "from_day", "label": "Башталган күн", "defaultValue": "__", "prefix": "«", "suffix": "»"},
                {
                    "key": "from_month",
                    "label": "Башталган ай",
                    "type": "select",
                    "placeholder": "ай",
                    "options": month_options,
                },
                {"text": "баштап"},
                {"key": "to_year", "label": "Аяктаган жыл", "defaultValue": "20__", "suffix": "-ж."},
                {"key": "to_day", "label": "Аяктаган күн", "defaultValue": "__", "prefix": "«", "suffix": "»"},
                {
                    "key": "to_month",
                    "label": "Аяктаган ай",
                    "type": "select",
                    "placeholder": "ай",
                    "options": month_options,
                },
                {"text": "чейин"},
                {
                    "key": "outpost",
                    "label": "Чек ара заставасы",
                    "defaultValue": "Степное",
                    "suffix": "чек ара заставасы",
                },
            ],
            "headerRows": [
                [
                    {"key": "start_time", "label": "Башталуу убактысы", "rowSpan": 3},
                    {"key": "end_time", "label": "Аяктоо убактысы", "rowSpan": 3},
                    {"key": "activity", "label": "Өткөрүлүүчү иш-чара", "rowSpan": 3},
                    *[
                        {"key": group["id"], "label": group["label"], "colSpan": 2}
                        for group in day_groups
                    ],
                ],
                [
                    {
                        "key": f"{group['id']}_date",
                        "label": group["date"],
                        "defaultValue": group["date"],
                        "editableKey": f"{group['id']}_date",
                        "colSpan": 2,
                    }
                    for group in day_groups
                ],
                [
                    cell
                    for group in day_groups
                    for cell in [
                        {"key": f"{group['id']}_instructor", "label": "Ким өткөрөт"},
                        {"key": f"{group['id']}_place", "label": "Өткөрүү орду"},
                    ]
                ],
            ],
            "columns": columns,
            "rows": [
                {
                    **{"start_time": "", "end_time": "", "activity": ""},
                    **{
                        column["key"]: ""
                        for column in columns
                        if column["key"] not in {"start_time", "end_time", "activity"}
                    },
                }
                for _ in range(10)
            ],
        }

    def build_combat_training_journal_table():
        return {
            "title": "Күжүрмөн даярдоону каттоо журналы",
            "columns": [
                {"key": "number", "label": "№"},
                {"key": "date", "label": "Дата", "type": "date"},
                {"key": "topic", "label": "Сабактын темасы"},
                {"key": "place", "label": "Өткөрүү орду"},
                {"key": "participants", "label": "Катышкандар"},
                {"key": "instructor", "label": "Жетекчи"},
                {"key": "note", "label": "Белги"},
            ],
            "rows": [
                {
                    "number": number,
                    "date": "",
                    "topic": "",
                    "place": "",
                    "participants": "",
                    "instructor": "",
                    "note": "",
                }
                for number in range(1, 11)
            ],
        }

    library_sections = build_library_sections_from_db(user)
    if not library_sections:
        library_sections = [
            {
                "id": "personnel-training",
                "title": "Өздүк курамдын даярдыгы",
                "sections": [
                    {
                        "id": "thematic-account",
                        "title": "Сабактардын тематикалык эсеби",
                        "periods": [
                            {
                                "id": "period-1",
                                "title": "20__-окуу жылынын 1 мезгилине",
                                "table": build_training_table(1),
                            },
                        ],
                    },
                    {
                        "id": "lesson-schedule",
                        "title": "Сабактардын жүгүртмөсү",
                        "periods": [
                            {
                                "id": "lesson-schedule-week-1",
                                "title": build_lesson_schedule_period_title(1),
                                "table": build_lesson_schedule_table(),
                            },
                        ],
                    },
                ],
            },
            {
                "id": "command-training",
                "title": "Командирдик даярдоо",
                "sections": [
                    {
                        "id": "command-thematic-account",
                        "title": "Сабактардын тематикалык эсеби",
                        "periods": [
                            {
                                "id": "period-1",
                                "title": "20__-окуу жылынын 1 мезгилине",
                                "table": build_training_table(1, is_command=True),
                            },
                        ],
                    },
                    {
                        "id": "command-lesson-schedule",
                        "title": "Сабактардын жүгүртмөсү",
                        "periods": [
                            {
                                "id": "lesson-schedule-week-1",
                                "title": build_lesson_schedule_period_title(1),
                                "table": build_lesson_schedule_table(),
                            },
                        ],
                    },
                ],
            },
            {
                "id": "typical-week",
                "title": "Типтүү жумасы",
            },
        ]

    for section in library_sections:
        if section.get("id") == "typical-week":
            section["title"] = "Типтүү жумасы"

    if user.role == User.Role.REGIONAL:
        library_sections = add_regional_command_training_groups(library_sections)
        library_sections = add_regional_typical_week_groups(library_sections)

    combat_training_journal = build_training_table_module_from_db(
        "combat-training-journal",
        scope,
    )
    combat_training_journal["unitNumbers"] = unit_numbers

    return {
        "chatUnreadCount": chat_unread_count_for_user(user),
        "library": {
            "title": "Сабактардын тематикасынын эсеби жана жүгүртмөсү",
            "scope": scope,
            "unitNumbers": unit_numbers,
            "sections": library_sections,
            "items": [
                {"name": "Инструкция по несению службы", "type": "Приказ", "updated": "18.06.2026"},
                {"name": "Регламент связи и докладов", "type": "Методичка", "updated": "15.06.2026"},
                {"name": "План реагирования на инциденты", "type": "План", "updated": "10.06.2026"},
            ],
        },
        "combatTrainingJournal": combat_training_journal,
        "combatTrainingResults": {"unitNumbers": unit_numbers},
        "smr": {
            "title": "Күжүрмөн даярдоо боюнча усулдук колдонмолор",
            "subjects": methodical_manual_subjects_payload(),
        },
        "schedule": {
            "title": "Пландоо",
            "items": [
                {"date": "Сегодня", "time": "08:00-20:00", "name": "Смена А", "status": "В наряде"},
                {"date": "Завтра", "time": "20:00-08:00", "name": "Смена Б", "status": "План"},
                {"date": "21.06", "time": "08:00-20:00", "name": "Смена В", "status": "План"},
            ],
        },
        "journal": {
            "title": "Уюштуруу",
            "entries": [
                {"date": "19.06.2026", "event": "Проверка связи", "status": "Закрыто"},
                {"date": "18.06.2026", "event": "Патрулирование участка", "status": "Закрыто"},
                {"date": "17.06.2026", "event": "Технический осмотр", "status": "В работе"},
            ],
        },
        "analytics": {
            "title": "Талдоо",
            "unitNumbers": unit_numbers,
            "reports": [
                {"name": "Сводка за неделю", "status": "Готово", "updated": "19.06.2026"},
                {"name": "Динамика нарушений", "status": "Готово", "updated": "18.06.2026"},
                {"name": "Отчет по обеспечению", "status": "Черновик", "updated": "16.06.2026"},
            ],
        },
    }


def latest_users(limit=5):
    return [
        {
            "id": user.id,
            "fullName": user.full_name,
            "role": ROLE_LABELS.get(user.role, user.role),
            "date": timezone.localtime(user.date_joined).strftime("%d.%m.%Y"),
            "status": STATUS_LABELS.get(user.status, user.status),
        }
        for user in User.objects.order_by("-date_joined")[:limit]
    ]


def build_home_payload(user):
    now = timezone.localtime()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    payload = {
        "month": month_start.date().isoformat(),
        "sentDocuments": ThematicAccountSubmission.objects.filter(
            sender=user,
            created_at__gte=month_start,
        ).exclude(hidden_by__user=user).count(),
    }
    if user.role == User.Role.ADMIN:
        payload["notifications"] = [
            {
                "id": "pendingUsers",
                "label": "Катталууга жаңы өтүнмөлөр",
                "count": User.objects.filter(status=User.Status.PENDING).count(),
                "target": "requests",
            },
            {
                "id": "editRequests",
                "label": "Документти өзгөртүүгө уруксат сурамдары",
                "count": SubmissionEditRequest.objects.filter(
                    status=SubmissionEditRequest.Status.PENDING
                ).count(),
                "target": "submissionEditRequests",
            },
            {
                "id": "unreadMessages",
                "label": "Окулбаган билдирүүлөр",
                "count": AdminChatMessage.objects.filter(
                    recipient=user,
                    is_read=False,
                    deleted_by_recipient=False,
                    deleted_for_everyone=False,
                ).count(),
                "target": "contactAdmin",
            },
        ]
    return payload
