from django.db import OperationalError, ProgrammingError

from messaging.models import AdminChatMessage


def chat_unread_count_for_user(user):
    try:
        return AdminChatMessage.objects.filter(recipient=user, is_read=False).count()
    except (OperationalError, ProgrammingError):
        return 0
