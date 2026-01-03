# app

## Firebase & push setup

- Configure `ANALYTICS_ENABLED` and `PUSH_NOTIFICATIONS_ENABLED` in your `.env` file (Envied). Both default to `true`.
- When either flag is `false`, dependency injection provides stub implementations for Firebase Analytics / Messaging. Push token registration, deletion, the in-app toast listener, and the GraphQL mutation are skipped while offline or when the flag is disabled.
- With both flags disabled, Firebase bootstrapping is bypassed so the app can run without `google-services.json` or `GoogleService-Info.plist`.
