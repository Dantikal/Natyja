from accounts.models import User


ADMIN_MILITARY_UNIT_NUMBERS = [
    "2021",
    "2022",
    "2023",
    "2024",
    "2025",
    "2026",
    "2027",
    "2028",
    "2029",
    "2030",
    "2031",
    "2032",
    "2055",
    "2056",
    "2057",
    "2051",
    "2053",
    "2063",
    "2064",
    "2065",
    "КЖжАККДБ",
    "ЧАП",
]


ROLE_LABELS = {
    User.Role.ADMIN: "Админ",
    User.Role.REGIONAL: "Аскер бөлүгү",
    User.Role.OUTPOST: "Застава",
    "": "Не назначена",
}


STATUS_LABELS = {
    User.Status.PENDING: "Ожидает",
    User.Status.ACTIVE: "Активен",
    User.Status.REJECTED: "Отклонен",
}
