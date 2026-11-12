from django.utils import timezone
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from accounts.serializers import UserPublicSerializer
from accounts.permissions import IsActiveUser, IsAdminRole
from dashboard.services import build_home_payload, build_modules_payload, latest_users


class AdminDashboardView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        today = timezone.localdate()
        admin_count = User.objects.filter(role=User.Role.ADMIN).count()
        regional_count = User.objects.filter(role=User.Role.REGIONAL).count()
        outpost_count = User.objects.filter(role=User.Role.OUTPOST).count()
        pending_count = User.objects.filter(status=User.Status.PENDING).count()
        active_today = User.objects.filter(last_login__date=today).count()
        total_outposts = (
            User.objects.filter(unit_type=User.UnitType.OUTPOST)
            .exclude(outpost_name="")
            .values("outpost_name")
            .distinct()
            .count()
        )
        total_regions = User.objects.exclude(region="").values("region").distinct().count()

        return Response(
            {
                "stats": [
                    {"id": "totalUsers", "label": "Всего пользователей", "value": User.objects.count(), "tone": "primary"},
                    {"id": "admins", "label": "Админов", "value": admin_count, "tone": "neutral"},
                    {"id": "regional", "label": "Областных управлений", "value": regional_count, "tone": "neutral"},
                    {"id": "outposts", "label": "Застав", "value": outpost_count, "tone": "neutral"},
                    {
                        "id": "pending",
                        "label": "Ожидают подтверждения",
                        "value": pending_count,
                        "tone": "warning",
                        "clickTarget": "adminRequests",
                    },
                    {"id": "activeToday", "label": "Активны сегодня", "value": active_today, "tone": "success"},
                    {"id": "totalOutposts", "label": "Всего застав", "value": total_outposts, "tone": "neutral"},
                    {"id": "totalRegions", "label": "Всего областей", "value": total_regions, "tone": "neutral"},
                ],
                "charts": {
                    "roleDistribution": [
                        {"name": "Админы", "value": admin_count},
                        {"name": "Областные", "value": regional_count},
                        {"name": "Заставы", "value": outpost_count},
                    ],
                    "monthlyRegistrations": [
                        {"month": "Янв", "registrations": 12},
                        {"month": "Фев", "registrations": 18},
                        {"month": "Мар", "registrations": 22},
                        {"month": "Апр", "registrations": 31},
                        {"month": "Май", "registrations": 38},
                        {"month": "Июн", "registrations": 44},
                    ],
                    "hourlyActivity": [
                        {"hour": "00", "users": 8},
                        {"hour": "04", "users": 12},
                        {"hour": "08", "users": 64},
                        {"hour": "12", "users": 92},
                        {"hour": "16", "users": 78},
                        {"hour": "20", "users": 41},
                    ],
                },
                "latestUsers": latest_users(),
                "quickActions": [
                    {"id": "requests", "label": "Проверить новые запросы", "count": pending_count, "target": "adminRequests"},
                    {"id": "export", "label": "Экспорт отчета", "count": None, "target": "export"},
                ],
                "home": build_home_payload(request.user),
                "modules": build_modules_payload(request.user),
            }
        )


class RegionalDashboardView(APIView):
    permission_classes = [IsActiveUser]

    def get(self, request):
        if request.user.role not in {User.Role.REGIONAL, User.Role.MANAGEMENT}:
            raise PermissionDenied("Доступ разрешен только областному управлению.")

        region = request.user.region or "Чуйская область"

        return Response(
            {
                "region": region,
                "stats": [
                    {"id": "region", "label": "Область", "value": region, "tone": "primary"},
                    {"id": "outposts", "label": "Подчиненных застав", "value": 14, "tone": "neutral"},
                    {"id": "staff", "label": "Сотрудников в области", "value": 326, "tone": "neutral"},
                    {"id": "pending", "label": "Заявок на рассмотрении", "value": 7, "tone": "warning"},
                    {"id": "documents", "label": "Новых документов за неделю", "value": 19, "tone": "success"},
                    {"id": "incidents", "label": "Происшествий за месяц", "value": 4, "tone": "danger"},
                ],
                "charts": {
                    "outpostActivity": [
                        {"name": "Ала-Тоо", "reports": 32},
                        {"name": "Кара-Суу", "reports": 27},
                        {"name": "Ак-Жол", "reports": 21},
                        {"name": "Токмок", "reports": 18},
                        {"name": "Кемин", "reports": 15},
                    ],
                    "incidentTrend": [
                        {"month": "Янв", "incidents": 7},
                        {"month": "Фев", "incidents": 5},
                        {"month": "Мар", "incidents": 6},
                        {"month": "Апр", "incidents": 4},
                        {"month": "Май", "incidents": 3},
                        {"month": "Июн", "incidents": 4},
                    ],
                    "assignmentDistribution": [
                        {"name": "Ала-Тоо", "value": 28},
                        {"name": "Кара-Суу", "value": 22},
                        {"name": "Ак-Жол", "value": 19},
                        {"name": "Токмок", "value": 17},
                        {"name": "Кемин", "value": 14},
                    ],
                },
                "outposts": [
                    {"name": "Ала-Тоо", "chief": "майор Осмонов А.", "phone": "+996700112233", "status": "Активна"},
                    {"name": "Кара-Суу", "chief": "капитан Ибраев Н.", "phone": "+996700445566", "status": "Активна"},
                    {"name": "Ак-Жол", "chief": "майор Касымов Б.", "phone": "+996700778899", "status": "Проверка"},
                    {"name": "Токмок", "chief": "капитан Садыков М.", "phone": "+996700332211", "status": "Активна"},
                ],
                "reports": [
                    {"date": "19.06.2026", "outpost": "Ала-Тоо", "topic": "Суточная сводка", "status": "Проверено"},
                    {"date": "19.06.2026", "outpost": "Кара-Суу", "topic": "Наряд на завтра", "status": "На проверке"},
                    {"date": "18.06.2026", "outpost": "Ак-Жол", "topic": "Инцидент на участке", "status": "Требует уточнения"},
                    {"date": "18.06.2026", "outpost": "Токмок", "topic": "Матобеспечение", "status": "Проверено"},
                    {"date": "17.06.2026", "outpost": "Кемин", "topic": "План патруля", "status": "Проверено"},
                ],
                "quickActions": [
                    {"id": "order", "label": "Создать приказ для застав"},
                    {"id": "summary", "label": "Просмотреть сводку по области"},
                    {"id": "notify", "label": "Отправить уведомление всем заставам"},
                ],
                "observedUser": UserPublicSerializer(request.user, context={"request":request}).data,
                "home": build_home_payload(request.user),
                "modules": build_modules_payload(request.user),
            }
        )


class OutpostDashboardView(APIView):
    permission_classes = [IsActiveUser]

    def get(self, request):
        if request.user.role != User.Role.OUTPOST:
            raise PermissionDenied("Доступ разрешен только заставе.")

        outpost_name = request.user.outpost_name or "Ала-Тоо"
        chief = request.user.full_name or "майор Осмонов А."

        return Response(
            {
                "outpost": outpost_name,
                "stats": [
                    {"id": "outpost", "label": "Застава", "value": f'"{outpost_name}"', "tone": "primary"},
                    {"id": "chief", "label": "Начальник заставы", "value": chief, "tone": "neutral"},
                    {"id": "staff", "label": "Личный состав", "value": 48, "tone": "neutral"},
                    {"id": "duty", "label": "Дежурный сегодня", "value": "ст. сержант Абдиев К.", "tone": "success"},
                    {"id": "assignments", "label": "Нарядов на сегодня", "value": 6, "tone": "warning"},
                    {"id": "safeDays", "label": "Дней без происшествий", "value": 23, "tone": "success"},
                ],
                "widgets": {
                    "todayDuty": {"title": "Сегодняшний наряд", "person": "лейтенант Токтосунов М.", "time": "08:00-20:00", "shift": "Смена А"},
                    "tasks": [
                        "Проверить канал связи с управлением",
                        "Подготовить отчет по маршруту 3",
                        "Обновить журнал вооружения",
                    ],
                    "orders": [
                        {"title": "Приказ о режиме усиления", "from": "Областное управление"},
                        {"title": "График учебных занятий", "from": "Штаб"},
                    ],
                    "incidents": [
                        {"date": "18.06.2026", "event": "Техническая проверка периметра"},
                        {"date": "16.06.2026", "event": "Выезд патрульной группы"},
                        {"date": "14.06.2026", "event": "Плановая проверка связи"},
                    ],
                },
                "charts": {
                    "rankDistribution": [
                        {"name": "Офицеры", "value": 8},
                        {"name": "Прапорщики", "value": 6},
                        {"name": "Сержанты", "value": 14},
                        {"name": "Рядовые", "value": 20},
                    ],
                    "weeklyActivity": [
                        {"day": "Пн", "events": 14},
                        {"day": "Вт", "events": 18},
                        {"day": "Ср", "events": 16},
                        {"day": "Чт", "events": 22},
                        {"day": "Пт", "events": 19},
                        {"day": "Сб", "events": 12},
                        {"day": "Вс", "events": 9},
                    ],
                },
                "duties": [
                    {"day": "Понедельник", "time": "08:00-20:00", "name": "Абдиев К.", "position": "дежурный"},
                    {"day": "Вторник", "time": "20:00-08:00", "name": "Токтосунов М.", "position": "начальник наряда"},
                    {"day": "Среда", "time": "08:00-20:00", "name": "Садыков Э.", "position": "патрульный"},
                    {"day": "Четверг", "time": "20:00-08:00", "name": "Маматов Р.", "position": "дежурный"},
                    {"day": "Пятница", "time": "08:00-20:00", "name": "Осмонов А.", "position": "начальник смены"},
                ],
                "journal": [
                    {"date": "19.06.2026", "event": "Смена заступила без замечаний", "owner": "Абдиев К."},
                    {"date": "18.06.2026", "event": "Проверка транспорта", "owner": "Маматов Р."},
                    {"date": "17.06.2026", "event": "Осмотр участка", "owner": "Садыков Э."},
                    {"date": "16.06.2026", "event": "Получен приказ управления", "owner": "Токтосунов М."},
                    {"date": "15.06.2026", "event": "Учебная тревога", "owner": "Осмонов А."},
                ],
                "quickActions": [
                    {"id": "report", "label": "Создать отчет"},
                    {"id": "journal", "label": "Добавить запись в журнал"},
                    {"id": "library", "label": "Сабактардын тематикасынын эсеби жана жүгүртмөсү"},
                ],
                "home": build_home_payload(request.user),
                "modules": build_modules_payload(request.user),
            }
        )
