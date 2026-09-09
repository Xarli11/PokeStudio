/**
 * Minimal `{placeholder}` interpolation for dictionary strings that need a
 * value (a count, a name) — not a full ICU message formatter. Deliberately
 * small per ADR-0009 ("a small formatMessage(template, vars) helper is
 * likely still simpler than adopting next-intl for interpolation alone").
 */
export function formatMessage(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match,
  );
}
