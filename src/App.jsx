import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useMsal, useIsAuthenticated } from '@azure/msal-react';
import { InteractionRequiredAuthError } from '@azure/msal-browser';
import { Upload, FileText, CheckCircle, XCircle, X, Download, ExternalLink, AlertCircle, LogOut, User, Trash2, Settings, Home, DollarSign, ArrowRight, ChevronDown, ChevronUp, Lock, Plus, Shield, Mail, BarChart3, Wallet, Edit3, Send, Eye, MessageSquare, Sparkles, Loader2, Search, Filter, FileSpreadsheet } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import * as XLSX from 'xlsx';
import { loginRequest } from './authConfig.js';
import { api, setTokenAcquirer, setDevEmail } from './api/client.js';

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
      'spend.edit':     { label: 'Edit spend approvals',             description: 'Edit spend approval details after submission' },
    }
  },
  reports: {
    label: 'Reports',
    permissions: {
      'reports.view':   { label: 'View reports',   description: 'Access the reports dashboard and view charts' },
      'reports.export': { label: 'Export reports',  description: 'Export report data to CSV' },
    }
  },
  budget: {
    label: 'Budgets',
    permissions: {
      'budget.manage_all': { label: 'Manage all budgets',  description: 'Create, edit, and submit budgets for any function/department' },
      'budget.manage_own': { label: 'Manage own budgets',  description: 'Create, edit, and submit budgets for functions where you are the approver' },
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
  { id:'admin',    name:'Admin',    isDefault:true, permissions:['invoices.view_all','invoices.upload','invoices.delete','invoices.approve','invoices.assign_all','spend.create','spend.approve','spend.edit','spend.view_all','reports.view','reports.export','settings.manage_users','settings.view_lookups','settings.manage_lookups','budget.manage_all'] },
  { id:'finance',  name:'Finance',  isDefault:true, permissions:['invoices.view_all','invoices.upload','invoices.delete','invoices.approve','invoices.assign_all','spend.create','spend.approve','spend.view_all','reports.view','reports.export','settings.view_lookups','budget.manage_all'] },
  { id:'approver', name:'Approver', isDefault:true, permissions:['invoices.view_own','invoices.approve','invoices.assign_own','spend.create','spend.approve','spend.view_dept','reports.view','budget.manage_own'] },
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
const _pg = "min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4";
const _cd = "bg-white rounded-lg shadow-lg p-6";
const _h2 = "text-xl font-bold text-gray-800 mb-4";
const _fx = "flex items-center space-x-2";
const _fj = "flex items-center justify-between";
const { instance: msalInstance, accounts } = useMsal();
const isMsalAuthenticated = useIsAuthenticated();
const [user, setUser] = useState(null);
const [userPermissions, setUserPermissions] = useState([]);
const [isAuthenticating, setIsAuthenticating] = useState(false);
const [devUsers, setDevUsers] = useState([]);
const [selectedDevEmail, setSelectedDevEmail] = useState('');
const [dataLoaded, setDataLoaded] = useState(false);

// Set up token acquirer for API client
const acquireToken = useCallback(async () => {
  if (accounts.length === 0) return null;
  try {
    const response = await msalInstance.acquireTokenSilent({ ...loginRequest, account: accounts[0] });
    return response.accessToken;
  } catch (err) {
    if (err instanceof InteractionRequiredAuthError) {
      await msalInstance.acquireTokenRedirect(loginRequest);
      return null; // Page will redirect; token acquired on return
    }
    throw err;
  }
}, [msalInstance, accounts]);

useEffect(() => {
  setTokenAcquirer(acquireToken);
}, [acquireToken]);

// MSAL session restore on page refresh
useEffect(() => {
  if (!isMsalAuthenticated || accounts.length === 0 || user) return;
  let cancelled = false;
  (async () => {
    try {
      setIsAuthenticating(true);
      const token = await acquireToken();
      if (cancelled || !token) { setIsAuthenticating(false); return; }
      const account = accounts[0];
      const idTokenClaims = account.idTokenClaims || {};
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
      if (cancelled) return;
      const userData = await resp.json();
      if (resp.ok) {
        setUser({ name: userData.name, email: userData.email, id: userData.id, role: userData.role, approvalLimit: userData.approvalLimit || 0, isCeo: userData.isCeo || false });
        setUserPermissions(userData.permissions || []);
      }
    } catch (err) {
      console.error('MSAL session restore error:', err);
    } finally {
      if (!cancelled) setIsAuthenticating(false);
    }
  })();
  return () => { cancelled = true; };
}, [isMsalAuthenticated, accounts, user, acquireToken]);

// Dev login: fetch available users
const isDevMode = !import.meta.env.VITE_AZURE_CLIENT_ID;
useEffect(() => {
  if (!isDevMode || user) return;
  const API_BASE = import.meta.env.VITE_API_URL || '';
  fetch(`${API_BASE}/api/auth/dev-users`)
    .then(r => r.ok ? r.json() : [])
    .then(users => {
      setDevUsers(users);
      if (users.length > 0) setSelectedDevEmail(users[0].email);
    })
    .catch(() => {});
}, [isDevMode, user]);

const devLogin = async () => {
  if (!selectedDevEmail) return;
  setIsAuthenticating(true);
  try {
    const API_BASE = import.meta.env.VITE_API_URL || '';
    const resp = await fetch(`${API_BASE}/api/auth/dev-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: selectedDevEmail }),
    });
    const userData = await resp.json();
    if (!resp.ok) { alert(userData.error || 'Login failed'); return; }
    setDevEmail(selectedDevEmail);
    setUser({ name: userData.name, email: userData.email, id: userData.id, role: userData.role, approvalLimit: userData.approvalLimit || 0, isCeo: userData.isCeo || false });
    setUserPermissions(userData.permissions || []);
  } catch (err) {
    console.error('Dev login error:', err);
    alert('Login failed');
  } finally {
    setIsAuthenticating(false);
  }
};

// MSAL login handler — uses redirect flow to avoid COOP header issues
const msalLogin = async () => {
  try {
    setIsAuthenticating(true);
    await msalInstance.loginRedirect(loginRequest);
    // Page will redirect away; session restore useEffect handles the return
  } catch (err) {
    console.error('MSAL login error:', err);
    setIsAuthenticating(false);
  }
};

// Load all data from API when user is authenticated
const loadData = useCallback(async () => {
  if (!user) return;
  try {
    const [invoicesData, spendsData, usersData, rolesData, lookupsData, templatesData, auditData] = await Promise.all([
      api.get('/api/invoices'),
      api.get('/api/spend-approvals'),
      api.get('/api/users'),
      api.get('/api/roles'),
      Promise.all([
        api.get('/api/lookups/atoms').catch(() => []),
        api.get('/api/lookups/cost-centres').catch(() => []),
        api.get('/api/lookups/regions').catch(() => []),
        api.get('/api/lookups/currencies').catch(() => []),
        api.get('/api/lookups/categories').catch(() => []),
        api.get('/api/lookups/functions').catch(() => []),
        api.get('/api/lookups/projects').catch(() => []),
        api.get('/api/lookups/business-units').catch(() => []),
      ]),
      api.get('/api/email-templates').catch(() => []),
      api.get('/api/audit-logs?limit=500').catch(() => ({ logs: [] })),
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

    const [atomsData, costCentresData, regionsData, currenciesData, categoriesData, functionsData, projectsData, businessUnitsData] = lookupsData;
    setAtoms(atomsData);
    setCostCentres(costCentresData);
    setRegions(regionsData);
    setCurrencies(currenciesData);
    setCategories(categoriesData);
    setFunctions(functionsData.map(f => ({ ...f, approverId: f.approver?.id || null, approver: f.approver?.name || '' })));
    setProjects(projectsData);
    setBusinessUnits(businessUnitsData || []);
    setEmailTemplates(templatesData);
    if (auditData?.logs) setAuditLog(prev => { const locals = prev.filter(e => e._local); return [...auditData.logs, ...locals]; });

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
const logAuditRemote = async (action, details, metadata) => {
  const entry = { id: Date.now() + Math.random(), action, details, performedBy: user?.name || 'System', performedAt: new Date().toISOString() };
  setAuditLog(prev => [...prev, entry]);
  try { const saved = await api.post('/api/audit-logs', { action, details, metadata }); Object.assign(entry, saved); } catch (e) { console.error('Audit log persist failed:', e); entry._local = true; }
};
const logAuditLocal = (action, details) => {
  setAuditLog(prev => [...prev, { id: Date.now() + Math.random(), action, details, performedBy: user?.name || 'System', performedAt: new Date().toISOString(), _local: true }]);
};
const [selectedInvoice, setSelectedInvoice] = useState(null);
const [showSuccessNotification, setShowSuccessNotification] = useState(false);
const [notificationMessage, setNotificationMessage] = useState('');
const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
const [deleteConfirmationInput, setDeleteConfirmationInput] = useState('');
const [invoiceToDelete, setInvoiceToDelete] = useState(null);
const [showSettingsPage, setShowSettingsPage] = useState(false);
const [currentPage, setCurrentPage] = useState('landing');
const [budgetsLoaded, setBudgetsLoaded] = useState(false);
const loadBudgetData = useCallback(async () => { try { const [bl, br, b] = await Promise.all([ api.get('/api/budget-lines').catch(() => []), api.get('/api/budget-report').catch(() => []), api.get('/api/budgets').catch(() => []), ]); setBudgetLines(bl || []); setBudgetReport(br || []); setBudgets(b || []); setBudgetsLoaded(true); } catch (err) { console.error('Failed to load budget data:', err); } }, []);
useEffect(() => {
  if (user && dataLoaded && !budgetsLoaded && (currentPage === 'budgets' || currentPage === 'spend-approval' || currentPage === 'budget-matching')) loadBudgetData();
}, [user, dataLoaded, budgetsLoaded, currentPage, loadBudgetData]);
const [settingsTab, setSettingsTab] = useState('users');
useEffect(() => {
  if (currentPage === 'settings' && settingsTab === 'audit' && user) {
    api.get('/api/audit-logs?limit=500').then(data => {
      if (data?.logs) setAuditLog(data.logs);
    }).catch(err => console.error('Failed to refresh audit logs:', err));
  }
}, [settingsTab, currentPage, user]);
const refreshAuditLog = (action, details) => { setAuditLog(prev => [{ id: Date.now() + Math.random(), action: action || 'LOOKUP_CHANGED', details: details || 'Lookup updated', performedBy: user?.name || 'System', performedAt: new Date().toISOString() }, ...prev]); };
const [collapsedLookups, setCollapsedLookups] = useState({atoms:true,costCentres:true,regions:true,currencies:true,categories:true,businessUnits:true,functions:true,projects:true});
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
const [businessUnits, setBusinessUnits] = useState([]);
const [editBU, setEditBU] = useState(null);
const [newBU, setNewBU] = useState({ name:'' });
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
const [commentModal, setCommentModal] = useState(null);
const [commentText, setCommentText] = useState('');
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
const [bulkImport, setBulkImport] = useState({ rows: [], fileName: '', mappings: null, step: null });
const [spendBulk, setSpendBulk] = useState({ rows: [], fileName: '', mappings: null, step: null });
const spendBulkFileRef = useRef(null);
const [budgetBulk, setBudgetBulk] = useState({ rows: [], fileName: '', mappings: null, step: null });
const budgetBulkFileRef = useRef(null);
const bulkFileRef = useRef(null);
const [showColumnSelector, setShowColumnSelector] = useState(false);
const _uk = (s) => `viewPrefs_${user?.email || 'default'}_${s}`;
const [visibleColumns, setVisibleColumns] = usePersistedState(_uk('inv_cols'), { invoiceNumber: true, vendor: true, businessUnit: false, subtotal: true, tax: true, total: true, spendApproval: true, file: true, date: false, dueDate: false, submittedBy: false });
const [groupBy, setGroupBy] = usePersistedState(_uk('inv_group'), 'none');
const [spendForm, setSpendForm] = useState({ cc:'', title:'', currency:'', approver:'', approverId:null, amount:'', category:'', atom:'', vendor:'', costCentre:'', region:'', project:'', description:'', timeSensitive:false, inBudget:false, exceptional:'', justification:'', department:'', businessUnit:'', originInvoiceIds: [] });
const [selectedInvoiceIds, setSelectedInvoiceIds] = useState([]);
const [spendSubmitted, setSpendSubmitted] = useState(false);
const [pendingAttachments, setPendingAttachments] = useState([]);
const spendFormAttachRef = useRef(null);
const [spendView, setSpendView] = useState('list');
const [spendAlerts, setSpendAlerts] = useState([]);
const dismissSpendAlert = (alertId) => setSpendAlerts(prev => prev.filter(a => a.id !== alertId));
const [spendLinkBudgetId, setSpendLinkBudgetId] = useState(null);
const [spendLinkBlSearch, setSpendLinkBlSearch] = useState('');
const [pendingBudgetLineIds, setPendingBudgetLineIds] = useState([]);
const [budgetLines, setBudgetLines] = useState([]);
const [budgetReport, setBudgetReport] = useState([]);
const [budgetReportView, setBudgetReportView] = useState('table');
const [budgets, setBudgets] = useState([]);
const [budgetView, setBudgetView] = useState('list'); // list, detail
const [showBudgetModal, setShowBudgetModal] = useState(false);
const [selectedBudget, setSelectedBudget] = useState(null);
const [budgetForm, setBudgetForm] = useState({ title: '', year: new Date().getFullYear(), functionId: '' });
const [spreadLines, setSpreadLines] = useState({});
const [aiImport, setAiImport] = useState({ open: false, loading: false, error: null, result: null, fileName: '' });
const [bliSearch, setBliSearch] = useState('');
const [bliGroupBy, setBliGroupBy] = useState('');
const [bliFilters, setBliFilters] = useState({ type: '', businessUnit: '', region: '', currency: '', vendor: '' });
const canManageBudgets = () => hasPermission('budget.manage_all') || hasPermission('budget.manage_own');
const getUserFunctions = () => {
  if (hasPermission('budget.manage_all')) return functions.filter(f => f.active);
  return functions.filter(f => f.active && f.approver === user?.name);
};
const [selectedSpend, setSelectedSpend] = useState(null);
const [editingSpend, setEditingSpend] = useState(null);
const [selectedSpendIds, setSelectedSpendIds] = useState([]);
const [spendSearch, setSpendSearch] = useState('');
const [showSpendFilterPanel, setShowSpendFilterPanel] = useState(false);
const [spendFilters, setSpendFilters] = usePersistedState(_uk('spend_filters'), { status:'all', vendor:'all', category:'all', department:'all', project:'all', dateFrom:'', dateTo:'', amountMin:'', amountMax:'', submittedBy:'all', approver:'all' });
const updateSpendFilter = (k,v) => setSpendFilters(p => ({...p,[k]:v}));
const clearSpendFilters = () => setSpendFilters({ status:'all', vendor:'all', category:'all', project:'all', dateFrom:'', dateTo:'', amountMin:'', amountMax:'', submittedBy:'all', approver:'all' });
const getSpendFilterCount = () => { let c=0; if(spendFilters.status!=='all')c++; if(spendFilters.vendor!=='all')c++; if(spendFilters.category!=='all')c++; if(spendFilters.department!=='all')c++; if(spendFilters.project!=='all')c++; if(spendFilters.dateFrom)c++; if(spendFilters.dateTo)c++; if(spendFilters.amountMin)c++; if(spendFilters.amountMax)c++; if(spendFilters.submittedBy!=='all')c++; if(spendFilters.approver!=='all')c++; return c; };
const [spendGroupBy, setSpendGroupBy] = usePersistedState(_uk('spend_group'), 'none');
const [showSpendColSelector, setShowSpendColSelector] = useState(false);
const [spendVisibleCols, setSpendVisibleCols] = usePersistedState(_uk('spend_cols'), { ref:true, title:true, vendor:true, amount:true, invoiced:true, category:true, department:true, businessUnit:false, project:true, submittedBy:true, date:true, status:true, approver:true, region:false, costCentre:false, atom:false });
const toggleSpendCol = (col) => setSpendVisibleCols(p => ({...p,[col]:!p[col]}));
const [apiKeyInfo, setApiKeyInfo] = useState({ configured: false, maskedKey: null, updatedAt: null });
const [apiKeyInput, setApiKeyInput] = useState('');
const [apiKeyTestStatus, setApiKeyTestStatus] = useState(null);
const [apiKeyTestMessage, setApiKeyTestMessage] = useState('');
const [extractionErrors, setExtractionErrors] = useState([]);
const fetchApiKeyStatus = async () => { try { const data = await api.get('/api/settings/api-key'); setApiKeyInfo(data); } catch { /* ignore for non-admins */ } };
const saveApiKey = async (key) => { try { setApiKeyTestStatus('testing'); setApiKeyTestMessage('Saving...'); await api.put('/api/settings/api-key', { apiKey: key }); setApiKeyInput(''); await fetchApiKeyStatus(); setApiKeyTestStatus('success'); setApiKeyTestMessage('API key saved successfully.'); } catch (err) { setApiKeyTestStatus('error'); setApiKeyTestMessage(err.message || 'Failed to save API key.'); } };
const removeApiKey = async () => { try { await api.delete('/api/settings/api-key'); setApiKeyInput(''); await fetchApiKeyStatus(); setApiKeyTestStatus('success'); setApiKeyTestMessage('API key removed.'); } catch (err) { setApiKeyTestStatus('error'); setApiKeyTestMessage(err.message || 'Failed to remove API key.'); } };
const testApiKey = async () => { setApiKeyTestStatus('testing'); setApiKeyTestMessage('Testing API key...'); try { const canvas = document.createElement('canvas'); canvas.width = 1; canvas.height = 1; const dataUrl = canvas.toDataURL('image/png'); const base64 = dataUrl.split(',')[1]; const result = await api.post('/api/extract-invoice', { file: base64, mediaType: 'image/png' }); if (result.success) { setApiKeyTestStatus('success'); setApiKeyTestMessage('API key is valid! Claude AI extraction is ready to use.'); } else { setApiKeyTestStatus('success'); setApiKeyTestMessage('API key accepted. Claude AI extraction is ready to use.'); } } catch (err) { if (err.message?.includes('configuration_error') || err.message?.includes('No Anthropic API key')) { setApiKeyTestStatus('error'); setApiKeyTestMessage('No API key configured. Please save a key first.'); } else if (err.status === 401) { setApiKeyTestStatus('error'); setApiKeyTestMessage('Invalid API key. Please check your key and try again.'); } else { setApiKeyTestStatus('error'); setApiKeyTestMessage('Test failed: ' + err.message); } } };
const extractWithClaude = async (file) => { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = async () => { try { const base64 = reader.result.split(',')[1]; const result = await api.post('/api/extract-invoice', { file: base64, mediaType: file.type }); if (!result.success) { reject(new Error(result.error || 'Extraction failed')); return; } const d = result.data; resolve({ invoiceNumber: d.invoice?.invoice_number || d.invoiceNumber || `INV-${Math.floor(Math.random() * 10000)}`, vendor: d.supplier?.company || d.vendor || 'Unknown Vendor', date: d.invoice?.invoice_date || d.date || new Date().toISOString().split('T')[0], dueDate: d.invoice?.due_date || d.dueDate || new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0], amount: String(parseFloat(d.totals?.subtotal ?? d.amount) || 0).replace(/[^0-9.]/g, '') || '0.00', taxAmount: String(parseFloat(d.totals?.vat_amount ?? d.taxAmount) || 0).replace(/[^0-9.]/g, '') || '0.00', description: d.invoice?.title || d.description || '', department: d.department || 'General', lineItems: Array.isArray(d.line_items) ? d.line_items.map(li => ({ category: li.category || '', description: li.description || '', quantity: Number(li.quantity) || 0, rate: Number(li.unit_rate) || 0, amount: Number(li.amount) || 0 })) : Array.isArray(d.lineItems) ? d.lineItems.map(li => ({ description: li.description || '', quantity: Number(li.quantity) || 0, rate: Number(li.rate) || 0, amount: Number(li.amount) || 0 })) : [], supplier: d.supplier || null, customer: d.customer || null, paymentTerms: d.invoice?.payment_terms || '', currency: d.invoice?.currency || '', vatRate: d.totals?.vat_rate ?? null, subtotal: String(parseFloat(d.totals?.subtotal) || 0) || '0.00', totalAmount: String(parseFloat(d.totals?.total) || 0) || '0.00', bankDetails: d.bank_details || null, fileName: file.name, fileUrl: reader.result, fileType: file.type }); } catch (err) { reject(err); } }; reader.onerror = () => reject(new Error('Failed to read file')); reader.readAsDataURL(file); }); };
const [pendingMatches, setPendingMatches] = useState([]);
const [pendingBudgetMatches, setPendingBudgetMatches] = useState([]);
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
logAuditRemote('INVOICE_MATCHED', `Invoice ${inv.invoiceNumber} matched to spend approval "${sp.title}" (€${toEur(sp.amount, sp.currency).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})})`);
setPendingMatches(prev => prev.map(m => m.spendId===spendId ? {...m, suggestions: m.suggestions.filter(s=>s.invoiceId!==invoiceId)} : m).filter(m=>m.suggestions.length>0));};
const dismissSpendMatch = (spendId) => { setPendingMatches(prev => prev.filter(m => m.spendId !== spendId)); };
const findBudgetMatches = () => { const results = [];
const unlinkedBl = budgetLines.filter(bl => !bl.spendApprovalId);
spendApprovals.filter(sp => sp && sp.status === 'Approved').forEach(sp => { const suggestions = [];
const spVendor = (sp.vendor||'').toLowerCase(); const spAmtEur = toEur(parseFloat(sp.amount)||0, sp.currency);
const linkedBl = budgetLines.filter(bl => bl.spendApprovalId === sp.id);
const totalBudgetEur = linkedBl.reduce((sum,bl) => sum + (parseFloat(bl.eurAnnual)||0), 0);
unlinkedBl.forEach(bl => { let score = 0; let reasons = [];
const blVendor = (bl.vendor||'').toLowerCase();
if (blVendor && spVendor && (blVendor.includes(spVendor) || spVendor.includes(blVendor))) { score += 35; reasons.push('Vendor match'); }
else if (blVendor && spVendor) { const words = spVendor.split(/\s+/); if (words.some(w => w.length > 2 && blVendor.includes(w))) { score += 15; reasons.push('Partial vendor'); } }
if (bl.region && sp.region && bl.region.toLowerCase() === sp.region.toLowerCase()) { score += 15; reasons.push('Region match'); }
if (bl.costCentre && sp.costCentre && bl.costCentre.toLowerCase() === sp.costCentre.toLowerCase()) { score += 15; reasons.push('Cost centre match'); }
const blEur = parseFloat(bl.eurAnnual)||0;
if (blEur > 0 && spAmtEur > 0) { const diff = Math.abs(blEur - spAmtEur) / spAmtEur; if (diff <= 0.15) { score += 20; reasons.push(`Amount ±${(diff*100).toFixed(0)}%`); } }
const blLic = (bl.licence||'').toLowerCase(); const spTitle = (sp.title||'').toLowerCase();
if (blLic && spTitle && (blLic.includes(spTitle) || spTitle.includes(blLic))) { score += 25; reasons.push('Title/licence match'); }
else { const titleWords = spTitle.split(/\s+/).filter(w => w.length > 3); if (titleWords.some(w => blLic.includes(w))) { score += 10; reasons.push('Partial title match'); } }
if (score >= 15) suggestions.push({ budgetLineId: bl.id, licence: bl.licence||'', vendor: bl.vendor||'', eurAnnual: parseFloat(bl.eurAnnual)||0, currency: bl.currency||'EUR', region: bl.region||'', costCentre: bl.costCentre||'', businessUnit: bl.businessUnit||'', serviceCategory: bl.serviceCategory||bl.licence||'', type: bl.type||'BAU', score, reasons }); });
if (suggestions.length > 0) results.push({ spendId: sp.id, spendRef: sp.ref||'', spendTitle: sp.title||'', spendVendor: sp.vendor||'', spendCurrency: sp.currency||'', spendAmount: sp.amount||'0', spendCategory: sp.category||'', spendRegion: sp.region||'', linkedBudgetCount: linkedBl.length, totalBudgetEur, suggestions: suggestions.sort((a,b) => b.score - a.score) }); }); return results;};
const runBudgetMatch = () => { const results = findBudgetMatches();
setPendingBudgetMatches(results);
if (results.length > 0) { setCurrentPage('budget-matching'); } else { alert('No matching budget items found for any approved spend approvals.'); }};
const acceptBudgetMatch = async (budgetLineId, spendId) => { try {
await api.patch(`/api/budget-lines/${budgetLineId}/link`, { spendApprovalId: spendId });
setBudgetLines(prev => prev.map(b => b.id===budgetLineId ? {...b, spendApprovalId: spendId} : b));
const bl = budgetLines.find(b => b.id===budgetLineId); const sp = spendApprovals.find(s => s.id===spendId);
logAuditRemote('BUDGET_LINE_MATCHED', `Budget line "${bl?.licence}" matched to spend approval "${sp?.title}"`);
setPendingBudgetMatches(prev => prev.map(m => m.spendId===spendId ? {...m, suggestions: m.suggestions.filter(s=>s.budgetLineId!==budgetLineId)} : m).filter(m=>m.suggestions.length>0));
} catch(err) { alert('Failed to link: '+err.message); }};
const dismissBudgetMatch = (spendId) => { setPendingBudgetMatches(prev => prev.filter(m => m.spendId !== spendId)); };
const unlinkInvoice = (invoiceId) => { const inv = invoices.find(i => i.id === invoiceId); if (!inv) return;
setInvoices(prev => prev.map(i => i.id === invoiceId ? {...i, spendApprovalId: null, spendApprovalTitle: null} : i));
logAuditRemote('INVOICE_UNLINKED', `Invoice ${inv.invoiceNumber} unlinked from spend approval`);};
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
logAuditRemote('SPEND_THRESHOLD_ALERT', `Spend approval "${sp.title}" (${sp.ref}) reached ${crossed} threshold — Invoiced: €${newTotalEur.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})} of €${approvedEur.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`);
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
const [reportFilters, setReportFilters] = usePersistedState(_uk('report_filters'), { dateFrom: '', dateTo: '', department: 'all', approver: 'all', region: 'all', project: 'all', costCentre: 'all', atom: 'all', vendor: 'all', budget: 'all' });
const [chartOrder, setChartOrder] = usePersistedState(_uk('chart_order'), ['spendByCategory','spendByDept','invoiceVolume','approvedVsInvoiced','statusBreakdown','invoicedByRegion']);
const [dynSource, setDynSource] = useState('budgets');
const [dynGroupBy, setDynGroupBy] = useState('department');
const [dynChartType, setDynChartType] = useState('bar');
const CHART_COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6','#f97316'];
const reportData = React.useMemo(() => {
  const rf = reportFilters;
  const rfv = (k) => rf[k] && rf[k] !== 'all';
  const spMatch = (s) => { if (rf.dateFrom && (s.submittedAt?.split('T')[0]||'') < rf.dateFrom) return false; if (rf.dateTo && (s.submittedAt?.split('T')[0]||'') > rf.dateTo) return false; if (rfv('department') && s.department!==rf.department) return false; if (rfv('approver') && s.approver!==rf.approver) return false; if (rfv('region') && s.region!==rf.region) return false; if (rfv('project') && s.project!==rf.project) return false; if (rfv('costCentre') && s.costCentre!==rf.costCentre) return false; if (rfv('atom') && s.atom!==rf.atom) return false; if (rfv('vendor') && s.vendor!==rf.vendor) return false; return true; };
  const filtSp = spendApprovals.filter(spMatch);
  const filtSpIds = new Set(filtSp.map(s => s.id));
  const filtInv = invoices.filter(i => { if (rf.dateFrom && i.date < rf.dateFrom) return false; if (rf.dateTo && i.date > rf.dateTo) return false; if (rfv('vendor') && i.vendor!==rf.vendor) return false; const hasSpFilters = rfv('department')||rfv('approver')||rfv('region')||rfv('project')||rfv('costCentre')||rfv('atom'); if (hasSpFilters) { if (!i.spendApprovalId) return false; if (!filtSpIds.has(i.spendApprovalId)) return false; } return true; });
  const totalInvoicedEur = filtInv.reduce((s,i) => s + toEur(invoiceTotal(i), i.currency || 'EUR'), 0);
  const approvedSpends = filtSp.filter(s => s.status === 'Approved');
  const totalApprovedEur = approvedSpends.reduce((s,sp) => s + toEur(parseFloat(sp.amount)||0, sp.currency), 0);
  const approvalRate = filtSp.length > 0 ? (approvedSpends.length / filtSp.length * 100) : 0;
  const avgDays = (() => { const linked = filtInv.filter(i => i.spendApprovalId); if (linked.length === 0) return 0; const total = linked.reduce((s,i) => { const sp = spendApprovals.find(sp => sp.id === i.spendApprovalId); if (!sp) return s; const d1 = new Date(sp.submittedAt); const d2 = new Date(i.date || i.submittedAt || sp.submittedAt); return s + Math.abs(d2 - d1) / 86400000; }, 0); return total / linked.length; })();
  // Spend by category (pie)
  const catMap = {}; approvedSpends.forEach(sp => { const c = sp.category || 'Other'; catMap[c] = (catMap[c]||0) + toEur(parseFloat(sp.amount)||0, sp.currency); });
  const spendByCategory = Object.entries(catMap).map(([name,value]) => ({name, value: Math.round(value*100)/100}));
  // Spend by department (bar)
  const deptMap = {}; approvedSpends.forEach(sp => { const d = sp.department || 'Other'; deptMap[d] = (deptMap[d]||0) + toEur(parseFloat(sp.amount)||0, sp.currency); });
  const spendByDept = Object.entries(deptMap).map(([name,value]) => ({name, value: Math.round(value*100)/100}));
  // Invoice volume over time (line)
  const monthMap = {}; filtInv.forEach(i => { const m = (i.date || '').slice(0,7); if (m) monthMap[m] = (monthMap[m]||0) + 1; });
  const invoiceVolume = Object.entries(monthMap).sort((a,b)=>a[0].localeCompare(b[0])).map(([month,count]) => ({month, count}));
  // Approved vs Invoiced by dept (grouped bar)
  const invDeptMap = {}; filtInv.forEach(i => { const sp = spendApprovals.find(sp => sp.id === i.spendApprovalId); const d = sp?.department || 'Unlinked'; invDeptMap[d] = (invDeptMap[d]||0) + toEur(invoiceTotal(i), i.currency || 'EUR'); });
  const allDepts = [...new Set([...Object.keys(deptMap), ...Object.keys(invDeptMap)])];
  const approvedVsInvoiced = allDepts.map(d => ({ name: d, approved: Math.round((deptMap[d]||0)*100)/100, invoiced: Math.round((invDeptMap[d]||0)*100)/100 }));
  // Invoiced by region (bar)
  const regionMap = {}; filtInv.forEach(i => { const sp = spendApprovals.find(sp => sp.id === i.spendApprovalId); const r = sp?.region || 'Unknown'; regionMap[r] = (regionMap[r]||0) + toEur(invoiceTotal(i), i.currency || 'EUR'); });
  const invoicedByRegion = Object.entries(regionMap).map(([name,value]) => ({name, value: Math.round(value*100)/100}));
  // Approval status breakdown (pie)
  const statusMap = {}; filtSp.forEach(sp => { statusMap[sp.status] = (statusMap[sp.status]||0) + 1; });
  const statusBreakdown = Object.entries(statusMap).map(([name,value]) => ({name, value}));
  return { totalInvoicedEur, totalApprovedEur, invoiceCount: filtInv.length, approvalCount: filtSp.length, approvalRate, avgDays, spendByCategory, spendByDept, invoiceVolume, approvedVsInvoiced, invoicedByRegion, statusBreakdown };
}, [invoices, spendApprovals, reportFilters, currencies]);
const [showConfig, setShowConfig] = useState(false);
const fileInputRef = useRef(null);
const spendFileInputRef = useRef(null);
const spendAttachInputRef = useRef(null);
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
useEffect(() => { if (hasPermission('settings.manage_users')) { fetchApiKeyStatus(); } }, [user]); // eslint-disable-line react-hooks/exhaustive-deps
const getVisibilityScope = (domain) => {
  if (hasPermission(`${domain}.view_all`)) return 'all';
  if (domain === 'spend' && hasPermission('spend.view_dept')) return 'dept';
  if (hasPermission(`${domain}.view_own`)) return 'own';
  return 'none';
};
const getUserDepts = () => { if (!user) return []; if (hasPermission('spend.view_all')) return []; return functions.filter(f => f.approver === user.name).map(f => f.name); };
const logout = async () => {
try { await api.post('/api/auth/logout'); } catch {}
try { await msalInstance.logoutRedirect({ onRedirectNavigate: () => false }); } catch {}
setDevEmail(null);
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
logAuditRemote('ROLE_CHANGE', `User ${targetUser.name} role changed from ${oldRole} to ${newRole}`);};
const inviteUser = () => { if (!inviteEmail || !inviteEmail.includes('@')) { alert('Invalid email'); return;}
if (mockUsers.some(u => u.email.toLowerCase() === inviteEmail.toLowerCase())) { alert('Email already exists'); return;} const newUser = { id: Date.now(), name: inviteEmail.split('@')[0].replace('.', ' ').replace(/\b\w/g, l => l.toUpperCase()), email: inviteEmail, role: inviteRole, status: 'Pending', createdAt: new Date().toISOString(), invitedBy: user.name};
setMockUsers([...mockUsers, newUser]);
logAuditRemote('USER_INVITED', `User invited: ${inviteEmail} with role ${inviteRole}`);
setShowInviteModal(false); setInviteEmail('');
setInviteRole('User');
alert(`Invitation sent to ${inviteEmail}`);};
const initiateRemoveUser = (usr) => { if (usr.id === user.id) { alert('Cannot remove self'); return;}
if (usr.status === 'Removed' || usr.status === 'Anonymized') { alert('Already removed'); return;}
setUserToRemove(usr);
setShowRemoveConfirmation(true);};
const confirmRemoveUser = () => { setMockUsers(mockUsers.map(u => u.id === userToRemove.id ? { ...u, status: 'Removed', removedAt: new Date().toISOString(), removedBy: user.name} : u ));
logAuditRemote('USER_REMOVED', `User access revoked: ${userToRemove.name} (${userToRemove.email}) - Role: ${userToRemove.role}. User remains in system for data integrity.`);
setShowRemoveConfirmation(false);
if (window.confirm(`Access revoked.\n\nAnonymize data now?\n\nAnonymize later from user list.`)) { const anonymousId = `User_${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
setMockUsers(prev => prev.map(u => u.id === userToRemove.id ? { ...u, name: anonymousId, email: `${anonymousId.toLowerCase()}@anonymized.local`, status: 'Anonymized', anonymizedAt: new Date().toISOString()} : u ));
setInvoices(invoices.map(inv => ({ ...inv, submittedBy: inv.submittedBy === userToRemove.name ? anonymousId : inv.submittedBy })));
logAuditRemote('GDPR_ANONYMIZATION', `User data anonymized after removal per GDPR request. ID: ${userToRemove.email} → New: ${anonymousId}. Note: Audit preserved for compliance.`, { gdprCompliance: true, originalEmail: userToRemove.email, anonymousId });
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
logAuditRemote('GDPR_ANONYMIZATION', `User data anonymized per GDPR request. ID: ${userToAnonymize.email} → New: ${anonymousId}. Note: Audit preserved for compliance.`, { gdprCompliance: true, originalEmail: userToAnonymize.email, anonymousId });
setShowGdprModal(false);
setUserToAnonymize(null);
setGdprConfirmEmail('');
alert(`Data anonymized.\n\nOriginal: ${userToAnonymize.email}\nNew ID: ${anonymousId}\n\nAudit trail preserved for compliance.`);};
const cancelGdprAnonymization = () => { setShowGdprModal(false);
setUserToAnonymize(null);
setGdprConfirmEmail('');};
const resendInvitation = (usr) => { logAuditRemote('INVITATION_RESENT', `Invitation resent to: ${usr.email}`);
alert(`Invitation resent to ${usr.email}`);};
const canApproveSpend = () => hasPermission('spend.approve');
const canCreateSpend = () => hasPermission('spend.create');
const canEditSpend = () => hasPermission('spend.edit');
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
try { await api.delete(`/api/invoices/${invoiceToDelete.id}`); } catch (err) { alert(`Failed to delete invoice: ${err.message}`); return; }
setInvoices(invoices.filter(inv => inv.id !== invoiceToDelete.id));
if (selectedInvoice && selectedInvoice.id === invoiceToDelete.id) { setSelectedInvoice(null);}
setShowDeleteConfirmation(false);
setInvoiceToDelete(null);
setDeleteConfirmationInput('');
alert(`Invoice ${invoiceToDelete.invoiceNumber} has been deleted.`);};
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
logAuditLocal('FILES_SELECTED', `${validFiles.length} file(s) selected for upload`);};
const extractInvoiceDataBatch = async (files) => { setIsProcessing(true);
setProcessingProgress({ current: 0, total: files.length });
setExtractionErrors([]);
const extractedBatch = [];
const errors = [];
for (let i = 0; i < files.length; i++) { const file = files[i];
setProcessingProgress({ current: i + 1, total: files.length });
try { const data = await extractWithClaude(file); extractedBatch.push(data); } catch (err) { console.error(`Claude extraction failed for ${file.name}:`, err); errors.push({ fileName: file.name, error: err.message }); }}
setExtractionErrors(errors);
setExtractedDataBatch(extractedBatch);
setIsProcessing(false);};
const processInvoiceBatch = async () => { if (extractedDataBatch.length === 0) return;
setIsProcessing(true);
setProcessingProgress({ current: 0, total: extractedDataBatch.length });
const newInvoices = [];
const duplicates = [];
for (let i = 0; i < extractedDataBatch.length; i++) { const extractedData = extractedDataBatch[i];
setProcessingProgress({ current: i + 1, total: extractedDataBatch.length });
try {
const saved = await api.post('/api/invoices', {
  invoiceNumber: extractedData.invoiceNumber,
  vendor: extractedData.vendor,
  date: extractedData.date,
  dueDate: extractedData.dueDate,
  amount: extractedData.amount,
  taxAmount: extractedData.taxAmount,
  department: extractedData.department,
  description: extractedData.description,
  submittedBy: user.name,
  fileName: extractedData.fileName,
  fileUrl: extractedData.fileUrl,
  supplierJson: extractedData.supplier || null,
  customerJson: extractedData.customer || null,
  currency: extractedData.currency,
  lineItems: extractedData.lineItems || [],
});
const newInvoice = { ...saved, amount: String(saved.amount), taxAmount: String(saved.taxAmount), submittedDate: saved.createdAt || new Date().toISOString(), submittedBy: saved.submittedBy, spendApprovalId: null, spendApprovalTitle: null, fileName: extractedData.fileName, fileUrl: extractedData.fileUrl, fileType: extractedData.fileType };
newInvoices.push(newInvoice);
} catch (err) {
  if (err.message?.includes('Duplicate invoice') || err.status === 409) { duplicates.push({ invoiceNumber: extractedData.invoiceNumber, vendor: extractedData.vendor }); }
  else { console.error(`Failed to save invoice ${extractedData.invoiceNumber}:`, err); alert(`Failed to save invoice ${extractedData.invoiceNumber}: ${err.message}`); }
}}
const allInvoices = [...invoices, ...newInvoices];
setInvoices(allInvoices);
setExtractedDataBatch([]);
setSelectedFiles([]);
setIsProcessing(false);
setProcessingProgress({ current: 0, total: 0 });
if (fileInputRef.current) { fileInputRef.current.value = '';}
if (duplicates.length > 0 && newInvoices.length > 0) { alert(`${newInvoices.length} invoice(s) imported. ${duplicates.length} duplicate(s) skipped: ${duplicates.map(d => d.invoiceNumber).join(', ')}`); }
else if (duplicates.length > 0 && newInvoices.length === 0) { alert(`All ${duplicates.length} invoice(s) were duplicates and skipped: ${duplicates.map(d => d.invoiceNumber).join(', ')}`); }};
const removeFromBatch = (idx) => { setExtractedDataBatch(prev => { const next = prev.filter((_, i) => i !== idx); if (next.length === 0 && fileInputRef.current) fileInputRef.current.value = ''; return next; }); setSelectedFiles(prev => prev.filter((_, i) => i !== idx)); };
const handleBulkFile = (e) => {
  const file = e.target.files?.[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = (evt) => {
    try {
      const data = new Uint8Array(evt.target.result);
      const wb = XLSX.read(data, { type: 'array' });
      if (wb.SheetNames.length > 1) {
        setBulkImport({ rows: [], fileName: file.name, mappings: null, step: 'sheet', workbook: wb, sheetNames: wb.SheetNames });
      } else {
        selectBulkSheet(wb, wb.SheetNames[0], file.name);
      }
    } catch (err) { alert('Failed to parse file: ' + err.message); }
  };
  reader.readAsArrayBuffer(file);
  if (bulkFileRef.current) bulkFileRef.current.value = '';
};
const selectBulkSheet = (wb, sheetName, fileName) => {
  const sheet = wb.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  if (json.length === 0) { alert('No data found in sheet "' + sheetName + '"'); return; }
  const headers = Object.keys(json[0]);
  const targetFields = ['invoiceNumber','vendor','date','dueDate','amount','taxAmount','currency','department','businessUnit','description'];
  const fieldLabels = { invoiceNumber:'Invoice #', vendor:'Vendor', date:'Invoice Date', dueDate:'Due Date', amount:'Subtotal/Amount', taxAmount:'Tax Amount', currency:'Currency', department:'Department', businessUnit:'Business Unit', description:'Description' };
  const autoMap = {};
  const aliases = { invoiceNumber: ['invoice','inv','invoice_number','invoice #','invoice_no','inv_no','invoice no','inv #','invoicenumber'],
    vendor: ['vendor','supplier','vendor_name','supplier_name','company'],
    date: ['date','invoice_date','invoice date','inv_date','invoicedate'],
    dueDate: ['due','due_date','due date','duedate','payment_date','payment date'],
    amount: ['amount','subtotal','sub_total','sub total','net','net_amount','net amount','total'],
    taxAmount: ['tax','vat','tax_amount','tax amount','vat_amount','gst','taxamount'],
    currency: ['currency','curr','ccy'],
    department: ['department','dept','dept.','department_name'],
    businessUnit: ['business_unit','business unit','businessunit','bu','unit'],
    description: ['description','desc','details','memo','notes','narrative'] };
  targetFields.forEach(f => {
    const aliasList = aliases[f] || [f.toLowerCase()];
    const match = headers.find(h => aliasList.includes(h.toLowerCase().trim()));
    if (match) autoMap[f] = match;
  });
  setBulkImport(prev => ({ ...prev, rows: json, fileName: fileName || prev.fileName, mappings: autoMap, step: 'map', headers, targetFields, fieldLabels, selectedSheet: sheetName }));
};
const setBulkMapping = (field, header) => {
  setBulkImport(prev => ({ ...prev, mappings: { ...prev.mappings, [field]: header || undefined } }));
};
const bulkImportPreview = () => {
  if (!bulkImport.mappings?.invoiceNumber && !bulkImport.mappings?.vendor) { alert('Please map at least Invoice # or Vendor'); return; }
  setBulkImport(prev => ({ ...prev, step: 'preview' }));
};
const getMappedRows = () => {
  const m = bulkImport.mappings || {};
  return bulkImport.rows.map(row => {
    const mapped = {};
    Object.entries(m).forEach(([field, header]) => { if (header) mapped[field] = String(row[header] ?? '').trim(); });
    if (mapped.amount) mapped.amount = String(parseFloat(String(mapped.amount).replace(/[^0-9.\-]/g,'')) || 0);
    if (mapped.taxAmount) mapped.taxAmount = String(parseFloat(String(mapped.taxAmount).replace(/[^0-9.\-]/g,'')) || 0);
    return mapped;
  }).filter(r => r.invoiceNumber || r.vendor);
};
const confirmBulkImport = async () => {
  const rows = getMappedRows();
  if (rows.length === 0) { alert('No valid rows to import'); return; }
  setIsProcessing(true);
  setProcessingProgress({ current: 0, total: rows.length });
  try {
    const withUser = rows.map(r => ({ ...r, submittedBy: user.name }));
    const result = await api.post('/api/invoices/bulk-import', withUser);
    const newInvoices = result.created.map(s => ({ ...s, amount: String(s.amount), taxAmount: String(s.taxAmount), submittedDate: s.submittedDate || new Date().toISOString(), spendApprovalId: null, lineItems: [] }));
    setInvoices(prev => [...prev, ...newInvoices]);
    const totalAmount = newInvoices.reduce((sum, inv) => sum + (parseFloat(inv.amount) || 0) + (parseFloat(inv.taxAmount) || 0), 0);
    const vendors = [...new Set(newInvoices.map(inv => inv.vendor).filter(Boolean))];
    const skipped = result.skipped || [];
    setBulkImport({ rows: [], fileName: '', mappings: null, step: 'success', summary: { count: newInvoices.length, totalAmount, vendors, fileName: bulkImport.fileName, skipped } });
  } catch (err) { alert('Bulk import failed: ' + err.message); }
  setIsProcessing(false);
  setProcessingProgress({ current: 0, total: 0 });
};
// --- Spend Approval Bulk Import ---
const handleSpendBulkFile = (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (evt) => {
    try {
      const wb = XLSX.read(evt.target.result, { type: 'array' });
      if (wb.SheetNames.length > 1) {
        setSpendBulk({ rows: [], fileName: file.name, mappings: null, step: 'sheet', workbook: wb, sheetNames: wb.SheetNames });
      } else {
        selectSpendBulkSheet(wb, wb.SheetNames[0], file.name);
      }
    } catch (err) { alert('Failed to parse file: ' + err.message); }
  };
  reader.readAsArrayBuffer(file);
  if (spendBulkFileRef.current) spendBulkFileRef.current.value = '';
};
const selectSpendBulkSheet = (wb, sheetName, fileName) => {
  const sheet = wb.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  if (json.length === 0) { alert('No data found in sheet "' + sheetName + '"'); return; }
  const headers = Object.keys(json[0]);
  const targetFields = ['ref','title','department','businessUnit','vendor','category','currency','amount','costCentre','atom','region','project','description','status','exceptional','justification'];
  const fieldLabels = { ref:'Reference',title:'Title',department:'Function / Dept',businessUnit:'Business Unit',vendor:'Vendor',category:'Category',currency:'Currency',amount:'Amount',costCentre:'Cost Centre',atom:'Atom',region:'Region',project:'Project',description:'Description',status:'Status',exceptional:'Exceptional',justification:'Justification' };
  const aliases = {
    ref:['ref','reference','sa_ref','spend_ref','sa ref','spend ref','sa_number','sa number'],
    title:['title','name','description','spend_title','request','request_title'],
    department:['department','dept','function','dept.','department_name','function_name'],
    businessUnit:['business_unit','business unit','businessunit','bu','unit'],
    vendor:['vendor','supplier','vendor_name','supplier_name','company'],
    category:['category','spend_category','type','spend_type'],
    currency:['currency','curr','ccy'],
    amount:['amount','value','total','spend_amount','cost'],
    costCentre:['cost_centre','cost centre','costcentre','cc','cost_center','cost center'],
    atom:['atom','atom_code'],
    region:['region','location','country'],
    project:['project','project_name'],
    description:['description','desc','spend_description','details'],
    status:['status','approval_status'],
    exceptional:['exceptional','exception'],
    justification:['justification','reason','business_justification','notes','comments']
  };
  const autoMap = {};
  targetFields.forEach(f => {
    const aliasList = aliases[f] || [f.toLowerCase()];
    const match = headers.find(h => aliasList.includes(h.toLowerCase().trim()));
    if (match) autoMap[f] = match;
  });
  setSpendBulk(prev => ({ ...prev, rows: json, fileName: fileName || prev.fileName, mappings: autoMap, step: 'map', headers, targetFields, fieldLabels, selectedSheet: sheetName }));
};
const setSpendBulkMapping = (field, header) => {
  setSpendBulk(prev => ({ ...prev, mappings: { ...prev.mappings, [field]: header || undefined } }));
};
const spendBulkPreview = () => {
  if (!spendBulk.mappings?.title && !spendBulk.mappings?.vendor) { alert('Please map at least Title or Vendor'); return; }
  setSpendBulk(prev => ({ ...prev, step: 'preview' }));
};
const getSpendMappedRows = () => {
  const m = spendBulk.mappings || {};
  return spendBulk.rows.map(row => {
    const mapped = {};
    Object.entries(m).forEach(([field, header]) => { if (header) mapped[field] = String(row[header] ?? '').trim(); });
    if (mapped.amount) mapped.amount = String(parseFloat(String(mapped.amount).replace(/[^0-9.\-]/g,'')) || 0);
    return mapped;
  }).filter(r => r.title || r.vendor);
};
const confirmSpendBulkImport = async () => {
  const rows = getSpendMappedRows();
  if (rows.length === 0) { alert('No valid rows to import'); return; }
  setIsProcessing(true);
  try {
    const withUser = rows.map(r => ({ ...r, submittedBy: user.name }));
    const result = await api.post('/api/spend-approvals/bulk-import', withUser);
    const newSpends = result.created.map(s => ({ ...s, amount: String(s.amount), approver: s.approver?.name || '', attachments: [] }));
    setSpendApprovals(prev => [...newSpends, ...prev]);
    const totalAmount = newSpends.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
    const vendors = [...new Set(newSpends.map(s => s.vendor).filter(Boolean))];
    const skipped = result.skipped || [];
    setSpendBulk({ rows: [], fileName: '', mappings: null, step: 'success', summary: { count: newSpends.length, totalAmount, vendors, fileName: spendBulk.fileName, skipped } });
  } catch (err) { alert('Bulk import failed: ' + err.message); }
  setIsProcessing(false);
};
const toggleColumnVisibility = (columnKey) => { setVisibleColumns(prev => ({ ...prev, [columnKey]: !prev[columnKey] }));};
const updateFilter = (key, value) => { setFilters(prev => ({ ...prev, [key]: value }));
logAuditLocal('FILTER_APPLIED', `Filter applied: ${key} = ${value}`);};
const clearFilters = () => { setFilters({ vendor: 'all', dateFrom: '', dateTo: '', amountMin: '', amountMax: '', submittedBy: 'all', searchTerm: '' });
logAuditLocal('FILTERS_CLEARED', 'All filters cleared');};
const getFilteredInvoices = () => { return invoices.filter(invoice => { if (getVisibilityScope('invoices')==='own' && invoice.submittedBy !== user.name) return false;
if (filters.vendor !== 'all' && invoice.vendor !== filters.vendor) { return false;}
if (filters.dateFrom && invoice.date < filters.dateFrom) { return false;}
if (filters.dateTo && invoice.date > filters.dateTo) { return false;}
if (filters.amountMin && parseFloat(invoice.amount) < parseFloat(filters.amountMin)) { return false;}
if (filters.amountMax && parseFloat(invoice.amount) > parseFloat(filters.amountMax)) { return false;}
if (filters.submittedBy !== 'all' && invoice.submittedBy !== filters.submittedBy) { return false;}
if (filters.searchTerm) { const searchLower = filters.searchTerm.toLowerCase();
const matchesSearch =
invoice.invoiceNumber.toLowerCase().includes(searchLower) || invoice.vendor.toLowerCase().includes(searchLower) || (invoice.description && invoice.description.toLowerCase().includes(searchLower)) || (invoice.businessUnit && invoice.businessUnit.toLowerCase().includes(searchLower));
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
const exportToExcel = () => { const headers = ['Invoice #', 'Vendor', 'Business Unit', 'Date', 'Currency', 'Subtotal', 'Tax', 'Total', 'Submitted By'];
const rows = invoices.map(inv => [ inv.invoiceNumber, inv.vendor, inv.businessUnit || '', inv.date, inv.currency || '', inv.amount, inv.taxAmount, inv.totalAmount || (parseFloat(inv.amount) + parseFloat(inv.taxAmount)).toFixed(2), inv.submittedBy || 'N/A' ]);
const csvContent = [ headers.join(','), ...rows.map(row => row.join(',')) ].join('\n');
const blob = new Blob([csvContent], { type: 'text/csv' });
const url = window.URL.createObjectURL(blob);
const a = document.createElement('a'); a.href = url;
a.download = `invoices_${new Date().toISOString().split('T')[0]}.csv`; a.click();
logAuditRemote('DATA_EXPORTED', `Invoice data exported to CSV - ${invoices.length} records`);};
const exportReportCsv = () => {
  const rd = reportData; const rows = [];
  rows.push('=== KPI Summary ===','Metric,Value');
  rows.push(`Total Invoiced (EUR),${rd.totalInvoicedEur.toFixed(2)}`);
  rows.push(`Total Approved Spend (EUR),${rd.totalApprovedEur.toFixed(2)}`);
  rows.push(`Invoice Count,${rd.invoiceCount}`);
  rows.push(`Approval Count,${rd.approvalCount}`);
  rows.push(`Approval Rate (%),${rd.approvalRate.toFixed(1)}`);
  rows.push(`Avg Processing Days,${rd.avgDays.toFixed(1)}`);
  rows.push('','=== Spend by Category ===','Category,Amount (EUR)');
  rd.spendByCategory.forEach(r => rows.push(`${r.name},${r.value}`));
  rows.push('','=== Spend by Department ===','Department,Amount (EUR)');
  rd.spendByDept.forEach(r => rows.push(`${r.name},${r.value}`));
  rows.push('','=== Invoice Volume by Month ===','Month,Count');
  rd.invoiceVolume.forEach(r => rows.push(`${r.month},${r.count}`));
  rows.push('','=== Approved vs Invoiced by Department ===','Department,Approved (EUR),Invoiced (EUR)');
  rd.approvedVsInvoiced.forEach(r => rows.push(`${r.name},${r.approved},${r.invoiced}`));
  rows.push('','=== Approval Status Breakdown ===','Status,Count');
  rd.statusBreakdown.forEach(r => rows.push(`${r.name},${r.value}`));
  const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url;
  a.download = `report_${new Date().toISOString().split('T')[0]}.csv`; a.click();
  logAuditLocal('REPORT_EXPORTED', 'Report data exported to CSV');
}; if (isAuthenticating && !user) { return ( <div className="min-h-screen bg-gradient-to-br from-blue-600 to-indigo-800 flex items-center justify-center p-6"> <div className="bg-white rounded-2xl shadow-2xl p-12 max-w-md w-full text-center"> <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div> <p className="text-gray-600">Signing in...</p></div></div>);}
if (!user) { return ( <div className="min-h-screen bg-gradient-to-br from-blue-600 to-indigo-800 flex items-center justify-center p-6"> <div className="bg-white rounded-2xl shadow-2xl p-12 max-w-md w-full"> <div className="text-center mb-8"> <FileText className="w-16 h-16 text-indigo-600 mx-auto mb-4"/> <h1 className="text-3xl font-bold text-gray-800 mb-2">Invoice Workflow</h1> <p className="text-gray-600">Sign in to manage invoices and approvals</p></div>
{isDevMode ? (<div><h2 className="text-lg font-semibold text-gray-700 mb-4 text-center">Development Login</h2><div className="mb-6"><label className="block text-sm font-medium text-gray-700 mb-2">Select User</label><select value={selectedDevEmail} onChange={(e) => setSelectedDevEmail(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">{devUsers.map(u => (<option key={u.id} value={u.email}>{u.name} ({u.email}) — {u.role}</option>))}</select></div><button onClick={devLogin} disabled={isAuthenticating || !selectedDevEmail} className="w-full bg-indigo-600 text-white py-4 rounded-lg font-semibold hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed">{isAuthenticating ? (<div className="flex items-center justify-center space-x-2"><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div><span>Signing in...</span></div>) : 'Sign in'}</button><div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700 text-center"><p>Development mode — no Azure AD configured</p></div></div>) : (<div><button onClick={msalLogin} disabled={isAuthenticating} className="w-full bg-blue-700 text-white py-4 rounded-lg font-semibold hover:bg-blue-800 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-3">{isAuthenticating ? (<><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div><span>Signing in...</span></>) : (<><svg className="w-5 h-5" viewBox="0 0 23 23"><path fill="#f3f3f3" d="M0 0h11v11H0z"/><path fill="#f35325" d="M0 0h11v11H0z"/><path fill="#81bc06" d="M12 0h11v11H12z"/><path fill="#05a6f0" d="M0 12h11v11H0z"/><path fill="#ffba08" d="M12 12h11v11H12z"/></svg><span>Sign in with Microsoft</span></>)}</button></div>)}
</div></div>);}
if (currentPage === 'landing') { const h = new Date().getHours();
const g = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
return (<div className={_pg}><div className="w-full"> <div className="bg-white rounded-lg shadow-lg p-6 mb-8"><div className={_fj}> <div className="flex items-center space-x-3"><Home className="w-8 h-8 text-indigo-600"/><div><h1 className="text-2xl font-bold text-gray-800">{g}, {user.name.split(' ')[0]}</h1><p className="text-sm text-gray-500">Dashboard</p></div></div>
<div className="flex items-center space-x-4"><div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 rounded-lg"><User className="w-5 h-5 text-indigo-600"/><div className="text-sm"><p className="font-semibold text-gray-800">{user.name}</p><p className="text-xs text-gray-600">{user.role}</p></div></div> <button onClick={logout} className="flex items-center space-x-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"><LogOut className="w-4 h-4"/><span>Logout</span></button></div> </div></div> <div className={`grid grid-cols-1 ${(() => { let cols = 2; if (canManageBudgets()) cols++; if (hasPermission('reports.view')) cols++; if (hasPermission('settings.view_lookups') || hasPermission('settings.manage_users')) cols++; return cols >= 5 ? 'md:grid-cols-3 lg:grid-cols-5' : cols >= 4 ? 'md:grid-cols-2 lg:grid-cols-4' : cols === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'; })()} gap-6`}>
<button onClick={() => setCurrentPage('invoices')} className="bg-white rounded-xl shadow-lg hover:shadow-xl border-2 border-transparent hover:border-indigo-400 text-left p-8"><div className="flex items-center justify-center w-16 h-16 bg-indigo-100 rounded-2xl mb-6"><FileText className="w-8 h-8 text-indigo-600"/></div><h2 className="text-xl font-bold text-gray-800 mb-2">Invoices</h2><p className="text-gray-500 text-sm mb-6">{hasPermission('invoices.upload') ? 'Upload, extract, and manage invoices.' : 'View invoices you have uploaded.'}</p><div className="flex items-center text-indigo-600 font-semibold text-sm"><span>Open Invoices</span><ArrowRight className="w-4 h-4 ml-2"/></div></button>
<button onClick={() => setCurrentPage('spend-approval')} className="bg-white rounded-xl shadow-lg hover:shadow-xl border-2 border-transparent hover:border-green-400 text-left p-8 relative"><div className="flex items-center justify-center w-16 h-16 bg-green-100 rounded-2xl mb-6"><DollarSign className="w-8 h-8 text-green-600"/></div>{spendAlerts.length > 0 && <span className="absolute top-4 right-4 bg-red-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">{spendAlerts.length}</span>}<h2 className="text-xl font-bold text-gray-800 mb-2">Spend Approvals</h2><p className="text-gray-500 text-sm mb-6">Create, track, and manage spend approval requests.</p><div className="flex items-center text-green-600 font-semibold text-sm"><span>Open Spend Approvals</span><ArrowRight className="w-4 h-4 ml-2"/></div></button>
{canManageBudgets() && <button onClick={() => { setBudgetView('list'); setCurrentPage('budgets'); }} className="bg-white rounded-xl shadow-lg hover:shadow-xl border-2 border-transparent hover:border-teal-400 text-left p-8"><div className="flex items-center justify-center w-16 h-16 bg-teal-100 rounded-2xl mb-6"><Wallet className="w-8 h-8 text-teal-600"/></div><h2 className="text-xl font-bold text-gray-800 mb-2">Budgets</h2><p className="text-gray-500 text-sm mb-6">{hasPermission('budget.manage_all') ? 'Create and manage budgets for all departments.' : 'Create and manage budgets for your functions.'}</p><div className="flex items-center text-teal-600 font-semibold text-sm"><span>Open Budgets</span><ArrowRight className="w-4 h-4 ml-2"/></div></button>}
{hasPermission('reports.view') && <button onClick={() => setCurrentPage('reports')} className="bg-white rounded-xl shadow-lg hover:shadow-xl border-2 border-transparent hover:border-amber-400 text-left p-8"><div className="flex items-center justify-center w-16 h-16 bg-amber-100 rounded-2xl mb-6"><BarChart3 className="w-8 h-8 text-amber-600"/></div><h2 className="text-xl font-bold text-gray-800 mb-2">Reports</h2><p className="text-gray-500 text-sm mb-6">{hasPermission('reports.export') ? 'View dashboards, KPIs, and export report data.' : 'View dashboards and KPI summaries.'}</p><div className="flex items-center text-amber-600 font-semibold text-sm"><span>Open Reports</span><ArrowRight className="w-4 h-4 ml-2"/></div></button>}
{(hasPermission('settings.view_lookups') || hasPermission('settings.manage_users')) && (<button onClick={() => { setSettingsTab(hasPermission('settings.manage_users') ? 'users' : 'atoms'); setCurrentPage('settings'); }} className="bg-white rounded-xl shadow-lg hover:shadow-xl border-2 border-transparent hover:border-purple-400 text-left p-8"><div className="flex items-center justify-center w-16 h-16 bg-purple-100 rounded-2xl mb-6"><Settings className="w-8 h-8 text-purple-600"/></div><h2 className="text-xl font-bold text-gray-800 mb-2">Settings</h2><p className="text-gray-500 text-sm mb-6">{canManagePermissions() ? 'Manage users, roles, lookups, and audit logs.' : 'View lookups and audit logs.'}</p><div className="flex items-center text-purple-600 font-semibold text-sm"><span>Open Settings</span><ArrowRight className="w-4 h-4 ml-2"/></div></button>)}
</div> </div></div>);}
if (currentPage === 'budgets') { if (!canManageBudgets()) { setCurrentPage('landing'); return null; }
const budgetNavBar = (<div className="bg-white rounded-lg shadow-lg p-6 mb-6"><div className={_fj}><div className="flex items-center space-x-3"><Wallet className="w-8 h-8 text-teal-600"/><h1 className="text-2xl font-bold text-gray-800">Budgets</h1></div>
<div className="flex items-center space-x-4"><div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 rounded-lg"><User className="w-5 h-5 text-indigo-600"/><div className="text-sm"><p className="font-semibold text-gray-800">{user.name}</p><p className="text-xs text-gray-600">{user.role}</p></div></div>
<button onClick={() => setCurrentPage('landing')} className="flex items-center space-x-2 px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200"><Home className="w-4 h-4"/><span>Dashboard</span></button>
<button onClick={logout} className="flex items-center space-x-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"><LogOut className="w-4 h-4"/><span>Logout</span></button></div></div></div>);

const createBudget = async () => {
  if (!budgetForm.title || !budgetForm.year || !budgetForm.functionId) { alert('Fill all required fields'); return; }
  try {
    const saved = await api.post('/api/budgets', { title: budgetForm.title, year: parseInt(budgetForm.year), functionId: parseInt(budgetForm.functionId) });
    setBudgets(prev => [saved, ...prev]);
    setBudgetForm({ title: '', year: new Date().getFullYear(), functionId: '' });
    setShowBudgetModal(false);
  } catch (err) { alert('Failed to create budget: ' + (err.message || 'Unknown error')); }
};

const deleteBudget = async (id) => {
  if (!confirm('Delete this draft budget?')) return;
  try { await api.delete(`/api/budgets/${id}`); setBudgets(prev => prev.filter(b => b.id !== id)); if (selectedBudget?.id === id) { setSelectedBudget(null); setBudgetView('list'); } } catch (err) { alert('Failed to delete: ' + err.message); }
};

const submitBudget = async (id) => {
  if (!confirm('Submit this budget? Once submitted it cannot be edited.')) return;
  try {
    const updated = await api.post(`/api/budgets/${id}/submit`);
    setBudgets(prev => prev.map(b => b.id === id ? { ...b, status: 'Submitted', submittedAt: updated.submittedAt } : b));
    if (selectedBudget?.id === id) setSelectedBudget(prev => ({ ...prev, status: 'Submitted', submittedAt: updated.submittedAt }));
  } catch (err) { alert('Failed to submit: ' + err.message); }
};

const openBudgetDetail = async (budget) => {
  try {
    const detail = await api.get(`/api/budgets/${budget.id}`);
    setSpreadLines({});
    setSelectedBudget(detail);
    setBudgetView('detail');
  } catch (err) { alert('Failed to load budget: ' + err.message); }
};

const refreshBudgetReport = () => {
  const bId = reportFilters.budget !== 'all' ? reportFilters.budget : '';
  api.get(`/api/budget-report${bId ? `?budgetId=${bId}` : ''}`).then(d => setBudgetReport(d||[])).catch(() => {});
};

const addBudgetLineItem = async (budgetId, item) => {
  try {
    const created = await api.post(`/api/budgets/${budgetId}/line-items`, item);
    const newItem = Array.isArray(created) ? created[0] : created;
    setSelectedBudget(prev => ({ ...prev, lineItems: [...(prev.lineItems || []), newItem] }));
    setBudgets(prev => prev.map(b => b.id === budgetId ? { ...b, lineItemCount: (b.lineItemCount||0)+1, totalEurAnnual: (b.totalEurAnnual||0) + (parseFloat(newItem.eurAnnual)||0) } : b));
    refreshBudgetReport();
  } catch (err) { alert('Failed to add line item: ' + err.message); }
};

const deleteBudgetLineItem = async (budgetId, lineId) => {
  try {
    await api.delete(`/api/budgets/${budgetId}/line-items/${lineId}`);
    setSelectedBudget(prev => ({ ...prev, lineItems: prev.lineItems.filter(li => li.id !== lineId) }));
    setBudgets(prev => prev.map(b => b.id === budgetId ? { ...b, lineItemCount: Math.max(0, (b.lineItemCount||1)-1) } : b));
    refreshBudgetReport();
  } catch (err) { alert('Failed to delete line item: ' + err.message); }
};

const addBulkBudgetLines = async (budgetId, items) => {
  try {
    const created = await api.post(`/api/budgets/${budgetId}/line-items`, items);
    const newItems = Array.isArray(created) ? created : [created];
    setSelectedBudget(prev => ({ ...prev, lineItems: [...(prev.lineItems || []), ...newItems] }));
    const addedTotal = newItems.reduce((s, li) => s + (parseFloat(li.eurAnnual)||0), 0);
    setBudgets(prev => prev.map(b => b.id === budgetId ? { ...b, lineItemCount: (b.lineItemCount||0)+newItems.length, totalEurAnnual: (b.totalEurAnnual||0)+addedTotal } : b));
    refreshBudgetReport();
    return newItems.length;
  } catch (err) { alert('Failed to import lines: ' + err.message); return 0; }
};

// --- Budget Bulk Import (XLSX with field mapping) ---
const handleBudgetBulkFile = (e) => {
  const file = e.target.files?.[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = (evt) => {
    try {
      const data = new Uint8Array(evt.target.result);
      const wb = XLSX.read(data, { type: 'array' });
      if (wb.SheetNames.length > 1) {
        setBudgetBulk({ rows: [], fileName: file.name, mappings: null, step: 'sheet', workbook: wb, sheetNames: wb.SheetNames });
      } else {
        selectBudgetBulkSheet(wb, wb.SheetNames[0], file.name);
      }
    } catch (err) { alert('Failed to parse file: ' + err.message); }
  };
  reader.readAsArrayBuffer(file);
  if (budgetBulkFileRef.current) budgetBulkFileRef.current.value = '';
};
const selectBudgetBulkSheet = (wb, sheetName, fileName) => {
  const sheet = wb.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  if (json.length === 0) { alert('No data found in sheet "' + sheetName + '"'); return; }
  const headers = Object.keys(json[0]);
  const targetFields = ['licence','vendor','type','businessUnit','serviceCategory','costCentre','region','currency','eurAnnual','contractValue','contractEndDate','comments','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const fieldLabels = { licence:'Licence / Service', vendor:'Vendor', type:'Type', businessUnit:'Business Unit', serviceCategory:'Service Category', costCentre:'Cost Centre', region:'Region', currency:'Currency', eurAnnual:'EUR Annual', contractValue:'Contract Value', contractEndDate:'Contract End Date', comments:'Comments', Jan:'Jan',Feb:'Feb',Mar:'Mar',Apr:'Apr',May:'May',Jun:'Jun',Jul:'Jul',Aug:'Aug',Sep:'Sep',Oct:'Oct',Nov:'Nov',Dec:'Dec' };
  const aliases = {
    licence: ['licence','license','service','service_name','licence_name','license_name','name'],
    vendor: ['vendor','supplier','vendor_name','supplier_name','company'],
    type: ['type','line_type','category'],
    businessUnit: ['business_unit','business unit','businessunit','bu','unit'],
    serviceCategory: ['service_category','service category','servicecategory','category'],
    costCentre: ['cost_centre','cost centre','costcentre','cc','cost_center','cost center'],
    region: ['region','location','country'],
    currency: ['currency','curr','ccy'],
    eurAnnual: ['eur_annual','eur annual','eurannual','annual_eur','annual eur','annual','eur'],
    contractValue: ['contract_value','contract value','contractvalue','value'],
    contractEndDate: ['contract_end_date','contract end date','contractenddate','end_date','end date','expiry','expiry_date'],
    comments: ['comments','comment','notes','remarks'],
    Jan:['jan','january'],Feb:['feb','february'],Mar:['mar','march'],Apr:['apr','april'],
    May:['may'],Jun:['jun','june'],Jul:['jul','july'],Aug:['aug','august'],
    Sep:['sep','sept','september'],Oct:['oct','october'],Nov:['nov','november'],Dec:['dec','december']
  };
  const autoMap = {};
  targetFields.forEach(f => {
    const aliasList = aliases[f] || [f.toLowerCase()];
    const match = headers.find(h => aliasList.includes(h.toLowerCase().trim()));
    if (match) autoMap[f] = match;
  });
  setBudgetBulk(prev => ({ ...prev, rows: json, fileName: fileName || prev.fileName, mappings: autoMap, step: 'map', headers, targetFields, fieldLabels, selectedSheet: sheetName }));
};
const setBudgetBulkMapping = (field, header) => {
  setBudgetBulk(prev => ({ ...prev, mappings: { ...prev.mappings, [field]: header || undefined } }));
};
const budgetBulkPreview = () => {
  if (!budgetBulk.mappings?.licence && !budgetBulk.mappings?.vendor) { alert('Please map at least Licence/Service or Vendor'); return; }
  setBudgetBulk(prev => ({ ...prev, step: 'preview' }));
};
const getBudgetMappedRows = () => {
  const m = budgetBulk.mappings || {};
  const monthKeys = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return budgetBulk.rows.map(row => {
    const mapped = {};
    Object.entries(m).forEach(([field, header]) => { if (header) mapped[field] = String(row[header] ?? '').trim(); });
    // Build monthlyBudget object
    const hasMonths = monthKeys.some(mk => mapped[mk]);
    const mb = {};
    if (hasMonths) {
      monthKeys.forEach(mk => { mb[mk] = parseFloat(String(mapped[mk]).replace(/[^0-9.\-]/g,'')) || 0; });
    } else {
      const eurVal = parseFloat(String(mapped.eurAnnual || '0').replace(/[^0-9.\-]/g,'')) || 0;
      const monthly = eurVal / 12;
      monthKeys.forEach(mk => { mb[mk] = monthly; });
    }
    const eurAnnual = hasMonths ? monthKeys.reduce((s, mk) => s + mb[mk], 0) : (parseFloat(String(mapped.eurAnnual || '0').replace(/[^0-9.\-]/g,'')) || 0);
    return {
      licence: mapped.licence || '',
      vendor: mapped.vendor || '',
      type: mapped.type || 'BAU',
      businessUnit: mapped.businessUnit || '',
      serviceCategory: mapped.serviceCategory || '',
      costCentre: mapped.costCentre || '',
      region: mapped.region || '',
      currency: mapped.currency || 'EUR',
      eurAnnual: eurAnnual || null,
      contractValue: mapped.contractValue ? parseFloat(String(mapped.contractValue).replace(/[^0-9.\-]/g,'')) || null : null,
      contractEndDate: mapped.contractEndDate || '',
      comments: mapped.comments || '',
      monthlyBudget: mb,
    };
  }).filter(r => r.licence || r.vendor);
};
const confirmBudgetBulkImport = async () => {
  const rows = getBudgetMappedRows();
  if (rows.length === 0) { alert('No valid rows to import'); return; }
  setIsProcessing(true);
  try {
    const count = await addBulkBudgetLines(selectedBudget.id, rows);
    const totalEur = rows.reduce((s, r) => s + (r.eurAnnual || 0), 0);
    const vendors = [...new Set(rows.map(r => r.vendor).filter(Boolean))];
    setBudgetBulk({ rows: [], fileName: '', mappings: null, step: 'success', summary: { count, totalEur, vendors, fileName: budgetBulk.fileName } });
  } catch (err) { alert('Budget import failed: ' + err.message); }
  setIsProcessing(false);
};

const handleAiImport = async (file) => {
  setAiImport({ open: true, loading: true, error: null, result: null, fileName: file.name });
  try {
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const res = await api.post('/api/budgets/ai-map', { file: base64, fileName: file.name });
    if (res.success) {
      setAiImport(prev => ({ ...prev, loading: false, result: res }));
    } else {
      setAiImport(prev => ({ ...prev, loading: false, error: res.error || 'Unknown error' }));
    }
  } catch (err) {
    setAiImport(prev => ({ ...prev, loading: false, error: err.message || 'Failed to process file' }));
  }
};

const confirmAiImport = async (budgetId, rows) => {
  const count = await addBulkBudgetLines(budgetId, rows);
  if (count > 0) setAiImport({ open: false, loading: false, error: null, result: null, fileName: '' });
};


// Budget detail view
if (budgetView === 'detail' && selectedBudget) { const sb = selectedBudget; const isDraft = sb.status === 'Draft';
const totalEur = (sb.lineItems || []).reduce((sum, li) => sum + (parseFloat(li.eurAnnual) || 0), 0);
const lineItemFormDefault = { type: 'BAU', businessUnit: '', serviceCategory: '', licence: '', costCentre: '', region: '', vendor: '', contractEndDate: '', contractValue: '', currency: '', eurAnnual: '', comments: '', monthlyBudget: null };
return (<div className={_pg}><div className="w-full">{budgetNavBar}
<div className="bg-white rounded-xl shadow-lg p-6 mb-6">
<div className={_fj+" mb-4"}>
<div><h2 className="text-xl font-bold text-gray-800">{sb.title}</h2>
<p className="text-sm text-gray-500">{sb.function?.name} — {sb.year} — Created by {sb.createdBy?.name} on {new Date(sb.createdAt).toLocaleDateString()}</p></div>
<div className="flex items-center space-x-3">
<span className={`px-3 py-1.5 rounded-full text-sm font-semibold ${sb.status === 'Draft' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>{sb.status === 'Draft' ? 'Draft' : `Submitted ${sb.submittedAt ? new Date(sb.submittedAt).toLocaleDateString() : ''}`}</span>
<button onClick={() => { setBudgetView('list'); setSelectedBudget(null); }} className="text-sm text-indigo-600 hover:text-indigo-800 font-semibold">← Back</button>
</div></div>
<div className="grid grid-cols-3 gap-4 mb-4">
<div className="bg-teal-50 rounded-lg p-4 border border-teal-200"><p className="text-xs font-medium text-teal-600 uppercase">Total Annual (EUR)</p><p className="text-2xl font-bold text-teal-800">€{totalEur.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</p></div>
<div className="bg-blue-50 rounded-lg p-4 border border-blue-200"><p className="text-xs font-medium text-blue-600 uppercase">Line Items</p><p className="text-2xl font-bold text-blue-800">{(sb.lineItems||[]).length}</p></div>
<div className="bg-purple-50 rounded-lg p-4 border border-purple-200"><p className="text-xs font-medium text-purple-600 uppercase">Monthly Avg</p><p className="text-2xl font-bold text-purple-800">€{(totalEur/12).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</p></div>
</div>
{isDraft && (<div className="flex items-center space-x-3 mb-4">
<button onClick={() => (sb.lineItems||[]).length > 0 ? submitBudget(sb.id) : alert('Add at least one line item before submitting')} className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold"><Send className="w-4 h-4"/><span>Submit Budget</span></button>
<button onClick={() => addBudgetLineItem(sb.id, { licence: '', type: 'BAU', currency: 'EUR', eurAnnual: 0, monthlyBudget: { Jan:0,Feb:0,Mar:0,Apr:0,May:0,Jun:0,Jul:0,Aug:0,Sep:0,Oct:0,Nov:0,Dec:0 } })} className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-semibold"><Plus className="w-4 h-4"/><span>Add Line Item</span></button>
<input ref={budgetBulkFileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleBudgetBulkFile} className="hidden" id="budget-bulk-upload"/>
<label htmlFor="budget-bulk-upload" className="flex items-center space-x-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-semibold cursor-pointer text-sm"><Upload className="w-4 h-4"/><span>Import XLSX</span></label>
<label className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-semibold cursor-pointer"><Sparkles className="w-4 h-4"/><span>AI Import</span>
<input type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; e.target.value = ''; handleAiImport(file); }}/></label>
</div>)}
</div>
{/* Budget Bulk Import - Sheet */}
{budgetBulk.step === 'sheet' && (<div className="bg-amber-50 border border-amber-200 rounded-lg p-6 mb-6">
<div className={_fj+" mb-4"}><h3 className="text-xl font-semibold text-gray-800">Select Sheet — {budgetBulk.fileName}</h3>
<button onClick={() => setBudgetBulk({ rows: [], fileName: '', mappings: null, step: null })} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm font-medium">Cancel</button>
</div>
<p className="text-sm text-gray-600 mb-4">This workbook has multiple sheets. Select which sheet to import from.</p>
<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
{budgetBulk.sheetNames.map(name => (<button key={name} onClick={() => selectBudgetBulkSheet(budgetBulk.workbook, name, budgetBulk.fileName)} className="px-4 py-3 bg-white border-2 border-amber-200 rounded-lg hover:border-amber-500 hover:bg-amber-50 text-sm font-medium text-gray-800 transition text-left"><FileSpreadsheet className="w-4 h-4 text-amber-600 inline mr-2"/>{name}</button>))}
</div>
</div>)}
{/* Budget Bulk Import - Map */}
{budgetBulk.step === 'map' && (<div className="bg-amber-50 border border-amber-200 rounded-lg p-6 mb-6">
<div className={_fj+" mb-4"}><h3 className="text-xl font-semibold text-gray-800">Map Columns — {budgetBulk.fileName}{budgetBulk.selectedSheet ? ` — ${budgetBulk.selectedSheet}` : ''}</h3>
<div className="flex space-x-3">
{budgetBulk.sheetNames?.length > 1 && <button onClick={() => setBudgetBulk(prev => ({ ...prev, step: 'sheet' }))} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm font-medium">Back to Sheets</button>}
<button onClick={() => setBudgetBulk({ rows: [], fileName: '', mappings: null, step: null })} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm font-medium">Cancel</button>
<button onClick={budgetBulkPreview} className="px-5 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm font-semibold">Preview Import</button>
</div></div>
<p className="text-sm text-gray-600 mb-4">Map your spreadsheet columns to budget line item fields. We auto-detected what we could.</p>
<div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
{budgetBulk.targetFields.map(f => (<div key={f}>
<label className="block text-xs font-semibold text-gray-600 mb-1">{budgetBulk.fieldLabels[f]}</label>
<select value={budgetBulk.mappings?.[f] || ''} onChange={e => setBudgetBulkMapping(f, e.target.value)} className={`w-full text-sm ${_i}`}>
<option value="">— skip —</option>
{budgetBulk.headers.map(h => (<option key={h} value={h}>{h}</option>))}
</select>
</div>))}
</div>
<p className="text-xs text-gray-500 mt-3">{budgetBulk.rows.length} row(s) found in spreadsheet</p>
</div>)}
{/* Budget Bulk Import - Preview */}
{budgetBulk.step === 'preview' && (() => { const previewRows = getBudgetMappedRows();
const displayFields = ['licence','vendor','type','businessUnit','eurAnnual','currency','costCentre','region'];
const displayLabels = { licence:'Licence/Service', vendor:'Vendor', type:'Type', businessUnit:'Business Unit', eurAnnual:'EUR Annual', currency:'Currency', costCentre:'Cost Centre', region:'Region' };
return (<div className="bg-amber-50 border border-amber-200 rounded-lg p-6 mb-6">
<div className={_fj+" mb-4"}><h3 className="text-xl font-semibold text-gray-800">Preview Import — {previewRows.length} line item(s)</h3>
<div className="flex space-x-3">
<button onClick={() => setBudgetBulk(prev => ({ ...prev, step: 'map' }))} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm font-medium">Back</button>
<button onClick={() => setBudgetBulk({ rows: [], fileName: '', mappings: null, step: null })} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm font-medium">Cancel</button>
<button onClick={confirmBudgetBulkImport} disabled={isProcessing || previewRows.length === 0} className="px-5 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm font-semibold disabled:opacity-50 flex items-center space-x-2">
<CheckCircle className="w-4 h-4"/><span>{isProcessing ? 'Importing...' : `Import ${previewRows.length} Line Item${previewRows.length !== 1 ? 's' : ''}`}</span></button>
</div></div>
<div className="overflow-x-auto max-h-80 overflow-y-auto"><table className="w-full text-sm">
<thead className="bg-amber-100 sticky top-0"><tr>
{displayFields.map(f => (<th key={f} className="px-3 py-2 text-left text-xs font-semibold text-amber-800">{displayLabels[f]}</th>))}
</tr></thead>
<tbody className="divide-y divide-amber-100">{previewRows.slice(0, 50).map((row, i) => (
<tr key={i} className="hover:bg-amber-50">
{displayFields.map(f => (
<td key={f} className="px-3 py-1.5 max-w-[160px] truncate text-gray-700">{f === 'eurAnnual' ? (row[f] != null ? `€${Number(row[f]).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}` : '—') : (row[f] || '—')}</td>
))}</tr>))}</tbody></table></div>
{previewRows.length > 50 && <p className="text-xs text-gray-500 mt-2 text-center">Showing first 50 of {previewRows.length} rows</p>}
</div>); })()}
{/* Budget Bulk Import - Success */}
{budgetBulk.step === 'success' && (<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
<div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
<div className="text-center">
<div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-amber-100 mb-4"><CheckCircle className="h-10 w-10 text-amber-600"/></div>
<h3 className="text-xl font-bold text-gray-900 mb-2">Import Complete</h3>
<p className="text-gray-600 mb-5">Budget line items have been successfully imported.</p>
</div>
<div className="bg-gray-50 rounded-lg p-4 space-y-3 mb-5">
<div className="flex justify-between text-sm"><span className="text-gray-500">Source File</span><span className="font-medium text-gray-800">{budgetBulk.summary?.fileName}</span></div>
<div className="flex justify-between text-sm"><span className="text-gray-500">Line Items Imported</span><span className="font-bold text-amber-700">{budgetBulk.summary?.count}</span></div>
<div className="flex justify-between text-sm"><span className="text-gray-500">Total EUR Annual</span><span className="font-bold text-amber-700">€{(budgetBulk.summary?.totalEur || 0).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span></div>
<div className="flex justify-between text-sm"><span className="text-gray-500">Unique Vendors</span><span className="font-medium text-gray-800">{budgetBulk.summary?.vendors?.length || 0}</span></div>
{budgetBulk.summary?.vendors?.length > 0 && budgetBulk.summary.vendors.length <= 5 && (
<div className="text-sm"><span className="text-gray-500">Vendors: </span><span className="text-gray-700">{budgetBulk.summary.vendors.join(', ')}</span></div>
)}
</div>
<button onClick={() => setBudgetBulk({ rows: [], fileName: '', mappings: null, step: null })} className="w-full px-4 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-semibold">OK</button>
</div></div>)}
{/* Line Items Table */}
{(() => { const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fmtM = v => typeof v === 'number' ? v.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}) : '0.00';
const monthTotals = {}; MONTHS.forEach(m => { monthTotals[m] = (sb.lineItems||[]).reduce((sum, li) => sum + (parseFloat(li.monthlyBudget?.[m]) || 0), 0); });
const _ic = "w-full text-sm px-1.5 py-1 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 bg-white";
const updateLineField = async (li, field, val) => {
  try {
    const patch = { [field]: val };
    // If updating monthly, recalc annual
    if (field === 'monthlyBudget') {
      patch.eurAnnual = MONTHS.reduce((s, m) => s + (parseFloat(val[m]) || 0), 0);
    }
    await api.patch(`/api/budgets/${sb.id}/line-items/${li.id}`, patch);
    setSelectedBudget(prev => ({ ...prev, lineItems: prev.lineItems.map(l => l.id === li.id ? { ...l, ...patch } : l) }));
    if (field === 'monthlyBudget' || field === 'eurAnnual' || field === 'spendApprovalId') refreshBudgetReport();
  } catch (err) { alert('Failed to update: ' + err.message); }
};
const budgetCommentModal = commentModal && (
<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setCommentModal(null)}>
<div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
<h3 className="text-lg font-bold text-gray-900 mb-3">{commentModal.comments ? 'Edit' : 'Add'} Comment</h3>
<textarea value={commentText} onChange={e => setCommentText(e.target.value)} rows={4} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none" placeholder="Enter comment..." autoFocus/>
<div className="flex space-x-3 mt-4">
<button onClick={() => setCommentModal(null)} className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm font-medium">Cancel</button>
<button onClick={() => { updateLineField(commentModal, 'comments', commentText.trim() || null); setCommentModal(null); }} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium">Save</button>
</div></div></div>);
const updateLineMonth = (li, month, val) => {
  const mb = { ...(li.monthlyBudget || {}), [month]: parseFloat(val) || 0 };
  updateLineField(li, 'monthlyBudget', mb);
};
const blurText = (li, field, e) => { const v = e.target.value.trim(); if (v !== (li[field]||'')) updateLineField(li, field, v || null); };
const blurNum = (li, field, e) => { const v = e.target.value; const n = parseFloat(v) || null; if (n !== (parseFloat(li[field])||null)) updateLineField(li, field, n); };
// Detect spread: all months equal means spread is active
const isSpreadLine = (li) => {
  const mb = li.monthlyBudget || {};
  const vals = MONTHS.map(m => parseFloat(mb[m]) || 0);
  return vals[0] > 0 && vals.every(v => v === vals[0]);
};
// Initialize spread state from data on first render of this budget
if (sb.lineItems && Object.keys(spreadLines).length === 0) {
  const initial = {};
  sb.lineItems.forEach(li => { if (isSpreadLine(li)) initial[li.id] = true; });
  if (Object.keys(initial).length > 0) { setTimeout(() => setSpreadLines(initial), 0); }
}
const doSpread = async (liOrId, cv, cur) => {
  const lid = typeof liOrId === 'object' ? liOrId.id : liOrId;
  const val = parseFloat(cv) || 0;
  if (val === 0) return;
  const rate = eurRates[cur] || 1;
  const eurTotal = val * rate;
  const monthly = Math.round((eurTotal / 12) * 100) / 100;
  const mb = {}; MONTHS.forEach(m => { mb[m] = monthly; });
  const eurAnnual = monthly * 12;
  try {
    await api.patch(`/api/budgets/${sb.id}/line-items/${lid}`, { monthlyBudget: mb, eurAnnual });
    setSelectedBudget(prev => ({ ...prev, lineItems: prev.lineItems.map(l => l.id === lid ? { ...l, monthlyBudget: mb, eurAnnual } : l) }));
    refreshBudgetReport();
  } catch (err) { alert('Failed to spread: ' + err.message); }
};
const toggleSpread = (li) => {
  const isOn = !spreadLines[li.id];
  setSpreadLines(prev => ({ ...prev, [li.id]: isOn }));
  if (isOn) doSpread(li, li.contractValue, li.currency);
};
const handleContractValueBlur = (li, e) => {
  const v = e.target.value; const n = parseFloat(v) || null;
  if (n === (parseFloat(li.contractValue)||null)) return;
  // Update contractValue in state first, then spread if needed
  const updatedLi = { ...li, contractValue: n };
  updateLineField(li, 'contractValue', n);
  if (spreadLines[li.id] && n) doSpread(updatedLi, n, li.currency);
};
const handleCurrencyChange = (li, newCur) => {
  updateLineField(li, 'currency', newCur);
  if (spreadLines[li.id]) doSpread(li, li.contractValue, newCur);
};
const colCount = 9 + 12 + 3 + (isDraft ? 2 : 0);
// --- Search, filter, group ---
const allItems = sb.lineItems || [];
const searchLower = bliSearch.toLowerCase();
const filtered = allItems.filter(li => {
  if (searchLower && ![li.licence, li.vendor, li.businessUnit, li.serviceCategory, li.comments, li.region, li.costCentre].some(v => v && v.toLowerCase().includes(searchLower))) return false;
  if (bliFilters.type && li.type !== bliFilters.type) return false;
  if (bliFilters.businessUnit && (li.businessUnit || '') !== bliFilters.businessUnit) return false;
  if (bliFilters.region && (li.region || '') !== bliFilters.region) return false;
  if (bliFilters.currency && (li.currency || '') !== bliFilters.currency) return false;
  if (bliFilters.vendor && (li.vendor || '') !== bliFilters.vendor) return false;
  return true;
});
const uniqueVals = (field) => [...new Set(allItems.map(li => li[field] || '').filter(Boolean))].sort();
const grouped = bliGroupBy ? filtered.reduce((acc, li) => { const key = li[bliGroupBy] || 'Unassigned'; (acc[key] = acc[key] || []).push(li); return acc; }, {}) : { '': filtered };
const groupKeys = Object.keys(grouped).sort((a, b) => a === 'Unassigned' ? 1 : b === 'Unassigned' ? -1 : a.localeCompare(b));
const filteredMonthTotals = {}; MONTHS.forEach(m => { filteredMonthTotals[m] = filtered.reduce((sum, li) => sum + (parseFloat(li.monthlyBudget?.[m]) || 0), 0); });
const filteredTotalEur = filtered.reduce((sum, li) => sum + (parseFloat(li.eurAnnual) || 0), 0);
const hasActiveFilters = bliSearch || bliFilters.type || bliFilters.businessUnit || bliFilters.region || bliFilters.currency || bliFilters.vendor || bliGroupBy;
return (<div className="bg-white rounded-xl shadow-lg overflow-hidden" style={{maxWidth:'calc(100vw - 2rem)'}}>
{/* Search / Filter / Group toolbar */}
<div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
<div className="flex flex-wrap items-center gap-2">
<div className="relative flex-1 min-w-[200px] max-w-[320px]"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/><input type="text" value={bliSearch} onChange={e => setBliSearch(e.target.value)} placeholder="Search line items..." className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white"/></div>
<select value={bliFilters.type} onChange={e => setBliFilters(p => ({...p, type: e.target.value}))} className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 bg-white focus:ring-2 focus:ring-teal-500"><option value="">All Types</option><option value="BAU">BAU</option><option value="New">New</option><option value="XDT">XDT</option></select>
{uniqueVals('businessUnit').length > 1 && <select value={bliFilters.businessUnit} onChange={e => setBliFilters(p => ({...p, businessUnit: e.target.value}))} className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 bg-white focus:ring-2 focus:ring-teal-500"><option value="">All Business Units</option>{uniqueVals('businessUnit').map(v => <option key={v} value={v}>{v}</option>)}</select>}
{uniqueVals('region').length > 1 && <select value={bliFilters.region} onChange={e => setBliFilters(p => ({...p, region: e.target.value}))} className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 bg-white focus:ring-2 focus:ring-teal-500"><option value="">All Regions</option>{uniqueVals('region').map(v => <option key={v} value={v}>{v}</option>)}</select>}
{uniqueVals('currency').length > 1 && <select value={bliFilters.currency} onChange={e => setBliFilters(p => ({...p, currency: e.target.value}))} className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 bg-white focus:ring-2 focus:ring-teal-500"><option value="">All Currencies</option>{uniqueVals('currency').map(v => <option key={v} value={v}>{v}</option>)}</select>}
{uniqueVals('vendor').length > 1 && <select value={bliFilters.vendor} onChange={e => setBliFilters(p => ({...p, vendor: e.target.value}))} className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 bg-white focus:ring-2 focus:ring-teal-500 max-w-[180px]"><option value="">All Vendors</option>{uniqueVals('vendor').map(v => <option key={v} value={v}>{v.length > 30 ? v.substring(0,30)+'...' : v}</option>)}</select>}
<div className="flex items-center gap-1 ml-auto"><span className="text-xs text-gray-500">Group:</span><select value={bliGroupBy} onChange={e => setBliGroupBy(e.target.value)} className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 bg-white focus:ring-2 focus:ring-teal-500"><option value="">None</option><option value="type">Type</option><option value="businessUnit">Business Unit</option><option value="serviceCategory">Service Category</option><option value="region">Region</option><option value="currency">Currency</option><option value="vendor">Vendor</option></select></div>
{hasActiveFilters && <button onClick={() => { setBliSearch(''); setBliFilters({ type: '', businessUnit: '', region: '', currency: '', vendor: '' }); setBliGroupBy(''); }} className="text-xs text-red-600 hover:text-red-800 font-medium px-2 py-1.5 border border-red-200 rounded-lg hover:bg-red-50">Clear All</button>}
</div>
{hasActiveFilters && <p className="text-xs text-gray-500 mt-1.5">Showing {filtered.length} of {allItems.length} line items{bliGroupBy ? ` · Grouped by ${bliGroupBy === 'businessUnit' ? 'Business Unit' : bliGroupBy === 'serviceCategory' ? 'Service Category' : bliGroupBy.charAt(0).toUpperCase() + bliGroupBy.slice(1)}` : ''}</p>}
</div>
<div className="overflow-x-auto overflow-y-auto max-h-[70vh]"><table className="w-full text-left text-sm">
<thead className="sticky top-0 z-10"><tr className="border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase bg-gray-50">
<th className="px-2 py-3 min-w-[80px]">Type</th><th className="px-2 py-3 min-w-[140px]">Business Unit</th><th className="px-2 py-3 min-w-[200px]">Service Category</th><th className="px-2 py-3 min-w-[140px]">Vendor</th><th className="px-2 py-3 min-w-[80px]">Region</th><th className="px-2 py-3 min-w-[100px]">Cost Centre</th><th className="px-2 py-3 min-w-[80px]">Currency</th>
<th className="px-2 py-3 text-right min-w-[110px]">Contract Value</th>{isDraft && <th className="px-1 py-3 text-center min-w-[55px]">Spread</th>}<th className="px-2 py-3 min-w-[100px]">Contract End</th>
{MONTHS.map(m => <th key={m} className="px-1 py-3 text-right min-w-[85px]">{m}</th>)}
<th className="px-2 py-3 text-right font-bold min-w-[110px]">EUR Annual</th><th className="px-1 py-3 text-center min-w-[36px]" title="Comments"><MessageSquare className="w-3.5 h-3.5 inline text-gray-400"/></th><th className="px-2 py-3 min-w-[100px]">Linked SA</th>{isDraft && <th className="px-2 py-3 text-center min-w-[60px]"></th>}
</tr></thead><tbody>
{groupKeys.map(gk => { const groupItems = grouped[gk]; const groupEur = groupItems.reduce((s, li) => s + (parseFloat(li.eurAnnual)||0), 0); return (<React.Fragment key={gk}>
{bliGroupBy && <tr className="bg-indigo-50 border-b border-indigo-100"><td colSpan={colCount} className="px-3 py-2"><span className="text-xs font-bold text-indigo-800 uppercase">{gk}</span><span className="text-xs text-indigo-600 ml-2">({groupItems.length} items · €{groupEur.toLocaleString(undefined,{minimumFractionDigits:2})})</span></td></tr>}
{groupItems.map(li => {
  const mb = li.monthlyBudget || {};
  const eurA = parseFloat(li.eurAnnual) || 0;
  return (<tr key={li.id} className="border-b border-gray-100 hover:bg-gray-50 align-top">
  <td className="px-1 py-1">{isDraft ? <select defaultValue={li.type} onChange={e => updateLineField(li, 'type', e.target.value)} className={_ic}><option value="BAU">BAU</option><option value="New">New</option><option value="XDT">XDT</option></select> : <span className={`px-2 py-0.5 rounded text-xs font-semibold ${li.type === 'BAU' ? 'bg-blue-100 text-blue-700' : li.type === 'New' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>{li.type}</span>}</td>
  <td className="px-1 py-1">{isDraft ? <select defaultValue={li.businessUnit||''} onChange={e => updateLineField(li, 'businessUnit', e.target.value || null)} className={_ic}><option value="">Select...</option>{businessUnits.filter(bu=>bu.active).map(bu=>(<option key={bu.id} value={bu.name}>{bu.name}</option>))}{li.businessUnit && !businessUnits.find(bu=>bu.name===li.businessUnit) && <option value={li.businessUnit}>{li.businessUnit}</option>}</select> : <span className="text-gray-600">{li.businessUnit || '—'}</span>}</td>
  <td className="px-1 py-1">{isDraft ? <select defaultValue={li.licence} onChange={e => updateLineField(li, 'licence', e.target.value)} className={`${_ic} font-medium`}><option value="">Select...</option>{categories.filter(c=>c.active).map(c=>(<option key={c.id} value={c.name}>{c.name}</option>))}{li.licence && !categories.find(c=>c.name===li.licence) && <option value={li.licence}>{li.licence}</option>}</select> : <span className="font-medium text-gray-800">{li.licence}</span>}</td>
  <td className="px-1 py-1">{isDraft ? <input type="text" defaultValue={li.vendor||''} onBlur={e => blurText(li, 'vendor', e)} className={_ic} placeholder="Vendor"/> : <span className="text-gray-600">{li.vendor || '—'}</span>}</td>
  <td className="px-1 py-1">{isDraft ? <select defaultValue={li.region||''} onChange={e => updateLineField(li, 'region', e.target.value || null)} className={_ic}><option value="">Select...</option>{regions.filter(r=>r.active).map(r=>(<option key={r.id} value={r.code}>{r.code}</option>))}{li.region && !regions.find(r=>r.code===li.region) && <option value={li.region}>{li.region}</option>}</select> : <span className="text-gray-600">{li.region || '—'}</span>}</td>
  <td className="px-1 py-1">{isDraft ? <select defaultValue={li.costCentre||''} onChange={e => updateLineField(li, 'costCentre', e.target.value || null)} className={_ic}><option value="">Select...</option>{costCentres.filter(c=>c.active).map(c=>(<option key={c.id} value={c.code}>{c.code}</option>))}{li.costCentre && !costCentres.find(c=>c.code===li.costCentre) && <option value={li.costCentre}>{li.costCentre}</option>}</select> : <span className="text-gray-600">{li.costCentre || '—'}</span>}</td>
  <td className="px-1 py-1">{isDraft ? <select defaultValue={li.currency||'EUR'} onChange={e => handleCurrencyChange(li, e.target.value)} className={_ic}><option value="EUR">EUR</option><option value="GBP">GBP</option><option value="USD">USD</option></select> : <span className="text-gray-600">{li.currency || '—'}</span>}</td>
  <td className="px-1 py-1">{isDraft ? <input key={`cv-${li.id}-${li.contractValue}`} type="number" step="0.01" defaultValue={li.contractValue||''} onBlur={e => handleContractValueBlur(li, e)} className={`${_ic} text-right`} placeholder="0.00"/> : <span className="text-right block">{li.contractValue ? `${parseFloat(li.contractValue).toLocaleString(undefined,{minimumFractionDigits:2})}` : '—'}</span>}</td>
  {isDraft && <td className="px-1 py-1 text-center"><input type="checkbox" checked={!!spreadLines[li.id]} onChange={() => toggleSpread(li)} className="w-4 h-4 text-teal-600 rounded border-gray-300 focus:ring-teal-500 cursor-pointer" title="Spread contract value evenly across months (converted to EUR)"/></td>}
  <td className="px-1 py-1">{isDraft ? <input type="text" defaultValue={li.contractEndDate||''} onBlur={e => blurText(li, 'contractEndDate', e)} className={_ic} placeholder="dd/mm/yyyy"/> : <span className="text-gray-600">{li.contractEndDate || '—'}</span>}</td>
  {MONTHS.map(m => (<td key={m} className="px-1 py-1 text-right">
    {isDraft ? <input key={`${li.id}-${m}-${mb[m]}`} type="number" step="0.01" defaultValue={parseFloat(mb[m]) || ''} onBlur={e => { const v = e.target.value; if (v !== '' && parseFloat(v) !== (parseFloat(mb[m])||0)) updateLineMonth(li, m, v); }} className={`${_ic} text-right`} placeholder="0.00"/>
    : <span className="text-sm text-gray-700">{fmtM(parseFloat(mb[m])||0)}</span>}
  </td>))}
  <td className="px-2 py-2 text-right font-bold text-teal-700">€{eurA.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
  <td className="px-1 py-2 text-center relative group">{isDraft ? <button onClick={() => { setCommentText(li.comments || ''); setCommentModal(li); }} className={`${li.comments ? 'text-indigo-600' : 'text-gray-300 hover:text-gray-500'}`} title={li.comments || 'Add comment'}><MessageSquare className="w-4 h-4"/></button> : li.comments ? <span className="text-indigo-600 cursor-help"><MessageSquare className="w-4 h-4 inline"/></span> : <span className="text-gray-300"><MessageSquare className="w-4 h-4 inline"/></span>}{li.comments && <div className="hidden group-hover:block absolute z-20 bottom-full left-1/2 -translate-x-1/2 mb-1 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg max-w-[250px] whitespace-pre-wrap">{li.comments}<div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div></div>}</td>
  <td className="px-2 py-2">{li.spendApproval ? <span className="text-xs text-indigo-600 font-semibold">{li.spendApproval.ref}</span> : <span className="text-xs text-gray-400">—</span>}</td>
  {isDraft && <td className="px-2 py-2 text-center"><button onClick={() => deleteBudgetLineItem(sb.id, li.id)} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4"/></button></td>}
  </tr>);
})}
</React.Fragment>); })}
{allItems.length === 0 && <tr><td colSpan={colCount} className="px-4 py-8 text-center text-gray-400">No line items yet. {isDraft ? 'Add line items or import from CSV.' : ''}</td></tr>}
{allItems.length > 0 && filtered.length === 0 && <tr><td colSpan={colCount} className="px-4 py-6 text-center text-gray-400">No line items match your filters.</td></tr>}
</tbody>
{filtered.length > 0 && (<tfoot className="sticky bottom-0 z-10"><tr className="border-t-2 border-gray-300 font-bold bg-gray-50">
<td className="px-2 py-3" colSpan={isDraft ? 10 : 9}>Totals{hasActiveFilters ? ` (${filtered.length} of ${allItems.length})` : ''}</td>
{MONTHS.map(m => <td key={m} className="px-1 py-3 text-right text-teal-700">€{fmtM(filteredMonthTotals[m])}</td>)}
<td className="px-2 py-3 text-right text-teal-800">€{filteredTotalEur.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
<td></td><td>{/* linked SA */}</td>{isDraft && <td></td>}</tr></tfoot>)}
</table></div>{budgetCommentModal}</div>); })()}
{aiImport.open && (
<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => !aiImport.loading && setAiImport({ open: false, loading: false, error: null, result: null, fileName: '' })}>
<div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
<div className="flex items-center justify-between p-5 border-b border-gray-200">
<div className="flex items-center space-x-3"><Sparkles className="w-6 h-6 text-purple-600"/><div><h3 className="text-lg font-bold text-gray-900">AI Import</h3><p className="text-sm text-gray-500">{aiImport.fileName}</p></div></div>
{!aiImport.loading && <button onClick={() => setAiImport({ open: false, loading: false, error: null, result: null, fileName: '' })} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5"/></button>}
</div>
<div className="flex-1 overflow-y-auto p-5">
{aiImport.loading && (
<div className="flex flex-col items-center justify-center py-16">
<Loader2 className="w-12 h-12 text-purple-600 animate-spin mb-4"/>
<p className="text-lg font-semibold text-gray-700 mb-1">Analysing spreadsheet with AI...</p>
<p className="text-sm text-gray-500">Claude is mapping your columns to budget fields</p>
</div>)}
{aiImport.error && (
<div className="bg-red-50 border border-red-200 rounded-lg p-4">
<p className="text-red-700 font-medium">Import failed</p>
<p className="text-red-600 text-sm mt-1">{aiImport.error}</p>
<button onClick={() => setAiImport({ open: false, loading: false, error: null, result: null, fileName: '' })} className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium">Close</button>
</div>)}
{aiImport.result && (() => {
  const r = aiImport.result;
  return (<div>
  <div className="grid grid-cols-3 gap-4 mb-4">
  <div className="bg-purple-50 rounded-lg p-3 border border-purple-200"><p className="text-xs font-medium text-purple-600 uppercase">Sheet Used</p><p className="text-sm font-bold text-purple-800">{r.sheetUsed}</p></div>
  <div className="bg-green-50 rounded-lg p-3 border border-green-200"><p className="text-xs font-medium text-green-600 uppercase">Rows Mapped</p><p className="text-sm font-bold text-green-800">{r.totalMapped} of {r.totalInFile}</p></div>
  <div className="bg-teal-50 rounded-lg p-3 border border-teal-200"><p className="text-xs font-medium text-teal-600 uppercase">Total EUR Annual</p><p className="text-sm font-bold text-teal-800">€{r.rows.reduce((s, row) => s + (row.eurAnnual || 0), 0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</p></div>
  </div>
  {r.mappings && Object.keys(r.mappings).length > 0 && (
  <div className="mb-4 bg-gray-50 rounded-lg p-3 border border-gray-200">
  <p className="text-xs font-semibold text-gray-600 uppercase mb-2">Field Mappings</p>
  <div className="flex flex-wrap gap-2">
  {Object.entries(r.mappings).map(([target, source]) => (
  <span key={target} className="inline-flex items-center gap-1 text-xs bg-white border border-gray-300 rounded-full px-2.5 py-1"><span className="font-medium text-purple-700">{target}</span><span className="text-gray-400">←</span><span className="text-gray-600">{source}</span></span>
  ))}
  </div></div>)}
  <div className="overflow-x-auto border border-gray-200 rounded-lg">
  <table className="w-full text-xs text-left">
  <thead><tr className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase">
  <th className="px-2 py-2">#</th><th className="px-2 py-2">Type</th><th className="px-2 py-2">Business Unit</th><th className="px-2 py-2">Service Cat.</th><th className="px-2 py-2">Licence</th><th className="px-2 py-2">Vendor</th><th className="px-2 py-2">Region</th><th className="px-2 py-2">Currency</th><th className="px-2 py-2 text-right">Contract Val.</th><th className="px-2 py-2 text-right">EUR Annual</th><th className="px-2 py-2">Comments</th>
  </tr></thead>
  <tbody>{r.rows.slice(0, 100).map((row, i) => (
  <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
  <td className="px-2 py-1.5 text-gray-400">{i+1}</td>
  <td className="px-2 py-1.5"><span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${row.type === 'BAU' ? 'bg-blue-100 text-blue-700' : row.type === 'New' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>{row.type}</span></td>
  <td className="px-2 py-1.5">{row.businessUnit || '—'}</td>
  <td className="px-2 py-1.5">{row.serviceCategory || '—'}</td>
  <td className="px-2 py-1.5 font-medium max-w-[200px] truncate">{row.licence}</td>
  <td className="px-2 py-1.5 max-w-[150px] truncate">{row.vendor || '—'}</td>
  <td className="px-2 py-1.5">{row.region || '—'}</td>
  <td className="px-2 py-1.5">{row.currency}</td>
  <td className="px-2 py-1.5 text-right">{row.contractValue ? row.contractValue.toLocaleString(undefined,{minimumFractionDigits:2}) : '—'}</td>
  <td className="px-2 py-1.5 text-right font-semibold text-teal-700">{row.eurAnnual ? `€${row.eurAnnual.toLocaleString(undefined,{minimumFractionDigits:2})}` : '—'}</td>
  <td className="px-2 py-1.5 max-w-[120px] truncate text-gray-500">{row.comments || '—'}</td>
  </tr>))}</tbody>
  </table>
  {r.rows.length > 100 && <p className="text-xs text-gray-500 p-2 text-center">Showing first 100 of {r.rows.length} rows</p>}
  </div></div>);
})()}
</div>
{aiImport.result && (
<div className="flex items-center justify-between p-5 border-t border-gray-200 bg-gray-50 rounded-b-xl">
<p className="text-sm text-gray-600">{aiImport.result.totalMapped} line item{aiImport.result.totalMapped !== 1 ? 's' : ''} will be added to this budget</p>
<div className="flex space-x-3">
<button onClick={() => setAiImport({ open: false, loading: false, error: null, result: null, fileName: '' })} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm font-medium">Cancel</button>
<button onClick={() => confirmAiImport(sb.id, aiImport.result.rows)} className="px-5 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-semibold flex items-center space-x-2"><CheckCircle className="w-4 h-4"/><span>Import {aiImport.result.totalMapped} Items</span></button>
</div></div>)}
</div></div>)}
</div></div>); }

// Budget list view
return (<div className={_pg}>{showBudgetModal && (<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"><div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6">
<h3 className="text-xl font-bold text-gray-900 mb-4">Create New Budget</h3>
<div className="space-y-4">
<div><label className="block text-sm font-medium text-gray-700 mb-1">Title <span className="text-red-500">*</span></label><input type="text" value={budgetForm.title} onChange={e => setBudgetForm(p => ({...p, title: e.target.value}))} placeholder="e.g. Engineering FY2026 Budget" className={`w-full ${_i}`}/></div>
<div className="grid grid-cols-2 gap-4">
<div><label className="block text-sm font-medium text-gray-700 mb-1">Year <span className="text-red-500">*</span></label><input type="number" value={budgetForm.year} onChange={e => setBudgetForm(p => ({...p, year: e.target.value}))} min="2024" max="2030" className={`w-full ${_i}`}/></div>
<div><label className="block text-sm font-medium text-gray-700 mb-1">Function <span className="text-red-500">*</span></label><select value={budgetForm.functionId} onChange={e => setBudgetForm(p => ({...p, functionId: e.target.value}))} className={`w-full ${_i}`}><option value="">Select...</option>{getUserFunctions().map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></div>
</div></div>
<div className="flex space-x-3 mt-6"><button onClick={() => setShowBudgetModal(false)} className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">Cancel</button><button onClick={createBudget} disabled={!budgetForm.title || !budgetForm.year || !budgetForm.functionId} className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed">Create Budget</button></div>
</div></div>)}
<div className="w-full">{budgetNavBar}
<div className={_fj+" mb-6"}>
<div className="flex items-center space-x-2">
<span className="text-sm text-gray-500">{budgets.length} budget{budgets.length !== 1 ? 's' : ''}</span>
</div>
<button onClick={() => { setBudgetForm({ title: '', year: new Date().getFullYear(), functionId: '' }); setShowBudgetModal(true); }} className="flex items-center space-x-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-semibold"><Plus className="w-4 h-4"/><span>New Budget</span></button>
</div>
{budgets.length === 0 ? (<div className="bg-white rounded-xl shadow-lg p-12 text-center"><Wallet className="w-16 h-16 text-gray-300 mx-auto mb-4"/><h3 className="text-lg font-semibold text-gray-600 mb-2">No budgets yet</h3><p className="text-gray-400 mb-6">Create your first budget to start tracking spend against plan.</p><button onClick={() => { setBudgetForm({ title: '', year: new Date().getFullYear(), functionId: '' }); setShowBudgetModal(true); }} className="px-6 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-semibold">Create Budget</button></div>)
: (<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
{budgets.map(b => (<div key={b.id} className="bg-white rounded-xl shadow-lg hover:shadow-xl border-2 border-transparent hover:border-teal-300 transition cursor-pointer" onClick={() => openBudgetDetail(b)}>
<div className="p-6">
<div className={_fj+" mb-3"}>
<span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${b.status === 'Draft' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>{b.status}</span>
<span className="text-sm font-medium text-gray-500">{b.year}</span>
</div>
<h3 className="text-lg font-bold text-gray-800 mb-1">{b.title}</h3>
<p className="text-sm text-gray-500 mb-4">{b.function?.name || '—'} — Created by {b.createdBy?.name}</p>
<div className="grid grid-cols-3 gap-3">
<div className="bg-gray-50 rounded-lg p-3"><p className="text-xs text-gray-500">Annual EUR</p><p className="text-lg font-bold text-teal-700">€{(b.totalEurAnnual||0).toLocaleString(undefined,{minimumFractionDigits:0,maximumFractionDigits:0})}</p></div>
<div className="bg-gray-50 rounded-lg p-3"><p className="text-xs text-gray-500">Line Items</p><p className="text-lg font-bold text-gray-700">{b.lineItemCount || 0}</p></div>
{(() => { const pct = b.totalEurAnnual > 0 ? Math.round((b.totalSpent || 0) / b.totalEurAnnual * 100) : 0; const color = pct > 100 ? 'text-red-600' : pct > 80 ? 'text-amber-600' : 'text-teal-600'; return (
<div className="bg-gray-50 rounded-lg p-3"><p className="text-xs text-gray-500">Budget Spent</p><p className={`text-lg font-bold ${color}`}>{pct}%</p>
<div className="w-full bg-gray-200 rounded-full h-1.5 mt-1"><div className={`h-1.5 rounded-full ${pct > 100 ? 'bg-red-500' : pct > 80 ? 'bg-amber-500' : 'bg-teal-500'}`} style={{width:`${Math.min(pct,100)}%`}}/></div></div>);})()}
</div>
<div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
<span className="text-xs text-gray-400">{new Date(b.createdAt).toLocaleDateString()}{b.submittedAt ? ` — Submitted ${new Date(b.submittedAt).toLocaleDateString()}` : ''}</span>
{b.status === 'Draft' && <button onClick={e => { e.stopPropagation(); deleteBudget(b.id); }} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4"/></button>}
</div></div></div>))}
</div>)}
</div></div>); }

if (currentPage === 'reports') { if (!hasPermission('reports.view')) { setCurrentPage('landing'); return null; } const rd = reportData; const fmtK = (v) => v >= 1000 ? `€${(v/1000).toFixed(1)}k` : `€${v.toFixed(0)}`;
const STATUS_COLORS = { Approved:'#10b981', Pending:'#f59e0b', Rejected:'#ef4444' };
const InfoTip = ({tip, size='w-4 h-4'}) => <span className="relative group inline-flex"><AlertCircle className={`${size} text-gray-300 cursor-help flex-shrink-0`}/><span className="pointer-events-none invisible group-hover:visible absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 rounded-lg bg-gray-800 text-white text-xs leading-relaxed p-3 shadow-lg z-50 whitespace-normal">{tip}</span></span>;
const ChartTitle = ({children, tip}) => <div className="flex items-center justify-between mb-4"><h2 className="text-xl font-bold text-gray-800">{children}</h2><InfoTip tip={tip}/></div>;
const DEFAULT_CHART_ORDER = ['spendByCategory','spendByDept','invoiceVolume','approvedVsInvoiced','statusBreakdown','invoicedByRegion'];
const chartDefs = {
  spendByCategory: { title:'Spend by Category', tip:'Breakdown of approved spend approval amounts by category, converted to EUR. Only includes approvals with status "Approved".', render: () => rd.spendByCategory.length === 0 ? <p className="text-gray-400 text-center py-8">No approved spend data for selected period</p> : <ResponsiveContainer width="100%" height={300}><PieChart><Pie data={rd.spendByCategory} cx="50%" cy="50%" innerRadius={60} outerRadius={110} dataKey="value" label={({name,percent})=>`${name} ${(percent*100).toFixed(0)}%`}>{rd.spendByCategory.map((_,i)=><Cell key={i} fill={CHART_COLORS[i%CHART_COLORS.length]}/>)}</Pie><Tooltip formatter={v=>`€${v.toLocaleString()}`}/></PieChart></ResponsiveContainer> },
  spendByDept: { title:'Spend by Department', tip:'Breakdown of approved spend approval amounts by department/function, converted to EUR. Only includes approvals with status "Approved".', render: () => rd.spendByDept.length === 0 ? <p className="text-gray-400 text-center py-8">No approved spend data for selected period</p> : <ResponsiveContainer width="100%" height={300}><BarChart data={rd.spendByDept}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="name" tick={{fontSize:12}}/><YAxis tick={{fontSize:12}}/><Tooltip formatter={v=>`€${v.toLocaleString()}`}/><Bar dataKey="value" fill="#6366f1" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer> },
  invoiceVolume: { title:'Invoice Volume Over Time', tip:'Number of invoices per month based on invoice date. Shows how invoice submission volume trends over the filtered period.', render: () => rd.invoiceVolume.length === 0 ? <p className="text-gray-400 text-center py-8">No invoice data for selected period</p> : <ResponsiveContainer width="100%" height={300}><LineChart data={rd.invoiceVolume}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="month" tick={{fontSize:12}}/><YAxis allowDecimals={false} tick={{fontSize:12}}/><Tooltip/><Line type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} dot={{r:4}}/></LineChart></ResponsiveContainer> },
  approvedVsInvoiced: { title:'Approved vs Invoiced by Dept', tip:'Compares total approved spend amounts vs total invoiced amounts per department. "Approved" = sum of approved spend approvals. "Invoiced" = sum of linked invoice totals. Both converted to EUR.', render: () => rd.approvedVsInvoiced.length === 0 ? <p className="text-gray-400 text-center py-8">No data for selected period</p> : <ResponsiveContainer width="100%" height={300}><BarChart data={rd.approvedVsInvoiced}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="name" tick={{fontSize:12}}/><YAxis tick={{fontSize:12}}/><Tooltip formatter={v=>`€${v.toLocaleString()}`}/><Legend/><Bar dataKey="approved" fill="#10b981" radius={[4,4,0,0]}/><Bar dataKey="invoiced" fill="#6366f1" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer> },
  statusBreakdown: { title:'Approval Status Breakdown', tip:'Count of spend approvals grouped by status (Approved, Pending, Rejected). Shows the distribution of all spend approvals matching the current filters.', render: () => rd.statusBreakdown.length === 0 ? <p className="text-gray-400 text-center py-8">No spend approval data for selected period</p> : <ResponsiveContainer width="100%" height={300}><PieChart><Pie data={rd.statusBreakdown} cx="50%" cy="50%" innerRadius={60} outerRadius={110} dataKey="value" label={({name,value})=>`${name}: ${value}`}>{rd.statusBreakdown.map((entry,i)=><Cell key={i} fill={STATUS_COLORS[entry.name]||CHART_COLORS[i%CHART_COLORS.length]}/>)}</Pie><Tooltip/><Legend/></PieChart></ResponsiveContainer> },
  invoicedByRegion: { title:'Invoiced by Region', tip:'Total invoiced amounts grouped by the region of the linked spend approval, converted to EUR. Invoices not linked to a spend approval are grouped as "Unknown".', render: () => rd.invoicedByRegion.length === 0 ? <p className="text-gray-400 text-center py-8">No invoice data for selected period</p> : <ResponsiveContainer width="100%" height={300}><BarChart data={rd.invoicedByRegion}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="name" tick={{fontSize:12}}/><YAxis tick={{fontSize:12}}/><Tooltip formatter={v=>`€${v.toLocaleString()}`}/><Bar dataKey="value" fill="#8b5cf6" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer> },
};
const validOrder = chartOrder.filter(id => chartDefs[id]);
const orderedCharts = [...validOrder, ...DEFAULT_CHART_ORDER.filter(id => !validOrder.includes(id))];
const handleDragStart = (e, id) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', id); };
const handleDrop = (e, targetId) => { e.preventDefault(); const srcId = e.dataTransfer.getData('text/plain'); if (srcId === targetId) return; const arr = [...orderedCharts]; const si = arr.indexOf(srcId); const ti = arr.indexOf(targetId); arr.splice(si, 1); arr.splice(ti, 0, srcId); setChartOrder(arr); };
const handleDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };
const chartPairs = []; for (let i = 0; i < orderedCharts.length; i += 2) { chartPairs.push(orderedCharts.slice(i, i + 2)); }
return (<div className={_pg}><div className="w-full">
<div className="bg-white rounded-lg shadow-lg p-6 mb-6"><div className={_fj}><div className="flex items-center space-x-3"><BarChart3 className="w-8 h-8 text-amber-600"/><h1 className="text-3xl font-bold text-gray-800">Reports</h1></div>
<div className="flex items-center space-x-4"><div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 rounded-lg"><User className="w-5 h-5 text-indigo-600"/><div className="text-sm"><p className="font-semibold text-gray-800">{user.name}</p><p className="text-xs text-gray-600">{user.role}</p></div></div>
<button onClick={() => setCurrentPage('landing')} className="flex items-center space-x-2 px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200"><Home className="w-4 h-4"/><span>Dashboard</span></button>
{hasPermission('reports.export') && <button onClick={exportReportCsv} className="flex items-center space-x-2 px-4 py-2 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200"><Download className="w-4 h-4"/><span>Export CSV</span></button>}
{JSON.stringify(chartOrder) !== JSON.stringify(DEFAULT_CHART_ORDER) && <button onClick={() => setChartOrder(DEFAULT_CHART_ORDER)} className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 text-sm">Reset layout</button>}
<button onClick={logout} className="flex items-center space-x-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"><LogOut className="w-4 h-4"/><span>Logout</span></button></div></div>
<div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-10 gap-3 mt-4">
<div><label className="block text-xs font-medium text-gray-500 mb-1">From</label><input type="date" value={reportFilters.dateFrom} onChange={e => setReportFilters(p => ({...p, dateFrom: e.target.value}))} className={`w-full ${_i}`}/></div>
<div><label className="block text-xs font-medium text-gray-500 mb-1">To</label><input type="date" value={reportFilters.dateTo} onChange={e => setReportFilters(p => ({...p, dateTo: e.target.value}))} className={`w-full ${_i}`}/></div>
<div><label className="block text-xs font-medium text-gray-500 mb-1">Department</label><select value={reportFilters.department} onChange={e => setReportFilters(p => ({...p, department: e.target.value}))} className={`w-full ${_i}`}><option value="all">All</option>{[...new Set(spendApprovals.map(s=>s.department).filter(Boolean))].sort().map(v=><option key={v} value={v}>{v}</option>)}</select></div>
<div><label className="block text-xs font-medium text-gray-500 mb-1">Approver</label><select value={reportFilters.approver} onChange={e => setReportFilters(p => ({...p, approver: e.target.value}))} className={`w-full ${_i}`}><option value="all">All</option>{[...new Set(spendApprovals.map(s=>s.approver).filter(Boolean))].sort().map(v=><option key={v} value={v}>{v}</option>)}</select></div>
<div><label className="block text-xs font-medium text-gray-500 mb-1">Region</label><select value={reportFilters.region} onChange={e => setReportFilters(p => ({...p, region: e.target.value}))} className={`w-full ${_i}`}><option value="all">All</option>{regions.filter(r=>r.active).map(r=><option key={r.id} value={r.code}>{r.name}</option>)}</select></div>
<div><label className="block text-xs font-medium text-gray-500 mb-1">Project</label><select value={reportFilters.project} onChange={e => setReportFilters(p => ({...p, project: e.target.value}))} className={`w-full ${_i}`}><option value="all">All</option>{projects.filter(p=>p.active).map(p=><option key={p.id} value={p.name}>{p.name}</option>)}</select></div>
<div><label className="block text-xs font-medium text-gray-500 mb-1">Cost Centre</label><select value={reportFilters.costCentre} onChange={e => setReportFilters(p => ({...p, costCentre: e.target.value}))} className={`w-full ${_i}`}><option value="all">All</option>{costCentres.filter(c=>c.active).map(c=><option key={c.id} value={c.code}>{c.code} - {c.name}</option>)}</select></div>
<div><label className="block text-xs font-medium text-gray-500 mb-1">Atom</label><select value={reportFilters.atom} onChange={e => setReportFilters(p => ({...p, atom: e.target.value}))} className={`w-full ${_i}`}><option value="all">All</option>{atoms.filter(a=>a.active).map(a=><option key={a.id} value={a.code}>{a.code} - {a.name}</option>)}</select></div>
<div><label className="block text-xs font-medium text-gray-500 mb-1">Vendor</label><select value={reportFilters.vendor} onChange={e => setReportFilters(p => ({...p, vendor: e.target.value}))} className={`w-full ${_i}`}><option value="all">All</option>{[...new Set([...spendApprovals.map(s=>s.vendor),...invoices.map(i=>i.vendor)].filter(Boolean))].sort().map(v=><option key={v} value={v}>{v}</option>)}</select></div>
<div><label className="block text-xs font-medium text-gray-500 mb-1">Budget</label><select value={reportFilters.budget} onChange={e => { setReportFilters(p => ({...p, budget: e.target.value})); const bId = e.target.value !== 'all' ? e.target.value : ''; api.get(`/api/budget-report${bId ? `?budgetId=${bId}` : ''}`).then(d => setBudgetReport(d||[])).catch(() => {}); }} className={`w-full ${_i}`}><option value="all">All Budgets</option>{budgets.map(b=><option key={b.id} value={b.id}>{b.title} ({b.year})</option>)}</select></div>
</div>
{Object.values(reportFilters).some(v => v && v !== 'all') && <div className="mt-2 text-right"><button onClick={() => { setReportFilters({dateFrom:'',dateTo:'',department:'all',approver:'all',region:'all',project:'all',costCentre:'all',atom:'all',vendor:'all',budget:'all'}); api.get('/api/budget-report').then(d => setBudgetReport(d||[])).catch(() => {}); }} className="text-sm text-indigo-600 hover:underline">Clear all filters</button></div>}
</div>
{/* KPI Cards */}
<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
{[{label:'Total Invoiced',value:fmtK(rd.totalInvoicedEur),border:'border-indigo-500',tip:'Sum of all invoice totals (subtotal + tax) converted to EUR using current exchange rates. Filtered by date range, vendor, and linked spend approval filters.'},{label:'Approved Spend',value:fmtK(rd.totalApprovedEur),border:'border-green-500',tip:'Sum of all approved spend approval amounts converted to EUR. Only includes spend approvals with status "Approved".'},{label:'Invoices',value:rd.invoiceCount,border:'border-blue-500',tip:'Total number of invoices matching the current filters. When department/region/project filters are active, only invoices linked to matching spend approvals are counted.'},{label:'Approvals',value:rd.approvalCount,border:'border-purple-500',tip:'Total number of spend approvals (all statuses) matching the current filters.'},{label:'Approval Rate',value:`${rd.approvalRate.toFixed(1)}%`,border:'border-amber-500',tip:'Percentage of filtered spend approvals with status "Approved" out of all filtered spend approvals (approved / total × 100).'},{label:'Avg Days',value:rd.avgDays.toFixed(1),border:'border-rose-500',tip:'Average number of days between the spend approval submission date and the linked invoice date, for invoices that are linked to a spend approval.'}].map((kpi,i)=>(
<div key={i} className={`bg-white rounded-lg shadow p-4 border-t-4 ${kpi.border}`}><div className="flex items-center justify-between"><p className="text-xs font-medium text-gray-500 uppercase">{kpi.label}</p><InfoTip tip={kpi.tip} size="w-3.5 h-3.5"/></div><p className="text-2xl font-bold text-gray-800 mt-1">{kpi.value}</p></div>))}
</div>
{/* Budget vs Spend Approval vs Actuals */}
{budgetReport.length > 0 && (<div className="bg-white rounded-lg shadow-lg p-6 mb-6">
<div className="flex items-center justify-between mb-4"><h2 className="text-xl font-bold text-gray-800">Budget Compliance</h2>
<div className="flex items-center space-x-2">
<button onClick={() => setBudgetReportView('table')} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${budgetReportView==='table' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>Table</button>
<button onClick={() => setBudgetReportView('chart')} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${budgetReportView==='chart' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>Chart</button>
</div></div>
{budgetReportView === 'table' ? (<div className="overflow-x-auto"><table className="w-full text-left text-sm">
<thead><tr className="border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase">
<th className="px-4 py-3">Budget Title</th><th className="px-4 py-3">Function</th><th className="px-4 py-3 text-center">Status</th>
<th className="px-4 py-3 text-right">Budget Total (EUR)</th><th className="px-4 py-3 text-right">Total SA Approved (EUR)</th><th className="px-4 py-3 text-right">Total Invoiced (EUR)</th><th className="px-4 py-3 text-right">Variance</th>
</tr></thead><tbody>
{budgetReport.map(r => {
const varClass = r.variance < 0 ? 'text-red-600' : r.variance > 0 ? 'text-green-600' : 'text-gray-600';
const sBadgeR = (status) => { const c = {Draft:'bg-gray-100 text-gray-800',Submitted:'bg-green-100 text-green-800'}; return <span className={`px-2 py-1 rounded-full text-xs font-semibold ${c[status]||'bg-gray-100 text-gray-800'}`}>{status}</span>; };
return (<tr key={r.budgetId} className="border-b border-gray-100 hover:bg-gray-50">
<td className="px-4 py-3 font-medium text-gray-800">{r.title}</td>
<td className="px-4 py-3 text-gray-600">{r.functionName}</td>
<td className="px-4 py-3 text-center">{sBadgeR(r.status)}</td>
<td className="px-4 py-3 text-right font-semibold">€{r.budgetEur.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
<td className="px-4 py-3 text-right font-semibold">€{r.approvedEur.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
<td className="px-4 py-3 text-right font-semibold">{r.invoicedEur > 0 ? `€${r.invoicedEur.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}` : '—'}</td>
<td className={`px-4 py-3 text-right font-semibold ${varClass}`}>€{r.variance.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
</tr>);})}
{(() => { const totals = budgetReport.reduce((acc,r) => ({ budget: acc.budget+r.budgetEur, approved: acc.approved+r.approvedEur, invoiced: acc.invoiced+r.invoicedEur }), {budget:0,approved:0,invoiced:0}); return (<tr className="border-t-2 border-gray-300 font-bold">
<td className="px-4 py-3" colSpan={3}>Totals</td>
<td className="px-4 py-3 text-right">€{totals.budget.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
<td className="px-4 py-3 text-right">€{totals.approved.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
<td className="px-4 py-3 text-right">€{totals.invoiced.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
<td className={`px-4 py-3 text-right ${(totals.budget-totals.invoiced)<0?'text-red-600':'text-green-600'}`}>€{(totals.budget-totals.invoiced).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
</tr>); })()}
</tbody></table></div>)
: (<div>
{(() => {
const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
let cumBudget = 0, cumActual = 0, cumApproved = 0;
const chartData = months.map(m => {
cumBudget += budgetReport.reduce((sum,r) => sum + (r.monthlyBudgets?.[m]||0), 0);
cumActual += budgetReport.reduce((sum,r) => sum + (r.monthlyActuals?.[m]||0), 0);
cumApproved += budgetReport.reduce((sum,r) => sum + r.approvedEur/12, 0);
return { month: m, budget: Math.round(cumBudget*100)/100, approved: Math.round(cumApproved*100)/100, actuals: Math.round(cumActual*100)/100 };
});
return (<ResponsiveContainer width="100%" height={400}>
<LineChart data={chartData}>
<CartesianGrid strokeDasharray="3 3"/>
<XAxis dataKey="month" tick={{fontSize:12}}/>
<YAxis tick={{fontSize:12}} tickFormatter={v => v >= 1000 ? `€${(v/1000).toFixed(0)}k` : `€${v}`}/>
<Tooltip formatter={(v,name) => [`€${Number(v).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`, name]}/>
<Legend/>
<Line type="monotone" dataKey="budget" stroke="#6366f1" strokeWidth={2} dot={{r:4}} name="Budget"/>
<Line type="monotone" dataKey="approved" stroke="#10b981" strokeWidth={2} dot={{r:4}} name="Approved"/>
<Line type="monotone" dataKey="actuals" stroke="#f59e0b" strokeWidth={2} dot={{r:4}} name="Actuals (Invoiced)"/>
</LineChart></ResponsiveContainer>);
})()}
</div>)}
</div>)}
{/* Dynamic Report */}
<div className="bg-white rounded-lg shadow-lg p-6 mb-6">
<div className="flex items-center justify-between mb-4"><h2 className="text-xl font-bold text-gray-800">Dynamic Report</h2></div>
<div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
<div><label className="block text-xs font-medium text-gray-500 mb-1">Data Source</label><select value={dynSource} onChange={e => setDynSource(e.target.value)} className={`w-full ${_i}`}><option value="budgets">Budget Lines</option><option value="invoices">Invoices</option><option value="spends">Spend Approvals</option></select></div>
<div><label className="block text-xs font-medium text-gray-500 mb-1">Group By</label><select value={dynGroupBy} onChange={e => setDynGroupBy(e.target.value)} className={`w-full ${_i}`}><option value="department">Department</option><option value="businessUnit">Business Unit</option><option value="region">Region</option><option value="costCentre">Cost Centre</option><option value="vendor">Vendor</option></select></div>
<div><label className="block text-xs font-medium text-gray-500 mb-1">Chart Type</label><select value={dynChartType} onChange={e => setDynChartType(e.target.value)} className={`w-full ${_i}`}><option value="bar">Bar Chart</option><option value="pie">Pie Chart</option><option value="table">Table Only</option></select></div>
</div>
{(() => {
const grouped = {};
const addRow = (key, budget, approved, invoiced) => {
  const k = key || 'Unspecified';
  if (!grouped[k]) grouped[k] = { budget: 0, approved: 0, invoiced: 0, count: 0 };
  grouped[k].budget += budget; grouped[k].approved += approved; grouped[k].invoiced += invoiced; grouped[k].count += 1;
};
if (dynSource === 'budgets') {
  budgetLines.forEach(bl => {
    const dimVal = dynGroupBy === 'department' ? (bl.businessUnit || bl.department || '') : dynGroupBy === 'businessUnit' ? (bl.businessUnit || '') : dynGroupBy === 'region' ? (bl.region || '') : dynGroupBy === 'costCentre' ? (bl.costCentre || '') : (bl.vendor || '');
    const budgetEur = parseFloat(bl.eurAnnual) || 0;
    const sp = bl.spendApproval;
    const approvedEur = sp ? toEur(parseFloat(sp.amount) || 0, sp.currency) : 0;
    addRow(dimVal, budgetEur, approvedEur, 0);
  });
} else if (dynSource === 'invoices') {
  invoices.forEach(inv => {
    const sp = inv.spendApprovalId ? spendApprovals.find(s => s.id === inv.spendApprovalId) : null;
    const dimVal = dynGroupBy === 'department' ? (inv.department || sp?.department || '') : dynGroupBy === 'businessUnit' ? (inv.businessUnit || sp?.businessUnit || '') : dynGroupBy === 'region' ? (sp?.region || '') : dynGroupBy === 'costCentre' ? (sp?.costCentre || '') : (inv.vendor || '');
    const invEur = toEur(invoiceTotal(inv), inv.currency || 'EUR');
    addRow(dimVal, 0, 0, invEur);
  });
} else {
  spendApprovals.forEach(sp => {
    const dimVal = dynGroupBy === 'department' ? (sp.department || '') : dynGroupBy === 'businessUnit' ? (sp.businessUnit || '') : dynGroupBy === 'region' ? (sp.region || '') : dynGroupBy === 'costCentre' ? (sp.costCentre || '') : (sp.vendor || '');
    const approvedEur = toEur(parseFloat(sp.amount) || 0, sp.currency);
    const invEur = invoices.filter(i => i.spendApprovalId === sp.id).reduce((s, i) => s + toEur(invoiceTotal(i), i.currency || 'EUR'), 0);
    addRow(dimVal, 0, approvedEur, invEur);
  });
}
const rows = Object.entries(grouped).map(([name, d]) => ({ name, ...d })).sort((a, b) => (b.budget + b.approved + b.invoiced) - (a.budget + a.approved + a.invoiced));
const totals = rows.reduce((acc, r) => ({ budget: acc.budget + r.budget, approved: acc.approved + r.approved, invoiced: acc.invoiced + r.invoiced, count: acc.count + r.count }), { budget: 0, approved: 0, invoiced: 0, count: 0 });
const valueColumns = dynSource === 'budgets' ? ['budget', 'approved'] : dynSource === 'invoices' ? ['invoiced'] : ['approved', 'invoiced'];
const colLabels = { budget: 'Budget (EUR)', approved: 'SA Approved (EUR)', invoiced: 'Invoiced (EUR)' };
const dimLabel = { department: 'Department', businessUnit: 'Business Unit', region: 'Region', costCentre: 'Cost Centre', vendor: 'Vendor' }[dynGroupBy];
const fmtE = v => `€${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const chartData = rows.map(r => ({ name: r.name.length > 20 ? r.name.slice(0, 18) + '...' : r.name, fullName: r.name, budget: Math.round(r.budget * 100) / 100, approved: Math.round(r.approved * 100) / 100, invoiced: Math.round(r.invoiced * 100) / 100 }));
return (<>
{dynChartType !== 'table' && chartData.length > 0 && (<div className="mb-4">
{dynChartType === 'bar' ? (<ResponsiveContainer width="100%" height={Math.max(300, chartData.length * 40)}>
<BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
<CartesianGrid strokeDasharray="3 3"/>
<XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={v => v >= 1000 ? `€${(v / 1000).toFixed(0)}k` : `€${v}`}/>
<YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={140}/>
<Tooltip formatter={(v, name) => [fmtE(v), colLabels[name] || name]}/>
<Legend/>
{valueColumns.map((col, i) => <Bar key={col} dataKey={col} fill={CHART_COLORS[i % CHART_COLORS.length]} radius={[0, 4, 4, 0]} name={colLabels[col]}/>)}
</BarChart></ResponsiveContainer>)
: (<ResponsiveContainer width="100%" height={350}>
<PieChart>
<Pie data={chartData.map(r => ({ name: r.name, value: Math.round((valueColumns.reduce((s, c) => s + r[c], 0)) * 100) / 100 }))} cx="50%" cy="50%" innerRadius={60} outerRadius={120} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
{chartData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]}/>)}
</Pie>
<Tooltip formatter={v => fmtE(v)}/></PieChart></ResponsiveContainer>)}
</div>)}
<div className="overflow-x-auto"><table className="w-full text-left text-sm">
<thead><tr className="border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase">
<th className="px-4 py-3">{dimLabel}</th><th className="px-4 py-3 text-right">Count</th>
{valueColumns.map(c => <th key={c} className="px-4 py-3 text-right">{colLabels[c]}</th>)}
</tr></thead><tbody>
{rows.map(r => (<tr key={r.name} className="border-b border-gray-100 hover:bg-gray-50">
<td className="px-4 py-3 font-medium text-gray-800">{r.name}</td>
<td className="px-4 py-3 text-right text-gray-600">{r.count}</td>
{valueColumns.map(c => <td key={c} className="px-4 py-3 text-right font-semibold">{fmtE(r[c])}</td>)}
</tr>))}
<tr className="border-t-2 border-gray-300 font-bold">
<td className="px-4 py-3">Totals</td>
<td className="px-4 py-3 text-right">{totals.count}</td>
{valueColumns.map(c => <td key={c} className="px-4 py-3 text-right">{fmtE(totals[c])}</td>)}
</tr>
</tbody></table></div>
</>);
})()}
</div>
{/* Draggable Charts */}
{chartPairs.map((pair, ri) => (
<div key={ri} className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
{pair.map(id => { const def = chartDefs[id]; return (
<div key={id} draggable onDragStart={e => handleDragStart(e, id)} onDrop={e => handleDrop(e, id)} onDragOver={handleDragOver} className={`${_cd} cursor-grab active:cursor-grabbing transition-shadow hover:shadow-xl`}>
<div className="flex items-center justify-between mb-4"><div className="flex items-center space-x-2"><span className="text-gray-300 select-none" title="Drag to reorder">⠿</span><h2 className="text-xl font-bold text-gray-800">{def.title}</h2></div><InfoTip tip={def.tip}/></div>
{def.render()}
</div>); })}
</div>))}
</div></div>);}
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
const submitSpend = async () => { if (!sf.title||!sf.currency||!sf.approver||!sf.amount||!sf.category||!sf.atom||!sf.vendor||!sf.costCentre||!sf.region||!sf.exceptional||!sf.justification||!sf.department) { alert('Fill all required fields'); return; }
const num = String(spendApprovals.length+1).padStart(4,'0');
const ref = `SA-${num}-${sf.atom}-${sf.costCentre}-${sf.region}`;
try {
const saved = await api.post('/api/spend-approvals', { ref, title:sf.title, currency:sf.currency, amount:sf.amount, category:sf.category, vendor:sf.vendor, businessUnit:sf.businessUnit||null, costCentre:sf.costCentre, atom:sf.atom, region:sf.region, project:sf.project, description:sf.description||null, department:sf.department, approverId:sf.approverId, submittedBy:user.name, inBudget:sf.inBudget, exceptional:sf.exceptional, timeSensitive:sf.timeSensitive, justification:sf.justification, ccRecipients:sf.cc || null });
setSpendApprovals(prev => [{ ...saved, approver: sf.approver, originInvoiceIds: sf.originInvoiceIds || [], attachments: [] }, ...prev]);
// Auto-link origin invoices immediately
if (sf.originInvoiceIds && sf.originInvoiceIds.length > 0) {
for (const invId of sf.originInvoiceIds) {
try { await api.patch(`/api/invoices/${invId}/link`, { spendApprovalId: saved.id });
setInvoices(prev => prev.map(i => i.id === invId ? { ...i, spendApprovalId: saved.id, spendApprovalTitle: sf.title } : i));
} catch (e) { console.error('Failed to auto-link invoice:', e); }
}
setSelectedInvoiceIds([]);
}
// Upload any pending attachments
for (const pa of pendingAttachments) {
try { await api.post(`/api/spend-approvals/${saved.id}/attachments`, { fileName: pa.name, fileType: pa.type, fileUrl: pa.dataUrl }); } catch (e) { console.error('Failed to upload attachment:', e); }
}
// Link any pending budget lines
if (pendingBudgetLineIds.length > 0) {
try { await api.post('/api/budget-lines/bulk-link', { ids: pendingBudgetLineIds, spendApprovalId: saved.id });
setBudgetLines(prev => prev.map(bl => pendingBudgetLineIds.includes(bl.id) ? { ...bl, spendApprovalId: saved.id } : bl));
} catch (e) { console.error('Failed to link budget lines:', e); }
}
setPendingBudgetLineIds([]);
setPendingAttachments([]);
setSpendSubmitted(true);
} catch (err) { console.error('Failed to create spend approval:', err); alert('Failed to create spend approval: ' + (err.message || 'Unknown error'));
const newApproval = { id: Date.now(), ref, title:sf.title, currency:sf.currency, amount:sf.amount, category:sf.category, vendor:sf.vendor, approver:sf.approver, businessUnit:sf.businessUnit||null, costCentre:sf.costCentre, atom:sf.atom, region:sf.region, project:sf.project, department:sf.department, status:'Pending', submittedBy:user.name, submittedAt:new Date().toISOString(), inBudget:sf.inBudget, exceptional:sf.exceptional, timeSensitive:sf.timeSensitive, justification:sf.justification, ccRecipients:sf.cc || null, originInvoiceIds: sf.originInvoiceIds || [] };
setSpendApprovals(prev => [newApproval, ...prev]);
setSpendSubmitted(true); } };
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
try { extracted = await extractWithClaude(file); } catch (err) { console.error(`Claude extraction failed for ${file.name}:`, err); alert(`Extraction failed for ${file.name}: ${err.message}`); continue; }
const invNum = extracted.invoiceNumber || `INV-${Date.now()}`;
try {
const saved = await api.post('/api/invoices', {
  invoiceNumber: invNum,
  vendor: extracted.vendor || spend.vendor,
  date: extracted.date || new Date().toISOString().split('T')[0],
  dueDate: extracted.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  amount: extracted.amount || '0.00',
  taxAmount: extracted.taxAmount || '0.00',
  department: extracted.department || spend.department,
  description: extracted.description || `Invoice for ${spend.title}`,
  submittedBy: user.name,
  fileName: file.name,
  fileUrl: extracted?.fileUrl || null,
  supplierJson: extracted.supplier || null,
  customerJson: extracted.customer || null,
  currency: extracted.currency || spend.currency || '',
  lineItems: extracted.lineItems?.length > 0 ? extracted.lineItems : [],
});
// Link invoice to spend approval
const linked = await api.patch(`/api/invoices/${saved.id}/link`, { spendApprovalId: spend.id });
const newInvoice = { ...saved, ...linked, amount: String(saved.amount), taxAmount: String(saved.taxAmount), submittedDate: saved.createdAt || new Date().toISOString(), submittedBy: saved.submittedBy, spendApprovalTitle: spend.title, fileName: file.name, fileUrl: extracted?.fileUrl || saved.fileUrl, fileType: file.type };
newInvoices.push(newInvoice);
} catch (err) { console.error(`Failed to save invoice for ${file.name}:`, err); alert(`Failed to save invoice for ${file.name}: ${err.message}`); continue; }
}
setInvoices(prev => [...prev, ...newInvoices]);
setIsProcessing(false);
setProcessingProgress({ current: 0, total: 0 });
if (spendFileInputRef.current) { spendFileInputRef.current.value = ''; }
setSelectedSpend({...spend});
};
const uploadSpendAttachment = async (files, spend) => {
for (const file of Array.from(files)) {
try {
const dataUrl = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
const attachment = await api.post(`/api/spend-approvals/${spend.id}/attachments`, { fileName: file.name, fileType: file.type, fileUrl: dataUrl });
setSpendApprovals(prev => prev.map(s => s.id === spend.id ? { ...s, attachments: [attachment, ...(s.attachments || [])] } : s));
setSelectedSpend(prev => prev && prev.id === spend.id ? { ...prev, attachments: [attachment, ...(prev.attachments || [])] } : prev);
} catch (err) { console.error(`Failed to upload ${file.name}:`, err); alert(`Failed to upload ${file.name}: ${err.message}`); }
}
if (spendAttachInputRef.current) spendAttachInputRef.current.value = '';
};
const deleteSpendAttachment = async (spend, attachmentId) => {
try {
await api.delete(`/api/spend-approvals/${spend.id}/attachments/${attachmentId}`);
setSpendApprovals(prev => prev.map(s => s.id === spend.id ? { ...s, attachments: (s.attachments || []).filter(a => a.id !== attachmentId) } : s));
setSelectedSpend(prev => prev && prev.id === spend.id ? { ...prev, attachments: (prev.attachments || []).filter(a => a.id !== attachmentId) } : prev);
} catch (err) { alert('Failed to delete attachment: ' + err.message); }
};
const navBar = (<div className="bg-white rounded-lg shadow-lg p-6 mb-6"><div className={_fj}> <div className="flex items-center space-x-3"><DollarSign className="w-8 h-8 text-green-600"/><h1 className="text-2xl font-bold text-gray-800">Spend Approvals</h1></div>
<div className="flex items-center space-x-4"><div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 rounded-lg"><User className="w-5 h-5 text-indigo-600"/><div className="text-sm"><p className="font-semibold text-gray-800">{user.name}</p><p className="text-xs text-gray-600">{user.role}</p></div></div><button onClick={() => setCurrentPage('landing')} className="flex items-center space-x-2 px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200"><Home className="w-4 h-4"/><span>Dashboard</span></button>{hasPermission('reports.view') && <button onClick={() => setCurrentPage('reports')} className="flex items-center space-x-2 px-4 py-2 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200"><BarChart3 className="w-4 h-4"/><span>Reports</span></button>}<button onClick={logout} className="flex items-center space-x-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"><LogOut className="w-4 h-4"/><span>Logout</span></button></div>
</div></div>);
const saveSpendEdit = async () => { if (!editingSpend) return; try { const updated = await api.put(`/api/spend-approvals/${editingSpend.id}`, editingSpend); const approverName = updated.approver?.name || updated.approver; const merged = { ...updated, approver: approverName }; setSpendApprovals(prev => prev.map(s => s.id === merged.id ? { ...s, ...merged } : s)); setSelectedSpend(prev => prev ? { ...prev, ...merged } : prev); setEditingSpend(null); } catch (err) { alert('Failed to save: ' + (err.message || 'Unknown error')); } };
const getCeoUser = () => mockUsers.find(u => u.isCeo && u.status === 'Active');
const updateSpendStatus = async (id, status) => { const item = spendApprovals.find(s=>s.id===id);
if (status === 'Approved' && item.status === 'Pending') { const limit = user.approvalLimit || 0; const amt = toEur(item.amount, item.currency);
if (limit > 0 && amt > limit && !user.isCeo) { setShowEscalationModal(item); return false; }}
// Persist to backend
try {
if (status === 'Approved') { await api.patch(`/api/spend-approvals/${id}/approve`); }
else if (status === 'Rejected') { await api.patch(`/api/spend-approvals/${id}/reject`); }
} catch (err) { console.error(`Failed to ${status.toLowerCase()} spend:`, err); alert(`Failed to ${status.toLowerCase()}: ${err.message}`); return false; }
setSpendApprovals(prev => prev.map(s => s.id===id ? {...s, status, approvedBy:status==='Approved'||status==='Rejected'?user.name:s.approvedBy} : s));
if (status === 'Approved' && item.originInvoiceIds && item.originInvoiceIds.length > 0) { for (const oid of item.originInvoiceIds) { const originInv = invoices.find(i => i.id === oid); if (originInv && !originInv.spendApprovalId) { api.patch(`/api/invoices/${oid}/link`, { spendApprovalId: id }).then(() => { setInvoices(prev => prev.map(i => i.id === oid ? {...i, spendApprovalId: id, spendApprovalTitle: item.title} : i)); checkSpendThreshold(id, toEur(invoiceTotal(originInv), originInv.currency||item.currency)); }).catch(e => console.error('Failed to auto-link invoice on approval:', e)); } } }};
const confirmEscalation = () => { const item = showEscalationModal; if (!item) return; const ceo = getCeoUser();
setSpendApprovals(prev => prev.map(s => s.id===item.id ? {...s, status:'Escalated', approvedBy:user.name, escalatedTo:ceo?.name||'CEO', escalatedAt:new Date().toISOString()} : s));
const limit = user.approvalLimit || 0;
logAuditRemote('SPEND_ESCALATED', `"${item.title}" (€${toEur(item.amount, item.currency).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}) exceeds ${user.name}'s limit (€${limit.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}) - escalated to ${ceo?.name||'CEO'}`);
setShowEscalationModal(null); if (selectedSpend && selectedSpend.id === item.id) setSelectedSpend({...item, status:'Escalated', approvedBy:user.name, escalatedTo:ceo?.name||'CEO'}); };
const escalationModal = showEscalationModal && (() => { const esc = showEscalationModal; const limit = user.approvalLimit || 0; const ceo = getCeoUser(); return (
<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"><div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6">
<h3 className="text-xl font-bold text-gray-900 mb-3">Approval Limit Exceeded</h3>
<p className="text-gray-600 mb-4">This spend (<strong>{fmtEur(esc.amount, esc.currency)}</strong>) exceeds your approval limit (<strong>{fmtEur(limit, 'EUR')}</strong>). It will be routed to <strong>{ceo?.name || 'CEO'}</strong> for final approval.</p>
<div className="flex space-x-3"><button onClick={() => setShowEscalationModal(null)} className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">Cancel</button><button onClick={confirmEscalation} className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700">Continue</button></div></div></div>); })();
const bulkUpdateSpend = async (status) => { const items = spendApprovals.filter(s => selectedSpendIds.includes(s.id) && (s.status==='Pending'||s.status==='Escalated'));
const ids = items.map(item => item.id);
try {
if (status === 'Approved') { await api.post('/api/spend-approvals/bulk-approve', { ids }); }
else if (status === 'Rejected') { await api.post('/api/spend-approvals/bulk-reject', { ids }); }
setSpendApprovals(prev => prev.map(s => ids.includes(s.id) ? {...s, status, approvedBy: user.name} : s));
} catch (err) { console.error(`Bulk ${status.toLowerCase()} failed:`, err); alert(`Bulk ${status.toLowerCase()} failed: ${err.message}`); }
setSelectedSpendIds([]);};
if (spendSubmitted) { return (<div className={_pg}><div className="w-full max-w-4xl mx-auto">{navBar}
<div className="bg-white rounded-xl shadow-lg p-12 text-center"> <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4"/> <h2 className="text-2xl font-bold text-gray-800 mb-3">Request Submitted</h2> <p className="text-gray-500 mb-2">Your spend approval for <strong>{sf.title}</strong> has been submitted.</p> <p className="text-gray-500 mb-2">{fmtEur(sf.amount, sf.currency)} • Approver: {sf.approver}</p>{sf.currency !== 'EUR' && <p className="text-xs text-gray-400 mb-8">Original: {sf.currency} {Number(sf.amount).toLocaleString()}</p>} <div className="flex justify-center space-x-4">
<button onClick={() => { setSpendForm({ cc:'', title:'', currency:'', approver:'', approverId:null, amount:'', category:'', atom:'', vendor:'', costCentre:'', region:'', project:'', description:'', timeSensitive:false, inBudget:false, exceptional:'', justification:'', department:'', businessUnit:'', originInvoiceIds: [] }); setPendingAttachments([]); setPendingBudgetLineIds([]); setSpendLinkBudgetId(null); setSpendSubmitted(false); }} className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold">Create Another</button> <button onClick={() => { setSpendSubmitted(false); setSpendView('list'); }} className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-semibold">Back to Spend Approvals</button></div></div> </div></div>);}
if (selectedSpend) { const s = selectedSpend;
const sBadge2 = (status) => { const c = {Pending:'bg-yellow-100 text-yellow-800',Approved:'bg-green-100 text-green-800',Rejected:'bg-red-100 text-red-800',Escalated:'bg-orange-100 text-orange-800'}; return <span className={`px-3 py-1 rounded-full text-sm font-semibold ${c[status]||'bg-gray-100 text-gray-800'}`}>{status}</span>; };
const dRow = (label, val) => (<div className="py-3 border-b border-gray-100 grid grid-cols-3"><span className="text-sm font-medium text-gray-500">{label}</span><span className="text-sm text-gray-900 col-span-2">{val}</span></div>);
return (<div className={_pg}><div className="w-full">{navBar}
<div className="bg-white rounded-lg shadow p-4 mb-4"> <div className="flex items-center justify-between"> <div className="flex items-center space-x-3"> <button onClick={() => { setSelectedSpend(null); setEditingSpend(null); }} className="flex items-center space-x-1 text-indigo-600 hover:text-indigo-800 text-sm font-medium">← Back</button> <span className="text-gray-300">|</span> <h1 className="text-xl font-bold text-gray-800">{s.title}</h1> <span className="font-mono text-sm text-indigo-600 font-semibold">{s.ref}</span> {sBadge2(s.status)}</div> <div className="flex items-center space-x-2">
{(s.status === 'Pending' || s.status === 'Escalated') && canApproveSpend() && (s.status !== 'Escalated' || user.isCeo || hasPermission('settings.manage_users')) && (<> <button onClick={async () => { const result = await updateSpendStatus(s.id,'Approved'); if (result !== false) setSelectedSpend({...s,status:'Approved'}); }} className="px-4 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold text-sm">{s.status === 'Escalated' ? 'Final Approve' : 'Approve'}</button>
<button onClick={async () => { const result = await updateSpendStatus(s.id,'Rejected'); if (result !== false) setSelectedSpend({...s,status:'Rejected'}); }} className="px-4 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold text-sm">Reject</button></>)}
{canEditSpend() && !editingSpend && <button onClick={() => setEditingSpend({...s})} className="px-4 py-1.5 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 font-semibold text-sm flex items-center space-x-1"><Edit3 className="w-4 h-4"/><span>Edit</span></button>}
{editingSpend && (<><button onClick={saveSpendEdit} className="px-4 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold text-sm">Save</button><button onClick={() => setEditingSpend(null)} className="px-4 py-1.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-semibold text-sm">Cancel</button></>)}
<button onClick={async () => { if (!confirm(`Delete spend approval "${s.title}" (${s.ref})? This cannot be undone.`)) return; try { await api.delete(`/api/spend-approvals/${s.id}`); setSpendApprovals(prev => prev.filter(x => x.id !== s.id)); setBudgetLines(prev => prev.map(bl => bl.spendApprovalId === s.id ? {...bl, spendApprovalId: null, spendApproval: null} : bl)); api.get('/api/budget-report').then(d => setBudgetReport(d||[])).catch(() => {}); setSelectedSpend(null); } catch(err) { alert('Failed to delete: ' + err.message); }}} className="px-4 py-1.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-semibold text-sm flex items-center space-x-1"><Trash2 className="w-4 h-4"/><span>Delete</span></button></div></div></div>
<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

{/* Left column: Spend details */}
<div className="space-y-4">
<div className="bg-white rounded-lg shadow p-4"> <h2 className="text-lg font-bold text-gray-800 mb-3">Spend Details</h2> {(() => { const ed = editingSpend; const efc = "w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"; const upd = (k,v) => setEditingSpend(prev => ({...prev, [k]:v})); return (<div className="grid grid-cols-2 md:grid-cols-3 gap-4">
<div> <label className="text-xs text-gray-500">Requested Amount</label> {ed ? <input type="number" value={ed.amount} onChange={e => upd('amount',e.target.value)} className={efc}/> : <p className="text-lg font-bold text-green-600">{fmtEur(s.amount, s.currency)}{s.currency !== 'EUR' && <span className="text-xs text-gray-400 ml-1">({s.currency} {Number(s.amount).toLocaleString()})</span>}</p>}</div>
<div> <label className="text-xs text-gray-500">Vendor / Supplier</label> {ed ? <input value={ed.vendor} onChange={e => upd('vendor',e.target.value)} className={efc}/> : <p className="text-sm font-semibold text-gray-800">{s.vendor}</p>}</div>
<div> <label className="text-xs text-gray-500">Spend Category</label> {ed ? <select value={ed.category} onChange={e => upd('category',e.target.value)} className={efc}><option value="">Select...</option>{categories.filter(c=>c.active).map(c=>(<option key={c.id} value={c.name}>{c.name}</option>))}</select> : <p className="text-sm font-semibold text-gray-800">{s.category}</p>}</div>
<div> <label className="text-xs text-gray-500">Function / Department</label> {ed ? <select value={ed.department} onChange={e => { upd('department',e.target.value); const fn = functions.find(f=>f.name===e.target.value); if (fn) { upd('approver',fn.approver); upd('approverId',fn.approverId); } }} className={efc}><option value="">Select...</option>{functions.filter(f=>f.active).map(f=>(<option key={f.id} value={f.name}>{f.name}</option>))}</select> : <p className="text-sm font-semibold text-gray-800">{s.department || '—'}</p>}</div>
<div> <label className="text-xs text-gray-500">Business Unit</label> {ed ? <select value={ed.businessUnit||''} onChange={e => upd('businessUnit',e.target.value)} className={efc}><option value="">Select...</option>{businessUnits.filter(bu=>bu.active).map(bu=>(<option key={bu.id} value={bu.name}>{bu.name}</option>))}</select> : <p className="text-sm font-semibold text-gray-800">{s.businessUnit || '—'}</p>}</div>
<div> <label className="text-xs text-gray-500">Approver</label> <p className="text-sm font-semibold text-gray-800">{(ed ? ed.approver : s.approver) || '—'} {(() => { const au = mockUsers.find(u=>u.name===(ed ? ed.approver : s.approver)); return au && au.approvalLimit > 0 ? <span className="text-xs text-gray-400">(€{au.approvalLimit.toLocaleString()})</span> : au?.isCeo ? <span className="text-xs text-gray-400">(unlimited)</span> : null; })()}</p></div>
<div> <label className="text-xs text-gray-500">Atom</label> {ed ? <select value={ed.atom||''} onChange={e => upd('atom',e.target.value)} className={efc}><option value="">Select...</option>{atoms.filter(a=>a.active).map(a=>(<option key={a.id} value={a.code}>{a.code} — {a.name}</option>))}</select> : <p className="text-sm font-semibold text-gray-800">{(() => { const a = atoms.find(x=>x.code===s.atom); return a ? `${a.code} — ${a.name}` : s.atom; })()}</p>}</div>
<div> <label className="text-xs text-gray-500">Cost Centre</label> {ed ? <select value={ed.costCentre||''} onChange={e => upd('costCentre',e.target.value)} className={efc}><option value="">Select...</option>{costCentres.filter(c=>c.active).map(c=>(<option key={c.id} value={c.code}>{c.code} — {c.name}</option>))}</select> : <p className="text-sm font-semibold text-gray-800">{(() => { const c = costCentres.find(x=>x.code===s.costCentre); return c ? `${c.code} — ${c.name}` : s.costCentre; })()}</p>}</div>
<div> <label className="text-xs text-gray-500">Region</label> {ed ? <select value={ed.region||''} onChange={e => upd('region',e.target.value)} className={efc}><option value="">Select...</option>{regions.filter(r=>r.active).map(r=>(<option key={r.id} value={r.code}>{r.code} — {r.name}</option>))}</select> : <p className="text-sm font-semibold text-gray-800">{(() => { const r = regions.find(x=>x.code===s.region); return r ? `${r.code} — ${r.name}` : s.region||'—'; })()}</p>}</div>
<div> <label className="text-xs text-gray-500">Project</label> {ed ? <select value={ed.project||''} onChange={e => upd('project',e.target.value)} className={efc}><option value="">Select...</option>{projects.filter(p=>p.active).map(p=>(<option key={p.id} value={p.name}>{p.name}</option>))}</select> : <p className="text-sm font-semibold text-gray-800">{s.project || '—'}</p>}</div>
<div className="col-span-2 md:col-span-3"> <label className="text-xs text-gray-500">Description</label> {ed ? <textarea value={ed.description||''} onChange={e => upd('description',e.target.value)} rows={2} className={efc + " resize-none"}/> : <p className="text-sm text-gray-800">{s.description || '—'}</p>}</div>
<div> <label className="text-xs text-gray-500">In Budget</label> {ed ? <label className="flex items-center space-x-2 cursor-pointer mt-1"><input type="checkbox" checked={ed.inBudget||false} onChange={e => upd('inBudget',e.target.checked)} className="w-4 h-4 text-green-600 rounded"/><span className="text-sm text-gray-700">{ed.inBudget ? 'Yes' : 'No'}</span></label> : <p className="text-sm">{s.inBudget ? <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded font-semibold">Yes</span> : <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded font-semibold">No</span>}</p>}</div>
<div> <label className="text-xs text-gray-500">Exceptional Item</label> {ed ? <div className="flex items-center gap-3 mt-1"><label className="flex items-center space-x-1 cursor-pointer"><input type="radio" name="editExceptional" value="Yes" checked={ed.exceptional==='Yes'} onChange={e => upd('exceptional',e.target.value)} className="w-4 h-4 text-green-600"/><span className="text-sm text-gray-700">Yes</span></label><label className="flex items-center space-x-1 cursor-pointer"><input type="radio" name="editExceptional" value="No" checked={ed.exceptional==='No'} onChange={e => upd('exceptional',e.target.value)} className="w-4 h-4 text-green-600"/><span className="text-sm text-gray-700">No</span></label></div> : <p className="text-sm font-semibold text-gray-800">{s.exceptional}</p>}</div>
<div> <label className="text-xs text-gray-500">Time-sensitive</label> {ed ? <label className="flex items-center space-x-2 cursor-pointer mt-1"><input type="checkbox" checked={ed.timeSensitive||false} onChange={e => upd('timeSensitive',e.target.checked)} className="w-4 h-4 text-orange-600 rounded"/><span className="text-sm text-gray-700">{ed.timeSensitive ? 'Yes - Urgent' : 'No'}</span></label> : <p className="text-sm">{s.timeSensitive ? <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded font-semibold">Yes - Urgent</span> : 'No'}</p>}</div>
<div> <label className="text-xs text-gray-500">Submitted</label> <p className="text-sm text-gray-800">{s.submittedBy} — {new Date(s.submittedAt).toLocaleDateString('en-GB', {day:'numeric',month:'short',year:'numeric'})}</p></div>
{s.originInvoiceIds && s.originInvoiceIds.length > 0 && (() => { const originInvs = s.originInvoiceIds.map(oid => invoices.find(i => i.id === oid)).filter(Boolean); return originInvs.length > 0 ? <div> <label className="text-xs text-gray-500">Origin Invoice{originInvs.length > 1 ? 's' : ''}</label> {originInvs.map(inv => <p key={inv.id} className="text-sm font-medium text-indigo-600">{inv.invoiceNumber} — {inv.vendor}</p>)}</div> : null; })()}
</div>); })()}
{(s.justification || editingSpend) && (<div className="mt-3 pt-3 border-t border-gray-100"> <label className="text-xs text-gray-500">Business Justification</label> {editingSpend ? <textarea value={editingSpend.justification||''} onChange={e => setEditingSpend(prev => ({...prev, justification:e.target.value}))} rows={4} className="w-full mt-1 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"/> : <p className="text-sm text-gray-800 mt-1">{s.justification}</p>}</div>)}</div>

{s.status === 'Escalated' && (<div className="p-3 bg-orange-50 border border-orange-200 rounded-lg"><p className="text-sm text-orange-800"><strong>Escalated:</strong> Approved by {s.approvedBy} but exceeds their limit. Awaiting {s.escalatedTo||'CEO'} approval.</p></div>)}

</div>

{/* Right column: Budget Lines + Linked Invoices + Upload */}
<div className="space-y-4">
{s.inBudget && (<div className="bg-white rounded-lg shadow p-4"> <h2 className="text-lg font-bold text-gray-800 mb-3">Linked Budget Lines</h2>
{(() => { const linkedBl = budgetLines.filter(bl => bl.spendApprovalId === s.id); const totalBudgetEur = linkedBl.reduce((sum,bl) => sum + (parseFloat(bl.eurAnnual)||0), 0); return (<>
{linkedBl.length > 0 ? (<>
<div className="mb-3 text-sm text-gray-600">Total Budget: <strong>€{totalBudgetEur.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</strong> across {linkedBl.length} line{linkedBl.length>1?'s':''}</div>
<div className="space-y-2">{linkedBl.map(bl => (<div key={bl.id} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200"><div><span className="font-medium text-gray-800">{bl.licence}</span><span className="text-sm text-gray-500 ml-2">{bl.vendor||'—'} • €{(parseFloat(bl.eurAnnual)||0).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}/yr</span></div>
<button onClick={async () => { try { await api.patch(`/api/budget-lines/${bl.id}/unlink`); setBudgetLines(prev => prev.map(b => b.id===bl.id ? {...b, spendApprovalId:null} : b)); setSelectedSpend({...s}); } catch(err) { alert('Failed to unlink: '+err.message); }}} className="text-xs text-red-500 hover:text-red-700 font-semibold">Unlink</button></div>))}</div>
</>) : <p className="text-sm text-gray-500">No budget lines linked yet.</p>}
{(() => { const linkedCount = budgetLines.filter(bl => bl.spendApprovalId === s.id).length;
const submittedBudgets = budgets.filter(b => b.status === 'Submitted');
if (submittedBudgets.length === 0) return null;
return (<div className="mt-3 pt-3 border-t border-gray-200"><label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Link Budget Line</label>
<select key={`budget-select-${linkedCount}`} value={spendLinkBudgetId || ''} onChange={e => { setSpendLinkBudgetId(e.target.value ? Number(e.target.value) : null); setSpendLinkBlSearch(''); }} className={`w-full mb-2 ${_g}`}><option value="">Select a budget...</option>{submittedBudgets.map(b => (<option key={b.id} value={b.id}>{b.title} — {b.function?.name || ''} ({b.year})</option>))}</select>
{spendLinkBudgetId && (() => { const unlinkedBl = budgetLines.filter(bl => bl.budgetId === spendLinkBudgetId && !bl.spendApprovalId);
const filtered = spendLinkBlSearch ? unlinkedBl.filter(bl => { const q = spendLinkBlSearch.toLowerCase(); return (bl.licence||'').toLowerCase().includes(q) || (bl.vendor||'').toLowerCase().includes(q) || (bl.costCentre||'').toLowerCase().includes(q) || (bl.project||'').toLowerCase().includes(q) || (bl.businessUnit||'').toLowerCase().includes(q) || (bl.region||'').toLowerCase().includes(q); }) : unlinkedBl;
const scoreBl = (bl) => { let sc = 0; if (s.vendor && bl.vendor && bl.vendor.toLowerCase().includes(s.vendor.toLowerCase())) sc += 3; if (s.region && bl.region && bl.region.toLowerCase() === s.region.toLowerCase()) sc += 2; if (s.costCentre && bl.costCentre && bl.costCentre.toLowerCase() === s.costCentre.toLowerCase()) sc += 2; if (s.businessUnit && bl.businessUnit && bl.businessUnit.toLowerCase() === s.businessUnit.toLowerCase()) sc += 2; return sc; };
const sorted = [...filtered].sort((a,b) => scoreBl(b) - scoreBl(a));
return unlinkedBl.length > 0 ? (<div>
<div className="relative mb-2"><Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2"/><input value={spendLinkBlSearch} onChange={e => setSpendLinkBlSearch(e.target.value)} placeholder="Search budget lines..." className={`w-full pl-9 ${_g}`}/></div>
<div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
{sorted.length > 0 ? sorted.map(bl => { const sc = scoreBl(bl); return (<div key={bl.id} className={`flex items-center justify-between px-3 py-2 cursor-pointer ${sc > 0 ? 'bg-green-50 hover:bg-green-100 border-l-4 border-green-400' : 'hover:bg-indigo-50'}`} onClick={async () => { try { await api.patch(`/api/budget-lines/${bl.id}/link`, { spendApprovalId: s.id }); setBudgetLines(prev => prev.map(b => b.id===bl.id ? {...b, spendApprovalId: s.id} : b)); setSpendLinkBlSearch(''); } catch(err) { alert('Failed to link: '+err.message); } }}>
<div className="flex items-center gap-2"><div><span className="text-sm font-medium text-gray-800">{bl.licence}</span><span className="text-xs text-gray-500 ml-2">{bl.vendor||'—'} • {bl.costCentre||'—'} • {bl.region||'—'} • {bl.businessUnit||'—'}</span></div>{sc > 0 && <span className="px-1.5 py-0.5 bg-green-200 text-green-800 text-[10px] font-bold rounded uppercase whitespace-nowrap">Recommended</span>}</div>
<span className="text-xs font-semibold text-gray-600">€{(parseFloat(bl.eurAnnual)||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
</div>); }) : <p className="px-3 py-2 text-sm text-gray-500">No matching budget lines.</p>}
</div></div>) : <p className="text-sm text-gray-500">No unlinked budget lines in this budget.</p>; })()}
</div>); })()}
</>); })()}
</div>)}
<div className="bg-white rounded-lg shadow p-4"> <h2 className="text-lg font-bold text-gray-800 mb-3">Linked Invoices</h2>
{(() => { const linked = getLinkedInvoices(s.id); const totalInvoicedEur = linked.reduce((sum,i) => sum + toEur(invoiceTotal(i), i.currency||s.currency), 0); const approvedEur = toEur(parseFloat(s.amount)||0, s.currency); const remainingEur = approvedEur - totalInvoicedEur; return (<> {linked.length > 0 ? (<>
<div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm"><span className="text-gray-600">Approved: <strong>{fmtEur(s.amount, s.currency)}</strong></span><span className="text-gray-600">Invoiced: <strong>€{totalInvoicedEur.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</strong></span><span className={remainingEur < 0 ? 'text-red-600 font-semibold' : 'text-green-600 font-semibold'}>Remaining: €{remainingEur.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span></div>
<div className="w-full bg-gray-200 rounded-full h-2 mb-3"><div className={`h-2 rounded-full ${remainingEur < 0 ? 'bg-red-500' : 'bg-green-500'}`} style={{width:`${Math.min(100,totalInvoicedEur/approvedEur*100)}%`}}></div></div>
<div className="space-y-2">{linked.map(inv => (<div key={inv.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border"><div><span className="font-medium text-gray-800">{inv.invoiceNumber}</span><span className="text-sm text-gray-500 ml-2">{inv.vendor} • {currencySymbol(inv.currency)}{invoiceTotal(inv).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}{inv.currency !== 'EUR' && ` (€${toEur(invoiceTotal(inv), inv.currency).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})})`}</span></div></div>))}</div>
</>) : <p className="text-sm text-gray-500">No invoices linked yet.</p>} </>); })()}
{s.status === 'Approved' && canAssignInvoices() && (() => { const isRestricted = !hasPermission('invoices.assign_all'); if (isRestricted && s.submittedBy !== user.name) return null; const unlinkedInvs = invoices.filter(i => !i.spendApprovalId && (!isRestricted || i.submittedBy === user.name)); return unlinkedInvs.length > 0 ? (<div className="mt-4 pt-3 border-t border-gray-200"><label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Assign Invoice</label><select defaultValue="" onChange={e => { if (e.target.value) { const invId = Number(e.target.value); acceptMatch(invId, s.id); const inv = invoices.find(i=>i.id===invId); setSelectedSpend({...s}); } }} className={`w-full ${_g}`}><option value="" disabled>Select an unlinked invoice...</option>{unlinkedInvs.map(i => (<option key={i.id} value={i.id}>{i.invoiceNumber} — {i.vendor} (${i.amount})</option>))}</select></div>) : null; })()}
{s.status === 'Approved' && canAssignInvoices() && (<div className="mt-4 pt-3 border-t border-gray-200">
<input type="file" ref={spendFileInputRef} accept="application/pdf,image/*" multiple className="hidden" onChange={e => { if (e.target.files.length > 0) uploadInvoiceToSpend(e.target.files, s); }}/>
<button onClick={() => spendFileInputRef.current && spendFileInputRef.current.click()} disabled={isProcessing} className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed">
<Upload className="w-4 h-4"/><span>{isProcessing ? `Processing ${processingProgress.current} of ${processingProgress.total}...` : 'Upload Invoice'}</span>
{isProcessing && <svg className="animate-spin w-4 h-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
</button></div>)}
</div>

<div className="bg-white rounded-lg shadow p-4"> <h2 className="text-lg font-bold text-gray-800 mb-3">Attachments</h2>
{(s.attachments && s.attachments.length > 0) ? (<div className="space-y-2">{s.attachments.map(att => (<div key={att.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
<div className="flex items-center space-x-3"><FileText className="w-5 h-5 text-indigo-600 flex-shrink-0"/><div><p className="text-sm font-medium text-gray-800">{att.fileName}</p><p className="text-xs text-gray-500">{att.uploadedBy} — {new Date(att.uploadedAt).toLocaleDateString('en-GB', {day:'numeric',month:'short',year:'numeric'})}</p></div></div>
<div className="flex items-center space-x-2"><a href={att.fileUrl} download={att.fileName} className="text-indigo-600 hover:text-indigo-800"><Download className="w-4 h-4"/></a>
<button onClick={() => deleteSpendAttachment(s, att.id)} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4"/></button></div>
</div>))}</div>) : <p className="text-sm text-gray-500">No attachments yet.</p>}
<div className="mt-3">
<input type="file" ref={spendAttachInputRef} multiple className="hidden" onChange={e => { if (e.target.files.length > 0) uploadSpendAttachment(e.target.files, s); }}/>
<button onClick={() => spendAttachInputRef.current && spendAttachInputRef.current.click()} className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-semibold text-sm">
<Upload className="w-4 h-4"/><span>Add Attachment</span></button>
</div></div>
</div>

</div> </div>{escalationModal}</div>);}
if (spendView === 'form') { return (<div className={_pg}><div className="w-full">{navBar}
<div className="bg-white rounded-lg shadow p-4 mb-4"> <div className="flex items-center justify-between"> <div className="flex items-center space-x-3"> <button onClick={() => setSpendView('list')} className="flex items-center space-x-1 text-indigo-600 hover:text-indigo-800 text-sm font-medium">← Back</button> <span className="text-gray-300">|</span> <h1 className="text-xl font-bold text-gray-800">New Spend Approval</h1> <span className="text-xs text-gray-500">Required fields marked <span className="text-red-500">*</span></span></div> <div className="flex items-center space-x-2"><button onClick={submitSpend} className="px-5 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold text-sm">Submit</button><button onClick={() => setSpendView('list')} className="px-4 py-1.5 text-gray-600 hover:text-gray-800 font-semibold text-sm">Cancel</button></div></div></div>
<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

{/* Left column: form fields */}
<div className="bg-white rounded-lg shadow p-4">
<div className="grid grid-cols-2 md:grid-cols-3 gap-4">
<div><label className={slc}>Function / Dept {req}</label><select value={sf.department} onChange={e => { const fn = functions.find(f=>f.name===e.target.value); updateSpend('department',e.target.value); if (fn) { updateSpend('approver',fn.approver); updateSpend('approverId',fn.approverId); } }} className={sfc}><option value="">Select...</option>{functions.filter(f=>f.active).map(f=>(<option key={f.id} value={f.name}>{f.name}</option>))}</select></div>
<div><label className={slc}>Business Unit</label><select value={sf.businessUnit} onChange={e => updateSpend('businessUnit',e.target.value)} className={sfc}><option value="">Select...</option>{businessUnits.filter(bu=>bu.active).map(bu=>(<option key={bu.id} value={bu.name}>{bu.name}</option>))}</select></div>
<div className="col-span-2"><label className={slc}>Request Title {req}</label><input value={sf.title} onChange={e => updateSpend('title',e.target.value)} className={sfc}/></div>
<div><label className={slc}>Currency {req}</label><select value={sf.currency} onChange={e => updateSpend('currency',e.target.value)} className={sfc}><option value="">Select...</option>{currencies.filter(c=>c.active).map(c=>(<option key={c.id} value={c.code}>{c.code} — {c.name}</option>))}</select></div>
<div><label className={slc}>Amount {req}</label><input type="number" value={sf.amount} onChange={e => updateSpend('amount',e.target.value)} className={sfc}/></div>
<div><label className={slc}>Approver {req}</label><input value={sf.approver} readOnly className={sfc + " bg-gray-50 cursor-not-allowed"}/></div>
<div><label className={slc}>Vendor / Supplier {req}</label><input value={sf.vendor} onChange={e => updateSpend('vendor',e.target.value)} className={sfc}/></div>
<div><label className={slc}>Category {req}</label><select value={sf.category} onChange={e => updateSpend('category',e.target.value)} className={sfc}><option value="">Select...</option>{categories.filter(c=>c.active).map(c=>(<option key={c.id} value={c.name}>{c.name}</option>))}</select></div>
<div><label className={slc}>Atom {req}</label><select value={sf.atom} onChange={e => updateSpend('atom',e.target.value)} className={sfc}><option value="">Select...</option>{atoms.filter(a=>a.active).map(a=>(<option key={a.id} value={a.code}>{a.code} — {a.name}</option>))}</select></div>
<div><label className={slc}>Cost Centre {req}</label><select value={sf.costCentre} onChange={e => updateSpend('costCentre',e.target.value)} className={sfc}><option value="">Select...</option>{costCentres.filter(c=>c.active).map(c=>(<option key={c.id} value={c.code}>{c.code} — {c.name}</option>))}</select></div>
<div><label className={slc}>Region {req}</label><select value={sf.region} onChange={e => updateSpend('region',e.target.value)} className={sfc}><option value="">Select...</option>{regions.filter(r=>r.active).map(r=>(<option key={r.id} value={r.code}>{r.code} — {r.name}</option>))}</select></div>
<div><label className={slc}>Project</label><select value={sf.project} onChange={e => updateSpend('project',e.target.value)} className={sfc}><option value="">Select...</option>{projects.filter(p=>p.active).map(p=>(<option key={p.id} value={p.name}>{p.name}</option>))}</select></div>
<div><label className={slc}>CC (notify)</label><input value={sf.cc} onChange={e => updateSpend('cc',e.target.value)} placeholder="email@..." className={sfc}/></div>
<div className="col-span-2 md:col-span-3"><label className={slc}>Description</label><textarea value={sf.description} onChange={e => updateSpend('description',e.target.value)} rows={2} placeholder="Brief description of the spend..." className={sfc + " resize-none"}/></div>
<div className="flex items-center gap-4"><label className="flex items-center space-x-2 cursor-pointer"><input type="checkbox" checked={sf.inBudget} onChange={e => updateSpend('inBudget',e.target.checked)} className="w-4 h-4 text-green-600 rounded"/><span className="text-sm text-gray-700">In Budget</span></label><label className="flex items-center space-x-2 cursor-pointer"><input type="checkbox" checked={sf.timeSensitive} onChange={e => updateSpend('timeSensitive',e.target.checked)} className="w-4 h-4 text-green-600 rounded"/><span className="text-sm text-gray-700">Time-sensitive</span></label></div>
<div className="col-span-2"><label className={slc}>Exceptional Item? {req}</label><div className="flex items-center gap-4"><label className="flex items-center space-x-1 cursor-pointer"><input type="radio" name="exceptional" value="Yes" checked={sf.exceptional==='Yes'} onChange={e => updateSpend('exceptional',e.target.value)} className="w-4 h-4 text-green-600"/><span className="text-sm text-gray-700">Yes</span></label><label className="flex items-center space-x-1 cursor-pointer"><input type="radio" name="exceptional" value="No" checked={sf.exceptional==='No'} onChange={e => updateSpend('exceptional',e.target.value)} className="w-4 h-4 text-green-600"/><span className="text-sm text-gray-700">No</span></label></div></div>
</div>
<div className="mt-4"><label className={slc}>Business Justification {req}</label><textarea value={sf.justification} onChange={e => updateSpend('justification',e.target.value)} rows={6} placeholder="Business justification..." className={sfc + " resize-none"}/></div>
</div>

{/* Right column: linked invoices + budget lines + attachments */}
<div className="space-y-4">
{sf.originInvoiceIds && sf.originInvoiceIds.length > 0 && (() => { const originInvs = sf.originInvoiceIds.map(oid => invoices.find(i => i.id === oid)).filter(Boolean); if (originInvs.length === 0) return null; const totalInvoicedEur = originInvs.reduce((sum,i) => sum + toEur(invoiceTotal(i), i.currency||sf.currency), 0); const approvedEur = toEur(parseFloat(sf.amount)||0, sf.currency); const remainingEur = approvedEur - totalInvoicedEur; return (<div className="bg-white rounded-lg shadow p-4"> <h2 className="text-lg font-bold text-gray-800 mb-3">Linked Invoices</h2>
<div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm"><span className="text-gray-600">Amount: <strong>{fmtEur(sf.amount, sf.currency)}</strong></span><span className="text-gray-600">Invoiced: <strong>€{totalInvoicedEur.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</strong></span><span className={remainingEur < 0 ? 'text-red-600 font-semibold' : 'text-green-600 font-semibold'}>Remaining: €{remainingEur.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span></div>
<div className="w-full bg-gray-200 rounded-full h-2 mb-3"><div className={`h-2 rounded-full ${remainingEur < 0 ? 'bg-red-500' : 'bg-green-500'}`} style={{width:`${Math.min(100,totalInvoicedEur/approvedEur*100)}%`}}></div></div>
<div className="space-y-2">{originInvs.map(inv => (<div key={inv.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border"><div><span className="font-medium text-gray-800">{inv.invoiceNumber}</span><span className="text-sm text-gray-500 ml-2">{inv.vendor} • {currencySymbol(inv.currency)}{invoiceTotal(inv).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}{inv.currency !== 'EUR' && ` (€${toEur(invoiceTotal(inv), inv.currency).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})})`}</span></div>
<button onClick={() => { setSpendForm(prev => ({...prev, originInvoiceIds: prev.originInvoiceIds.filter(id => id !== inv.id)})); setSelectedInvoiceIds(prev => prev.filter(id => id !== inv.id)); }} className="text-red-500 hover:text-red-700 text-xs font-semibold">Remove</button></div>))}</div>
<p className="mt-2 text-xs text-gray-500">{originInvs.length === 1 ? 'Invoice' : 'Invoices'} will be linked automatically on submission.</p>
</div>); })()}
{sf.inBudget && (<div className="bg-white rounded-lg shadow p-4">
<label className={slc}>Link Budget Lines</label>
<select value={spendLinkBudgetId || ''} onChange={e => { setSpendLinkBudgetId(e.target.value ? Number(e.target.value) : null); setSpendLinkBlSearch(''); }} className={`w-full mb-2 ${sfc}`}><option value="">Select a budget...</option>{budgets.filter(b => b.status === 'Submitted').map(b => (<option key={b.id} value={b.id}>{b.title} — {b.function?.name || ''} ({b.year})</option>))}</select>
{spendLinkBudgetId && (() => { const unlinkedBl = budgetLines.filter(bl => bl.budgetId === spendLinkBudgetId && !bl.spendApprovalId && !pendingBudgetLineIds.includes(bl.id));
const filtered = spendLinkBlSearch ? unlinkedBl.filter(bl => { const q = spendLinkBlSearch.toLowerCase(); return (bl.licence||'').toLowerCase().includes(q) || (bl.vendor||'').toLowerCase().includes(q) || (bl.costCentre||'').toLowerCase().includes(q) || (bl.project||'').toLowerCase().includes(q) || (bl.businessUnit||'').toLowerCase().includes(q) || (bl.region||'').toLowerCase().includes(q); }) : unlinkedBl;
const scoreBl = (bl) => { let sc = 0; if (sf.vendor && bl.vendor && bl.vendor.toLowerCase().includes(sf.vendor.toLowerCase())) sc += 3; if (sf.region && bl.region && bl.region.toLowerCase() === sf.region.toLowerCase()) sc += 2; if (sf.costCentre && bl.costCentre && bl.costCentre.toLowerCase() === sf.costCentre.toLowerCase()) sc += 2; if (sf.businessUnit && bl.businessUnit && bl.businessUnit.toLowerCase() === sf.businessUnit.toLowerCase()) sc += 2; return sc; };
const sorted = [...filtered].sort((a,b) => scoreBl(b) - scoreBl(a));
return unlinkedBl.length > 0 ? (<div>
<div className="relative mb-2"><Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2"/><input value={spendLinkBlSearch} onChange={e => setSpendLinkBlSearch(e.target.value)} placeholder="Search budget lines..." className={`w-full pl-9 ${sfc}`}/></div>
<div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
{sorted.length > 0 ? sorted.map(bl => { const sc = scoreBl(bl); return (<div key={bl.id} className={`flex items-center justify-between px-3 py-2 cursor-pointer ${sc > 0 ? 'bg-green-50 hover:bg-green-100 border-l-4 border-green-400' : 'hover:bg-green-50'}`} onClick={() => { setPendingBudgetLineIds(prev => [...prev, bl.id]); setSpendLinkBlSearch(''); }}>
<div className="flex items-center gap-2"><div><span className="text-sm font-medium text-gray-800">{bl.licence}</span><span className="text-xs text-gray-500 ml-2">{bl.vendor||'—'} • {bl.costCentre||'—'} • {bl.region||'—'} • {bl.businessUnit||'—'}</span></div>{sc > 0 && <span className="px-1.5 py-0.5 bg-green-200 text-green-800 text-[10px] font-bold rounded uppercase whitespace-nowrap">Recommended</span>}</div>
<span className="text-xs font-semibold text-gray-600">€{(parseFloat(bl.eurAnnual)||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
</div>); }) : <p className="px-3 py-2 text-sm text-gray-500">No matching budget lines.</p>}
</div></div>) : <p className="text-sm text-gray-500 mt-1">No unlinked budget lines in this budget.</p>; })()}
{pendingBudgetLineIds.length > 0 && (<div className="mt-3 space-y-1">
<label className="text-xs font-semibold text-gray-500 uppercase">Selected ({pendingBudgetLineIds.length})</label>
{pendingBudgetLineIds.map(blId => { const bl = budgetLines.find(b => b.id === blId); return bl ? (<div key={bl.id} className="flex items-center justify-between p-2 bg-blue-50 rounded-lg border border-blue-200">
<div><span className="text-sm font-medium text-gray-800">{bl.licence}</span><span className="text-xs text-gray-500 ml-2">{bl.vendor||'—'} • €{(parseFloat(bl.eurAnnual)||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}/yr</span></div>
<button onClick={() => setPendingBudgetLineIds(prev => prev.filter(id => id !== blId))} className="text-red-500 hover:text-red-700"><X className="w-4 h-4"/></button>
</div>) : null; })}
</div>)}
</div>)}
<div className="bg-white rounded-lg shadow p-4"><label className={slc}>Attachments</label>
<input type="file" ref={spendFormAttachRef} multiple className="hidden" onChange={async e => { const files = Array.from(e.target.files); for (const f of files) { const dataUrl = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); }); setPendingAttachments(prev => [...prev, { name: f.name, type: f.type, dataUrl }]); } e.target.value = ''; }}/>
<div onClick={() => spendFormAttachRef.current && spendFormAttachRef.current.click()} className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-green-400 transition"><Upload className="w-6 h-6 text-gray-400 mx-auto mb-1"/><p className="text-sm text-gray-500">Drop files or <span className="text-green-600 font-semibold">browse</span></p></div>
{pendingAttachments.length > 0 && (<div className="mt-2 space-y-1">{pendingAttachments.map((pa, i) => (<div key={i} className="flex items-center justify-between p-2 bg-gray-50 rounded border text-sm"><div className="flex items-center space-x-2"><FileText className="w-4 h-4 text-indigo-600"/><span className="text-gray-800 truncate">{pa.name}</span></div><button onClick={() => setPendingAttachments(prev => prev.filter((_, j) => j !== i))} className="text-red-500 hover:text-red-700"><X className="w-4 h-4"/></button></div>))}</div>)}</div>
</div>

</div> </div></div>);}
const sBadge = (status) => { const c = {Pending:'bg-yellow-100 text-yellow-800',Approved:'bg-green-100 text-green-800',Rejected:'bg-red-100 text-red-800',Escalated:'bg-orange-100 text-orange-800'}; return <span className={`px-2 py-1 rounded-full text-xs font-semibold ${c[status]||'bg-gray-100 text-gray-800'}`}>{status}</span>; };
const pendingFiltered = filteredSpends.filter(s => s.status === 'Pending');
const allPendingSelected = pendingFiltered.length > 0 && pendingFiltered.every(s => selectedSpendIds.includes(s.id));
const toggleSpendSelect = (id) => setSelectedSpendIds(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev,id]);
const toggleAllSpend = () => { if (allPendingSelected) { setSelectedSpendIds([]); } else { setSelectedSpendIds(pendingFiltered.map(s=>s.id)); } };
return (<div className={_pg}><div className="w-full">{navBar}
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
{Object.entries({ref:'Reference',title:'Title',vendor:'Vendor',amount:'Amount',invoiced:'Invoiced',category:'Category',department:'Function',businessUnit:'Business Unit',project:'Project',submittedBy:'Submitted By',date:'Date',status:'Status',approver:'Approver',region:'Region',costCentre:'Cost Centre',atom:'Atom'}).map(([k,label])=>(<label key={k} className="flex items-center space-x-2 cursor-pointer"><input type="checkbox" checked={spendVisibleCols[k]} onChange={() => toggleSpendCol(k)} className="w-4 h-4 text-green-600 rounded"/><span className="text-sm text-gray-700">{label}</span></label>))} </div></div>)}</div></div></div>
<div className={_fj+" mb-4"}> <span className="text-sm text-gray-500">{filteredSpends.length} of {spendApprovals.length} requests</span> <div className="flex items-center space-x-3">
{canCreateSpend() && <button onClick={() => { setSpendForm({ cc:'', title:'', currency:'', approver:'', approverId:null, amount:'', category:'', atom:'', vendor:'', costCentre:'', region:'', project:'', description:'', timeSensitive:false, inBudget:false, exceptional:'', justification:'', department:'', businessUnit:'', originInvoiceIds: [] }); setSpendView('form'); }} className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold text-sm"><DollarSign className="w-4 h-4"/><span>Create Spend Approval</span></button>}
{canAssignInvoices() && <button onClick={runAutoMatch} className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-semibold text-sm"><ExternalLink className="w-4 h-4"/><span>Match Invoices</span></button>}
{canManageBudgets() && <button onClick={runBudgetMatch} className="flex items-center space-x-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition font-semibold text-sm"><Wallet className="w-4 h-4"/><span>Match Budget Items</span></button>}
{canCreateSpend() && <><input ref={spendBulkFileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleSpendBulkFile} className="hidden" id="spend-bulk-upload"/>
<label htmlFor="spend-bulk-upload" className="flex items-center space-x-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-semibold cursor-pointer text-sm"><Upload className="w-4 h-4"/><span>Import XLSX</span></label></>}
</div></div>
{/* Spend Bulk Import - Sheet */}
{spendBulk.step === 'sheet' && (<div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
<div className={_fj+" mb-4"}><h3 className="text-xl font-semibold text-gray-800">Select Sheet — {spendBulk.fileName}</h3>
<button onClick={() => setSpendBulk({ rows: [], fileName: '', mappings: null, step: null })} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm font-medium">Cancel</button>
</div>
<p className="text-sm text-gray-600 mb-4">This workbook has multiple sheets. Select which sheet to import from.</p>
<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
{spendBulk.sheetNames.map(name => (<button key={name} onClick={() => selectSpendBulkSheet(spendBulk.workbook, name, spendBulk.fileName)} className="px-4 py-3 bg-white border-2 border-green-200 rounded-lg hover:border-green-500 hover:bg-green-50 text-sm font-medium text-gray-800 transition text-left"><FileSpreadsheet className="w-4 h-4 text-green-600 inline mr-2"/>{name}</button>))}
</div>
</div>)}
{/* Spend Bulk Import - Map */}
{spendBulk.step === 'map' && (<div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
<div className={_fj+" mb-4"}><h3 className="text-xl font-semibold text-gray-800">Map Columns — {spendBulk.fileName}{spendBulk.selectedSheet ? ` — ${spendBulk.selectedSheet}` : ''}</h3>
<div className="flex space-x-3">
{spendBulk.sheetNames?.length > 1 && <button onClick={() => setSpendBulk(prev => ({ ...prev, step: 'sheet' }))} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm font-medium">Back to Sheets</button>}
<button onClick={() => setSpendBulk({ rows: [], fileName: '', mappings: null, step: null })} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm font-medium">Cancel</button>
<button onClick={spendBulkPreview} className="px-5 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-semibold">Preview Import</button>
</div></div>
<p className="text-sm text-gray-600 mb-4">Map your spreadsheet columns to spend approval fields. We auto-detected what we could.</p>
<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
{spendBulk.targetFields.map(f => (<div key={f}>
<label className="block text-xs font-semibold text-gray-600 mb-1">{spendBulk.fieldLabels[f]}</label>
<select value={spendBulk.mappings?.[f] || ''} onChange={e => setSpendBulkMapping(f, e.target.value)} className={`w-full text-sm ${_i}`}>
<option value="">— skip —</option>
{spendBulk.headers.map(h => (<option key={h} value={h}>{h}</option>))}
</select>
</div>))}
</div>
<p className="text-xs text-gray-500 mt-3">{spendBulk.rows.length} row(s) found in spreadsheet</p>
</div>)}
{/* Spend Bulk Import - Preview */}
{spendBulk.step === 'preview' && (() => { const previewRows = getSpendMappedRows();
const existingRefs = new Set(spendApprovals.map(s => s.ref));
const seenRefs = new Set();
const flagged = previewRows.map(row => {
  const isDup = row.ref && (existingRefs.has(row.ref) || seenRefs.has(row.ref));
  if (row.ref) seenRefs.add(row.ref);
  return { ...row, _duplicate: isDup };
});
const dupCount = flagged.filter(r => r._duplicate).length;
const newCount = flagged.length - dupCount;
return (<div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
<div className={_fj+" mb-4"}><h3 className="text-xl font-semibold text-gray-800">Preview Import — {previewRows.length} spend approval(s)</h3>
<div className="flex space-x-3">
<button onClick={() => setSpendBulk(prev => ({ ...prev, step: 'map' }))} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm font-medium">Back</button>
<button onClick={() => setSpendBulk({ rows: [], fileName: '', mappings: null, step: null })} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm font-medium">Cancel</button>
<button onClick={confirmSpendBulkImport} disabled={isProcessing || newCount === 0} className="px-5 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-semibold disabled:opacity-50 flex items-center space-x-2">
<CheckCircle className="w-4 h-4"/><span>{isProcessing ? 'Importing...' : `Import ${newCount} Spend Approval${newCount !== 1 ? 's' : ''}`}</span></button>
</div></div>
{dupCount > 0 && (<div className="flex items-center space-x-2 mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg"><AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0"/><p className="text-sm text-amber-800"><strong>{dupCount}</strong> duplicate(s) found (matching reference) — these will be skipped.</p></div>)}
<div className="overflow-x-auto max-h-80 overflow-y-auto"><table className="w-full text-sm">
<thead className="bg-green-100 sticky top-0"><tr>
<th className="px-3 py-2 text-left text-xs font-semibold text-green-800 w-8"></th>
{Object.entries(spendBulk.mappings || {}).filter(([,v]) => v).map(([f]) => (
<th key={f} className="px-3 py-2 text-left text-xs font-semibold text-green-800">{spendBulk.fieldLabels[f]}</th>
))}</tr></thead>
<tbody className="divide-y divide-green-100">{flagged.slice(0, 50).map((row, i) => (
<tr key={i} className={row._duplicate ? 'bg-amber-50 opacity-60' : 'hover:bg-green-50'}>
<td className="px-3 py-1.5 text-center">{row._duplicate && <span className="text-amber-600 text-xs font-bold" title="Duplicate — will be skipped">DUP</span>}</td>
{Object.entries(spendBulk.mappings || {}).filter(([,v]) => v).map(([f]) => (
<td key={f} className={`px-3 py-1.5 max-w-[160px] truncate ${row._duplicate ? 'text-gray-400 line-through' : 'text-gray-700'}`}>{row[f] || '—'}</td>
))}</tr>))}</tbody></table></div>
{previewRows.length > 50 && <p className="text-xs text-gray-500 mt-2 text-center">Showing first 50 of {previewRows.length} rows</p>}
</div>); })()}
{/* Spend Bulk Import - Success */}
{spendBulk.step === 'success' && (<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
<div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
<div className="text-center">
<div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4"><CheckCircle className="h-10 w-10 text-green-600"/></div>
<h3 className="text-xl font-bold text-gray-900 mb-2">Import Complete</h3>
<p className="text-gray-600 mb-5">Your spend approvals have been successfully imported.</p>
</div>
<div className="bg-gray-50 rounded-lg p-4 space-y-3 mb-5">
<div className="flex justify-between text-sm"><span className="text-gray-500">Source File</span><span className="font-medium text-gray-800">{spendBulk.summary?.fileName}</span></div>
<div className="flex justify-between text-sm"><span className="text-gray-500">Spend Approvals Imported</span><span className="font-bold text-green-700">{spendBulk.summary?.count}</span></div>
<div className="flex justify-between text-sm"><span className="text-gray-500">Total Value</span><span className="font-bold text-green-700">€{(spendBulk.summary?.totalAmount || 0).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span></div>
<div className="flex justify-between text-sm"><span className="text-gray-500">Unique Vendors</span><span className="font-medium text-gray-800">{spendBulk.summary?.vendors?.length || 0}</span></div>
{spendBulk.summary?.skipped?.length > 0 && (
<div className="flex justify-between text-sm"><span className="text-amber-600">Duplicates Skipped</span><span className="font-bold text-amber-600">{spendBulk.summary.skipped.length}</span></div>
)}
</div>
<button onClick={() => setSpendBulk({ rows: [], fileName: '', mappings: null, step: null })} className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold">OK</button>
</div></div>)}
<div className="overflow-x-auto"><table className="w-full text-left">
<thead><tr className="border-b border-gray-200"> {canApproveSpend() && <th className="px-4 py-3 w-10"><input type="checkbox" checked={allPendingSelected} onChange={toggleAllSpend} className="w-4 h-4 text-green-600 rounded"/></th>}
{spendVisibleCols.ref && <th className={_th}>Reference</th>}
{spendVisibleCols.title && <th className={_th}>Title</th>}
{spendVisibleCols.vendor && <th className={_th}>Vendor</th>}
{spendVisibleCols.amount && <th className={_th}>Amount</th>}
{spendVisibleCols.invoiced && <th className={_th}>Invoiced</th>}
{spendVisibleCols.category && <th className={_th}>Category</th>}
{spendVisibleCols.department && <th className={_th}>Function</th>}
{spendVisibleCols.businessUnit && <th className={_th}>Business Unit</th>}
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
{spendVisibleCols.businessUnit && <td className={_td}>{s.businessUnit||'—'}</td>}
{spendVisibleCols.project && <td className={_td}>{s.project||'—'}</td>}
{spendVisibleCols.approver && <td className={_td}>{s.approver}</td>}
{spendVisibleCols.submittedBy && <td className={_td}>{s.submittedBy}</td>}
{spendVisibleCols.date && <td className={_td}>{new Date(s.submittedAt).toLocaleDateString()}</td>}
{spendVisibleCols.status && <td className="px-4 py-3">{sBadge(s.status)}</td>}
{spendVisibleCols.region && <td className={_td}>{(() => { const r = regions.find(x=>x.code===s.region); return r ? `${r.code} — ${r.name}` : s.region||'—'; })()}</td>}
{spendVisibleCols.costCentre && <td className={_td}>{(() => { const c = costCentres.find(x=>x.code===s.costCentre); return c ? `${c.code} — ${c.name}` : s.costCentre; })()}</td>}
{spendVisibleCols.atom && <td className={_td}>{(() => { const a = atoms.find(x=>x.code===s.atom); return a ? `${a.code} — ${a.name}` : s.atom; })()}</td>}
{canApproveSpend() && <td className="px-4 py-3">{(s.status==='Pending' || (s.status==='Escalated' && (user.isCeo || hasPermission('settings.manage_users')))) && <div className="flex space-x-1"><button onClick={async () => updateSpendStatus(s.id,'Approved')} className="p-1 text-green-600 hover:bg-green-50 rounded" title="Approve"><CheckCircle className="w-4 h-4"/></button><button onClick={async () => updateSpendStatus(s.id,'Rejected')} className="p-1 text-red-600 hover:bg-red-50 rounded" title="Reject"><XCircle className="w-4 h-4"/></button></div>}</td>} </tr></React.Fragment>); }); })()}</tbody> </table></div>
{filteredSpends.length === 0 && <div className="text-center py-12"><p className="text-gray-500">No results found.</p></div>}</div> </div>{escalationModal}</div>);}
if (currentPage === 'budget-matching') {
const unlinkedBl = budgetLines.filter(bl => !bl.spendApprovalId);
return (<div className={_pg}><div className="w-full"> <div className="bg-white rounded-lg shadow-lg p-6 mb-6"><div className={_fj}> <div className="flex items-center space-x-3"><Wallet className="w-8 h-8 text-teal-600"/><div><h1 className="text-2xl font-bold text-gray-800">Budget Item Matching</h1><p className="text-sm text-gray-500">{pendingBudgetMatches.length} spend approvals with suggested budget items • {unlinkedBl.length} unlinked budget lines</p></div></div>
<div className="flex items-center space-x-3"><button onClick={() => setCurrentPage('spend-approval')} className="flex items-center space-x-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"><ArrowRight className="w-4 h-4 rotate-180"/><span>Back to Spend Approvals</span></button><button onClick={() => setCurrentPage('landing')} className="flex items-center space-x-2 px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200"><Home className="w-4 h-4"/><span>Dashboard</span></button></div>
</div></div>
<details className="bg-white rounded-lg shadow-lg mb-6"><summary className="px-6 py-3 cursor-pointer text-sm font-semibold text-teal-600 hover:text-teal-800">How budget matching scores work</summary><div className="px-6 pb-4"><table className="w-full text-sm text-left border-collapse"><thead><tr className="border-b border-gray-200"><th className="py-2 pr-4 font-semibold text-gray-700">Signal</th><th className="py-2 pr-4 font-semibold text-gray-700 w-16">Score</th><th className="py-2 font-semibold text-gray-700">How it works</th></tr></thead><tbody className="text-gray-600">
<tr className="border-b border-gray-100"><td className="py-2 pr-4 font-medium">Vendor match</td><td className="py-2 pr-4 font-bold text-green-600">+35</td><td className="py-2">Budget line vendor contains the spend vendor name or vice versa</td></tr>
<tr className="border-b border-gray-100"><td className="py-2 pr-4 font-medium">Title/licence match</td><td className="py-2 pr-4 font-bold text-blue-600">+25</td><td className="py-2">Budget line licence/service name matches the spend approval title</td></tr>
<tr className="border-b border-gray-100"><td className="py-2 pr-4 font-medium">Amount match</td><td className="py-2 pr-4 font-bold text-purple-600">+20</td><td className="py-2">Budget EUR annual is within ±15% of the spend approved amount</td></tr>
<tr className="border-b border-gray-100"><td className="py-2 pr-4 font-medium">Region match</td><td className="py-2 pr-4 font-bold text-teal-600">+15</td><td className="py-2">Budget line region matches the spend approval region</td></tr>
<tr className="border-b border-gray-100"><td className="py-2 pr-4 font-medium">Cost centre match</td><td className="py-2 pr-4 font-bold text-teal-600">+15</td><td className="py-2">Budget line cost centre matches the spend approval cost centre</td></tr>
<tr className="border-b border-gray-100"><td className="py-2 pr-4 font-medium">Partial vendor</td><td className="py-2 pr-4 font-bold text-yellow-600">+15</td><td className="py-2">At least one word from the spend vendor appears in the budget vendor</td></tr>
<tr className="border-b border-gray-100"><td className="py-2 pr-4 font-medium">Partial title</td><td className="py-2 pr-4 font-bold text-yellow-600">+10</td><td className="py-2">A keyword from the spend title appears in the licence name</td></tr>
</tbody></table><p className="mt-3 text-xs text-gray-500">Minimum score to suggest: <strong>15</strong>. All amounts compared in EUR using current exchange rates.</p></div></details>
{pendingBudgetMatches.length > 0 && (<div className="space-y-6 mb-6">{pendingBudgetMatches.map(m => { const spAmt = parseFloat(m.spendAmount)||0; return ( <div key={m.spendId} className="bg-white rounded-lg shadow-lg overflow-hidden">
<div className="bg-teal-50 px-6 py-4 border-b border-teal-200"><div className={_fj}><div><div className="flex items-center space-x-3 mb-1"><span className="font-mono text-sm font-bold text-teal-600">{m.spendRef}</span><span className="text-lg font-bold text-gray-800">{m.spendTitle}</span></div>
<div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-500"><span>Vendor: <strong className="text-gray-700">{m.spendVendor}</strong></span><span>Approved: <strong className="text-gray-700">{fmtEur(m.spendAmount, m.spendCurrency)}</strong></span><span>Category: <strong className="text-gray-700">{m.spendCategory}</strong></span><span>Region: <strong className="text-gray-700">{m.spendRegion}</strong></span></div></div>
<div className="text-right"><div className="text-sm font-semibold text-gray-600">Budget: €{m.totalBudgetEur.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</div>{m.linkedBudgetCount > 0 && <div className="text-xs text-gray-500">{m.linkedBudgetCount} budget line{m.linkedBudgetCount>1?'s':''} already linked</div>}<button onClick={() => dismissBudgetMatch(m.spendId)} className="mt-1 text-xs text-red-500 hover:text-red-700 font-semibold">Dismiss All</button></div></div></div>
<div className="p-6"><p className="text-xs font-semibold text-gray-500 uppercase mb-3">Suggested Budget Lines ({m.suggestions.length})</p><div className="space-y-3">{m.suggestions.map(sg => ( <div key={sg.budgetLineId} className={`flex items-center justify-between p-4 rounded-lg border ${sg.score>=50?'border-teal-400 bg-teal-50':sg.score>=30?'border-green-300 bg-green-50':'border-gray-200 bg-gray-50'}`}>
<div className="flex-1"><div className="flex items-center space-x-3 mb-1"><span className="font-semibold text-gray-800">{sg.licence}</span><span className="px-2 py-0.5 bg-white border rounded text-sm text-gray-700">{sg.vendor || '—'}</span><span className="font-bold text-gray-900">€{sg.eurAnnual.toLocaleString(undefined,{minimumFractionDigits:2})}/yr</span><span className={`px-2 py-0.5 rounded text-xs font-semibold ${sg.type === 'BAU' ? 'bg-blue-100 text-blue-700' : sg.type === 'New' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>{sg.type}</span></div>
<div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">{sg.businessUnit && <span>BU: <strong className="text-gray-700">{sg.businessUnit}</strong></span>}{sg.region && <span>Region: <strong className="text-gray-700">{sg.region}</strong></span>}{sg.costCentre && <span>CC: <strong className="text-gray-700">{sg.costCentre}</strong></span>}{sg.currency && sg.currency !== 'EUR' && <span>Currency: <strong className="text-gray-700">{sg.currency}</strong></span>}</div>
<div className="flex flex-wrap gap-1 mt-2">{sg.reasons.map((r,i) => <span key={i} className={`px-2 py-0.5 rounded-full text-xs font-medium border ${r.includes('Vendor match')?'bg-green-100 text-green-700 border-green-300':r.includes('Title')?'bg-blue-100 text-blue-700 border-blue-300':'bg-white text-gray-600 border-gray-300'}`}>{r}</span>)}</div></div>
<div className="flex items-center space-x-3 ml-4 flex-shrink-0"><div className={`text-center ${sg.score>=50?'text-teal-700':sg.score>=30?'text-green-700':'text-gray-500'}`}><p className="text-2xl font-bold">{sg.score}</p><p className="text-xs">{sg.score>=50?'high':sg.score>=30?'good':'low'}</p></div>
<button onClick={() => acceptBudgetMatch(sg.budgetLineId, m.spendId)} className={`px-4 py-2 text-white rounded-lg font-semibold text-sm ${sg.score>=50?'bg-teal-600 hover:bg-teal-700':'bg-green-600 hover:bg-green-700'}`}>Link</button>
<button onClick={() => { setPendingBudgetMatches(prev => prev.map(p => p.spendId===m.spendId ? {...p, suggestions: p.suggestions.filter(s=>s.budgetLineId!==sg.budgetLineId)} : p).filter(p=>p.suggestions.length>0)); }} className="text-xs text-red-500 hover:text-red-700 font-semibold">Decline</button></div></div>))}</div>
<div className="mt-4 pt-4 border-t border-gray-200"><p className="text-xs font-semibold text-gray-500 uppercase mb-2">Manually Link Budget Line</p>
<select defaultValue="" onChange={async e => { if (e.target.value) { await acceptBudgetMatch(Number(e.target.value), m.spendId); e.target.value=''; }}} className={`w-full ${_g}`}><option value="" disabled>Select an unlinked budget line...</option>{unlinkedBl.map(bl => (<option key={bl.id} value={bl.id}>{bl.licence} — {bl.vendor||'N/A'} (€{(parseFloat(bl.eurAnnual)||0).toLocaleString()})</option>))}</select></div></div></div>); })}</div>)}
{pendingBudgetMatches.length === 0 && <div className="bg-white rounded-lg shadow-lg p-12 mb-6 text-center"><Wallet className="w-16 h-16 text-gray-300 mx-auto mb-4"/><p className="text-gray-500">No matching budget items found.</p></div>}
</div></div>);}
if (currentPage === 'matching') { const isRestricted = !hasPermission('invoices.assign_all');
const linked = invoices.filter(i => i.spendApprovalId);
const unlinked = invoices.filter(i => !i.spendApprovalId && (!isRestricted || i.submittedBy === user.name));
const getBudgetColor = (rem, total) => { if (total <= 0) return 'text-gray-500'; if (rem < 0) return 'text-red-600'; if (rem < total * 0.1) return 'text-orange-600'; return 'text-green-600'; };
return (<div className={_pg}><div className="w-full"> <div className="bg-white rounded-lg shadow-lg p-6 mb-6"><div className={_fj}> <div className="flex items-center space-x-3"><ExternalLink className="w-8 h-8 text-indigo-600"/><div><h1 className="text-2xl font-bold text-gray-800">Invoice Matching</h1><p className="text-sm text-gray-500">{pendingMatches.length} spend approvals with suggested invoices • {unlinked.length} unlinked invoices</p></div></div>
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
<div className="w-full"> <div className="bg-white rounded-lg shadow-lg p-6 mb-6"> <div className={_fj+" mb-6"}> <div className="flex items-center space-x-3"> <Settings className="w-8 h-8 text-indigo-600"/> <h1 className="text-3xl font-bold text-gray-800">Settings</h1></div> <div className="flex items-center space-x-4"> <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 rounded-lg"> <User className="w-5 h-5 text-indigo-600"/> <div className="text-sm"> <p className="font-semibold text-gray-800">{user.name}</p>
<p className="text-xs text-gray-600">{user.role}</p></div></div> <button onClick={() => setCurrentPage('landing')} className="flex items-center space-x-2 px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200"><Home className="w-4 h-4"/><span>Dashboard</span></button> {hasPermission('reports.view') && <button onClick={() => setCurrentPage('reports')} className="flex items-center space-x-2 px-4 py-2 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200"><BarChart3 className="w-4 h-4"/><span>Reports</span></button>} <button onClick={logout} className="flex items-center space-x-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"><LogOut className="w-4 h-4"/><span>Logout</span></button></div></div> <div className="border-b border-gray-200 mb-6">
<nav className="flex space-x-8"> <button
onClick={() => setSettingsTab('users')} className={`py-4 px-1 border-b-2 font-medium text-sm ${ settingsTab === 'users' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300' } ${!canManagePermissions() ? 'hidden' : ''}`} > <div className={_fx}> <User className="w-4 h-4"/> <span>Users</span></div></button> <button
onClick={() => setSettingsTab('atoms')} className={`py-4 px-1 border-b-2 font-medium text-sm ${ settingsTab === 'atoms' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300' }`} > <div className={_fx}> <Settings className="w-4 h-4"/> <span>Lookups</span></div></button> <button
onClick={() => setSettingsTab('audit')} className={`py-4 px-1 border-b-2 font-medium text-sm ${ settingsTab === 'audit' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300' }`} > <div className={_fx}> <FileText className="w-4 h-4"/> <span>Audit Log</span></div></button> {hasPermission('settings.manage_users') && <button
onClick={() => setSettingsTab('emails')} className={`py-4 px-1 border-b-2 font-medium text-sm ${ settingsTab === 'emails' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300' }`} > <div className={_fx}> <Mail className="w-4 h-4"/> <span>Email Templates</span></div></button>} {hasPermission('settings.manage_users') && <button
onClick={() => setSettingsTab('api')} className={`py-4 px-1 border-b-2 font-medium text-sm ${ settingsTab === 'api' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300' }`} > <div className={_fx}> <ExternalLink className="w-4 h-4"/> <span>API</span></div></button>} {hasPermission('settings.manage_users') && <button
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
{(() => { const apiTypeMap = {atoms:'atoms',costCentres:'cost-centres',regions:'regions',categories:'categories',businessUnits:'business-units'}; const renderLookup = (key, title, items, setItems, editId, setEditId, newItem, setNewItem, prefix, hasCode=true, maxLen=5, placeholder='Code') => {
const isCollapsed = collapsedLookups[key];
return (
<div className="border border-gray-200 rounded-lg overflow-hidden">
<button onClick={() => toggleLookup(key)} className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition">
<h2 className="text-sm font-bold text-gray-800">{title}</h2>
<div className="flex items-center space-x-2"><span className="text-xs text-gray-500">{items.length}</span>{isCollapsed ? <ChevronDown className="w-4 h-4 text-gray-400"/> : <ChevronUp className="w-4 h-4 text-gray-400"/>}</div>
</button>
{!isCollapsed && (<div className="p-4">
<div className="flex space-x-2 mb-3">{hasCode && <input placeholder={placeholder} value={newItem.code||''} onChange={e => setNewItem(p=>({...p,code:e.target.value.toUpperCase()}))} className={`w-24 ${_i} text-sm`} maxLength={maxLen}/>}<input placeholder="Name" value={newItem.name} onChange={e => setNewItem(p=>({...p,name:e.target.value}))} className={`flex-1 ${_i} text-sm`}/><button onClick={async () => { if (hasCode ? (!newItem.code||!newItem.name) : !newItem.name) return; if (hasCode && items.find(i=>i.code===newItem.code)) { alert('Code exists'); return; } if (!hasCode && items.find(i=>i.name===newItem.name)) { alert('Name exists'); return; } try { const n = await api.post('/api/lookups/'+apiTypeMap[key], hasCode ? {code:newItem.code,name:newItem.name} : {name:newItem.name}); setItems(prev=>[...prev,n]); setNewItem(hasCode?{code:'',name:''}:{name:''}); refreshAuditLog(`${prefix}_CREATED`, `Created ${title}: ${hasCode?n.code+' — ':''}${n.name}`); } catch(e) { alert(e.response?.data?.error||e.message||'Failed to create'); return; } }} className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-xs font-semibold">Add</button></div>
<div className="max-h-[280px] overflow-y-auto"><table className="w-full text-left"><thead className="sticky top-0 bg-white"><tr className="border-b border-gray-200">{hasCode && <th className={_th}>Code</th>}<th className={_th}>Name</th><th className={_th}>Status</th><th className={_th}>Actions</th></tr></thead><tbody>{items.map(item => (<tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
{editId===item.id ? (<>{hasCode && <td className="px-4 py-2"><input value={item.code} onChange={e => setItems(prev=>prev.map(x=>x.id===item.id?{...x,code:e.target.value.toUpperCase()}:x))} className={`w-20 ${_i}`} maxLength={maxLen}/></td>}<td className="px-4 py-2"><input value={item.name} onChange={e => setItems(prev=>prev.map(x=>x.id===item.id?{...x,name:e.target.value}:x))} className={`w-full ${_i}`}/></td><td className="px-4 py-2"><span className={`px-2 py-0.5 rounded text-xs font-semibold ${item.active?'bg-green-100 text-green-700':'bg-gray-100 text-gray-500'}`}>{item.active?'Active':'Inactive'}</span></td><td className="px-4 py-2"><button onClick={async () => { try { await api.patch(`/api/lookups/${apiTypeMap[key]}/${item.id}`, hasCode ? {code:item.code,name:item.name} : {name:item.name}); setEditId(null); refreshAuditLog(`${prefix}_UPDATED`, `Updated ${title}: ${hasCode?item.code+' — ':''}${item.name}`); } catch(e) { alert(e.response?.data?.error||e.message||'Failed to save'); } }} className="text-xs text-green-600 font-semibold">Save</button></td></>) : (<>{hasCode && <td className="px-4 py-3 text-sm font-mono font-semibold text-indigo-600">{item.code}</td>}<td className={_td}>{item.name}</td><td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs font-semibold ${item.active?'bg-green-100 text-green-700':'bg-gray-100 text-gray-500'}`}>{item.active?'Active':'Inactive'}</span></td><td className="px-4 py-3 text-sm"><div className="flex space-x-2"><button onClick={() => setEditId(item.id)} className="text-xs text-indigo-600 font-semibold">Edit</button><button onClick={async () => { try { const resp = await api.patch(`/api/lookups/${apiTypeMap[key]}/${item.id}/toggle`); setItems(prev=>prev.map(x=>x.id===item.id?{...x,active:resp.active}:x)); refreshAuditLog(`${prefix}_${resp.active?'ACTIVATED':'DEACTIVATED'}`, `${resp.active?'Activated':'Deactivated'} ${title}: ${hasCode?item.code+' — ':''}${item.name}`); } catch(e) { alert(e.response?.data?.error||e.message||'Failed to toggle'); } }} className={`text-xs font-semibold ${item.active?'text-red-600':'text-green-600'}`}>{item.active?'Deactivate':'Activate'}</button></div></td></>)}</tr>))}</tbody></table></div>
</div>)}</div>);}; return (<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
{renderLookup('atoms','Atoms',atoms,setAtoms,editAtom,setEditAtom,newAtom,setNewAtom,'ATOM',true,5,'Code (e.g. FIN)')}
{renderLookup('costCentres','Cost Centres',costCentres,setCostCentres,editCC,setEditCC,newCC,setNewCC,'CC',true,6,'Code (e.g. CC600)')}
{renderLookup('regions','Regions',regions,setRegions,editRegion,setEditRegion,newRegion,setNewRegion,'REGION',true,5,'Code (e.g. LATAM)')}
<div className="border border-gray-200 rounded-lg overflow-hidden">
<button onClick={() => toggleLookup('currencies')} className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition">
<h2 className="text-sm font-bold text-gray-800">Currencies</h2>
<div className="flex items-center space-x-2"><span className="text-xs text-gray-500">{currencies.length}</span>{collapsedLookups.currencies ? <ChevronDown className="w-4 h-4 text-gray-400"/> : <ChevronUp className="w-4 h-4 text-gray-400"/>}</div>
</button>
{!collapsedLookups.currencies && (<div className="p-4">
<div className="flex space-x-2 mb-3"><input placeholder="Code" value={newCurrency.code||''} onChange={e => setNewCurrency(p=>({...p,code:e.target.value.toUpperCase()}))} className={`w-20 ${_i} text-sm`} maxLength={3}/><input placeholder="Name" value={newCurrency.name} onChange={e => setNewCurrency(p=>({...p,name:e.target.value}))} className={`flex-1 ${_i} text-sm`}/><input placeholder="Rate" type="number" step="0.000001" value={newCurrency.exchangeRateToEur||''} onChange={e => setNewCurrency(p=>({...p,exchangeRateToEur:e.target.value}))} className={`w-24 ${_i} text-sm`}/><button onClick={async () => { if (!newCurrency.code||!newCurrency.name||!newCurrency.exchangeRateToEur) return; if (currencies.find(i=>i.code===newCurrency.code)) { alert('Code exists'); return; } try { const n = await api.post('/api/lookups/currencies', {code:newCurrency.code,name:newCurrency.name,exchangeRateToEur:parseFloat(newCurrency.exchangeRateToEur)}); setCurrencies(prev=>[...prev,n]); setNewCurrency({code:'',name:'',exchangeRateToEur:''}); refreshAuditLog('CURRENCY_CREATED', `Created currency: ${n.code} — ${n.name}`); } catch(e) { alert(e.response?.data?.error||e.message||'Failed to create'); } }} className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-xs font-semibold">Add</button></div>
<div className="max-h-[280px] overflow-y-auto"><table className="w-full text-left"><thead className="sticky top-0 bg-white"><tr className="border-b border-gray-200"><th className={_th}>Code</th><th className={_th}>Name</th><th className={_th}>Rate</th><th className={_th}>Status</th><th className={_th}>Actions</th></tr></thead><tbody>{currencies.map(item => (<tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
{editCurrency===item.id ? (<><td className="px-4 py-2"><input value={item.code} onChange={e => setCurrencies(prev=>prev.map(x=>x.id===item.id?{...x,code:e.target.value.toUpperCase()}:x))} className={`w-20 ${_i}`} maxLength={3}/></td><td className="px-4 py-2"><input value={item.name} onChange={e => setCurrencies(prev=>prev.map(x=>x.id===item.id?{...x,name:e.target.value}:x))} className={`w-full ${_i}`}/></td><td className="px-4 py-2"><input type="number" step="0.000001" value={item.exchangeRateToEur||''} onChange={e => setCurrencies(prev=>prev.map(x=>x.id===item.id?{...x,exchangeRateToEur:e.target.value}:x))} className={`w-28 ${_i}`} disabled={item.code==='EUR'}/></td><td className="px-4 py-2"><span className={`px-2 py-0.5 rounded text-xs font-semibold ${item.active?'bg-green-100 text-green-700':'bg-gray-100 text-gray-500'}`}>{item.active?'Active':'Inactive'}</span></td><td className="px-4 py-2"><button onClick={async () => { try { await api.patch(`/api/lookups/currencies/${item.id}`, {code:item.code,name:item.name,exchangeRateToEur:parseFloat(item.exchangeRateToEur)}); setEditCurrency(null); refreshAuditLog('CURRENCY_UPDATED', `Updated currency: ${item.code} — ${item.name}`); } catch(e) { alert(e.response?.data?.error||e.message||'Failed to save'); } }} className="text-xs text-green-600 font-semibold">Save</button></td></>) : (<><td className="px-4 py-3 text-sm font-mono font-semibold text-indigo-600">{item.code}</td><td className={_td}>{item.name}</td><td className="px-4 py-3 text-sm font-mono">{parseFloat(item.exchangeRateToEur||1).toFixed(6)}</td><td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs font-semibold ${item.active?'bg-green-100 text-green-700':'bg-gray-100 text-gray-500'}`}>{item.active?'Active':'Inactive'}</span></td><td className="px-4 py-3 text-sm"><div className="flex space-x-2"><button onClick={() => setEditCurrency(item.id)} className="text-xs text-indigo-600 font-semibold">Edit</button><button onClick={async () => { try { const resp = await api.patch(`/api/lookups/currencies/${item.id}/toggle`); setCurrencies(prev=>prev.map(x=>x.id===item.id?{...x,active:resp.active}:x)); refreshAuditLog(`CURRENCY_${resp.active?'ACTIVATED':'DEACTIVATED'}`, `${resp.active?'Activated':'Deactivated'} currency: ${item.code} — ${item.name}`); } catch(e) { alert(e.response?.data?.error||e.message||'Failed to toggle'); } }} className={`text-xs font-semibold ${item.active?'text-red-600':'text-green-600'}`}>{item.active?'Deactivate':'Activate'}</button></div></td></>)}</tr>))}</tbody></table></div>
</div>)}</div>
{renderLookup('categories','Spend Categories',categories,setCategories,editCategory,setEditCategory,newCategory,setNewCategory,'CATEGORY',false)}
{renderLookup('businessUnits','Business Units',businessUnits,setBusinessUnits,editBU,setEditBU,newBU,setNewBU,'BU',false)}
<div className="border border-gray-200 rounded-lg overflow-hidden">
<button onClick={() => toggleLookup('functions')} className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition">
<h2 className="text-sm font-bold text-gray-800">Functions / Departments</h2>
<div className="flex items-center space-x-2"><span className="text-xs text-gray-500">{functions.length}</span>{collapsedLookups.functions ? <ChevronDown className="w-4 h-4 text-gray-400"/> : <ChevronUp className="w-4 h-4 text-gray-400"/>}</div>
</button>
{!collapsedLookups.functions && (<div className="p-4">
<div className="flex space-x-2 mb-3"><input placeholder="Function name" value={newFunction.name} onChange={e => setNewFunction(p=>({...p,name:e.target.value}))} className={`flex-1 ${_i}`}/><select value={newFunction.approver} onChange={e => setNewFunction(p=>({...p,approver:e.target.value}))} className={`w-48 ${_i}`}><option value="">Approver...</option>{mockUsers.filter(u=>{ const rl = roles.find(r=>r.name===u.role); return rl && rl.permissions.includes('spend.approve') && u.status==='Active'; }).map(u=>(<option key={u.id} value={u.name}>{u.name}</option>))}</select><button onClick={async () => { if (!newFunction.name||!newFunction.approver) return; if (functions.find(f=>f.name===newFunction.name)) { alert('Duplicate function'); return; } const approverUser = mockUsers.find(u=>u.name===newFunction.approver); try { const resp = await api.post('/api/lookups/functions', {name:newFunction.name, approverId:approverUser?.id||null}); setFunctions(prev=>[...prev,{...resp, approverId:resp.approver?.id||resp.approverId||null, approver:resp.approver?.name||newFunction.approver}]); setNewFunction({name:'',approver:''}); refreshAuditLog('FUNCTION_CREATED', `Created function: ${resp.name}`); } catch(e) { alert(e.response?.data?.error||e.message||'Failed to create'); } }} className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-xs font-semibold">Add</button></div>
<div className="max-h-[280px] overflow-y-auto"><table className="w-full text-left"><thead className="sticky top-0 bg-white"><tr className="border-b border-gray-200"><th className={_th}>Name</th><th className={_th}>Approver</th><th className={_th}>Status</th><th className={_th}>Actions</th></tr></thead><tbody>{functions.map(f => (<tr key={f.id} className="border-b border-gray-100 hover:bg-gray-50">
{editFunction===f.id ? (<><td className="px-4 py-2"><input value={f.name} onChange={e => setFunctions(prev=>prev.map(x=>x.id===f.id?{...x,name:e.target.value}:x))} className={`w-full ${_i}`}/></td><td className="px-4 py-2"><select value={f.approver} onChange={e => setFunctions(prev=>prev.map(x=>x.id===f.id?{...x,approver:e.target.value}:x))} className={`w-full ${_i}`}>{mockUsers.filter(u=>{ const rl = roles.find(r=>r.name===u.role); return rl && rl.permissions.includes('spend.approve') && u.status==='Active'; }).map(u=>(<option key={u.id} value={u.name}>{u.name}</option>))}</select></td><td className="px-4 py-2"><span className={`px-2 py-0.5 rounded text-xs font-semibold ${f.active?'bg-green-100 text-green-700':'bg-gray-100 text-gray-500'}`}>{f.active?'Active':'Inactive'}</span></td><td className="px-4 py-2"><button onClick={async () => { const approverUser = mockUsers.find(u=>u.name===f.approver); try { await api.patch(`/api/lookups/functions/${f.id}`, {name:f.name, approverId:approverUser?.id||null}); setEditFunction(null); refreshAuditLog('FUNCTION_UPDATED', `Updated function: ${f.name}`); } catch(e) { alert(e.response?.data?.error||e.message||'Failed to save'); } }} className="text-xs text-green-600 font-semibold">Save</button></td></>) : (<><td className={_td}>{f.name}</td><td className="px-4 py-3 text-sm"><span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-xs font-semibold">{f.approver}</span></td><td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs font-semibold ${f.active?'bg-green-100 text-green-700':'bg-gray-100 text-gray-500'}`}>{f.active?'Active':'Inactive'}</span></td><td className="px-4 py-3 text-sm"><div className="flex space-x-2"><button onClick={() => setEditFunction(f.id)} className="text-xs text-indigo-600 font-semibold">Edit</button><button onClick={async () => { try { const resp = await api.patch(`/api/lookups/functions/${f.id}/toggle`); setFunctions(prev=>prev.map(x=>x.id===f.id?{...x,active:resp.active}:x)); refreshAuditLog(`FUNCTION_${resp.active?'ACTIVATED':'DEACTIVATED'}`, `${resp.active?'Activated':'Deactivated'} function: ${f.name}`); } catch(e) { alert(e.response?.data?.error||e.message||'Failed to toggle'); } }} className={`text-xs font-semibold ${f.active?'text-red-600':'text-green-600'}`}>{f.active?'Deactivate':'Activate'}</button></div></td></>)}</tr>))}</tbody></table></div>
</div>)}</div>
<div className="border border-gray-200 rounded-lg overflow-hidden">
<button onClick={() => toggleLookup('projects')} className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition">
<h2 className="text-sm font-bold text-gray-800">Projects</h2>
<div className="flex items-center space-x-2"><span className="text-xs text-gray-500">{projects.length}</span>{collapsedLookups.projects ? <ChevronDown className="w-4 h-4 text-gray-400"/> : <ChevronUp className="w-4 h-4 text-gray-400"/>}</div>
</button>
{!collapsedLookups.projects && (<div className="p-4">
<div className="flex space-x-2 mb-3"><input placeholder="Project name" value={newProject.name} onChange={e => setNewProject(p=>({...p,name:e.target.value}))} className={`flex-1 ${_i}`}/><input placeholder="Description" value={newProject.description} onChange={e => setNewProject(p=>({...p,description:e.target.value}))} className={`flex-1 ${_i}`}/><button onClick={async () => { if (!newProject.name) return; if (projects.find(p=>p.name===newProject.name)) { alert('Duplicate project name'); return; } try { const p = await api.post('/api/lookups/projects', {name:newProject.name, description:newProject.description||null}); setProjects(prev=>[...prev,p]); setNewProject({name:'',description:''}); refreshAuditLog('PROJECT_CREATED', `Created project: ${p.name}`); } catch(e) { alert(e.response?.data?.error||e.message||'Failed to create'); } }} className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-xs font-semibold">Add</button></div>
<div className="max-h-[280px] overflow-y-auto"><table className="w-full text-left"><thead className="sticky top-0 bg-white"><tr className="border-b border-gray-200"><th className={_th}>Name</th><th className={_th}>Description</th><th className={_th}>Status</th><th className={_th}>Actions</th></tr></thead><tbody>{projects.map(p => (<tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
{editProject===p.id ? (<><td className="px-4 py-2"><input value={p.name} onChange={e => setProjects(prev=>prev.map(x=>x.id===p.id?{...x,name:e.target.value}:x))} className={`w-full ${_i}`}/></td><td className="px-4 py-2"><input value={p.description} onChange={e => setProjects(prev=>prev.map(x=>x.id===p.id?{...x,description:e.target.value}:x))} className={`w-full ${_i}`}/></td><td className="px-4 py-2"><span className={`px-2 py-0.5 rounded text-xs font-semibold ${p.active?'bg-green-100 text-green-700':'bg-gray-100 text-gray-500'}`}>{p.active?'Active':'Inactive'}</span></td><td className="px-4 py-2"><button onClick={async () => { try { await api.patch(`/api/lookups/projects/${p.id}`, {name:p.name, description:p.description||null}); setEditProject(null); refreshAuditLog('PROJECT_UPDATED', `Updated project: ${p.name}`); } catch(e) { alert(e.response?.data?.error||e.message||'Failed to save'); } }} className="text-xs text-green-600 font-semibold">Save</button></td></>) : (<><td className={_td}>{p.name}</td><td className={_td}>{p.description||'—'}</td><td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs font-semibold ${p.active?'bg-green-100 text-green-700':'bg-gray-100 text-gray-500'}`}>{p.active?'Active':'Inactive'}</span></td><td className="px-4 py-3 text-sm"><div className="flex space-x-2"><button onClick={() => setEditProject(p.id)} className="text-xs text-indigo-600 font-semibold">Edit</button><button onClick={async () => { try { const resp = await api.patch(`/api/lookups/projects/${p.id}/toggle`); setProjects(prev=>prev.map(x=>x.id===p.id?{...x,active:resp.active}:x)); refreshAuditLog(`PROJECT_${resp.active?'ACTIVATED':'DEACTIVATED'}`, `${resp.active?'Activated':'Deactivated'} project: ${p.name}`); } catch(e) { alert(e.response?.data?.error||e.message||'Failed to toggle'); } }} className={`text-xs font-semibold ${p.active?'text-red-600':'text-green-600'}`}>{p.active?'Deactivate':'Activate'}</button></div></td></>)}</tr>))}</tbody></table></div>
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
<th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Performed By</th></tr></thead> <tbody className="divide-y divide-gray-200"> {getFilteredAuditLog().map((entry) => ( <tr key={entry.id} className="hover:bg-gray-50"> <td className="px-6 py-4 text-sm text-gray-600"> {new Date(entry.performedAt || entry.deletedAt).toLocaleString()}</td> <td className="px-6 py-4 text-sm"> <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
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
{apiKeyInfo.configured && (<div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg"><span className="text-sm text-gray-600">Current key: </span><span className="font-mono text-sm text-gray-800">{apiKeyInfo.maskedKey}</span>{apiKeyInfo.updatedAt && <span className="text-xs text-gray-500 ml-3">Updated {new Date(apiKeyInfo.updatedAt).toLocaleDateString()}</span>}</div>)}
<div className="flex items-end space-x-3 mb-4">
<div className="flex-1"><label className={_lb}>{apiKeyInfo.configured ? 'New API Key' : 'API Key'}</label><input type="password" value={apiKeyInput} onChange={e => setApiKeyInput(e.target.value)} placeholder="sk-ant-..." className={`w-full ${_i}`}/></div>
<button onClick={() => saveApiKey(apiKeyInput)} disabled={!apiKeyInput.trim() || apiKeyTestStatus === 'testing'} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-semibold text-sm disabled:opacity-50">{apiKeyInfo.configured ? 'Update' : 'Save'}</button>
<button onClick={() => testApiKey()} disabled={!apiKeyInfo.configured || apiKeyTestStatus === 'testing'} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold text-sm disabled:opacity-50">{apiKeyTestStatus === 'testing' ? 'Testing...' : 'Test'}</button>
{apiKeyInfo.configured && <button onClick={() => { if (window.confirm('Remove the API key? Invoice extraction will stop working.')) removeApiKey(); }} className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 font-semibold text-sm">Remove</button>}
</div>
{apiKeyTestStatus === 'success' && (<div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center space-x-2"><CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0"/><p className="text-sm text-green-800">{apiKeyTestMessage}</p></div>)}
{apiKeyTestStatus === 'error' && (<div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2"><XCircle className="w-5 h-5 text-red-600 flex-shrink-0"/><p className="text-sm text-red-800">{apiKeyTestMessage}</p></div>)}
{apiKeyTestStatus === 'testing' && (<div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center space-x-2"><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 flex-shrink-0"></div><p className="text-sm text-blue-800">{apiKeyTestMessage}</p></div>)}
</div>
<div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
<h3 className="text-lg font-semibold text-blue-900 mb-3">How It Works</h3>
<div className="space-y-2 text-sm text-blue-800">
<p>When an API key is configured, uploaded invoices are sent to Claude AI for intelligent data extraction. Claude analyzes the document and extracts vendor details, amounts, dates, line items, and more.</p>
<p>If no API key is set, extraction will return an error prompting an administrator to configure one.</p>
<p>The API key is stored encrypted in the database and shared across all users. Only administrators can view or manage it.</p>
</div>
</div>
<div className="bg-white border border-gray-200 rounded-lg p-6">
<h3 className="text-lg font-semibold text-gray-800 mb-4">Current Status</h3>
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
<div className="p-4 bg-gray-50 rounded-lg"><span className="text-xs font-semibold text-gray-500 uppercase">Extraction Mode</span><p className="text-lg font-bold mt-1">{apiKeyInfo.configured ? <span className="text-green-700">AI-Powered</span> : <span className="text-gray-600">Not Configured</span>}</p></div>
<div className="p-4 bg-gray-50 rounded-lg"><span className="text-xs font-semibold text-gray-500 uppercase">Model</span><p className="text-lg font-bold mt-1 text-gray-800">{apiKeyInfo.configured ? 'claude-sonnet-4-6' : 'N/A'}</p></div>
<div className="p-4 bg-gray-50 rounded-lg"><span className="text-xs font-semibold text-gray-500 uppercase">Supported Files</span><p className="text-lg font-bold mt-1 text-gray-800">PDF, PNG, JPG, WebP</p></div>
<div className="p-4 bg-gray-50 rounded-lg"><span className="text-xs font-semibold text-gray-500 uppercase">API Key Status</span><p className="text-lg font-bold mt-1">{apiKeyInfo.configured ? <span className="text-green-700">Configured</span> : <span className="text-yellow-600">Not Set</span>}</p></div>
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
<button onClick={() => { setEmailTemplates(prev => prev.map(t => t.id === tpl.id ? {...t, active: !t.active} : t)); logAuditRemote(tpl.active ? 'EMAIL_TEMPLATE_DEACTIVATED' : 'EMAIL_TEMPLATE_ACTIVATED', `Email template "${tpl.name}" ${tpl.active ? 'deactivated' : 'activated'}`); }} className={`text-sm font-medium px-3 py-1.5 rounded-lg ${tpl.active ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}>{tpl.active ? 'Deactivate' : 'Activate'}</button>
<div className="flex items-center space-x-2">
<button onClick={() => setEditTemplateId(null)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm font-medium">Cancel</button>
<button onClick={() => { setEditTemplateId(null); logAuditRemote('EMAIL_TEMPLATE_UPDATED', `Email template "${tpl.name}" updated`); }} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-semibold">Save</button>
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
<button onClick={() => { if (!newRoleName.trim()) return; if (roles.find(r => r.name.toLowerCase() === newRoleName.trim().toLowerCase())) { alert('Role name already exists'); return; } const id = newRoleName.trim().toLowerCase().replace(/\s+/g,'-'); const nr = { id, name: newRoleName.trim(), isDefault: false, permissions: [] }; setRoles(prev => [...prev, nr]); setEditingRole(nr.id); setNewRoleName(''); logAuditRemote('ROLE_CREATED', `Role "${nr.name}" created`); }} className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-semibold text-sm"><Plus className="w-4 h-4"/><span>Create Role</span></button>
</div>
<div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
<div className="lg:col-span-1">
<div className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
<div className="px-4 py-3 bg-gray-100 border-b border-gray-200"><h3 className="text-sm font-semibold text-gray-700">Roles</h3></div>
<div className="divide-y divide-gray-200">{roles.map(r => (<div key={r.id} className={`flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-white transition ${editingRole === r.id ? 'bg-white border-l-4 border-indigo-600' : ''}`} onClick={() => setEditingRole(r.id)}>
<div className="flex items-center space-x-2">{r.isDefault && <Lock className="w-3 h-3 text-gray-400 flex-shrink-0"/>}<span className={`text-sm font-medium ${editingRole === r.id ? 'text-indigo-700' : 'text-gray-700'}`}>{r.name}</span></div>
<div className="flex items-center space-x-2"><span className="text-xs text-gray-400">{r.permissions.length}</span>
{!r.isDefault && (<button onClick={(e) => { e.stopPropagation(); const usersWithRole = mockUsers.filter(u => u.role === r.name && u.status === 'Active'); if (usersWithRole.length > 0) { alert(`Cannot delete role "${r.name}" — ${usersWithRole.length} user(s) are assigned to it.`); return; } if (!window.confirm(`Delete role "${r.name}"?`)) return; setRoles(prev => prev.filter(x => x.id !== r.id)); if (editingRole === r.id) setEditingRole(null); logAuditRemote('ROLE_DELETED', `Role "${r.name}" deleted`); }} className="text-red-400 hover:text-red-600" title="Delete role"><Trash2 className="w-3.5 h-3.5"/></button>)}</div>
</div>))}</div></div></div>
<div className="lg:col-span-3">{editingRole ? (() => { const role = roles.find(r => r.id === editingRole); if (!role) return <p className="text-gray-500">Role not found.</p>;
const togglePerm = async (permKey) => { const mutualExclusions = { 'invoices.view_all': ['invoices.view_own'], 'invoices.view_own': ['invoices.view_all'], 'invoices.assign_all': ['invoices.assign_own'], 'invoices.assign_own': ['invoices.assign_all'], 'spend.view_all': ['spend.view_own','spend.view_dept'], 'spend.view_own': ['spend.view_all','spend.view_dept'], 'spend.view_dept': ['spend.view_all','spend.view_own'] };
const has = role.permissions.includes(permKey); let newPerms; if (has) { newPerms = role.permissions.filter(p => p !== permKey); } else { const toRemove = mutualExclusions[permKey] || []; newPerms = [...role.permissions.filter(p => !toRemove.includes(p)), permKey]; }
setRoles(prev => prev.map(r => r.id === role.id ? {...r, permissions: newPerms} : r));
try { await api.patch(`/api/roles/${role.id}`, { permissions: newPerms }); } catch (err) { console.error('Failed to save role permissions:', err); setRoles(prev => prev.map(r => r.id === role.id ? {...r, permissions: role.permissions} : r)); alert('Failed to save permission change: ' + err.message); return; }
if (user && user.role === role.name) { setUserPermissions(newPerms); } };
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
<div className="w-full"> <div className="bg-white rounded-lg shadow p-4 mb-4"> <div className="flex items-center justify-between"> <div className="flex items-center space-x-3"> <button
onClick={() => setSelectedInvoice(null)} className="flex items-center space-x-1 text-indigo-600 hover:text-indigo-800 text-sm font-medium" > <span>←</span> <span>Back</span></button> <span className="text-gray-300">|</span> <h1 className="text-xl font-bold text-gray-800">{invoice.invoiceNumber}</h1> <span className="text-sm text-gray-500">— {invoice.vendor}</span></div> <div className="flex items-center space-x-2"> {canDeleteInvoices() && ( <button
onClick={() => initiateDeleteInvoice(invoice)} className="flex items-center space-x-1 px-3 py-1.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-sm" > <Trash2 className="w-3.5 h-3.5"/> <span>Delete</span></button>)}
{canCreateSpend() && !invoice.spendApprovalId && ( <button onClick={() => { const totalAmount = (parseFloat(invoice.amount) + parseFloat(invoice.taxAmount)).toFixed(2); const fn = functions.find(f => f.name === invoice.department); const inferred = inferLookupsFromDepartment(invoice.department); const invCurrency = (invoice.currency || '').toUpperCase(); if (invCurrency && !currencies.some(c => c.code === invCurrency)) { setCurrencies(prev => [...prev, { id: Date.now(), code: invCurrency, name: invCurrency, active: true }]); } setSpendForm({ cc:'', title: invoice.description, currency: invCurrency, approver: fn ? fn.approver : '', amount: totalAmount, category:'', atom: inferred.atom, vendor: invoice.vendor, costCentre: inferred.costCentre, region:'', project:'', timeSensitive:false, exceptional:'', justification: invoice.description, department: invoice.department, originInvoiceIds: [invoice.id] }); setSelectedInvoice(null); setCurrentPage('spend-approval'); setSpendView('form'); }} className="flex items-center space-x-1 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 text-sm"><DollarSign className="w-3.5 h-3.5"/><span>Create Spend</span></button>)}
<button onClick={() => setCurrentPage('landing')} className="flex items-center space-x-1 px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 text-sm"><Home className="w-3.5 h-3.5"/><span>Dashboard</span></button></div></div></div> <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

{/* Left column: Invoice Info, then Linked Spend Approval + Bank Details */}
<div className="space-y-4">
<div className="bg-white rounded-lg shadow p-4"> <h2 className="text-lg font-bold text-gray-800 mb-3">Invoice Information</h2> <div className="grid grid-cols-2 md:grid-cols-3 gap-4"> <div> <label className="text-xs text-gray-500">Invoice Number</label> <p className="text-sm font-semibold text-gray-800">{invoice.invoiceNumber}</p></div> <div> <label className="text-xs text-gray-500">Vendor</label> <p className="text-sm font-semibold text-gray-800">{invoice.vendor}</p></div> <div> <label className="text-xs text-gray-500">Total Amount</label> <p className="text-lg font-bold text-green-600">{currencySymbol(invoice.currency)}{invoice.totalAmount || (parseFloat(invoice.amount) + parseFloat(invoice.taxAmount)).toFixed(2)}</p></div> <div> <label className="text-xs text-gray-500">Invoice Date</label> <p className="text-sm font-semibold text-gray-800">{invoice.date}</p></div> <div> <label className="text-xs text-gray-500">Due Date</label> <p className="text-sm font-semibold text-gray-800">{invoice.dueDate}</p></div> <div> <label className="text-xs text-gray-500">Subtotal / Tax</label> <p className="text-sm font-semibold text-gray-800">{currencySymbol(invoice.currency)}{invoice.amount} + {currencySymbol(invoice.currency)}{invoice.taxAmount}{invoice.vatRate != null && invoice.vatRate > 0 ? ` (${(invoice.vatRate * 100).toFixed(0)}%)` : ''}</p></div> {invoice.paymentTerms && (<div> <label className="text-xs text-gray-500">Payment Terms</label> <p className="text-sm font-semibold text-gray-800">{invoice.paymentTerms}</p></div>)} {invoice.currency && (<div> <label className="text-xs text-gray-500">Currency</label> <p className="text-sm font-semibold text-gray-800">{invoice.currency}</p></div>)} {invoice.businessUnit && (<div> <label className="text-xs text-gray-500">Business Unit</label> <p className="text-sm font-semibold text-gray-800">{invoice.businessUnit}</p></div>)} <div> <label className="text-xs text-gray-500">Submitted By</label> <p className="text-sm font-semibold text-gray-800">{invoice.submittedBy}</p></div> <div> <label className="text-xs text-gray-500">Submitted</label> <p className="text-sm text-gray-800">{new Date(invoice.submittedDate).toLocaleDateString()}</p></div></div> {invoice.description && (<div className="mt-3 pt-3 border-t border-gray-100"> <label className="text-xs text-gray-500">Description</label> <p className="text-sm text-gray-800">{invoice.description}</p></div>)}</div>

{(() => { const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const invTotal = parseFloat(invoice.amount) + parseFloat(invoice.taxAmount);
const mc = invoice.monthlyCosts || [];
const allocType = mc.length === 0 ? 'invoice_date' : mc.length === 1 ? 'single_month' : 'spread';
const invDate = invoice.date || '';
const invYm = invDate ? invDate.slice(0, 7) : new Date().toISOString().slice(0, 7);
const invMonthLabel = MONTHS[parseInt(invYm.slice(5, 7), 10) - 1] || 'Jan';
const invYear = invYm.slice(0, 4);
const ymToMonth = (ym) => MONTHS[parseInt(ym.slice(5, 7), 10) - 1];
const saveMonthlyCosts = async (months) => {
  try { const saved = await api.put(`/api/invoices/${invoice.id}/monthly-costs`, { months });
  setInvoices(prev => prev.map(i => i.id === invoice.id ? { ...i, monthlyCosts: saved } : i));
  setSelectedInvoice(prev => ({ ...prev, monthlyCosts: saved }));
  } catch (err) { alert('Failed to save: ' + err.message); } };
const buildSpread = (startYm, endYm) => {
  if (!startYm || !endYm || startYm > endYm) return [];
  const result = []; let [y, m] = startYm.split('-').map(Number); const [ey, em] = endYm.split('-').map(Number);
  while (y < ey || (y === ey && m <= em)) { result.push(`${y}-${String(m).padStart(2, '0')}`); m++; if (m > 12) { m = 1; y++; } }
  const count = result.length; const perMonth = Math.round(invTotal / count * 100) / 100;
  const remainder = Math.round((invTotal - perMonth * count) * 100) / 100;
  return result.map((ym, i) => ({ month: MONTHS[parseInt(ym.slice(5, 7), 10) - 1], yearMonth: ym, amount: i === 0 ? Math.round((perMonth + remainder) * 100) / 100 : perMonth }));
};
const startYm = mc.length > 0 ? mc[0].yearMonth : invYm;
const endYm = mc.length > 0 ? mc[mc.length - 1].yearMonth : invYm;
return (<div className="bg-white rounded-lg shadow p-4"> <h2 className="text-lg font-bold text-gray-800 mb-3">Cost Booking</h2>
<div className="space-y-3">
<div className="flex flex-wrap gap-2">
<button onClick={() => saveMonthlyCosts([])} className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition ${allocType === 'invoice_date' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>Invoice Date ({invMonthLabel} {invYear})</button>
<button onClick={() => saveMonthlyCosts([{ month: invMonthLabel, yearMonth: invYm, amount: invTotal }])} className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition ${allocType === 'single_month' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>Book to Month</button>
<button onClick={() => { const end = `${parseInt(invYm.slice(0,4),10) + 1}-${invYm.slice(5,7)}`; saveMonthlyCosts(buildSpread(invYm, end)); }} className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition ${allocType === 'spread' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>Spread Cost</button>
</div>
{allocType === 'single_month' && (<div className="flex items-center gap-3">
<label className="text-sm text-gray-600">Month:</label>
<input type="month" value={mc[0]?.yearMonth || invYm} onChange={e => { if (e.target.value) saveMonthlyCosts([{ month: ymToMonth(e.target.value), yearMonth: e.target.value, amount: invTotal }]); }} className={_g}/>
<span className="text-sm text-gray-500">{currencySymbol(invoice.currency)}{invTotal.toFixed(2)}</span>
</div>)}
{allocType === 'spread' && (<div className="space-y-2">
<div className="flex items-center gap-3">
<label className="text-sm text-gray-600">From:</label>
<input type="month" value={startYm} onChange={e => { if (e.target.value) saveMonthlyCosts(buildSpread(e.target.value, endYm > e.target.value ? endYm : e.target.value)); }} className={_g}/>
<label className="text-sm text-gray-600">To:</label>
<input type="month" value={endYm} onChange={e => { if (e.target.value) saveMonthlyCosts(buildSpread(startYm < e.target.value ? startYm : e.target.value, e.target.value)); }} className={_g}/>
</div>
<div className="bg-gray-50 rounded-lg border p-3 overflow-x-auto"><table className="w-full"><thead><tr>{mc.map(r => <th key={r.yearMonth} className="text-xs text-gray-500 font-medium px-2 py-1 whitespace-nowrap">{r.month} {r.yearMonth.slice(0,4)}</th>)}</tr></thead><tbody><tr>{mc.map(r => <td key={r.yearMonth} className="text-center px-2 py-1"><input type="number" step="0.01" value={parseFloat(r.amount)} onChange={e => { const updated = mc.map(x => x.yearMonth === r.yearMonth ? { ...x, amount: parseFloat(e.target.value) || 0 } : x); setInvoices(prev => prev.map(i => i.id === invoice.id ? { ...i, monthlyCosts: updated } : i)); setSelectedInvoice(prev => ({ ...prev, monthlyCosts: updated })); }} onBlur={() => saveMonthlyCosts(mc)} className="w-20 text-center text-sm border border-gray-300 rounded px-1 py-0.5"/></td>)}</tr></tbody></table>
<p className="text-xs text-gray-500 mt-2">Total: {currencySymbol(invoice.currency)}{mc.reduce((s, r) => s + parseFloat(r.amount), 0).toFixed(2)} across {mc.length} month{mc.length !== 1 ? 's' : ''}</p></div>
</div>)}
{allocType === 'invoice_date' && (<p className="text-sm text-gray-500">Full amount ({currencySymbol(invoice.currency)}{invTotal.toFixed(2)}) booked to invoice date month ({invMonthLabel} {invYear})</p>)}
</div></div>); })()}

<div className="bg-white rounded-lg shadow p-4"> <h2 className="text-lg font-bold text-gray-800 mb-3">Linked Spend Approval</h2> {invoice.spendApprovalId ? (() => { const sp = spendApprovals.find(s => s.id === invoice.spendApprovalId); return sp ? ( <div className="border border-indigo-200 bg-indigo-50 rounded-lg p-3"> <div className="flex items-center justify-between mb-2"><h3 className="font-semibold text-indigo-800 text-sm"><button onClick={() => { setSelectedInvoice(null); setCurrentPage('spend-approval'); setSpendView('list'); setSelectedSpend(sp); }} className="hover:text-indigo-600 underline">{sp.ref} — {sp.title}</button></h3><button onClick={() => unlinkInvoice(invoice.id)} className="text-xs text-red-600 hover:text-red-800 font-semibold">Unlink</button></div>
<div className="grid grid-cols-2 gap-2 text-sm"><div><span className="text-gray-500">Vendor:</span> <span className="text-gray-800">{sp.vendor}</span></div><div><span className="text-gray-500">Approved:</span> <span className="text-gray-800">{fmtEur(sp.amount, sp.currency)}</span></div><div><span className="text-gray-500">Category:</span> <span className="text-gray-800">{sp.category}</span></div><div><span className="text-gray-500">Remaining:</span> <span className={`font-semibold ${getSpendRemaining(sp) < 0 ? 'text-red-600' : 'text-green-600'}`}>€{getSpendRemaining(sp).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span></div></div>
</div> ) : <p className="text-sm text-gray-500">Linked spend approval not found.</p>; })() : ( <div><p className="text-sm text-gray-500 mb-3">No spend approval linked to this invoice.</p><label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Assign to Spend Approval</label><select defaultValue="" onChange={e => { if (e.target.value) { acceptMatch(invoice.id, Number(e.target.value)); setSelectedInvoice({...invoice, spendApprovalId: Number(e.target.value)}); } }} className={`w-full ${_g}`}><option value="" disabled>Select an approved spend approval...</option>{spendApprovals.filter(s => s.status === 'Approved' && (hasPermission('invoices.assign_all') || s.submittedBy === user.name)).map(s => (<option key={s.id} value={s.id}>{s.ref} — {s.title} — {s.vendor} ({fmtEur(s.amount, s.currency)})</option>))}</select></div>)}

{invoice.bankDetails && (invoice.bankDetails.bank || invoice.bankDetails.account_number || invoice.bankDetails.iban) && (<div className="mt-4 pt-4 border-t border-gray-100"> <h2 className="text-lg font-bold text-gray-800 mb-3">Bank Details</h2> <div className="grid grid-cols-2 gap-3 text-sm"> {invoice.bankDetails.bank && (<div> <label className="text-xs text-gray-500">Bank</label> <p className="font-semibold text-gray-800">{invoice.bankDetails.bank}</p></div>)} {invoice.bankDetails.account_number && (<div> <label className="text-xs text-gray-500">Account Number</label> <p className="font-mono text-gray-800">{invoice.bankDetails.account_number}</p></div>)} {invoice.bankDetails.sort_code && (<div> <label className="text-xs text-gray-500">Sort Code</label> <p className="font-mono text-gray-800">{invoice.bankDetails.sort_code}</p></div>)} {invoice.bankDetails.iban && (<div> <label className="text-xs text-gray-500">IBAN</label> <p className="font-mono text-gray-800">{invoice.bankDetails.iban}</p></div>)} {invoice.bankDetails.swift_bic && (<div> <label className="text-xs text-gray-500">SWIFT/BIC</label> <p className="font-mono text-gray-800">{invoice.bankDetails.swift_bic}</p></div>)}</div></div>)}
</div>

{(invoice.supplier && (invoice.supplier.company || invoice.supplier.address || invoice.supplier.vat_number)) || (invoice.customer && (invoice.customer.company || invoice.customer.address)) ? (<div className="bg-white rounded-lg shadow p-4"> <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
{invoice.supplier && (invoice.supplier.company || invoice.supplier.address || invoice.supplier.vat_number) && (<div> <h2 className="text-lg font-bold text-gray-800 mb-2">Supplier</h2> <div className="space-y-1 text-sm"> {invoice.supplier.company && (<p className="font-semibold text-gray-800">{invoice.supplier.company}</p>)} {invoice.supplier.address && (<p className="text-gray-600">{invoice.supplier.address}</p>)} {invoice.supplier.vat_number && (<p className="text-gray-600">VAT: {invoice.supplier.vat_number}</p>)} {invoice.supplier.phone && (<p className="text-gray-600">Phone: {invoice.supplier.phone}</p>)} {invoice.supplier.email && (<p className="text-gray-600">{invoice.supplier.email}</p>)} {invoice.supplier.website && (<p className="text-gray-600">{invoice.supplier.website}</p>)}</div></div>)}
{invoice.customer && (invoice.customer.company || invoice.customer.address) && (<div> <h2 className="text-lg font-bold text-gray-800 mb-2">Customer / Bill-to</h2> <div className="space-y-1 text-sm"> {invoice.customer.company && (<p className="font-semibold text-gray-800">{invoice.customer.company}</p>)} {invoice.customer.attention && (<p className="text-gray-600">Attn: {invoice.customer.attention}</p>)} {invoice.customer.address && (<p className="text-gray-600">{invoice.customer.address}</p>)} {invoice.customer.vat_number && (<p className="text-gray-600">VAT: {invoice.customer.vat_number}</p>)}</div></div>)}
</div></div>) : null}
</div>

{/* Right column: Line Items, then Attached Document */}
<div className="space-y-4">
{invoice.lineItems && invoice.lineItems.length > 0 && ( <div className="bg-white rounded-lg shadow p-4"> <h2 className="text-lg font-bold text-gray-800 mb-3">Line Items</h2> <div className="overflow-x-auto"> <table className="w-full"> <thead className="bg-gray-50"> <tr> {invoice.lineItems.some(li => li.category) && <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Category</th>} <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Description</th> <th className="px-4 py-2 text-right text-sm font-semibold text-gray-700">Qty</th> <th className="px-4 py-2 text-right text-sm font-semibold text-gray-700">Rate</th>
<th className="px-4 py-2 text-right text-sm font-semibold text-gray-700">Amount</th></tr></thead> <tbody className="divide-y divide-gray-200"> {invoice.lineItems.map((item, idx) => ( <tr key={idx}> {invoice.lineItems.some(li => li.category) && <td className="px-4 py-2 text-sm text-gray-600">{item.category}</td>} <td className="px-4 py-2 text-sm text-gray-800">{item.description}</td> <td className="px-4 py-2 text-sm text-right text-gray-800">{item.quantity}</td> <td className="px-4 py-2 text-sm text-right text-gray-800">{currencySymbol(invoice.currency)}{item.rate}</td> <td className="px-4 py-2 text-sm text-right font-semibold text-gray-800">{currencySymbol(invoice.currency)}{item.amount}</td></tr> ))}</tbody></table></div></div>)}

{invoice.fileUrl && (<div className="bg-white rounded-lg shadow p-4"> <h2 className="text-lg font-bold text-gray-800 mb-3">Attached Document</h2> <div className="border-2 border-gray-200 rounded-lg p-4"> {invoice.fileType?.startsWith('image/') ? ( <img
src={invoice.fileUrl}
alt="Invoice document" className="w-full rounded-lg"/> ) : ( <div className={_fj}> <div className="flex items-center space-x-3"> <FileText className="w-8 h-8 text-indigo-600"/> <div> <p className="font-semibold text-gray-800">{invoice.fileName}</p> <p className="text-sm text-gray-600">PDF Document</p></div></div> <a
href={invoice.fileUrl}
download={invoice.fileName} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm"  > Download</a></div>)}</div></div>)}
</div>

</div></div></div>);} return (
<div className={_pg}> {showDeleteConfirmation && invoiceToDelete && ( <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"> <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6"> <div className="flex items-center space-x-3 mb-4"> <div className="flex items-center justify-center h-12 w-12 rounded-full bg-red-100"> <Trash2 className="h-6 w-6 text-red-600"/></div> <h3 className="text-xl font-bold text-gray-900">Delete Invoice</h3></div> <p className="text-gray-600 mb-4"> This action cannot be undone.</p> <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4"> <p className="text-sm text-yellow-800"> Please type <span className="font-bold">{invoiceToDelete.invoiceNumber}</span> to confirm deletion:</p></div> <input type="text" value={deleteConfirmationInput} onChange={(e) => setDeleteConfirmationInput(e.target.value)} placeholder="Type invoice number here" className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-red-500"/> <div className="flex space-x-3"> <button onClick={cancelDeleteInvoice} className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"> Cancel</button> <button onClick={confirmDeleteInvoice} disabled={deleteConfirmationInput !== invoiceToDelete.invoiceNumber} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"> Delete Invoice</button></div></div></div>)} <div className="w-full"> <div className="bg-white rounded-lg shadow-lg p-6 mb-6"> <div className={_fj+" mb-6"}> <div className="flex items-center space-x-3"> <FileText className="w-8 h-8 text-indigo-600"/> <h1 className="text-3xl font-bold text-gray-800">Invoices</h1></div> <div className="flex items-center space-x-4"> <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 rounded-lg"> <User className="w-5 h-5 text-indigo-600"/>
<div className="text-sm"> <p className="font-semibold text-gray-800">{user.name}</p> <p className="text-xs text-gray-600">{user.role}</p></div></div> <button onClick={() => setCurrentPage('landing')} className="flex items-center space-x-2 px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200"><Home className="w-4 h-4"/><span>Dashboard</span></button> {hasPermission('reports.view') && <button onClick={() => setCurrentPage('reports')} className="flex items-center space-x-2 px-4 py-2 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200"><BarChart3 className="w-4 h-4"/><span>Reports</span></button>} <button
onClick={logout} className="flex items-center space-x-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200" > <LogOut className="w-4 h-4"/> <span>Logout</span></button></div></div> <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
<div className="border-2 border-dashed border-indigo-300 rounded-lg p-6 text-center hover:border-indigo-500 hover:bg-indigo-50 transition">
<Sparkles className="w-10 h-10 text-indigo-400 mx-auto mb-3"/>
<input ref={fileInputRef} type="file" accept=".pdf,image/*" multiple onChange={handleFileSelect} className="hidden" id="file-upload"/>
<label htmlFor="file-upload" className="cursor-pointer">
<span className="text-lg font-semibold text-gray-700">AI Upload</span>
<p className="text-sm text-gray-500 mt-1">Upload PDF or images — AI extracts invoice data automatically</p>
</label>
{selectedFiles.length > 0 && (<div className="mt-3"><p className="text-sm text-indigo-600 font-medium mb-1">{selectedFiles.length} file(s) selected:</p><div className="max-h-24 overflow-y-auto">{selectedFiles.map((file, idx) => (<p key={idx} className="text-xs text-gray-600">{file.name}</p>))}</div></div>)}
</div>
<div className="border-2 border-dashed border-teal-300 rounded-lg p-6 text-center hover:border-teal-500 hover:bg-teal-50 transition">
<FileSpreadsheet className="w-10 h-10 text-teal-400 mx-auto mb-3"/>
<input ref={bulkFileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleBulkFile} className="hidden" id="bulk-upload"/>
<label htmlFor="bulk-upload" className="cursor-pointer">
<span className="text-lg font-semibold text-gray-700">Bulk Import</span>
<p className="text-sm text-gray-500 mt-1">Upload Excel or CSV to import multiple invoices at once</p>
</label>
{bulkImport.fileName && <p className="text-sm text-teal-600 font-medium mt-3">{bulkImport.fileName} — {bulkImport.rows.length} row(s)</p>}
</div>
</div> {isProcessing && processingProgress.total > 0 && ( <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6"> <div className="flex items-center justify-between mb-3"> <div className="flex items-center space-x-3"> <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div> <span className="text-gray-700"> Processing invoices... ({processingProgress.current} of {processingProgress.total})</span></div>
<span className="text-sm font-semibold text-indigo-600"> {Math.round((processingProgress.current / processingProgress.total) * 100)}%</span></div> <div className="w-full bg-gray-200 rounded-full h-2"> <div className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
style={{ width: `${(processingProgress.current / processingProgress.total) * 100}%` }} ></div></div></div>)}
{bulkImport.step === 'sheet' && (<div className="bg-teal-50 border border-teal-200 rounded-lg p-6 mb-6">
<div className={_fj+" mb-4"}><h3 className="text-xl font-semibold text-gray-800">Select Sheet — {bulkImport.fileName}</h3>
<button onClick={() => setBulkImport({ rows: [], fileName: '', mappings: null, step: null })} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm font-medium">Cancel</button>
</div>
<p className="text-sm text-gray-600 mb-4">This workbook has multiple sheets. Select which sheet to import from.</p>
<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
{bulkImport.sheetNames.map(name => (<button key={name} onClick={() => selectBulkSheet(bulkImport.workbook, name, bulkImport.fileName)} className="px-4 py-3 bg-white border-2 border-teal-200 rounded-lg hover:border-teal-500 hover:bg-teal-50 text-sm font-medium text-gray-800 transition text-left"><FileSpreadsheet className="w-4 h-4 text-teal-600 inline mr-2"/>{name}</button>))}
</div>
</div>)}
{bulkImport.step === 'map' && (<div className="bg-teal-50 border border-teal-200 rounded-lg p-6 mb-6">
<div className={_fj+" mb-4"}><h3 className="text-xl font-semibold text-gray-800">Map Columns — {bulkImport.fileName}{bulkImport.selectedSheet ? ` — ${bulkImport.selectedSheet}` : ''}</h3>
<div className="flex space-x-3">
{bulkImport.sheetNames?.length > 1 && <button onClick={() => setBulkImport(prev => ({ ...prev, step: 'sheet' }))} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm font-medium">Back to Sheets</button>}
<button onClick={() => setBulkImport({ rows: [], fileName: '', mappings: null, step: null })} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm font-medium">Cancel</button>
<button onClick={bulkImportPreview} className="px-5 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-semibold">Preview Import</button>
</div></div>
<p className="text-sm text-gray-600 mb-4">Map your spreadsheet columns to invoice fields. We auto-detected what we could.</p>
<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
{bulkImport.targetFields.map(f => (<div key={f}>
<label className="block text-xs font-semibold text-gray-600 mb-1">{bulkImport.fieldLabels[f]}</label>
<select value={bulkImport.mappings?.[f] || ''} onChange={e => setBulkMapping(f, e.target.value)} className={`w-full text-sm ${_i}`}>
<option value="">— skip —</option>
{bulkImport.headers.map(h => (<option key={h} value={h}>{h}</option>))}
</select>
</div>))}
</div>
<p className="text-xs text-gray-500 mt-3">{bulkImport.rows.length} row(s) found in spreadsheet</p>
</div>)}
{bulkImport.step === 'preview' && (() => { const previewRows = getMappedRows();
const existingKeys = new Set(invoices.map(inv => `${inv.invoiceNumber}|||${(inv.vendor || '').toLowerCase()}`));
const seenKeys = new Set();
const flagged = previewRows.map(row => {
  const key = row.invoiceNumber ? `${row.invoiceNumber}|||${(row.vendor || '').toLowerCase()}` : null;
  const isDup = key && (existingKeys.has(key) || seenKeys.has(key));
  if (key) seenKeys.add(key);
  return { ...row, _duplicate: isDup };
});
const dupCount = flagged.filter(r => r._duplicate).length;
const newCount = flagged.length - dupCount;
return (<div className="bg-teal-50 border border-teal-200 rounded-lg p-6 mb-6">
<div className={_fj+" mb-4"}><h3 className="text-xl font-semibold text-gray-800">Preview Import — {previewRows.length} invoice(s)</h3>
<div className="flex space-x-3">
<button onClick={() => setBulkImport(prev => ({ ...prev, step: 'map' }))} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm font-medium">Back</button>
<button onClick={() => setBulkImport({ rows: [], fileName: '', mappings: null, step: null })} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm font-medium">Cancel</button>
<button onClick={confirmBulkImport} disabled={isProcessing || newCount === 0} className="px-5 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-semibold disabled:opacity-50 flex items-center space-x-2">
<CheckCircle className="w-4 h-4"/><span>{isProcessing ? 'Importing...' : `Import ${newCount} Invoice${newCount !== 1 ? 's' : ''}`}</span></button>
</div></div>
{dupCount > 0 && (<div className="flex items-center space-x-2 mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg"><AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0"/><p className="text-sm text-amber-800"><strong>{dupCount}</strong> duplicate invoice{dupCount !== 1 ? 's' : ''} found (matching invoice # + vendor) — these will be skipped.</p></div>)}
<div className="overflow-x-auto max-h-80 overflow-y-auto"><table className="w-full text-sm">
<thead className="bg-teal-100 sticky top-0"><tr>
<th className="px-3 py-2 text-left text-xs font-semibold text-teal-800 w-8"></th>
{Object.entries(bulkImport.mappings || {}).filter(([,v]) => v).map(([f]) => (
<th key={f} className="px-3 py-2 text-left text-xs font-semibold text-teal-800">{bulkImport.fieldLabels[f]}</th>
))}</tr></thead>
<tbody className="divide-y divide-teal-100">{flagged.slice(0, 50).map((row, i) => (
<tr key={i} className={row._duplicate ? 'bg-amber-50 opacity-60' : 'hover:bg-teal-50'}>
<td className="px-3 py-1.5 text-center">{row._duplicate && <span className="text-amber-600 text-xs font-bold" title="Duplicate — will be skipped">DUP</span>}</td>
{Object.entries(bulkImport.mappings || {}).filter(([,v]) => v).map(([f]) => (
<td key={f} className={`px-3 py-1.5 max-w-[160px] truncate ${row._duplicate ? 'text-gray-400 line-through' : 'text-gray-700'}`}>{row[f] || '—'}</td>
))}</tr>))}</tbody></table></div>
{previewRows.length > 50 && <p className="text-xs text-gray-500 mt-2 text-center">Showing first 50 of {previewRows.length} rows</p>}
</div>); })()}
{bulkImport.step === 'success' && (<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
<div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
<div className="text-center">
<div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-teal-100 mb-4"><CheckCircle className="h-10 w-10 text-teal-600"/></div>
<h3 className="text-xl font-bold text-gray-900 mb-2">Import Complete</h3>
<p className="text-gray-600 mb-5">Your invoices have been successfully imported.</p>
</div>
<div className="bg-gray-50 rounded-lg p-4 space-y-3 mb-5">
<div className="flex justify-between text-sm"><span className="text-gray-500">Source File</span><span className="font-medium text-gray-800">{bulkImport.summary?.fileName}</span></div>
<div className="flex justify-between text-sm"><span className="text-gray-500">Invoices Imported</span><span className="font-bold text-teal-700">{bulkImport.summary?.count}</span></div>
<div className="flex justify-between text-sm"><span className="text-gray-500">Total Value</span><span className="font-bold text-teal-700">€{(bulkImport.summary?.totalAmount || 0).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span></div>
<div className="flex justify-between text-sm"><span className="text-gray-500">Unique Vendors</span><span className="font-medium text-gray-800">{bulkImport.summary?.vendors?.length || 0}</span></div>
{bulkImport.summary?.vendors?.length > 0 && bulkImport.summary.vendors.length <= 5 && (
<div className="text-sm"><span className="text-gray-500">Vendors: </span><span className="text-gray-700">{bulkImport.summary.vendors.join(', ')}</span></div>
)}
{bulkImport.summary?.skipped?.length > 0 && (
<div className="flex justify-between text-sm"><span className="text-amber-600">Duplicates Skipped</span><span className="font-bold text-amber-600">{bulkImport.summary.skipped.length}</span></div>
)}
</div>
{bulkImport.summary?.skipped?.length > 0 && (
<div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-5">
<p className="text-xs font-semibold text-amber-800 mb-1">Skipped Duplicates:</p>
<div className="max-h-24 overflow-y-auto space-y-0.5">{bulkImport.summary.skipped.map((s, i) => (
<p key={i} className="text-xs text-amber-700">{s.invoiceNumber} — {s.vendor}</p>
))}</div>
</div>
)}
<button onClick={() => setBulkImport({ rows: [], fileName: '', mappings: null, step: null })} className="w-full px-4 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-semibold">OK</button>
</div></div>)}
{extractionErrors.length > 0 && !isProcessing && (<div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6"><div className="flex items-start space-x-3"><AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5"/><div><h4 className="text-sm font-semibold text-yellow-800 mb-1">Some files could not be extracted with AI</h4><ul className="text-sm text-yellow-700 space-y-1">{extractionErrors.map((err, idx) => (<li key={idx}><strong>{err.fileName}:</strong> {err.error}</li>))}</ul><p className="text-xs text-yellow-600 mt-2">These files were processed using sample data instead.</p></div></div></div>)}
{extractedDataBatch.length > 0 && !isProcessing && (() => {
const existingKeys = new Set(invoices.map(inv => `${inv.invoiceNumber}|||${(inv.vendor || '').toLowerCase()}`));
const seenKeys = new Set();
const batchFlags = extractedDataBatch.map(data => {
  const key = data.invoiceNumber ? `${data.invoiceNumber}|||${(data.vendor || '').toLowerCase()}` : null;
  const isDup = key && (existingKeys.has(key) || seenKeys.has(key));
  if (key) seenKeys.add(key);
  return isDup;
});
const dupCount = batchFlags.filter(Boolean).length;
const newCount = extractedDataBatch.length - dupCount;
return ( <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6"> <div className={_fj+" mb-4"}> <h3 className="text-xl font-semibold text-gray-800"> Extracted Invoice Data ({extractedDataBatch.length} invoices)</h3> <button
onClick={processInvoiceBatch} disabled={newCount === 0} className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition flex items-center space-x-2 disabled:opacity-50" > <CheckCircle className="w-4 h-4"/> <span>{newCount === 0 ? 'All Duplicates' : `Process ${newCount} Invoice${newCount !== 1 ? 's' : ''}`}</span></button></div>
{dupCount > 0 && (<div className="flex items-center space-x-2 mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg"><AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0"/><p className="text-sm text-amber-800"><strong>{dupCount}</strong> duplicate{dupCount !== 1 ? 's' : ''} detected (matching invoice # + vendor already in system) — will be skipped on import.</p></div>)}
<div className="max-h-96 overflow-y-auto mb-4 space-y-4"> {extractedDataBatch.map((data, idx) => ( <div key={idx} className={`bg-white p-4 rounded-lg border relative ${batchFlags[idx] ? 'border-amber-300 opacity-60' : 'border-green-300'}`}> <div className="flex items-center justify-between mb-2"> <div className="flex items-center space-x-2"><span className="font-semibold text-gray-700">Invoice #{idx + 1}</span>{batchFlags[idx] && <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-bold rounded">DUPLICATE</span>}</div>
<div className="flex items-center space-x-2"><span className="text-xs text-gray-500">{data.fileName}</span><button onClick={() => removeFromBatch(idx)} className="text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full p-1 transition" title="Remove from batch"><X className="w-4 h-4"/></button></div></div> <div className="grid grid-cols-2 md:grid-cols-4 gap-3"> <div> <span className="text-xs text-gray-600">Invoice #:</span> <p className="text-sm font-semibold">{data.invoiceNumber}</p></div> <div> <span className="text-xs text-gray-600">Vendor:</span> <p className="text-sm font-semibold">{data.vendor}</p></div> <div> <span className="text-xs text-gray-600">Date:</span> <p className="text-sm font-semibold">{data.date}</p></div> <div> <span className="text-xs text-gray-600">Total:</span>
<p className="text-sm font-semibold text-green-600">{currencySymbol(data.currency)}{data.totalAmount || (parseFloat(data.amount) + parseFloat(data.taxAmount)).toFixed(2)}</p></div></div></div> ))}</div> <button
onClick={processInvoiceBatch} disabled={newCount === 0} className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-50">{newCount === 0 ? 'All invoices are duplicates' : `Process ${newCount} Invoice${newCount !== 1 ? 's' : ''}`}</button></div>);})()}</div> <div className={_cd}> <div className={_fj+" mb-6"}> <h2 className="text-2xl font-bold text-gray-800">Invoice List</h2> <div className="flex items-center space-x-3"><div className="relative"> <input type="text"
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
onChange={(e) => setGroupBy(e.target.value)} className={_i} > <option value="none">None</option> <option value="vendor">Vendor</option> <option value="businessUnit">Business Unit</option> <option value="date">Date</option> <option value="submittedBy">Submitted By</option></select></div> <div className="relative"> <button
onClick={() => setShowColumnSelector(!showColumnSelector)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"  > Columns</button> {showColumnSelector && ( <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 p-4 z-10"> <h3 className="font-semibold text-gray-800 mb-3">Show/Hide Columns</h3> <div className="space-y-2"> <label className="flex items-center space-x-2 cursor-pointer"> <input type="checkbox"
checked={visibleColumns.invoiceNumber}
onChange={() => toggleColumnVisibility('invoiceNumber')} className="w-4 h-4 text-indigo-600 rounded"/> <span className="text-sm text-gray-700">Invoice #</span></label> <label className="flex items-center space-x-2 cursor-pointer"> <input type="checkbox"
checked={visibleColumns.vendor}
onChange={() => toggleColumnVisibility('vendor')} className="w-4 h-4 text-indigo-600 rounded"/> <span className="text-sm text-gray-700">Vendor</span></label> <label className="flex items-center space-x-2 cursor-pointer"> <input type="checkbox"
checked={visibleColumns.businessUnit}
onChange={() => toggleColumnVisibility('businessUnit')} className="w-4 h-4 text-indigo-600 rounded"/> <span className="text-sm text-gray-700">Business Unit</span></label> <label className="flex items-center space-x-2 cursor-pointer"> <input type="checkbox"
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
onClick={exportToExcel} className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"  > <Download className="w-4 h-4"/> <span>Export</span></button>)}</div></div>
{selectedInvoiceIds.length > 0 && canCreateSpend() && (<div className="flex items-center justify-between p-3 bg-indigo-50 border border-indigo-200 rounded-lg mb-4"><div className="flex items-center space-x-3"><span className="text-sm font-semibold text-indigo-800">{selectedInvoiceIds.length} invoice{selectedInvoiceIds.length !== 1 ? 's' : ''} selected</span><button onClick={() => setSelectedInvoiceIds([])} className="text-xs text-indigo-600 hover:text-indigo-800 underline">Clear</button></div><button onClick={() => { const selected = invoices.filter(i => selectedInvoiceIds.includes(i.id)); const totalAmount = selected.reduce((sum, inv) => sum + parseFloat(inv.amount) + parseFloat(inv.taxAmount), 0).toFixed(2); const vendors = [...new Set(selected.map(i => i.vendor))]; const depts = [...new Set(selected.map(i => i.department).filter(Boolean))]; const dept = depts.length === 1 ? depts[0] : ''; const fn = dept ? functions.find(f => f.name === dept) : null; const inferred = dept ? inferLookupsFromDepartment(dept) : { atom: '', costCentre: '' }; const invCurrencies = [...new Set(selected.map(i => (i.currency || '').toUpperCase()).filter(Boolean))]; const currency = invCurrencies.length === 1 ? invCurrencies[0] : ''; if (currency && !currencies.some(c => c.code === currency)) { setCurrencies(prev => [...prev, { id: Date.now(), code: currency, name: currency, active: true }]); } const descriptions = selected.map(i => i.description).filter(Boolean); setSpendForm({ cc:'', title: vendors.length === 1 ? `${vendors[0]} — ${selected.length} invoices` : `${selected.length} invoices — multiple vendors`, currency, approver: fn ? fn.approver : '', amount: totalAmount, category:'', atom: inferred.atom, vendor: vendors.length === 1 ? vendors[0] : vendors.join(', '), costCentre: inferred.costCentre, region:'', project:'', description: descriptions.join('; '), timeSensitive:false, exceptional:'', justification: descriptions.join('; ') || `Spend for ${selected.length} invoices`, department: dept, businessUnit:'', originInvoiceIds: selectedInvoiceIds.slice() }); setCurrentPage('spend-approval'); setSpendView('form'); }} className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold text-sm"><DollarSign className="w-4 h-4"/><span>Create Spend Approval</span></button></div>)}
{invoices.length === 0 ? ( <div className="text-center py-12 text-gray-500"> <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-400"/> <p>No invoices processed yet. Upload an invoice to get started.</p></div> ) : getFilteredInvoices().length === 0 ? ( <div className="text-center py-12 text-gray-500">
<AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-400"/> <p>No invoices match your current filters.</p> <button
onClick={clearFilters} className="mt-4 text-indigo-600 hover:text-indigo-800 underline" > Clear Filters</button></div> ) : ( <div className="space-y-6"> {Object.entries(getGroupedInvoices()).map(([groupName, groupInvoices]) => ( <div key={groupName}> {groupBy !== 'none' && ( <div className="mb-3 flex items-center justify-between"> <h3 className="text-lg font-bold text-gray-700 flex items-center space-x-2"> <span>{groupName}</span> <span className="text-sm font-normal text-gray-500">({groupInvoices.length} invoices)</span></h3></div>)}
<div className="overflow-x-auto"> <table className="w-full"> <thead className="bg-gray-50"> <tr>
{canCreateSpend() && <th className="px-4 py-3 text-center w-10"><input type="checkbox" checked={(() => { const unlinkable = groupInvoices.filter(i => !i.spendApprovalId); return unlinkable.length > 0 && unlinkable.every(i => selectedInvoiceIds.includes(i.id)); })()} onChange={(e) => { const unlinkable = groupInvoices.filter(i => !i.spendApprovalId); if (e.target.checked) { setSelectedInvoiceIds(prev => [...new Set([...prev, ...unlinkable.map(i => i.id)])]); } else { const unlinkIds = new Set(unlinkable.map(i => i.id)); setSelectedInvoiceIds(prev => prev.filter(id => !unlinkIds.has(id))); } }} className="w-4 h-4 text-indigo-600 rounded"/></th>}
{visibleColumns.invoiceNumber && ( <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Invoice #</th>)}
{visibleColumns.vendor && ( <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Vendor</th>)}
{visibleColumns.businessUnit && ( <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Business Unit</th>)}
{visibleColumns.subtotal && ( <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Subtotal</th>)}
{visibleColumns.tax && ( <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Tax</th>)}
{visibleColumns.total && ( <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Total</th>)}
{visibleColumns.spendApproval && ( <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Spend Approval</th>)}
{visibleColumns.date && ( <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Invoice Date</th>)}
{visibleColumns.dueDate && ( <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Due Date</th>)}
{visibleColumns.file && ( <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">File</th>)}
{visibleColumns.submittedBy && ( <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Submitted By</th>)}
{canDeleteInvoices() && ( <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Actions</th>)}</tr></thead> <tbody className="divide-y divide-gray-200"> {groupInvoices.map((invoice) => ( <tr key={invoice.id} className={`hover:bg-gray-50 ${selectedInvoiceIds.includes(invoice.id) ? 'bg-indigo-50' : ''}`}>
{canCreateSpend() && <td className="px-4 py-3 text-center">{!invoice.spendApprovalId ? (<input type="checkbox" checked={selectedInvoiceIds.includes(invoice.id)} onChange={(e) => { if (e.target.checked) { setSelectedInvoiceIds(prev => [...prev, invoice.id]); } else { setSelectedInvoiceIds(prev => prev.filter(id => id !== invoice.id)); } }} className="w-4 h-4 text-indigo-600 rounded"/>) : <span className="text-gray-300">—</span>}</td>}
{visibleColumns.invoiceNumber && ( <td className="px-4 py-3 text-sm"> <button
onClick={() => setSelectedInvoice(invoice)} className="text-indigo-600 hover:text-indigo-800 font-semibold underline" > {invoice.invoiceNumber}</button></td>)}
{visibleColumns.vendor && ( <td className="px-4 py-3 text-sm">{invoice.vendor}</td>)}
{visibleColumns.businessUnit && ( <td className="px-4 py-3 text-sm">{invoice.businessUnit || '—'}</td>)}
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