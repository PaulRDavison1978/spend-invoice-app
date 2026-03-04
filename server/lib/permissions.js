export const PERMISSIONS = {
  invoices: {
    label: 'Invoices',
    permissions: {
      'invoices.view_all':   { label: 'View all invoices',       description: 'See invoices submitted by any user' },
      'invoices.view_own':   { label: 'View own invoices',       description: 'See only invoices you submitted' },
      'invoices.upload':     { label: 'Upload invoices',         description: 'Upload and process new invoice files' },
      'invoices.delete':     { label: 'Delete pending invoices', description: 'Delete invoices that are still pending' },
      'invoices.approve':    { label: 'Approve/reject invoices', description: 'Approve or reject pending invoices' },
      'invoices.assign_all': { label: 'Assign any invoice',      description: 'Link any invoice to any spend approval' },
      'invoices.assign_own': { label: 'Assign own invoices',     description: 'Link own invoices to own spend approvals only' },
    }
  },
  spend: {
    label: 'Spend Approvals',
    permissions: {
      'spend.create':    { label: 'Create spend approvals',          description: 'Submit new spend approval requests' },
      'spend.approve':   { label: 'Approve/reject spend approvals',  description: 'Approve or reject spend requests' },
      'spend.view_all':  { label: 'View all spend approvals',        description: 'See spend approvals from any user' },
      'spend.view_own':  { label: 'View own spend approvals',        description: 'See only spend approvals you submitted' },
      'spend.view_dept': { label: 'View department spend approvals', description: 'See spend approvals in departments you manage' },
    }
  },
  settings: {
    label: 'Settings & Administration',
    permissions: {
      'settings.manage_users':   { label: 'Manage users',            description: 'Invite, remove, and change user roles' },
      'settings.view_lookups':   { label: 'View settings & lookups', description: 'Access the settings area and view lookup tables' },
      'settings.manage_lookups': { label: 'Manage lookups',          description: 'Add, edit, and deactivate lookup values' },
    }
  }
};

// Flat list of all permission keys
export const ALL_PERMISSION_KEYS = Object.values(PERMISSIONS)
  .flatMap(group => Object.keys(group.permissions));
