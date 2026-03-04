import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useMsal, useIsAuthenticated } from '@azure/msal-react';
import { InteractionRequiredAuthError } from '@azure/msal-browser';
import { Upload, FileText, CheckCircle, XCircle, X, Download, ExternalLink, AlertCircle, LogOut, User, Trash2,  Settings, Home, DollarSign, ArrowRight, ChevronDown, ChevronUp, Lock, Plus, Shield, Mail } from 'lucide-react';
import { loginRequest } from './authConfig.js';
import { api, setTokenAcquirer } from './api/client.js';

const PERMISSIONS = {
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
      'spend.create':   { label: 'Create spend approvals',          description: 'Submit new spend approval requests' },
      'spend.approve':  { label: 'Approve/reject spend approvals',  description: 'Approve or reject spend requests' },
      'spend.view_all': { label: 'View all spend approvals',        description: 'See spend approvals from any user' },
      'spend.view_own': { label: 'View own spend approvals',        description: 'See only spend approvals you submitted' },
      'spend.view_dept':{ label: 'View department spend approvals', description: 'See spend approvals in departments you manage' },
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

const defaultRoles = [
  { id:'admin',    name:'Admin',    isDefault:true, permissions:['invoices.view_all','invoices.upload','invoices.delete','invoices.approve','invoices.assign_all','spend.create','spend.approve','spend.view_all','settings.manage_users','settings.view_lookups','settings.manage_lookups'] },
  { id:'finance',  name:'Finance',  isDefault:true, permissions:['invoices.view_all','invoices.upload','invoices.delete','invoices.approve','invoices.assign_all','spend.create','spend.approve','spend.view_all','settings.view_lookups'] },
  { id:'approver', name:'Approver', isDefault:true, permissions:['invoices.view_own','invoices.approve','invoices.assign_own','spend.create','spend.approve','spend.view_dept'] },
  { id:'user',     name:'User',     isDefault:true, permissions:['invoices.view_own','invoices.assign_own','spend.create','spend.view_own'] },
];

const usePersistedState = (key, defaultValue) => {
  const keyRef = useRef(key);
  const read = (k) => { try { const s = localStorage.getItem(k); return s ? JSON.parse(s) : defaultValue; } catch { return defaultValue; } };
  const [state, setState] = useState(() => read(key));
  useEffect(() => {
    if (key !== keyRef.current) {
      keyRef.current = key;
      setState(read(key));
    }
  }, [key]);
  const setPersistedState = useCallback((valOrFn) => {
    setState(prev => {
      const next = typeof valOrFn === 'function' ? valOrFn(prev) : valOrFn;
      localStorage.setItem(keyRef.current, JSON.stringify(next));
      return next;
    });
  }, []);
  return [state, setPersistedState];
};

const InvoiceWorkflowApp = () => { const _i = "px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";
const _g = "px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500";
const _th = "px-4 py-3 text-sm font-semibold text-gray-700";
const _td = "px-4 py-3 text-sm text-gray-600";
const _lb = "block text-sm font-medium text-gray-700 mb-1";
const _pg = "min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6";
const _cd = "bg-white rounded-lg shadow-lg p-6";
const _h2 = "text-xl font-bold text-gray-800 mb-4";
const _fx = "flex items-center space-x-2";
const _fj = "flex items-center justify-between";
const { instance: msalInstance, accounts } = useMsal();
const isMsalAuthenticated = useIsAuthenticated();
const [user, setUser] = useState(null);
const [userPermissions, setUserPermissions] = useState([]);
const [isAuthenticating, setIsAuthenticating] = useState(false);
const [authStep, setAuthStep] = useState('email');
const [authEmail, setAuthEmail] = useState('');
const [authOtp, setAuthOtp] = useState('');
const [authOtpError, setAuthOtpError] = useState('');
const [generatedOtp, setGeneratedOtp] = useState('');
const [otpExpiry, setOtpExpiry] = useState(null);
const [dataLoaded, setDataLoaded] = useState(false);

// Set up token acquirer for API client
const acquireToken = useCallback(async () => {
  if (accounts.length === 0) return null;
  try {
    const response = await msalInstance.acquireTokenSilent({ ...loginRequest, account: accounts[0] });
    return response.accessToken;
  } catch (err) {
    if (err instanceof InteractionRequiredAuthError) {
      const response = await msalInstance.acquireTokenPopup(loginRequest);
      return response.accessToken;
    }
    throw err;
  }
}, [msalInstance, accounts]);

useEffect(() => {
  setTokenAcquirer(acquireToken);
}, [acquireToken]);

// MSAL login handler
const msalLogin = async () => {
  try {
    setIsAuthenticating(true);
    const loginResponse = await msalInstance.loginPopup(loginRequest);
    const account = loginResponse.account;
    const idTokenClaims = account.idTokenClaims || {};

    // Call backend to activate/link user
    const token = loginResponse.accessToken;
    const API_BASE = import.meta.env.VITE_API_URL || '';
    const resp = await fetch(`${API_BASE}/api/auth/callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        email: account.username,
        oid: idTokenClaims.oid,
        tid: idTokenClaims.tid,
        name: account.name,
      }),
    });
    const userData = await resp.json();
    if (!resp.ok) {
      alert(userData.error || 'Login failed');
      setIsAuthenticating(false);
      return;
    }
    setUser({ name: userData.name, email: userData.email, id: userData.id, role: userData.role, approvalLimit: userData.approvalLimit || 0, isCeo: userData.isCeo || false });
    setUserPermissions(userData.permissions || []);
    setIsAuthenticating(false);
  } catch (err) {
    console.error('MSAL login error:', err);
    setIsAuthenticating(false);
  }
};

// Load all data from API when user is authenticated
const loadData = useCallback(async () => {
  if (!user) return;
  try {
    const [invoicesData, spendsData, usersData, rolesData, lookupsData, templatesData] = await Promise.all([
      api.get('/api/invoices'),
      api.get('/api/spend-approvals'),
      api.get('/api/users'),
      api.get('/api/roles'),
      Promise.all([
        api.get('/api/lookups/atoms'),
        api.get('/api/lookups/cost-centres'),
        api.get('/api/lookups/regions'),
        api.get('/api/lookups/currencies'),
        api.get('/api/lookups/categories'),
        api.get('/api/lookups/functions'),
        api.get('/api/lookups/projects'),
      ]),
      api.get('/api/email-templates'),
    ]);

    // Transform invoice data for frontend compatibility
    setInvoices(invoicesData.map(inv => ({
      ...inv,
      amount: String(inv.amount),
      taxAmount: String(inv.taxAmount),
      spendApprovalTitle: inv.spendApproval?.title || null,
      spendApprovalId: inv.spendApproval?.id || inv.spendApprovalId || null,
    })));

    // Transform spend approval data
    setSpendApprovals(spendsData.map(sp => ({
      ...sp,
      amount: String(sp.amount),
      approver: sp.approver?.name || '',
      submittedAt: sp.submittedAt,
    })));

    // Transform users for frontend compatibility
    setMockUsers(usersData.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role?.name || 'User',
      status: u.status,
      createdAt: u.createdAt,
      invitedBy: u.invitedBy,
      approvalLimit: Number(u.approvalLimit) || 0,
      isCeo: u.isCeo,
    })));

    setRoles(rolesData);

    const [atomsData, costCentresData, regionsData, currenciesData, categoriesData, functionsData, projectsData] = lookupsData;
    setAtoms(atomsData);
    setCostCentres(costCentresData);
    setRegions(regionsData);
    setCurrencies(currenciesData);
    setCategories(categoriesData);
    setFunctions(functionsData.map(f => ({ ...f, approver: f.approver?.name || '' })));
    setProjects(projectsData);
    setEmailTemplates(templatesData);

    setDataLoaded(true);
  } catch (err) {
    console.error('Failed to load data:', err);
  }
}, [user]);

useEffect(() => {
  if (user && !dataLoaded) loadData();
}, [user, dataLoaded, loadData]);
const defaultInvoices = [
{ id:9001, invoiceNumber:'INV-2001', vendor:'Adobe Inc.', date:'2025-02-01', dueDate:'2025-03-01', amount:'2350.00', taxAmount:'470.00', department:'Engineering', description:'CC license renewal', submittedDate:'2025-02-01T10:00:00Z', submittedBy:'Jane Smith', lineItems:[], spendApprovalId:null, spendApprovalTitle:null, fileName:'INV-2001.pdf', fileType:'application/pdf' },
{ id:9002, invoiceNumber:'INV-2002', vendor:'Dell Technologies', date:'2025-02-05', dueDate:'2025-03-05', amount:'8200.00', taxAmount:'1640.00', department:'Operations', description:'Laptop refresh x8', submittedDate:'2025-02-05T14:00:00Z', submittedBy:'John Doe', lineItems:[], spendApprovalId:null, spendApprovalTitle:null, fileName:'INV-2002.pdf', fileType:'application/pdf' },
{ id:9003, invoiceNumber:'INV-2003', vendor:'Dell Technologies', date:'2025-02-08', dueDate:'2025-03-08', amount:'1025.00', taxAmount:'205.00', department:'Operations', description:'Laptop refresh x1', submittedDate:'2025-02-08T09:30:00Z', submittedBy:'John Doe', lineItems:[], spendApprovalId:null, spendApprovalTitle:null, fileName:'INV-2003.pdf', fileType:'application/pdf' },
{ id:9004, invoiceNumber:'INV-2004', vendor:'Clifford Chance', date:'2025-02-10', dueDate:'2025-03-10', amount:'12500.00', taxAmount:'2500.00', department:'Finance & Legal', description:'Legal consult phase 1', submittedDate:'2025-02-10T16:00:00Z', submittedBy:'Jane Smith', lineItems:[], spendApprovalId:null, spendApprovalTitle:null, fileName:'INV-2004.pdf', fileType:'application/pdf' },
{ id:9005, invoiceNumber:'INV-2005', vendor:'Amazon Web Services', date:'2025-02-12', dueDate:'2025-03-12', amount:'14800.00', taxAmount:'2960.00', department:'Engineering', description:'AWS Q1 infra', submittedDate:'2025-02-12T08:00:00Z', submittedBy:'John Doe', lineItems:[], spendApprovalId:null, spendApprovalTitle:null, fileName:'INV-2005.pdf', fileType:'application/pdf' },
{ id:9006, invoiceNumber:'INV-2006', vendor:'Google Cloud Platform', date:'2025-01-28', dueDate:'2025-02-28', amount:'11800.00', taxAmount:'2360.00', department:'Engineering', description:'GCP Q1 - Ref: SA-0006-ENG-CC200-US', submittedDate:'2025-01-28T11:00:00Z', submittedBy:'John Doe', lineItems:[], spendApprovalId:6, spendApprovalTitle:'GCP Cloud Hosting Q1', fileName:'INV-2006.pdf', fileType:'application/pdf' },
];
const [invoices, setInvoices] = useState(defaultInvoices);
const [auditLog, setAuditLog] = useState([]);
const [selectedInvoice, setSelectedInvoice] = useState(null);
const [showSuccessNotification, setShowSuccessNotification] = useState(false);
const [notificationMessage, setNotificationMessage] = useState('');
const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
const [deleteConfirmationInput, setDeleteConfirmationInput] = useState('');
const [invoiceToDelete, setInvoiceToDelete] = useState(null);
const [showSettingsPage, setShowSettingsPage] = useState(false);
const [currentPage, setCurrentPage] = useState('landing');
const [settingsTab, setSettingsTab] = useState('users');
const [collapsedLookups, setCollapsedLookups] = useState({});
const toggleLookup = (key) => setCollapsedLookups(prev => ({...prev, [key]: !prev[key]}));
const [atoms, setAtoms] = useState([
{ id:1, code:'ENG', name:'Engineering', active:true },
{ id:2, code:'PRD', name:'Product', active:true },
{ id:3, code:'OPS', name:'Operations', active:true },
{ id:4, code:'SAL', name:'Sales', active:true },
{ id:5, code:'MKT', name:'Marketing', active:true }
]);
const [costCentres, setCostCentres] = useState([
{ id:1, code:'CC100', name:'General', active:true },
{ id:2, code:'CC200', name:'Engineering', active:true },
{ id:3, code:'CC300', name:'Sales', active:true },
{ id:4, code:'CC400', name:'Marketing', active:true },
{ id:5, code:'CC500', name:'Operations', active:true }
]);
const [editAtom, setEditAtom] = useState(null);
const [editCC, setEditCC] = useState(null);
const [editRegion, setEditRegion] = useState(null);
const [editCurrency, setEditCurrency] = useState(null);
const [editCategory, setEditCategory] = useState(null);
const [newAtom, setNewAtom] = useState({ code:'', name:'' });
const [newCC, setNewCC] = useState({ code:'', name:'' });
const [newRegion, setNewRegion] = useState({ code:'', name:'' });
const [newCurrency, setNewCurrency] = useState({ code:'', name:'', exchangeRateToEur:'' });
const [newCategory, setNewCategory] = useState({ name:'' });
const [currencies, setCurrencies] = useState([
{ id:1, code:'GBP', name:'British Pound', exchangeRateToEur:'1.17', active:true },
{ id:2, code:'USD', name:'US Dollar', exchangeRateToEur:'0.92', active:true },
{ id:3, code:'EUR', name:'Euro', exchangeRateToEur:'1', active:true }
]);
const eurRates = Object.fromEntries(currencies.map(c => [c.code, parseFloat(c.exchangeRateToEur) || 1]));
const toEur = (amount, currency) => { const n = parseFloat(amount) || 0; const rate = eurRates[currency] || 1; return n * rate; };
const fmtEur = (amount, currency) => { const converted = toEur(amount, currency); return `€${converted.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}`; };
const currencySymbol = (code) => { const symbols = { USD: '$', EUR: '€', GBP: '£', JPY: '¥', CHF: 'CHF ', CAD: 'C$', AUD: 'A$', SEK: 'kr', NOK: 'kr', DKK: 'kr', PLN: 'zł', CZK: 'Kč', HUF: 'Ft', ZAR: 'R' }; return symbols[(code || '').toUpperCase()] || (code ? code + ' ' : '$'); };
const [categories, setCategories] = useState([
{ id:1, name:'Software', active:true },
{ id:2, name:'Hardware', active:true },
{ id:3, name:'Professional Services', active:true },
{ id:4, name:'Travel', active:true },
{ id:5, name:'Marketing', active:true },
{ id:6, name:'Other', active:true }
]);
const [regions, setRegions] = useState([
{ id:1, code:'UK', name:'United Kingdom', active:true },
{ id:2, code:'US', name:'United States', active:true },
{ id:3, code:'EU', name:'Europe', active:true },
{ id:4, code:'APAC', name:'Asia Pacific', active:true },
{ id:5, code:'MEA', name:'Middle East & Africa', active:true }
]);
const [functions, setFunctions] = useState([
{ id:1, name:'Engineering', approver:'Bob Johnson', active:true },
{ id:2, name:'Finance & Legal', approver:'Jane Smith', active:true },
{ id:3, name:'Sales & Marketing', approver:'Bob Johnson', active:true },
{ id:4, name:'Operations', approver:'Jane Smith', active:true }
]);
const [projects, setProjects] = useState([
{ id:1, name:'Project Alpha', description:'Core platform rebuild', active:true },
{ id:2, name:'Project Beta', description:'Mobile app development', active:true },
{ id:3, name:'Project Gamma', description:'Data migration initiative', active:true },
{ id:4, name:'Project Delta', description:'Security compliance upgrade', active:true },
{ id:5, name:'Project Epsilon', description:'Customer portal redesign', active:false }
]);
const [editProject, setEditProject] = useState(null);
const [newProject, setNewProject] = useState({ name:'', description:'' });
const [editFunction, setEditFunction] = useState(null);
const [newFunction, setNewFunction] = useState({ name:'', approver:'' });
const [showRoleTooltip, setShowRoleTooltip] = useState(false);
const [showInviteModal, setShowInviteModal] = useState(false);
const [inviteEmail, setInviteEmail] = useState('');
const [inviteRole, setInviteRole] = useState('User');
const [showRemoveConfirmation, setShowRemoveConfirmation] = useState(false);
const [userToRemove, setUserToRemove] = useState(null);
const [showGdprModal, setShowGdprModal] = useState(false);
const [showEscalationModal, setShowEscalationModal] = useState(null);
const [userToAnonymize, setUserToAnonymize] = useState(null);
const [gdprConfirmEmail, setGdprConfirmEmail] = useState('');
const [auditSearchTerm, setAuditSearchTerm] = useState('');
const [auditActionFilter, setAuditActionFilter] = useState('all');
const [auditDateFrom, setAuditDateFrom] = useState('');
const [auditDateTo, setAuditDateTo] = useState('');
const [mockUsers, setMockUsers] = useState([
{ id: 1, name: 'John Doe', email: 'john.doe@company.com', role: 'Admin', status: 'Active', createdAt: '2024-01-15T10:30:00Z', invitedBy: 'System', approvalLimit: 0, isCeo: true }, { id: 2, name: 'Jane Smith', email: 'jane.smith@company.com', role: 'Finance', status: 'Active', createdAt: '2024-02-01T14:20:00Z', invitedBy: 'John Doe', approvalLimit: 25000 }, { id: 3, name: 'Bob Johnson', email: 'bob.johnson@company.com', role: 'Approver', status: 'Active', createdAt: '2024-02-10T09:15:00Z', invitedBy: 'John Doe', approvalLimit: 10000 },
{ id: 4, name: 'Alice Williams', email: 'alice.williams@company.com', role: 'User', status: 'Active', createdAt: '2024-02-12T11:00:00Z', invitedBy: 'John Doe', approvalLimit: 0 } ]);
const [roles, setRoles] = useState(defaultRoles);
const [editingRole, setEditingRole] = useState(null);
const [newRoleName, setNewRoleName] = useState('');
const [emailTemplates, setEmailTemplates] = useState([
{ id: 1, key: 'new_spend_approval', name: 'New Spend Approval — Notify Approver', subject: 'New Spend Approval Request: {{spend_ref}} — {{spend_title}}', body: 'Dear {{approver_name}},\n\nA new spend approval request has been submitted and requires your review.\n\nReference: {{spend_ref}}\nTitle: {{spend_title}}\nVendor: {{vendor}}\nAmount: {{currency}} {{amount}}\nSubmitted by: {{submitted_by}}\nDate submitted: {{submitted_date}}\n\nPlease log in to review and action this request.\n\nThank you.', active: true },
{ id: 2, key: 'spend_approval_changed', name: 'Spend Approval Updated — Notify Approver', subject: 'Spend Approval Updated: {{spend_ref}} — {{spend_title}}', body: 'Dear {{approver_name}},\n\nA spend approval you are assigned to review has been updated.\n\nReference: {{spend_ref}}\nTitle: {{spend_title}}\nVendor: {{vendor}}\nAmount: {{currency}} {{amount}}\nUpdated by: {{updated_by}}\nDate updated: {{updated_date}}\n\nPlease log in to review the changes.\n\nThank you.', active: true },
{ id: 3, key: 'spend_approval_decision', name: 'Spend Approval Decision — Notify Submitter', subject: 'Spend Approval {{decision}}: {{spend_ref}} — {{spend_title}}', body: 'Dear {{submitted_by}},\n\nYour spend approval request has been {{decision}}.\n\nReference: {{spend_ref}}\nTitle: {{spend_title}}\nVendor: {{vendor}}\nAmount: {{currency}} {{amount}}\nDecision: {{decision}}\nDecision date: {{decision_date}}\nDecided by: {{approver_name}}\n\nPlease log in to view the full details.\n\nThank you.', active: true },
{ id: 4, key: 'spend_limit_alert', name: 'Spend Approval Limit Alert — Notify Approver', subject: 'Spend Approval {{threshold}} Threshold Reached: {{spend_ref}} — {{spend_title}}', body: 'Dear {{approver_name}},\n\nThe invoiced amount for a spend approval you manage has reached the {{threshold}} threshold.\n\nReference: {{spend_ref}}\nTitle: {{spend_title}}\nVendor: {{vendor}}\nApproved Amount: {{currency}} {{amount}}\nTotal Invoiced: {{invoiced_amount}}\nRemaining: {{remaining_amount}}\n\nPlease log in to review the linked invoices.\n\nThank you.', active: true }
]);
const [editTemplateId, setEditTemplateId] = useState(null);
const [selectedFiles, setSelectedFiles] = useState([]);
const [extractedDataBatch, setExtractedDataBatch] = useState([]);
const [isProcessing, setIsProcessing] = useState(false);
const [processingProgress, setProcessingProgress] = useState({ current: 0, total: 0 });
const [hoveredInvoice, setHoveredInvoice] = useState(null);
const [showColumnSelector, setShowColumnSelector] = useState(false);
const _uk = (s) => `viewPrefs_${user?.email || 'default'}_${s}`;
const [visibleColumns, setVisibleColumns] = usePersistedState(_uk('inv_cols'), { invoiceNumber: true, vendor: true, subtotal: true, tax: true, total: true, spendApproval: true, file: true, date: false, dueDate: false, submittedBy: false });
const [groupBy, setGroupBy] = usePersistedState(_uk('inv_group'), 'none');
const [spendForm, setSpendForm] = useState({ cc:'', title:'', currency:'', approver:'', amount:'', category:'', atom:'', vendor:'', costCentre:'', region:'', project:'', timeSensitive:false, exceptional:'', justification:'', department:'', originInvoiceId: null });
const [spendSubmitted, setSpendSubmitted] = useState(false);
const [spendView, setSpendView] = useState('list');
const [spendAlerts, setSpendAlerts] = useState([]);
const dismissSpendAlert = (alertId) => setSpendAlerts(prev => prev.filter(a => a.id !== alertId));
const [selectedSpend, setSelectedSpend] = useState(null);
const [selectedSpendIds, setSelectedSpendIds] = useState([]);
const [spendSearch, setSpendSearch] = useState('');
const [showSpendFilterPanel, setShowSpendFilterPanel] = useState(false);
const [spendFilters, setSpendFilters] = usePersistedState(_uk('spend_filters'), { status:'all', vendor:'all', category:'all', department:'all', project:'all', dateFrom:'', dateTo:'', amountMin:'', amountMax:'', submittedBy:'all', approver:'all' });
const updateSpendFilter = (k,v) => setSpendFilters(p => ({...p,[k]:v}));
const clearSpendFilters = () => setSpendFilters({ status:'all', vendor:'all', category:'all', project:'all', dateFrom:'', dateTo:'', amountMin:'', amountMax:'', submittedBy:'all', approver:'all' });
const getSpendFilterCount = () => { let c=0; if(spendFilters.status!=='all')c++; if(spendFilters.vendor!=='all')c++; if(spendFilters.category!=='all')c++; if(spendFilters.department!=='all')c++; if(spendFilters.project!=='all')c++; if(spendFilters.dateFrom)c++; if(spendFilters.dateTo)c++; if(spendFilters.amountMin)c++; if(spendFilters.amountMax)c++; if(spendFilters.submittedBy!=='all')c++; if(spendFilters.approver!=='all')c++; return c; };
const [spendGroupBy, setSpendGroupBy] = usePersistedState(_uk('spend_group'), 'none');
const [showSpendColSelector, setShowSpendColSelector] = useState(false);
const [spendVisibleCols, setSpendVisibleCols] = usePersistedState(_uk('spend_cols'), { ref:true, title:true, vendor:true, amount:true, invoiced:true, category:true, department:true, project:true, submittedBy:true, date:true, status:true, approver:true, region:false, costCentre:false, atom:false });
const toggleSpendCol = (col) => setSpendVisibleCols(p => ({...p,[col]:!p[col]}));
const [anthropicApiKey, setAnthropicApiKey] = useState(() => localStorage.getItem('anthropicApiKey') || '');
const [apiKeyTestStatus, setApiKeyTestStatus] = useState(null);
const [apiKeyTestMessage, setApiKeyTestMessage] = useState('');
const [extractionErrors, setExtractionErrors] = useState([]);
const API_BASE = import.meta.env.VITE_API_URL || '';
const saveApiKey = (key) => { setAnthropicApiKey(key); if (key) { localStorage.setItem('anthropicApiKey', key); } else { localStorage.removeItem('anthropicApiKey'); } setApiKeyTestStatus(null); setApiKeyTestMessage(''); };
const testApiKey = async (key) => { if (!key) { setApiKeyTestStatus('error'); setApiKeyTestMessage('Please enter an API key first.'); return; } setApiKeyTestStatus('testing'); setApiKeyTestMessage('Testing API key...'); try { const canvas = document.createElement('canvas'); canvas.width = 1; canvas.height = 1; const dataUrl = canvas.toDataURL('image/png'); const base64 = dataUrl.split(',')[1]; const resp = await fetch(`${API_BASE}/api/extract-invoice`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ file: base64, mediaType: 'image/png', apiKey: key }) }); const result = await resp.json(); if (resp.status === 401 || result.type === 'authentication_error') { setApiKeyTestStatus('error'); setApiKeyTestMessage('Invalid API key. Please check your key and try again.'); } else if (result.success || resp.ok) { setApiKeyTestStatus('success'); setApiKeyTestMessage('API key is valid! Claude AI extraction is ready to use.'); } else { setApiKeyTestStatus('success'); setApiKeyTestMessage('API key accepted. Claude AI extraction is ready to use.'); } } catch (err) { setApiKeyTestStatus('error'); setApiKeyTestMessage('Connection error: ' + err.message); } };
const extractWithClaude = async (file, apiKey) => { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = async () => { try { const base64 = reader.result.split(',')[1]; const resp = await fetch(`${API_BASE}/api/extract-invoice`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ file: base64, mediaType: file.type, apiKey }) }); const result = await resp.json(); if (!resp.ok || !result.success) { reject(new Error(result.error || `API error (${resp.status})`)); return; } const d = result.data; resolve({ invoiceNumber: d.invoice?.invoice_number || d.invoiceNumber || `INV-${Math.floor(Math.random() * 10000)}`, vendor: d.supplier?.company || d.vendor || 'Unknown Vendor', date: d.invoice?.invoice_date || d.date || new Date().toISOString().split('T')[0], dueDate: d.invoice?.due_date || d.dueDate || new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0], amount: String(parseFloat(d.totals?.subtotal ?? d.amount) || 0).replace(/[^0-9.]/g, '') || '0.00', taxAmount: String(parseFloat(d.totals?.vat_amount ?? d.taxAmount) || 0).replace(/[^0-9.]/g, '') || '0.00', description: d.invoice?.title || d.description || '', department: d.department || 'General', lineItems: Array.isArray(d.line_items) ? d.line_items.map(li => ({ category: li.category || '', description: li.description || '', quantity: Number(li.quantity) || 0, rate: Number(li.unit_rate) || 0, amount: Number(li.amount) || 0 })) : Array.isArray(d.lineItems) ? d.lineItems.map(li => ({ description: li.description || '', quantity: Number(li.quantity) || 0, rate: Number(li.rate) || 0, amount: Number(li.amount) || 0 })) : [], supplier: d.supplier || null, customer: d.customer || null, paymentTerms: d.invoice?.payment_terms || '', currency: d.invoice?.currency || '', vatRate: d.totals?.vat_rate ?? null, subtotal: String(parseFloat(d.totals?.subtotal) || 0) || '0.00', totalAmount: String(parseFloat(d.totals?.total) || 0) || '0.00', bankDetails: d.bank_details || null, fileName: file.name, fileUrl: URL.createObjectURL(file), fileType: file.type }); } catch (err) { reject(err); } }; reader.onerror = () => reject(new Error('Failed to read file')); reader.readAsDataURL(file); }); };
const [pendingMatches, setPendingMatches] = useState([]);
const findMatches = () => { const results = [];
const isRestricted = !hasPermission('invoices.assign_all');
const unlinkedInvs = invoices.filter(inv => inv && !inv.spendApprovalId && (!isRestricted || inv.submittedBy === user.name));
spendApprovals.filter(sp => sp && sp.status === 'Approved' && (!isRestricted || sp.submittedBy === user.name)).forEach(sp => { const suggestions = [];
const saRef = (sp.ref||'').toUpperCase(); const spVendor = (sp.vendor||'').toLowerCase(); const spAmt = parseFloat(sp.amount)||0;
const linkedInvs = invoices.filter(i => i.spendApprovalId === sp.id);
const totalInvoiced = linkedInvs.reduce((sum,i) => sum + (parseFloat(i.amount)||0), 0);
const spAmtEur = toEur(spAmt, sp.currency);
const remaining = spAmtEur - linkedInvs.reduce((sum,i) => sum + toEur(invoiceTotal(i), i.currency||sp.currency), 0);
unlinkedInvs.forEach(inv => { let score = 0; let reasons = [];
const invDesc = ((inv.description||'') + ' ' + (inv.invoiceNumber||'')).toUpperCase();
if (saRef && invDesc.includes(saRef)) { score += 60; reasons.push('SA reference match'); }
const invVendor = (inv.vendor||'').toLowerCase();
if (invVendor && spVendor && (invVendor.includes(spVendor) || spVendor.includes(invVendor))) { score += 30; reasons.push('Vendor match'); }
else if (invVendor && spVendor) { const words = spVendor.split(/\s+/); if (words.some(w => w.length > 2 && invVendor.includes(w))) { score += 15; reasons.push('Partial vendor match'); } }
const invTotalEur = toEur(invoiceTotal(inv), inv.currency||sp.currency);
if (invTotalEur > 0 && spAmtEur > 0) { const diff = Math.abs(invTotalEur - spAmtEur) / spAmtEur; if (diff <= 0.1) { score += 20; reasons.push(`Amount ±${(diff*100).toFixed(0)}%`); } }
if (remaining <= 0 && score < 60) { score = 0; }
if (score >= 15) suggestions.push({ invoiceId: inv.id, invoiceNumber: inv.invoiceNumber||'', invoiceVendor: inv.vendor||'', invoiceAmount: inv.amount||'0', invoiceCurrency: inv.currency||sp.currency||'', invoiceDate: inv.date||'', invoiceDueDate: inv.dueDate||'', invoiceDescription: inv.description||'', invoiceSubmittedBy: inv.submittedBy||'', score, reasons }); });
if (suggestions.length > 0) results.push({ spendId: sp.id, spendRef: sp.ref||'', spendTitle: sp.title||'', spendVendor: sp.vendor||'', spendCurrency: sp.currency||'', spendAmount: sp.amount||'0', spendCategory: sp.category||'', spendRegion: sp.region||'', spendAtom: sp.atom||'', totalInvoiced, remaining: spAmt - totalInvoiced, linkedCount: linkedInvs.length, suggestions: suggestions.sort((a,b) => b.score - a.score) }); }); return results;};
const runAutoMatch = () => { const results = findMatches();
setPendingMatches(results);
if (results.length > 0) { setCurrentPage('matching'); } else { alert('No matching invoices found for any approved spend approvals.'); }};
const acceptMatch = (invoiceId, spendId) => { const inv = invoices.find(i => i.id === invoiceId); const sp = spendApprovals.find(s => s.id === spendId);
if (!inv || !sp) return;
if (!hasPermission('invoices.assign_all')) { if (inv.submittedBy !== user.name || sp.submittedBy !== user.name) { alert('You can only link invoices you uploaded to spend approvals you raised.'); return; } }
setInvoices(prev => prev.map(i => i.id === invoiceId ? {...i, spendApprovalId: spendId, spendApprovalTitle: sp.title} : i));
checkSpendThreshold(spendId, toEur(invoiceTotal(inv), inv.currency||sp.currency));
setAuditLog(prev => [...prev, { id:Date.now()+Math.random(), action:'INVOICE_MATCHED', details:`Invoice ${inv.invoiceNumber} matched to spend approval "${sp.title}" (€${toEur(sp.amount, sp.currency).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})})`, performedBy:user.name, performedAt:new Date().toISOString() }]);
setPendingMatches(prev => prev.map(m => m.spendId===spendId ? {...m, suggestions: m.suggestions.filter(s=>s.invoiceId!==invoiceId)} : m).filter(m=>m.suggestions.length>0));};
const dismissSpendMatch = (spendId) => { setPendingMatches(prev => prev.filter(m => m.spendId !== spendId)); };
const unlinkInvoice = (invoiceId) => { const inv = invoices.find(i => i.id === invoiceId); if (!inv) return;
setInvoices(prev => prev.map(i => i.id === invoiceId ? {...i, spendApprovalId: null, spendApprovalTitle: null} : i));
setAuditLog(prev => [...prev, { id:Date.now(), action:'INVOICE_UNLINKED', details:`Invoice ${inv.invoiceNumber} unlinked from spend approval`, performedBy:user.name, performedAt:new Date().toISOString() }]);};
const getLinkedInvoices = (spendId) => invoices.filter(i => i.spendApprovalId === spendId);
const invoiceTotal = (i) => (parseFloat(i.totalAmount) || ((parseFloat(i.amount)||0) + (parseFloat(i.taxAmount)||0)));
const getSpendRemaining = (sp) => { const linked = getLinkedInvoices(sp.id); const totalEur = linked.reduce((sum,i) => sum + toEur(invoiceTotal(i), i.currency||sp.currency), 0); return toEur(parseFloat(sp.amount)||0, sp.currency) - totalEur; };
const checkSpendThreshold = (spendId, newInvoiceAmountEur) => { const sp = spendApprovals.find(s => s.id === spendId); if (!sp) return;
const approvedEur = toEur(parseFloat(sp.amount)||0, sp.currency);
if (approvedEur <= 0) return;
const linked = getLinkedInvoices(sp.id);
const previousTotalEur = linked.reduce((sum,i) => sum + toEur(invoiceTotal(i), i.currency||sp.currency), 0);
const newTotalEur = previousTotalEur + newInvoiceAmountEur;
const prevRatio = previousTotalEur / approvedEur;
const newRatio = newTotalEur / approvedEur;
const crossed = (prevRatio < 1.0 && newRatio >= 1.0) ? '100%' : (prevRatio < 0.8 && newRatio >= 0.8) ? '80%' : null;
if (crossed) {
const alertObj = { id: Date.now() + Math.random(), spendId: sp.id, spendRef: sp.ref, spendTitle: sp.title, approver: sp.approver, department: sp.department, threshold: crossed, totalInvoiced: newTotalEur, approvedAmount: approvedEur, remaining: approvedEur - newTotalEur, createdAt: new Date().toISOString() };
setSpendAlerts(prev => { const without = prev.filter(a => a.spendId !== sp.id); return [...without, alertObj]; });
setAuditLog(prev => [...prev, { id: Date.now()+Math.random(), action: 'SPEND_THRESHOLD_ALERT', details: `Spend approval "${sp.title}" (${sp.ref}) reached ${crossed} threshold — Invoiced: €${newTotalEur.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})} of €${approvedEur.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`, performedBy: user.name, performedAt: new Date().toISOString() }]);
}};
const [spendApprovals, setSpendApprovals] = useState([
{ id:1, ref:'SA-0001-ENG-CC200-UK', department:'Engineering', title:'Adobe Creative Cloud License', currency:'GBP', amount:'2400', category:'Software', vendor:'Adobe Inc.', approver:'Bob Johnson', costCentre:'CC200', atom:'ENG', region:'UK', project:'Project Alpha', status:'Approved', submittedBy:'Jane Smith', submittedAt:'2025-01-15T10:30:00Z', exceptional:'No', timeSensitive:false, justification:'10 seat renewal.' },
{ id:2, ref:'SA-0002-ENG-CC200-US', department:'Engineering', title:'AWS Infrastructure Q2', currency:'USD', amount:'15000', category:'Software', vendor:'Amazon Web Services', approver:'Bob Johnson', costCentre:'CC200', atom:'ENG', region:'US', project:'Project Alpha', status:'Pending', submittedBy:'John Doe', submittedAt:'2025-02-01T14:20:00Z', exceptional:'No', timeSensitive:true, justification:'March launch infra.' },
{ id:3, ref:'SA-0003-MKT-CC400-EU', department:'Sales & Marketing', title:'Marketing Conference Travel', currency:'GBP', amount:'3500', category:'Travel', vendor:'Booking.com', approver:'Bob Johnson', costCentre:'CC400', atom:'MKT', region:'EU', project:'Project Beta', status:'Approved', submittedBy:'Jane Smith', submittedAt:'2025-02-10T09:15:00Z', exceptional:'No', timeSensitive:false, justification:'SaaStr Europa.' },
{ id:4, ref:'SA-0004-OPS-CC100-UK', department:'Finance & Legal', title:'Legal Consultation - Acquisition', currency:'GBP', amount:'25000', category:'Professional Services', vendor:'Clifford Chance LLP', approver:'John Doe', costCentre:'CC100', atom:'OPS', region:'UK', project:'Project Gamma', status:'Rejected', submittedBy:'Jane Smith', submittedAt:'2025-01-28T11:00:00Z', exceptional:'Yes', timeSensitive:true, justification:'DD legal review.' },
{ id:5, ref:'SA-0005-OPS-CC500-UK', department:'Operations', title:'Office Equipment Refresh', currency:'GBP', amount:'8500', category:'Hardware', vendor:'Dell Technologies', approver:'Bob Johnson', costCentre:'CC500', atom:'OPS', region:'UK', project:'Project Delta', status:'Approved', submittedBy:'John Doe', submittedAt:'2025-01-20T16:45:00Z', exceptional:'No', timeSensitive:false, justification:'Laptop refresh.' },
{ id:6, ref:'SA-0006-ENG-CC200-US', department:'Engineering', title:'GCP Cloud Hosting Q1', currency:'USD', amount:'12000', category:'Software', vendor:'Google Cloud Platform', approver:'Bob Johnson', costCentre:'CC200', atom:'ENG', region:'US', project:'Project Alpha', status:'Approved', submittedBy:'John Doe', submittedAt:'2025-01-10T09:00:00Z', exceptional:'No', timeSensitive:false, justification:'GCP Q1.' },
]);
const updateSpend = (k,v) => setSpendForm(p => ({...p,[k]:v}));
useEffect(() => {
if (!user) return;
const alerts = [];
spendApprovals.forEach(sp => {
const approvedEur = toEur(parseFloat(sp.amount)||0, sp.currency);
if (approvedEur <= 0) return;
const linked = invoices.filter(i => i.spendApprovalId === sp.id);
if (linked.length === 0) return;
const totalEur = linked.reduce((sum,i) => sum + toEur(invoiceTotal(i), i.currency||sp.currency), 0);
const ratio = totalEur / approvedEur;
const label = ratio >= 1.0 ? '100%' : ratio >= 0.8 ? '80%' : null;
if (label) {
alerts.push({ id: Date.now() + Math.random(), spendId: sp.id, spendRef: sp.ref, spendTitle: sp.title, approver: sp.approver, department: sp.department, threshold: label, totalInvoiced: totalEur, approvedAmount: approvedEur, remaining: approvedEur - totalEur, createdAt: new Date().toISOString() });
}
});
if (alerts.length > 0) setSpendAlerts(alerts);
}, [user]);
const [showFilterPanel, setShowFilterPanel] = useState(false);
const [filters, setFilters] = usePersistedState(_uk('inv_filters'), { vendor: 'all', dateFrom: '', dateTo: '', amountMin: '', amountMax: '', submittedBy: 'all', searchTerm: '' });
const [showConfig, setShowConfig] = useState(false);
const fileInputRef = useRef(null);
const spendFileInputRef = useRef(null);
const sendOtpToEmail = async () => { if (!authEmail || !authEmail.includes('@')) { alert('Invalid email'); return;}
const existingUser = mockUsers.find(u => u.email.toLowerCase() === authEmail.toLowerCase());
if (!existingUser) { const auditEntry = { id: Date.now(), action: 'LOGIN_FAILED', details: `Failed login attempt for ${authEmail} - Email not found in system`, performedBy: authEmail, performedAt: new Date().toISOString()};
setAuditLog(prev => [...prev, auditEntry]);
alert('Email not found. Please contact an administrator to get access.'); return;}
if (existingUser.status === 'Pending') { const auditEntry = { id: Date.now(), action: 'LOGIN_FAILED', details: `Failed login attempt for ${authEmail} - Account pending activation`, performedBy: authEmail, performedAt: new Date().toISOString()};
setAuditLog(prev => [...prev, auditEntry]);
alert('Your account is pending activation. Please check your invitation email.'); return;}
setIsAuthenticating(true); let otp;
if (authEmail.toLowerCase() === 'john.doe@company.com') { otp = '123456'; } else if (authEmail.toLowerCase() === 'jane.smith@company.com') { otp = '234567'; } else if (authEmail.toLowerCase() === 'bob.johnson@company.com') { otp = '345678'; } else if (authEmail.toLowerCase() === 'alice.williams@company.com') { otp = '456789'; } else { otp = Math.floor(100000 + Math.random() * 900000).toString();}
setGeneratedOtp(otp);
setOtpExpiry(Date.now() + 10 * 60 * 1000); // 10 minutes expiry
const auditEntry = { id: Date.now(), action: 'OTP_SENT', details: `OTP sent to ${authEmail}`, performedBy: authEmail, performedAt: new Date().toISOString()};
setAuditLog(prev => [...prev, auditEntry]); setTimeout(() => { setIsAuthenticating(false); setAuthStep('otp');
console.log(`OTP for ${authEmail}: ${otp}`); }, 1500);};
const verifyOtpAndLogin = async () => { setAuthOtpError(''); if (!authOtp) { setAuthOtpError('Please enter the OTP'); return;}
if (authOtp.length !== 6) { setAuthOtpError('OTP must be 6 digits'); return;}
if (Date.now() > otpExpiry) { setAuthOtpError('OTP has expired. Please request a new one.');
const auditEntry = { id: Date.now(), action: 'LOGIN_FAILED', details: `Failed login attempt for ${authEmail} - OTP expired`, performedBy: authEmail, performedAt: new Date().toISOString()};
setAuditLog(prev => [...prev, auditEntry]); setTimeout(() => { setAuthStep('email'); setAuthOtp('');
setAuthOtpError('');
setGeneratedOtp(''); setOtpExpiry(null); }, 3000); return;}
if (authOtp !== generatedOtp) { setAuthOtpError(`Invalid OTP. The correct code for ${authEmail} is shown in the demo box below.`); setAuthOtp('');
const auditEntry = { id: Date.now(), action: 'LOGIN_FAILED', details: `Failed login attempt for ${authEmail} - Invalid OTP entered`, performedBy: authEmail, performedAt: new Date().toISOString()};
setAuditLog(prev => [...prev, auditEntry]); return;}
setIsAuthenticating(true); setTimeout(() => { const loggedInUser = mockUsers.find(u => u.email.toLowerCase() === authEmail.toLowerCase()); if (loggedInUser) { setUser({ name: loggedInUser.name, email: loggedInUser.email, id: loggedInUser.id, role: loggedInUser.role, approvalLimit: loggedInUser.approvalLimit||0, isCeo: loggedInUser.isCeo||false });
const auditEntry = { id: Date.now(), action: 'USER_LOGIN', details: `User logged in via OTP with role: ${loggedInUser.role}`, performedBy: loggedInUser.name, performedAt: new Date().toISOString()};
setAuditLog(prev => [...prev, auditEntry]);
setIsAuthenticating(false);
setAuthStep('email'); setAuthEmail(''); setAuthOtp('');
setAuthOtpError('');
setGeneratedOtp(''); setOtpExpiry(null); } else { setIsAuthenticating(false);
setAuthOtpError('User not found');
const auditEntry = { id: Date.now(), action: 'LOGIN_FAILED', details: `Failed login attempt for ${authEmail} - User not found`, performedBy: authEmail, performedAt: new Date().toISOString()};
setAuditLog(prev => [...prev, auditEntry]);} }, 1000);};
const resendOtp = () => { sendOtpToEmail();};
const backToEmailStep = () => { setAuthStep('email'); setAuthOtp('');
setAuthOtpError('');
setGeneratedOtp('');};
const canUploadInvoices = () => hasPermission('invoices.upload');
const canDeleteInvoices = () => hasPermission('invoices.delete');
const canApproveReject = () => hasPermission('invoices.approve');
const canViewInvoices = () => !!user;
const canManagePermissions = () => hasPermission('settings.manage_users');
const canAssignInvoices = () => hasPermission('invoices.assign_all') || hasPermission('invoices.assign_own');
const hasPermission = (key) => {
  if (!user) return false;
  // Use API-loaded permissions if available, fallback to role-based lookup
  if (userPermissions.length > 0) return userPermissions.includes(key);
  const r = roles.find(r => r.name === user.role);
  return r ? r.permissions.includes(key) : false;
};
const getVisibilityScope = (domain) => {
  if (hasPermission(`${domain}.view_all`)) return 'all';
  if (domain === 'spend' && hasPermission('spend.view_dept')) return 'dept';
  if (hasPermission(`${domain}.view_own`)) return 'own';
  return 'none';
};
const getUserDepts = () => { if (!user) return []; if (hasPermission('spend.view_all')) return []; return functions.filter(f => f.approver === user.name).map(f => f.name); };
const logout = async () => {
try { await api.post('/api/auth/logout'); } catch {}
try { await msalInstance.logoutPopup(); } catch {}
setUser(null);
setUserPermissions([]);
setDataLoaded(false);
setCurrentPage('landing'); setInvoices(defaultInvoices);
setSelectedFiles([]);
setExtractedDataBatch([]);
setSelectedInvoiceIds([]);
setSelectedInvoice(null);
setShowSuccessNotification(false);
setShowDeleteConfirmation(false);
setDeleteConfirmationInput('');
setInvoiceToDelete(null); };
const updateUserRole = (userId, newRole) => { const targetUser = mockUsers.find(u => u.id === userId);
const oldRole = targetUser.role;
setMockUsers(mockUsers.map(u => u.id === userId ? { ...u, role: newRole } : u ));
const auditEntry = { id: Date.now(), action: 'ROLE_CHANGE', details: `User ${targetUser.name} role changed from ${oldRole} to ${newRole}`, userId: userId, performedBy: user.name, performedAt: new Date().toISOString()};
setAuditLog([...auditLog, auditEntry]);};
const inviteUser = () => { if (!inviteEmail || !inviteEmail.includes('@')) { alert('Invalid email'); return;}
if (mockUsers.some(u => u.email.toLowerCase() === inviteEmail.toLowerCase())) { alert('Email already exists'); return;} const newUser = { id: Date.now(), name: inviteEmail.split('@')[0].replace('.', ' ').replace(/\b\w/g, l => l.toUpperCase()), email: inviteEmail, role: inviteRole, status: 'Pending', createdAt: new Date().toISOString(), invitedBy: user.name};
setMockUsers([...mockUsers, newUser]);
const auditEntry = { id: Date.now() + 1, action: 'USER_INVITED', details: `User invited: ${inviteEmail} with role ${inviteRole}`, performedBy: user.name, performedAt: new Date().toISOString()};
setAuditLog([...auditLog, auditEntry]);
setShowInviteModal(false); setInviteEmail('');
setInviteRole('User');
alert(`Invitation sent to ${inviteEmail}`);};
const initiateRemoveUser = (usr) => { if (usr.id === user.id) { alert('Cannot remove self'); return;}
if (usr.status === 'Removed' || usr.status === 'Anonymized') { alert('Already removed'); return;}
setUserToRemove(usr);
setShowRemoveConfirmation(true);};
const confirmRemoveUser = () => { setMockUsers(mockUsers.map(u => u.id === userToRemove.id ? { ...u, status: 'Removed', removedAt: new Date().toISOString(), removedBy: user.name} : u ));
const auditEntry = { id: Date.now(), action: 'USER_REMOVED', details: `User access revoked: ${userToRemove.name} (${userToRemove.email}) - Role: ${userToRemove.role}. User remains in system for data integrity.`, performedBy: user.name, performedAt: new Date().toISOString()};
setAuditLog([...auditLog, auditEntry]);
setShowRemoveConfirmation(false);
if (window.confirm(`Access revoked.\n\nAnonymize data now?\n\nAnonymize later from user list.`)) { const anonymousId = `User_${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
setMockUsers(prev => prev.map(u => u.id === userToRemove.id ? { ...u, name: anonymousId, email: `${anonymousId.toLowerCase()}@anonymized.local`, status: 'Anonymized', anonymizedAt: new Date().toISOString()} : u ));
setInvoices(invoices.map(inv => ({ ...inv, submittedBy: inv.submittedBy === userToRemove.name ? anonymousId : inv.submittedBy })));
const gdprAuditEntry = { id: Date.now() + 1, action: 'GDPR_ANONYMIZATION', details: `User data anonymized after removal per GDPR request. ID: ${userToRemove.email} → New: ${anonymousId}. Note: Audit preserved for compliance.`, performedBy: user.name, performedAt: new Date().toISOString(), gdprCompliance: true, originalEmail: userToRemove.email, anonymousId: anonymousId};
setAuditLog(prev => [...prev, gdprAuditEntry]);
alert(`Personal data anonymized.\n\nOriginal: ${userToRemove.email}\nNew ID: ${anonymousId}`);}
setUserToRemove(null);};
const cancelRemoveUser = () => { setShowRemoveConfirmation(false);
setUserToRemove(null);};
const initiateGdprAnonymization = (usr) => { if (usr.id === user.id) { alert('Cannot anonymize self'); return;}
if (usr.status === 'Anonymized') { alert('Already anonymized'); return;}
setUserToAnonymize(usr);
setGdprConfirmEmail('');
setShowGdprModal(true);};
const confirmGdprAnonymization = () => { if (gdprConfirmEmail !== userToAnonymize.email) { alert('Email does not match. Email must match.'); return;}
const anonymousId = `User_${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
setMockUsers(mockUsers.map(u => u.id === userToAnonymize.id ? { ...u, name: anonymousId, email: `${anonymousId.toLowerCase()}@anonymized.local`, status: 'Anonymized', anonymizedAt: new Date().toISOString()} : u ));
setInvoices(invoices.map(inv => ({ ...inv, submittedBy: inv.submittedBy === userToAnonymize.name ? anonymousId : inv.submittedBy })));
const auditEntry = { id: Date.now(), action: 'GDPR_ANONYMIZATION', details: `User data anonymized per GDPR request. ID: ${userToAnonymize.email} → New: ${anonymousId}. Note: Audit preserved for compliance.`, performedBy: user.name, performedAt: new Date().toISOString(), gdprCompliance: true, originalEmail: userToAnonymize.email, anonymousId: anonymousId};
setAuditLog([...auditLog, auditEntry]);
setShowGdprModal(false);
setUserToAnonymize(null);
setGdprConfirmEmail('');
alert(`Data anonymized.\n\nOriginal: ${userToAnonymize.email}\nNew ID: ${anonymousId}\n\nAudit trail preserved for compliance.`);};
const cancelGdprAnonymization = () => { setShowGdprModal(false);
setUserToAnonymize(null);
setGdprConfirmEmail('');};
const resendInvitation = (usr) => { const auditEntry = { id: Date.now(), action: 'INVITATION_RESENT', details: `Invitation resent to: ${usr.email}`, performedBy: user.name, performedAt: new Date().toISOString()};
setAuditLog([...auditLog, auditEntry]);
alert(`Invitation resent to ${usr.email}`);};
const canApproveSpend = () => hasPermission('spend.approve');
const canCreateSpend = () => hasPermission('spend.create');
const inferLookupsFromDepartment = (department) => { const map = { 'Engineering': { atom: 'ENG', costCentre: 'CC200' }, 'Operations': { atom: 'OPS', costCentre: 'CC500' }, 'Sales & Marketing': { atom: 'MKT', costCentre: 'CC400' }, 'Finance & Legal': { atom: '', costCentre: 'CC100' } }; return map[department] || { atom: '', costCentre: '' }; };
const getRolePermissions = (roleName) => {
  const role = roles.find(r => r.name === roleName);
  if (!role) return [];
  const allPerms = {};
  Object.values(PERMISSIONS).forEach(cat => {
    Object.entries(cat.permissions).forEach(([key, meta]) => { allPerms[key] = meta.label; });
  });
  return role.permissions.map(p => allPerms[p] || p);
};
const handleNotificationOk = () => { setShowSuccessNotification(false);
setSelectedInvoice(null);};
const handleNotificationClose = () => { setShowSuccessNotification(false);};
const initiateDeleteInvoice = (invoice) => { setInvoiceToDelete(invoice);
setDeleteConfirmationInput('');
setShowDeleteConfirmation(true);};
const confirmDeleteInvoice = async () => { if (deleteConfirmationInput !== invoiceToDelete.invoiceNumber) { alert('Invoice number does not match. Please type the exact invoice number to confirm deletion.'); return;}
const auditEntry = { id: Date.now(), action: 'DELETE', invoiceNumber: invoiceToDelete.invoiceNumber, invoiceId: invoiceToDelete.id, vendor: invoiceToDelete.vendor, amount: invoiceToDelete.amount, deletedBy: user.name, deletedAt: new Date().toISOString(), reason: 'Invoice Deleted by user'};
setAuditLog([...auditLog, auditEntry]);
setInvoices(invoices.filter(inv => inv.id !== invoiceToDelete.id));
if (selectedInvoice && selectedInvoice.id === invoiceToDelete.id) { setSelectedInvoice(null);}
setShowDeleteConfirmation(false);
setInvoiceToDelete(null);
setDeleteConfirmationInput('');
alert(`Invoice ${invoiceToDelete.invoiceNumber} has been deleted and logged in audit trail.`);};
const cancelDeleteInvoice = () => { setShowDeleteConfirmation(false);
setInvoiceToDelete(null);
setDeleteConfirmationInput('');};
const getFilteredAuditLog = () => { return auditLog.filter(entry => { if (auditActionFilter !== 'all' && entry.action !== auditActionFilter) { return false;}
const entryDate = new Date(entry.performedAt || entry.deletedAt);
if (auditDateFrom && entryDate < new Date(auditDateFrom)) { return false;}
if (auditDateTo && entryDate > new Date(auditDateTo + 'T23:59:59')) { return false;}
if (auditSearchTerm) { const searchLower = auditSearchTerm.toLowerCase();
const matchesSearch =
entry.action.toLowerCase().includes(searchLower) || entry.details.toLowerCase().includes(searchLower) || (entry.performedBy && entry.performedBy.toLowerCase().includes(searchLower)) || (entry.deletedBy && entry.deletedBy.toLowerCase().includes(searchLower)) || (entry.invoiceNumber && entry.invoiceNumber.toLowerCase().includes(searchLower));
if (!matchesSearch) { return false;}} return true; });};
const getUniqueAuditActions = () => { return [...new Set(auditLog.map(entry => entry.action))].sort();};
const clearAuditFilters = () => { setAuditSearchTerm('');
setAuditActionFilter('all');
setAuditDateFrom('');
setAuditDateTo('');};
const handleFileSelect = (e) => { const files = Array.from(e.target.files);
const validFiles = files.filter(file => file.type === 'application/pdf' || file.type.startsWith('image/'));
if (validFiles.length === 0) { alert('Please select PDF or image files'); return;}
if (validFiles.length !== files.length) { alert(`${files.length - validFiles.length} file(s) were skipped (invalid format)`);}
setSelectedFiles(validFiles);
extractInvoiceDataBatch(validFiles);
const auditEntry = { id: Date.now(), action: 'FILES_SELECTED', details: `${validFiles.length} file(s) selected for upload`, performedBy: user.name, performedAt: new Date().toISOString()};
setAuditLog([...auditLog, auditEntry]);};
const extractInvoiceDataBatch = async (files) => { setIsProcessing(true);
setProcessingProgress({ current: 0, total: files.length });
setExtractionErrors([]);
const extractedBatch = [];
const errors = [];
for (let i = 0; i < files.length; i++) { const file = files[i];
setProcessingProgress({ current: i + 1, total: files.length });
if (!anthropicApiKey) { errors.push({ fileName: file.name, error: 'No API key configured. Please add your Claude API key in Settings to enable invoice extraction.' }); continue; }
try { const data = await extractWithClaude(file, anthropicApiKey); extractedBatch.push(data); } catch (err) { console.error(`Claude extraction failed for ${file.name}:`, err); errors.push({ fileName: file.name, error: err.message }); }}
setExtractionErrors(errors);
setExtractedDataBatch(extractedBatch);
setIsProcessing(false);};
const processInvoiceBatch = async () => { if (extractedDataBatch.length === 0) return;
setIsProcessing(true);
setProcessingProgress({ current: 0, total: extractedDataBatch.length });
const newInvoices = [];
for (let i = 0; i < extractedDataBatch.length; i++) { const extractedData = extractedDataBatch[i];
setProcessingProgress({ current: i + 1, total: extractedDataBatch.length });
const newInvoice = { id: Date.now() + i, ...extractedData, submittedDate: new Date().toISOString(), submittedBy: user.name, spendApprovalId: null, spendApprovalTitle: null};
await new Promise(resolve => setTimeout(resolve, 400));
newInvoices.push(newInvoice);
const auditEntry = { id: Date.now() + i + 1000, action: 'INVOICE_CREATED', details: `Invoice ${newInvoice.invoiceNumber} created - Vendor: ${newInvoice.vendor}, Amount: ${newInvoice.amount}`, invoiceNumber: newInvoice.invoiceNumber, performedBy: user.name, performedAt: new Date().toISOString()};
setAuditLog(prev => [...prev, auditEntry]);}
const allInvoices = [...invoices, ...newInvoices];
setInvoices(allInvoices);
setExtractedDataBatch([]);
setSelectedFiles([]);
setIsProcessing(false);
setProcessingProgress({ current: 0, total: 0 });
if (fileInputRef.current) { fileInputRef.current.value = '';}};
const removeFromBatch = (idx) => { setExtractedDataBatch(prev => { const next = prev.filter((_, i) => i !== idx); if (next.length === 0 && fileInputRef.current) fileInputRef.current.value = ''; return next; }); setSelectedFiles(prev => prev.filter((_, i) => i !== idx)); };
const toggleColumnVisibility = (columnKey) => { setVisibleColumns(prev => ({ ...prev, [columnKey]: !prev[columnKey] }));};
const updateFilter = (key, value) => { setFilters(prev => ({ ...prev, [key]: value }));
const auditEntry = { id: Date.now(), action: 'FILTER_APPLIED', details: `Filter applied: ${key} = ${value}`, performedBy: user.name, performedAt: new Date().toISOString()};
setAuditLog(prev => [...prev, auditEntry]);};
const clearFilters = () => { setFilters({ vendor: 'all', dateFrom: '', dateTo: '', amountMin: '', amountMax: '', submittedBy: 'all', searchTerm: '' });
const auditEntry = { id: Date.now(), action: 'FILTERS_CLEARED', details: 'All filters cleared', performedBy: user.name, performedAt: new Date().toISOString()};
setAuditLog([...auditLog, auditEntry]);};
const getFilteredInvoices = () => { return invoices.filter(invoice => { if (getVisibilityScope('invoices')==='own' && invoice.submittedBy !== user.name) return false;
if (filters.vendor !== 'all' && invoice.vendor !== filters.vendor) { return false;}
if (filters.dateFrom && invoice.date < filters.dateFrom) { return false;}
if (filters.dateTo && invoice.date > filters.dateTo) { return false;}
if (filters.amountMin && parseFloat(invoice.amount) < parseFloat(filters.amountMin)) { return false;}
if (filters.amountMax && parseFloat(invoice.amount) > parseFloat(filters.amountMax)) { return false;}
if (filters.submittedBy !== 'all' && invoice.submittedBy !== filters.submittedBy) { return false;}
if (filters.searchTerm) { const searchLower = filters.searchTerm.toLowerCase();
const matchesSearch =
invoice.invoiceNumber.toLowerCase().includes(searchLower) || invoice.vendor.toLowerCase().includes(searchLower) || (invoice.description && invoice.description.toLowerCase().includes(searchLower));
if (!matchesSearch) { return false;}} return true; });};
const getGroupedInvoices = () => { const filteredInvoices = getFilteredInvoices();
if (groupBy === 'none') { return { 'All Invoices': filteredInvoices };} const grouped = {};
filteredInvoices.forEach(invoice => { let groupKey; switch (groupBy) { case 'vendor': groupKey = invoice.vendor; break; case 'date': groupKey = invoice.date; break; case 'submittedBy': groupKey = invoice.submittedBy || 'Unknown'; break; default: groupKey = 'All Invoices';}
if (!grouped[groupKey]) { grouped[groupKey] = [];}
grouped[groupKey].push(invoice); }); return grouped;};
const getUniqueVendors = () => { return [...new Set(invoices.map(inv => inv.vendor).filter(Boolean))].sort();};
const getUniqueSubmitters = () => { return [...new Set(invoices.map(inv => inv.submittedBy).filter(Boolean))].sort();};
const getActiveFilterCount = () => { let count = 0;
if (filters.vendor !== 'all') count++;
if (filters.dateFrom) count++;
if (filters.dateTo) count++;
if (filters.amountMin) count++;
if (filters.amountMax) count++;
if (filters.submittedBy !== 'all') count++;
if (filters.searchTerm) count++; return count;};
const exportToExcel = () => { const headers = ['Invoice #', 'Vendor', 'Date', 'Currency', 'Subtotal', 'Tax', 'Total', 'Submitted By'];
const rows = invoices.map(inv => [ inv.invoiceNumber, inv.vendor, inv.date, inv.currency || '', inv.amount, inv.taxAmount, inv.totalAmount || (parseFloat(inv.amount) + parseFloat(inv.taxAmount)).toFixed(2), inv.submittedBy || 'N/A' ]);
const csvContent = [ headers.join(','), ...rows.map(row => row.join(',')) ].join('\n');
const blob = new Blob([csvContent], { type: 'text/csv' });
const url = window.URL.createObjectURL(blob);
const a = document.createElement('a'); a.href = url;
a.download = `invoices_${new Date().toISOString().split('T')[0]}.csv`; a.click();
const auditEntry = { id: Date.now(), action: 'DATA_EXPORTED', details: `Invoice data exported to CSV - ${invoices.length} records`, performedBy: user.name, performedAt: new Date().toISOString()};
setAuditLog([...auditLog, auditEntry]);}; if (!user) { return ( <div className="min-h-screen bg-gradient-to-br from-blue-600 to-indigo-800 flex items-center justify-center p-6"> <div className="bg-white rounded-2xl shadow-2xl p-12 max-w-md w-full"> <div className="text-center mb-8"> <FileText className="w-16 h-16 text-indigo-600 mx-auto mb-4"/> <h1 className="text-3xl font-bold text-gray-800 mb-2">Invoice Workflow</h1> <p className="text-gray-600">Sign in to manage invoices and approvals</p></div> {authStep === 'email' ? ( <div> <div className="mb-6">
<label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label> <input type="email" value={authEmail}
onChange={(e) => setAuthEmail(e.target.value)}
onKeyPress={(e) => e.key === 'Enter' && sendOtpToEmail()}
placeholder="you@company.com" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
disabled={isAuthenticating}/></div> <button
onClick={sendOtpToEmail}
disabled={isAuthenticating} className="w-full bg-indigo-600 text-white py-4 rounded-lg font-semibold hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed" > {isAuthenticating ? ( <div className="flex items-center justify-center space-x-2"> <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> <span>Sending OTP...</span></div> ) : ( 'Send One-Time Password')}</button></div> ) : ( <div> <div className="mb-6"> <div className="flex items-center justify-between mb-2">
<label className="block text-sm font-medium text-gray-700">Enter OTP</label> <button
onClick={backToEmailStep} className="text-xs text-indigo-600 hover:text-indigo-800" > Change email</button></div> <p className="text-sm text-gray-600 mb-3"> Code sent to <strong>{authEmail}</strong></p> <input type="text" value={authOtp} onChange={(e) => { setAuthOtp(e.target.value.replace(/\D/g, '').slice(0, 6));
setAuthOtpError(''); }}
onKeyPress={(e) => e.key === 'Enter' && verifyOtpAndLogin()}
placeholder="000000"
maxLength={6} className={`w-full px-4 py-3 border rounded-lg text-center text-2xl font-mono tracking-widest focus:outline-none focus:ring-2 ${ authOtpError ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-indigo-500' }`}
disabled={isAuthenticating}/> {authOtpError && ( <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg"> <p className="text-sm text-red-700 font-medium">{authOtpError}</p></div>)}
<p className="text-xs text-gray-500 mt-2 text-center"> OTP expires in 10 minutes</p></div> <button
onClick={verifyOtpAndLogin}
disabled={isAuthenticating || authOtp.length !== 6} className="w-full bg-indigo-600 text-white py-4 rounded-lg font-semibold hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed mb-3" > {isAuthenticating ? ( <div className="flex items-center justify-center space-x-2"> <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> <span>Verifying...</span></div> ) : ( 'Verify & Sign In')}</button> <button onClick={resendOtp}
disabled={isAuthenticating} className="w-full bg-gray-200 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-300 transition disabled:opacity-50 disabled:cursor-not-allowed" > Resend OTP</button></div>)}
<div className="mt-6 relative"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-300"></div></div><div className="relative flex justify-center text-sm"><span className="px-2 bg-white text-gray-500">or</span></div></div><button onClick={msalLogin} disabled={isAuthenticating} className="mt-6 w-full bg-blue-700 text-white py-4 rounded-lg font-semibold hover:bg-blue-800 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-3">{isAuthenticating ? (<><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div><span>Signing in...</span></>) : (<><svg className="w-5 h-5" viewBox="0 0 23 23"><path fill="#f3f3f3" d="M0 0h11v11H0z"/><path fill="#f35325" d="M0 0h11v11H0z"/><path fill="#81bc06" d="M12 0h11v11H12z"/><path fill="#05a6f0" d="M0 12h11v11H0z"/><path fill="#ffba08" d="M12 12h11v11H12z"/></svg><span>Sign in with Microsoft</span></>)}</button><div className="mt-8 text-center text-sm text-gray-500"> <p>OTP or Microsoft authentication</p></div> <div className="mt-6 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700"> <p className="font-semibold text-blue-800 mb-1">Demo credentials (OTP):</p> <p>john.doe@company.com / 123456 (Admin) • jane.smith@company.com / 234567 (Finance) • bob.johnson@company.com / 345678 (Approver) • alice.williams@company.com / 456789 (User)</p></div></div></div>);}
if (currentPage === 'landing') { const h = new Date().getHours();
const g = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
return (<div className={_pg}><div className="max-w-5xl mx-auto"> <div className="bg-white rounded-lg shadow-lg p-6 mb-8"><div className={_fj}> <div className="flex items-center space-x-3"><Home className="w-8 h-8 text-indigo-600"/><div><h1 className="text-2xl font-bold text-gray-800">{g}, {user.name.split(' ')[0]}</h1><p className="text-sm text-gray-500">Dashboard</p></div></div>
<div className="flex items-center space-x-4"><div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 rounded-lg"><User className="w-5 h-5 text-indigo-600"/><div className="text-sm"><p className="font-semibold text-gray-800">{user.name}</p><p className="text-xs text-gray-600">{user.role}</p></div></div> <button onClick={logout} className="flex items-center space-x-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"><LogOut className="w-4 h-4"/><span>Logout</span></button></div> </div></div> <div className={`grid grid-cols-1 ${(hasPermission('settings.view_lookups') || hasPermission('settings.manage_users')) ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-6`}>
<button onClick={() => setCurrentPage('invoices')} className="bg-white rounded-xl shadow-lg hover:shadow-xl border-2 border-transparent hover:border-indigo-400 text-left p-8"><div className="flex items-center justify-center w-16 h-16 bg-indigo-100 rounded-2xl mb-6"><FileText className="w-8 h-8 text-indigo-600"/></div><h2 className="text-xl font-bold text-gray-800 mb-2">Invoices</h2><p className="text-gray-500 text-sm mb-6">{hasPermission('invoices.upload') ? 'Upload, extract, and manage invoices.' : 'View invoices you have uploaded.'}</p><div className="flex items-center text-indigo-600 font-semibold text-sm"><span>Open Invoices</span><ArrowRight className="w-4 h-4 ml-2"/></div></button>
<button onClick={() => setCurrentPage('spend-approval')} className="bg-white rounded-xl shadow-lg hover:shadow-xl border-2 border-transparent hover:border-green-400 text-left p-8 relative"><div className="flex items-center justify-center w-16 h-16 bg-green-100 rounded-2xl mb-6"><DollarSign className="w-8 h-8 text-green-600"/></div>{spendAlerts.length > 0 && <span className="absolute top-4 right-4 bg-red-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">{spendAlerts.length}</span>}<h2 className="text-xl font-bold text-gray-800 mb-2">Spend Approvals</h2><p className="text-gray-500 text-sm mb-6">Create, track, and manage spend approval requests.</p><div className="flex items-center text-green-600 font-semibold text-sm"><span>Open Spend Approvals</span><ArrowRight className="w-4 h-4 ml-2"/></div></button>
{(hasPermission('settings.view_lookups') || hasPermission('settings.manage_users')) && (<button onClick={() => { setSettingsTab(hasPermission('settings.manage_users') ? 'users' : 'atoms'); setCurrentPage('settings'); }} className="bg-white rounded-xl shadow-lg hover:shadow-xl border-2 border-transparent hover:border-purple-400 text-left p-8"><div className="flex items-center justify-center w-16 h-16 bg-purple-100 rounded-2xl mb-6"><Settings className="w-8 h-8 text-purple-600"/></div><h2 className="text-xl font-bold text-gray-800 mb-2">Settings</h2><p className="text-gray-500 text-sm mb-6">{canManagePermissions() ? 'Manage users, roles, lookups, and audit logs.' : 'View lookups and audit logs.'}</p><div className="flex items-center text-purple-600 font-semibold text-sm"><span>Open Settings</span><ArrowRight className="w-4 h-4 ml-2"/></div></button>)}
</div> </div></div>);}
if (currentPage === 'spend-approval') { const sf = spendForm;
const sfc = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500";
const slc = "block text-sm font-medium text-gray-700 mb-1";
const req = <span className="text-red-500">*</span>;
const filteredSpends = spendApprovals.filter(s => { if (getVisibilityScope('spend')==='own' && s.submittedBy !== user.name) return false;
const depts = getUserDepts(); if (getVisibilityScope('spend')==='dept' && depts.length > 0 && !depts.includes(s.department)) return false;
if (spendSearch) { const q=spendSearch.toLowerCase(); if(!s.title.toLowerCase().includes(q) && !s.vendor.toLowerCase().includes(q) && !s.submittedBy.toLowerCase().includes(q) && !(s.project||'').toLowerCase().includes(q)) return false; }
if (spendFilters.status!=='all' && s.status!==spendFilters.status) return false;
if (spendFilters.vendor!=='all' && s.vendor!==spendFilters.vendor) return false;
if (spendFilters.category!=='all' && s.category!==spendFilters.category) return false;
if (spendFilters.department!=='all' && s.department!==spendFilters.department) return false;
if (spendFilters.project!=='all' && s.project!==spendFilters.project) return false;
if (spendFilters.submittedBy!=='all' && s.submittedBy!==spendFilters.submittedBy) return false;
if (spendFilters.approver!=='all' && s.approver!==spendFilters.approver) return false;
if (spendFilters.dateFrom && s.submittedAt < spendFilters.dateFrom) return false;
if (spendFilters.dateTo && s.submittedAt > spendFilters.dateTo+'T23:59:59Z') return false;
if (spendFilters.amountMin && Number(s.amount) < Number(spendFilters.amountMin)) return false;
if (spendFilters.amountMax && Number(s.amount) > Number(spendFilters.amountMax)) return false; return true; });
const submitSpend = () => { if (!sf.title||!sf.currency||!sf.approver||!sf.amount||!sf.category||!sf.atom||!sf.vendor||!sf.costCentre||!sf.region||!sf.exceptional||!sf.justification||!sf.department) { alert('Fill all required fields'); return; }
const num = String(spendApprovals.length+1).padStart(4,'0');
const ref = `SA-${num}-${sf.atom}-${sf.costCentre}-${sf.region}`;
const newApproval = { id: Date.now(), ref, title:sf.title, currency:sf.currency, amount:sf.amount, category:sf.category, vendor:sf.vendor, approver:sf.approver, costCentre:sf.costCentre, atom:sf.atom, region:sf.region, project:sf.project, department:sf.department, status:'Pending', submittedBy:user.name, submittedAt:new Date().toISOString(), exceptional:sf.exceptional, timeSensitive:sf.timeSensitive, justification:sf.justification, originInvoiceId: sf.originInvoiceId || null };
setSpendApprovals(prev => [newApproval, ...prev]);
const entry = { id: Date.now(), action:'SPEND_REQUEST', details:`Spend approval: ${sf.title} - €${toEur(sf.amount, sf.currency).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}${sf.currency !== 'EUR' ? ` (${sf.currency} ${sf.amount})` : ''} - Vendor: ${sf.vendor}`, performedBy: user.name, performedAt: new Date().toISOString() };
setAuditLog(prev => [...prev, entry]);
setSpendSubmitted(true);};
const uploadInvoiceToSpend = async (files, spend) => {
const validFiles = Array.from(files).filter(f => f.type === 'application/pdf' || f.type.startsWith('image/'));
if (validFiles.length === 0) { alert('Please select PDF or image files'); return; }
if (validFiles.length !== files.length) { alert(`${files.length - validFiles.length} file(s) were skipped (invalid format)`); }
setIsProcessing(true);
setProcessingProgress({ current: 0, total: validFiles.length });
const newInvoices = [];
for (let i = 0; i < validFiles.length; i++) {
const file = validFiles[i];
setProcessingProgress({ current: i + 1, total: validFiles.length });
let extracted = null;
if (!anthropicApiKey) { alert(`Extraction failed for ${file.name}: No API key configured. Please add your Claude API key in Settings.`); continue; }
try { extracted = await extractWithClaude(file, anthropicApiKey); } catch (err) { console.error(`Claude extraction failed for ${file.name}:`, err); alert(`Extraction failed for ${file.name}: ${err.message}`); continue; }
const newInvoice = {
id: Date.now() + i,
invoiceNumber: extracted.invoiceNumber || `INV-${Date.now()}`,
vendor: extracted.vendor || spend.vendor,
date: extracted.date || new Date().toISOString().split('T')[0],
dueDate: extracted.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
amount: extracted.amount || '0.00',
taxAmount: extracted.taxAmount || '0.00',
department: extracted.department || spend.department,
description: extracted.description || `Invoice for ${spend.title}`,
lineItems: extracted.lineItems?.length > 0 ? extracted.lineItems : [],
supplier: extracted.supplier || { company: spend.vendor, address: '', vat_number: '', website: '', phone: '', email: '' },
customer: extracted.customer || null,
paymentTerms: extracted.paymentTerms || '',
currency: extracted.currency || spend.currency || '',
vatRate: extracted.vatRate ?? 0.20,
subtotal: extracted.subtotal || '0.00',
totalAmount: extracted.totalAmount || '0.00',
bankDetails: extracted.bankDetails || null,
fileName: file.name,
fileUrl: extracted?.fileUrl || URL.createObjectURL(file),
fileType: file.type,
submittedDate: new Date().toISOString(),
submittedBy: user.name,
spendApprovalId: spend.id,
spendApprovalTitle: spend.title
};
newInvoices.push(newInvoice);
setAuditLog(prev => [...prev, { id: Date.now() + i + 2000, action: 'INVOICE_UPLOADED_TO_SPEND', details: `Invoice ${invNum} uploaded to spend approval "${spend.title}" (${spend.ref}) - Vendor: ${newInvoice.vendor}, Amount: ${newInvoice.amount}`, performedBy: user.name, performedAt: new Date().toISOString() }]);
}
setInvoices(prev => [...prev, ...newInvoices]);
newInvoices.forEach(inv => { checkSpendThreshold(spend.id, toEur(invoiceTotal(inv), inv.currency||spend.currency)); });
setIsProcessing(false);
setProcessingProgress({ current: 0, total: 0 });
if (spendFileInputRef.current) { spendFileInputRef.current.value = ''; }
setSelectedSpend({...spend});
};
const navBar = (<div className="bg-white rounded-lg shadow-lg p-6 mb-6"><div className={_fj}> <div className="flex items-center space-x-3"><DollarSign className="w-8 h-8 text-green-600"/><h1 className="text-2xl font-bold text-gray-800">Spend Approvals</h1></div>
<div className="flex items-center space-x-4"><div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 rounded-lg"><User className="w-5 h-5 text-indigo-600"/><div className="text-sm"><p className="font-semibold text-gray-800">{user.name}</p><p className="text-xs text-gray-600">{user.role}</p></div></div><button onClick={() => setCurrentPage('landing')} className="flex items-center space-x-2 px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200"><Home className="w-4 h-4"/><span>Dashboard</span></button><button onClick={logout} className="flex items-center space-x-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"><LogOut className="w-4 h-4"/><span>Logout</span></button></div>
</div></div>);
const getCeoUser = () => mockUsers.find(u => u.isCeo && u.status === 'Active');
const updateSpendStatus = (id, status) => { const item = spendApprovals.find(s=>s.id===id);
if (status === 'Approved' && item.status === 'Pending') { const limit = user.approvalLimit || 0; const amt = toEur(item.amount, item.currency);
if (limit > 0 && amt > limit && !user.isCeo) { setShowEscalationModal(item); return false; }}
setSpendApprovals(prev => prev.map(s => s.id===id ? {...s, status, approvedBy:status==='Approved'||status==='Rejected'?user.name:s.approvedBy} : s));
setAuditLog(prev => [...prev, { id:Date.now(), action:`SPEND_${status.toUpperCase()}`, details:`Spend request "${item.title}" (€${toEur(item.amount, item.currency).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}) ${status.toLowerCase()} - Vendor: ${item.vendor}`, performedBy:user.name, performedAt:new Date().toISOString() }]);
if (status === 'Approved' && item.originInvoiceId) { const originInv = invoices.find(i => i.id === item.originInvoiceId); if (originInv && !originInv.spendApprovalId) { setInvoices(prev => prev.map(i => i.id === item.originInvoiceId ? {...i, spendApprovalId: id, spendApprovalTitle: item.title} : i)); checkSpendThreshold(id, toEur(invoiceTotal(originInv), originInv.currency||item.currency)); setAuditLog(prev => [...prev, { id:Date.now()+1, action:'INVOICE_AUTO_LINKED', details:`Invoice ${originInv.invoiceNumber} auto-linked to spend approval "${item.title}" (€${toEur(item.amount, item.currency).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}) upon approval`, performedBy:user.name, performedAt:new Date().toISOString() }]); } }};
const confirmEscalation = () => { const item = showEscalationModal; if (!item) return; const ceo = getCeoUser();
setSpendApprovals(prev => prev.map(s => s.id===item.id ? {...s, status:'Escalated', approvedBy:user.name, escalatedTo:ceo?.name||'CEO', escalatedAt:new Date().toISOString()} : s));
const limit = user.approvalLimit || 0;
setAuditLog(prev => [...prev, { id:Date.now(), action:'SPEND_ESCALATED', details:`"${item.title}" (€${toEur(item.amount, item.currency).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}) exceeds ${user.name}'s limit (€${limit.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}) - escalated to ${ceo?.name||'CEO'}`, performedBy:user.name, performedAt:new Date().toISOString() }]);
setShowEscalationModal(null); if (selectedSpend && selectedSpend.id === item.id) setSelectedSpend({...item, status:'Escalated', approvedBy:user.name, escalatedTo:ceo?.name||'CEO'}); };
const escalationModal = showEscalationModal && (() => { const esc = showEscalationModal; const limit = user.approvalLimit || 0; const ceo = getCeoUser(); return (
<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"><div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6">
<h3 className="text-xl font-bold text-gray-900 mb-3">Approval Limit Exceeded</h3>
<p className="text-gray-600 mb-4">This spend (<strong>{fmtEur(esc.amount, esc.currency)}</strong>) exceeds your approval limit (<strong>{fmtEur(limit, 'EUR')}</strong>). It will be routed to <strong>{ceo?.name || 'CEO'}</strong> for final approval.</p>
<div className="flex space-x-3"><button onClick={() => setShowEscalationModal(null)} className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">Cancel</button><button onClick={confirmEscalation} className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700">Continue</button></div></div></div>); })();
const bulkUpdateSpend = (status) => { const items = spendApprovals.filter(s => selectedSpendIds.includes(s.id) && (s.status==='Pending'||s.status==='Escalated'));
items.forEach(item => { updateSpendStatus(item.id, status); });
setSelectedSpendIds([]);};
if (spendSubmitted) { return (<div className={_pg}><div className="max-w-3xl mx-auto">{navBar}
<div className="bg-white rounded-xl shadow-lg p-12 text-center"> <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4"/> <h2 className="text-2xl font-bold text-gray-800 mb-3">Request Submitted</h2> <p className="text-gray-500 mb-2">Your spend approval for <strong>{sf.title}</strong> has been submitted.</p> <p className="text-gray-500 mb-2">{fmtEur(sf.amount, sf.currency)} • Approver: {sf.approver}</p>{sf.currency !== 'EUR' && <p className="text-xs text-gray-400 mb-8">Original: {sf.currency} {Number(sf.amount).toLocaleString()}</p>} <div className="flex justify-center space-x-4">
<button onClick={() => { setSpendForm({ cc:'', title:'', currency:'', approver:'', amount:'', category:'', atom:'', vendor:'', costCentre:'', region:'', project:'', timeSensitive:false, exceptional:'', justification:'', department:'', originInvoiceId: null }); setSpendSubmitted(false); }} className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold">Create Another</button> <button onClick={() => { setSpendSubmitted(false); setSpendView('list'); }} className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-semibold">Back to Spend Approvals</button></div></div> </div></div>);}
if (selectedSpend) { const s = selectedSpend;
const sBadge2 = (status) => { const c = {Pending:'bg-yellow-100 text-yellow-800',Approved:'bg-green-100 text-green-800',Rejected:'bg-red-100 text-red-800',Escalated:'bg-orange-100 text-orange-800'}; return <span className={`px-3 py-1 rounded-full text-sm font-semibold ${c[status]||'bg-gray-100 text-gray-800'}`}>{status}</span>; };
const dRow = (label, val) => (<div className="py-3 border-b border-gray-100 grid grid-cols-3"><span className="text-sm font-medium text-gray-500">{label}</span><span className="text-sm text-gray-900 col-span-2">{val}</span></div>);
return (<div className={_pg}><div className="max-w-3xl mx-auto">{navBar}
<div className="bg-white rounded-xl shadow-lg p-8"> <div className={_fj+" mb-6"}> <button onClick={() => setSelectedSpend(null)} className="text-sm text-indigo-600 hover:text-indigo-800 font-semibold">← Back to Spend Approvals</button> {sBadge2(s.status)}</div> <h2 className="text-2xl font-bold text-gray-800 mb-1">{s.title}</h2> <p className="font-mono text-sm text-indigo-600 font-semibold mb-1">{s.ref}</p> <p className="text-sm text-gray-500 mb-6">Submitted by {s.submittedBy} on {new Date(s.submittedAt).toLocaleDateString('en-GB', {day:'numeric',month:'long',year:'numeric'})}</p> <div className="mb-6">
{dRow('Requested Amount', <span className="font-semibold">{fmtEur(s.amount, s.currency)}{s.currency !== 'EUR' && <span className="text-xs text-gray-400 ml-2">({s.currency} {Number(s.amount).toLocaleString()})</span>}</span>)}
{dRow('Function / Department', s.department || '—')}
{dRow('Vendor / Supplier', s.vendor)}
{dRow('Spend Category', s.category)}
{dRow('Approver', <span>{s.approver} {(() => { const au = mockUsers.find(u=>u.name===s.approver); return au && au.approvalLimit > 0 ? <span className="text-xs text-gray-500 ml-1">(limit: {fmtEur(au.approvalLimit, 'EUR')})</span> : au?.isCeo ? <span className="text-xs text-gray-500 ml-1">(unlimited)</span> : null; })()}</span>)}
{dRow('Atom', (() => { const a = atoms.find(x=>x.code===s.atom); return a ? `${a.code} — ${a.name}` : s.atom; })())}
{dRow('Cost Centre', (() => { const c = costCentres.find(x=>x.code===s.costCentre); return c ? `${c.code} — ${c.name}` : s.costCentre; })())}
{dRow('Region', (() => { const r = regions.find(x=>x.code===s.region); return r ? `${r.code} — ${r.name}` : s.region||'—'; })())}
{dRow('Project', s.project || '—')}
{s.originInvoiceId && (() => { const originInv = invoices.find(i => i.id === s.originInvoiceId); return originInv ? dRow('Origin Invoice', <span className="text-indigo-600 font-medium">{originInv.invoiceNumber} — {originInv.vendor}</span>) : null; })()}
{dRow('Exceptional Item', s.exceptional)}
{dRow('Time-sensitive', s.timeSensitive ? <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded font-semibold">Yes - Urgent</span> : 'No')}</div> <div className="mb-6"><h3 className="text-sm font-medium text-gray-500 mb-2">Business Justification</h3><div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-800">{s.justification || 'No justification provided.'}</div></div> <div className="mb-6"><h3 className="text-sm font-medium text-gray-500 mb-2">Linked Invoices</h3>
{(() => { const linked = getLinkedInvoices(s.id); const totalInvoicedEur = linked.reduce((sum,i) => sum + toEur(invoiceTotal(i), i.currency||s.currency), 0); const approvedEur = toEur(parseFloat(s.amount)||0, s.currency); const remainingEur = approvedEur - totalInvoicedEur; return (<> {linked.length > 0 ? (<>
<div className="mb-3 flex items-center space-x-4 text-sm"><span className="text-gray-600">Approved: <strong>{fmtEur(s.amount, s.currency)}</strong></span><span className="text-gray-600">Invoiced: <strong>€{totalInvoicedEur.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</strong></span><span className={remainingEur < 0 ? 'text-red-600 font-semibold' : 'text-green-600 font-semibold'}>Remaining: €{remainingEur.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span></div>
<div className="w-full bg-gray-200 rounded-full h-2 mb-3"><div className={`h-2 rounded-full ${remainingEur < 0 ? 'bg-red-500' : 'bg-green-500'}`} style={{width:`${Math.min(100,totalInvoicedEur/approvedEur*100)}%`}}></div></div>
<div className="space-y-2">{linked.map(inv => (<div key={inv.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border"><div><span className="font-medium text-gray-800">{inv.invoiceNumber}</span><span className="text-sm text-gray-500 ml-2">{inv.vendor} • {currencySymbol(inv.currency)}{invoiceTotal(inv).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}{inv.currency !== 'EUR' && ` (€${toEur(invoiceTotal(inv), inv.currency).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})})`}</span></div></div>))}</div>
</>) : <p className="text-sm text-gray-500">No invoices linked yet.</p>} </>); })()}
{s.status === 'Escalated' && (<div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg"><p className="text-sm text-orange-800"><strong>Escalated:</strong> Approved by {s.approvedBy} but exceeds their limit. Awaiting {s.escalatedTo||'CEO'} approval.</p></div>)}
{s.status === 'Approved' && canAssignInvoices() && (() => { const isRestricted = !hasPermission('invoices.assign_all'); if (isRestricted && s.submittedBy !== user.name) return null; const unlinkedInvs = invoices.filter(i => !i.spendApprovalId && (!isRestricted || i.submittedBy === user.name)); return unlinkedInvs.length > 0 ? (<div className="mt-4 pt-3 border-t border-gray-200"><label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Assign Invoice</label><select defaultValue="" onChange={e => { if (e.target.value) { const invId = Number(e.target.value); acceptMatch(invId, s.id); const inv = invoices.find(i=>i.id===invId); setSelectedSpend({...s}); } }} className={`w-full ${_g}`}><option value="" disabled>Select an unlinked invoice...</option>{unlinkedInvs.map(i => (<option key={i.id} value={i.id}>{i.invoiceNumber} — {i.vendor} (${i.amount})</option>))}</select></div>) : null; })()}
{s.status === 'Approved' && canAssignInvoices() && (<div className="mt-4 pt-3 border-t border-gray-200">
<input type="file" ref={spendFileInputRef} accept="application/pdf,image/*" multiple className="hidden" onChange={e => { if (e.target.files.length > 0) uploadInvoiceToSpend(e.target.files, s); }}/>
<button onClick={() => spendFileInputRef.current && spendFileInputRef.current.click()} disabled={isProcessing} className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed">
<Upload className="w-4 h-4"/><span>{isProcessing ? `Processing ${processingProgress.current} of ${processingProgress.total}...` : 'Upload Invoice'}</span>
{isProcessing && <svg className="animate-spin w-4 h-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
</button></div>)}
</div> {(s.status === 'Pending' || s.status === 'Escalated') && canApproveSpend() && (s.status !== 'Escalated' || user.isCeo || hasPermission('settings.manage_users')) && (<div className="flex space-x-3 pt-4 border-t border-gray-200"> <button onClick={() => { if (updateSpendStatus(s.id,'Approved') !== false) setSelectedSpend({...s,status:'Approved'}); }} className="px-5 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold">{s.status === 'Escalated' ? 'Final Approve' : 'Approve'}</button>
<button onClick={() => { if (updateSpendStatus(s.id,'Rejected') !== false) setSelectedSpend({...s,status:'Rejected'}); }} className="px-5 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-semibold">Reject</button></div>)}</div> </div>{escalationModal}</div>);}
if (spendView === 'form') { return (<div className={_pg}><div className="max-w-3xl mx-auto">{navBar}
<div className="bg-white rounded-xl shadow-lg p-8"> <div className={_fj+" mb-6"}><p className="text-sm text-gray-500">Required fields are marked with an asterisk <span className="text-red-500">*</span></p><button onClick={() => setSpendView('list')} className="text-sm text-indigo-600 hover:text-indigo-800 font-semibold">← Back to Spend Approvals</button></div>
{sf.originInvoiceId && (() => { const originInv = invoices.find(i => i.id === sf.originInvoiceId); return originInv ? (<div className="mb-5 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center space-x-2"><AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0"/><p className="text-sm text-blue-800">Created from invoice <strong>{originInv.invoiceNumber}</strong> ({originInv.vendor}). This spend approval will auto-link to the invoice upon approval.</p></div>) : null; })()}
<div className="mb-5"><label className={slc}>Additional people to notify (CC)</label><input value={sf.cc} onChange={e => updateSpend('cc',e.target.value)} placeholder="CC email..." className={sfc}/></div> <div className="grid grid-cols-1 md:grid-cols-2 gap-5"> <div><label className={slc}>Function / Department {req}</label><select value={sf.department} onChange={e => { const fn = functions.find(f=>f.name===e.target.value); updateSpend('department',e.target.value); if (fn) updateSpend('approver',fn.approver); }} className={sfc}><option value="">Select...</option>{functions.filter(f=>f.active).map(f=>(<option key={f.id} value={f.name}>{f.name}</option>))}</select></div> <div><label className={slc}>Request Title {req}</label><input value={sf.title} onChange={e => updateSpend('title',e.target.value)} className={sfc}/></div>
<div><label className={slc}>Currency {req}</label><select value={sf.currency} onChange={e => updateSpend('currency',e.target.value)} className={sfc}><option value="">Select...</option>{currencies.filter(c=>c.active).map(c=>(<option key={c.id} value={c.code}>{c.code} — {c.name}</option>))}</select></div> <div><label className={slc}>Approver {req}</label><p className="text-xs text-gray-500 mb-1">Auto-assigned from function.</p><input value={sf.approver} readOnly className={sfc + " bg-gray-50 cursor-not-allowed"}/></div>
<div><label className={slc}>Requested Amount {req}</label><p className="text-xs text-gray-500 mb-1"></p><input type="number" value={sf.amount} onChange={e => updateSpend('amount',e.target.value)} className={sfc}/></div>
<div><label className={slc}>Spend Category {req}</label><select value={sf.category} onChange={e => updateSpend('category',e.target.value)} className={sfc}><option value="">Select...</option>{categories.filter(c=>c.active).map(c=>(<option key={c.id} value={c.name}>{c.name}</option>))}</select></div>
<div><label className={slc}>Atom {req}</label><select value={sf.atom} onChange={e => updateSpend('atom',e.target.value)} className={sfc}><option value="">Select...</option>{atoms.filter(a=>a.active).map(a=>(<option key={a.id} value={a.code}>{a.code} — {a.name}</option>))}</select></div> <div><label className={slc}>Vendor / Supplier {req}</label><p className="text-xs text-gray-500 mb-1"></p><input value={sf.vendor} onChange={e => updateSpend('vendor',e.target.value)} className={sfc}/></div>
<div><label className={slc}>Cost Centre {req}</label><select value={sf.costCentre} onChange={e => updateSpend('costCentre',e.target.value)} className={sfc}><option value="">Select...</option>{costCentres.filter(c=>c.active).map(c=>(<option key={c.id} value={c.code}>{c.code} — {c.name}</option>))}</select></div>
<div><label className={slc}>Project</label><select value={sf.project} onChange={e => updateSpend('project',e.target.value)} className={sfc}><option value="">Select...</option>{projects.filter(p=>p.active).map(p=>(<option key={p.id} value={p.name}>{p.name}</option>))}</select></div>
<div><label className={slc}>Region {req}</label><select value={sf.region} onChange={e => updateSpend('region',e.target.value)} className={sfc}><option value="">Select...</option>{regions.filter(r=>r.active).map(r=>(<option key={r.id} value={r.code}>{r.code} — {r.name}</option>))}</select></div></div> <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-5"> <div>
<div className="mb-5"><label className={slc}>Time-sensitive approval</label><p className="text-xs text-gray-500 mb-2"></p><label className="flex items-center space-x-2 cursor-pointer"><input type="checkbox" checked={sf.timeSensitive} onChange={e => updateSpend('timeSensitive',e.target.checked)} className="w-4 h-4 text-green-600 rounded"/><span className="text-sm text-gray-700">Yes</span></label></div>
<div><label className={slc}>Is this an Exceptional Item? {req}</label><p className="text-xs text-gray-500 mb-2">Exceptional cost item.</p><div className="space-y-2"><label className="flex items-center space-x-2 cursor-pointer"><input type="radio" name="exceptional" value="Yes" checked={sf.exceptional==='Yes'} onChange={e => updateSpend('exceptional',e.target.value)} className="w-4 h-4 text-green-600"/><span className="text-sm text-gray-700">Yes</span></label><label className="flex items-center space-x-2 cursor-pointer"><input type="radio" name="exceptional" value="No" checked={sf.exceptional==='No'} onChange={e => updateSpend('exceptional',e.target.value)} className="w-4 h-4 text-green-600"/><span className="text-sm text-gray-700">No</span></label></div></div>
</div> <div><label className={slc}>Business Justification {req}</label><textarea value={sf.justification} onChange={e => updateSpend('justification',e.target.value)} rows={8} placeholder="Business justification..." className={sfc + " resize-none"}/></div></div>
<div className="mt-5 mb-6"><label className={slc}>Attachments</label><p className="text-xs text-gray-500 mb-2"></p><div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center"><Upload className="w-8 h-8 text-gray-400 mx-auto mb-2"/><p className="text-sm text-gray-500">Drop files to attach or <span className="text-green-600 font-semibold cursor-pointer">browse</span></p></div></div>
<div className="flex items-center space-x-4 pt-4 border-t border-gray-200"><button onClick={submitSpend} className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold">Submit</button><button onClick={() => setSpendView('list')} className="px-6 py-3 text-gray-600 hover:text-gray-800 transition font-semibold">Cancel</button></div></div> </div></div>);}
const sBadge = (status) => { const c = {Pending:'bg-yellow-100 text-yellow-800',Approved:'bg-green-100 text-green-800',Rejected:'bg-red-100 text-red-800',Escalated:'bg-orange-100 text-orange-800'}; return <span className={`px-2 py-1 rounded-full text-xs font-semibold ${c[status]||'bg-gray-100 text-gray-800'}`}>{status}</span>; };
const pendingFiltered = filteredSpends.filter(s => s.status === 'Pending');
const allPendingSelected = pendingFiltered.length > 0 && pendingFiltered.every(s => selectedSpendIds.includes(s.id));
const toggleSpendSelect = (id) => setSelectedSpendIds(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev,id]);
const toggleAllSpend = () => { if (allPendingSelected) { setSelectedSpendIds([]); } else { setSelectedSpendIds(pendingFiltered.map(s=>s.id)); } };
return (<div className={_pg}><div className="max-w-7xl mx-auto">{navBar}
{spendAlerts.length > 0 && (<div className="mb-4 space-y-2">{spendAlerts.map(alert => (<div key={alert.id} className={`flex items-start justify-between p-4 rounded-lg border ${alert.threshold === '100%' ? 'bg-red-50 border-red-300' : 'bg-orange-50 border-orange-300'}`}><div className="flex items-start space-x-3"><AlertCircle className={`w-5 h-5 mt-0.5 flex-shrink-0 ${alert.threshold === '100%' ? 'text-red-600' : 'text-orange-600'}`}/><div><p className={`text-sm font-semibold ${alert.threshold === '100%' ? 'text-red-800' : 'text-orange-800'}`}>{alert.threshold} Threshold Reached — {alert.spendRef}</p><p className={`text-sm ${alert.threshold === '100%' ? 'text-red-700' : 'text-orange-700'}`}>{alert.spendTitle} — Invoiced: €{alert.totalInvoiced.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})} of €{alert.approvedAmount.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})} — Approver: {alert.approver}</p></div></div><button onClick={() => dismissSpendAlert(alert.id)} className={`flex-shrink-0 ${alert.threshold === '100%' ? 'text-red-400 hover:text-red-600' : 'text-orange-400 hover:text-orange-600'}`}><X className="w-4 h-4"/></button></div>))}</div>)}
<div className="bg-white rounded-xl shadow-lg p-6"> <div className={_fj+" mb-6"}> <h2 className="text-2xl font-bold text-gray-800">Spend Approval List</h2> <div className="flex items-center space-x-3"> {selectedSpendIds.length > 0 && canApproveSpend() && (<> <span className="text-sm text-gray-600">{selectedSpendIds.length} selected</span>
<button onClick={() => bulkUpdateSpend('Approved')} className="flex items-center space-x-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm font-semibold"><CheckCircle className="w-4 h-4"/><span>Bulk Approve</span></button> <button onClick={() => bulkUpdateSpend('Rejected')} className="flex items-center space-x-1 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm font-semibold"><XCircle className="w-4 h-4"/><span>Bulk Reject</span></button> </>)}
<div className="relative"><input value={spendSearch} onChange={e => setSpendSearch(e.target.value)} placeholder="Search spend approvals..." className="px-4 py-2 pl-10 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 w-64"/><AlertCircle className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2"/></div> <div className="relative">
<button onClick={() => setShowSpendFilterPanel(!showSpendFilterPanel)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition flex items-center space-x-2"><span>Filters</span>{getSpendFilterCount()>0 && <span className="bg-green-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">{getSpendFilterCount()}</span>}</button> {showSpendFilterPanel && (<div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-xl border border-gray-200 p-6 z-10">
<div className={_fj+" mb-4"}><h3 className="font-semibold text-gray-800">Filter Spend Approvals</h3><button onClick={clearSpendFilters} className="text-sm text-green-600 hover:text-green-800">Clear All</button></div> <div className="space-y-4">
<div><label className={_lb}>Status</label><select value={spendFilters.status} onChange={e => updateSpendFilter('status',e.target.value)} className={`w-full ${_g}`}><option value="all">All</option><option value="Pending">Pending</option><option value="Escalated">Escalated</option><option value="Approved">Approved</option><option value="Rejected">Rejected</option></select></div>
<div><label className={_lb}>Vendor</label><select value={spendFilters.vendor} onChange={e => updateSpendFilter('vendor',e.target.value)} className={`w-full ${_g}`}><option value="all">All</option>{[...new Set(spendApprovals.map(s=>s.vendor))].sort().map(v=>(<option key={v} value={v}>{v}</option>))}</select></div>
<div><label className={_lb}>Category</label><select value={spendFilters.category} onChange={e => updateSpendFilter('category',e.target.value)} className={`w-full ${_g}`}><option value="all">All</option>{[...new Set(spendApprovals.map(s=>s.category))].sort().map(c=>(<option key={c} value={c}>{c}</option>))}</select></div>
<div><label className={_lb}>Date Range</label><div className="grid grid-cols-2 gap-2"><input type="date" value={spendFilters.dateFrom} onChange={e => updateSpendFilter('dateFrom',e.target.value)} className={_g}/><input type="date" value={spendFilters.dateTo} onChange={e => updateSpendFilter('dateTo',e.target.value)} className={_g}/></div></div>
<div><label className={_lb}>Amount Range</label><div className="grid grid-cols-2 gap-2"><input type="number" value={spendFilters.amountMin} onChange={e => updateSpendFilter('amountMin',e.target.value)} placeholder="Min" className={_g}/><input type="number" value={spendFilters.amountMax} onChange={e => updateSpendFilter('amountMax',e.target.value)} placeholder="Max" className={_g}/></div></div>
<div><label className={_lb}>Submitted By</label><select value={spendFilters.submittedBy} onChange={e => updateSpendFilter('submittedBy',e.target.value)} className={`w-full ${_g}`}><option value="all">All Submitters</option>{[...new Set(spendApprovals.map(s=>s.submittedBy))].sort().map(n=>(<option key={n} value={n}>{n}</option>))}</select></div>
<div><label className={_lb}>Approver</label><select value={spendFilters.approver} onChange={e => updateSpendFilter('approver',e.target.value)} className={`w-full ${_g}`}><option value="all">All</option>{[...new Set(spendApprovals.map(s=>s.approver))].sort().map(n=>(<option key={n} value={n}>{n}</option>))}</select></div>
<div><label className={_lb}>Project</label><select value={spendFilters.project} onChange={e => updateSpendFilter('project',e.target.value)} className={`w-full ${_g}`}><option value="all">All Projects</option>{[...new Set(spendApprovals.map(s=>s.project).filter(Boolean))].sort().map(p=>(<option key={p} value={p}>{p}</option>))}</select></div></div> <div className="mt-4 pt-4 border-t border-gray-200"><p className="text-sm text-gray-600">Showing {filteredSpends.length} of {spendApprovals.length} requests</p></div></div>)}</div>
<div className="relative"><label className="text-sm text-gray-600 mr-2">Group By:</label><select value={spendGroupBy} onChange={e => setSpendGroupBy(e.target.value)} className={_g}><option value="none">None</option><option value="status">Status</option><option value="vendor">Vendor</option><option value="category">Category</option><option value="department">Function</option><option value="submittedBy">Submitted By</option><option value="approver">Approver</option><option value="region">Region</option><option value="costCentre">Cost Centre</option><option value="atom">Atom</option><option value="project">Project</option><option value="dateRange">Date Range (Month/Year)</option><option value="threshold">Threshold Reached</option></select></div> <div className="relative">
<button onClick={() => setShowSpendColSelector(!showSpendColSelector)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300" >Columns</button> {showSpendColSelector && (<div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 p-4 z-10"> <h3 className="font-semibold text-gray-800 mb-3">Show/Hide Columns</h3> <div className="space-y-2">
{Object.entries({ref:'Reference',title:'Title',vendor:'Vendor',amount:'Amount',invoiced:'Invoiced',category:'Category',department:'Function',project:'Project',submittedBy:'Submitted By',date:'Date',status:'Status',approver:'Approver',region:'Region',costCentre:'Cost Centre',atom:'Atom'}).map(([k,label])=>(<label key={k} className="flex items-center space-x-2 cursor-pointer"><input type="checkbox" checked={spendVisibleCols[k]} onChange={() => toggleSpendCol(k)} className="w-4 h-4 text-green-600 rounded"/><span className="text-sm text-gray-700">{label}</span></label>))} </div></div>)}</div></div></div>
<div className={_fj+" mb-4"}> <span className="text-sm text-gray-500">{filteredSpends.length} of {spendApprovals.length} requests</span> <div className="flex items-center space-x-3">
{canCreateSpend() && <button onClick={() => { setSpendForm({ cc:'', title:'', currency:'', approver:'', amount:'', category:'', atom:'', vendor:'', costCentre:'', region:'', project:'', timeSensitive:false, exceptional:'', justification:'', department:'', originInvoiceId: null }); setSpendView('form'); }} className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold text-sm"><DollarSign className="w-4 h-4"/><span>Create Spend Approval</span></button>}
{canAssignInvoices() && <button onClick={runAutoMatch} className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-semibold text-sm"><ExternalLink className="w-4 h-4"/><span>Match Invoices</span></button>}</div></div> <div className="overflow-x-auto"><table className="w-full text-left">
<thead><tr className="border-b border-gray-200"> {canApproveSpend() && <th className="px-4 py-3 w-10"><input type="checkbox" checked={allPendingSelected} onChange={toggleAllSpend} className="w-4 h-4 text-green-600 rounded"/></th>}
{spendVisibleCols.ref && <th className={_th}>Reference</th>}
{spendVisibleCols.title && <th className={_th}>Title</th>}
{spendVisibleCols.vendor && <th className={_th}>Vendor</th>}
{spendVisibleCols.amount && <th className={_th}>Amount</th>}
{spendVisibleCols.invoiced && <th className={_th}>Invoiced</th>}
{spendVisibleCols.category && <th className={_th}>Category</th>}
{spendVisibleCols.department && <th className={_th}>Function</th>}
{spendVisibleCols.project && <th className={_th}>Project</th>}
{spendVisibleCols.approver && <th className={_th}>Approver</th>}
{spendVisibleCols.submittedBy && <th className={_th}>Submitted By</th>}
{spendVisibleCols.date && <th className={_th}>Date</th>}
{spendVisibleCols.status && <th className={_th}>Status</th>}
{spendVisibleCols.region && <th className={_th}>Region</th>}
{spendVisibleCols.costCentre && <th className={_th}>Cost Centre</th>}
{spendVisibleCols.atom && <th className={_th}>Atom</th>}
{canApproveSpend() && <th className={_th}>Actions</th>} </tr></thead> <tbody>{(() => { const getSpendGroupKey = (s) => { if (spendGroupBy==='date') return new Date(s.submittedAt).toLocaleDateString(); if (spendGroupBy==='dateRange') { const d = new Date(s.submittedAt); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; } if (spendGroupBy==='region') { const r = regions.find(x=>x.code===s.region); return r ? `${r.code} — ${r.name}` : s.region||'—'; } if (spendGroupBy==='costCentre') { const c = costCentres.find(x=>x.code===s.costCentre); return c ? `${c.code} — ${c.name}` : s.costCentre||'—'; } if (spendGroupBy==='atom') { const a = atoms.find(x=>x.code===s.atom); return a ? `${a.code} — ${a.name}` : s.atom||'—'; } if (spendGroupBy==='threshold') { const approvedEur = toEur(parseFloat(s.amount)||0, s.currency); if (approvedEur <= 0) return 'N/A'; const linked = invoices.filter(i => i.spendApprovalId === s.id); const totalEur = linked.reduce((sum,i) => sum + toEur(invoiceTotal(i), i.currency||s.currency), 0); const ratio = totalEur / approvedEur; if (ratio >= 1.0) return '100%+ Exceeded'; if (ratio >= 0.8) return '80%–99%'; if (ratio > 0) return 'Under 80%'; return 'No Invoices'; } return s[spendGroupBy]||'—'; }; const getSortKey = (s) => { if (spendGroupBy==='date') return s.submittedAt; if (spendGroupBy==='dateRange') { const d = new Date(s.submittedAt); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; } if (spendGroupBy==='threshold') { const g = getSpendGroupKey(s); const order = { '100%+ Exceeded':'0', '80%–99%':'1', 'Under 80%':'2', 'No Invoices':'3', 'N/A':'4' }; return order[g]||'5'; } return getSpendGroupKey(s); }; const formatGroupHeader = (key) => { if (spendGroupBy==='dateRange' && key && key.match(/^\d{4}-\d{2}$/)) { const [y,m] = key.split('-'); const monthName = new Date(Number(y), Number(m)-1).toLocaleString('en-GB',{month:'long',year:'numeric'}); return monthName; } return key; }; return (spendGroupBy !== 'none' ? [...filteredSpends].sort((a,b) => { const ka = getSortKey(a); const kb = getSortKey(b); return ka<kb?-1:ka>kb?1:0; }) : filteredSpends).map((s,i,arr) => { const groupKey = getSpendGroupKey(s);
const prevKey = i>0 ? getSpendGroupKey(arr[i-1]) : null;
const showHeader = spendGroupBy !== 'none' && groupKey !== prevKey;
return (<React.Fragment key={s.id}> {showHeader && <tr className="bg-gray-50"><td colSpan={99} className="px-4 py-2 text-sm font-semibold text-gray-700">{formatGroupHeader(groupKey)}</td></tr>}
<tr className="border-b border-gray-100 hover:bg-gray-50"> {canApproveSpend() && <td className="px-4 py-3">{(s.status==='Pending' || s.status==='Escalated') ? <input type="checkbox" checked={selectedSpendIds.includes(s.id)} onChange={() => toggleSpendSelect(s.id)} className="w-4 h-4 text-green-600 rounded"/> : null}</td>}
{spendVisibleCols.ref && <td className="px-4 py-3 text-sm font-mono font-semibold"><button onClick={() => setSelectedSpend(s)} className="text-indigo-600 hover:text-indigo-800 underline">{s.ref}</button></td>}
{spendVisibleCols.title && <td className="px-4 py-3 text-sm font-medium"><button onClick={() => setSelectedSpend(s)} className="text-indigo-600 hover:text-indigo-800 hover:underline text-left font-medium">{s.title}</button>{s.timeSensitive && <span className="ml-2 px-1.5 py-0.5 bg-orange-100 text-orange-700 text-xs rounded">Urgent</span>}</td>}
{spendVisibleCols.vendor && <td className={_td}>{s.vendor}</td>}
{spendVisibleCols.amount && <td className="px-4 py-3 text-sm text-gray-800 font-semibold">{fmtEur(s.amount, s.currency)}{s.currency !== 'EUR' && <div className="text-xs text-gray-400 font-normal">{s.currency} {Number(s.amount).toLocaleString()}</div>}</td>}
{spendVisibleCols.invoiced && (() => { const linked = getLinkedInvoices(s.id); const totalEur = linked.reduce((sum,i) => sum + toEur(invoiceTotal(i), i.currency||s.currency), 0); const approvedEur = toEur(parseFloat(s.amount)||0, s.currency); const pct = approvedEur > 0 ? (totalEur/approvedEur)*100 : 0; const colour = linked.length === 0 ? 'text-gray-400' : pct > 100 ? 'text-red-600' : pct >= 90 ? 'text-green-600' : pct >= 50 ? 'text-orange-600' : 'text-yellow-600'; return <td className="px-4 py-3 text-sm"><div className={`font-semibold ${colour}`}>€{totalEur.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</div><div className="w-full bg-gray-200 rounded-full h-1.5 mt-1"><div className={`h-1.5 rounded-full ${pct > 100 ? 'bg-red-500' : pct >= 90 ? 'bg-green-500' : pct >= 50 ? 'bg-orange-400' : pct > 0 ? 'bg-yellow-400' : 'bg-gray-200'}`} style={{width:`${Math.min(100,pct)}%`}}></div></div><div className="text-xs text-gray-500 mt-0.5">{pct.toFixed(0)}% • {linked.length} inv</div></td>; })()}
{spendVisibleCols.category && <td className={_td}>{s.category}</td>}
{spendVisibleCols.department && <td className={_td}>{s.department||'—'}</td>}
{spendVisibleCols.project && <td className={_td}>{s.project||'—'}</td>}
{spendVisibleCols.approver && <td className={_td}>{s.approver}</td>}
{spendVisibleCols.submittedBy && <td className={_td}>{s.submittedBy}</td>}
{spendVisibleCols.date && <td className={_td}>{new Date(s.submittedAt).toLocaleDateString()}</td>}
{spendVisibleCols.status && <td className="px-4 py-3">{sBadge(s.status)}</td>}
{spendVisibleCols.region && <td className={_td}>{(() => { const r = regions.find(x=>x.code===s.region); return r ? `${r.code} — ${r.name}` : s.region||'—'; })()}</td>}
{spendVisibleCols.costCentre && <td className={_td}>{(() => { const c = costCentres.find(x=>x.code===s.costCentre); return c ? `${c.code} — ${c.name}` : s.costCentre; })()}</td>}
{spendVisibleCols.atom && <td className={_td}>{(() => { const a = atoms.find(x=>x.code===s.atom); return a ? `${a.code} — ${a.name}` : s.atom; })()}</td>}
{canApproveSpend() && <td className="px-4 py-3">{(s.status==='Pending' || (s.status==='Escalated' && (user.isCeo || hasPermission('settings.manage_users')))) && <div className="flex space-x-1"><button onClick={() => updateSpendStatus(s.id,'Approved')} className="p-1 text-green-600 hover:bg-green-50 rounded" title="Approve"><CheckCircle className="w-4 h-4"/></button><button onClick={() => updateSpendStatus(s.id,'Rejected')} className="p-1 text-red-600 hover:bg-red-50 rounded" title="Reject"><XCircle className="w-4 h-4"/></button></div>}</td>} </tr></React.Fragment>); }); })()}</tbody> </table></div>
{filteredSpends.length === 0 && <div className="text-center py-12"><p className="text-gray-500">No results found.</p></div>}</div> </div>{escalationModal}</div>);}
if (currentPage === 'matching') { const isRestricted = !hasPermission('invoices.assign_all');
const linked = invoices.filter(i => i.spendApprovalId);
const unlinked = invoices.filter(i => !i.spendApprovalId && (!isRestricted || i.submittedBy === user.name));
const getBudgetColor = (rem, total) => { if (total <= 0) return 'text-gray-500'; if (rem < 0) return 'text-red-600'; if (rem < total * 0.1) return 'text-orange-600'; return 'text-green-600'; };
return (<div className={_pg}><div className="max-w-7xl mx-auto"> <div className="bg-white rounded-lg shadow-lg p-6 mb-6"><div className={_fj}> <div className="flex items-center space-x-3"><ExternalLink className="w-8 h-8 text-indigo-600"/><div><h1 className="text-2xl font-bold text-gray-800">Invoice Matching</h1><p className="text-sm text-gray-500">{pendingMatches.length} spend approvals with suggested invoices • {unlinked.length} unlinked invoices</p></div></div>
<div className="flex items-center space-x-3"><button onClick={() => setCurrentPage('spend-approval')} className="flex items-center space-x-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300" ><ArrowRight className="w-4 h-4 rotate-180"/><span>Back to Spend Approvals</span></button><button onClick={() => setCurrentPage('landing')} className="flex items-center space-x-2 px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200"><Home className="w-4 h-4"/><span>Dashboard</span></button></div>
</div></div> <details className="bg-white rounded-lg shadow-lg mb-6"><summary className="px-6 py-3 cursor-pointer text-sm font-semibold text-indigo-600 hover:text-indigo-800">How matching scores work</summary><div className="px-6 pb-4"><table className="w-full text-sm text-left border-collapse"><thead><tr className="border-b border-gray-200"><th className="py-2 pr-4 font-semibold text-gray-700">Signal</th><th className="py-2 pr-4 font-semibold text-gray-700 w-16">Score</th><th className="py-2 font-semibold text-gray-700">How it works</th></tr></thead><tbody className="text-gray-600"><tr className="border-b border-gray-100"><td className="py-2 pr-4 font-medium">SA Reference</td><td className="py-2 pr-4 font-bold text-blue-600">+60</td><td className="py-2">Spend approval reference (e.g. SA-0001) found in the invoice description or invoice number</td></tr><tr className="border-b border-gray-100"><td className="py-2 pr-4 font-medium">Vendor match</td><td className="py-2 pr-4 font-bold text-green-600">+30</td><td className="py-2">Invoice vendor name contains the spend vendor or vice versa</td></tr><tr className="border-b border-gray-100"><td className="py-2 pr-4 font-medium">Partial vendor</td><td className="py-2 pr-4 font-bold text-yellow-600">+15</td><td className="py-2">At least one word from the spend vendor appears in the invoice vendor</td></tr><tr className="border-b border-gray-100"><td className="py-2 pr-4 font-medium">Amount match</td><td className="py-2 pr-4 font-bold text-purple-600">+20</td><td className="py-2">Invoice total (converted to EUR) is within ±10% of the spend amount</td></tr></tbody></table><p className="mt-3 text-xs text-gray-500">Minimum score to suggest: <strong>15</strong>. Fully invoiced spend approvals only show high-confidence matches (score ≥ 60). All amounts are compared in EUR using current exchange rates.</p></div></details> {pendingMatches.length > 0 && (<div className="space-y-6 mb-6">{pendingMatches.map(m => { const spAmt = parseFloat(m.spendAmount)||0; return ( <div key={m.spendId} className="bg-white rounded-lg shadow-lg overflow-hidden">
<div className="bg-indigo-50 px-6 py-4 border-b border-indigo-200"><div className={_fj}><div><div className="flex items-center space-x-3 mb-1"><span className="font-mono text-sm font-bold text-indigo-600">{m.spendRef}</span><span className="text-lg font-bold text-gray-800">{m.spendTitle}</span></div>
<div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-500"><span>Vendor: <strong className="text-gray-700">{m.spendVendor}</strong></span><span>Approved: <strong className="text-gray-700">{fmtEur(m.spendAmount, m.spendCurrency)}</strong>{m.spendCurrency !== 'EUR' && <span className="text-gray-400 ml-1">({m.spendCurrency} {Number(m.spendAmount).toLocaleString()})</span>}</span><span>Category: <strong className="text-gray-700">{m.spendCategory}</strong></span><span>Region: <strong className="text-gray-700">{m.spendRegion}</strong></span><span>Atom: <strong className="text-gray-700">{m.spendAtom}</strong></span></div></div>
<div className="text-right"><div className={`text-sm font-semibold ${getBudgetColor(m.remaining, spAmt)}`}>{m.remaining >= 0 ? <span>€{toEur(m.remaining, m.spendCurrency).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})} remaining</span> : <span>Overspent by €{toEur(Math.abs(m.remaining), m.spendCurrency).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span>}</div>{m.linkedCount > 0 && <div className="text-xs text-gray-500">{m.linkedCount} invoice{m.linkedCount>1?'s':''} already linked</div>}<button onClick={() => dismissSpendMatch(m.spendId)} className="mt-1 text-xs text-red-500 hover:text-red-700 font-semibold">Dismiss All</button></div></div></div>
<div className="p-6"><p className="text-xs font-semibold text-gray-500 uppercase mb-3">Suggested Invoices ({m.suggestions.length})</p><div className="space-y-3">{m.suggestions.map(sg => ( <div key={sg.invoiceId} className={`flex items-center justify-between p-4 rounded-lg border ${sg.score>=60?'border-blue-400 bg-blue-50':sg.score>=50?'border-green-300 bg-green-50':sg.score>=30?'border-yellow-300 bg-yellow-50':'border-gray-200 bg-gray-50'}`}>
<div className="flex-1"><div className="flex items-center space-x-3 mb-1"><span className="font-semibold text-gray-800">{sg.invoiceNumber}</span><span className="px-2 py-0.5 bg-white border rounded text-sm text-gray-700">{sg.invoiceVendor}</span><span className="font-bold text-gray-900">{fmtEur(sg.invoiceAmount, sg.invoiceCurrency)}{sg.invoiceCurrency && sg.invoiceCurrency !== 'EUR' && <span className="text-gray-400 text-xs ml-1">({sg.invoiceCurrency} {Number(sg.invoiceAmount).toLocaleString()})</span>}</span>{sg.reasons.includes('SA reference match') && <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-bold">SA REF</span>}<span className={`px-2 py-0.5 rounded text-xs font-semibold ${sg.invoiceStatus==='Approved'?'bg-green-100 text-green-700':sg.invoiceStatus==='Rejected'?'bg-red-100 text-red-700':'bg-yellow-100 text-yellow-700'}`}>{sg.invoiceStatus}</span></div>
<div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500"><span>Date: <strong className="text-gray-700">{sg.invoiceDate}</strong></span><span>Due: <strong className="text-gray-700">{sg.invoiceDueDate}</strong></span>{sg.invoiceSubmittedBy && <span>By: <strong className="text-gray-700">{sg.invoiceSubmittedBy}</strong></span>}</div>
{sg.invoiceDescription && <p className="mt-1 text-xs text-gray-500 italic">{sg.invoiceDescription}</p>}
<div className="flex flex-wrap gap-1 mt-2">{sg.reasons.map((r,i) => <span key={i} className={`px-2 py-0.5 rounded-full text-xs font-medium border ${r.includes('SA reference')?'bg-blue-100 text-blue-700 border-blue-300':'bg-white text-gray-600 border-gray-300'}`}>{r}</span>)}</div></div>
<div className="flex items-center space-x-3 ml-4 flex-shrink-0"><div className={`text-center ${sg.score>=60?'text-blue-700':sg.score>=50?'text-green-700':sg.score>=30?'text-yellow-700':'text-gray-500'}`}><p className="text-2xl font-bold">{sg.score}</p><p className="text-xs">{sg.score>=60?'exact':sg.score>=50?'high':sg.score>=30?'good':'low'}</p></div>
<button onClick={() => acceptMatch(sg.invoiceId, m.spendId)} className={`px-4 py-2 text-white rounded-lg font-semibold text-sm ${sg.score>=60?'bg-blue-600 hover:bg-blue-700':'bg-green-600 hover:bg-green-700'}`}>{sg.score>=60?'Link':'Assign'}</button>
<button onClick={() => { setPendingMatches(prev => prev.map(p => p.spendId===m.spendId ? {...p, suggestions: p.suggestions.filter(s=>s.invoiceId!==sg.invoiceId)} : p).filter(p=>p.suggestions.length>0)); }} className="text-xs text-red-500 hover:text-red-700 font-semibold">Decline</button></div></div>))}</div>
<div className="mt-4 pt-4 border-t border-gray-200"><p className="text-xs font-semibold text-gray-500 uppercase mb-2">Manually Assign Invoice</p>
<select defaultValue="" onChange={e => { if (e.target.value) { acceptMatch(Number(e.target.value), m.spendId); e.target.value=''; } }} className={`w-full ${_g}`}><option value="" disabled>Select an unlinked invoice...</option>{unlinked.map(i => (<option key={i.id} value={i.id}>{i.invoiceNumber} — {i.vendor} (${i.amount}) — {i.date}</option>))}</select></div></div></div>); })}</div>)}
{pendingMatches.length === 0 && <div className="bg-white rounded-lg shadow-lg p-12 mb-6 text-center"><p className="text-gray-500">No matching invoices found.</p></div>}
</div></div>);}
if (currentPage === 'settings') { return ( <div className={_pg}> {showInviteModal && ( <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"> <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6"> <h3 className="text-xl font-bold text-gray-900 mb-4">Invite New User</h3> <div className="space-y-4"> <div> <label className={_lb}>Email Address</label> <input type="email" value={inviteEmail}
onChange={(e) => setInviteEmail(e.target.value)}
placeholder="user@company.com" className={`w-full ${_i}`}/></div> <div> <label className={_lb}>Role</label> <select value={inviteRole}
onChange={(e) => setInviteRole(e.target.value)} className={`w-full ${_i}`} >{roles.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}</select></div> </div> <div className="flex space-x-3 mt-6">
<button onClick={() => { setShowInviteModal(false); setInviteEmail('');
setInviteRole('User'); }} className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"  > Cancel</button> <button
onClick={inviteUser} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"  > Send Invitation</button></div></div></div>)}
{showRemoveConfirmation && ( <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"> <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6">
<h3 className="text-xl font-bold text-gray-900 mb-3">Remove User</h3><p className="text-gray-600 mb-4">Remove <strong>{userToRemove?.name}</strong> ({userToRemove?.email})? Access will be revoked immediately.</p>
<div className="flex space-x-3"><button onClick={cancelRemoveUser} className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">Cancel</button><button onClick={confirmRemoveUser} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">Remove</button></div></div></div>)} {showGdprModal && ( <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"> <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6">
<h3 className="text-xl font-bold text-gray-900 mb-3">GDPR Anonymization</h3><p className="text-gray-600 mb-4">Anonymize <strong>{userToAnonymize?.name}</strong> ({userToAnonymize?.email})? This cannot be undone.</p>
<div className="mb-4"><label className={_lb}>Type <strong>{userToAnonymize?.email}</strong> to confirm:</label><input type="text" value={gdprConfirmEmail} onChange={(e) => setGdprConfirmEmail(e.target.value)} placeholder="Enter email" className={`w-full ${_i}`}/></div>
<div className="flex space-x-3"><button onClick={cancelGdprAnonymization} className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">Cancel</button><button onClick={confirmGdprAnonymization} disabled={gdprConfirmEmail !== userToAnonymize?.email} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">Anonymize</button></div></div></div>)}
<div className="max-w-7xl mx-auto"> <div className="bg-white rounded-lg shadow-lg p-6 mb-6"> <div className={_fj+" mb-6"}> <div className="flex items-center space-x-3"> <Settings className="w-8 h-8 text-indigo-600"/> <h1 className="text-3xl font-bold text-gray-800">Settings</h1></div> <div className="flex items-center space-x-4"> <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 rounded-lg"> <User className="w-5 h-5 text-indigo-600"/> <div className="text-sm"> <p className="font-semibold text-gray-800">{user.name}</p>
<p className="text-xs text-gray-600">{user.role}</p></div></div> <button onClick={() => setCurrentPage('landing')} className="flex items-center space-x-2 px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200"><Home className="w-4 h-4"/><span>Dashboard</span></button> <button onClick={logout} className="flex items-center space-x-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"><LogOut className="w-4 h-4"/><span>Logout</span></button></div></div> <div className="border-b border-gray-200 mb-6">
<nav className="flex space-x-8"> <button
onClick={() => setSettingsTab('users')} className={`py-4 px-1 border-b-2 font-medium text-sm ${ settingsTab === 'users' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300' } ${!canManagePermissions() ? 'hidden' : ''}`} > <div className={_fx}> <User className="w-4 h-4"/> <span>Users</span></div></button> <button
onClick={() => setSettingsTab('atoms')} className={`py-4 px-1 border-b-2 font-medium text-sm ${ settingsTab === 'atoms' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300' }`} > <div className={_fx}> <Settings className="w-4 h-4"/> <span>Lookups</span></div></button> <button
onClick={() => setSettingsTab('audit')} className={`py-4 px-1 border-b-2 font-medium text-sm ${ settingsTab === 'audit' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300' }`} > <div className={_fx}> <FileText className="w-4 h-4"/> <span>Audit Log</span></div></button> {hasPermission('settings.manage_users') && <button
onClick={() => setSettingsTab('emails')} className={`py-4 px-1 border-b-2 font-medium text-sm ${ settingsTab === 'emails' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300' }`} > <div className={_fx}> <Mail className="w-4 h-4"/> <span>Email Templates</span></div></button>} <button
onClick={() => setSettingsTab('api')} className={`py-4 px-1 border-b-2 font-medium text-sm ${ settingsTab === 'api' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300' }`} > <div className={_fx}> <ExternalLink className="w-4 h-4"/> <span>API</span></div></button> {hasPermission('settings.manage_users') && <button
onClick={() => setSettingsTab('roles')} className={`py-4 px-1 border-b-2 font-medium text-sm ${ settingsTab === 'roles' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300' }`} > <div className={_fx}> <Shield className="w-4 h-4"/> <span>Roles & Permissions</span></div></button>} </nav></div> {settingsTab === 'users' && ( <div> <div className="mb-6 flex items-center justify-between"> <div> <h2 className="text-xl font-bold text-gray-800 mb-2">User Management</h2>
<p className="text-gray-600">Manage users, roles, and access levels</p></div> {canManagePermissions() && ( <button
onClick={() => setShowInviteModal(true)} className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-semibold" > <User className="w-4 h-4"/> <span>Invite User</span></button>)}</div> <div className="overflow-x-auto"> <table className="w-full"> <thead className="bg-gray-50"> <tr> <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Name</th> <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Email</th>
<th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Role</th> <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Limit</th> <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Status</th> <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Created</th> <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Invited By</th> <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Actions</th></tr></thead> <tbody className="divide-y divide-gray-200"> {mockUsers.map((usr) => ( <tr key={usr.id} className="hover:bg-gray-50">
<td className="px-6 py-4 text-sm font-medium text-gray-900">{usr.name}</td> <td className="px-6 py-4 text-sm text-gray-600">{usr.email}</td> <td className="px-6 py-4 text-sm"> {canManagePermissions() ? ( <select value={usr.role}
onChange={(e) => updateUserRole(usr.id, e.target.value)} className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
disabled={usr.status === 'Pending'} >{roles.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}</select> ) : ( <span className={`px-3 py-1 rounded-full text-xs font-semibold ${ usr.role === 'Admin' ? 'bg-purple-100 text-purple-700' : usr.role === 'Finance' ? 'bg-blue-100 text-blue-700' : usr.role === 'Approver' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700' }`}> {usr.role}</span>)}</td> <td className="px-6 py-4 text-sm">{canManagePermissions() && (() => { const r = roles.find(rl => rl.name === usr.role); return r && r.permissions.includes('spend.approve'); })() ? <div className="flex items-center"><span className="text-sm text-gray-500 mr-1">€</span><input type="number" value={usr.approvalLimit||0} onChange={e => { const val = parseInt(e.target.value)||0; setMockUsers(prev=>prev.map(u=>u.id===usr.id?{...u,approvalLimit:val}:u)); }} className="w-24 px-2 py-1 border border-gray-300 rounded text-sm"/></div> : <span className="text-gray-500">{usr.isCeo ? 'Unlimited' : usr.approvalLimit > 0 ? `€${usr.approvalLimit.toLocaleString()}` : '—'}</span>}</td> <td className="px-6 py-4 text-sm">
<span className={`px-3 py-1 rounded-full text-xs font-semibold ${ usr.status === 'Active' ? 'bg-green-100 text-green-700' : usr.status === 'Anonymized' ? 'bg-gray-100 text-gray-700' : usr.status === 'Removed' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700' }`}> {usr.status}</span></td> <td className="px-6 py-4 text-sm text-gray-600"> {new Date(usr.createdAt).toLocaleDateString()}</td> <td className="px-6 py-4 text-sm text-gray-600">{usr.invitedBy}</td> <td className="px-6 py-4 text-sm"> {canManagePermissions() && usr.status !== 'Anonymized' && (
<div className={_fx}> {usr.status === 'Pending' && ( <button
onClick={() => resendInvitation(usr)} className="text-indigo-600 hover:text-indigo-800 text-xs font-medium" > Resend</button>)}
{(usr.status === 'Active' || usr.status === 'Removed') && ( <button
onClick={() => initiateGdprAnonymization(usr)} className="text-blue-600 hover:text-blue-800 text-xs font-medium"
title="GDPR Anonymization" > Anonymize</button>)}
{(usr.status === 'Active' || usr.status === 'Pending') && ( <button
onClick={() => initiateRemoveUser(usr)} className="text-red-600 hover:text-red-800"
title="Revoke Access" > <Trash2 className="w-4 h-4"/></button>)}</div>)}
{usr.status === 'Anonymized' && ( <span className="text-xs text-gray-500">GDPR Anonymized</span>)}
{usr.status === 'Removed' && !canManagePermissions() && ( <span className="text-xs text-gray-500">Access Revoked</span>)}
{usr.status !== 'Removed' && usr.status !== 'Anonymized' && !canManagePermissions() && ( <span className="text-gray-400 text-xs">No permission</span>)}</td></tr> ))}</tbody></table></div> <div className="mt-4 text-sm text-gray-600"> <strong>Total Users:</strong> {mockUsers.length} ({mockUsers.filter(u => u.status === 'Active').length} active, {mockUsers.filter(u => u.status === 'Pending').length} pending, {mockUsers.filter(u => u.status === 'Removed').length} removed, {mockUsers.filter(u => u.status === 'Anonymized').length} anonymized)</div>
{!canManagePermissions() && ( <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4"> <p className="text-sm text-yellow-800">
<strong>Note:</strong> Only Admins can manage users and permissions.</p></div>)}</div>)}
{settingsTab === 'atoms' && ( <div>
{(() => { const renderLookup = (key, title, items, setItems, editId, setEditId, newItem, setNewItem, prefix, hasCode=true, maxLen=5, placeholder='Code') => {
const isCollapsed = collapsedLookups[key];
return (
<div className="border border-gray-200 rounded-lg overflow-hidden">
<button onClick={() => toggleLookup(key)} className="w-full flex items-center justify-between px-5 py-4 bg-gray-50 hover:bg-gray-100 transition">
<h2 className="text-lg font-bold text-gray-800">{title}</h2>
<div className="flex items-center space-x-2"><span className="text-xs text-gray-500">{items.length} items</span>{isCollapsed ? <ChevronDown className="w-5 h-5 text-gray-500"/> : <ChevronUp className="w-5 h-5 text-gray-500"/>}</div>
</button>
{!isCollapsed && (<div className="p-5">
<div className="flex space-x-2 mb-4">{hasCode && <input placeholder={placeholder} value={newItem.code||''} onChange={e => setNewItem(p=>({...p,code:e.target.value.toUpperCase()}))} className={`w-28 ${_i}`} maxLength={maxLen}/>}<input placeholder="Name" value={newItem.name} onChange={e => setNewItem(p=>({...p,name:e.target.value}))} className={`flex-1 ${_i}`}/><button onClick={() => { if (hasCode ? (!newItem.code||!newItem.name) : !newItem.name) return; if (hasCode && items.find(i=>i.code===newItem.code)) { alert('Code exists'); return; } if (!hasCode && items.find(i=>i.name===newItem.name)) { alert('Name exists'); return; } const n = hasCode ? {id:Date.now(),code:newItem.code,name:newItem.name,active:true} : {id:Date.now(),name:newItem.name,active:true}; setItems(prev=>[...prev,n]); setNewItem(hasCode?{code:'',name:''}:{name:''}); setAuditLog(prev=>[...prev,{id:Date.now(),action:`${prefix}_CREATED`,details:`${title} created: ${hasCode?n.code+' — ':''}${n.name}`,performedBy:user.name,performedAt:new Date().toISOString()}]); }} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-semibold">Add</button></div>
<table className="w-full text-left"><thead><tr className="border-b border-gray-200">{hasCode && <th className={_th}>Code</th>}<th className={_th}>Name</th><th className={_th}>Status</th><th className={_th}>Actions</th></tr></thead><tbody>{items.map(item => (<tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
{editId===item.id ? (<>{hasCode && <td className="px-4 py-2"><input value={item.code} onChange={e => setItems(prev=>prev.map(x=>x.id===item.id?{...x,code:e.target.value.toUpperCase()}:x))} className={`w-20 ${_i}`} maxLength={maxLen}/></td>}<td className="px-4 py-2"><input value={item.name} onChange={e => setItems(prev=>prev.map(x=>x.id===item.id?{...x,name:e.target.value}:x))} className={`w-full ${_i}`}/></td><td className="px-4 py-2"><span className={`px-2 py-0.5 rounded text-xs font-semibold ${item.active?'bg-green-100 text-green-700':'bg-gray-100 text-gray-500'}`}>{item.active?'Active':'Inactive'}</span></td><td className="px-4 py-2"><button onClick={() => { setEditId(null); setAuditLog(prev=>[...prev,{id:Date.now(),action:`${prefix}_UPDATED`,details:`${title} updated: ${hasCode?item.code+' — ':''}${item.name}`,performedBy:user.name,performedAt:new Date().toISOString()}]); }} className="text-xs text-green-600 font-semibold">Save</button></td></>) : (<>{hasCode && <td className="px-4 py-3 text-sm font-mono font-semibold text-indigo-600">{item.code}</td>}<td className={_td}>{item.name}</td><td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs font-semibold ${item.active?'bg-green-100 text-green-700':'bg-gray-100 text-gray-500'}`}>{item.active?'Active':'Inactive'}</span></td><td className="px-4 py-3 text-sm"><div className="flex space-x-2"><button onClick={() => setEditId(item.id)} className="text-xs text-indigo-600 font-semibold">Edit</button><button onClick={() => { setItems(prev=>prev.map(x=>x.id===item.id?{...x,active:!x.active}:x)); setAuditLog(prev=>[...prev,{id:Date.now(),action:`${prefix}_${item.active?'DEACTIVATED':'ACTIVATED'}`,details:`${title} ${item.active?'deactivated':'activated'}: ${hasCode?item.code+' — ':''}${item.name}`,performedBy:user.name,performedAt:new Date().toISOString()}]); }} className={`text-xs font-semibold ${item.active?'text-red-600':'text-green-600'}`}>{item.active?'Deactivate':'Activate'}</button></div></td></>)}</tr>))}</tbody></table>
</div>)}</div>);}; return (<div className="space-y-4">
{renderLookup('atoms','Atoms',atoms,setAtoms,editAtom,setEditAtom,newAtom,setNewAtom,'ATOM',true,5,'Code (e.g. FIN)')}
{renderLookup('costCentres','Cost Centres',costCentres,setCostCentres,editCC,setEditCC,newCC,setNewCC,'CC',true,6,'Code (e.g. CC600)')}
{renderLookup('regions','Regions',regions,setRegions,editRegion,setEditRegion,newRegion,setNewRegion,'REGION',true,5,'Code (e.g. LATAM)')}
<div className="border border-gray-200 rounded-lg overflow-hidden">
<button onClick={() => toggleLookup('currencies')} className="w-full flex items-center justify-between px-5 py-4 bg-gray-50 hover:bg-gray-100 transition">
<h2 className="text-lg font-bold text-gray-800">Currencies</h2>
<div className="flex items-center space-x-2"><span className="text-xs text-gray-500">{currencies.length} items</span>{collapsedLookups.currencies ? <ChevronDown className="w-5 h-5 text-gray-500"/> : <ChevronUp className="w-5 h-5 text-gray-500"/>}</div>
</button>
{!collapsedLookups.currencies && (<div className="p-5">
<div className="flex space-x-2 mb-4"><input placeholder="Code (e.g. JPY)" value={newCurrency.code||''} onChange={e => setNewCurrency(p=>({...p,code:e.target.value.toUpperCase()}))} className={`w-28 ${_i}`} maxLength={3}/><input placeholder="Name" value={newCurrency.name} onChange={e => setNewCurrency(p=>({...p,name:e.target.value}))} className={`flex-1 ${_i}`}/><input placeholder="Rate to EUR" type="number" step="0.000001" value={newCurrency.exchangeRateToEur||''} onChange={e => setNewCurrency(p=>({...p,exchangeRateToEur:e.target.value}))} className={`w-32 ${_i}`}/><button onClick={() => { if (!newCurrency.code||!newCurrency.name||!newCurrency.exchangeRateToEur) return; if (currencies.find(i=>i.code===newCurrency.code)) { alert('Code exists'); return; } const n = {id:Date.now(),code:newCurrency.code,name:newCurrency.name,exchangeRateToEur:newCurrency.exchangeRateToEur,active:true}; setCurrencies(prev=>[...prev,n]); setNewCurrency({code:'',name:'',exchangeRateToEur:''}); setAuditLog(prev=>[...prev,{id:Date.now(),action:'CURRENCY_CREATED',details:`Currency created: ${n.code} — ${n.name} (Rate: ${n.exchangeRateToEur})`,performedBy:user.name,performedAt:new Date().toISOString()}]); }} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-semibold">Add</button></div>
<table className="w-full text-left"><thead><tr className="border-b border-gray-200"><th className={_th}>Code</th><th className={_th}>Name</th><th className={_th}>Rate to EUR</th><th className={_th}>Status</th><th className={_th}>Actions</th></tr></thead><tbody>{currencies.map(item => (<tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
{editCurrency===item.id ? (<><td className="px-4 py-2"><input value={item.code} onChange={e => setCurrencies(prev=>prev.map(x=>x.id===item.id?{...x,code:e.target.value.toUpperCase()}:x))} className={`w-20 ${_i}`} maxLength={3}/></td><td className="px-4 py-2"><input value={item.name} onChange={e => setCurrencies(prev=>prev.map(x=>x.id===item.id?{...x,name:e.target.value}:x))} className={`w-full ${_i}`}/></td><td className="px-4 py-2"><input type="number" step="0.000001" value={item.exchangeRateToEur||''} onChange={e => setCurrencies(prev=>prev.map(x=>x.id===item.id?{...x,exchangeRateToEur:e.target.value}:x))} className={`w-28 ${_i}`} disabled={item.code==='EUR'}/></td><td className="px-4 py-2"><span className={`px-2 py-0.5 rounded text-xs font-semibold ${item.active?'bg-green-100 text-green-700':'bg-gray-100 text-gray-500'}`}>{item.active?'Active':'Inactive'}</span></td><td className="px-4 py-2"><button onClick={() => { setEditCurrency(null); setAuditLog(prev=>[...prev,{id:Date.now(),action:'CURRENCY_UPDATED',details:`Currency updated: ${item.code} — ${item.name} (Rate: ${item.exchangeRateToEur})`,performedBy:user.name,performedAt:new Date().toISOString()}]); }} className="text-xs text-green-600 font-semibold">Save</button></td></>) : (<><td className="px-4 py-3 text-sm font-mono font-semibold text-indigo-600">{item.code}</td><td className={_td}>{item.name}</td><td className="px-4 py-3 text-sm font-mono">{parseFloat(item.exchangeRateToEur||1).toFixed(6)}</td><td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs font-semibold ${item.active?'bg-green-100 text-green-700':'bg-gray-100 text-gray-500'}`}>{item.active?'Active':'Inactive'}</span></td><td className="px-4 py-3 text-sm"><div className="flex space-x-2"><button onClick={() => setEditCurrency(item.id)} className="text-xs text-indigo-600 font-semibold">Edit</button><button onClick={() => { setCurrencies(prev=>prev.map(x=>x.id===item.id?{...x,active:!x.active}:x)); setAuditLog(prev=>[...prev,{id:Date.now(),action:`CURRENCY_${item.active?'DEACTIVATED':'ACTIVATED'}`,details:`Currency ${item.active?'deactivated':'activated'}: ${item.code} — ${item.name}`,performedBy:user.name,performedAt:new Date().toISOString()}]); }} className={`text-xs font-semibold ${item.active?'text-red-600':'text-green-600'}`}>{item.active?'Deactivate':'Activate'}</button></div></td></>)}</tr>))}</tbody></table>
</div>)}</div>
{renderLookup('categories','Spend Categories',categories,setCategories,editCategory,setEditCategory,newCategory,setNewCategory,'CATEGORY',false)}
<div className="border border-gray-200 rounded-lg overflow-hidden">
<button onClick={() => toggleLookup('functions')} className="w-full flex items-center justify-between px-5 py-4 bg-gray-50 hover:bg-gray-100 transition">
<h2 className="text-lg font-bold text-gray-800">Functions / Departments</h2>
<div className="flex items-center space-x-2"><span className="text-xs text-gray-500">{functions.length} items</span>{collapsedLookups.functions ? <ChevronDown className="w-5 h-5 text-gray-500"/> : <ChevronUp className="w-5 h-5 text-gray-500"/>}</div>
</button>
{!collapsedLookups.functions && (<div className="p-5">
<div className="flex space-x-2 mb-4"><input placeholder="Function name" value={newFunction.name} onChange={e => setNewFunction(p=>({...p,name:e.target.value}))} className={`flex-1 ${_i}`}/><select value={newFunction.approver} onChange={e => setNewFunction(p=>({...p,approver:e.target.value}))} className={`w-48 ${_i}`}><option value="">Approver...</option>{mockUsers.filter(u=>{ const rl = roles.find(r=>r.name===u.role); return rl && rl.permissions.includes('spend.approve') && u.status==='Active'; }).map(u=>(<option key={u.id} value={u.name}>{u.name}</option>))}</select><button onClick={() => { if (!newFunction.name||!newFunction.approver) return; if (functions.find(f=>f.name===newFunction.name)) { alert('Duplicate function'); return; } const f={id:Date.now(),name:newFunction.name,approver:newFunction.approver,active:true}; setFunctions(prev=>[...prev,f]); setNewFunction({name:'',approver:''}); setAuditLog(prev=>[...prev,{id:Date.now(),action:'FUNCTION_CREATED',details:`Function created: ${f.name} (Approver: ${f.approver})`,performedBy:user.name,performedAt:new Date().toISOString()}]); }} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-semibold">Add</button></div>
<table className="w-full text-left"><thead><tr className="border-b border-gray-200"><th className={_th}>Function Name</th><th className={_th}>Approver</th><th className={_th}>Status</th><th className={_th}>Actions</th></tr></thead><tbody>{functions.map(f => (<tr key={f.id} className="border-b border-gray-100 hover:bg-gray-50">
{editFunction===f.id ? (<><td className="px-4 py-2"><input value={f.name} onChange={e => setFunctions(prev=>prev.map(x=>x.id===f.id?{...x,name:e.target.value}:x))} className={`w-full ${_i}`}/></td><td className="px-4 py-2"><select value={f.approver} onChange={e => setFunctions(prev=>prev.map(x=>x.id===f.id?{...x,approver:e.target.value}:x))} className={`w-full ${_i}`}>{mockUsers.filter(u=>{ const rl = roles.find(r=>r.name===u.role); return rl && rl.permissions.includes('spend.approve') && u.status==='Active'; }).map(u=>(<option key={u.id} value={u.name}>{u.name}</option>))}</select></td><td className="px-4 py-2"><span className={`px-2 py-0.5 rounded text-xs font-semibold ${f.active?'bg-green-100 text-green-700':'bg-gray-100 text-gray-500'}`}>{f.active?'Active':'Inactive'}</span></td><td className="px-4 py-2"><button onClick={() => { setEditFunction(null); setAuditLog(prev=>[...prev,{id:Date.now(),action:'FUNCTION_UPDATED',details:`Function updated: ${f.name} (Approver: ${f.approver})`,performedBy:user.name,performedAt:new Date().toISOString()}]); }} className="text-xs text-green-600 font-semibold">Save</button></td></>) : (<><td className={_td}>{f.name}</td><td className="px-4 py-3 text-sm"><span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-xs font-semibold">{f.approver}</span></td><td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs font-semibold ${f.active?'bg-green-100 text-green-700':'bg-gray-100 text-gray-500'}`}>{f.active?'Active':'Inactive'}</span></td><td className="px-4 py-3 text-sm"><div className="flex space-x-2"><button onClick={() => setEditFunction(f.id)} className="text-xs text-indigo-600 font-semibold">Edit</button><button onClick={() => { setFunctions(prev=>prev.map(x=>x.id===f.id?{...x,active:!x.active}:x)); setAuditLog(prev=>[...prev,{id:Date.now(),action:f.active?'FUNCTION_DEACTIVATED':'FUNCTION_ACTIVATED',details:`Function ${f.active?'deactivated':'activated'}: ${f.name}`,performedBy:user.name,performedAt:new Date().toISOString()}]); }} className={`text-xs font-semibold ${f.active?'text-red-600':'text-green-600'}`}>{f.active?'Deactivate':'Activate'}</button></div></td></>)}</tr>))}</tbody></table>
</div>)}</div>
<div className="border border-gray-200 rounded-lg overflow-hidden">
<button onClick={() => toggleLookup('projects')} className="w-full flex items-center justify-between px-5 py-4 bg-gray-50 hover:bg-gray-100 transition">
<h2 className="text-lg font-bold text-gray-800">Projects</h2>
<div className="flex items-center space-x-2"><span className="text-xs text-gray-500">{projects.length} items</span>{collapsedLookups.projects ? <ChevronDown className="w-5 h-5 text-gray-500"/> : <ChevronUp className="w-5 h-5 text-gray-500"/>}</div>
</button>
{!collapsedLookups.projects && (<div className="p-5">
<div className="flex space-x-2 mb-4"><input placeholder="Project name" value={newProject.name} onChange={e => setNewProject(p=>({...p,name:e.target.value}))} className={`flex-1 ${_i}`}/><input placeholder="Description" value={newProject.description} onChange={e => setNewProject(p=>({...p,description:e.target.value}))} className={`flex-1 ${_i}`}/><button onClick={() => { if (!newProject.name) return; if (projects.find(p=>p.name===newProject.name)) { alert('Duplicate project name'); return; } const p={id:Date.now(),name:newProject.name,description:newProject.description,active:true}; setProjects(prev=>[...prev,p]); setNewProject({name:'',description:''}); setAuditLog(prev=>[...prev,{id:Date.now(),action:'PROJECT_CREATED',details:`Project created: ${p.name}${p.description?' — '+p.description:''}`,performedBy:user.name,performedAt:new Date().toISOString()}]); }} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-semibold">Add</button></div>
<table className="w-full text-left"><thead><tr className="border-b border-gray-200"><th className={_th}>Name</th><th className={_th}>Description</th><th className={_th}>Status</th><th className={_th}>Actions</th></tr></thead><tbody>{projects.map(p => (<tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
{editProject===p.id ? (<><td className="px-4 py-2"><input value={p.name} onChange={e => setProjects(prev=>prev.map(x=>x.id===p.id?{...x,name:e.target.value}:x))} className={`w-full ${_i}`}/></td><td className="px-4 py-2"><input value={p.description} onChange={e => setProjects(prev=>prev.map(x=>x.id===p.id?{...x,description:e.target.value}:x))} className={`w-full ${_i}`}/></td><td className="px-4 py-2"><span className={`px-2 py-0.5 rounded text-xs font-semibold ${p.active?'bg-green-100 text-green-700':'bg-gray-100 text-gray-500'}`}>{p.active?'Active':'Inactive'}</span></td><td className="px-4 py-2"><button onClick={() => { setEditProject(null); setAuditLog(prev=>[...prev,{id:Date.now(),action:'PROJECT_UPDATED',details:`Project updated: ${p.name}${p.description?' — '+p.description:''}`,performedBy:user.name,performedAt:new Date().toISOString()}]); }} className="text-xs text-green-600 font-semibold">Save</button></td></>) : (<><td className={_td}>{p.name}</td><td className={_td}>{p.description||'—'}</td><td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs font-semibold ${p.active?'bg-green-100 text-green-700':'bg-gray-100 text-gray-500'}`}>{p.active?'Active':'Inactive'}</span></td><td className="px-4 py-3 text-sm"><div className="flex space-x-2"><button onClick={() => setEditProject(p.id)} className="text-xs text-indigo-600 font-semibold">Edit</button><button onClick={() => { setProjects(prev=>prev.map(x=>x.id===p.id?{...x,active:!x.active}:x)); setAuditLog(prev=>[...prev,{id:Date.now(),action:p.active?'PROJECT_DEACTIVATED':'PROJECT_ACTIVATED',details:`Project ${p.active?'deactivated':'activated'}: ${p.name}`,performedBy:user.name,performedAt:new Date().toISOString()}]); }} className={`text-xs font-semibold ${p.active?'text-red-600':'text-green-600'}`}>{p.active?'Deactivate':'Activate'}</button></div></td></>)}</tr>))}</tbody></table>
</div>)}</div></div>); })()}</div>)}
{settingsTab === 'audit' && ( <div> <div className="mb-6"> <h2 className="text-xl font-bold text-gray-800 mb-2">Audit Log</h2> <p className="text-gray-600">System activity log</p></div> <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6"> <div className="grid grid-cols-1 md:grid-cols-4 gap-4"> <div className="md:col-span-2"> <label className={_lb}>Search</label> <input type="text"
value={auditSearchTerm}
onChange={(e) => setAuditSearchTerm(e.target.value)}
placeholder="Search by action, details, user, invoice..." className={`w-full ${_i}`}/></div> <div> <label className={_lb}>Action Type</label> <select
value={auditActionFilter}
onChange={(e) => setAuditActionFilter(e.target.value)} className={`w-full ${_i}`} > <option value="all">All Actions</option> {getUniqueAuditActions().map(action => ( <option key={action} value={action}>{action.replace(/_/g, ' ')}</option> ))}</select></div> <div className="flex items-end"> <button
onClick={clearAuditFilters} className="w-full px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition text-sm font-medium" > Clear Filters</button></div></div> <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4"> <div> <label className={_lb}>From Date</label> <input type="date"
value={auditDateFrom}
onChange={(e) => setAuditDateFrom(e.target.value)} className={`w-full ${_i}`}/></div> <div> <label className={_lb}>To Date</label> <input type="date" value={auditDateTo}
onChange={(e) => setAuditDateTo(e.target.value)} className={`w-full ${_i}`}/></div></div> <div className="mt-3 text-sm text-gray-600"> Showing <strong>{getFilteredAuditLog().length}</strong> of <strong>{auditLog.length}</strong> entries</div></div> {auditLog.length === 0 ? ( <div className="text-center py-12 text-gray-500"> <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-400"/> <p>No audit entries yet.</p></div> ) : getFilteredAuditLog().length === 0 ? ( <div className="text-center py-12 text-gray-500">
<AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-400"/> <p>No entries match filters.</p> <button
onClick={clearAuditFilters} className="mt-4 text-indigo-600 hover:text-indigo-800 underline" > Clear Filters</button></div> ) : ( <div className="overflow-x-auto"> <table className="w-full"> <thead className="bg-gray-50"> <tr> <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Timestamp</th> <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Action</th> <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Details</th>
<th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Performed By</th></tr></thead> <tbody className="divide-y divide-gray-200"> {getFilteredAuditLog().slice().reverse().map((entry) => ( <tr key={entry.id} className="hover:bg-gray-50"> <td className="px-6 py-4 text-sm text-gray-600"> {new Date(entry.performedAt || entry.deletedAt).toLocaleString()}</td> <td className="px-6 py-4 text-sm"> <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
entry.action === 'DELETE' || entry.action === 'INVOICE_REJECTED' || entry.action === 'BULK_REJECTION' || entry.action === 'USER_REMOVED' || entry.action === 'LOGIN_FAILED' || entry.action === 'SPEND_REJECTED' ? 'bg-red-100 text-red-700' : entry.action === 'ROLE_CHANGE' || entry.action === 'USER_LOGIN' || entry.action === 'USER_LOGOUT' ? 'bg-blue-100 text-blue-700' : entry.action === 'INVOICE_APPROVED' || entry.action === 'BULK_APPROVAL' || entry.action === 'SPEND_APPROVED' ? 'bg-green-100 text-green-700' :
entry.action === 'INVOICE_CREATED' || entry.action === 'FILES_SELECTED' || entry.action === 'USER_INVITED' || entry.action === 'INVITATION_RESENT' || entry.action === 'OTP_SENT' || entry.action === 'SPEND_REQUEST' ? 'bg-purple-100 text-purple-700' : entry.action === 'FILTER_APPLIED' || entry.action === 'FILTERS_CLEARED' ? 'bg-yellow-100 text-yellow-700' : entry.action === 'DATA_EXPORTED' || entry.action === 'INVOICE_MATCHED' ? 'bg-indigo-100 text-indigo-700' : entry.action.startsWith('ATOM_') || entry.action.startsWith('CC_') || entry.action.startsWith('REGION_') || entry.action.startsWith('CURRENCY_') || entry.action.startsWith('CATEGORY_') || entry.action.startsWith('FUNCTION_') ? 'bg-teal-100 text-teal-700' :
entry.action === 'GDPR_ANONYMIZATION' || entry.action === 'INVOICE_UNLINKED' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700' }`}> {entry.action.replace(/_/g, ' ')}</span> {entry.gdprCompliance && ( <span className="ml-2 px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-semibold" title="GDPR Compliant - Original data preserved for legal compliance"> GDPR</span>)}</td> <td className="px-6 py-4 text-sm text-gray-900"> {entry.action === 'DELETE' ? ( <div> <p className="font-semibold">Invoice: {entry.invoiceNumber}</p>
<p className="text-gray-600">Vendor: {entry.vendor} | Amount: ${entry.amount}</p> <p className="text-gray-500 text-xs mt-1">{entry.reason}</p></div> ) : ( entry.details)}</td> <td className="px-6 py-4 text-sm text-gray-600"> {entry.deletedBy || entry.performedBy}</td></tr> ))}</tbody></table></div>)}
<div className="mt-6"> <button onClick={() => { const filteredData = getFilteredAuditLog();
const csvContent = [
['Timestamp', 'Action', 'Details', 'Performed By'].join(','), ...filteredData.map(entry => [
new Date(entry.performedAt || entry.deletedAt).toLocaleString(), entry.action, entry.action === 'DELETE' ? `Invoice: ${entry.invoiceNumber}` : entry.details, entry.deletedBy || entry.performedBy ].join(',')) ].join('\n');
const blob = new Blob([csvContent], { type: 'text/csv' });
const url = window.URL.createObjectURL(blob);
const a = document.createElement('a'); a.href = url;
a.download = `audit_log_${new Date().toISOString().split('T')[0]}.csv`; a.click(); }} className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"  > <Download className="w-4 h-4"/> <span>Export Filtered Results ({getFilteredAuditLog().length} entries)</span></button></div></div>)}
{settingsTab === 'api' && (<div>
<div className="mb-6"><h2 className="text-xl font-bold text-gray-800 mb-2">API</h2><p className="text-gray-600">Configure Claude AI for intelligent invoice data extraction</p></div>
<div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
<h3 className="text-lg font-semibold text-gray-800 mb-4">Anthropic API Key</h3>
<div className="flex items-end space-x-3 mb-4">
<div className="flex-1"><label className={_lb}>API Key</label><input type="password" value={anthropicApiKey} onChange={e => setAnthropicApiKey(e.target.value)} placeholder="sk-ant-..." className={`w-full ${_i}`}/></div>
<button onClick={() => saveApiKey(anthropicApiKey)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-semibold text-sm">Save</button>
<button onClick={() => testApiKey(anthropicApiKey)} disabled={apiKeyTestStatus === 'testing'} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold text-sm disabled:opacity-50">{apiKeyTestStatus === 'testing' ? 'Testing...' : 'Test'}</button>
<button onClick={() => { saveApiKey(''); setAnthropicApiKey(''); }} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-semibold text-sm">Clear</button>
</div>
{apiKeyTestStatus === 'success' && (<div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center space-x-2"><CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0"/><p className="text-sm text-green-800">{apiKeyTestMessage}</p></div>)}
{apiKeyTestStatus === 'error' && (<div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2"><XCircle className="w-5 h-5 text-red-600 flex-shrink-0"/><p className="text-sm text-red-800">{apiKeyTestMessage}</p></div>)}
{apiKeyTestStatus === 'testing' && (<div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center space-x-2"><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 flex-shrink-0"></div><p className="text-sm text-blue-800">{apiKeyTestMessage}</p></div>)}
</div>
<div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
<h3 className="text-lg font-semibold text-blue-900 mb-3">How It Works</h3>
<div className="space-y-2 text-sm text-blue-800">
<p>When an API key is configured, uploaded invoices are sent to Claude AI for intelligent data extraction. Claude analyzes the document and extracts vendor details, amounts, dates, line items, and more.</p>
<p>If no API key is set, or if extraction fails for any file, the system falls back to generating sample data so the demo continues to work.</p>
<p>Your API key is stored in your browser's localStorage and is only sent to the Anthropic API via the dev server proxy. It is never stored on any external server.</p>
</div>
</div>
<div className="bg-white border border-gray-200 rounded-lg p-6">
<h3 className="text-lg font-semibold text-gray-800 mb-4">Current Status</h3>
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
<div className="p-4 bg-gray-50 rounded-lg"><span className="text-xs font-semibold text-gray-500 uppercase">Extraction Mode</span><p className="text-lg font-bold mt-1">{anthropicApiKey ? <span className="text-green-700">AI-Powered</span> : <span className="text-gray-600">Mock Data</span>}</p></div>
<div className="p-4 bg-gray-50 rounded-lg"><span className="text-xs font-semibold text-gray-500 uppercase">Model</span><p className="text-lg font-bold mt-1 text-gray-800">{anthropicApiKey ? 'claude-sonnet-4-6' : 'N/A'}</p></div>
<div className="p-4 bg-gray-50 rounded-lg"><span className="text-xs font-semibold text-gray-500 uppercase">Supported Files</span><p className="text-lg font-bold mt-1 text-gray-800">PDF, PNG, JPG, WebP</p></div>
<div className="p-4 bg-gray-50 rounded-lg"><span className="text-xs font-semibold text-gray-500 uppercase">API Key Status</span><p className="text-lg font-bold mt-1">{anthropicApiKey ? <span className="text-green-700">Configured</span> : <span className="text-yellow-600">Not Set</span>}</p></div>
</div>
</div>
</div>)}
{settingsTab === 'emails' && (<div>
<div className="mb-6"><h2 className="text-xl font-bold text-gray-800 mb-2">Email Templates</h2><p className="text-gray-600">Configure notification email templates for the spend approval workflow</p></div>
<div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
<h3 className="text-sm font-semibold text-blue-900 mb-2">Available Placeholders</h3>
<div className="flex flex-wrap gap-2">
{['{{approver_name}}','{{submitted_by}}','{{spend_ref}}','{{spend_title}}','{{vendor}}','{{currency}}','{{amount}}','{{submitted_date}}','{{updated_by}}','{{updated_date}}','{{decision}}','{{decision_date}}','{{threshold}}','{{invoiced_amount}}','{{remaining_amount}}'].map(p => (
<code key={p} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded font-mono">{p}</code>
))}
</div>
<p className="text-xs text-blue-700 mt-2">Use these placeholders in your subject and body. They will be replaced with actual values when the email is sent.</p>
</div>
<div className="space-y-4">
{emailTemplates.map(tpl => {
const isEditing = editTemplateId === tpl.id;
return (
<div key={tpl.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
<div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
<div className="flex items-center space-x-3">
<Mail className="w-5 h-5 text-indigo-500"/>
<h3 className="text-sm font-semibold text-gray-800">{tpl.name}</h3>
</div>
<div className="flex items-center space-x-3">
<span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${tpl.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{tpl.active ? 'Active' : 'Inactive'}</span>
{!isEditing && <button onClick={() => setEditTemplateId(tpl.id)} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">Edit</button>}
</div>
</div>
{!isEditing ? (
<div className="px-6 py-3">
<p className="text-sm text-gray-600"><span className="font-medium text-gray-700">Subject:</span> {tpl.subject}</p>
</div>
) : (
<div className="px-6 py-4 space-y-4 bg-gray-50">
<div>
<label className={_lb}>Subject</label>
<input type="text" value={tpl.subject} onChange={e => setEmailTemplates(prev => prev.map(t => t.id === tpl.id ? {...t, subject: e.target.value} : t))} className={`w-full ${_i}`}/>
</div>
<div>
<label className={_lb}>Body</label>
<textarea value={tpl.body} onChange={e => setEmailTemplates(prev => prev.map(t => t.id === tpl.id ? {...t, body: e.target.value} : t))} rows={10} className={`w-full ${_i} font-mono text-sm`}/>
</div>
<div className="flex items-center justify-between pt-2">
<button onClick={() => { setEmailTemplates(prev => prev.map(t => t.id === tpl.id ? {...t, active: !t.active} : t)); setAuditLog(prev => [...prev, { id: Date.now()+Math.random(), action: tpl.active ? 'EMAIL_TEMPLATE_DEACTIVATED' : 'EMAIL_TEMPLATE_ACTIVATED', details: `Email template "${tpl.name}" ${tpl.active ? 'deactivated' : 'activated'}`, performedBy: user.name, performedAt: new Date().toISOString() }]); }} className={`text-sm font-medium px-3 py-1.5 rounded-lg ${tpl.active ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}>{tpl.active ? 'Deactivate' : 'Activate'}</button>
<div className="flex items-center space-x-2">
<button onClick={() => setEditTemplateId(null)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm font-medium">Cancel</button>
<button onClick={() => { setEditTemplateId(null); setAuditLog(prev => [...prev, { id: Date.now()+Math.random(), action: 'EMAIL_TEMPLATE_UPDATED', details: `Email template "${tpl.name}" updated`, performedBy: user.name, performedAt: new Date().toISOString() }]); }} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-semibold">Save</button>
</div>
</div>
</div>
)}
</div>
);
})}
</div>
</div>)}
{settingsTab === 'roles' && (<div>
<div className="mb-6"><h2 className="text-xl font-bold text-gray-800 mb-2">Roles & Permissions</h2><p className="text-gray-600">Manage roles and their granular permissions</p></div>
<div className="flex items-center space-x-3 mb-6">
<input value={newRoleName} onChange={e => setNewRoleName(e.target.value)} placeholder="New role name..." className={`flex-1 max-w-xs ${_i}`}/>
<button onClick={() => { if (!newRoleName.trim()) return; if (roles.find(r => r.name.toLowerCase() === newRoleName.trim().toLowerCase())) { alert('Role name already exists'); return; } const id = newRoleName.trim().toLowerCase().replace(/\s+/g,'-'); const nr = { id, name: newRoleName.trim(), isDefault: false, permissions: [] }; setRoles(prev => [...prev, nr]); setEditingRole(nr.id); setNewRoleName(''); setAuditLog(prev => [...prev, { id: Date.now(), action: 'ROLE_CREATED', details: `Role "${nr.name}" created`, performedBy: user.name, performedAt: new Date().toISOString() }]); }} className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-semibold text-sm"><Plus className="w-4 h-4"/><span>Create Role</span></button>
</div>
<div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
<div className="lg:col-span-1">
<div className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
<div className="px-4 py-3 bg-gray-100 border-b border-gray-200"><h3 className="text-sm font-semibold text-gray-700">Roles</h3></div>
<div className="divide-y divide-gray-200">{roles.map(r => (<div key={r.id} className={`flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-white transition ${editingRole === r.id ? 'bg-white border-l-4 border-indigo-600' : ''}`} onClick={() => setEditingRole(r.id)}>
<div className="flex items-center space-x-2">{r.isDefault && <Lock className="w-3 h-3 text-gray-400 flex-shrink-0"/>}<span className={`text-sm font-medium ${editingRole === r.id ? 'text-indigo-700' : 'text-gray-700'}`}>{r.name}</span></div>
<div className="flex items-center space-x-2"><span className="text-xs text-gray-400">{r.permissions.length}</span>
{!r.isDefault && (<button onClick={(e) => { e.stopPropagation(); const usersWithRole = mockUsers.filter(u => u.role === r.name && u.status === 'Active'); if (usersWithRole.length > 0) { alert(`Cannot delete role "${r.name}" — ${usersWithRole.length} user(s) are assigned to it.`); return; } if (!window.confirm(`Delete role "${r.name}"?`)) return; setRoles(prev => prev.filter(x => x.id !== r.id)); if (editingRole === r.id) setEditingRole(null); setAuditLog(prev => [...prev, { id: Date.now(), action: 'ROLE_DELETED', details: `Role "${r.name}" deleted`, performedBy: user.name, performedAt: new Date().toISOString() }]); }} className="text-red-400 hover:text-red-600" title="Delete role"><Trash2 className="w-3.5 h-3.5"/></button>)}</div>
</div>))}</div></div></div>
<div className="lg:col-span-3">{editingRole ? (() => { const role = roles.find(r => r.id === editingRole); if (!role) return <p className="text-gray-500">Role not found.</p>;
const togglePerm = (permKey) => { const mutualExclusions = { 'invoices.view_all': ['invoices.view_own'], 'invoices.view_own': ['invoices.view_all'], 'invoices.assign_all': ['invoices.assign_own'], 'invoices.assign_own': ['invoices.assign_all'], 'spend.view_all': ['spend.view_own','spend.view_dept'], 'spend.view_own': ['spend.view_all','spend.view_dept'], 'spend.view_dept': ['spend.view_all','spend.view_own'] };
const has = role.permissions.includes(permKey); let newPerms; if (has) { newPerms = role.permissions.filter(p => p !== permKey); } else { const toRemove = mutualExclusions[permKey] || []; newPerms = [...role.permissions.filter(p => !toRemove.includes(p)), permKey]; }
setRoles(prev => prev.map(r => r.id === role.id ? {...r, permissions: newPerms} : r)); setAuditLog(prev => [...prev, { id: Date.now(), action: 'PERMISSION_CHANGED', details: `Role "${role.name}": ${has ? 'removed' : 'added'} permission "${permKey}"`, performedBy: user.name, performedAt: new Date().toISOString() }]); };
return (<div className="bg-white rounded-lg border border-gray-200">
<div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between"><div className="flex items-center space-x-3"><h3 className="text-lg font-bold text-gray-800">{role.name}</h3>{role.isDefault && <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded font-medium">Default</span>}</div><span className="text-sm text-gray-500">{role.permissions.length} permissions</span></div>
<div className="p-6 space-y-6">{Object.entries(PERMISSIONS).map(([catKey, cat]) => (<div key={catKey}>
<h4 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wider">{cat.label}</h4>
<div className="space-y-2">{Object.entries(cat.permissions).map(([permKey, meta]) => { const checked = role.permissions.includes(permKey); return (<label key={permKey} className="flex items-start space-x-3 p-2 rounded hover:bg-gray-50 cursor-pointer">
<input type="checkbox" checked={checked} onChange={() => togglePerm(permKey)} className="w-4 h-4 text-indigo-600 rounded mt-0.5"/>
<div><p className={`text-sm font-medium ${checked ? 'text-gray-900' : 'text-gray-600'}`}>{meta.label}</p><p className="text-xs text-gray-400">{meta.description}</p></div></label>); })}</div></div>))}</div></div>); })() : (<div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg border border-gray-200"><p className="text-gray-500">Select a role to view and edit permissions</p></div>)}</div>
</div></div>)}
</div></div></div>);}
if (selectedInvoice) { const invoice = invoices.find(inv => inv.id === selectedInvoice.id) || selectedInvoice; if (getVisibilityScope('invoices')==='own' && invoice.submittedBy !== user.name) { setSelectedInvoice(null); return null; } return ( <div className={_pg}> {showDeleteConfirmation && ( <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"> <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6"> <div className="flex items-center space-x-3 mb-4"> <div className="flex items-center justify-center h-12 w-12 rounded-full bg-red-100"> <Trash2 className="h-6 w-6 text-red-600"/></div>
<h3 className="text-xl font-bold text-gray-900">Delete Invoice</h3></div> <p className="text-gray-600 mb-4"> This action cannot be undone.</p> <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4"> <p className="text-sm text-yellow-800"> Please type <span className="font-bold">{invoiceToDelete?.invoiceNumber}</span> to confirm deletion:</p></div> <input type="text"
value={deleteConfirmationInput}
onChange={(e) => setDeleteConfirmationInput(e.target.value)}
placeholder="Type invoice number here" className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-red-500"/> <div className="flex space-x-3"> <button
onClick={cancelDeleteInvoice} className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"  > Cancel</button> <button
onClick={confirmDeleteInvoice}
disabled={deleteConfirmationInput !== invoiceToDelete?.invoiceNumber} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed" > Delete Invoice</button></div></div></div>)}
{showSuccessNotification && ( <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"> <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6 relative"> <button
onClick={handleNotificationClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600" > <XCircle className="w-6 h-6"/></button> <div className="text-center"> <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4"> <CheckCircle className="h-10 w-10 text-green-600"/></div> <h3 className="text-xl font-bold text-gray-900 mb-2">Success!</h3> <p className="text-gray-600 mb-6">{notificationMessage}</p> <button
onClick={handleNotificationOk} className="w-full bg-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-indigo-700"  > OK - Return to Invoice List</button></div></div></div>)}
<div className="max-w-6xl mx-auto"> <div className="bg-white rounded-lg shadow-lg p-6 mb-6"> <div className={_fj+" mb-4"}> <button
onClick={() => setSelectedInvoice(null)} className="flex items-center space-x-2 text-indigo-600 hover:text-indigo-800" > <span>←</span> <span>Back to Invoices</span></button> <div className="flex items-center space-x-4"> <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 rounded-lg"> <User className="w-5 h-5 text-indigo-600"/> <div className="text-sm"> <p className="font-semibold text-gray-800">{user.name}</p> <p className="text-xs text-gray-600">{user.role}</p></div></div> {canDeleteInvoices() && ( <button
onClick={() => initiateDeleteInvoice(invoice)} className="flex items-center space-x-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200" > <Trash2 className="w-4 h-4"/> <span>Delete</span></button>)}
{canCreateSpend() && !invoice.spendApprovalId && ( <button onClick={() => { const totalAmount = (parseFloat(invoice.amount) + parseFloat(invoice.taxAmount)).toFixed(2); const fn = functions.find(f => f.name === invoice.department); const inferred = inferLookupsFromDepartment(invoice.department); const invCurrency = (invoice.currency || '').toUpperCase(); if (invCurrency && !currencies.some(c => c.code === invCurrency)) { setCurrencies(prev => [...prev, { id: Date.now(), code: invCurrency, name: invCurrency, active: true }]); } setSpendForm({ cc:'', title: invoice.description, currency: invCurrency, approver: fn ? fn.approver : '', amount: totalAmount, category:'', atom: inferred.atom, vendor: invoice.vendor, costCentre: inferred.costCentre, region:'', project:'', timeSensitive:false, exceptional:'', justification: invoice.description, department: invoice.department, originInvoiceId: invoice.id }); setSelectedInvoice(null); setCurrentPage('spend-approval'); setSpendView('form'); }} className="flex items-center space-x-2 px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200"><DollarSign className="w-4 h-4"/><span>Create Spend Approval</span></button>)}
<button onClick={() => setCurrentPage('landing')} className="flex items-center space-x-2 px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200"><Home className="w-4 h-4"/><span>Dashboard</span></button> <button
onClick={() => setSelectedInvoice(null)} className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200" > <span>Close</span></button></div></div> <div className={_fj}> <div> <h1 className="text-3xl font-bold text-gray-800">Invoice Details</h1> <p className="text-gray-600 mt-1">{invoice.invoiceNumber}</p></div></div></div> <div className="grid grid-cols-1 lg:grid-cols-3 gap-6"> <div className="lg:col-span-2 space-y-6"> <div className={_cd}> <h2 className={_h2}>Invoice Information</h2> <div className="grid grid-cols-2 gap-6"> <div> <label className="text-sm text-gray-600">Invoice Number</label> <p className="text-lg font-semibold text-gray-800">{invoice.invoiceNumber}</p></div> <div>
<label className="text-sm text-gray-600">Vendor</label> <p className="text-lg font-semibold text-gray-800">{invoice.vendor}</p></div> <div> <label className="text-sm text-gray-600">Invoice Date</label> <p className="text-lg font-semibold text-gray-800">{invoice.date}</p></div> <div> <label className="text-sm text-gray-600">Due Date</label> <p className="text-lg font-semibold text-gray-800">{invoice.dueDate}</p></div> <div> <label className="text-sm text-gray-600">Subtotal</label> <p className="text-lg font-semibold text-gray-800">{currencySymbol(invoice.currency)}{invoice.amount}</p></div> <div>
<label className="text-sm text-gray-600">Tax Amount</label> <p className="text-lg font-semibold text-gray-800">{currencySymbol(invoice.currency)}{invoice.taxAmount}{invoice.vatRate != null && invoice.vatRate > 0 ? ` (${(invoice.vatRate * 100).toFixed(0)}%)` : ''}</p></div> <div className="col-span-2"> <label className="text-sm text-gray-600">Total Amount</label> <p className="text-2xl font-bold text-green-600">{currencySymbol(invoice.currency)}{invoice.totalAmount || (parseFloat(invoice.amount) + parseFloat(invoice.taxAmount)).toFixed(2)}</p></div> {invoice.paymentTerms && (<div> <label className="text-sm text-gray-600">Payment Terms</label> <p className="text-lg font-semibold text-gray-800">{invoice.paymentTerms}</p></div>)} {invoice.currency && (<div> <label className="text-sm text-gray-600">Currency</label> <p className="text-lg font-semibold text-gray-800">{invoice.currency}</p></div>)} <div className="col-span-2"> <label className="text-sm text-gray-600">Description</label> <p className="text-gray-800">{invoice.description}</p></div></div></div>
{invoice.supplier && (invoice.supplier.company || invoice.supplier.address || invoice.supplier.vat_number) && (<div className={_cd}> <h2 className={_h2}>Supplier Details</h2> <div className="grid grid-cols-2 gap-4"> {invoice.supplier.company && (<div className="col-span-2"> <label className="text-sm text-gray-600">Company</label> <p className="text-lg font-semibold text-gray-800">{invoice.supplier.company}</p></div>)} {invoice.supplier.address && (<div className="col-span-2"> <label className="text-sm text-gray-600">Address</label> <p className="text-sm text-gray-800">{invoice.supplier.address}</p></div>)} {invoice.supplier.vat_number && (<div> <label className="text-sm text-gray-600">VAT Number</label> <p className="text-sm font-semibold text-gray-800">{invoice.supplier.vat_number}</p></div>)} {invoice.supplier.phone && (<div> <label className="text-sm text-gray-600">Phone</label> <p className="text-sm text-gray-800">{invoice.supplier.phone}</p></div>)} {invoice.supplier.email && (<div> <label className="text-sm text-gray-600">Email</label> <p className="text-sm text-gray-800">{invoice.supplier.email}</p></div>)} {invoice.supplier.website && (<div> <label className="text-sm text-gray-600">Website</label> <p className="text-sm text-gray-800">{invoice.supplier.website}</p></div>)}</div></div>)}
{invoice.customer && (invoice.customer.company || invoice.customer.address) && (<div className={_cd}> <h2 className={_h2}>Customer / Bill-to</h2> <div className="grid grid-cols-2 gap-4"> {invoice.customer.company && (<div className="col-span-2"> <label className="text-sm text-gray-600">Company</label> <p className="text-lg font-semibold text-gray-800">{invoice.customer.company}</p></div>)} {invoice.customer.attention && (<div className="col-span-2"> <label className="text-sm text-gray-600">Attention</label> <p className="text-sm text-gray-800">{invoice.customer.attention}</p></div>)} {invoice.customer.address && (<div className="col-span-2"> <label className="text-sm text-gray-600">Address</label> <p className="text-sm text-gray-800">{invoice.customer.address}</p></div>)} {invoice.customer.vat_number && (<div> <label className="text-sm text-gray-600">VAT Number</label> <p className="text-sm font-semibold text-gray-800">{invoice.customer.vat_number}</p></div>)}</div></div>)}
<div className={_cd}> <h2 className={_h2}>Linked Spend Approval</h2> {invoice.spendApprovalId ? (() => { const sp = spendApprovals.find(s => s.id === invoice.spendApprovalId); return sp ? ( <div className="border border-indigo-200 bg-indigo-50 rounded-lg p-4"> <div className="flex items-center justify-between mb-2"><h3 className="font-semibold text-indigo-800"><button onClick={() => { setSelectedInvoice(null); setCurrentPage('spend-approval'); setSpendView('list'); setSelectedSpend(sp); }} className="hover:text-indigo-600 underline">{sp.ref} — {sp.title}</button></h3><button onClick={() => unlinkInvoice(invoice.id)} className="text-xs text-red-600 hover:text-red-800 font-semibold">Unlink</button></div>
<div className="grid grid-cols-2 gap-2 text-sm"><div><span className="text-gray-500">Vendor:</span> <span className="text-gray-800">{sp.vendor}</span></div><div><span className="text-gray-500">Approved:</span> <span className="text-gray-800">{fmtEur(sp.amount, sp.currency)}</span></div><div><span className="text-gray-500">Category:</span> <span className="text-gray-800">{sp.category}</span></div><div><span className="text-gray-500">Remaining:</span> <span className={`font-semibold ${getSpendRemaining(sp) < 0 ? 'text-red-600' : 'text-green-600'}`}>€{getSpendRemaining(sp).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span></div></div>
</div> ) : <p className="text-sm text-gray-500">Linked spend approval not found.</p>; })() : ( <div><p className="text-sm text-gray-500 mb-3">No spend approval linked to this invoice.</p><label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Assign to Spend Approval</label><select defaultValue="" onChange={e => { if (e.target.value) { acceptMatch(invoice.id, Number(e.target.value)); setSelectedInvoice({...invoice, spendApprovalId: Number(e.target.value)}); } }} className={`w-full ${_g}`}><option value="" disabled>Select an approved spend approval...</option>{spendApprovals.filter(s => s.status === 'Approved' && (hasPermission('invoices.assign_all') || s.submittedBy === user.name)).map(s => (<option key={s.id} value={s.id}>{s.ref} — {s.title} — {s.vendor} ({fmtEur(s.amount, s.currency)})</option>))}</select></div>)}</div>
{invoice.lineItems && invoice.lineItems.length > 0 && ( <div className={_cd}> <h2 className={_h2}>Line Items</h2> <div className="overflow-x-auto"> <table className="w-full"> <thead className="bg-gray-50"> <tr> {invoice.lineItems.some(li => li.category) && <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Category</th>} <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Description</th> <th className="px-4 py-2 text-right text-sm font-semibold text-gray-700">Quantity</th> <th className="px-4 py-2 text-right text-sm font-semibold text-gray-700">Unit Rate</th>
<th className="px-4 py-2 text-right text-sm font-semibold text-gray-700">Amount</th></tr></thead> <tbody className="divide-y divide-gray-200"> {invoice.lineItems.map((item, idx) => ( <tr key={idx}> {invoice.lineItems.some(li => li.category) && <td className="px-4 py-2 text-sm text-gray-600">{item.category}</td>} <td className="px-4 py-2 text-sm text-gray-800">{item.description}</td> <td className="px-4 py-2 text-sm text-right text-gray-800">{item.quantity}</td> <td className="px-4 py-2 text-sm text-right text-gray-800">{currencySymbol(invoice.currency)}{item.rate}</td> <td className="px-4 py-2 text-sm text-right font-semibold text-gray-800">{currencySymbol(invoice.currency)}{item.amount}</td></tr> ))}</tbody></table></div></div>)}
{invoice.fileUrl && (<div className={_cd}> <h2 className={_h2}>Attached Document</h2> <div className="border-2 border-gray-200 rounded-lg p-4"> {invoice.fileType?.startsWith('image/') ? ( <img
src={invoice.fileUrl}
alt="Invoice document" className="w-full rounded-lg"/> ) : ( <div className={_fj}> <div className="flex items-center space-x-3"> <FileText className="w-8 h-8 text-indigo-600"/> <div> <p className="font-semibold text-gray-800">{invoice.fileName}</p> <p className="text-sm text-gray-600">PDF Document</p></div></div> <a
href={invoice.fileUrl}
download={invoice.fileName} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"  > Download</a></div>)}</div></div>)}</div> <div className="space-y-6">
<div className={_cd}> <h2 className={_h2}>Submission Info</h2> <div className="space-y-3"> <div> <label className="text-sm text-gray-600">Submitted By</label> <p className="font-semibold text-gray-800">{invoice.submittedBy}</p></div> <div> <label className="text-sm text-gray-600">Submitted Date</label> <p className="text-sm text-gray-800"> {new Date(invoice.submittedDate).toLocaleString()}</p></div></div></div>
{invoice.bankDetails && (invoice.bankDetails.bank || invoice.bankDetails.account_number || invoice.bankDetails.iban) && (<div className={_cd}> <h2 className={_h2}>Bank Details</h2> <div className="space-y-3"> {invoice.bankDetails.bank && (<div> <label className="text-sm text-gray-600">Bank</label> <p className="font-semibold text-gray-800">{invoice.bankDetails.bank}</p></div>)} {invoice.bankDetails.account_number && (<div> <label className="text-sm text-gray-600">Account Number</label> <p className="text-sm font-mono text-gray-800">{invoice.bankDetails.account_number}</p></div>)} {invoice.bankDetails.sort_code && (<div> <label className="text-sm text-gray-600">Sort Code</label> <p className="text-sm font-mono text-gray-800">{invoice.bankDetails.sort_code}</p></div>)} {invoice.bankDetails.iban && (<div> <label className="text-sm text-gray-600">IBAN</label> <p className="text-sm font-mono text-gray-800">{invoice.bankDetails.iban}</p></div>)} {invoice.bankDetails.swift_bic && (<div> <label className="text-sm text-gray-600">SWIFT/BIC</label> <p className="text-sm font-mono text-gray-800">{invoice.bankDetails.swift_bic}</p></div>)}</div></div>)}</div></div></div></div>);} return (
<div className={_pg}> {showDeleteConfirmation && invoiceToDelete && ( <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"> <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6"> <div className="flex items-center space-x-3 mb-4"> <div className="flex items-center justify-center h-12 w-12 rounded-full bg-red-100"> <Trash2 className="h-6 w-6 text-red-600"/></div> <h3 className="text-xl font-bold text-gray-900">Delete Invoice</h3></div> <p className="text-gray-600 mb-4"> This action cannot be undone.</p> <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4"> <p className="text-sm text-yellow-800"> Please type <span className="font-bold">{invoiceToDelete.invoiceNumber}</span> to confirm deletion:</p></div> <input type="text" value={deleteConfirmationInput} onChange={(e) => setDeleteConfirmationInput(e.target.value)} placeholder="Type invoice number here" className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-red-500"/> <div className="flex space-x-3"> <button onClick={cancelDeleteInvoice} className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"> Cancel</button> <button onClick={confirmDeleteInvoice} disabled={deleteConfirmationInput !== invoiceToDelete.invoiceNumber} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"> Delete Invoice</button></div></div></div>)} <div className="max-w-7xl mx-auto"> <div className="bg-white rounded-lg shadow-lg p-6 mb-6"> <div className={_fj+" mb-6"}> <div className="flex items-center space-x-3"> <FileText className="w-8 h-8 text-indigo-600"/> <h1 className="text-3xl font-bold text-gray-800">Invoices</h1></div> <div className="flex items-center space-x-4"> <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 rounded-lg"> <User className="w-5 h-5 text-indigo-600"/>
<div className="text-sm"> <p className="font-semibold text-gray-800">{user.name}</p> <p className="text-xs text-gray-600">{user.role}</p></div></div> <button onClick={() => setCurrentPage('landing')} className="flex items-center space-x-2 px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200"><Home className="w-4 h-4"/><span>Dashboard</span></button> <button
onClick={logout} className="flex items-center space-x-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200" > <LogOut className="w-4 h-4"/> <span>Logout</span></button></div></div> <div className="border-2 border-dashed border-indigo-300 rounded-lg p-8 text-center mb-6"> <Upload className="w-12 h-12 text-indigo-400 mx-auto mb-4"/> <input ref={fileInputRef} type="file"
accept=".pdf,image/*" multiple
onChange={handleFileSelect} className="hidden" id="file-upload"/> <label htmlFor="file-upload" className="cursor-pointer"> <span className="text-lg font-semibold text-gray-700">Drop files or click to upload</span> <p className="text-sm text-gray-500 mt-2">PDF and images supported</p></label> {selectedFiles.length > 0 && ( <div className="mt-4"> <p className="text-sm text-indigo-600 font-medium mb-2"> {selectedFiles.length} file(s) selected:</p> <div className="max-h-32 overflow-y-auto"> {selectedFiles.map((file, idx) => (
<p key={idx} className="text-xs text-gray-600">{file.name}</p> ))}</div></div>)}</div> {isProcessing && processingProgress.total > 0 && ( <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6"> <div className="flex items-center justify-between mb-3"> <div className="flex items-center space-x-3"> <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div> <span className="text-gray-700"> Processing invoices... ({processingProgress.current} of {processingProgress.total})</span></div>
<span className="text-sm font-semibold text-indigo-600"> {Math.round((processingProgress.current / processingProgress.total) * 100)}%</span></div> <div className="w-full bg-gray-200 rounded-full h-2"> <div className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
style={{ width: `${(processingProgress.current / processingProgress.total) * 100}%` }} ></div></div></div>)}
{extractionErrors.length > 0 && !isProcessing && (<div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6"><div className="flex items-start space-x-3"><AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5"/><div><h4 className="text-sm font-semibold text-yellow-800 mb-1">Some files could not be extracted with AI</h4><ul className="text-sm text-yellow-700 space-y-1">{extractionErrors.map((err, idx) => (<li key={idx}><strong>{err.fileName}:</strong> {err.error}</li>))}</ul><p className="text-xs text-yellow-600 mt-2">These files were processed using sample data instead.</p></div></div></div>)}
{extractedDataBatch.length > 0 && !isProcessing && ( <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6"> <div className={_fj+" mb-4"}> <h3 className="text-xl font-semibold text-gray-800"> Extracted Invoice Data ({extractedDataBatch.length} invoices)</h3> <button
onClick={processInvoiceBatch} className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition flex items-center space-x-2" > <CheckCircle className="w-4 h-4"/> <span>Process All</span></button></div> <div className="max-h-96 overflow-y-auto mb-4 space-y-4"> {extractedDataBatch.map((data, idx) => ( <div key={idx} className="bg-white p-4 rounded-lg border border-green-300 relative"> <div className="flex items-center justify-between mb-2"> <span className="font-semibold text-gray-700">Invoice #{idx + 1}</span>
<div className="flex items-center space-x-2"><span className="text-xs text-gray-500">{data.fileName}</span><button onClick={() => removeFromBatch(idx)} className="text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full p-1 transition" title="Remove from batch"><X className="w-4 h-4"/></button></div></div> <div className="grid grid-cols-2 md:grid-cols-4 gap-3"> <div> <span className="text-xs text-gray-600">Invoice #:</span> <p className="text-sm font-semibold">{data.invoiceNumber}</p></div> <div> <span className="text-xs text-gray-600">Vendor:</span> <p className="text-sm font-semibold">{data.vendor}</p></div> <div> <span className="text-xs text-gray-600">Date:</span> <p className="text-sm font-semibold">{data.date}</p></div> <div> <span className="text-xs text-gray-600">Total:</span>
<p className="text-sm font-semibold text-green-600">{currencySymbol(data.currency)}{data.totalAmount || (parseFloat(data.amount) + parseFloat(data.taxAmount)).toFixed(2)}</p></div></div></div> ))}</div> <button
onClick={processInvoiceBatch} className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700"  > Process All Invoices</button></div>)}</div> <div className={_cd}> <div className={_fj+" mb-6"}> <h2 className="text-2xl font-bold text-gray-800">Invoice List</h2> <div className="flex items-center space-x-3"><div className="relative"> <input type="text"
placeholder="Search invoices..."
value={filters.searchTerm}
onChange={(e) => updateFilter('searchTerm', e.target.value)} className="px-4 py-2 pl-10 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64"/> <AlertCircle className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2"/></div> <div className="relative"> <button
onClick={() => setShowFilterPanel(!showFilterPanel)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition flex items-center space-x-2" > <span>Filters</span> {getActiveFilterCount() > 0 && ( <span className="bg-indigo-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center"> {getActiveFilterCount()}</span>)}</button> {showFilterPanel && ( <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-xl border border-gray-200 p-6 z-10"> <div className={_fj+" mb-4"}>
<h3 className="font-semibold text-gray-800">Filter Invoices</h3> <button
onClick={clearFilters} className="text-sm text-indigo-600 hover:text-indigo-800" > Clear All</button></div> <div className="space-y-4"> <div> <label className={_lb}>Vendor</label> <select
value={filters.vendor}
onChange={(e) => updateFilter('vendor', e.target.value)} className={`w-full ${_i}`} > <option value="all">All</option> {getUniqueVendors().map(vendor => ( <option key={vendor} value={vendor}>{vendor}</option> ))}</select></div> <div> <label className={_lb}>Date Range</label> <div className="grid grid-cols-2 gap-2"> <input type="date"
value={filters.dateFrom}
onChange={(e) => updateFilter('dateFrom', e.target.value)}
placeholder="From" className={_i}/> <input type="date"
value={filters.dateTo}
onChange={(e) => updateFilter('dateTo', e.target.value)}
placeholder="To" className={_i}/></div></div> <div> <label className={_lb}>Amount Range</label> <div className="grid grid-cols-2 gap-2"> <input type="number"
value={filters.amountMin}
onChange={(e) => updateFilter('amountMin', e.target.value)}
placeholder="Min" className={_i}/> <input type="number"
value={filters.amountMax}
onChange={(e) => updateFilter('amountMax', e.target.value)}
placeholder="Max" className={_i}/></div></div> <div> <label className={_lb}>Submitted By</label> <select
value={filters.submittedBy}
onChange={(e) => updateFilter('submittedBy', e.target.value)} className={`w-full ${_i}`} > <option value="all">All Submitters</option> {getUniqueSubmitters().map(submitter => ( <option key={submitter} value={submitter}>{submitter}</option> ))}</select></div></div> <div className="mt-4 pt-4 border-t border-gray-200"> <p className="text-sm text-gray-600"> Showing {getFilteredInvoices().length} of {invoices.length} invoices</p></div></div>)}</div> <div className="relative"> <label className="text-sm text-gray-600 mr-2">Group By:</label> <select value={groupBy}
onChange={(e) => setGroupBy(e.target.value)} className={_i} > <option value="none">None</option> <option value="vendor">Vendor</option> <option value="date">Date</option> <option value="submittedBy">Submitted By</option></select></div> <div className="relative"> <button
onClick={() => setShowColumnSelector(!showColumnSelector)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"  > Columns</button> {showColumnSelector && ( <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 p-4 z-10"> <h3 className="font-semibold text-gray-800 mb-3">Show/Hide Columns</h3> <div className="space-y-2"> <label className="flex items-center space-x-2 cursor-pointer"> <input type="checkbox"
checked={visibleColumns.invoiceNumber}
onChange={() => toggleColumnVisibility('invoiceNumber')} className="w-4 h-4 text-indigo-600 rounded"/> <span className="text-sm text-gray-700">Invoice #</span></label> <label className="flex items-center space-x-2 cursor-pointer"> <input type="checkbox"
checked={visibleColumns.vendor}
onChange={() => toggleColumnVisibility('vendor')} className="w-4 h-4 text-indigo-600 rounded"/> <span className="text-sm text-gray-700">Vendor</span></label> <label className="flex items-center space-x-2 cursor-pointer"> <input type="checkbox"
checked={visibleColumns.subtotal}
onChange={() => toggleColumnVisibility('subtotal')} className="w-4 h-4 text-indigo-600 rounded"/> <span className="text-sm text-gray-700">Subtotal</span></label> <label className="flex items-center space-x-2 cursor-pointer"> <input type="checkbox"
checked={visibleColumns.tax}
onChange={() => toggleColumnVisibility('tax')} className="w-4 h-4 text-indigo-600 rounded"/> <span className="text-sm text-gray-700">Tax</span></label> <label className="flex items-center space-x-2 cursor-pointer"> <input type="checkbox"
checked={visibleColumns.total}
onChange={() => toggleColumnVisibility('total')} className="w-4 h-4 text-indigo-600 rounded"/> <span className="text-sm text-gray-700">Total</span></label> <label className="flex items-center space-x-2 cursor-pointer"> <input type="checkbox"
checked={visibleColumns.spendApproval}
onChange={() => toggleColumnVisibility('spendApproval')} className="w-4 h-4 text-indigo-600 rounded"/> <span className="text-sm text-gray-700">Spend Approval</span></label> <label className="flex items-center space-x-2 cursor-pointer"> <input type="checkbox"
checked={visibleColumns.file}
onChange={() => toggleColumnVisibility('file')} className="w-4 h-4 text-indigo-600 rounded"/> <span className="text-sm text-gray-700">File</span></label> <label className="flex items-center space-x-2 cursor-pointer"> <input type="checkbox"
checked={visibleColumns.date}
onChange={() => toggleColumnVisibility('date')} className="w-4 h-4 text-indigo-600 rounded"/> <span className="text-sm text-gray-700">Invoice Date</span></label> <label className="flex items-center space-x-2 cursor-pointer"> <input type="checkbox"
checked={visibleColumns.dueDate}
onChange={() => toggleColumnVisibility('dueDate')} className="w-4 h-4 text-indigo-600 rounded"/> <span className="text-sm text-gray-700">Due Date</span></label> <label className="flex items-center space-x-2 cursor-pointer"> <input type="checkbox"
checked={visibleColumns.submittedBy}
onChange={() => toggleColumnVisibility('submittedBy')} className="w-4 h-4 text-indigo-600 rounded"/> <span className="text-sm text-gray-700">Submitted By</span></label></div></div>)}</div> {invoices.length > 0 && ( <button
onClick={exportToExcel} className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"  > <Download className="w-4 h-4"/> <span>Export</span></button>)}</div></div> {invoices.length === 0 ? ( <div className="text-center py-12 text-gray-500"> <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-400"/> <p>No invoices processed yet. Upload an invoice to get started.</p></div> ) : getFilteredInvoices().length === 0 ? ( <div className="text-center py-12 text-gray-500">
<AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-400"/> <p>No invoices match your current filters.</p> <button
onClick={clearFilters} className="mt-4 text-indigo-600 hover:text-indigo-800 underline" > Clear Filters</button></div> ) : ( <div className="space-y-6"> {Object.entries(getGroupedInvoices()).map(([groupName, groupInvoices]) => ( <div key={groupName}> {groupBy !== 'none' && ( <div className="mb-3 flex items-center justify-between"> <h3 className="text-lg font-bold text-gray-700 flex items-center space-x-2"> <span>{groupName}</span> <span className="text-sm font-normal text-gray-500">({groupInvoices.length} invoices)</span></h3></div>)}
<div className="overflow-x-auto"> <table className="w-full"> <thead className="bg-gray-50"> <tr>
{visibleColumns.invoiceNumber && ( <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Invoice #</th>)}
{visibleColumns.vendor && ( <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Vendor</th>)}
{visibleColumns.subtotal && ( <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Subtotal</th>)}
{visibleColumns.tax && ( <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Tax</th>)}
{visibleColumns.total && ( <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Total</th>)}
{visibleColumns.spendApproval && ( <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Spend Approval</th>)}
{visibleColumns.date && ( <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Invoice Date</th>)}
{visibleColumns.dueDate && ( <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Due Date</th>)}
{visibleColumns.file && ( <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">File</th>)}
{visibleColumns.submittedBy && ( <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Submitted By</th>)}
{canDeleteInvoices() && ( <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Actions</th>)}</tr></thead> <tbody className="divide-y divide-gray-200"> {groupInvoices.map((invoice) => ( <tr key={invoice.id} className="hover:bg-gray-50">
{visibleColumns.invoiceNumber && ( <td className="px-4 py-3 text-sm"> <button
onClick={() => setSelectedInvoice(invoice)} className="text-indigo-600 hover:text-indigo-800 font-semibold underline" > {invoice.invoiceNumber}</button></td>)}
{visibleColumns.vendor && ( <td className="px-4 py-3 text-sm">{invoice.vendor}</td>)}
{visibleColumns.subtotal && ( <td className="px-4 py-3 text-sm text-right">{currencySymbol(invoice.currency)}{invoice.amount}</td>)}
{visibleColumns.tax && ( <td className="px-4 py-3 text-sm text-right">{currencySymbol(invoice.currency)}{invoice.taxAmount}</td>)}
{visibleColumns.total && ( <td className="px-4 py-3 text-sm text-right font-semibold">{currencySymbol(invoice.currency)}{invoice.totalAmount || (parseFloat(invoice.amount) + parseFloat(invoice.taxAmount)).toFixed(2)}</td>)}
{visibleColumns.spendApproval && ( <td className="px-4 py-3 text-sm">{(() => { const sp = invoice.spendApprovalId ? spendApprovals.find(s => s.id === invoice.spendApprovalId) : null; return sp ? (<button onClick={(e) => { e.stopPropagation(); setCurrentPage('spend-approval'); setSpendView('list'); setSelectedSpend(sp); }} className="font-medium text-indigo-600 hover:text-indigo-800 underline">{sp.ref}</button>) : (<span className="text-gray-400">—</span>); })()}</td>)}
{visibleColumns.date && ( <td className="px-4 py-3 text-sm">{invoice.date}</td>)}
{visibleColumns.dueDate && ( <td className="px-4 py-3 text-sm">{invoice.dueDate}</td>)}
{visibleColumns.file && ( <td className="px-4 py-3 text-sm"> {invoice.fileUrl ? (<div className="flex items-center space-x-2"
onMouseEnter={(e) => { const rect = e.currentTarget.getBoundingClientRect(); setHoveredInvoice({ id: invoice.id, top: rect.top + rect.height / 2, left: rect.right + 8 }); }}
onMouseLeave={() => setHoveredInvoice(null)}> {invoice.fileType?.startsWith('image/') ? (<img src={invoice.fileUrl} alt="" width="32" height="32" style={{width:'32px',height:'32px',objectFit:'cover',borderRadius:'4px',border:'1px solid #e5e7eb',flexShrink:0}}/>) : (<div style={{width:'32px',height:'32px',borderRadius:'4px',border:'1px solid #e5e7eb',display:'flex',alignItems:'center',justifyContent:'center',background:'#f9fafb',flexShrink:0}}><FileText style={{width:'16px',height:'16px',color:'#6366f1'}}/></div>)} <a
href={invoice.fileUrl}
download={invoice.fileName} className="text-indigo-600 hover:text-indigo-800"
title="View/Download Invoice"> <span className="underline text-xs">{invoice.fileName}</span></a></div> ) : (invoice.fileName ? (<div className="flex items-center space-x-2"><div style={{width:'32px',height:'32px',borderRadius:'4px',border:'1px solid #e5e7eb',display:'flex',alignItems:'center',justifyContent:'center',background:'#f9fafb',flexShrink:0}}><FileText style={{width:'16px',height:'16px',color:'#9ca3af'}}/></div><span className="text-gray-500 text-xs">{invoice.fileName}</span></div>) : <span className="text-gray-400 text-xs">No file</span>)}</td>)}
{visibleColumns.submittedBy && ( <td className="px-4 py-3 text-sm">{invoice.submittedBy}</td>)}
{canDeleteInvoices() && ( <td className="px-4 py-3 text-sm"> <button
onClick={() => initiateDeleteInvoice(invoice)} className="flex items-center space-x-1 px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700"
title="Delete Invoice" > <Trash2 className="w-4 h-4"/></button></td>)}</tr> ))}</tbody></table></div></div> ))}</div>)}</div></div>
{hoveredInvoice && (() => { const inv = invoices.find(i => i.id === hoveredInvoice.id); if (!inv || !inv.fileUrl) return null; const popTop = Math.max(8, Math.min(hoveredInvoice.top - 160, window.innerHeight - 340)); const popLeft = hoveredInvoice.left + 280 > window.innerWidth ? hoveredInvoice.left - 280 : hoveredInvoice.left; return ( <div className="fixed z-50 pointer-events-none bg-white rounded-lg shadow-2xl border-2 border-indigo-200 p-2" style={{ top: popTop, left: Math.max(8, popLeft) }}> {inv.fileType?.startsWith('image/') ? ( <img src={inv.fileUrl} alt="Invoice preview" style={{width:'256px',height:'320px',objectFit:'contain',borderRadius:'4px'}}/> ) : inv.fileType === 'application/pdf' ? ( <iframe src={inv.fileUrl} title="PDF preview" style={{width:'256px',height:'320px',border:'none',borderRadius:'4px'}}/> ) : ( <div style={{width:'256px',height:'320px',display:'flex',alignItems:'center',justifyContent:'center',background:'#f3f4f6',borderRadius:'4px'}}> <FileText style={{width:'64px',height:'64px',color:'#9ca3af'}}/></div>)}</div>); })()}
</div>);};
export default InvoiceWorkflowApp;