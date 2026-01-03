import 'dart:async';

import 'package:auto_route/auto_route.dart';
import 'package:flutter/material.dart';
import 'package:typie/service.dart';
import 'package:typie/services/analytics.dart';

class RouterObserver extends AutoRouterObserver {
  RouterObserver({Analytics? analytics}) : _analytics = analytics ?? serviceLocator<Analytics>();

  final Analytics _analytics;

  @override
  void didPush(Route<dynamic> route, Route<dynamic>? previousRoute) {
    unawaited(_analytics.logScreenView(screenName: route.settings.name));
  }

  @override
  void didPop(Route<dynamic> route, Route<dynamic>? previousRoute) {
    unawaited(_analytics.logScreenView(screenName: previousRoute?.settings.name));
  }

  @override
  void didReplace({Route<dynamic>? newRoute, Route<dynamic>? oldRoute}) {
    unawaited(_analytics.logScreenView(screenName: newRoute?.settings.name));
  }

  @override
  void didChangeTabRoute(TabPageRoute route, TabPageRoute previousRoute) {
    unawaited(_analytics.logScreenView(screenName: route.name));
  }
}
