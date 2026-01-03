import 'package:envied/envied.dart';

part 'env.g.dart';

@Envied(useConstantCase: true, obfuscate: true, environment: true)
abstract class Env {
  @EnviedField()
  static String authUrl = _Env.authUrl;

  @EnviedField()
  static String apiUrl = _Env.apiUrl;

  @EnviedField()
  static String appsflyerKey = _Env.appsflyerKey;

  @EnviedField(varName: 'ANALYTICS_ENABLED', defaultValue: true)
  static bool analyticsEnabled = _Env.analyticsEnabled;

  @EnviedField()
  static String googleClientId = _Env.googleClientId;

  @EnviedField()
  static String googleServerClientId = _Env.googleServerClientId;

  @EnviedField()
  static String kakaoNativeAppKey = _Env.kakaoNativeAppKey;

  @EnviedField()
  static String mixpanelToken = _Env.mixpanelToken;

  @EnviedField()
  static String naverClientId = _Env.naverClientId;

  @EnviedField()
  static String naverClientSecret = _Env.naverClientSecret;

  @EnviedField()
  static String oidcClientId = _Env.oidcClientId;

  @EnviedField()
  static String oidcClientSecret = _Env.oidcClientSecret;

  @EnviedField()
  static String sentryDsn = _Env.sentryDsn;

  @EnviedField(varName: 'PUSH_NOTIFICATIONS_ENABLED', defaultValue: true)
  static bool pushNotificationsEnabled = _Env.pushNotificationsEnabled;

  @EnviedField()
  static String usersiteUrl = _Env.usersiteUrl;

  @EnviedField()
  static String websiteUrl = _Env.websiteUrl;

  @EnviedField()
  static String wsUrl = _Env.wsUrl;
}
