import type { EmergencyInfoInput } from "@ongil/validation";

/**
 * docs/03-uiux.md §6-2 `PinnedCard` — 최상단 고정, 빨간 테두리(#E04545), 응급 대응 정보.
 * 데이터는 당사자 프로필의 emergency_info(레코드가 아님). 값이 없으면 안내만 표시한다.
 */
export function PinnedCard({
  emergencyInfo,
  personName,
}: {
  emergencyInfo: EmergencyInfoInput | null;
  personName: string;
}) {
  const hasInfo = Boolean(
    emergencyInfo &&
      (emergencyInfo.allergies?.length ||
        emergencyInfo.medications?.length ||
        emergencyInfo.contacts?.length)
  );

  return (
    <section
      role="note"
      aria-label="응급 대응 정보"
      className="rounded-xl bg-domain-med-bg p-5"
      style={{ border: "2px solid #E04545" }}
    >
      <h3 className="text-headline-3 font-bold text-domain-med-text">
        🚨 응급 대응 정보 — {personName}
      </h3>
      {hasInfo && emergencyInfo ? (
        <div className="mt-3 grid gap-x-6 gap-y-2 text-body sm:grid-cols-2">
          <Item k="알레르기" v={emergencyInfo.allergies?.join(", ") || "없음"} />
          <Item k="복용약" v={emergencyInfo.medications?.join(", ") || "없음"} />
          {(emergencyInfo.contacts ?? []).map((c, i) => (
            <Item key={i} k={`비상연락 (${c.relation || c.name})`} v={`${c.name} ${c.phone}`} />
          ))}
        </div>
      ) : (
        <p className="mt-2 text-body text-domain-med-text/80">등록된 응급 정보가 없습니다.</p>
      )}
    </section>
  );
}

function Item({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <span className="mr-2 font-semibold text-domain-med-text">{k}</span>
      <span className="text-foreground">{v}</span>
    </div>
  );
}
