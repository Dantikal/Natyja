from django.urls import path

from messaging.views import (
    AdminChatConversationDeleteView,
    AdminChatMessageDeleteView,
    AdminChatMessageView,
    AdminChatOutpostBroadcastView,
    ChatPartnerListView,
    ChatUnreadCountView,
)

urlpatterns = [
    path("chat/messages/", AdminChatMessageView.as_view(), name="admin-chat-messages"),
    path("chat/partners/", ChatPartnerListView.as_view(), name="chat-partners"),
    path("chat/unread-count/", ChatUnreadCountView.as_view(), name="chat-unread-count"),
    path("chat/messages/<int:pk>/", AdminChatMessageDeleteView.as_view(), name="admin-chat-message-delete"),
    path(
        "chat/conversations/<int:partner_pk>/",
        AdminChatConversationDeleteView.as_view(),
        name="admin-chat-conversation-delete",
    ),
    path(
        "chat/broadcast/outposts/",
        AdminChatOutpostBroadcastView.as_view(),
        name="admin-chat-outpost-broadcast",
    ),
]
