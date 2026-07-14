"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

// 루트 레이아웃까지 무너진 렌더링 에러를 잡는 최상위 에러 바운더리.
// 자체 <html>/<body>를 렌더링해야 하므로 전역 스타일 대신 인라인 스타일을 쓴다.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="ko">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#F7F8F7",
          fontFamily:
            "Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
          color: "#1A1C1A",
        }}
      >
        <div style={{ maxWidth: 400, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: "0 0 8px" }}>
            잠시 문제가 생겼어요
          </h1>
          <p
            style={{
              fontSize: 14,
              lineHeight: 1.6,
              color: "#5B605B",
              margin: "0 0 24px",
            }}
          >
            일시적인 오류로 화면을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.
          </p>
          <button
            onClick={() => reset()}
            style={{
              height: 40,
              padding: "0 20px",
              borderRadius: 10,
              border: "none",
              backgroundColor: "#0F6E56",
              color: "#FFFFFF",
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            다시 시도
          </button>
        </div>
      </body>
    </html>
  );
}
