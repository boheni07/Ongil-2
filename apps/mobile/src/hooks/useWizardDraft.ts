import { useCallback, useEffect, useRef, useState } from "react";
import { Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * 위저드 폼 오프라인 임시저장 — 단계별 입력을 AsyncStorage에 저장하고,
 * 앱 재진입 시 복원 여부를 다이얼로그로 물어본다(모바일 오프라인 처리 요구사항).
 * 네트워크와 무관하게 로컬에 즉시 저장되므로, 앱 종료·크래시에도 입력이 남는다.
 */
export function useWizardDraft<T>(key: string) {
  const [restoring, setRestoring] = useState(true);
  const applyRef = useRef<((v: T) => void) | null>(null);

  /** 복원 콜백 등록 후 저장된 초안이 있으면 복원 여부를 묻는다. */
  const checkRestore = useCallback(
    async (apply: (v: T) => void) => {
      applyRef.current = apply;
      try {
        const raw = await AsyncStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw) as T;
          Alert.alert("임시저장된 내용이 있어요", "이어서 작성할까요?", [
            {
              text: "새로 작성",
              style: "destructive",
              onPress: () => {
                void AsyncStorage.removeItem(key);
              },
            },
            { text: "이어 작성", onPress: () => apply(parsed) },
          ]);
        }
      } catch {
        // 손상된 초안은 무시
      } finally {
        setRestoring(false);
      }
    },
    [key]
  );

  const saveDraft = useCallback(
    (value: T) => {
      void AsyncStorage.setItem(key, JSON.stringify(value));
    },
    [key]
  );

  const clearDraft = useCallback(() => {
    void AsyncStorage.removeItem(key);
  }, [key]);

  useEffect(() => () => {
    applyRef.current = null;
  }, []);

  return { restoring, checkRestore, saveDraft, clearDraft };
}
