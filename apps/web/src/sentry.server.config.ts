import * as Sentry from "@sentry/nextjs";

// 서버(Node 런타임) Sentry 초기화. src/instrumentation.ts의 register()에서 로드된다.
// DSN 미설정 또는 개발 환경에서는 전송하지 않아 로컬 노이즈를 막는다.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: process.env.NODE_ENV === "production",
  environment: process.env.NODE_ENV,
  release: process.env.SENTRY_RELEASE,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
});
