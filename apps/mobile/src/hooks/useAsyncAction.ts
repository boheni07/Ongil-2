import { useCallback, useRef, useState } from "react";

/**
 * 폼 제출 등 비동기 액션의 loading/error 상태를 표준화한다.
 * run에 넘긴 함수가 문자열을 반환하면 에러 배너 메시지로 표시하고,
 * throw하면 그 메시지를, 아무것도 반환하지 않으면 성공으로 간주한다.
 */
export function useAsyncAction() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  const run = useCallback(async (fn: () => Promise<string | void>) => {
    setError(null);
    setLoading(true);
    try {
      const msg = await fn();
      if (mounted.current && msg) setError(msg);
    } catch (e) {
      if (mounted.current) {
        setError(e instanceof Error ? e.message : "알 수 없는 오류가 발생했습니다.");
      }
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  return { loading, error, setError, run };
}
