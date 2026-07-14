"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { Button } from "@/components/ui/button";

// (app) 라우트 세그먼트의 렌더링 에러 바운더리. 앱 레이아웃 안에서 친화적 폴백을 보여준다.
export default function AppError({
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
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="max-w-sm space-y-2">
        <h1 className="text-lg font-semibold text-foreground">
          잠시 문제가 생겼어요
        </h1>
        <p className="text-sm text-muted-foreground">
          일시적인 오류로 화면을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.
        </p>
      </div>
      <Button onClick={() => reset()}>다시 시도</Button>
    </div>
  );
}
