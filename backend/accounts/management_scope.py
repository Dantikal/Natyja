from accounts.models import User

MANAGEMENT_UNITS = {"2022": ("2021", "2023"), "2027": ("2030",)}

def subordinate_users(user):
    units = MANAGEMENT_UNITS.get(user.region, ()) if user.role in {User.Role.MANAGEMENT, User.Role.REGIONAL} else ()
    return User.objects.filter(region__in=units, role__in=[User.Role.REGIONAL, User.Role.OUTPOST])

def management_chat_allowed(sender, recipient):
    if sender.role == User.Role.MANAGEMENT:
        return recipient.role == User.Role.ADMIN or subordinate_users(sender).filter(pk=recipient.pk).exists()
    if recipient.role == User.Role.MANAGEMENT:
        return sender.role == User.Role.ADMIN or subordinate_users(recipient).filter(pk=sender.pk).exists()
    return False
