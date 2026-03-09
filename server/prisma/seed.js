import { PrismaClient } from '@prisma/client';
import crypto from 'node:crypto';

const prisma = new PrismaClient();

function seedEncrypt(plaintext) {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) return null;
  const key = Buffer.from(hex, 'hex');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv, { authTagLength: 16 });
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

async function main() {
  // --- Permissions ---
  const permissionKeys = [
    { key: 'invoices.view_all',       description: 'See invoices submitted by any user' },
    { key: 'invoices.view_own',       description: 'See only invoices you submitted' },
    { key: 'invoices.upload',         description: 'Upload and process new invoice files' },
    { key: 'invoices.delete',         description: 'Delete invoices that are still pending' },
    { key: 'invoices.approve',        description: 'Approve or reject pending invoices' },
    { key: 'invoices.assign_all',     description: 'Link any invoice to any spend approval' },
    { key: 'invoices.assign_own',     description: 'Link own invoices to own spend approvals only' },
    { key: 'spend.create',            description: 'Submit new spend approval requests' },
    { key: 'spend.approve',           description: 'Approve or reject spend requests' },
    { key: 'spend.view_all',          description: 'See spend approvals from any user' },
    { key: 'spend.view_own',          description: 'See only spend approvals you submitted' },
    { key: 'spend.view_dept',         description: 'See spend approvals in departments you manage' },
    { key: 'reports.view',             description: 'Access the reports dashboard and view charts' },
    { key: 'reports.export',           description: 'Export report data to CSV' },
    { key: 'settings.manage_users',   description: 'Invite, remove, and change user roles' },
    { key: 'settings.view_lookups',   description: 'Access the settings area and view lookup tables' },
    { key: 'settings.manage_lookups', description: 'Add, edit, and deactivate lookup values' },
    { key: 'budget.manage_all',      description: 'Create, edit, and submit budgets for any function/department' },
    { key: 'budget.manage_own',      description: 'Create, edit, and submit budgets for functions where you are the approver' },
  ];

  const permissions = {};
  for (const p of permissionKeys) {
    const perm = await prisma.permission.upsert({
      where: { key: p.key },
      update: { description: p.description },
      create: p,
    });
    permissions[p.key] = perm;
  }

  // --- Roles ---
  const roleDefinitions = [
    {
      name: 'Admin',
      isDefault: true,
      permissions: ['invoices.view_all','invoices.upload','invoices.delete','invoices.approve','invoices.assign_all','spend.create','spend.approve','spend.view_all','reports.view','reports.export','settings.manage_users','settings.view_lookups','settings.manage_lookups','budget.manage_all'],
    },
    {
      name: 'Finance',
      isDefault: true,
      permissions: ['invoices.view_all','invoices.upload','invoices.delete','invoices.approve','invoices.assign_all','spend.create','spend.approve','spend.view_all','reports.view','reports.export','settings.view_lookups','budget.manage_all'],
    },
    {
      name: 'Approver',
      isDefault: true,
      permissions: ['invoices.view_own','invoices.approve','invoices.assign_own','spend.create','spend.approve','spend.view_dept','reports.view','budget.manage_own'],
    },
    {
      name: 'User',
      isDefault: true,
      permissions: ['invoices.view_own','invoices.assign_own','spend.create','spend.view_own'],
    },
  ];

  const roles = {};
  for (const rd of roleDefinitions) {
    const role = await prisma.role.upsert({
      where: { name: rd.name },
      update: { isDefault: rd.isDefault },
      create: { name: rd.name, isDefault: rd.isDefault },
    });
    roles[rd.name] = role;

    // Clear existing permissions for this role and re-add
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    for (const permKey of rd.permissions) {
      await prisma.rolePermission.create({
        data: { roleId: role.id, permissionId: permissions[permKey].id },
      });
    }
  }

  // --- Users ---
  const users = [
    { name: 'John Doe',        email: 'john.doe@company.com',        roleId: roles['Admin'].id,    status: 'Active', approvalLimit: 0,     isCeo: true,  invitedBy: 'System',   createdAt: new Date('2024-01-15T10:30:00Z') },
    { name: 'Jane Smith',      email: 'jane.smith@company.com',      roleId: roles['Finance'].id,  status: 'Active', approvalLimit: 25000, isCeo: false, invitedBy: 'John Doe', createdAt: new Date('2024-02-01T14:20:00Z') },
    { name: 'Bob Johnson',     email: 'bob.johnson@company.com',     roleId: roles['Approver'].id, status: 'Active', approvalLimit: 10000, isCeo: false, invitedBy: 'John Doe', createdAt: new Date('2024-02-10T09:15:00Z') },
    { name: 'Alice Williams',  email: 'alice.williams@company.com',  roleId: roles['User'].id,     status: 'Active', approvalLimit: 0,     isCeo: false, invitedBy: 'John Doe', createdAt: new Date('2024-02-12T11:00:00Z') },
  ];

  const createdUsers = {};
  for (const u of users) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, roleId: u.roleId, status: u.status, approvalLimit: u.approvalLimit, isCeo: u.isCeo },
      create: u,
    });
    createdUsers[u.name] = user;
  }

  // --- Atoms ---
  const atoms = [
    { code: 'ENG', name: 'Engineering' },
    { code: 'PRD', name: 'Product' },
    { code: 'OPS', name: 'Operations' },
    { code: 'SAL', name: 'Sales' },
    { code: 'MKT', name: 'Marketing' },
  ];
  for (const a of atoms) {
    await prisma.atom.upsert({ where: { code: a.code }, update: { name: a.name }, create: a });
  }

  // --- Cost Centres ---
  const costCentres = [
    { code: 'CC100', name: 'General' },
    { code: 'CC200', name: 'Engineering' },
    { code: 'CC300', name: 'Sales' },
    { code: 'CC400', name: 'Marketing' },
    { code: 'CC500', name: 'Operations' },
  ];
  for (const cc of costCentres) {
    await prisma.costCentre.upsert({ where: { code: cc.code }, update: { name: cc.name }, create: cc });
  }

  // --- Regions ---
  const regions = [
    { code: 'UK',   name: 'United Kingdom' },
    { code: 'US',   name: 'United States' },
    { code: 'EU',   name: 'Europe' },
    { code: 'APAC', name: 'Asia Pacific' },
    { code: 'MEA',  name: 'Middle East & Africa' },
  ];
  for (const r of regions) {
    await prisma.region.upsert({ where: { code: r.code }, update: { name: r.name }, create: r });
  }

  // --- Currencies ---
  const currencies = [
    { code: 'GBP', name: 'British Pound',  exchangeRateToEur: 1.17 },
    { code: 'USD', name: 'US Dollar',      exchangeRateToEur: 0.92 },
    { code: 'EUR', name: 'Euro',           exchangeRateToEur: 1.0 },
  ];
  for (const c of currencies) {
    await prisma.currency.upsert({ where: { code: c.code }, update: { name: c.name, exchangeRateToEur: c.exchangeRateToEur }, create: c });
  }

  // --- Spend Categories ---
  const categories = [
    { name: 'Software' },
    { name: 'Hardware' },
    { name: 'Professional Services' },
    { name: 'Travel' },
    { name: 'Marketing' },
    { name: 'Other' },
  ];
  for (const cat of categories) {
    await prisma.spendCategory.upsert({ where: { name: cat.name }, update: {}, create: cat });
  }

  // --- Functions ---
  const functions = [
    { name: 'Engineering',       approverId: createdUsers['Bob Johnson'].id },
    { name: 'Finance & Legal',   approverId: createdUsers['Jane Smith'].id },
    { name: 'Sales & Marketing', approverId: createdUsers['Bob Johnson'].id },
    { name: 'Operations',        approverId: createdUsers['Jane Smith'].id },
  ];
  for (const f of functions) {
    await prisma.function.upsert({ where: { name: f.name }, update: { approverId: f.approverId }, create: f });
  }

  // --- Projects ---
  const projects = [
    { name: 'Project Alpha',   description: 'Core platform rebuild',         active: true },
    { name: 'Project Beta',    description: 'Mobile app development',        active: true },
    { name: 'Project Gamma',   description: 'Data migration initiative',     active: true },
    { name: 'Project Delta',   description: 'Security compliance upgrade',   active: true },
    { name: 'Project Epsilon', description: 'Customer portal redesign',      active: false },
  ];
  for (const p of projects) {
    await prisma.project.upsert({ where: { name: p.name }, update: { description: p.description, active: p.active }, create: p });
  }

  // --- Email Templates ---
  const emailTemplates = [
    {
      key: 'new_spend_approval',
      name: 'New Spend Approval — Notify Approver',
      subject: 'New Spend Approval Request: {{spend_ref}} — {{spend_title}}',
      body: 'Dear {{approver_name}},\n\nA new spend approval request has been submitted and requires your review.\n\nReference: {{spend_ref}}\nTitle: {{spend_title}}\nVendor: {{vendor}}\nAmount: {{currency}} {{amount}}\nSubmitted by: {{submitted_by}}\nDate submitted: {{submitted_date}}\n\nPlease log in to review and action this request.\n\nThank you.',
    },
    {
      key: 'spend_approval_changed',
      name: 'Spend Approval Updated — Notify Approver',
      subject: 'Spend Approval Updated: {{spend_ref}} — {{spend_title}}',
      body: 'Dear {{approver_name}},\n\nA spend approval you are assigned to review has been updated.\n\nReference: {{spend_ref}}\nTitle: {{spend_title}}\nVendor: {{vendor}}\nAmount: {{currency}} {{amount}}\nUpdated by: {{updated_by}}\nDate updated: {{updated_date}}\n\nPlease log in to review the changes.\n\nThank you.',
    },
    {
      key: 'spend_approval_decision',
      name: 'Spend Approval Decision — Notify Submitter',
      subject: 'Spend Approval {{decision}}: {{spend_ref}} — {{spend_title}}',
      body: 'Dear {{submitted_by}},\n\nYour spend approval request has been {{decision}}.\n\nReference: {{spend_ref}}\nTitle: {{spend_title}}\nVendor: {{vendor}}\nAmount: {{currency}} {{amount}}\nDecision: {{decision}}\nDecision date: {{decision_date}}\nDecided by: {{approver_name}}\n\nPlease log in to view the full details.\n\nThank you.',
    },
    {
      key: 'spend_limit_alert',
      name: 'Spend Limit Alert — Threshold Reached',
      subject: 'Spend Alert: {{spend_ref}} has reached {{threshold}} of approved amount',
      body: 'Dear {{approver_name}},\n\nThe spend approval {{spend_ref}} — "{{spend_title}}" has reached {{threshold}} of its approved amount.\n\nReference: {{spend_ref}}\nTitle: {{spend_title}}\nDepartment: {{department}}\nApproved amount: {{currency}} {{approved_amount}}\nTotal invoiced: {{currency}} {{total_invoiced}}\nThreshold: {{threshold}}\n\nPlease log in to review the linked invoices.\n\nThank you.',
    },
    {
      key: 'user_invited',
      name: 'User Invited — Welcome Notification',
      subject: 'You have been invited to SpendGuard',
      body: 'Dear {{user_name}},\n\nYou have been invited to SpendGuard by {{invited_by}}.\n\nRole: {{role_name}}\n\nYou can sign in using your Microsoft account. No additional registration is required.\n\nThank you.',
    },
  ];
  for (const t of emailTemplates) {
    await prisma.emailTemplate.upsert({ where: { key: t.key }, update: { name: t.name, subject: t.subject, body: t.body }, create: t });
  }

  // --- Spend Approvals ---
  const spendApprovals = [
    { ref: 'SA-0001-ENG-CC200-UK', department: 'Engineering',       title: 'Adobe Creative Cloud License',    currency: 'GBP', amount: 2400,  category: 'Software',              vendor: 'Adobe Inc.',            costCentre: 'CC200', atom: 'ENG', region: 'UK', project: 'Project Alpha', approverId: createdUsers['Bob Johnson'].id, status: 'Approved', submittedBy: 'Jane Smith',  submittedAt: new Date('2025-01-15T10:30:00Z'), exceptional: 'No',  timeSensitive: false, justification: '10 seat renewal.' },
    { ref: 'SA-0002-ENG-CC200-US', department: 'Engineering',       title: 'AWS Infrastructure Q2',           currency: 'USD', amount: 15000, category: 'Software',              vendor: 'Amazon Web Services',   costCentre: 'CC200', atom: 'ENG', region: 'US', project: 'Project Alpha', approverId: createdUsers['Bob Johnson'].id, status: 'Pending',  submittedBy: 'John Doe',   submittedAt: new Date('2025-02-01T14:20:00Z'), exceptional: 'No',  timeSensitive: true,  justification: 'March launch infra.' },
    { ref: 'SA-0003-MKT-CC400-EU', department: 'Sales & Marketing', title: 'Marketing Conference Travel',     currency: 'GBP', amount: 3500,  category: 'Travel',                vendor: 'Booking.com',           costCentre: 'CC400', atom: 'MKT', region: 'EU', project: 'Project Beta',  approverId: createdUsers['Bob Johnson'].id, status: 'Approved', submittedBy: 'Jane Smith',  submittedAt: new Date('2025-02-10T09:15:00Z'), exceptional: 'No',  timeSensitive: false, justification: 'SaaStr Europa.' },
    { ref: 'SA-0004-OPS-CC100-UK', department: 'Finance & Legal',   title: 'Legal Consultation - Acquisition',currency: 'GBP', amount: 25000, category: 'Professional Services', vendor: 'Clifford Chance LLP',   costCentre: 'CC100', atom: 'OPS', region: 'UK', project: 'Project Gamma', approverId: createdUsers['John Doe'].id,    status: 'Rejected', submittedBy: 'Jane Smith',  submittedAt: new Date('2025-01-28T11:00:00Z'), exceptional: 'Yes', timeSensitive: true,  justification: 'DD legal review.' },
    { ref: 'SA-0005-OPS-CC500-UK', department: 'Operations',        title: 'Office Equipment Refresh',        currency: 'GBP', amount: 8500,  category: 'Hardware',              vendor: 'Dell Technologies',     costCentre: 'CC500', atom: 'OPS', region: 'UK', project: 'Project Delta', approverId: createdUsers['Bob Johnson'].id, status: 'Approved', submittedBy: 'John Doe',   submittedAt: new Date('2025-01-20T16:45:00Z'), exceptional: 'No',  timeSensitive: false, justification: 'Laptop refresh.' },
    { ref: 'SA-0006-ENG-CC200-US', department: 'Engineering',       title: 'GCP Cloud Hosting Q1',            currency: 'USD', amount: 12000, category: 'Software',              vendor: 'Google Cloud Platform', costCentre: 'CC200', atom: 'ENG', region: 'US', project: 'Project Alpha', approverId: createdUsers['Bob Johnson'].id, status: 'Approved', submittedBy: 'John Doe',   submittedAt: new Date('2025-01-10T09:00:00Z'), exceptional: 'No',  timeSensitive: false, justification: 'GCP Q1.' },
  ];

  const createdSpends = {};
  for (const sa of spendApprovals) {
    const spend = await prisma.spendApproval.upsert({
      where: { ref: sa.ref },
      update: { status: sa.status, approverId: sa.approverId },
      create: sa,
    });
    createdSpends[sa.ref] = spend;
  }

  // --- Invoices ---
  const invoiceData = [
    { invoiceNumber: 'INV-2001', vendor: 'Adobe Inc.',             date: '2025-02-01', dueDate: '2025-03-01', amount: 2350.00, taxAmount: 470.00,  department: 'Engineering',     description: 'CC license renewal',                       submittedBy: 'Jane Smith', submittedDate: new Date('2025-02-01T10:00:00Z'), fileName: 'INV-2001.pdf', spendApprovalId: null },
    { invoiceNumber: 'INV-2002', vendor: 'Dell Technologies',      date: '2025-02-05', dueDate: '2025-03-05', amount: 8200.00, taxAmount: 1640.00, department: 'Operations',      description: 'Laptop refresh x8',                        submittedBy: 'John Doe',  submittedDate: new Date('2025-02-05T14:00:00Z'), fileName: 'INV-2002.pdf', spendApprovalId: null },
    { invoiceNumber: 'INV-2003', vendor: 'Dell Technologies',      date: '2025-02-08', dueDate: '2025-03-08', amount: 1025.00, taxAmount: 205.00,  department: 'Operations',      description: 'Laptop refresh x1',                        submittedBy: 'John Doe',  submittedDate: new Date('2025-02-08T09:30:00Z'), fileName: 'INV-2003.pdf', spendApprovalId: null },
    { invoiceNumber: 'INV-2004', vendor: 'Clifford Chance',        date: '2025-02-10', dueDate: '2025-03-10', amount: 12500.00,taxAmount: 2500.00, department: 'Finance & Legal', description: 'Legal consult phase 1',                    submittedBy: 'Jane Smith', submittedDate: new Date('2025-02-10T16:00:00Z'), fileName: 'INV-2004.pdf', spendApprovalId: null },
    { invoiceNumber: 'INV-2005', vendor: 'Amazon Web Services',    date: '2025-02-12', dueDate: '2025-03-12', amount: 14800.00,taxAmount: 2960.00, department: 'Engineering',     description: 'AWS Q1 infra',                             submittedBy: 'John Doe',  submittedDate: new Date('2025-02-12T08:00:00Z'), fileName: 'INV-2005.pdf', spendApprovalId: null },
    { invoiceNumber: 'INV-2006', vendor: 'Google Cloud Platform',  date: '2025-01-28', dueDate: '2025-02-28', amount: 11800.00,taxAmount: 2360.00, department: 'Engineering',     description: 'GCP Q1 - Ref: SA-0006-ENG-CC200-US',      submittedBy: 'John Doe',  submittedDate: new Date('2025-01-28T11:00:00Z'), fileName: 'INV-2006.pdf', spendApprovalId: createdSpends['SA-0006-ENG-CC200-US'].id },
  ];

  for (const inv of invoiceData) {
    await prisma.invoice.upsert({
      where: { id: invoiceData.indexOf(inv) + 9001 },
      update: {},
      create: { id: invoiceData.indexOf(inv) + 9001, ...inv },
    });
  }

  // --- Budgets ---
  const createdFunctions = {};
  const allFunctions = await prisma.function.findMany();
  for (const f of allFunctions) { createdFunctions[f.name] = f; }

  const engBudget = await prisma.budget.create({
    data: { title: 'Engineering FY2026 Budget', year: 2026, functionId: createdFunctions['Engineering'].id, createdById: createdUsers['Bob Johnson'].id, status: 'Submitted', submittedAt: new Date('2026-01-15T09:00:00Z') },
  });
  const opsBudget = await prisma.budget.create({
    data: { title: 'Operations FY2026 Budget', year: 2026, functionId: createdFunctions['Operations'].id, createdById: createdUsers['Jane Smith'].id, status: 'Submitted', submittedAt: new Date('2026-01-20T10:00:00Z') },
  });
  const mktBudget = await prisma.budget.create({
    data: { title: 'Sales & Marketing FY2026 Budget', year: 2026, functionId: createdFunctions['Sales & Marketing'].id, createdById: createdUsers['Bob Johnson'].id, status: 'Draft' },
  });

  // --- Budget Line Items ---
  const budgetLineItems = [
    { budgetId: engBudget.id, type: 'BAU', businessUnit: 'Engineering', serviceCategory: 'Licenses / Software', licence: 'Adobe Creative Cloud Enterprise', costCentre: 'CC200', region: 'UK', vendor: 'Adobe Inc.', contractEndDate: '01/07/2026', contractValue: 2400, currency: 'GBP', eurAnnual: 2760, monthlyBudget: { Jan: 230, Feb: 230, Mar: 230, Apr: 230, May: 230, Jun: 230, Jul: 230, Aug: 230, Sep: 230, Oct: 230, Nov: 230, Dec: 230 }, spendApprovalId: createdSpends['SA-0001-ENG-CC200-UK'].id },
    { budgetId: engBudget.id, type: 'BAU', businessUnit: 'Engineering', serviceCategory: 'Licenses / Software', licence: 'AWS Reserved Instances', costCentre: 'CC200', region: 'US', vendor: 'Amazon Web Services', contractEndDate: '31/12/2026', contractValue: 15000, currency: 'USD', eurAnnual: 12750, monthlyBudget: { Jan: 1062.5, Feb: 1062.5, Mar: 1062.5, Apr: 1062.5, May: 1062.5, Jun: 1062.5, Jul: 1062.5, Aug: 1062.5, Sep: 1062.5, Oct: 1062.5, Nov: 1062.5, Dec: 1062.5 }, spendApprovalId: createdSpends['SA-0002-ENG-CC200-US'].id },
    { budgetId: engBudget.id, type: 'BAU', businessUnit: 'Engineering', serviceCategory: 'Licenses / Software', licence: 'AWS CloudWatch Monitoring', costCentre: 'CC200', region: 'US', vendor: 'Amazon Web Services', contractEndDate: '31/12/2026', contractValue: 3600, currency: 'USD', eurAnnual: 3060, monthlyBudget: { Jan: 255, Feb: 255, Mar: 255, Apr: 255, May: 255, Jun: 255, Jul: 255, Aug: 255, Sep: 255, Oct: 255, Nov: 255, Dec: 255 }, spendApprovalId: createdSpends['SA-0002-ENG-CC200-US'].id },
    { budgetId: engBudget.id, type: 'BAU', businessUnit: 'Engineering', serviceCategory: 'Licenses / Software', licence: 'GCP Compute Engine', costCentre: 'CC200', region: 'US', vendor: 'Google Cloud Platform', contractEndDate: '31/12/2026', contractValue: 10000, currency: 'USD', eurAnnual: 8500, monthlyBudget: { Jan: 708.33, Feb: 708.33, Mar: 708.33, Apr: 708.33, May: 708.33, Jun: 708.33, Jul: 708.33, Aug: 708.33, Sep: 708.33, Oct: 708.33, Nov: 708.33, Dec: 708.33 }, spendApprovalId: createdSpends['SA-0006-ENG-CC200-US'].id },
    { budgetId: engBudget.id, type: 'New', businessUnit: 'Engineering', serviceCategory: 'Licenses / Software', licence: 'GCP BigQuery Analytics', costCentre: 'CC200', region: 'US', vendor: 'Google Cloud Platform', contractEndDate: '31/12/2026', contractValue: 4800, currency: 'USD', eurAnnual: 4080, monthlyBudget: { Jan: 340, Feb: 340, Mar: 340, Apr: 340, May: 340, Jun: 340, Jul: 340, Aug: 340, Sep: 340, Oct: 340, Nov: 340, Dec: 340 }, spendApprovalId: createdSpends['SA-0006-ENG-CC200-US'].id },
    { budgetId: engBudget.id, type: 'BAU', businessUnit: 'Engineering', serviceCategory: 'Licenses / Software', licence: 'GitHub Enterprise', costCentre: 'CC200', region: 'UK', vendor: 'GitHub', contractEndDate: '31/03/2026', contractValue: 6000, currency: 'USD', eurAnnual: 5100, monthlyBudget: { Jan: 425, Feb: 425, Mar: 425, Apr: 425, May: 425, Jun: 425, Jul: 425, Aug: 425, Sep: 425, Oct: 425, Nov: 425, Dec: 425 }, spendApprovalId: null },
    { budgetId: opsBudget.id, type: 'BAU', businessUnit: 'Operations', serviceCategory: 'Hardware / Equipment', licence: 'Dell Laptop Replacement Programme', costCentre: 'CC500', region: 'UK', vendor: 'Dell Technologies', contractEndDate: '31/12/2026', contractValue: 8500, currency: 'GBP', eurAnnual: 9775, monthlyBudget: { Jan: 814.58, Feb: 814.58, Mar: 814.58, Apr: 814.58, May: 814.58, Jun: 814.58, Jul: 814.58, Aug: 814.58, Sep: 814.58, Oct: 814.58, Nov: 814.58, Dec: 814.58 }, spendApprovalId: createdSpends['SA-0005-OPS-CC500-UK'].id },
    { budgetId: opsBudget.id, type: 'New', businessUnit: 'Operations', serviceCategory: 'Service / Support', licence: 'Managed IT Support Contract', costCentre: 'CC500', region: 'UK', vendor: 'Atera', contractEndDate: '31/12/2026', contractValue: 12000, currency: 'GBP', eurAnnual: 13800, monthlyBudget: { Jan: 1150, Feb: 1150, Mar: 1150, Apr: 1150, May: 1150, Jun: 1150, Jul: 1150, Aug: 1150, Sep: 1150, Oct: 1150, Nov: 1150, Dec: 1150 }, spendApprovalId: null },
    { budgetId: mktBudget.id, type: 'BAU', businessUnit: 'Sales & Marketing', serviceCategory: 'Other', licence: 'Conference & Event Travel Budget', costCentre: 'CC400', region: 'EU', vendor: 'Various', contractEndDate: '31/12/2026', contractValue: 5000, currency: 'EUR', eurAnnual: 5000, monthlyBudget: { Jan: 416.67, Feb: 416.67, Mar: 416.67, Apr: 416.67, May: 416.67, Jun: 416.67, Jul: 416.67, Aug: 416.67, Sep: 416.67, Oct: 416.67, Nov: 416.67, Dec: 416.67 }, spendApprovalId: createdSpends['SA-0003-MKT-CC400-EU'].id },
  ];

  for (const bl of budgetLineItems) {
    await prisma.budgetLineItem.create({ data: bl });
  }

  // --- Anthropic API Key (from env) ---
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    const encryptedValue = seedEncrypt(apiKey);
    if (encryptedValue) {
      await prisma.appSetting.upsert({
        where: { key: 'anthropic_api_key' },
        update: { value: encryptedValue, encrypted: true, updatedBy: 'seed' },
        create: { key: 'anthropic_api_key', value: encryptedValue, encrypted: true, updatedBy: 'seed' },
      });
      console.log('Anthropic API key seeded from ANTHROPIC_API_KEY env var.');
    }
  }

  console.log('Seed data created successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
