import json

from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from accounts.permissions import IsActiveUser, IsAdminOrRegionalRole
from news.models import CombatTrainingNews, CombatTrainingNewsLike, CombatTrainingNewsRead
from news.serializers import CombatTrainingNewsSerializer, get_news_reaction_state
from news.services import create_news_attachments, validate_news_files, visible_combat_training_news


class CombatTrainingNewsListCreateView(APIView):
    def get_permissions(self):
        if self.request.method == "GET":
            return [IsActiveUser()]
        return [IsAdminOrRegionalRole()]

    def get(self, request):
        news_items = visible_combat_training_news(request.user).select_related("author").prefetch_related(
            "attachments", "likes"
        )
        serializer = CombatTrainingNewsSerializer(
            news_items,
            many=True,
            context={"request": request},
        )
        return Response({"results": serializer.data})

    def post(self, request):
        title = str(request.data.get("title", "")).strip()
        body = str(request.data.get("body", "")).strip()
        files = request.FILES.getlist("files")
        if not title:
            raise ValidationError({"title": "Укажите заголовок публикации."})
        if not body and not files:
            raise ValidationError({"body": "Добавьте текст или хотя бы один файл."})
        validate_news_files(files)

        with transaction.atomic():
            news = CombatTrainingNews.objects.create(
                title=title,
                body=body,
                author=request.user,
            )
            create_news_attachments(news, files)

        return Response(
            CombatTrainingNewsSerializer(news, context={"request": request}).data,
            status=201,
        )


class CombatTrainingNewsDetailView(APIView):
    permission_classes = [IsAdminOrRegionalRole]

    def get_object(self, request, pk):
        news = get_object_or_404(CombatTrainingNews, pk=pk)
        if request.user.role == User.Role.REGIONAL and news.author_id != request.user.id:
            raise PermissionDenied("Башка колдонуучунун жарыясын өзгөртүүгө укук жок.")
        return news

    def patch(self, request, pk):
        news = self.get_object(request, pk)
        files = request.FILES.getlist("files")
        validate_news_files(files)
        title = str(request.data.get("title", news.title)).strip()
        body = str(request.data.get("body", news.body)).strip()
        if not title:
            raise ValidationError({"title": "Укажите заголовок публикации."})

        raw_remove_ids = request.data.get("removeAttachmentIds", "[]")
        try:
            remove_ids = json.loads(raw_remove_ids) if isinstance(raw_remove_ids, str) else raw_remove_ids
            remove_ids = [int(item) for item in (remove_ids or [])]
        except (TypeError, ValueError, json.JSONDecodeError) as error:
            raise ValidationError({"removeAttachmentIds": "Некорректный список файлов."}) from error

        remaining_attachments = news.attachments.exclude(id__in=remove_ids).exists()
        if not body and not files and not remaining_attachments:
            raise ValidationError({"body": "Добавьте текст или хотя бы один файл."})

        news.title = title
        news.body = body
        news.save(update_fields=["title", "body", "updated_at"])

        removed_attachments = list(news.attachments.filter(id__in=remove_ids))
        for attachment in removed_attachments:
            stored_file = attachment.file
            attachment.delete()
            if stored_file:
                stored_file.delete(save=False)
        create_news_attachments(news, files)

        return Response(
            CombatTrainingNewsSerializer(news, context={"request": request}).data
        )

    def delete(self, request, pk):
        news = self.get_object(request, pk)
        stored_files = [attachment.file for attachment in news.attachments.all()]
        news.delete()
        for stored_file in stored_files:
            if stored_file:
                stored_file.delete(save=False)
        return Response(status=204)


class CombatTrainingNewsLikeView(APIView):
    permission_classes = [IsActiveUser]

    def post(self, request, pk):
        news = get_object_or_404(visible_combat_training_news(request.user), pk=pk)
        like, created = CombatTrainingNewsLike.objects.get_or_create(
            news=news,
            user=request.user,
            reaction_type=CombatTrainingNewsLike.Reaction.LIKE,
        )
        if not created:
            like.delete()
        return Response({
            "isLiked": created,
            "likeCount": news.likes.filter(reaction_type=CombatTrainingNewsLike.Reaction.LIKE).count(),
        })


class CombatTrainingNewsReactionView(APIView):
    permission_classes = [IsActiveUser]

    def post(self, request, pk):
        reaction_type = request.data.get("reaction")
        if reaction_type not in CombatTrainingNewsLike.Reaction.values:
            raise ValidationError({"reaction": "Неизвестный тип реакции."})

        news = get_object_or_404(visible_combat_training_news(request.user), pk=pk)
        reaction, created = CombatTrainingNewsLike.objects.get_or_create(
            news=news,
            user=request.user,
            reaction_type=reaction_type,
        )
        if not created:
            reaction.delete()
        return Response(get_news_reaction_state(news, request.user))


class CombatTrainingNewsUnreadCountView(APIView):
    permission_classes = [IsActiveUser]

    def get(self, request):
        unread_count = visible_combat_training_news(request.user).filter(
            created_at__gte=request.user.date_joined,
        ).exclude(reads__user=request.user).count()
        return Response({"unreadCount": unread_count})


class CombatTrainingNewsReadAllView(APIView):
    permission_classes = [IsActiveUser]

    def post(self, request):
        unread_ids = visible_combat_training_news(request.user).filter(
            created_at__gte=request.user.date_joined,
        ).exclude(reads__user=request.user).values_list("id", flat=True)
        CombatTrainingNewsRead.objects.bulk_create(
            [
                CombatTrainingNewsRead(news_id=news_id, user=request.user)
                for news_id in unread_ids
            ],
            ignore_conflicts=True,
        )
        return Response({"unreadCount": 0})
