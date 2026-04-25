export function canCreateRealContract(input: { plusActive: boolean; demoActive: boolean }): {
  allowed: boolean;
  reason?: "no_plus_plan";
} {
  if (input.plusActive) return { allowed: true };
  void input.demoActive;
  return { allowed: false, reason: "no_plus_plan" };
}

