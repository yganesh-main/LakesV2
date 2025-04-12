from django.urls import path
from . import views
from django.conf import settings
from django.conf.urls.static import static



urlpatterns = [
    path('', views.index, name='index'),
     path('', views.redirect_to_chat, name='home'),
    path('handle_prompt/', views.handle_prompt, name='handle_prompt'),
    path('login/', views.login_view, name='login'),
    path('logout/', views.logout_view, name='logout'),


]+ static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
