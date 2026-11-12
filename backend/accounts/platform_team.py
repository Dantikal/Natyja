from rest_framework import serializers
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import PlatformTeamPhoto
from accounts.permissions import IsActiveUser, IsAdminRole


class TeamPhotoSerializer(serializers.ModelSerializer):
    member = serializers.ChoiceField(choices=PlatformTeamPhoto._meta.get_field("member").choices)
    class Meta:
        model = PlatformTeamPhoto
        fields = ["member", "photo"]

    def validate_photo(self, value):
        if value.size > 5 * 1024 * 1024:
            raise serializers.ValidationError("Сүрөт 5 МБ ашпашы керек.")
        return value


class PlatformTeamView(APIView):
    parser_classes = [MultiPartParser, FormParser]

    def get_permissions(self):
        return [IsActiveUser()] if self.request.method == "GET" else [IsAdminRole()]

    def get(self, request):
        return Response(TeamPhotoSerializer(
            PlatformTeamPhoto.objects.all(), many=True, context={"request": request}
        ).data)

    def post(self, request):
        serializer = TeamPhotoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        obj, _ = PlatformTeamPhoto.objects.update_or_create(
            member=serializer.validated_data["member"],
            defaults={"photo": serializer.validated_data["photo"]},
        )
        return Response(TeamPhotoSerializer(obj, context={"request": request}).data)
