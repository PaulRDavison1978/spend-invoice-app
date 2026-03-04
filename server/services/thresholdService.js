import prisma from '../lib/prisma.js';
import { logAudit } from './auditService.js';
import { sendTemplateEmail } from './emailService.js';

/**
 * Check spend threshold after an invoice is linked/unlinked.
 * Upserts or deletes SpendAlert rows as appropriate.
 * Returns the alert object or null.
 */
export async function checkSpendThreshold(spendApprovalId, performedBy, userId) {
  const spend = await prisma.spendApproval.findUnique({
    where: { id: spendApprovalId },
    include: { invoices: true },
  });
  if (!spend) return null;

  // Get exchange rates for all relevant currencies
  const currencyCodes = new Set([spend.currency]);
  for (const inv of spend.invoices) {
    if (inv.currency) currencyCodes.add(inv.currency);
  }

  const currencies = await prisma.currency.findMany({
    where: { code: { in: [...currencyCodes] } },
  });
  const rateMap = Object.fromEntries(currencies.map(c => [c.code, Number(c.exchangeRateToEur)]));

  // Convert approved amount to EUR
  const approvedRate = rateMap[spend.currency] || 1;
  const approvedAmountEur = Number(spend.amount) * approvedRate;

  // Sum all linked invoice amounts converted to EUR
  let totalInvoicedEur = 0;
  for (const inv of spend.invoices) {
    const invRate = rateMap[inv.currency] || 1;
    totalInvoicedEur += Number(inv.amount) * invRate;
  }

  const ratio = approvedAmountEur > 0 ? totalInvoicedEur / approvedAmountEur : 0;

  // Determine highest threshold crossed
  let threshold = null;
  if (ratio >= 1.0) {
    threshold = '100%';
  } else if (ratio >= 0.8) {
    threshold = '80%';
  }

  // If no threshold crossed, delete any existing alerts for this spend
  if (!threshold) {
    await prisma.spendAlert.deleteMany({ where: { spendApprovalId } });
    return null;
  }

  // If 100% reached, delete the 80% alert (only keep highest)
  if (threshold === '100%') {
    await prisma.spendAlert.deleteMany({
      where: { spendApprovalId, threshold: '80%' },
    });
  }

  // Upsert the alert — reset dismissedAt if re-triggered
  const alert = await prisma.spendAlert.upsert({
    where: {
      spendApprovalId_threshold: { spendApprovalId, threshold },
    },
    update: {
      totalInvoiced: totalInvoicedEur,
      approvedAmount: approvedAmountEur,
      dismissedAt: null,
    },
    create: {
      spendApprovalId,
      threshold,
      totalInvoiced: totalInvoicedEur,
      approvedAmount: approvedAmountEur,
    },
  });

  await logAudit({
    action: 'SPEND_THRESHOLD_ALERT',
    details: `Spend ${spend.ref} reached ${threshold} threshold (${Math.round(ratio * 100)}% invoiced)`,
    performedBy,
    userId,
    metadata: {
      spendApprovalId,
      threshold,
      ratio: Math.round(ratio * 100),
      totalInvoicedEur,
      approvedAmountEur,
    },
  });

  // Notify approver of threshold breach (fire-and-forget)
  if (spend.approverId) {
    const approver = await prisma.user.findUnique({ where: { id: spend.approverId } });
    if (approver?.email) {
      sendTemplateEmail('spend_limit_alert', approver.email, {
        approver_name: approver.name,
        spend_ref: spend.ref,
        spend_title: spend.title,
        department: spend.department || '',
        currency: spend.currency || '',
        approved_amount: String(approvedAmountEur.toFixed(2)),
        total_invoiced: String(totalInvoicedEur.toFixed(2)),
        threshold,
      }, { performedBy, userId });
    }
  }

  return alert;
}
