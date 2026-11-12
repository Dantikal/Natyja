from django.db.models import Count
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from accounts.training_units import TRAINING_UNIT_TYPES
from accounts.outposts import OUTPOSTS_BY_MILITARY_UNIT, format_outpost_name
from accounts.permissions import IsActiveUser
from dashboard.constants import ADMIN_MILITARY_UNIT_NUMBERS
from submissions.models import ThematicAccountSubmission


class RegionalUnitRatingView(APIView):
    permission_classes = [IsActiveUser]

    def get(self, request):
        training_type = request.user.unit_type if request.user.unit_type in TRAINING_UNIT_TYPES else None
        own_outposts = request.user.role == User.Role.REGIONAL and request.query_params.get("scope") == "own-outposts"
        is_outpost_viewer = request.user.role == User.Role.OUTPOST or own_outposts
        own_unit_number = str(request.user.region or "").strip()
        if request.user.role not in {User.Role.ADMIN, User.Role.REGIONAL, User.Role.OUTPOST}:
            raise PermissionDenied("Аскер бөлүктөрүнүн рейтинги жеткиликтүү эмес.")
        now = timezone.now()
        period = request.query_params.get("period", "year")
        if period not in {"all", "month", "half-year", "year"}:
            period = "all"
        try:
            selected_year = int(request.query_params.get("year", now.year))
        except (TypeError, ValueError):
            selected_year = now.year
        selected_year = min(max(selected_year, 2000), now.year)
        try:
            selected_month = int(request.query_params.get("month", now.month))
        except (TypeError, ValueError):
            selected_month = now.month
        selected_month = min(max(selected_month, 1), 12)
        try:
            selected_half = int(request.query_params.get("half", 1 if now.month <= 6 else 2))
        except (TypeError, ValueError):
            selected_half = 1 if now.month <= 6 else 2
        selected_half = 1 if selected_half == 1 else 2
        period_start = now.replace(
            year=selected_year,
            month=(1 if selected_half == 1 else 7) if period == "half-year" else (1 if period == "year" else selected_month),
            day=1,
            hour=0,
            minute=0,
            second=0,
            microsecond=0,
        )
        if period == "year" or (period == "half-year" and selected_half == 2):
            period_end = period_start.replace(year=selected_year + 1, month=1)
        elif period == "half-year":
            period_end = period_start.replace(month=7)
        elif selected_month == 12:
            period_end = period_start.replace(year=selected_year + 1, month=1)
        else:
            period_end = period_start.replace(month=selected_month + 1)
        deadline_days = {
            "combat-training-analysis": 28,
            "combat-training-analysis-regional": 28,
            "combat-training-results-observation": 29,
            "combat-training-results-inspection": 29,
        }
        users_query = User.objects.filter(
                role__in={User.Role.REGIONAL, User.Role.OUTPOST},
                status=User.Status.ACTIVE,
            ).exclude(region="")
        if training_type:
            users_query = users_query.filter(unit_type=training_type)
        elif is_outpost_viewer:
            users_query = users_query.filter(region=own_unit_number)
            if own_outposts:
                users_query = users_query.exclude(unit_type__in=TRAINING_UNIT_TYPES)
        users = list(users_query.select_related("training_center"))
        submissions_query = ThematicAccountSubmission.objects.filter(
            sender__role__in={User.Role.REGIONAL, User.Role.OUTPOST},
        )
        if training_type:
            submissions_query = submissions_query.filter(sender__unit_type=training_type, sender__status=User.Status.ACTIVE)
        elif is_outpost_viewer:
            submissions_query = submissions_query.filter(
                unit_number=own_unit_number,
                sender__status=User.Status.ACTIVE,
            )
            if own_outposts:
                submissions_query = submissions_query.filter(sender__region=own_unit_number).exclude(sender__unit_type__in=TRAINING_UNIT_TYPES)
        if period != "all":
            submissions_query = submissions_query.filter(
                created_at__gte=period_start,
                created_at__lt=period_end,
            )
        submissions = list(submissions_query.select_related("sender"))
        unit_numbers = {
            str(value or "").strip()
            for value in [
                *(() if is_outpost_viewer else ADMIN_MILITARY_UNIT_NUMBERS),
                *(user.region for user in users),
                *(item.unit_number for item in submissions),
            ]
            if str(value or "").strip()
        }
        if is_outpost_viewer and own_unit_number:
            unit_numbers.add(own_unit_number)

        def empty_entity(name_key, name):
            return {
                name_key: name,
                "totalDocuments": 0,
                "onTimeDocuments": 0,
                "regionalDocuments": 0,
                "outpostDocuments": 0,
                "sections": {},
                "userCount": 0,
                "activeUserCount": 0,
                "lastSeen": None,
                "actions": [],
            }

        ratings = {
            unit_number: {
                **empty_entity("unitNumber", unit_number),
                "outposts": {},
            }
            for unit_number in unit_numbers
        }
        all_outposts = {}

        # An outpost sees every outpost belonging to its own unit, but none from
        # other military units. Other roles keep the complete directory view.
        directory_items = (
            ((own_unit_number, OUTPOSTS_BY_MILITARY_UNIT.get(own_unit_number, ())),)
            if is_outpost_viewer
            else OUTPOSTS_BY_MILITARY_UNIT.items()
        )
        if training_type:
            directory_items = ()
        for unit_number, outpost_names in directory_items:
            rating = ratings.setdefault(
                unit_number,
                {**empty_entity("unitNumber", unit_number), "outposts": {}},
            )
            for raw_name in outpost_names:
                outpost_name = format_outpost_name(raw_name)
                outpost = rating["outposts"].setdefault(
                    outpost_name, empty_entity("outpostName", outpost_name)
                )
                all_outposts[(unit_number, outpost_name)] = outpost

        for user in users:
            unit_number = str(user.region or "").strip()
            rating = ratings.setdefault(
                unit_number,
                {**empty_entity("unitNumber", unit_number), "outposts": {}},
            )
            targets = [rating]
            if user.role == User.Role.OUTPOST:
                outpost_name = (user.outpost_name if training_type else format_outpost_name(user.outpost_name)) or user.full_name
                entity_key = user.pk if training_type else outpost_name
                outpost = rating["outposts"].setdefault(entity_key, empty_entity("outpostName", outpost_name))
                if training_type:
                    outpost["userId"] = user.pk
                    outpost["unitType"] = user.unit_type
                    outpost["trainingCenterName"] = user.training_center.outpost_name if user.training_center_id else ""
                all_outposts[(unit_number, entity_key)] = outpost
                outpost.setdefault('_plan_users', []).append(user.pk)
                targets.append(outpost)
            for target in targets:
                target["userCount"] += 1
                if user.last_login and (period == "all" or period_start <= user.last_login < period_end):
                    target["activeUserCount"] += 1
                if user.last_login and (not target["lastSeen"] or user.last_login > target["lastSeen"]):
                    target["lastSeen"] = user.last_login
                if user.last_login:
                    target["actions"].append({
                        "type": "login",
                        "title": f"{user.full_name} платформага кирди",
                        "at": user.last_login.isoformat(),
                    })

        for submission in submissions:
            unit_number = str((submission.sender.region if training_type else submission.unit_number) or "").strip()
            if not unit_number:
                continue
            rating = ratings.setdefault(
                unit_number,
                {**empty_entity("unitNumber", unit_number), "outposts": {}},
            )
            targets = [rating]
            if submission.sender.role == User.Role.OUTPOST:
                outpost_name = (submission.sender.outpost_name if training_type else format_outpost_name(submission.outpost_name)) or submission.sender.full_name
                entity_key = submission.sender_id if training_type else outpost_name
                outpost = rating["outposts"].setdefault(entity_key, empty_entity("outpostName", outpost_name))
                if training_type:
                    outpost["userId"] = submission.sender_id
                    outpost["unitType"] = training_type
                all_outposts[(unit_number, entity_key)] = outpost
                targets.append(outpost)

            deadline_day = deadline_days.get(submission.section_slug, 28)
            is_on_time = timezone.localtime(submission.created_at).day <= deadline_day
            action = {
                "type": "submission",
                "title": f"{submission.sender.full_name}: {submission.document_title}",
                "sectionId": submission.section_slug,
                "onTime": is_on_time,
                "deadlineDay": deadline_day,
                "at": submission.created_at.isoformat(),
            }
            for target in targets:
                target["totalDocuments"] += 1
                target["onTimeDocuments"] += int(is_on_time)
                section = target["sections"].setdefault(
                    submission.section_slug,
                    {"sectionId": submission.section_slug, "count": 0, "onTimeCount": 0, "deadlineDay": deadline_day},
                )
                section["count"] += 1
                section["onTimeCount"] += int(is_on_time)
                target["actions"].append(action)
            if submission.sender.role == User.Role.REGIONAL:
                rating["regionalDocuments"] += 1
            else:
                rating["outpostDocuments"] += 1

        entities = [*ratings.values(), *all_outposts.values()]
        maximum_documents = max([entity["totalDocuments"] for entity in (all_outposts.values() if training_type else entities)] or [0])
        for entity in entities:
            total = entity["totalDocuments"]
            entity["documentScore"] = round(total / maximum_documents * 100, 1) if maximum_documents else 0
            entity["deadlineScore"] = round(entity["onTimeDocuments"] / total * 100, 1) if total else 0
            entity["activityScore"] = round(entity["activeUserCount"] / entity["userCount"] * 100, 1) if entity["userCount"] else 0
            entity["rawScore"] = round(
                entity["deadlineScore"] * 0.5 + entity["documentScore"] * 0.3 + entity["activityScore"] * 0.2,
                1,
            )
            failed_criteria = sum(
                score < 100
                for score in (
                    entity["deadlineScore"],
                    entity["documentScore"],
                    entity["activityScore"],
                )
            )
            entity["failedCriteria"] = failed_criteria
            entity["criteriaPenalty"] = failed_criteria * 10
            entity["baseScore"] = round(
                max(0, entity["rawScore"] - entity["criteriaPenalty"]),
                1,
            )
            entity["score"] = entity["baseScore"]
            entity["unitBonus"] = 0
            entity["sections"] = sorted(entity["sections"].values(), key=lambda item: (-item["count"], item["sectionId"]))
            entity["actions"] = sorted(entity["actions"], key=lambda item: item["at"], reverse=True)[:50]
            if entity["lastSeen"]:
                entity["lastSeen"] = entity["lastSeen"].isoformat()

        # The unit score already combines the unit with all outposts registered
        # under it. Add the unit's two-percentage-point bonus afterwards.
        for rating in ratings.values():
            rating["unitBonus"] = 2 if rating["baseScore"] > 0 else 0
            rating["score"] = round(min(100, rating["baseScore"] + rating["unitBonus"]), 1)

        from dashboard.plan_ratings import apply_plan_ratings
        apply_plan_ratings(ratings, all_outposts, period_start, period_end, period)
        ordered_ratings = sorted(ratings.values(), key=lambda item: (-item["score"], item["unitNumber"]))
        ordered_outposts = []
        for index, rating in enumerate(ordered_ratings, start=1):
            rating["rank"] = index
            rating["outposts"] = sorted(rating["outposts"].values(), key=lambda item: (-item["score"], item["outpostName"]))
            for outpost in rating["outposts"]:
                outpost["unitNumber"] = rating["unitNumber"]
                ordered_outposts.append(outpost)
        ordered_outposts.sort(key=lambda item: (-item["score"], item["unitNumber"], item["outpostName"]))
        for index, outpost in enumerate(ordered_outposts, start=1):
            outpost["rank"] = index
        if request.user.role != User.Role.ADMIN:
            for item in [*ordered_ratings, *ordered_outposts]:
                item["actions"] = []
        return Response({"period": period, "year": selected_year, "month": selected_month, "half": selected_half, "results": [] if training_type else ordered_ratings, "outposts": ordered_outposts})


class OutpostRatingView(APIView):
    permission_classes = [IsActiveUser]

    def get(self, request):
        now = timezone.now()
        period = request.query_params.get("period", "year")
        if period not in {"all", "month", "half-year", "year"}:
            period = "all"
        try:
            selected_year = int(request.query_params.get("year", now.year))
        except (TypeError, ValueError):
            selected_year = now.year
        selected_year = min(max(selected_year, 2000), now.year)
        try:
            selected_month = int(request.query_params.get("month", now.month))
        except (TypeError, ValueError):
            selected_month = now.month
        selected_month = min(max(selected_month, 1), 12)
        try:
            selected_half = int(request.query_params.get("half", 1 if now.month <= 6 else 2))
        except (TypeError, ValueError):
            selected_half = 1 if now.month <= 6 else 2
        selected_half = 1 if selected_half == 1 else 2
        period_start = now.replace(
            year=selected_year,
            month=(1 if selected_half == 1 else 7) if period == "half-year" else (1 if period == "year" else selected_month),
            day=1,
            hour=0,
            minute=0,
            second=0,
            microsecond=0,
        )
        if period == "year" or (period == "half-year" and selected_half == 2):
            period_end = period_start.replace(year=selected_year + 1, month=1)
        elif period == "half-year":
            period_end = period_start.replace(month=7)
        elif selected_month == 12:
            period_end = period_start.replace(year=selected_year + 1, month=1)
        else:
            period_end = period_start.replace(month=selected_month + 1)
        if request.user.role not in {User.Role.REGIONAL, User.Role.OUTPOST}:
            raise PermissionDenied("Заставалардын рейтинги бул аскер бөлүгүнүн колдонуучуларына гана жеткиликтүү.")

        own_unit_number = str(request.user.region or "").strip()
        unit_numbers = {own_unit_number}
        outpost_entries = {
            (unit_number, format_outpost_name(name))
            for unit_number in unit_numbers
            for name in OUTPOSTS_BY_MILITARY_UNIT.get(unit_number, ())
        }
        registered_outposts = User.objects.filter(
                role=User.Role.OUTPOST,
                status=User.Status.ACTIVE,
            ).exclude(outpost_name="")
        registered_outposts = registered_outposts.filter(region=own_unit_number).exclude(unit_type__in=TRAINING_UNIT_TYPES)
        outpost_entries.update(
            (str(unit_number or "").strip(), format_outpost_name(name))
            for unit_number, name in registered_outposts.values_list("region", "outpost_name")
        )
        section_counts = ThematicAccountSubmission.objects.filter(
            sender__role=User.Role.OUTPOST,
        )
        section_counts = section_counts.exclude(sender__unit_type__in=TRAINING_UNIT_TYPES).filter(
            unit_number=own_unit_number,
            sender__status=User.Status.ACTIVE,
        )
        if period != "all":
            section_counts = section_counts.filter(
                created_at__gte=period_start,
                created_at__lt=period_end,
            )
        section_counts = section_counts.values("unit_number", "outpost_name", "section_slug").annotate(count=Count("id"))

        ratings = {
            (unit_number, name): {
                "unitNumber": unit_number,
                "outpostName": name,
                "totalDocuments": 0,
                "sections": [],
            }
            for unit_number, name in outpost_entries
        }
        for item in section_counts:
            unit_number = str(item["unit_number"] or "").strip()
            outpost_name = format_outpost_name(item["outpost_name"])
            if not outpost_name:
                continue
            rating = ratings.setdefault(
                (unit_number, outpost_name),
                {
                    "unitNumber": unit_number,
                    "outpostName": outpost_name,
                    "totalDocuments": 0,
                    "sections": [],
                },
            )
            rating["totalDocuments"] += item["count"]
            rating["sections"].append(
                {"sectionId": item["section_slug"], "count": item["count"]}
            )

        ordered_ratings = sorted(
            ratings.values(),
            key=lambda item: (-item["totalDocuments"], item["unitNumber"], item["outpostName"]),
        )
        for index, rating in enumerate(ordered_ratings, start=1):
            rating["rank"] = index
            rating["sections"].sort(key=lambda item: (-item["count"], item["sectionId"]))
        return Response({"period": period, "year": selected_year, "month": selected_month, "half": selected_half, "results": ordered_ratings})
