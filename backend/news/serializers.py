from rest_framework import serializers

from news.models import CombatTrainingNews, CombatTrainingNewsAttachment, CombatTrainingNewsLike


def get_news_reaction_state(news, user):
    reactions = list(news.likes.all())
    counts = {reaction.value: 0 for reaction in CombatTrainingNewsLike.Reaction}
    selected = []
    for reaction in reactions:
        counts[reaction.reaction_type] += 1
        if user and user.is_authenticated and reaction.user_id == user.id:
            selected.append(reaction.reaction_type)
    return {
        "reactionCounts": counts,
        "userReactions": selected,
        "likeCount": counts[CombatTrainingNewsLike.Reaction.LIKE],
        "isLiked": CombatTrainingNewsLike.Reaction.LIKE in selected,
    }


class CombatTrainingNewsAttachmentSerializer(serializers.ModelSerializer):
    fileUrl = serializers.SerializerMethodField()
    originalName = serializers.CharField(source="original_name")

    class Meta:
        model = CombatTrainingNewsAttachment
        fields = ["id", "fileUrl", "originalName", "kind", "size"]

    def get_fileUrl(self, attachment):
        if not attachment.file:
            return ""
        request = self.context.get("request")
        return request.build_absolute_uri(attachment.file.url) if request else attachment.file.url


class CombatTrainingNewsSerializer(serializers.ModelSerializer):
    attachments = CombatTrainingNewsAttachmentSerializer(many=True, read_only=True)
    authorId = serializers.IntegerField(source="author_id", read_only=True)
    authorName = serializers.SerializerMethodField()
    createdAt = serializers.DateTimeField(source="created_at")
    updatedAt = serializers.DateTimeField(source="updated_at")
    likeCount = serializers.SerializerMethodField()
    isLiked = serializers.SerializerMethodField()
    reactionCounts = serializers.SerializerMethodField()
    userReactions = serializers.SerializerMethodField()

    class Meta:
        model = CombatTrainingNews
        fields = [
            "id",
            "title",
            "body",
            "attachments",
            "authorId",
            "authorName",
            "createdAt",
            "updatedAt",
            "likeCount",
            "isLiked",
            "reactionCounts",
            "userReactions",
        ]

    def get_authorName(self, news):
        if not news.author:
            return "Администратор"
        if news.author.role == news.author.Role.ADMIN:
            return "Администратор"
        if news.author.role == news.author.Role.REGIONAL:
            unit_number = str(news.author.region or "").strip()
            return f"Аскер бөлүгү {unit_number}".strip()
        return news.author.full_name or news.author.email

    def get_likeCount(self, news):
        return self._reaction_state(news)["likeCount"]

    def get_isLiked(self, news):
        return self._reaction_state(news)["isLiked"]

    def get_reactionCounts(self, news):
        return self._reaction_state(news)["reactionCounts"]

    def get_userReactions(self, news):
        return self._reaction_state(news)["userReactions"]

    def _reaction_state(self, news):
        if not hasattr(self, "_reaction_states"):
            self._reaction_states = {}
        if news.pk not in self._reaction_states:
            request = self.context.get("request")
            self._reaction_states[news.pk] = get_news_reaction_state(
                news, request.user if request else None
            )
        return self._reaction_states[news.pk]
