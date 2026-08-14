import { CONTACT_OUTCOME_OPTIONS } from "@/lib/crm/constants";

export function OutcomeTypeSelect({ name = "outcomeType" }: { name?: string }) {
  return (
    <label className="block text-label-sm text-on-surface-variant">
      Resultado (opcional)
      <select
        name={name}
        defaultValue=""
        className="mt-1 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-body-md focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
      >
        <option value="">Sin clasificar</option>
        {CONTACT_OUTCOME_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
