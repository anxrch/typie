import 'package:firebase_analytics/firebase_analytics.dart';

abstract interface class Analytics {
  Future<void> logScreenView({String? screenName});
}

class FirebaseAnalyticsService implements Analytics {
  const FirebaseAnalyticsService(this._analytics);

  final FirebaseAnalytics _analytics;

  @override
  Future<void> logScreenView({String? screenName}) => _analytics.logScreenView(screenName: screenName);
}

class NoopAnalytics implements Analytics {
  const NoopAnalytics();

  @override
  Future<void> logScreenView({String? screenName}) async {}
}
