import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import * as Network from "expo-network";

/**
 * 오프라인→온라인 전환 및 앱 포그라운드 복귀 시 onOnline을 호출한다(P3-4 자동 동기화 트리거).
 *
 * Expo SDK 57 `expo-network`의 addNetworkStateListener로 연결 상태를 구독한다
 * (EventSubscription.remove()로 해제). 이벤트를 놓치는 경우를 대비해 AppState가
 * active로 복귀할 때도 같은 콜백을 호출하는 이중 안전장치를 둔다.
 *
 * - 네트워크 리스너: 오프라인(false/미확인)→온라인(true) 전환에서만 호출(직전 상태 비교로 중복 방지).
 * - AppState 리스너: 포그라운드 복귀 시 연결돼 있으면 매번 호출(flush는 멱등이라 안전).
 */
export function useNetworkSync(onOnline: () => void): void {
  const onlineRef = useRef(onOnline);
  onlineRef.current = onOnline;
  const wasConnected = useRef<boolean | null>(null);

  useEffect(() => {
    let mounted = true;

    // 초기 연결 상태 확보(첫 전환을 정확히 판별하기 위함)
    void Network.getNetworkStateAsync()
      .then((state) => {
        if (mounted && wasConnected.current === null) {
          wasConnected.current = Boolean(state.isConnected);
        }
      })
      .catch(() => {});

    const netSub = Network.addNetworkStateListener((state) => {
      if (!mounted) return;
      const connected = Boolean(state.isConnected);
      const prev = wasConnected.current;
      wasConnected.current = connected;
      if (connected && prev !== true) {
        onlineRef.current();
      }
    });

    const appSub = AppState.addEventListener("change", (status: AppStateStatus) => {
      if (!mounted || status !== "active") return;
      void Network.getNetworkStateAsync()
        .then((state) => {
          if (mounted && state.isConnected) onlineRef.current();
        })
        .catch(() => {
          // 상태 확인 실패 시에도 최소 한 번은 동기화 시도
          if (mounted) onlineRef.current();
        });
    });

    return () => {
      mounted = false;
      netSub.remove();
      appSub.remove();
    };
  }, []);
}
