from django.urls import reverse
from rest_framework.test import APITestCase

from messaging.models import AdminChatMessage
from accounts.models import User


class RoleChatApiTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username="chat-admin@example.com",
            email="chat-admin@example.com",
            password="test-password",
            role=User.Role.ADMIN,
            status=User.Status.ACTIVE,
        )
        self.regional = User.objects.create_user(
            username="chat-unit-2021@example.com",
            email="chat-unit-2021@example.com",
            password="test-password",
            role=User.Role.REGIONAL,
            status=User.Status.ACTIVE,
            region="2021",
        )
        self.outpost = User.objects.create_user(
            username="chat-outpost-2021@example.com",
            email="chat-outpost-2021@example.com",
            password="test-password",
            role=User.Role.OUTPOST,
            status=User.Status.ACTIVE,
            region="2021",
            outpost_name="Жаштык",
        )
        self.other_regional = User.objects.create_user(
            username="chat-unit-2022@example.com",
            email="chat-unit-2022@example.com",
            password="test-password",
            role=User.Role.REGIONAL,
            status=User.Status.ACTIVE,
            region="2022",
        )
        self.messages_url = reverse("admin-chat-messages")
        self.partners_url = reverse("chat-partners")

    def test_chat_pages_return_latest_then_older_without_other_conversations(self):
        messages = [AdminChatMessage.objects.create(sender=self.outpost, recipient=self.regional, body=f"message {i}") for i in range(3)]
        AdminChatMessage.objects.create(sender=self.other_regional, recipient=self.admin, body="private")
        self.client.force_authenticate(self.outpost)
        params = {"user_id": self.regional.pk, "paged": "1", "limit": "2"}
        first = self.client.get(self.messages_url, params)
        self.assertEqual(first.status_code, 200)
        self.assertEqual([item["id"] for item in first.data["results"]], [messages[1].pk, messages[2].pk])
        params["beforeId"] = first.data["nextCursor"]
        last = self.client.get(self.messages_url, params)
        self.assertEqual([item["id"] for item in last.data["results"]], [messages[0].pk])
        self.assertIsNone(last.data["nextCursor"])
        self.assertEqual(self.client.get(self.messages_url, {"paged": "1", "limit": "bad"}).status_code, 400)

    def test_outpost_can_choose_matching_regional_and_regional_can_reply(self):
        self.client.force_authenticate(self.outpost)
        response = self.client.get(self.partners_url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            {item["id"] for item in response.data},
            {self.regional.id, self.admin.id},
        )

        response = self.client.post(
            self.messages_url,
            {"recipientId": self.regional.id, "body": "Саламатсызбы"},
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["recipient"]["id"], self.regional.id)

        self.client.force_authenticate(self.regional)
        dashboard = self.client.get(reverse("dashboard-regional"))
        self.assertEqual(dashboard.data["modules"]["chatUnreadCount"], 1)

        response = self.client.get(f"{self.messages_url}?user_id={self.outpost.id}")
        self.assertEqual(len(response.data), 1)
        self.assertTrue(response.data[0]["isRead"])

        response = self.client.post(
            self.messages_url,
            {"recipientId": self.outpost.id, "body": "Жообу"},
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["recipient"]["id"], self.outpost.id)

        response = self.client.post(
            self.messages_url,
            {"recipientId": self.admin.id, "body": "Администраторго билдирүү"},
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["recipient"]["id"], self.admin.id)

    def test_outpost_can_start_message_to_admin(self):
        self.client.force_authenticate(self.outpost)
        response = self.client.post(
            self.messages_url,
            {"recipientId": self.admin.id, "body": "Түз билдирүү"},
            format="json",
        )
        self.assertEqual(response.status_code, 201)

    def test_admin_can_choose_military_units_and_outposts(self):
        self.client.force_authenticate(self.admin)
        response = self.client.get(self.partners_url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            {item["id"] for item in response.data},
            {self.regional.id, self.other_regional.id, self.outpost.id},
        )

        response = self.client.post(
            self.messages_url,
            {"recipientId": self.outpost.id, "body": "Түз билдирүү"},
            format="json",
        )
        self.assertEqual(response.status_code, 201)

        self.client.force_authenticate(self.outpost)
        partners = self.client.get(self.partners_url)
        self.assertEqual(
            {item["id"] for item in partners.data},
            {self.regional.id, self.admin.id},
        )
        messages = self.client.get(f"{self.messages_url}?user_id={self.admin.id}")
        self.assertEqual(len(messages.data), 1)
        self.assertEqual(messages.data[0]["body"], "Түз билдирүү")

        reply = self.client.post(
            self.messages_url,
            {"recipientId": self.admin.id, "body": "Заставанын жообу"},
            format="json",
        )
        self.assertEqual(reply.status_code, 201)
        self.assertEqual(reply.data["recipient"]["id"], self.admin.id)

    def test_admin_can_delete_outpost_conversation_for_both_sides(self):
        self.client.force_authenticate(self.admin)
        self.client.post(
            self.messages_url,
            {"recipientId": self.outpost.id, "body": "Өчүрүлүүчү билдирүү"},
            format="json",
        )
        delete_url = reverse(
            "admin-chat-conversation-delete",
            kwargs={"partner_pk": self.outpost.id},
        )

        self.assertEqual(self.client.delete(delete_url).status_code, 204)
        self.assertFalse(AdminChatMessage.objects.exists())

        self.client.force_authenticate(self.outpost)
        self.assertEqual(
            self.client.get(f"{self.messages_url}?user_id={self.admin.id}").data,
            [],
        )
        self.assertIn(
            self.admin.id,
            {item["id"] for item in self.client.get(self.partners_url).data},
        )

    def test_admin_broadcast_is_delivered_to_every_active_outpost(self):
        second_outpost = User.objects.create_user(
            username="chat-outpost-2022@example.com",
            email="chat-outpost-2022@example.com",
            password="test-password",
            role=User.Role.OUTPOST,
            status=User.Status.ACTIVE,
            region="2022",
            outpost_name="Достук",
        )
        self.client.force_authenticate(self.admin)

        response = self.client.post(
            reverse("admin-chat-outpost-broadcast"),
            {"body": "Бардык заставалар үчүн билдирүү"},
            format="multipart",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["recipientCount"], 2)
        self.assertEqual(
            set(AdminChatMessage.objects.values_list("recipient_id", flat=True)),
            {self.outpost.id, second_outpost.id},
        )
        self.assertFalse(
            AdminChatMessage.objects.filter(recipient=self.regional).exists()
        )
        admin_group_messages = self.client.get(
            f"{self.messages_url}?scope=outpost_broadcast"
        )
        self.assertEqual(len(admin_group_messages.data), 2)
        self.assertEqual(
            len({item["broadcastId"] for item in admin_group_messages.data}),
            1,
        )

        self.client.force_authenticate(second_outpost)
        self.assertIn(
            self.other_regional.id,
            {item["id"] for item in self.client.get(self.partners_url).data},
        )
        self.assertIn(
            self.admin.id,
            {item["id"] for item in self.client.get(self.partners_url).data},
        )
        group_messages = self.client.get(
            f"{self.messages_url}?scope=outpost_broadcast"
        )
        self.assertEqual(len(group_messages.data), 1)
        self.assertTrue(group_messages.data[0]["isBroadcast"])
        reply = self.client.post(
            self.messages_url,
            {"recipientId": self.admin.id, "body": "Билдирүүнү алдым"},
            format="json",
        )
        self.assertEqual(reply.status_code, 201)

        self.client.force_authenticate(self.admin)
        delete_message_url = reverse(
            "admin-chat-message-delete",
            kwargs={"pk": admin_group_messages.data[0]["id"]},
        )
        deleted = self.client.delete(
            delete_message_url,
            {"mode": "everyone"},
            format="json",
        )
        self.assertEqual(deleted.status_code, 200)
        self.assertEqual(
            AdminChatMessage.objects.filter(
                is_broadcast=True,
                deleted_for_everyone=True,
                body="",
            ).count(),
            2,
        )

    def test_other_unit_cannot_message_foreign_outpost(self):
        self.client.force_authenticate(self.other_regional)
        response = self.client.post(
            self.messages_url,
            {"recipientId": self.outpost.id, "body": "Тыюу салынган"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_admin_selected_broadcast_delivers_to_private_chats_only(self):
        self.client.force_authenticate(self.admin)
        url = reverse("admin-chat-outpost-broadcast")
        response = self.client.post(url, {"audience": "selected", "recipientIds": [self.regional.id, self.outpost.id], "body": "test announcement"}, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["recipientCount"], 2)
        messages = AdminChatMessage.objects.filter(sender=self.admin)
        self.assertEqual(messages.count(), 2)
        self.assertEqual(messages.filter(is_broadcast=True).count(), 0)
        self.assertEqual(len(set(messages.values_list("broadcast_id", flat=True))), 1)
        self.assertFalse(messages.filter(recipient=self.other_regional).exists())

    def test_selected_broadcast_rejects_invalid_recipient_without_partial_send(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(reverse("admin-chat-outpost-broadcast"), {"audience": "selected", "recipientIds": [self.outpost.id, 999999], "body": "not sent"}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(AdminChatMessage.objects.exists())
        self.client.force_authenticate(self.regional)
        response = self.client.post(reverse("admin-chat-outpost-broadcast"), {"audience": "all", "body": "not allowed"}, format="json")
        self.assertEqual(response.status_code, 403)

    def test_partner_list_includes_latest_message_and_unread(self):
        AdminChatMessage.objects.create(sender=self.outpost, recipient=self.admin, body="latest test")
        self.client.force_authenticate(self.admin)
        response = self.client.get(self.partners_url)
        self.assertEqual(response.status_code, 200)
        partner = next(item for item in response.data if item["id"] == self.outpost.id)
        self.assertEqual(partner["lastMessagePreview"], "latest test")
        self.assertEqual(partner["unreadChatCount"], 1)
        self.assertFalse(partner["lastMessageFromMe"])
        self.assertIsNotNone(partner["lastMessageAt"])

    def test_broadcast_audience_all_and_role_filters(self):
        self.client.force_authenticate(self.admin)
        url = reverse("admin-chat-outpost-broadcast")
        response = self.client.post(url, {"audience": "regional", "body": "units only"}, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(set(AdminChatMessage.objects.values_list("recipient_id", flat=True)), {self.regional.id, self.other_regional.id})
        response = self.client.post(url, {"audience": "all", "body": "all partners"}, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["recipientCount"], 3)
        self.assertEqual(AdminChatMessage.objects.filter(body="all partners", recipient=self.outpost).count(), 1)

    def test_selected_broadcast_attachment_is_delivered_to_each_recipient(self):
        import tempfile
        from django.test import override_settings
        from django.core.files.uploadedfile import SimpleUploadedFile
        with tempfile.TemporaryDirectory() as directory, override_settings(MEDIA_ROOT=directory):
            self.client.force_authenticate(self.admin)
            response = self.client.post(reverse("admin-chat-outpost-broadcast"), {"audience": "selected", "recipientIds": [self.regional.id, self.outpost.id], "attachment": SimpleUploadedFile("notice.txt", b"test attachment", content_type="text/plain")}, format="multipart")
            self.assertEqual(response.status_code, 201)
            for message in AdminChatMessage.objects.all():
                self.assertEqual(message.attachment.read(), b"test attachment")
                message.attachment.close()


    def test_unread_badge_counts_messages_and_clears_after_opening_chat(self):
        AdminChatMessage.objects.create(sender=self.outpost, recipient=self.admin, body="one")
        AdminChatMessage.objects.create(sender=self.outpost, recipient=self.admin, body="two")
        self.client.force_authenticate(self.admin)
        partner = next(item for item in self.client.get(self.partners_url).data if item["id"] == self.outpost.id)
        self.assertEqual(partner["unreadChatCount"], 2)
        self.client.get(self.messages_url, {"user_id": self.outpost.id})
        partner = next(item for item in self.client.get(self.partners_url).data if item["id"] == self.outpost.id)
        self.assertEqual(partner["unreadChatCount"], 0)

    def test_outposts_can_chat_within_their_unit_only(self):
        peer = User.objects.create_user(username="peer@test.local",email="peer@test.local",password="test",role=User.Role.OUTPOST,status=User.Status.ACTIVE,region="2021",outpost_name="Peer")
        other = User.objects.create_user(username="other@test.local",email="other@test.local",password="test",role=User.Role.OUTPOST,status=User.Status.ACTIVE,region="2022",outpost_name="Other")
        self.client.force_authenticate(self.outpost)
        partners=self.client.get(self.partners_url)
        ids=[p['id'] for p in partners.data]
        self.assertIn(peer.pk,ids)
        self.assertNotIn(other.pk,ids)
        response=self.client.post(self.messages_url,{'recipientId':peer.pk,'body':'Hello peer'},format='json')
        self.assertEqual(response.status_code,201)
        self.assertEqual(self.client.post(self.messages_url,{'recipientId':other.pk,'body':'Denied'},format='json').status_code,400)
        self.client.force_authenticate(peer)
        inbox=self.client.get(self.messages_url,{'user_id':self.outpost.pk})
        self.assertEqual(inbox.status_code,200)
        self.assertEqual(inbox.data[0]['body'],'Hello peer')
