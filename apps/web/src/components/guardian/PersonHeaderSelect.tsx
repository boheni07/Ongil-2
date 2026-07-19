"use client";

import { computeAge } from "@/lib/lifecycle";
import { useCurrentPerson } from "./CurrentPersonProvider";

/** 프로토타입 web-guardian.html `.person-select`(헤더 👤 콤보박스) 1:1 이식. */
export function PersonHeaderSelect() {
  const { personId, persons, setPersonId } = useCurrentPerson();
  if (persons.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 rounded-(--br-md) bg-primary-50 px-2.5 py-1.5">
      <span aria-hidden="true">👤</span>
      <label htmlFor="hdr-person" className="sr-only">
        당사자 선택
      </label>
      <select
        id="hdr-person"
        value={personId ?? ""}
        onChange={(e) => setPersonId(e.target.value)}
        className="max-w-40 truncate bg-transparent text-sm font-semibold text-primary-800 outline-none sm:max-w-none"
      >
        {persons.map((p) => (
          <option key={p.id} value={p.id}>
            {p.fullName} (만 {computeAge(p.birthDate)}세)
          </option>
        ))}
      </select>
    </div>
  );
}
