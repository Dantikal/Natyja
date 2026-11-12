import json

from django import forms
from django.contrib import admin
from django.db import models


class PrettyJSONWidget(forms.Textarea):
    """Readable editor for tables and other JSON documents."""

    def __init__(self, attrs=None):
        default_attrs = {
            "rows": 24,
            "style": "width: 95%; font-family: monospace; white-space: pre;",
        }
        default_attrs.update(attrs or {})
        super().__init__(default_attrs)

    def format_value(self, value):
        if value in (None, ""):
            return ""
        if isinstance(value, str):
            try:
                value = json.loads(value)
            except (TypeError, ValueError):
                return value
        return json.dumps(value, ensure_ascii=False, indent=2)


class JSONModelAdmin(admin.ModelAdmin):
    formfield_overrides = {
        models.JSONField: {"widget": PrettyJSONWidget},
    }

    @admin.display(description="Содержимое")
    def json_summary(self, obj):
        for field_name in ("table_data", "data", "rows"):
            if hasattr(obj, field_name):
                value = getattr(obj, field_name)
                text = json.dumps(value, ensure_ascii=False)
                return text if len(text) <= 120 else f"{text[:117]}..."
        return "—"
