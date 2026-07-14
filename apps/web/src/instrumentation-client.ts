import * as Sentry from "@sentry/nextjs";

// 클라이언트(브라우저) Sentry 초기화. Next.js가 앱 부팅 시 자동 로드한다.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: process.env.NODE_ENV === "production",
  environment: process.env.NODE_ENV,
  release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
});

// App Router 클라이언트 네비게이션 전환을 트레이싱에 연결한다.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
