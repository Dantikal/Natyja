import re

from rest_framework import serializers

from accounts.models import User

TRAINING_UNIT_TYPES = (User.UnitType.TRAINING_CENTER_HEAD, User.UnitType.TRAINING_PLATOON_COMMANDER)


def normalize_training_unit(attrs, unit_type, instance=None):
    if unit_type == User.UnitType.TRAINING_CENTER_HEAD:
        region = attrs.get("region", getattr(instance, "region", "")).strip()
        name = attrs.get("outpost_name", getattr(instance, "outpost_name", "")).strip()
        errors = {}
        if not region:
            errors["region"] = "Аскер бөлүгүн тандаңыз."
        if not name:
            errors["outpost_name"] = "Окуу борбордун аталышын жазыңыз."
        if errors:
            raise serializers.ValidationError(errors)
        attrs.update(region=region, outpost_name=name, training_center=None, platoon_number="")
    elif unit_type == User.UnitType.TRAINING_PLATOON_COMMANDER:
        center = attrs.get("training_center", getattr(instance, "training_center", None))
        number = attrs.get("platoon_number", getattr(instance, "platoon_number", "")).strip().removeprefix("№").strip()
        errors = {}
        if not center or center.unit_type != User.UnitType.TRAINING_CENTER_HEAD or center.status == User.Status.REJECTED:
            errors["training_center"] = "Окуу борборун тандаңыз."
        if not re.fullmatch(r"[0-9]{1,12}", number):
            errors["platoon_number"] = "Окуу взводунун номерин цифралар менен жазыңыз."
        if errors:
            raise serializers.ValidationError(errors)
        attrs.update(training_center=center, platoon_number=number,
                     region=center.region, outpost_name=f"№ {number} окуу взводу")
    else:
        attrs.update(training_center=None, platoon_number="")


def training_chat_allowed(sender, recipient):
    if sender.unit_type == User.UnitType.TRAINING_PLATOON_COMMANDER:
        return recipient.pk == sender.training_center_id and recipient.unit_type == User.UnitType.TRAINING_CENTER_HEAD
    if sender.unit_type == User.UnitType.TRAINING_CENTER_HEAD:
        return recipient.unit_type == User.UnitType.TRAINING_PLATOON_COMMANDER and recipient.training_center_id == sender.pk
    return False
