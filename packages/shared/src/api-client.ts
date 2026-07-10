export interface ApiClientConfig {
  baseUrl: string;
  getAccessToken?: () => string | null | undefined;
}

/**
 * Supabase 기반 REST 호출용 얇은 래퍼.
 * 인증(P0-5)·엔드포인트 확정 후 도메인별 메서드로 확장 예정.
 */
export class ApiClient {
  constructor(private readonly config: ApiClientConfig) {}

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = this.config.getAccessToken?.();
    const res = await fetch(`${this.config.baseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });

    if (!res.ok) {
      throw new Error(`API request failed: ${res.status} ${res.statusText}`);
    }

    return (await res.json()) as T;
  }
}
