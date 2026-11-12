


MODULE_TEMPLATE_KEYS = {
    "library",
    "combatTrainingJournal",
    "combatTrainingResults",
    "meetings",
    "youngSoldierTrainingCourse",
    "combatTrainingAnalytics",
    "smr",
    "combatTrainingPlan",
    "combatTrainingReport",
    "contactAdmin",
}


MODULE_TEMPLATE_PRIMARY_ONLY_KEYS = {"combatTrainingJournal", "smr"}


MODULE_TEMPLATE_MAX_SIZE = 50 * 1024 * 1024


MODULE_TEMPLATE_ALLOWED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"}


MODULE_TEMPLATE_IMAGE_EXTENSIONS = MODULE_TEMPLATE_ALLOWED_EXTENSIONS - {".pdf"}


MODULE_BANNER_KEYS = {"home"}


MODULE_BANNER_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"}


MODULE_BANNER_VIDEO_EXTENSIONS = {".mp4", ".webm", ".mov", ".m4v", ".ogv"}


MODULE_BANNER_ALLOWED_EXTENSIONS = MODULE_BANNER_IMAGE_EXTENSIONS | MODULE_BANNER_VIDEO_EXTENSIONS


MODULE_BANNER_MAX_SIZE = 100 * 1024 * 1024


MODULE_BANNER_MAX_COUNT = 3


MODULE_BANNER_MAX_MEDIA_COUNT = 10
