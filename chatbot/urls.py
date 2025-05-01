from django.urls import path, include
from django.contrib import admin
from . import views
from django.conf import settings
from django.shortcuts import redirect
from django.conf.urls.static import static
urlpatterns = [
    path('index/', views.index, name='index'),
    path('', lambda request: redirect('register/')), 
    path('handle_prompt/', views.handle_prompt, name='handle_prompt'),
    path('login/', views.login_view, name='login'),
    path('logout/', views.logout_view, name='logout'),
    path('register/', views.register, name='register'),
    # path('debug_session/', views.debug_session, name='debug_session'),
    # path('clear_prompt_history/', views.clear_prompt_history, name='clear_prompt_history'),

]

