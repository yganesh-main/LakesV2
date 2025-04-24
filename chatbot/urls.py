from django.urls import path
from . import views
from django.conf import settings
from django.conf.urls.static import static
urlpatterns = [
    path('', views.index, name='index'),
    path('handle_prompt/', views.handle_prompt, name='handle_prompt'),
    path('debug_session/', views.debug_session, name='debug_session'),
    path('clear_prompt_history/', views.clear_prompt_history, name='clear_prompt_history'),
]

