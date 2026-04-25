export type LeaseTermsForSchedule = {
  startDate: string;
  termMonths: number;
  monthlyRent: number;
  paymentDueDay: number;
};

export function generatePaymentSchedule(leaseTerms: LeaseTermsForSchedule): Array<{
  periodNumber: number;
  periodLabel: string;
  dueDate: string;
  expectedAmount: number;
}> {
  const start = new Date(leaseTerms.startDate);
  if (!Number.isFinite(start.getTime())) return [];
  const result: Array<{
    periodNumber: number;
    periodLabel: string;
    dueDate: string;
    expectedAmount: number;
  }> = [];

  for (let i = 0; i < leaseTerms.termMonths; i += 1) {
    const due = new Date(start);
    if (i === 0) {
      due.setHours(0, 0, 0, 0);
    } else {
      due.setMonth(start.getMonth() + i);
      due.setDate(Math.min(leaseTerms.paymentDueDay, 28));
    }
    const periodLabel = new Intl.DateTimeFormat("es-CO", {
      month: "long",
      year: "numeric",
    }).format(due);
    result.push({
      periodNumber: i + 1,
      periodLabel: `${periodLabel}`.replace(/^\w/, (c) => c.toUpperCase()),
      dueDate: due.toISOString().slice(0, 10),
      expectedAmount: leaseTerms.monthlyRent,
    });
  }
  return result;
}

