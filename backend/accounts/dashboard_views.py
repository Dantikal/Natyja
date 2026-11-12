"""Compatibility imports for the former dashboard module. Use domain apps in new code."""

from content.constants import (
    MODULE_BANNER_ALLOWED_EXTENSIONS,
    MODULE_BANNER_IMAGE_EXTENSIONS,
    MODULE_BANNER_KEYS,
    MODULE_BANNER_MAX_COUNT,
    MODULE_BANNER_MAX_MEDIA_COUNT,
    MODULE_BANNER_MAX_SIZE,
    MODULE_BANNER_VIDEO_EXTENSIONS,
    MODULE_TEMPLATE_ALLOWED_EXTENSIONS,
    MODULE_TEMPLATE_IMAGE_EXTENSIONS,
    MODULE_TEMPLATE_KEYS,
    MODULE_TEMPLATE_MAX_SIZE,
    MODULE_TEMPLATE_PRIMARY_ONLY_KEYS,
)
from content.serializers import module_banner_payload, module_template_payload
from content.views import (
    ModuleBannerDetailView,
    ModuleBannerListCreateView,
    ModuleTemplateDetailView,
    ModuleTemplateListCreateView,
)
from dashboard.constants import ADMIN_MILITARY_UNIT_NUMBERS, ROLE_LABELS, STATUS_LABELS
from dashboard.ratings import OutpostRatingView, RegionalUnitRatingView
from dashboard.services import build_home_payload, build_modules_payload, latest_users
from dashboard.views import AdminDashboardView, OutpostDashboardView, RegionalDashboardView
from journals.views import (
    CombatTrainingJournalDetailView,
    CombatTrainingJournalListCreateView,
    CombatTrainingJournalOutpostListView,
    CombatTrainingJournalSubjectDetailView,
    CombatTrainingJournalSubjectListCreateView,
)
from messaging.services import chat_unread_count_for_user
from methodical.constants import NORMATIVE_LEGAL_ACTS_TITLE
from methodical.services import (
    methodical_manual_subject_queryset,
    methodical_manual_subjects_payload,
)
from methodical.views import (
    MethodicalManualDocumentDetailView,
    MethodicalManualDocumentListCreateView,
    MethodicalManualSubjectDetailView,
    MethodicalManualSubjectListCreateView,
)
from news.constants import NEWS_ALLOWED_EXTENSIONS, NEWS_MAX_FILES, NEWS_MAX_FILE_SIZE
from news.services import (
    create_news_attachments,
    get_news_attachment_kind,
    validate_news_files,
    visible_combat_training_news,
)
from news.views import (
    CombatTrainingNewsDetailView,
    CombatTrainingNewsLikeView,
    CombatTrainingNewsListCreateView,
    CombatTrainingNewsReadAllView,
    CombatTrainingNewsUnreadCountView,
)
from plans.serializers import combat_training_plan_payload
from plans.views import (
    CombatTrainingPlanDetailView,
    CombatTrainingPlanListCreateView,
    CombatTrainingPlanReadAllView,
    CombatTrainingPlanUnreadCountView,
)
from submissions.serializers import submission_edit_request_payload, thematic_submission_payload
from submissions.views import (
    CombatTrainingJournalRevisionDetailView,
    SubmissionEditRequestCreateView,
    SubmissionEditRequestDecisionView,
    SubmissionEditRequestListView,
    ThematicAccountSubmissionDetailView,
    ThematicAccountSubmissionForwardView,
    ThematicAccountSubmissionHideView,
    ThematicAccountSubmissionListCreateView,
)
from training.constants import (
    COMMAND_THEMATIC_ACCOUNT_SECTION_SLUG,
    LESSON_SCHEDULE_SECTION_SLUGS,
    LIBRARY_EXCLUDED_SECTION_SLUGS,
    PERSONNEL_TRAINING_SUBMISSION_SECTION_SLUGS,
    REMOVED_THEMATIC_PERIOD_SLUGS,
    REMOVED_THEMATIC_PERIOD_TITLE_PARTS,
    THEMATIC_ACCOUNT_SECTION_SLUGS,
    THEMATIC_ACCOUNT_SECTION_TITLE,
    THEMATIC_ACCOUNT_UNIT_TEXT,
    THEMATIC_ACCOUNT_YEAR_PLACEHOLDER,
    THEMATIC_ACCOUNT_YEAR_TEXT,
)
from training.serializers import library_period_payload
from training.services import (
    add_regional_command_training_groups,
    add_regional_typical_week_groups,
    build_command_thematic_account_table_title,
    build_lesson_schedule_period_title,
    build_library_sections_from_db,
    build_thematic_account_table_title,
    build_training_table_module_from_db,
    get_period_number,
    is_removed_thematic_period,
    normalize_thematic_account_title,
)
from training.views import (
    LessonSchedulePeriodDetailView,
    LessonSchedulePeriodListCreateView,
    LibraryPeriodDetailView,
    LibraryPeriodListCreateView,
)
