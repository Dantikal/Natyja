from django.apps import AppConfig


class AccountsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "accounts"

    def ready(self):
        import sys

        if sys.version_info < (3, 14):
            return

        from django.template.context import BaseContext

        if getattr(BaseContext.__copy__, "_munara_python314_patch", False):
            return

        def copy_base_context(context):
            duplicate = object.__new__(context.__class__)
            duplicate.__dict__.update(context.__dict__)
            duplicate.dicts = context.dicts[:]
            return duplicate

        copy_base_context._munara_python314_patch = True
        BaseContext.__copy__ = copy_base_context
