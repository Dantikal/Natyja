from datetime import timedelta

from django.core.validators import RegexValidator
from django.utils import timezone
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.training_units import normalize_training_unit
from accounts.models import User
from accounts.unit_routing import normalize_institution_subunit
from accounts.outposts import OUTPOSTS_BY_MILITARY_UNIT, normalize_outpost_selection
from messaging.models import AdminChatMessage


phone_validator = RegexValidator(
    regex=r"^\+996\d{9}$",
    message="Телефон должен быть в формате +996XXXXXXXXX.",
)


class UserPublicSerializer(serializers.ModelSerializer):
    training_center_name = serializers.CharField(source="training_center.outpost_name", read_only=True, default="")
    avatar = serializers.ImageField(read_only=True)
    photo_face = serializers.ImageField(read_only=True)
    unreadChatCount = serializers.SerializerMethodField()

    def get_unreadChatCount(self, obj):
        if hasattr(obj, "_chat_unread"):
            return obj._chat_unread
        request = self.context.get("request")
        request_user = getattr(request, "user", None) if request else None
        if not request_user or not request_user.is_authenticated:
            return 0
        return AdminChatMessage.objects.filter(
            sender=obj,
            recipient=request_user,
            is_read=False,
        ).count()

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "full_name",
            "military_rank",
            "position",
            "unit_type",
            "phone",
            "region",
            "outpost_name",
            "training_center",
            "training_center_name",
            "platoon_number",
            "role",
            "status",
            "is_superuser",
            "avatar",
            "photo_face",
            "rejection_reason",
            "profile_completed",
            "reviewed_at",
            "unreadChatCount",
            "date_joined",
        ]
        read_only_fields = fields


class AdminUserSerializer(serializers.ModelSerializer):
    training_center_name = serializers.CharField(source="training_center.outpost_name", read_only=True, default="")
    avatar = serializers.ImageField(read_only=True)
    photo_face = serializers.ImageField(required=False)
    lastSeen = serializers.DateTimeField(source="last_login", read_only=True)
    isOnline = serializers.SerializerMethodField()
    password = serializers.CharField(
        write_only=True, required=False, allow_blank=True, min_length=8
    )
    phone = serializers.CharField(
        required=False, allow_blank=True, validators=[phone_validator]
    )
    unit_type = serializers.CharField(required=False, allow_blank=True, max_length=160)

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "password",
            "full_name",
            "military_rank",
            "position",
            "unit_type",
            "phone",
            "region",
            "outpost_name",
            "training_center",
            "training_center_name",
            "platoon_number",
            "role",
            "status",
            "is_superuser",
            "avatar",
            "photo_face",
            "profile_completed",
            "date_joined",
            "lastSeen",
            "isOnline",
        ]
        read_only_fields = ["id", "username", "is_superuser", "profile_completed", "date_joined", "lastSeen", "isOnline"]

    def get_isOnline(self, obj):
        return bool(
            obj.last_login
            and timezone.now() - obj.last_login <= timedelta(minutes=2)
        )

    def validate_email(self, value):
        email = value.lower().strip()
        qs = User.objects.filter(email__iexact=email)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("Пользователь с таким email уже есть.")
        return email

    def validate(self, attrs):
        for field in ("full_name", "military_rank", "position", "unit_type", "region", "outpost_name"):
            if field in attrs and isinstance(attrs[field], str):
                attrs[field] = attrs[field].strip()

        if (
            self.instance
            and self.instance.role == User.Role.ADMIN
            and attrs.get("role", self.instance.role) != User.Role.ADMIN
            and not User.objects.filter(role=User.Role.ADMIN).exclude(pk=self.instance.pk).exists()
        ):
            raise serializers.ValidationError(
                {"role": "Нельзя снять роль администратора у последнего администратора."}
            )

        password = attrs.get("password")
        if self.instance is None and not password:
            raise serializers.ValidationError(
                {"password": "Укажите пароль для нового пользователя."}
            )
        if self.instance is None and not attrs.get("photo_face"):
            raise serializers.ValidationError(
                {"photo_face": "Загрузите фото лица."}
            )
        unit_type = attrs.get("unit_type", getattr(self.instance, "unit_type", ""))
        region = attrs.get("region", getattr(self.instance, "region", ""))
        outpost_name = attrs.get("outpost_name", getattr(self.instance, "outpost_name", ""))
        current_role = attrs.get("role", getattr(self.instance, "role", ""))
        if current_role not in {User.Role.ADMIN, User.Role.MANAGEMENT}:
            attrs["role"] = (
                User.Role.REGIONAL
                if unit_type in (User.UnitType.REGIONAL, User.UnitType.INSTITUTION)
                else User.Role.OUTPOST
            )
        if unit_type == User.UnitType.OUTPOST:
            normalized_outpost_name = normalize_outpost_selection(region, outpost_name)
            if normalized_outpost_name:
                attrs["outpost_name"] = normalized_outpost_name
            elif self.instance is None:
                raise serializers.ValidationError(
                    {"outpost_name": "Тандалган застава бул аскер бөлүгүнө кирбейт."}
                )
        named_subunit_labels = {
            User.UnitType.SUBDIVISION: "Бөлүмчөнүн аталышын",
            User.UnitType.CHECKPOINT: "Көзөмөл өткөрмө пунктунун аталышын",
            User.UnitType.DETACHMENT: "Отрядтын аталышын",
            User.UnitType.GROUP: "Топтун аталышын",
            User.UnitType.COMPANY: "Ротанын аталышын",
            User.UnitType.PLATOON: "Взводдун аталышын",
        }
        if unit_type in named_subunit_labels and not outpost_name:
            raise serializers.ValidationError(
                {"outpost_name": f"{named_subunit_labels[unit_type]} жазыңыз."}
            )
        if unit_type == User.UnitType.INSTITUTION:
            attrs["outpost_name"] = ""
        normalize_training_unit(attrs, unit_type, self.instance)
        normalize_institution_subunit(attrs, unit_type, outpost_name)
        return attrs

    def create(self, validated_data):
        password = validated_data.pop("password")
        email = validated_data["email"]
        user = User(username=email, **validated_data)
        user.set_password(password)
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop("password", "")
        for field, value in validated_data.items():
            setattr(instance, field, value)

        if "email" in validated_data:
            instance.username = validated_data["email"]
        if password:
            instance.set_password(password)

        instance.save()
        return instance


class ProfileUpdateSerializer(serializers.ModelSerializer):
    photo_face = serializers.ImageField(required=False)
    password = serializers.CharField(write_only=True, required=False, allow_blank=True, min_length=8)
    complete_profile = serializers.BooleanField(write_only=True, required=False, default=False)
    phone = serializers.CharField(required=False, allow_blank=True, validators=[phone_validator])
    unit_type = serializers.ChoiceField(choices=User.UnitType.choices, required=False)

    class Meta:
        model = User
        fields = [
            "email",
            "password",
            "full_name",
            "military_rank",
            "position",
            "unit_type",
            "phone",
            "region",
            "outpost_name",
            "training_center",
            "platoon_number",
            "photo_face",
            "complete_profile",
        ]

    def validate_email(self, value):
        email = value.lower().strip()
        if User.objects.filter(email__iexact=email).exclude(pk=self.instance.pk).exists():
            raise serializers.ValidationError("Пользователь с таким email уже есть.")
        return email

    def validate(self, attrs):
        complete_profile = attrs.pop("complete_profile", False)
        for field in ("full_name", "military_rank", "position", "region", "outpost_name"):
            if field in attrs and isinstance(attrs[field], str):
                attrs[field] = attrs[field].strip()

        unit_type = attrs.get("unit_type", self.instance.unit_type)
        region = attrs.get("region", self.instance.region)
        outpost_name = attrs.get("outpost_name", self.instance.outpost_name)

        if self.instance.role not in {User.Role.ADMIN, User.Role.MANAGEMENT}:
            attrs["role"] = (
                User.Role.REGIONAL
                if unit_type in (User.UnitType.REGIONAL, User.UnitType.INSTITUTION)
                else User.Role.OUTPOST
            )

        if unit_type == User.UnitType.SUBDIVISION:
            errors = {}
            if not region:
                errors["region"] = "Аскер бөлүгүнүн номерин тандаңыз."
            if not outpost_name:
                errors["outpost_name"] = "Бөлүмчөнүн аталышын жазыңыз."
            if errors:
                raise serializers.ValidationError(errors)

        # Only validate outpost selection if user is changing outpost-related fields
        if unit_type == User.UnitType.OUTPOST and ("outpost_name" in attrs or "region" in attrs):
            if region and outpost_name:
                normalized = normalize_outpost_selection(region, outpost_name)
                if not normalized:
                    raise serializers.ValidationError(
                        {"outpost_name": "Тандалган застава бул аскер бөлүгүнө кирбейт."}
                    )
                attrs["outpost_name"] = normalized
        elif unit_type == User.UnitType.INSTITUTION and "outpost_name" in attrs:
            attrs["outpost_name"] = ""

        normalize_training_unit(attrs, unit_type, self.instance)
        normalize_institution_subunit(attrs, unit_type, outpost_name)
        region = attrs.get("region", region)

        if complete_profile:
            values = {
                "full_name": attrs.get("full_name", self.instance.full_name),
                "military_rank": attrs.get("military_rank", self.instance.military_rank),
                "position": attrs.get("position", self.instance.position),
                "phone": attrs.get("phone", self.instance.phone),
                "region": region,
            }
            errors = {
                field: "Бул талааны толтуруңуз."
                for field, value in values.items()
                if not str(value or "").strip()
            }
            if not attrs.get("photo_face") and not self.instance.photo_face:
                errors["photo_face"] = "Колдонуучунун сүрөтүн жүктөңүз."
            if errors:
                raise serializers.ValidationError(errors)
            attrs["profile_completed"] = True
        return attrs

    def update(self, instance, validated_data):
        password = validated_data.pop("password", "")
        for field, value in validated_data.items():
            setattr(instance, field, value)
        if "email" in validated_data:
            instance.username = validated_data["email"]
        if password:
            instance.set_password(password)
        instance.save()
        return instance


class QuickUserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ["id", "region", "outpost_name", "email", "password"]
        read_only_fields = ["id"]

    def validate_email(self, value):
        email = value.lower().strip()
        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError("Пользователь с таким email уже есть.")
        return email

    def validate(self, attrs):
        attrs["region"] = attrs.get("region", "").strip()
        attrs["outpost_name"] = attrs.get("outpost_name", "").strip()
        normalized = normalize_outpost_selection(attrs["region"], attrs["outpost_name"])
        if not normalized:
            raise serializers.ValidationError(
                {"outpost_name": "Тандалган застава бул аскер бөлүгүнө кирбейт."}
            )
        attrs["outpost_name"] = normalized
        return attrs

    def create(self, validated_data):
        password = validated_data.pop("password")
        email = validated_data["email"]
        user = User(
            username=email,
            full_name=email,
            unit_type=User.UnitType.OUTPOST,
            role=User.Role.OUTPOST,
            status=User.Status.ACTIVE,
            profile_completed=False,
            **validated_data,
        )
        user.set_password(password)
        user.save()
        return user


class RegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    phone = serializers.CharField(max_length=20)
    full_name = serializers.CharField(required=True)
    military_rank = serializers.CharField(required=True)
    position = serializers.CharField(required=True)
    unit_type = serializers.ChoiceField(choices=User.UnitType.choices, required=True)
    region = serializers.CharField(required=False, allow_blank=True)
    outpost_name = serializers.CharField(required=False, allow_blank=True)
    photo_face = serializers.ImageField(required=True)

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "password",
            "full_name",
            "military_rank",
            "position",
            "unit_type",
            "phone",
            "region",
            "outpost_name",
            "training_center",
            "platoon_number",
            "photo_face",
        ]
        read_only_fields = ["id"]

    def validate_email(self, value):
        email = value.lower().strip()
        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError("Пользователь с таким email уже есть.")
        return email

    def validate(self, attrs):
        unit_type = attrs["unit_type"]
        attrs["region"] = attrs.get("region", "").strip()
        attrs["outpost_name"] = attrs.get("outpost_name", "").strip()

        if unit_type in (
            User.UnitType.REGIONAL,
            User.UnitType.OUTPOST,
            User.UnitType.SUBDIVISION,
            User.UnitType.CHECKPOINT,
            User.UnitType.DETACHMENT,
            User.UnitType.GROUP,
            User.UnitType.COMPANY,
            User.UnitType.PLATOON,
            User.UnitType.INSTITUTION,
        ) and not attrs["region"]:
            raise serializers.ValidationError(
                {"region": "Аскер бөлүгүнүн номерин тандаңыз."}
            )
        if unit_type == User.UnitType.OUTPOST and not attrs["outpost_name"]:
            raise serializers.ValidationError(
                {"outpost_name": "Заставанын аталышын тандаңыз."}
            )
        if unit_type == User.UnitType.OUTPOST:
            available_outposts = OUTPOSTS_BY_MILITARY_UNIT.get(attrs["region"])
            if not available_outposts:
                raise serializers.ValidationError(
                    {"region": "Бул аскер бөлүгү үчүн заставалардын тизмеси табылган жок."}
                )
            normalized_outpost_name = normalize_outpost_selection(
                attrs["region"], attrs["outpost_name"]
            )
            if not normalized_outpost_name:
                raise serializers.ValidationError(
                    {"outpost_name": "Тандалган застава бул аскер бөлүгүнө кирбейт."}
                )
            attrs["outpost_name"] = normalized_outpost_name
        named_subunit_labels = {
            User.UnitType.SUBDIVISION: "Бөлүмчөнүн аталышын",
            User.UnitType.CHECKPOINT: "Көзөмөл өткөрмө пунктунун аталышын",
            User.UnitType.DETACHMENT: "Отрядтын аталышын",
            User.UnitType.GROUP: "Топтун аталышын",
            User.UnitType.COMPANY: "Ротанын аталышын",
            User.UnitType.PLATOON: "Взводдун аталышын",
        }
        if unit_type in named_subunit_labels and not attrs["outpost_name"]:
            raise serializers.ValidationError(
                {"outpost_name": f"{named_subunit_labels[unit_type]} жазыңыз."}
            )
        if unit_type == User.UnitType.INSTITUTION:
            attrs["outpost_name"] = ""
        normalize_training_unit(attrs, unit_type)
        normalize_institution_subunit(attrs, unit_type, attrs["outpost_name"])
        return attrs

    def create(self, validated_data):
        password = validated_data.pop("password")
        email = validated_data["email"]
        role = (
            User.Role.REGIONAL
            if validated_data["unit_type"] in (
                User.UnitType.REGIONAL,
                User.UnitType.INSTITUTION,
            )
            else User.Role.OUTPOST
        )
        user = User(
            username=email,
            role=role,
            status=User.Status.PENDING,
            **validated_data,
        )
        user.set_password(password)
        user.save()
        return user


class ActiveTokenObtainSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        email = attrs["email"].lower().strip()
        password = attrs["password"]

        user = User.objects.filter(email__iexact=email).first()
        if not user or not user.check_password(password):
            raise serializers.ValidationError("Неверный email или пароль.")
        if user.status != User.Status.ACTIVE:
            raise serializers.ValidationError("Доступ разрешен только после одобрения.")

        user.last_login = timezone.now()
        user.save(update_fields=["last_login"])
        refresh = RefreshToken.for_user(user)
        return {
            "refresh": str(refresh),
            "access": str(refresh.access_token),
            "user": UserPublicSerializer(user, context=self.context).data,
        }


class ModerationSerializer(serializers.Serializer):
    decision = serializers.ChoiceField(choices=("approve", "reject"))
    rejection_reason = serializers.CharField(
        required=False, allow_blank=True, max_length=2000
    )

    def validate(self, attrs):
        if attrs["decision"] == "reject" and not attrs.get("rejection_reason"):
            raise serializers.ValidationError(
                {"rejection_reason": "Укажите причину отклонения."}
            )
        return attrs

    def save(self, **kwargs):
        user = self.context["user_to_review"]
        admin = self.context["request"].user
        decision = self.validated_data["decision"]

        user.reviewed_by = admin
        user.reviewed_at = timezone.now()

        if decision == "approve":
            user.status = User.Status.ACTIVE
            user.rejection_reason = ""
            user.save(update_fields=["status", "rejection_reason", "reviewed_by", "reviewed_at", "is_active"])
            refresh = RefreshToken.for_user(user)
            return {
                "status": "approved",
                "user": UserPublicSerializer(user, context=self.context).data,
                "tokens": {
                    "refresh": str(refresh),
                    "access": str(refresh.access_token),
                },
            }

        user.status = User.Status.REJECTED
        user.rejection_reason = self.validated_data["rejection_reason"]
        user.save(update_fields=["status", "rejection_reason", "reviewed_by", "reviewed_at", "is_active"])
        return {
            "status": "rejected",
            "user": UserPublicSerializer(user, context=self.context).data,
        }


# Resolve former imports lazily to avoid circular dependencies between apps.
_LEGACY_IMPORTS = {
    "CombatTrainingJournalSerializer": "journals.serializers",
    "CombatTrainingJournalSubjectSerializer": "journals.serializers",
    "AdminChatMessageSerializer": "messaging.serializers",
    "AdminChatUserSerializer": "messaging.serializers",
    "MethodicalManualDocumentSerializer": "methodical.serializers",
    "MethodicalManualSubjectSerializer": "methodical.serializers",
    "CombatTrainingNewsAttachmentSerializer": "news.serializers",
    "CombatTrainingNewsSerializer": "news.serializers",
}


def __getattr__(name):
    module = _LEGACY_IMPORTS.get(name)
    if module is None:
        raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
    from importlib import import_module

    value = getattr(import_module(module), name)
    globals()[name] = value
    return value
