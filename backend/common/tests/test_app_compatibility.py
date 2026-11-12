from django.apps import apps
from django.contrib import admin
from django.db.migrations.autodetector import MigrationAutodetector
from django.db.migrations.loader import MigrationLoader
from django.db.migrations.state import ProjectState
from django.test import SimpleTestCase
from django.urls import URLResolver, get_resolver
from django.utils import translation

from .legacy_contract import ADMIN_MODELS, API_ROUTES, MODEL_IDENTITIES


def api_routes(patterns, prefix=""):
    for pattern in patterns:
        route = prefix + str(pattern.pattern)
        if isinstance(pattern, URLResolver):
            yield from api_routes(pattern.url_patterns, route)
        elif route.startswith("api/"):
            yield route, pattern.name, pattern.callback.view_class.__name__


class ApplicationCompatibilityTests(SimpleTestCase):
    def test_every_api_route_keeps_its_path_name_and_view(self):
        self.assertEqual(sorted(api_routes(get_resolver().url_patterns)), sorted(API_ROUTES))

    def test_model_table_and_permission_labels_are_preserved(self):
        identities = {
            model.__name__: (model._meta.label, model._meta.db_table)
            for model in apps.get_app_config("accounts").get_models()
        }
        self.assertEqual(identities, MODEL_IDENTITIES)

    def test_no_schema_changes_are_needed(self):
        # Match makemigrations: compare untranslated model metadata.
        with translation.override(None):
            loader = MigrationLoader(None, ignore_no_migrations=True)
            changes = MigrationAutodetector(
                loader.project_state(), ProjectState.from_apps(apps)
            ).changes(graph=loader.graph)
        self.assertEqual(changes, {})

    def test_admin_registrations_are_preserved(self):
        self.assertEqual(sorted(model._meta.label for model in admin.site._registry), ADMIN_MODELS)

    def test_legacy_imports_resolve_to_the_same_classes(self):
        from accounts.models import MethodicalManualSubject as LegacySubject
        from accounts.serializers import AdminChatMessageSerializer as LegacyChatSerializer
        from accounts.views import AdminChatMessageView as LegacyChatView
        from messaging.serializers import AdminChatMessageSerializer
        from messaging.views import AdminChatMessageView
        from methodical.models import MethodicalManualSubject

        self.assertIs(LegacySubject, MethodicalManualSubject)
        self.assertIs(LegacyChatSerializer, AdminChatMessageSerializer)
        self.assertIs(LegacyChatView, AdminChatMessageView)
