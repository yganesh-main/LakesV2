from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
# Removed the url import as it's no longer needed

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', include('chatbot.urls')),  # Ensure your chatbot.urls is correct
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
