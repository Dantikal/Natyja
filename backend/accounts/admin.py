from django.contrib import admin, messages
from django.contrib.auth.admin import UserAdmin
from django.utils import timezone
from django.utils.html import format_html

from accounts.models import User


admin.site.site_header = "Администрирование платформы «Мунара»"


admin.site.site_title = "Мунара — администрирование"


admin.site.index_title = "Все разделы и данные платформы"


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    actions = (
        "make_administrators",
        "approve_requests",
        "reject_requests",
    )
    list_display = (
        "email",
        "full_name",
        "military_rank",
        "position",
        "role",
        "status",
        "region",
        "outpost_name",
        "is_staff",
        "is_active",
        "date_joined",
    )
    list_editable = ("role", "status")
    list_filter = (
        "role",
        "status",
        "region",
        "unit_type",
        "is_staff",
        "is_superuser",
        "is_active",
        "date_joined",
    )
    search_fields = (
        "email",
        "username",
        "full_name",
        "military_rank",
        "position",
        "phone",
        "region",
        "outpost_name",
    )
    ordering = ("email",)
    readonly_fields = (
        "date_joined",
        "last_login",
        "reviewed_at",
        "reviewed_by",
        "photo_face_preview",
    )

    fieldsets = UserAdmin.fieldsets + (
        (
            "Профиль военнослужащего",
            {
                "fields": (
                    "full_name",
                    "military_rank",
                    "position",
                    "unit_type",
                    "phone",
                    "region",
                    "outpost_name",
                    "role",
                    "status",
                    "photo_face",
                    "photo_face_preview",
                    "rejection_reason",
                    "reviewed_by",
                    "reviewed_at",
                )
            },
        ),
    )

    add_fieldsets = UserAdmin.add_fieldsets + (
        (
            "Профиль военнослужащего",
            {
                "classes": ("wide",),
                "fields": (
                    "email",
                    "full_name",
                    "military_rank",
                    "position",
                    "unit_type",
                    "phone",
                    "region",
                    "outpost_name",
                    "role",
                    "status",
                    "photo_face",
                ),
            },
        ),
    )

    def save_model(self, request, obj, form, change):
        if change and "status" in form.changed_data:
            obj.reviewed_by = request.user
            obj.reviewed_at = timezone.now()
        super().save_model(request, obj, form, change)

    def delete_model(self, request, obj):
        if obj.role == User.Role.ADMIN and not User.objects.filter(
            role=User.Role.ADMIN
        ).exclude(pk=obj.pk).exists():
            self.message_user(
                request,
                "Нельзя удалить последнего администратора.",
                level=messages.ERROR,
            )
            return

        super().delete_model(request, obj)

    def delete_queryset(self, request, queryset):
        protected_admin_ids = set()
        admin_ids = set(User.objects.filter(role=User.Role.ADMIN).values_list("pk", flat=True))
        deleted_admin_ids = set(queryset.filter(role=User.Role.ADMIN).values_list("pk", flat=True))

        if admin_ids and admin_ids.issubset(deleted_admin_ids):
            protected_admin_ids.add(next(iter(admin_ids)))

        if protected_admin_ids:
            queryset = queryset.exclude(pk__in=protected_admin_ids)
            self.message_user(
                request,
                "Последний администратор не удален.",
                level=messages.ERROR,
            )

        super().delete_queryset(request, queryset)

    @admin.action(description="Назначить выбранных пользователей администраторами")
    def make_administrators(self, request, queryset):
        if not request.user.is_superuser:
            self.message_user(
                request,
                "Назначать администраторов может только суперпользователь.",
                level=messages.ERROR,
            )
            return

        updated = 0
        for user in queryset.exclude(role=User.Role.ADMIN):
            user.role = User.Role.ADMIN
            user.status = User.Status.ACTIVE
            user.save()
            updated += 1

        self.message_user(
            request,
            f"Назначено администраторов: {updated}.",
        )

    @admin.action(description="Подтвердить выбранные заявки")
    def approve_requests(self, request, queryset):
        updated = 0
        for user in queryset.exclude(role=User.Role.ADMIN):
            user.status = User.Status.ACTIVE
            user.rejection_reason = ""
            user.reviewed_by = request.user
            user.reviewed_at = timezone.now()
            user.save()
            updated += 1
        self.message_user(request, f"Подтверждено заявок: {updated}.")

    @admin.action(description="Отклонить выбранные заявки")
    def reject_requests(self, request, queryset):
        updated = 0
        for user in queryset.exclude(role=User.Role.ADMIN):
            user.status = User.Status.REJECTED
            if not user.rejection_reason:
                user.rejection_reason = "Отклонено администратором."
            user.reviewed_by = request.user
            user.reviewed_at = timezone.now()
            user.save()
            updated += 1
        self.message_user(request, f"Отклонено заявок: {updated}.")

    @admin.display(description="Фото лица")
    def photo_face_preview(self, obj):
        return self._image_preview(obj.photo_face)

    def _image_preview(self, image):
        if not image:
            return "-"
        return format_html(
            '<a href="{0}" target="_blank"><img src="{0}" style="max-width: 260px; max-height: 180px; border-radius: 6px;" /></a>',
            image.url,
        )
