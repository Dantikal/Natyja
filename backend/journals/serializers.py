from rest_framework import serializers

from journals.models import CombatTrainingJournal, CombatTrainingJournalSubject


class CombatTrainingJournalSerializer(serializers.ModelSerializer):
    createdAt = serializers.DateTimeField(source="created_at", required=False)
    unitName = serializers.CharField(source="unit_name", required=False, allow_blank=True)
    ownerId = serializers.IntegerField(source="owner_id", read_only=True)

    class Meta:
        model = CombatTrainingJournal
        fields = [
            "id",
            "ownerId",
            "storage_id",
            "title",
            "year",
            "unitName",
            "scope",
            "createdAt",
            "updated_at",
        ]
        read_only_fields = ["id", "updated_at"]
        extra_kwargs = {"storage_id": {"validators": []}}

    def validate_title(self, value):
        title = value.strip()
        if not title:
            raise serializers.ValidationError("\u0423\u043a\u0430\u0436\u0438\u0442\u0435 \u043d\u0430\u0437\u0432\u0430\u043d\u0438\u0435 \u0436\u0443\u0440\u043d\u0430\u043b\u0430.")
        return title

    def validate_storage_id(self, value):
        storage_id = value.strip()
        if not storage_id:
            raise serializers.ValidationError("storage_id is required.")
        return storage_id


class CombatTrainingJournalSubjectSerializer(serializers.ModelSerializer):
    unitNumber = serializers.CharField(source="unit_number")

    class Meta:
        model = CombatTrainingJournalSubject
        fields = [
            "id",
            "title",
            "unitNumber",
            "order",
            "is_active",
            "deleted_at",
            "deleted_by_name",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "is_active", "deleted_at", "deleted_by_name", "created_at", "updated_at"]

    def validate_title(self, value):
        title = value.strip()
        if not title:
            raise serializers.ValidationError("Укажите название предмета.")
        return title

    def validate_unitNumber(self, value):
        unit_number = value.strip()
        if not unit_number:
            raise serializers.ValidationError("Укажите номер аскер бөлүгү.")
        return unit_number
