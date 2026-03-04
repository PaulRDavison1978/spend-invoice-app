import prisma from '../lib/prisma.js';

/**
 * Find invoice-to-spend-approval matches using a scoring algorithm.
 *
 * Scoring:
 * - SA reference in invoice description/number: +60
 * - Exact vendor match: +30
 * - Partial vendor match (word > 2 chars): +15
 * - Amount within ±10%: +20
 * - Minimum threshold: 15
 *
 * @param {object} options
 * @param {boolean} options.restrictToUser - if true, only match user's own invoices/spends
 * @param {string} options.userName - current user's name
 * @returns {Array} matching results
 */
export async function findMatches({ restrictToUser = false, userName = null } = {}) {
  const [invoices, spendApprovals] = await Promise.all([
    prisma.invoice.findMany(),
    prisma.spendApproval.findMany({ where: { status: 'Approved' } }),
  ]);

  const unlinkedInvs = invoices.filter(inv =>
    !inv.spendApprovalId && (!restrictToUser || inv.submittedBy === userName)
  );

  const filteredSpends = spendApprovals.filter(sp =>
    !restrictToUser || sp.submittedBy === userName
  );

  const results = [];

  for (const sp of filteredSpends) {
    const suggestions = [];
    const saRef = (sp.ref || '').toUpperCase();
    const spVendor = (sp.vendor || '').toLowerCase();
    const spAmt = parseFloat(sp.amount) || 0;

    const linkedInvs = invoices.filter(i => i.spendApprovalId === sp.id);
    const totalInvoiced = linkedInvs.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0);

    for (const inv of unlinkedInvs) {
      let score = 0;
      const reasons = [];
      const invDesc = ((inv.description || '') + ' ' + (inv.invoiceNumber || '')).toUpperCase();

      // SA reference match
      if (saRef && invDesc.includes(saRef)) {
        score += 60;
        reasons.push('SA reference match');
      }

      // Vendor matching
      const invVendor = (inv.vendor || '').toLowerCase();
      if (invVendor && spVendor && (invVendor.includes(spVendor) || spVendor.includes(invVendor))) {
        score += 30;
        reasons.push('Vendor match');
      } else if (invVendor && spVendor) {
        const words = spVendor.split(/\s+/);
        if (words.some(w => w.length > 2 && invVendor.includes(w))) {
          score += 15;
          reasons.push('Partial vendor match');
        }
      }

      // Amount matching
      const invAmt = parseFloat(inv.amount) || 0;
      if (invAmt > 0 && spAmt > 0) {
        const diff = Math.abs(invAmt - spAmt) / spAmt;
        if (diff <= 0.1) {
          score += 20;
          reasons.push(`Amount ±${(diff * 100).toFixed(0)}%`);
        }
      }

      if (score >= 15) {
        suggestions.push({
          invoiceId: inv.id,
          invoiceNumber: inv.invoiceNumber || '',
          invoiceVendor: inv.vendor || '',
          invoiceAmount: String(inv.amount),
          invoiceDate: inv.date || '',
          invoiceDueDate: inv.dueDate || '',
          invoiceDescription: inv.description || '',
          invoiceSubmittedBy: inv.submittedBy || '',
          score,
          reasons,
        });
      }
    }

    if (suggestions.length > 0) {
      results.push({
        spendId: sp.id,
        spendRef: sp.ref || '',
        spendTitle: sp.title || '',
        spendVendor: sp.vendor || '',
        spendCurrency: sp.currency || '',
        spendAmount: String(sp.amount),
        spendCategory: sp.category || '',
        spendRegion: sp.region || '',
        spendAtom: sp.atom || '',
        totalInvoiced,
        remaining: spAmt - totalInvoiced,
        linkedCount: linkedInvs.length,
        suggestions: suggestions.sort((a, b) => b.score - a.score),
      });
    }
  }

  return results;
}
