from django.db.models import Q
from rest_framework import serializers

from accounts.models import User

INSTITUTION_UNIT_NUMBER = "КЖжАККДБ"
INSTITUTION_SUBUNIT_TYPES = (User.UnitType.CYNOLOGY, User.UnitType.COURSE_HEAD)


def normalize_institution_subunit(attrs, unit_type, outpost_name):
    if unit_type not in INSTITUTION_SUBUNIT_TYPES:
        return
    attrs["region"] = INSTITUTION_UNIT_NUMBER
    if unit_type == User.UnitType.CYNOLOGY:
        attrs["outpost_name"] = "Кинология кызматы"
    else:
        if not outpost_name.strip():
            raise serializers.ValidationError({"outpost_name": "Курстун аталышы жазыңыз."})
        attrs["outpost_name"] = outpost_name.strip()


def regional_submission_filter(user):
    special = Q(sender__unit_type__in=INSTITUTION_SUBUNIT_TYPES)
    own_region = Q(unit_number=user.region)
    visible = ~Q(sender__unit_type=User.UnitType.TRAINING_PLATOON_COMMANDER)
    if user.unit_type == User.UnitType.INSTITUTION:
        return (own_region | special) & visible
    return own_region & ~special & visible


def is_submission_recipient(user, submission):
    if submission.sender.unit_type == User.UnitType.TRAINING_PLATOON_COMMANDER:
        return (user.unit_type == User.UnitType.TRAINING_CENTER_HEAD
                and submission.sender.training_center_id == user.pk)
    if user.role != User.Role.REGIONAL or submission.sender.role != User.Role.OUTPOST:
        return False
    if submission.sender.unit_type in INSTITUTION_SUBUNIT_TYPES:
        return user.unit_type == User.UnitType.INSTITUTION
    return submission.unit_number == user.region


def regional_user_filter(user):
    special = Q(unit_type__in=INSTITUTION_SUBUNIT_TYPES)
    if user.unit_type == User.UnitType.TRAINING_CENTER_HEAD:
        return Q(training_center=user, unit_type=User.UnitType.TRAINING_PLATOON_COMMANDER)
    if user.unit_type == User.UnitType.INSTITUTION:
        return (Q(region=user.region) | special) & ~Q(unit_type=User.UnitType.TRAINING_PLATOON_COMMANDER)
    return Q(region=user.region) & ~special & ~Q(unit_type=User.UnitType.TRAINING_PLATOON_COMMANDER)
