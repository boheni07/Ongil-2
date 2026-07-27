import path from "node:path";
import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname, "..", ".."),
  },
  transpilePackages: ["@ongil/shared", "@ongil/validation"],
  // 개발 모드에서 LAN 또는 포트포워딩된 외부 도메인으로 접속할 때 Next.js가 기본적으로
  // HMR 등 dev 리소스에 대한 cross-origin 요청을 차단하는 문제 해결(로그의 안내를 그대로 반영).
  // allowedDevOrigins는 호스트명만 지원(CIDR 불가) — IP/도메인이 바뀌면 이 값도 갱신 필요.
  allowedDevOrigins: ["192.168.0.100", "dev.nubiz.co.kr"],
};

// 소스맵 업로드는 SENTRY_AUTH_TOKEN이 있을 때만(로컬/CI에서 env로 주입) 수행한다.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  disableLogger: true,
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
});
