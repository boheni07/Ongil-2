import * as Sentry from "@sentry/nextjs";

// Edge 런타임(미들웨어 등) Sentry 초기화. src/instrumentation.ts에서 로드된다.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: process.env.NODE_ENV === "production",
  environment: process.env.NODE_ENV,
  release: process.env.SENTRY_RELEASE,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
});
