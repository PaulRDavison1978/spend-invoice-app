import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
    { key: 'settings.manage_users',   description: 'Invite, remove, and change user roles' },
    { key: 'settings.view_lookups',   description: 'Access the settings area and view lookup tables' },
    { key: 'settings.manage_lookups', description: 'Add, edit, and deactivate lookup values' },
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
      permissions: ['invoices.view_all','invoices.upload','invoices.delete','invoices.approve','invoices.assign_all','spend.create','spend.approve','spend.view_all','settings.manage_users','settings.view_lookups','settings.manage_lookups'],
    },
    {
      name: 'Finance',
      isDefault: true,
      permissions: ['invoices.view_all','invoices.upload','invoices.delete','invoices.approve','invoices.assign_all','spend.create','spend.approve','spend.view_all','settings.view_lookups'],
    },
    {
      name: 'Approver',
      isDefault: true,
      permissions: ['invoices.view_own','invoices.approve','invoices.assign_own','spend.create','spend.approve','spend.view_dept'],
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
