/**
 * Merges multistep JSON + current step fields the same way as POST /api/leads.
 */
export function mergeMultistepLeadFormData(
  formData: Record<string, unknown>,
): Record<string, unknown> {
  const { utm_source: _u1, utm_medium: _u2, utm_campaign: _u3, _multistepData, ...restForm } =
    formData;
  void _u1;
  void _u2;
  void _u3;
  let mergedFormData: Record<string, unknown> = { ...restForm };
  if (typeof _multistepData === "string") {
    try {
      const parsed = JSON.parse(_multistepData) as Record<string, unknown>;
      const lastStepKey = "step" + Object.keys(parsed).length;
      mergedFormData = { ...parsed, [lastStepKey]: restForm };
    } catch {
      mergedFormData = { ...restForm };
    }
  } else if (_multistepData && typeof _multistepData === "object") {
    const parsed = _multistepData as Record<string, unknown>;
    const lastStepKey = "step" + Object.keys(parsed).length;
    mergedFormData = { ...parsed, [lastStepKey]: restForm };
  }
  if (typeof restForm._ctaText === "string" && restForm._ctaText.trim()) {
    mergedFormData._ctaText = restForm._ctaText.trim();
  }
  if (typeof restForm._stepSlug === "string" && restForm._stepSlug.trim()) {
    mergedFormData._stepSlug = restForm._stepSlug.trim();
  }
  return mergedFormData;
}
