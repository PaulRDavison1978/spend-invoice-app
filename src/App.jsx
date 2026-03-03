import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileText, CheckCircle, XCircle, Download, ExternalLink, AlertCircle, LogOut, User, Trash2,  Settings, Home, DollarSign, ArrowRight, ChevronDown, ChevronUp } from 'lucide-react';
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
const [user, setUser] = useState(null);
const [isAuthenticating, setIsAuthenticating] = useState(false);
const [authStep, setAuthStep] = useState('email');
const [authEmail, setAuthEmail] = useState('');
const [authOtp, setAuthOtp] = useState('');
const [authOtpError, setAuthOtpError] = useState('');
const [generatedOtp, setGeneratedOtp] = useState('');
const [otpExpiry, setOtpExpiry] = useState(null);
const defaultInvoices = [
{ id:9001, invoiceNumber:'INV-2001', vendor:'Adobe Inc.', date:'2025-02-01', dueDate:'2025-03-01', amount:'2350.00', taxAmount:'470.00', department:'Engineering', description:'CC license renewal', status:'Pending', submittedDate:'2025-02-01T10:00:00Z', submittedBy:'Jane Smith', approvedBy:null, approvedDate:null, lineItems:[], spendApprovalId:null, spendApprovalTitle:null },
{ id:9002, invoiceNumber:'INV-2002', vendor:'Dell Technologies', date:'2025-02-05', dueDate:'2025-03-05', amount:'8200.00', taxAmount:'1640.00', department:'Operations', description:'Laptop refresh x8', status:'Pending', submittedDate:'2025-02-05T14:00:00Z', submittedBy:'John Doe', approvedBy:null, approvedDate:null, lineItems:[], spendApprovalId:null, spendApprovalTitle:null },
{ id:9003, invoiceNumber:'INV-2003', vendor:'Dell Technologies', date:'2025-02-08', dueDate:'2025-03-08', amount:'1025.00', taxAmount:'205.00', department:'Operations', description:'Laptop refresh x1', status:'Approved', submittedDate:'2025-02-08T09:30:00Z', submittedBy:'John Doe', approvedBy:'Bob Johnson', approvedDate:'2025-02-09T11:00:00Z', lineItems:[], spendApprovalId:null, spendApprovalTitle:null },
{ id:9004, invoiceNumber:'INV-2004', vendor:'Clifford Chance', date:'2025-02-10', dueDate:'2025-03-10', amount:'12500.00', taxAmount:'2500.00', department:'Finance & Legal', description:'Legal consult phase 1', status:'Pending', submittedDate:'2025-02-10T16:00:00Z', submittedBy:'Jane Smith', approvedBy:null, approvedDate:null, lineItems:[], spendApprovalId:null, spendApprovalTitle:null },
{ id:9005, invoiceNumber:'INV-2005', vendor:'Amazon Web Services', date:'2025-02-12', dueDate:'2025-03-12', amount:'14800.00', taxAmount:'2960.00', department:'Engineering', description:'AWS Q1 infra', status:'Pending', submittedDate:'2025-02-12T08:00:00Z', submittedBy:'John Doe', approvedBy:null, approvedDate:null, lineItems:[], spendApprovalId:null, spendApprovalTitle:null },
{ id:9006, invoiceNumber:'INV-2006', vendor:'Google Cloud Platform', date:'2025-01-28', dueDate:'2025-02-28', amount:'11800.00', taxAmount:'2360.00', department:'Engineering', description:'GCP Q1 - Ref: SA-0006-ENG-CC200-US', status:'Approved', submittedDate:'2025-01-28T11:00:00Z', submittedBy:'John Doe', approvedBy:'Bob Johnson', approvedDate:'2025-01-30T09:00:00Z', lineItems:[], spendApprovalId:6, spendApprovalTitle:'GCP Cloud Hosting Q1' },
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
const [newCurrency, setNewCurrency] = useState({ code:'', name:'' });
const [newCategory, setNewCategory] = useState({ name:'' });
const [currencies, setCurrencies] = useState([
{ id:1, code:'GBP', name:'British Pound', active:true },
{ id:2, code:'USD', name:'US Dollar', active:true },
{ id:3, code:'EUR', name:'Euro', active:true }
]);
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
const [userToAnonymize, setUserToAnonymize] = useState(null);
const [gdprConfirmEmail, setGdprConfirmEmail] = useState('');
const [auditSearchTerm, setAuditSearchTerm] = useState('');
const [auditActionFilter, setAuditActionFilter] = useState('all');
const [auditDateFrom, setAuditDateFrom] = useState('');
const [auditDateTo, setAuditDateTo] = useState('');
const [mockUsers, setMockUsers] = useState([
{ id: 1, name: 'John Doe', email: 'john.doe@company.com', role: 'Admin', status: 'Active', createdAt: '2024-01-15T10:30:00Z', invitedBy: 'System', approvalLimit: 0, isCeo: true }, { id: 2, name: 'Jane Smith', email: 'jane.smith@company.com', role: 'Finance', status: 'Active', createdAt: '2024-02-01T14:20:00Z', invitedBy: 'John Doe', approvalLimit: 25000 }, { id: 3, name: 'Bob Johnson', email: 'bob.johnson@company.com', role: 'Approver', status: 'Active', createdAt: '2024-02-10T09:15:00Z', invitedBy: 'John Doe', approvalLimit: 10000 },
{ id: 4, name: 'Alice Williams', email: 'alice.williams@company.com', role: 'User', status: 'Active', createdAt: '2024-02-12T11:00:00Z', invitedBy: 'John Doe', approvalLimit: 0 } ]);
const [selectedFiles, setSelectedFiles] = useState([]);
const [extractedDataBatch, setExtractedDataBatch] = useState([]);
const [isProcessing, setIsProcessing] = useState(false);
const [processingProgress, setProcessingProgress] = useState({ current: 0, total: 0 });
const [hoveredInvoice, setHoveredInvoice] = useState(null);
const [selectedInvoiceIds, setSelectedInvoiceIds] = useState([]);
const [showColumnSelector, setShowColumnSelector] = useState(false);
const [visibleColumns, setVisibleColumns] = useState({ checkbox: true, invoiceNumber: true, vendor: true, amount: true, status: true, spendApproval: true, file: true, date: false, dueDate: false, submittedBy: false, approvedBy: false, approvedDate: false });
const [groupBy, setGroupBy] = useState('none');
const [spendForm, setSpendForm] = useState({ cc:'', title:'', currency:'', approver:'', amount:'', category:'', atom:'', vendor:'', costCentre:'', region:'', project:'', timeSensitive:false, exceptional:'', justification:'', department:'' });
const [spendSubmitted, setSpendSubmitted] = useState(false);
const [spendView, setSpendView] = useState('list');
const [selectedSpend, setSelectedSpend] = useState(null);
const [selectedSpendIds, setSelectedSpendIds] = useState([]);
const [spendSearch, setSpendSearch] = useState('');
const [showSpendFilterPanel, setShowSpendFilterPanel] = useState(false);
const [spendFilters, setSpendFilters] = useState({ status:'all', vendor:'all', category:'all', department:'all', project:'all', dateFrom:'', dateTo:'', amountMin:'', amountMax:'', submittedBy:'all', approver:'all' });
const updateSpendFilter = (k,v) => setSpendFilters(p => ({...p,[k]:v}));
const clearSpendFilters = () => setSpendFilters({ status:'all', vendor:'all', category:'all', project:'all', dateFrom:'', dateTo:'', amountMin:'', amountMax:'', submittedBy:'all', approver:'all' });
const getSpendFilterCount = () => { let c=0; if(spendFilters.status!=='all')c++; if(spendFilters.vendor!=='all')c++; if(spendFilters.category!=='all')c++; if(spendFilters.department!=='all')c++; if(spendFilters.project!=='all')c++; if(spendFilters.dateFrom)c++; if(spendFilters.dateTo)c++; if(spendFilters.amountMin)c++; if(spendFilters.amountMax)c++; if(spendFilters.submittedBy!=='all')c++; if(spendFilters.approver!=='all')c++; return c; };
const [spendGroupBy, setSpendGroupBy] = useState('none');
const [showSpendColSelector, setShowSpendColSelector] = useState(false);
const [spendVisibleCols, setSpendVisibleCols] = useState({ title:true, vendor:true, amount:true, invoiced:true, category:true, department:true, project:true, submittedBy:true, date:true, status:true, approver:true, region:false, costCentre:false, atom:false });
const toggleSpendCol = (col) => setSpendVisibleCols(p => ({...p,[col]:!p[col]}));
const [pendingMatches, setPendingMatches] = useState([]);
const findMatches = () => { const results = [];
const unlinkedInvs = invoices.filter(inv => inv && !inv.spendApprovalId);
spendApprovals.filter(sp => sp && sp.status === 'Approved').forEach(sp => { const suggestions = [];
const saRef = (sp.ref||'').toUpperCase(); const spVendor = (sp.vendor||'').toLowerCase(); const spAmt = parseFloat(sp.amount)||0;
const linkedInvs = invoices.filter(i => i.spendApprovalId === sp.id);
const totalInvoiced = linkedInvs.reduce((sum,i) => sum + (parseFloat(i.amount)||0), 0);
unlinkedInvs.forEach(inv => { let score = 0; let reasons = [];
const invDesc = ((inv.description||'') + ' ' + (inv.invoiceNumber||'')).toUpperCase();
if (saRef && invDesc.includes(saRef)) { score += 60; reasons.push('SA reference match'); }
const invVendor = (inv.vendor||'').toLowerCase();
if (invVendor && spVendor && (invVendor.includes(spVendor) || spVendor.includes(invVendor))) { score += 30; reasons.push('Vendor match'); }
else if (invVendor && spVendor) { const words = spVendor.split(/\s+/); if (words.some(w => w.length > 2 && invVendor.includes(w))) { score += 15; reasons.push('Partial vendor match'); } }
const invAmt = parseFloat(inv.amount)||0;
if (invAmt > 0 && spAmt > 0) { const diff = Math.abs(invAmt - spAmt) / spAmt; if (diff <= 0.1) { score += 20; reasons.push(`Amount ±${(diff*100).toFixed(0)}%`); } }
if (score >= 15) suggestions.push({ invoiceId: inv.id, invoiceNumber: inv.invoiceNumber||'', invoiceVendor: inv.vendor||'', invoiceAmount: inv.amount||'0', invoiceDate: inv.date||'', invoiceDueDate: inv.dueDate||'', invoiceDescription: inv.description||'', invoiceStatus: inv.status||'', invoiceSubmittedBy: inv.submittedBy||'', score, reasons }); });
if (suggestions.length > 0) results.push({ spendId: sp.id, spendRef: sp.ref||'', spendTitle: sp.title||'', spendVendor: sp.vendor||'', spendCurrency: sp.currency||'', spendAmount: sp.amount||'0', spendCategory: sp.category||'', spendRegion: sp.region||'', spendAtom: sp.atom||'', totalInvoiced, remaining: spAmt - totalInvoiced, linkedCount: linkedInvs.length, suggestions: suggestions.sort((a,b) => b.score - a.score) }); }); return results;};
const runAutoMatch = () => { const results = findMatches();
setPendingMatches(results);
if (results.length > 0) { setCurrentPage('matching'); } else { alert('No matching invoices found for any approved spend approvals.'); }};
const acceptMatch = (invoiceId, spendId) => { const inv = invoices.find(i => i.id === invoiceId); const sp = spendApprovals.find(s => s.id === spendId);
if (!inv || !sp) return;
setInvoices(prev => prev.map(i => i.id === invoiceId ? {...i, spendApprovalId: spendId, spendApprovalTitle: sp.title} : i));
setAuditLog(prev => [...prev, { id:Date.now()+Math.random(), action:'INVOICE_MATCHED', details:`Invoice ${inv.invoiceNumber} matched to spend approval "${sp.title}" (${sp.currency} ${sp.amount})`, performedBy:user.name, performedAt:new Date().toISOString() }]);
setPendingMatches(prev => prev.map(m => m.spendId===spendId ? {...m, suggestions: m.suggestions.filter(s=>s.invoiceId!==invoiceId)} : m).filter(m=>m.suggestions.length>0));};
const dismissSpendMatch = (spendId) => { setPendingMatches(prev => prev.filter(m => m.spendId !== spendId)); };
const unlinkInvoice = (invoiceId) => { const inv = invoices.find(i => i.id === invoiceId); if (!inv) return;
setInvoices(prev => prev.map(i => i.id === invoiceId ? {...i, spendApprovalId: null, spendApprovalTitle: null} : i));
setAuditLog(prev => [...prev, { id:Date.now(), action:'INVOICE_UNLINKED', details:`Invoice ${inv.invoiceNumber} unlinked from spend approval`, performedBy:user.name, performedAt:new Date().toISOString() }]);};
const getLinkedInvoices = (spendId) => invoices.filter(i => i.spendApprovalId === spendId);
const getSpendRemaining = (sp) => { const linked = getLinkedInvoices(sp.id); const total = linked.reduce((sum,i) => sum + (parseFloat(i.amount)||0), 0); return parseFloat(sp.amount) - total; };
const [spendApprovals, setSpendApprovals] = useState([
{ id:1, ref:'SA-0001-ENG-CC200-UK', department:'Engineering', title:'Adobe Creative Cloud License', currency:'GBP', amount:'2400', category:'Software', vendor:'Adobe Inc.', approver:'Bob Johnson', costCentre:'CC200', atom:'ENG', region:'UK', project:'Project Alpha', status:'Approved', submittedBy:'Jane Smith', submittedAt:'2025-01-15T10:30:00Z', exceptional:'No', timeSensitive:false, justification:'10 seat renewal.' },
{ id:2, ref:'SA-0002-ENG-CC200-US', department:'Engineering', title:'AWS Infrastructure Q2', currency:'USD', amount:'15000', category:'Software', vendor:'Amazon Web Services', approver:'Bob Johnson', costCentre:'CC200', atom:'ENG', region:'US', project:'Project Alpha', status:'Pending', submittedBy:'John Doe', submittedAt:'2025-02-01T14:20:00Z', exceptional:'No', timeSensitive:true, justification:'March launch infra.' },
{ id:3, ref:'SA-0003-MKT-CC400-EU', department:'Sales & Marketing', title:'Marketing Conference Travel', currency:'GBP', amount:'3500', category:'Travel', vendor:'Booking.com', approver:'Bob Johnson', costCentre:'CC400', atom:'MKT', region:'EU', project:'Project Beta', status:'Approved', submittedBy:'Jane Smith', submittedAt:'2025-02-10T09:15:00Z', exceptional:'No', timeSensitive:false, justification:'SaaStr Europa.' },
{ id:4, ref:'SA-0004-OPS-CC100-UK', department:'Finance & Legal', title:'Legal Consultation - Acquisition', currency:'GBP', amount:'25000', category:'Professional Services', vendor:'Clifford Chance LLP', approver:'John Doe', costCentre:'CC100', atom:'OPS', region:'UK', project:'Project Gamma', status:'Rejected', submittedBy:'Jane Smith', submittedAt:'2025-01-28T11:00:00Z', exceptional:'Yes', timeSensitive:true, justification:'DD legal review.' },
{ id:5, ref:'SA-0005-OPS-CC500-UK', department:'Operations', title:'Office Equipment Refresh', currency:'GBP', amount:'8500', category:'Hardware', vendor:'Dell Technologies', approver:'Bob Johnson', costCentre:'CC500', atom:'OPS', region:'UK', project:'Project Delta', status:'Approved', submittedBy:'John Doe', submittedAt:'2025-01-20T16:45:00Z', exceptional:'No', timeSensitive:false, justification:'Laptop refresh.' },
{ id:6, ref:'SA-0006-ENG-CC200-US', department:'Engineering', title:'GCP Cloud Hosting Q1', currency:'USD', amount:'12000', category:'Software', vendor:'Google Cloud Platform', approver:'Bob Johnson', costCentre:'CC200', atom:'ENG', region:'US', project:'Project Alpha', status:'Approved', submittedBy:'John Doe', submittedAt:'2025-01-10T09:00:00Z', exceptional:'No', timeSensitive:false, justification:'GCP Q1.' },
]);
const updateSpend = (k,v) => setSpendForm(p => ({...p,[k]:v}));
const [showFilterPanel, setShowFilterPanel] = useState(false);
const [filters, setFilters] = useState({ status: 'all', vendor: 'all', dateFrom: '', dateTo: '', amountMin: '', amountMax: '', submittedBy: 'all', approvedBy: 'all', searchTerm: '' });
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
const canUploadInvoices = () => { return user && ['Admin', 'Finance'].includes(user.role);};
const canDeleteInvoices = () => { return user && ['Admin', 'Finance'].includes(user.role);};
const canApproveReject = () => { return user && ['Admin', 'Finance', 'Approver'].includes(user.role);};
const canViewInvoices = () => { return user && ['Admin', 'Finance', 'Approver'].includes(user.role);};
const canManagePermissions = () => { return user && user.role === 'Admin';};
const canAssignInvoices = () => { return user && ['Admin', 'Finance', 'Approver'].includes(user.role);};
const getUserDepts = () => { if (!user) return []; if (user.role === 'Admin' || user.role === 'Finance') return []; return functions.filter(f => f.approver === user.name).map(f => f.name); };
const logout = () => { const auditEntry = { id: Date.now(), action: 'USER_LOGOUT', details: `User logged out`, performedBy: user.name, performedAt: new Date().toISOString()};
setAuditLog(prev => [...prev, auditEntry]); setTimeout(() => { setUser(null);
setCurrentPage('landing'); setInvoices(defaultInvoices);
setSelectedFiles([]);
setExtractedDataBatch([]);
setSelectedInvoiceIds([]);
setSelectedInvoice(null);
setShowSuccessNotification(false);
setShowDeleteConfirmation(false);
setDeleteConfirmationInput('');
setInvoiceToDelete(null); }, 100);};
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
setInvoices(invoices.map(inv => ({ ...inv, submittedBy: inv.submittedBy === userToRemove.name ? anonymousId : inv.submittedBy, approvedBy: inv.approvedBy === userToRemove.name ? anonymousId : inv.approvedBy })));
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
setInvoices(invoices.map(inv => ({ ...inv, submittedBy: inv.submittedBy === userToAnonymize.name ? anonymousId : inv.submittedBy, approvedBy: inv.approvedBy === userToAnonymize.name ? anonymousId : inv.approvedBy })));
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
const canApproveSpend = () => { return user && ['Admin', 'Finance', 'Approver'].includes(user.role);};
const canCreateSpend = () => { return user && ['Admin', 'Finance', 'Approver', 'User'].includes(user.role);};
const getRolePermissions = (role) => { const permissions = { 'Admin': [ 'Full system access', 'Upload and delete invoices', 'Approve/Reject invoices', 'Create spend approvals', 'Approve/Reject spend approvals', 'Assign invoices to spend approvals', 'Match invoices to spend approvals', 'Manage users, lookups & settings' ], 'Finance': [ 'Upload and delete invoices', 'Approve/Reject invoices', 'Create spend approvals', 'Approve/Reject spend approvals', 'Assign invoices to spend approvals', 'Match invoices to spend approvals', 'Cannot manage system settings' ], 'Approver': [
'Create spend approvals', 'Approve/Reject spend approvals', 'Assign invoices to spend approvals', 'Match invoices to spend approvals', 'View all invoices (read-only)', 'Cannot upload or delete invoices', 'Cannot manage system settings' ], 'User': [
'Create spend approvals', 'View only own spend approvals', 'Cannot approve/reject spend approvals', 'Cannot view or manage invoices', 'Cannot manage system settings' ]};
return permissions[role] || [];};
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
const extractedBatch = [];
for (let i = 0; i < files.length; i++) { const file = files[i];
setProcessingProgress({ current: i + 1, total: files.length });
await new Promise(resolve => setTimeout(resolve, 1500)); const mockData = { invoiceNumber: `INV-${Math.floor(Math.random() * 10000)}`, vendor: ['Adobe Inc.', 'Dell Technologies', 'Amazon Web Services', 'Acme Corp', 'TechSupplies Inc'][Math.floor(Math.random() * 5)], date: new Date().toISOString().split('T')[0], dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], amount: (Math.random() * 50000 + 1000).toFixed(2), taxAmount: (Math.random() * 5000).toFixed(2), description: 'Professional services rendered', lineItems: [
{ description: 'Consulting Services', quantity: 40, rate: 150, amount: 6000 }, { description: 'Software License', quantity: 1, rate: 2500, amount: 2500 } ], fileName: file.name, fileUrl: URL.createObjectURL(file), fileType: file.type};
extractedBatch.push(mockData);}
setExtractedDataBatch(extractedBatch);
setIsProcessing(false);};
const processInvoiceBatch = async () => { if (extractedDataBatch.length === 0) return;
setIsProcessing(true);
setProcessingProgress({ current: 0, total: extractedDataBatch.length });
const newInvoices = [];
for (let i = 0; i < extractedDataBatch.length; i++) { const extractedData = extractedDataBatch[i];
setProcessingProgress({ current: i + 1, total: extractedDataBatch.length });
const newInvoice = { id: Date.now() + i, ...extractedData, status: 'Pending', submittedDate: new Date().toISOString(), submittedBy: user.name, approvedBy: null, approvedDate: null, spendApprovalId: null, spendApprovalTitle: null};
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
const updateApprovalStatus = async (invoiceId, status, approver) => { const invoice = invoices.find(inv => inv.id === invoiceId);
const updatedInvoices = invoices.map(inv => inv.id === invoiceId ? { ...inv, status, approvedBy: approver, approvedDate: new Date().toISOString()} : inv);
setInvoices(updatedInvoices);
const auditEntry = { id: Date.now(), action: status === 'Approved' ? 'INVOICE_APPROVED' : 'INVOICE_REJECTED', details: `Invoice ${invoice.invoiceNumber} ${status.toLowerCase()} - Vendor: ${invoice.vendor}, Amount: ${invoice.amount}`, invoiceNumber: invoice.invoiceNumber, performedBy: approver, performedAt: new Date().toISOString()};
setAuditLog([...auditLog, auditEntry]);
if (selectedInvoice && selectedInvoice.id === invoiceId) { const updatedInvoice = updatedInvoices.find(inv => inv.id === invoiceId);
setSelectedInvoice(updatedInvoice);
setNotificationMessage(`Invoice ${invoice.invoiceNumber} has been ${status.toLowerCase()} successfully!`);
setShowSuccessNotification(true);}};
const bulkUpdateApprovalStatus = async (status, approver) => { if (selectedInvoiceIds.length === 0) { alert('Please select invoices to approve/reject'); return;}
const selectedInvoices = invoices.filter(inv => selectedInvoiceIds.includes(inv.id) && inv.status === 'Pending');
setInvoices(invoices.map(inv => selectedInvoiceIds.includes(inv.id) && inv.status === 'Pending' ? { ...inv, status, approvedBy: approver, approvedDate: new Date().toISOString()} : inv));
const auditEntry = { id: Date.now(), action: status === 'Approved' ? 'BULK_APPROVAL' : 'BULK_REJECTION', details: `Bulk ${status.toLowerCase()} of ${selectedInvoices.length} invoice(s): ${selectedInvoices.map(inv => inv.invoiceNumber).join(', ')}`, performedBy: approver, performedAt: new Date().toISOString()};
setAuditLog([...auditLog, auditEntry]);
setSelectedInvoiceIds([]);};
const toggleInvoiceSelection = (invoiceId) => { setSelectedInvoiceIds(prev => prev.includes(invoiceId) ? prev.filter(id => id !== invoiceId) : [...prev, invoiceId]);};
const toggleSelectAll = () => { const pendingInvoices = invoices.filter(inv => inv.status === 'Pending');
if (selectedInvoiceIds.length === pendingInvoices.length) { setSelectedInvoiceIds([]); } else { setSelectedInvoiceIds(pendingInvoices.map(inv => inv.id));}};
const toggleColumnVisibility = (columnKey) => { setVisibleColumns(prev => ({ ...prev, [columnKey]: !prev[columnKey] }));};
const updateFilter = (key, value) => { setFilters(prev => ({ ...prev, [key]: value }));
const auditEntry = { id: Date.now(), action: 'FILTER_APPLIED', details: `Filter applied: ${key} = ${value}`, performedBy: user.name, performedAt: new Date().toISOString()};
setAuditLog(prev => [...prev, auditEntry]);};
const clearFilters = () => { setFilters({ status: 'all', vendor: 'all', dateFrom: '', dateTo: '', amountMin: '', amountMax: '', submittedBy: 'all', approvedBy: 'all', searchTerm: '' });
const auditEntry = { id: Date.now(), action: 'FILTERS_CLEARED', details: 'All filters cleared', performedBy: user.name, performedAt: new Date().toISOString()};
setAuditLog([...auditLog, auditEntry]);};
const getFilteredInvoices = () => { const depts = getUserDepts(); return invoices.filter(invoice => { if (user.role === 'Approver' && depts.length > 0 && !depts.includes(invoice.department)) return false; if (filters.status !== 'all' && invoice.status !== filters.status) { return false;}
if (filters.vendor !== 'all' && invoice.vendor !== filters.vendor) { return false;}
if (filters.dateFrom && invoice.date < filters.dateFrom) { return false;}
if (filters.dateTo && invoice.date > filters.dateTo) { return false;}
if (filters.amountMin && parseFloat(invoice.amount) < parseFloat(filters.amountMin)) { return false;}
if (filters.amountMax && parseFloat(invoice.amount) > parseFloat(filters.amountMax)) { return false;}
if (filters.submittedBy !== 'all' && invoice.submittedBy !== filters.submittedBy) { return false;}
if (filters.approvedBy !== 'all' && invoice.approvedBy !== filters.approvedBy) { return false;}
if (filters.searchTerm) { const searchLower = filters.searchTerm.toLowerCase();
const matchesSearch =
invoice.invoiceNumber.toLowerCase().includes(searchLower) || invoice.vendor.toLowerCase().includes(searchLower) || (invoice.description && invoice.description.toLowerCase().includes(searchLower));
if (!matchesSearch) { return false;}} return true; });};
const getGroupedInvoices = () => { const filteredInvoices = getFilteredInvoices();
if (groupBy === 'none') { return { 'All Invoices': filteredInvoices };} const grouped = {};
filteredInvoices.forEach(invoice => { let groupKey; switch (groupBy) { case 'status': groupKey = invoice.status; break; case 'vendor': groupKey = invoice.vendor; break; case 'date': groupKey = invoice.date; break; case 'submittedBy': groupKey = invoice.submittedBy || 'Unknown'; break; case 'approvedBy': groupKey = invoice.approvedBy || 'Not Yet Approved'; break; default: groupKey = 'All Invoices';}
if (!grouped[groupKey]) { grouped[groupKey] = [];}
grouped[groupKey].push(invoice); }); return grouped;};
const getUniqueVendors = () => { return [...new Set(invoices.map(inv => inv.vendor).filter(Boolean))].sort();};
const getUniqueSubmitters = () => { return [...new Set(invoices.map(inv => inv.submittedBy).filter(Boolean))].sort();};
const getUniqueApprovers = () => { return [...new Set(invoices.map(inv => inv.approvedBy).filter(Boolean))].sort();};
const getActiveFilterCount = () => { let count = 0;
if (filters.status !== 'all') count++;
if (filters.vendor !== 'all') count++;
if (filters.dateFrom) count++;
if (filters.dateTo) count++;
if (filters.amountMin) count++;
if (filters.amountMax) count++;
if (filters.submittedBy !== 'all') count++;
if (filters.approvedBy !== 'all') count++;
if (filters.searchTerm) count++; return count;};
const exportToExcel = () => { const headers = ['Invoice #', 'Vendor', 'Date', 'Amount', 'Status', 'Submitted By', 'Approved By', 'Approved Date'];
const rows = invoices.map(inv => [ inv.invoiceNumber, inv.vendor, inv.date, inv.amount, inv.status, inv.submittedBy || 'N/A', inv.approvedBy || 'N/A', inv.approvedDate ? new Date(inv.approvedDate).toLocaleDateString() : 'N/A' ]);
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
<div className="mt-8 text-center text-sm text-gray-500"> <p>OTP authentication</p></div> <div className="mt-6 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700"> <p className="font-semibold text-blue-800 mb-1">Demo credentials:</p> <p>john.doe@company.com / 123456 (Admin) • jane.smith@company.com / 234567 (Finance) • bob.johnson@company.com / 345678 (Approver) • alice.williams@company.com / 456789 (User)</p></div></div></div>);}
if (currentPage === 'landing') { const h = new Date().getHours();
const g = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
return (<div className={_pg}><div className="max-w-5xl mx-auto"> <div className="bg-white rounded-lg shadow-lg p-6 mb-8"><div className={_fj}> <div className="flex items-center space-x-3"><Home className="w-8 h-8 text-indigo-600"/><div><h1 className="text-2xl font-bold text-gray-800">{g}, {user.name.split(' ')[0]}</h1><p className="text-sm text-gray-500">Invoice Workflow Dashboard</p></div></div>
<div className="flex items-center space-x-4"><div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 rounded-lg"><User className="w-5 h-5 text-indigo-600"/><div className="text-sm"><p className="font-semibold text-gray-800">{user.name}</p><p className="text-xs text-gray-600">{user.role}</p></div></div> <button onClick={logout} className="flex items-center space-x-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"><LogOut className="w-4 h-4"/><span>Logout</span></button></div> </div></div> <div className={`grid grid-cols-1 ${user.role === 'User' ? 'md:grid-cols-1 max-w-md mx-auto' : canManagePermissions() ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-6`}>
{user.role !== 'User' && <button onClick={() => setCurrentPage('invoices')} className="bg-white rounded-xl shadow-lg hover:shadow-xl border-2 border-transparent hover:border-indigo-400 text-left p-8"><div className="flex items-center justify-center w-16 h-16 bg-indigo-100 rounded-2xl mb-6"><FileText className="w-8 h-8 text-indigo-600"/></div><h2 className="text-xl font-bold text-gray-800 mb-2">Process Invoices</h2><p className="text-gray-500 text-sm mb-6">Upload, track, and manage invoices through the approval workflow.</p><div className="flex items-center text-indigo-600 font-semibold text-sm"><span>Open Invoice Tracker</span><ArrowRight className="w-4 h-4 ml-2"/></div></button>}
<button onClick={() => setCurrentPage('spend-approval')} className="bg-white rounded-xl shadow-lg hover:shadow-xl border-2 border-transparent hover:border-green-400 text-left p-8"><div className="flex items-center justify-center w-16 h-16 bg-green-100 rounded-2xl mb-6"><DollarSign className="w-8 h-8 text-green-600"/></div><h2 className="text-xl font-bold text-gray-800 mb-2">Raise Spend Approvals</h2><p className="text-gray-500 text-sm mb-6">Submit new spend approval requests for review and authorization.</p><div className="flex items-center text-green-600 font-semibold text-sm"><span>Submit Request</span><ArrowRight className="w-4 h-4 ml-2"/></div></button>
{(canManagePermissions() || user.role === 'Finance') && (<button onClick={() => { setSettingsTab(canManagePermissions() ? 'users' : 'atoms'); setCurrentPage('settings'); }} className="bg-white rounded-xl shadow-lg hover:shadow-xl border-2 border-transparent hover:border-purple-400 text-left p-8"><div className="flex items-center justify-center w-16 h-16 bg-purple-100 rounded-2xl mb-6"><Settings className="w-8 h-8 text-purple-600"/></div><h2 className="text-xl font-bold text-gray-800 mb-2">System Settings</h2><p className="text-gray-500 text-sm mb-6">{canManagePermissions() ? 'Manage users, roles, lookups, and audit logs.' : 'View lookups and audit logs.'}</p><div className="flex items-center text-purple-600 font-semibold text-sm"><span>Open Settings</span><ArrowRight className="w-4 h-4 ml-2"/></div></button>)}
</div> </div></div>);}
if (currentPage === 'spend-approval') { const sf = spendForm;
const sfc = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500";
const slc = "block text-sm font-medium text-gray-700 mb-1";
const req = <span className="text-red-500">*</span>;
const filteredSpends = spendApprovals.filter(s => { if (user.role === 'User' && s.submittedBy !== user.name) return false;
const depts = getUserDepts(); if (user.role === 'Approver' && depts.length > 0 && !depts.includes(s.department)) return false;
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
const newApproval = { id: Date.now(), ref, title:sf.title, currency:sf.currency, amount:sf.amount, category:sf.category, vendor:sf.vendor, approver:sf.approver, costCentre:sf.costCentre, atom:sf.atom, region:sf.region, project:sf.project, department:sf.department, status:'Pending', submittedBy:user.name, submittedAt:new Date().toISOString(), exceptional:sf.exceptional, timeSensitive:sf.timeSensitive, justification:sf.justification };
setSpendApprovals(prev => [newApproval, ...prev]);
const entry = { id: Date.now(), action:'SPEND_REQUEST', details:`Spend approval: ${sf.title} - ${sf.currency} ${sf.amount} - Vendor: ${sf.vendor}`, performedBy: user.name, performedAt: new Date().toISOString() };
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
await new Promise(resolve => setTimeout(resolve, 1500));
const invNum = `INV-${Math.floor(Math.random() * 10000)}`;
const newInvoice = {
id: Date.now() + i,
invoiceNumber: invNum,
vendor: spend.vendor,
date: new Date().toISOString().split('T')[0],
dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
amount: (Math.random() * 50000 + 1000).toFixed(2),
taxAmount: (Math.random() * 5000).toFixed(2),
department: spend.department,
description: `Invoice for ${spend.title}`,
lineItems: [{ description: 'Services', quantity: 1, rate: 1000, amount: 1000 }],
fileName: file.name,
fileUrl: URL.createObjectURL(file),
fileType: file.type,
status: 'Pending',
submittedDate: new Date().toISOString(),
submittedBy: user.name,
approvedBy: null,
approvedDate: null,
spendApprovalId: spend.id,
spendApprovalTitle: spend.title
};
newInvoices.push(newInvoice);
setAuditLog(prev => [...prev, { id: Date.now() + i + 2000, action: 'INVOICE_UPLOADED_TO_SPEND', details: `Invoice ${invNum} uploaded to spend approval "${spend.title}" (${spend.ref}) - Vendor: ${spend.vendor}, Amount: ${newInvoice.amount}`, performedBy: user.name, performedAt: new Date().toISOString() }]);
}
setInvoices(prev => [...prev, ...newInvoices]);
setIsProcessing(false);
setProcessingProgress({ current: 0, total: 0 });
if (spendFileInputRef.current) { spendFileInputRef.current.value = ''; }
setSelectedSpend({...spend});
};
const navBar = (<div className="bg-white rounded-lg shadow-lg p-6 mb-6"><div className={_fj}> <div className="flex items-center space-x-3"><DollarSign className="w-8 h-8 text-green-600"/><h1 className="text-2xl font-bold text-gray-800">{spendView === 'list' ? 'Spend Approvals' : 'Raise Spend Approval'}</h1></div>
<div className="flex items-center space-x-4"><div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 rounded-lg"><User className="w-5 h-5 text-indigo-600"/><div className="text-sm"><p className="font-semibold text-gray-800">{user.name}</p><p className="text-xs text-gray-600">{user.role}</p></div></div><button onClick={() => setCurrentPage('landing')} className="flex items-center space-x-2 px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200"><Home className="w-4 h-4"/><span>Dashboard</span></button><button onClick={logout} className="flex items-center space-x-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"><LogOut className="w-4 h-4"/><span>Logout</span></button></div>
</div></div>);
if (spendSubmitted) { return (<div className={_pg}><div className="max-w-3xl mx-auto">{navBar}
<div className="bg-white rounded-xl shadow-lg p-12 text-center"> <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4"/> <h2 className="text-2xl font-bold text-gray-800 mb-3">Request Submitted</h2> <p className="text-gray-500 mb-2">Your spend approval for <strong>{sf.title}</strong> has been submitted.</p> <p className="text-gray-500 mb-8">{sf.currency} {sf.amount} • Approver: {sf.approver}</p> <div className="flex justify-center space-x-4">
<button onClick={() => { setSpendForm({ cc:'', title:'', currency:'', approver:'', amount:'', category:'', atom:'', vendor:'', costCentre:'', region:'', project:'', timeSensitive:false, exceptional:'', justification:'', department:'' }); setSpendSubmitted(false); }} className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold">Submit Another</button> <button onClick={() => { setSpendSubmitted(false); setSpendView('list'); }} className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-semibold">View All Requests</button></div></div> </div></div>);}
if (selectedSpend) { const s = selectedSpend;
const sBadge2 = (status) => { const c = {Pending:'bg-yellow-100 text-yellow-800',Approved:'bg-green-100 text-green-800',Rejected:'bg-red-100 text-red-800',Escalated:'bg-orange-100 text-orange-800'}; return <span className={`px-3 py-1 rounded-full text-sm font-semibold ${c[status]||'bg-gray-100 text-gray-800'}`}>{status}</span>; };
const dRow = (label, val) => (<div className="py-3 border-b border-gray-100 grid grid-cols-3"><span className="text-sm font-medium text-gray-500">{label}</span><span className="text-sm text-gray-900 col-span-2">{val}</span></div>);
return (<div className={_pg}><div className="max-w-3xl mx-auto">{navBar}
<div className="bg-white rounded-xl shadow-lg p-8"> <div className={_fj+" mb-6"}> <button onClick={() => setSelectedSpend(null)} className="text-sm text-indigo-600 hover:text-indigo-800 font-semibold">← Back to list</button> {sBadge2(s.status)}</div> <h2 className="text-2xl font-bold text-gray-800 mb-1">{s.title}</h2> <p className="font-mono text-sm text-indigo-600 font-semibold mb-1">{s.ref}</p> <p className="text-sm text-gray-500 mb-6">Submitted by {s.submittedBy} on {new Date(s.submittedAt).toLocaleDateString('en-GB', {day:'numeric',month:'long',year:'numeric'})}</p> <div className="mb-6">
{dRow('Requested Amount', <span className="font-semibold">{s.currency} {Number(s.amount).toLocaleString()}</span>)}
{dRow('Function / Department', s.department || '—')}
{dRow('Vendor / Supplier', s.vendor)}
{dRow('Spend Category', s.category)}
{dRow('Approver', <span>{s.approver} {(() => { const au = mockUsers.find(u=>u.name===s.approver); return au && au.approvalLimit > 0 ? <span className="text-xs text-gray-500 ml-1">(limit: {s.currency} {au.approvalLimit.toLocaleString()})</span> : au?.isCeo ? <span className="text-xs text-gray-500 ml-1">(unlimited)</span> : null; })()}</span>)}
{dRow('Atom', (() => { const a = atoms.find(x=>x.code===s.atom); return a ? `${a.code} — ${a.name}` : s.atom; })())}
{dRow('Cost Centre', (() => { const c = costCentres.find(x=>x.code===s.costCentre); return c ? `${c.code} — ${c.name}` : s.costCentre; })())}
{dRow('Region', (() => { const r = regions.find(x=>x.code===s.region); return r ? `${r.code} — ${r.name}` : s.region||'—'; })())}
{dRow('Project', s.project || '—')}
{dRow('Exceptional Item', s.exceptional)}
{dRow('Time-sensitive', s.timeSensitive ? <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded font-semibold">Yes - Urgent</span> : 'No')}</div> <div className="mb-6"><h3 className="text-sm font-medium text-gray-500 mb-2">Business Justification</h3><div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-800">{s.justification || 'No justification provided.'}</div></div> <div className="mb-6"><h3 className="text-sm font-medium text-gray-500 mb-2">Linked Invoices</h3>
{(() => { const linked = getLinkedInvoices(s.id); const totalInvoiced = linked.reduce((sum,i) => sum + (parseFloat(i.amount)||0), 0); const remaining = parseFloat(s.amount) - totalInvoiced; return (<> {linked.length > 0 ? (<>
<div className="mb-3 flex items-center space-x-4 text-sm"><span className="text-gray-600">Approved: <strong>{s.currency} {Number(s.amount).toLocaleString()}</strong></span><span className="text-gray-600">Invoiced: <strong>{s.currency} {totalInvoiced.toLocaleString()}</strong></span><span className={remaining < 0 ? 'text-red-600 font-semibold' : 'text-green-600 font-semibold'}>Remaining: {s.currency} {remaining.toLocaleString()}</span></div>
<div className="w-full bg-gray-200 rounded-full h-2 mb-3"><div className={`h-2 rounded-full ${remaining < 0 ? 'bg-red-500' : 'bg-green-500'}`} style={{width:`${Math.min(100,totalInvoiced/parseFloat(s.amount)*100)}%`}}></div></div>
<div className="space-y-2">{linked.map(inv => (<div key={inv.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border"><div><span className="font-medium text-gray-800">{inv.invoiceNumber}</span><span className="text-sm text-gray-500 ml-2">{inv.vendor} • ${inv.amount}</span></div><span className={`px-2 py-0.5 rounded text-xs font-semibold ${inv.status==='Approved'?'bg-green-100 text-green-700':inv.status==='Rejected'?'bg-red-100 text-red-700':'bg-yellow-100 text-yellow-700'}`}>{inv.status}</span></div>))}</div>
</>) : <p className="text-sm text-gray-500">No invoices linked yet.</p>} </>); })()}
{s.status === 'Escalated' && (<div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg"><p className="text-sm text-orange-800"><strong>Escalated:</strong> Approved by {s.approvedBy} but exceeds their limit. Awaiting {s.escalatedTo||'CEO'} approval.</p></div>)}
{s.status === 'Approved' && canAssignInvoices() && (() => { const unlinkedInvs = invoices.filter(i => !i.spendApprovalId); return unlinkedInvs.length > 0 ? (<div className="mt-4 pt-3 border-t border-gray-200"><label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Assign Invoice</label><select defaultValue="" onChange={e => { if (e.target.value) { const invId = Number(e.target.value); acceptMatch(invId, s.id); const inv = invoices.find(i=>i.id===invId); setSelectedSpend({...s}); } }} className={`w-full ${_g}`}><option value="" disabled>Select an unlinked invoice...</option>{unlinkedInvs.map(i => (<option key={i.id} value={i.id}>{i.invoiceNumber} — {i.vendor} (${i.amount})</option>))}</select></div>) : null; })()}
{s.status === 'Approved' && canAssignInvoices() && (<div className="mt-4 pt-3 border-t border-gray-200">
<input type="file" ref={spendFileInputRef} accept="application/pdf,image/*" multiple className="hidden" onChange={e => { if (e.target.files.length > 0) uploadInvoiceToSpend(e.target.files, s); }}/>
<button onClick={() => spendFileInputRef.current && spendFileInputRef.current.click()} disabled={isProcessing} className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed">
<Upload className="w-4 h-4"/><span>{isProcessing ? `Processing ${processingProgress.current} of ${processingProgress.total}...` : 'Upload Invoice'}</span>
{isProcessing && <svg className="animate-spin w-4 h-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
</button></div>)}
</div> {(s.status === 'Pending' || s.status === 'Escalated') && canApproveSpend() && (s.status !== 'Escalated' || user.isCeo || user.role === 'Admin') && (<div className="flex space-x-3 pt-4 border-t border-gray-200"> <button onClick={() => { updateSpendStatus(s.id,'Approved'); setSelectedSpend({...s,status:'Approved'}); }} className="px-5 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold">{s.status === 'Escalated' ? 'Final Approve' : 'Approve'}</button>
<button onClick={() => { updateSpendStatus(s.id,'Rejected'); setSelectedSpend({...s,status:'Rejected'}); }} className="px-5 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-semibold">Reject</button></div>)}</div> </div></div>);}
if (spendView === 'form') { return (<div className={_pg}><div className="max-w-3xl mx-auto">{navBar}
<div className="bg-white rounded-xl shadow-lg p-8"> <div className={_fj+" mb-6"}><p className="text-sm text-gray-500">Required fields are marked with an asterisk <span className="text-red-500">*</span></p><button onClick={() => setSpendView('list')} className="text-sm text-indigo-600 hover:text-indigo-800 font-semibold">← Back to list</button></div>
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
<div className="flex items-center space-x-4 pt-4 border-t border-gray-200"><button onClick={submitSpend} className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold">Send</button><button onClick={() => setSpendView('list')} className="px-6 py-3 text-gray-600 hover:text-gray-800 transition font-semibold">Cancel</button></div></div> </div></div>);}
const sBadge = (status) => { const c = {Pending:'bg-yellow-100 text-yellow-800',Approved:'bg-green-100 text-green-800',Rejected:'bg-red-100 text-red-800',Escalated:'bg-orange-100 text-orange-800'}; return <span className={`px-2 py-1 rounded-full text-xs font-semibold ${c[status]||'bg-gray-100 text-gray-800'}`}>{status}</span>; };
const pendingFiltered = filteredSpends.filter(s => s.status === 'Pending');
const allPendingSelected = pendingFiltered.length > 0 && pendingFiltered.every(s => selectedSpendIds.includes(s.id));
const toggleSpendSelect = (id) => setSelectedSpendIds(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev,id]);
const toggleAllSpend = () => { if (allPendingSelected) { setSelectedSpendIds([]); } else { setSelectedSpendIds(pendingFiltered.map(s=>s.id)); } };
const getCeoUser = () => mockUsers.find(u => u.isCeo && u.status === 'Active');
const updateSpendStatus = (id, status) => { const item = spendApprovals.find(s=>s.id===id);
if (status === 'Approved' && item.status === 'Pending') { const approverUser = mockUsers.find(u => u.name === user.name);
const limit = approverUser?.approvalLimit || 0; const amt = parseFloat(item.amount) || 0;
if (limit > 0 && amt > limit && !approverUser?.isCeo) { const ceo = getCeoUser();
setSpendApprovals(prev => prev.map(s => s.id===id ? {...s, status:'Escalated', approvedBy:user.name, escalatedTo:ceo?.name||'CEO', escalatedAt:new Date().toISOString()} : s));
setAuditLog(prev => [...prev, { id:Date.now(), action:'SPEND_ESCALATED', details:`"${item.title}" (${item.currency} ${item.amount}) exceeds ${user.name}'s limit (${item.currency} ${limit.toLocaleString()}) - escalated to ${ceo?.name||'CEO'}`, performedBy:user.name, performedAt:new Date().toISOString() }]); return; }}
setSpendApprovals(prev => prev.map(s => s.id===id ? {...s, status, approvedBy:status==='Approved'||status==='Rejected'?user.name:s.approvedBy} : s));
setAuditLog(prev => [...prev, { id:Date.now(), action:`SPEND_${status.toUpperCase()}`, details:`Spend request "${item.title}" (${item.currency} ${item.amount}) ${status.toLowerCase()} - Vendor: ${item.vendor}`, performedBy:user.name, performedAt:new Date().toISOString() }]);};
const bulkUpdateSpend = (status) => { const items = spendApprovals.filter(s => selectedSpendIds.includes(s.id) && (s.status==='Pending'||s.status==='Escalated'));
items.forEach(item => { updateSpendStatus(item.id, status); });
setSelectedSpendIds([]);};
return (<div className={_pg}><div className="max-w-7xl mx-auto">{navBar}
<div className="bg-white rounded-xl shadow-lg p-6"> <div className={_fj+" mb-6"}> <h2 className="text-2xl font-bold text-gray-800">Spend Approval Tracking</h2> <div className="flex items-center space-x-3"> {selectedSpendIds.length > 0 && canApproveSpend() && (<> <span className="text-sm text-gray-600">{selectedSpendIds.length} selected</span>
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
<div className="relative"><label className="text-sm text-gray-600 mr-2">Group By:</label><select value={spendGroupBy} onChange={e => setSpendGroupBy(e.target.value)} className={_g}><option value="none">None</option><option value="status">Status</option><option value="vendor">Vendor</option><option value="category">Category</option><option value="department">Function</option><option value="submittedBy">Submitted By</option><option value="approver">Approver</option></select></div> <div className="relative">
<button onClick={() => setShowSpendColSelector(!showSpendColSelector)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300" >Columns</button> {showSpendColSelector && (<div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 p-4 z-10"> <h3 className="font-semibold text-gray-800 mb-3">Show/Hide Columns</h3> <div className="space-y-2">
{Object.entries({title:'Title',vendor:'Vendor',amount:'Amount',invoiced:'Invoiced',category:'Category',department:'Function',project:'Project',submittedBy:'Submitted By',date:'Date',status:'Status',approver:'Approver',region:'Region',costCentre:'Cost Centre',atom:'Atom'}).map(([k,label])=>(<label key={k} className="flex items-center space-x-2 cursor-pointer"><input type="checkbox" checked={spendVisibleCols[k]} onChange={() => toggleSpendCol(k)} className="w-4 h-4 text-green-600 rounded"/><span className="text-sm text-gray-700">{label}</span></label>))} </div></div>)}</div></div></div>
<div className={_fj+" mb-4"}> <span className="text-sm text-gray-500">{filteredSpends.length} of {spendApprovals.length} requests</span> <div className="flex items-center space-x-3">
{canCreateSpend() && <button onClick={() => { setSpendForm({ cc:'', title:'', currency:'', approver:'', amount:'', category:'', atom:'', vendor:'', costCentre:'', region:'', project:'', timeSensitive:false, exceptional:'', justification:'', department:'' }); setSpendView('form'); }} className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold text-sm"><DollarSign className="w-4 h-4"/><span>Create Spend Approval</span></button>}
{canAssignInvoices() && <button onClick={runAutoMatch} className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-semibold text-sm"><ExternalLink className="w-4 h-4"/><span>Match Invoices</span></button>}</div></div> <div className="overflow-x-auto"><table className="w-full text-left">
<thead><tr className="border-b border-gray-200"> {canApproveSpend() && <th className="px-4 py-3 w-10"><input type="checkbox" checked={allPendingSelected} onChange={toggleAllSpend} className="w-4 h-4 text-green-600 rounded"/></th>}
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
{canApproveSpend() && <th className={_th}>Actions</th>} </tr></thead> <tbody>{(spendGroupBy !== 'none' ? [...filteredSpends].sort((a,b) => { const ka = spendGroupBy==='date' ? a.submittedAt : a[spendGroupBy]||''; const kb = spendGroupBy==='date' ? b.submittedAt : b[spendGroupBy]||''; return ka<kb?-1:ka>kb?1:0; }) : filteredSpends).map((s,i,arr) => { const groupKey = spendGroupBy==='date' ? new Date(s.submittedAt).toLocaleDateString() : s[spendGroupBy];
const prevKey = i>0 ? (spendGroupBy==='date' ? new Date(arr[i-1].submittedAt).toLocaleDateString() : arr[i-1][spendGroupBy]) : null;
const showHeader = spendGroupBy !== 'none' && groupKey !== prevKey;
return (<React.Fragment key={s.id}> {showHeader && <tr className="bg-gray-50"><td colSpan={99} className="px-4 py-2 text-sm font-semibold text-gray-700">{groupKey}</td></tr>}
<tr className="border-b border-gray-100 hover:bg-gray-50"> {canApproveSpend() && <td className="px-4 py-3">{(s.status==='Pending' || s.status==='Escalated') ? <input type="checkbox" checked={selectedSpendIds.includes(s.id)} onChange={() => toggleSpendSelect(s.id)} className="w-4 h-4 text-green-600 rounded"/> : null}</td>}
{spendVisibleCols.title && <td className="px-4 py-3 text-sm font-medium"><button onClick={() => setSelectedSpend(s)} className="text-indigo-600 hover:text-indigo-800 hover:underline text-left font-medium">{s.title}</button>{s.timeSensitive && <span className="ml-2 px-1.5 py-0.5 bg-orange-100 text-orange-700 text-xs rounded">Urgent</span>}</td>}
{spendVisibleCols.vendor && <td className={_td}>{s.vendor}</td>}
{spendVisibleCols.amount && <td className="px-4 py-3 text-sm text-gray-800 font-semibold">{s.currency} {Number(s.amount).toLocaleString()}</td>}
{spendVisibleCols.invoiced && (() => { const linked = getLinkedInvoices(s.id); const total = linked.reduce((sum,i) => sum + (parseFloat(i.amount)||0), 0); const approved = parseFloat(s.amount)||0; const pct = approved > 0 ? (total/approved)*100 : 0; const colour = linked.length === 0 ? 'text-gray-400' : pct > 100 ? 'text-red-600' : pct >= 90 ? 'text-green-600' : pct >= 50 ? 'text-orange-600' : 'text-yellow-600'; return <td className="px-4 py-3 text-sm"><div className={`font-semibold ${colour}`}>{s.currency} {total.toLocaleString()}</div><div className="w-full bg-gray-200 rounded-full h-1.5 mt-1"><div className={`h-1.5 rounded-full ${pct > 100 ? 'bg-red-500' : pct >= 90 ? 'bg-green-500' : pct >= 50 ? 'bg-orange-400' : pct > 0 ? 'bg-yellow-400' : 'bg-gray-200'}`} style={{width:`${Math.min(100,pct)}%`}}></div></div><div className="text-xs text-gray-500 mt-0.5">{pct.toFixed(0)}% • {linked.length} inv</div></td>; })()}
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
{canApproveSpend() && <td className="px-4 py-3">{(s.status==='Pending' || (s.status==='Escalated' && (user.isCeo || user.role==='Admin'))) && <div className="flex space-x-1"><button onClick={() => updateSpendStatus(s.id,'Approved')} className="p-1 text-green-600 hover:bg-green-50 rounded" title="Approve"><CheckCircle className="w-4 h-4"/></button><button onClick={() => updateSpendStatus(s.id,'Rejected')} className="p-1 text-red-600 hover:bg-red-50 rounded" title="Reject"><XCircle className="w-4 h-4"/></button></div>}</td>} </tr></React.Fragment>); })}</tbody> </table></div>
{filteredSpends.length === 0 && <div className="text-center py-12"><p className="text-gray-500">No results found.</p></div>}</div> </div></div>);}
if (currentPage === 'matching') { const linked = invoices.filter(i => i.spendApprovalId);
const unlinked = invoices.filter(i => !i.spendApprovalId);
const getBudgetColor = (rem, total) => { if (total <= 0) return 'text-gray-500'; if (rem < 0) return 'text-red-600'; if (rem < total * 0.1) return 'text-orange-600'; return 'text-green-600'; };
return (<div className={_pg}><div className="max-w-7xl mx-auto"> <div className="bg-white rounded-lg shadow-lg p-6 mb-6"><div className={_fj}> <div className="flex items-center space-x-3"><ExternalLink className="w-8 h-8 text-indigo-600"/><div><h1 className="text-2xl font-bold text-gray-800">Spend Approval → Invoice Matching</h1><p className="text-sm text-gray-500">{pendingMatches.length} spend approvals with suggested invoices • {unlinked.length} unlinked invoices</p></div></div>
<div className="flex items-center space-x-3"><button onClick={() => setCurrentPage('spend')} className="flex items-center space-x-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300" ><ArrowRight className="w-4 h-4 rotate-180"/><span>Back to Spend Approvals</span></button><button onClick={() => setCurrentPage('landing')} className="flex items-center space-x-2 px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200"><Home className="w-4 h-4"/><span>Dashboard</span></button></div>
</div></div> {pendingMatches.length > 0 && (<div className="space-y-6 mb-6">{pendingMatches.map(m => { const spAmt = parseFloat(m.spendAmount)||0; return ( <div key={m.spendId} className="bg-white rounded-lg shadow-lg overflow-hidden">
<div className="bg-indigo-50 px-6 py-4 border-b border-indigo-200"><div className={_fj}><div><div className="flex items-center space-x-3 mb-1"><span className="font-mono text-sm font-bold text-indigo-600">{m.spendRef}</span><span className="text-lg font-bold text-gray-800">{m.spendTitle}</span></div>
<div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-500"><span>Vendor: <strong className="text-gray-700">{m.spendVendor}</strong></span><span>Approved: <strong className="text-gray-700">{m.spendCurrency} {Number(m.spendAmount).toLocaleString()}</strong></span><span>Category: <strong className="text-gray-700">{m.spendCategory}</strong></span><span>Region: <strong className="text-gray-700">{m.spendRegion}</strong></span><span>Atom: <strong className="text-gray-700">{m.spendAtom}</strong></span></div></div>
<div className="text-right"><div className={`text-sm font-semibold ${getBudgetColor(m.remaining, spAmt)}`}>{m.remaining >= 0 ? `${m.spendCurrency} ${m.remaining.toLocaleString()} remaining` : `Overspent by ${m.spendCurrency} ${Math.abs(m.remaining).toLocaleString()}`}</div>{m.linkedCount > 0 && <div className="text-xs text-gray-500">{m.linkedCount} invoice{m.linkedCount>1?'s':''} already linked</div>}<button onClick={() => dismissSpendMatch(m.spendId)} className="mt-1 text-xs text-red-500 hover:text-red-700 font-semibold">Dismiss All</button></div></div></div>
<div className="p-6"><p className="text-xs font-semibold text-gray-500 uppercase mb-3">Suggested Invoices ({m.suggestions.length})</p><div className="space-y-3">{m.suggestions.map(sg => ( <div key={sg.invoiceId} className={`flex items-center justify-between p-4 rounded-lg border ${sg.score>=60?'border-blue-400 bg-blue-50':sg.score>=50?'border-green-300 bg-green-50':sg.score>=30?'border-yellow-300 bg-yellow-50':'border-gray-200 bg-gray-50'}`}>
<div className="flex-1"><div className="flex items-center space-x-3 mb-1"><span className="font-semibold text-gray-800">{sg.invoiceNumber}</span><span className="px-2 py-0.5 bg-white border rounded text-sm text-gray-700">{sg.invoiceVendor}</span><span className="font-bold text-gray-900">${sg.invoiceAmount}</span>{sg.reasons.includes('SA reference match') && <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-bold">SA REF</span>}<span className={`px-2 py-0.5 rounded text-xs font-semibold ${sg.invoiceStatus==='Approved'?'bg-green-100 text-green-700':sg.invoiceStatus==='Rejected'?'bg-red-100 text-red-700':'bg-yellow-100 text-yellow-700'}`}>{sg.invoiceStatus}</span></div>
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
onChange={(e) => setInviteRole(e.target.value)} className={`w-full ${_i}`} > <option value="Admin">Admin</option> <option value="Finance">Finance</option> <option value="Approver">Approver</option> <option value="User">User</option></select></div> </div> <div className="flex space-x-3 mt-6">
<button onClick={() => { setShowInviteModal(false); setInviteEmail('');
setInviteRole('User'); }} className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"  > Cancel</button> <button
onClick={inviteUser} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"  > Send Invitation</button></div></div></div>)}
{showRemoveConfirmation && ( <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"> <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6">
<h3 className="text-xl font-bold text-gray-900 mb-3">Remove User</h3><p className="text-gray-600 mb-4">Remove <strong>{userToRemove?.name}</strong> ({userToRemove?.email})? Access will be revoked immediately.</p>
<div className="flex space-x-3"><button onClick={cancelRemoveUser} className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">Cancel</button><button onClick={confirmRemoveUser} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">Remove</button></div></div></div>)} {showGdprModal && ( <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"> <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6">
<h3 className="text-xl font-bold text-gray-900 mb-3">GDPR Anonymization</h3><p className="text-gray-600 mb-4">Anonymize <strong>{userToAnonymize?.name}</strong> ({userToAnonymize?.email})? This cannot be undone.</p>
<div className="mb-4"><label className={_lb}>Type <strong>{userToAnonymize?.email}</strong> to confirm:</label><input type="text" value={gdprConfirmEmail} onChange={(e) => setGdprConfirmEmail(e.target.value)} placeholder="Enter email" className={`w-full ${_i}`}/></div>
<div className="flex space-x-3"><button onClick={cancelGdprAnonymization} className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">Cancel</button><button onClick={confirmGdprAnonymization} disabled={gdprConfirmEmail !== userToAnonymize?.email} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">Anonymize</button></div></div></div>)}
<div className="max-w-7xl mx-auto"> <div className="bg-white rounded-lg shadow-lg p-6 mb-6"> <div className={_fj+" mb-6"}> <div className="flex items-center space-x-3"> <Settings className="w-8 h-8 text-indigo-600"/> <h1 className="text-3xl font-bold text-gray-800">Application Settings</h1></div> <div className="flex items-center space-x-4"> <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 rounded-lg"> <User className="w-5 h-5 text-indigo-600"/> <div className="text-sm"> <p className="font-semibold text-gray-800">{user.name}</p>
<p className="text-xs text-gray-600">{user.role}</p></div></div> <button onClick={() => setCurrentPage('landing')} className="flex items-center space-x-2 px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200"><Home className="w-4 h-4"/><span>Dashboard</span></button> <button onClick={logout} className="flex items-center space-x-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"><LogOut className="w-4 h-4"/><span>Logout</span></button></div></div> <div className="border-b border-gray-200 mb-6">
<nav className="flex space-x-8"> <button
onClick={() => setSettingsTab('users')} className={`py-4 px-1 border-b-2 font-medium text-sm ${ settingsTab === 'users' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300' } ${!canManagePermissions() ? 'hidden' : ''}`} > <div className={_fx}> <User className="w-4 h-4"/> <span>User Permissions</span></div></button> <button
onClick={() => setSettingsTab('atoms')} className={`py-4 px-1 border-b-2 font-medium text-sm ${ settingsTab === 'atoms' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300' }`} > <div className={_fx}> <Settings className="w-4 h-4"/> <span>Lookups</span></div></button> <button
onClick={() => setSettingsTab('audit')} className={`py-4 px-1 border-b-2 font-medium text-sm ${ settingsTab === 'audit' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300' }`} > <div className={_fx}> <FileText className="w-4 h-4"/> <span>Audit Log</span></div></button> </nav></div> {settingsTab === 'users' && ( <div> <div className="mb-6 flex items-center justify-between"> <div> <h2 className="text-xl font-bold text-gray-800 mb-2">User Management</h2>
<p className="text-gray-600">Manage users, roles, and access levels</p></div> {canManagePermissions() && ( <button
onClick={() => setShowInviteModal(true)} className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-semibold" > <User className="w-4 h-4"/> <span>Invite User</span></button>)}</div> <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6"> <h3 className="font-semibold text-blue-900 mb-3">Role Descriptions</h3> <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm"> <div> <strong className="text-purple-700">Admin:</strong> Full access</div> <div>
<strong className="text-blue-700">Finance:</strong> All except settings</div> <div> <strong className="text-green-700">Approver:</strong> SAs + invoice assign</div> <div> <strong className="text-gray-700">User:</strong> Own SAs only</div></div></div> <div className="overflow-x-auto"> <table className="w-full"> <thead className="bg-gray-50"> <tr> <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Name</th> <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Email</th>
<th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Role</th> <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Limit</th> <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Status</th> <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Created</th> <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Invited By</th> <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Actions</th></tr></thead> <tbody className="divide-y divide-gray-200"> {mockUsers.map((usr) => ( <tr key={usr.id} className="hover:bg-gray-50">
<td className="px-6 py-4 text-sm font-medium text-gray-900">{usr.name}</td> <td className="px-6 py-4 text-sm text-gray-600">{usr.email}</td> <td className="px-6 py-4 text-sm"> {canManagePermissions() ? ( <select value={usr.role}
onChange={(e) => updateUserRole(usr.id, e.target.value)} className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
disabled={usr.status === 'Pending'} > <option value="Admin">Admin</option> <option value="Finance">Finance</option> <option value="Approver">Approver</option> <option value="User">User</option></select> ) : ( <span className={`px-3 py-1 rounded-full text-xs font-semibold ${ usr.role === 'Admin' ? 'bg-purple-100 text-purple-700' : usr.role === 'Finance' ? 'bg-blue-100 text-blue-700' : usr.role === 'Approver' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700' }`}> {usr.role}</span>)}</td> <td className="px-6 py-4 text-sm">{canManagePermissions() && ['Admin','Finance','Approver'].includes(usr.role) ? <input type="number" value={usr.approvalLimit||0} onChange={e => { const val = parseInt(e.target.value)||0; setMockUsers(prev=>prev.map(u=>u.id===usr.id?{...u,approvalLimit:val}:u)); }} className="w-24 px-2 py-1 border border-gray-300 rounded text-sm"/> : <span className="text-gray-500">{usr.isCeo ? 'Unlimited' : usr.approvalLimit > 0 ? `£${usr.approvalLimit.toLocaleString()}` : '—'}</span>}</td> <td className="px-6 py-4 text-sm">
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
{renderLookup('currencies','Currencies',currencies,setCurrencies,editCurrency,setEditCurrency,newCurrency,setNewCurrency,'CURRENCY',true,3,'Code (e.g. JPY)')}
{renderLookup('categories','Spend Categories',categories,setCategories,editCategory,setEditCategory,newCategory,setNewCategory,'CATEGORY',false)}
<div className="border border-gray-200 rounded-lg overflow-hidden">
<button onClick={() => toggleLookup('functions')} className="w-full flex items-center justify-between px-5 py-4 bg-gray-50 hover:bg-gray-100 transition">
<h2 className="text-lg font-bold text-gray-800">Functions / Departments</h2>
<div className="flex items-center space-x-2"><span className="text-xs text-gray-500">{functions.length} items</span>{collapsedLookups.functions ? <ChevronDown className="w-5 h-5 text-gray-500"/> : <ChevronUp className="w-5 h-5 text-gray-500"/>}</div>
</button>
{!collapsedLookups.functions && (<div className="p-5">
<div className="flex space-x-2 mb-4"><input placeholder="Function name" value={newFunction.name} onChange={e => setNewFunction(p=>({...p,name:e.target.value}))} className={`flex-1 ${_i}`}/><select value={newFunction.approver} onChange={e => setNewFunction(p=>({...p,approver:e.target.value}))} className={`w-48 ${_i}`}><option value="">Approver...</option>{mockUsers.filter(u=>['Admin','Finance','Approver'].includes(u.role)&&u.status==='Active').map(u=>(<option key={u.id} value={u.name}>{u.name}</option>))}</select><button onClick={() => { if (!newFunction.name||!newFunction.approver) return; if (functions.find(f=>f.name===newFunction.name)) { alert('Duplicate function'); return; } const f={id:Date.now(),name:newFunction.name,approver:newFunction.approver,active:true}; setFunctions(prev=>[...prev,f]); setNewFunction({name:'',approver:''}); setAuditLog(prev=>[...prev,{id:Date.now(),action:'FUNCTION_CREATED',details:`Function created: ${f.name} (Approver: ${f.approver})`,performedBy:user.name,performedAt:new Date().toISOString()}]); }} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-semibold">Add</button></div>
<table className="w-full text-left"><thead><tr className="border-b border-gray-200"><th className={_th}>Function Name</th><th className={_th}>Approver</th><th className={_th}>Status</th><th className={_th}>Actions</th></tr></thead><tbody>{functions.map(f => (<tr key={f.id} className="border-b border-gray-100 hover:bg-gray-50">
{editFunction===f.id ? (<><td className="px-4 py-2"><input value={f.name} onChange={e => setFunctions(prev=>prev.map(x=>x.id===f.id?{...x,name:e.target.value}:x))} className={`w-full ${_i}`}/></td><td className="px-4 py-2"><select value={f.approver} onChange={e => setFunctions(prev=>prev.map(x=>x.id===f.id?{...x,approver:e.target.value}:x))} className={`w-full ${_i}`}>{mockUsers.filter(u=>['Admin','Finance','Approver'].includes(u.role)&&u.status==='Active').map(u=>(<option key={u.id} value={u.name}>{u.name}</option>))}</select></td><td className="px-4 py-2"><span className={`px-2 py-0.5 rounded text-xs font-semibold ${f.active?'bg-green-100 text-green-700':'bg-gray-100 text-gray-500'}`}>{f.active?'Active':'Inactive'}</span></td><td className="px-4 py-2"><button onClick={() => { setEditFunction(null); setAuditLog(prev=>[...prev,{id:Date.now(),action:'FUNCTION_UPDATED',details:`Function updated: ${f.name} (Approver: ${f.approver})`,performedBy:user.name,performedAt:new Date().toISOString()}]); }} className="text-xs text-green-600 font-semibold">Save</button></td></>) : (<><td className={_td}>{f.name}</td><td className="px-4 py-3 text-sm"><span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-xs font-semibold">{f.approver}</span></td><td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs font-semibold ${f.active?'bg-green-100 text-green-700':'bg-gray-100 text-gray-500'}`}>{f.active?'Active':'Inactive'}</span></td><td className="px-4 py-3 text-sm"><div className="flex space-x-2"><button onClick={() => setEditFunction(f.id)} className="text-xs text-indigo-600 font-semibold">Edit</button><button onClick={() => { setFunctions(prev=>prev.map(x=>x.id===f.id?{...x,active:!x.active}:x)); setAuditLog(prev=>[...prev,{id:Date.now(),action:f.active?'FUNCTION_DEACTIVATED':'FUNCTION_ACTIVATED',details:`Function ${f.active?'deactivated':'activated'}: ${f.name}`,performedBy:user.name,performedAt:new Date().toISOString()}]); }} className={`text-xs font-semibold ${f.active?'text-red-600':'text-green-600'}`}>{f.active?'Deactivate':'Activate'}</button></div></td></>)}</tr>))}</tbody></table>
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
a.download = `audit_log_${new Date().toISOString().split('T')[0]}.csv`; a.click(); }} className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"  > <Download className="w-4 h-4"/> <span>Export Filtered Results ({getFilteredAuditLog().length} entries)</span></button></div></div>)}</div></div></div>);}
if (user.role === 'User') { return (<div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6 flex items-center justify-center"><div className="bg-white rounded-xl shadow-lg p-8 text-center max-w-md"><AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4"/><h2 className="text-xl font-bold text-gray-800 mb-2">Access Restricted</h2><p className="text-gray-500 mb-6">Invoice management is not available for your role.</p><button onClick={() => setCurrentPage('landing')} className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-semibold">Back to Dashboard</button></div></div>); }
if (selectedInvoice) { const invoice = invoices.find(inv => inv.id === selectedInvoice.id) || selectedInvoice; return ( <div className={_pg}> {showDeleteConfirmation && ( <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"> <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6"> <div className="flex items-center space-x-3 mb-4"> <div className="flex items-center justify-center h-12 w-12 rounded-full bg-red-100"> <Trash2 className="h-6 w-6 text-red-600"/></div>
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
onClick={() => setSelectedInvoice(null)} className="flex items-center space-x-2 text-indigo-600 hover:text-indigo-800" > <span>←</span> <span>Back to Invoice List</span></button> <div className="flex items-center space-x-4"> <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 rounded-lg"> <User className="w-5 h-5 text-indigo-600"/> <div className="text-sm"> <p className="font-semibold text-gray-800">{user.name}</p> <p className="text-xs text-gray-600">{user.role}</p></div></div> {canDeleteInvoices() && invoice.status === 'Pending' && ( <button
onClick={() => initiateDeleteInvoice(invoice)} className="flex items-center space-x-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200" > <Trash2 className="w-4 h-4"/> <span>Delete</span></button>)}
{canCreateSpend() && invoice.status === 'Pending' && !invoice.spendApprovalId && ( <button onClick={() => { const totalAmount = (parseFloat(invoice.amount) + parseFloat(invoice.taxAmount)).toFixed(2); const fn = functions.find(f => f.name === invoice.department); setSpendForm({ cc:'', title: invoice.description, currency:'', approver: fn ? fn.approver : '', amount: totalAmount, category:'', atom:'', vendor: invoice.vendor, costCentre:'', region:'', project:'', timeSensitive:false, exceptional:'', justification: invoice.description, department: invoice.department }); setSelectedInvoice(null); setCurrentPage('spend-approval'); setSpendView('form'); }} className="flex items-center space-x-2 px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200"><DollarSign className="w-4 h-4"/><span>Create Spend Approval</span></button>)}
<button onClick={() => setCurrentPage('landing')} className="flex items-center space-x-2 px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200"><Home className="w-4 h-4"/><span>Dashboard</span></button> <button
onClick={() => setSelectedInvoice(null)} className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200" > <span>Close</span></button></div></div> <div className={_fj}> <div> <h1 className="text-3xl font-bold text-gray-800">Invoice Details</h1> <p className="text-gray-600 mt-1">{invoice.invoiceNumber}</p></div> <span className={`px-4 py-2 rounded-full text-sm font-semibold ${ invoice.status === 'Approved' ? 'bg-green-100 text-green-800' :
invoice.status === 'Rejected' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800' }`}> {invoice.status}</span></div></div> <div className="grid grid-cols-1 lg:grid-cols-3 gap-6"> <div className="lg:col-span-2 space-y-6"> <div className={_cd}> <h2 className={_h2}>Invoice Information</h2> <div className="grid grid-cols-2 gap-6"> <div> <label className="text-sm text-gray-600">Invoice Number</label> <p className="text-lg font-semibold text-gray-800">{invoice.invoiceNumber}</p></div> <div>
<label className="text-sm text-gray-600">Vendor</label> <p className="text-lg font-semibold text-gray-800">{invoice.vendor}</p></div> <div> <label className="text-sm text-gray-600">Invoice Date</label> <p className="text-lg font-semibold text-gray-800">{invoice.date}</p></div> <div> <label className="text-sm text-gray-600">Due Date</label> <p className="text-lg font-semibold text-gray-800">{invoice.dueDate}</p></div> <div> <label className="text-sm text-gray-600">Subtotal</label> <p className="text-lg font-semibold text-gray-800">${invoice.amount}</p></div> <div>
<label className="text-sm text-gray-600">Tax Amount</label> <p className="text-lg font-semibold text-gray-800">${invoice.taxAmount}</p></div> <div className="col-span-2"> <label className="text-sm text-gray-600">Total Amount</label> <p className="text-2xl font-bold text-green-600"> ${(parseFloat(invoice.amount) + parseFloat(invoice.taxAmount)).toFixed(2)}</p></div> <div className="col-span-2"> <label className="text-sm text-gray-600">Description</label> <p className="text-gray-800">{invoice.description}</p></div></div></div>
<div className={_cd}> <h2 className={_h2}>Linked Spend Approval</h2> {invoice.spendApprovalId ? (() => { const sp = spendApprovals.find(s => s.id === invoice.spendApprovalId); return sp ? ( <div className="border border-indigo-200 bg-indigo-50 rounded-lg p-4"> <div className="flex items-center justify-between mb-2"><h3 className="font-semibold text-indigo-800">{sp.title}</h3><button onClick={() => unlinkInvoice(invoice.id)} className="text-xs text-red-600 hover:text-red-800 font-semibold">Unlink</button></div>
<div className="grid grid-cols-2 gap-2 text-sm"><div><span className="text-gray-500">Vendor:</span> <span className="text-gray-800">{sp.vendor}</span></div><div><span className="text-gray-500">Approved:</span> <span className="text-gray-800">{sp.currency} {Number(sp.amount).toLocaleString()}</span></div><div><span className="text-gray-500">Category:</span> <span className="text-gray-800">{sp.category}</span></div><div><span className="text-gray-500">Remaining:</span> <span className={`font-semibold ${getSpendRemaining(sp) < 0 ? 'text-red-600' : 'text-green-600'}`}>{sp.currency} {getSpendRemaining(sp).toLocaleString()}</span></div></div>
</div> ) : <p className="text-sm text-gray-500">Linked spend approval not found.</p>; })() : ( <div><p className="text-sm text-gray-500 mb-3">No spend approval linked to this invoice.</p><label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Assign to Spend Approval</label><select defaultValue="" onChange={e => { if (e.target.value) { acceptMatch(invoice.id, Number(e.target.value)); setSelectedInvoice({...invoice, spendApprovalId: Number(e.target.value)}); } }} className={`w-full ${_g}`}><option value="" disabled>Select an approved spend approval...</option>{spendApprovals.filter(s => s.status === 'Approved').map(s => (<option key={s.id} value={s.id}>{s.ref} — {s.title} — {s.vendor} ({s.currency} {Number(s.amount).toLocaleString()})</option>))}</select></div>)}</div>
{invoice.lineItems && invoice.lineItems.length > 0 && ( <div className={_cd}> <h2 className={_h2}>Line Items</h2> <div className="overflow-x-auto"> <table className="w-full"> <thead className="bg-gray-50"> <tr> <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Description</th> <th className="px-4 py-2 text-right text-sm font-semibold text-gray-700">Quantity</th> <th className="px-4 py-2 text-right text-sm font-semibold text-gray-700">Rate</th>
<th className="px-4 py-2 text-right text-sm font-semibold text-gray-700">Amount</th></tr></thead> <tbody className="divide-y divide-gray-200"> {invoice.lineItems.map((item, idx) => ( <tr key={idx}> <td className="px-4 py-2 text-sm text-gray-800">{item.description}</td> <td className="px-4 py-2 text-sm text-right text-gray-800">{item.quantity}</td> <td className="px-4 py-2 text-sm text-right text-gray-800">${item.rate}</td> <td className="px-4 py-2 text-sm text-right font-semibold text-gray-800">${item.amount}</td></tr> ))}</tbody></table></div></div>)}
{invoice.fileUrl && (<div className={_cd}> <h2 className={_h2}>Attached Document</h2> <div className="border-2 border-gray-200 rounded-lg p-4"> {invoice.fileType?.startsWith('image/') ? ( <img
src={invoice.fileUrl}
alt="Invoice document" className="w-full rounded-lg"/> ) : ( <div className={_fj}> <div className="flex items-center space-x-3"> <FileText className="w-8 h-8 text-indigo-600"/> <div> <p className="font-semibold text-gray-800">{invoice.fileName}</p> <p className="text-sm text-gray-600">PDF Document</p></div></div> <a
href={invoice.fileUrl}
download={invoice.fileName} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"  > Download</a></div>)}</div></div>)}</div> <div className="space-y-6">
{invoice.status !== 'Pending' && ( <div className={_cd}> <h2 className={_h2}>Approval Information</h2> <div className="space-y-3"> <div> <label className="text-sm text-gray-600">Status</label> <p className="font-semibold text-gray-800">{invoice.status}</p></div> <div> <label className="text-sm text-gray-600">Approved/Rejected By</label> <p className="font-semibold text-gray-800">{invoice.approvedBy}</p></div> <div> <label className="text-sm text-gray-600">Date</label> <p className="text-sm text-gray-800">
{new Date(invoice.approvedDate).toLocaleString()}</p></div></div></div>)}
<div className={_cd}> <h2 className={_h2}>Submission Info</h2> <div className="space-y-3"> <div> <label className="text-sm text-gray-600">Submitted By</label> <p className="font-semibold text-gray-800">{invoice.submittedBy}</p></div> <div> <label className="text-sm text-gray-600">Submitted Date</label> <p className="text-sm text-gray-800"> {new Date(invoice.submittedDate).toLocaleString()}</p></div></div></div></div></div></div></div>);} return (
<div className={_pg}> {showDeleteConfirmation && invoiceToDelete && ( <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"> <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6"> <div className="flex items-center space-x-3 mb-4"> <div className="flex items-center justify-center h-12 w-12 rounded-full bg-red-100"> <Trash2 className="h-6 w-6 text-red-600"/></div> <h3 className="text-xl font-bold text-gray-900">Delete Invoice</h3></div> <p className="text-gray-600 mb-4"> This action cannot be undone.</p> <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4"> <p className="text-sm text-yellow-800"> Please type <span className="font-bold">{invoiceToDelete.invoiceNumber}</span> to confirm deletion:</p></div> <input type="text" value={deleteConfirmationInput} onChange={(e) => setDeleteConfirmationInput(e.target.value)} placeholder="Type invoice number here" className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-red-500"/> <div className="flex space-x-3"> <button onClick={cancelDeleteInvoice} className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"> Cancel</button> <button onClick={confirmDeleteInvoice} disabled={deleteConfirmationInput !== invoiceToDelete.invoiceNumber} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"> Delete Invoice</button></div></div></div>)} <div className="max-w-7xl mx-auto"> <div className="bg-white rounded-lg shadow-lg p-6 mb-6"> <div className={_fj+" mb-6"}> <div className="flex items-center space-x-3"> <FileText className="w-8 h-8 text-indigo-600"/> <h1 className="text-3xl font-bold text-gray-800">Invoice Processing Workflow</h1></div> <div className="flex items-center space-x-4"> <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 rounded-lg"> <User className="w-5 h-5 text-indigo-600"/>
<div className="text-sm"> <p className="font-semibold text-gray-800">{user.name}</p> <p className="text-xs text-gray-600">{user.role}</p></div></div> <button onClick={() => setCurrentPage('landing')} className="flex items-center space-x-2 px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200"><Home className="w-4 h-4"/><span>Dashboard</span></button> <button
onClick={logout} className="flex items-center space-x-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200" > <LogOut className="w-4 h-4"/> <span>Logout</span></button></div></div> <div className="border-2 border-dashed border-indigo-300 rounded-lg p-8 text-center mb-6"> <Upload className="w-12 h-12 text-indigo-400 mx-auto mb-4"/> <input ref={fileInputRef} type="file"
accept=".pdf,image/*" multiple
onChange={handleFileSelect} className="hidden" id="file-upload"/> <label htmlFor="file-upload" className="cursor-pointer"> <span className="text-lg font-semibold text-gray-700">Drop files or click to upload</span> <p className="text-sm text-gray-500 mt-2">PDF and images supported</p></label> {selectedFiles.length > 0 && ( <div className="mt-4"> <p className="text-sm text-indigo-600 font-medium mb-2"> {selectedFiles.length} file(s) selected:</p> <div className="max-h-32 overflow-y-auto"> {selectedFiles.map((file, idx) => (
<p key={idx} className="text-xs text-gray-600">{file.name}</p> ))}</div></div>)}</div> {isProcessing && processingProgress.total > 0 && ( <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6"> <div className="flex items-center justify-between mb-3"> <div className="flex items-center space-x-3"> <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div> <span className="text-gray-700"> Processing invoices... ({processingProgress.current} of {processingProgress.total})</span></div>
<span className="text-sm font-semibold text-indigo-600"> {Math.round((processingProgress.current / processingProgress.total) * 100)}%</span></div> <div className="w-full bg-gray-200 rounded-full h-2"> <div className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
style={{ width: `${(processingProgress.current / processingProgress.total) * 100}%` }} ></div></div></div>)}
{extractedDataBatch.length > 0 && !isProcessing && ( <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6"> <div className={_fj+" mb-4"}> <h3 className="text-xl font-semibold text-gray-800"> Extracted Invoice Data ({extractedDataBatch.length} invoices)</h3> <button
onClick={processInvoiceBatch} className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition flex items-center space-x-2" > <CheckCircle className="w-4 h-4"/> <span>Process All</span></button></div> <div className="max-h-96 overflow-y-auto mb-4 space-y-4"> {extractedDataBatch.map((data, idx) => ( <div key={idx} className="bg-white p-4 rounded-lg border border-green-300"> <div className="flex items-center justify-between mb-2"> <span className="font-semibold text-gray-700">Invoice #{idx + 1}</span>
<span className="text-xs text-gray-500">{data.fileName}</span></div> <div className="grid grid-cols-2 md:grid-cols-4 gap-3"> <div> <span className="text-xs text-gray-600">Invoice #:</span> <p className="text-sm font-semibold">{data.invoiceNumber}</p></div> <div> <span className="text-xs text-gray-600">Vendor:</span> <p className="text-sm font-semibold">{data.vendor}</p></div> <div> <span className="text-xs text-gray-600">Date:</span> <p className="text-sm font-semibold">{data.date}</p></div> <div> <span className="text-xs text-gray-600">Amount:</span>
<p className="text-sm font-semibold text-green-600">${data.amount}</p></div></div></div> ))}</div> <button
onClick={processInvoiceBatch} className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700"  > Process All Invoices</button></div>)}</div> <div className={_cd}> <div className={_fj+" mb-6"}> <h2 className="text-2xl font-bold text-gray-800">Invoice Tracking</h2> <div className="flex items-center space-x-3"><div className="relative"> <input type="text"
placeholder="Search invoices..."
value={filters.searchTerm}
onChange={(e) => updateFilter('searchTerm', e.target.value)} className="px-4 py-2 pl-10 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64"/> <AlertCircle className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2"/></div> <div className="relative"> <button
onClick={() => setShowFilterPanel(!showFilterPanel)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition flex items-center space-x-2" > <span>Filters</span> {getActiveFilterCount() > 0 && ( <span className="bg-indigo-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center"> {getActiveFilterCount()}</span>)}</button> {showFilterPanel && ( <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-xl border border-gray-200 p-6 z-10"> <div className={_fj+" mb-4"}>
<h3 className="font-semibold text-gray-800">Filter Invoices</h3> <button
onClick={clearFilters} className="text-sm text-indigo-600 hover:text-indigo-800" > Clear All</button></div> <div className="space-y-4"> <div> <label className={_lb}>Status</label> <select
value={filters.status}
onChange={(e) => updateFilter('status', e.target.value)} className={`w-full ${_i}`} > <option value="all">All</option> <option value="Pending">Pending</option> <option value="Approved">Approved</option> <option value="Rejected">Rejected</option></select></div> <div> <label className={_lb}>Vendor</label> <select
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
onChange={(e) => updateFilter('submittedBy', e.target.value)} className={`w-full ${_i}`} > <option value="all">All Submitters</option> {getUniqueSubmitters().map(submitter => ( <option key={submitter} value={submitter}>{submitter}</option> ))}</select></div> <div> <label className={_lb}>Approved By</label> <select
value={filters.approvedBy}
onChange={(e) => updateFilter('approvedBy', e.target.value)} className={`w-full ${_i}`} > <option value="all">All</option> {getUniqueApprovers().map(approver => ( <option key={approver} value={approver}>{approver}</option> ))}</select></div></div> <div className="mt-4 pt-4 border-t border-gray-200"> <p className="text-sm text-gray-600"> Showing {getFilteredInvoices().length} of {invoices.length} invoices</p></div></div>)}</div> <div className="relative"> <label className="text-sm text-gray-600 mr-2">Group By:</label> <select value={groupBy}
onChange={(e) => setGroupBy(e.target.value)} className={_i} > <option value="none">None</option> <option value="status">Status</option> <option value="vendor">Vendor</option> <option value="date">Date</option> <option value="submittedBy">Submitted By</option> <option value="approvedBy">Approved By</option></select></div> <div className="relative"> <button
onClick={() => setShowColumnSelector(!showColumnSelector)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"  > Columns</button> {showColumnSelector && ( <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 p-4 z-10"> <h3 className="font-semibold text-gray-800 mb-3">Show/Hide Columns</h3> <div className="space-y-2"> <label className="flex items-center space-x-2 cursor-pointer"> <input type="checkbox"
checked={visibleColumns.invoiceNumber}
onChange={() => toggleColumnVisibility('invoiceNumber')} className="w-4 h-4 text-indigo-600 rounded"/> <span className="text-sm text-gray-700">Invoice #</span></label> <label className="flex items-center space-x-2 cursor-pointer"> <input type="checkbox"
checked={visibleColumns.vendor}
onChange={() => toggleColumnVisibility('vendor')} className="w-4 h-4 text-indigo-600 rounded"/> <span className="text-sm text-gray-700">Vendor</span></label> <label className="flex items-center space-x-2 cursor-pointer"> <input type="checkbox"
checked={visibleColumns.amount}
onChange={() => toggleColumnVisibility('amount')} className="w-4 h-4 text-indigo-600 rounded"/> <span className="text-sm text-gray-700">Amount</span></label> <label className="flex items-center space-x-2 cursor-pointer"> <input type="checkbox"
checked={visibleColumns.status}
onChange={() => toggleColumnVisibility('status')} className="w-4 h-4 text-indigo-600 rounded"/> <span className="text-sm text-gray-700">Status</span></label> <label className="flex items-center space-x-2 cursor-pointer"> <input type="checkbox"
checked={visibleColumns.spendApproval}
onChange={() => toggleColumnVisibility('spendApproval')} className="w-4 h-4 text-indigo-600 rounded"/> <span className="text-sm text-gray-700">Spend Approval</span></label> <label className="flex items-center space-x-2 cursor-pointer"> <input type="checkbox"
checked={visibleColumns.file}
onChange={() => toggleColumnVisibility('file')} className="w-4 h-4 text-indigo-600 rounded"/> <span className="text-sm text-gray-700">File</span></label> <label className="flex items-center space-x-2 cursor-pointer"> <input type="checkbox"
checked={visibleColumns.date}
onChange={() => toggleColumnVisibility('date')} className="w-4 h-4 text-indigo-600 rounded"/> <span className="text-sm text-gray-700">Invoice Date</span></label> <label className="flex items-center space-x-2 cursor-pointer"> <input type="checkbox"
checked={visibleColumns.dueDate}
onChange={() => toggleColumnVisibility('dueDate')} className="w-4 h-4 text-indigo-600 rounded"/> <span className="text-sm text-gray-700">Due Date</span></label> <label className="flex items-center space-x-2 cursor-pointer"> <input type="checkbox"
checked={visibleColumns.submittedBy}
onChange={() => toggleColumnVisibility('submittedBy')} className="w-4 h-4 text-indigo-600 rounded"/> <span className="text-sm text-gray-700">Submitted By</span></label> <label className="flex items-center space-x-2 cursor-pointer"> <input type="checkbox"
checked={visibleColumns.approvedBy}
onChange={() => toggleColumnVisibility('approvedBy')} className="w-4 h-4 text-indigo-600 rounded"/> <span className="text-sm text-gray-700">Approved By</span></label> <label className="flex items-center space-x-2 cursor-pointer"> <input type="checkbox"
checked={visibleColumns.approvedDate}
onChange={() => toggleColumnVisibility('approvedDate')} className="w-4 h-4 text-indigo-600 rounded"/> <span className="text-sm text-gray-700">Approved Date</span></label></div></div>)}</div> {invoices.length > 0 && ( <button
onClick={exportToExcel} className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"  > <Download className="w-4 h-4"/> <span>Export</span></button>)}</div></div> {invoices.length === 0 ? ( <div className="text-center py-12 text-gray-500"> <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-400"/> <p>No invoices processed yet. Upload an invoice to get started.</p></div> ) : getFilteredInvoices().length === 0 ? ( <div className="text-center py-12 text-gray-500">
<AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-400"/> <p>No invoices match your current filters.</p> <button
onClick={clearFilters} className="mt-4 text-indigo-600 hover:text-indigo-800 underline" > Clear Filters</button></div> ) : ( <div className="space-y-6"> {Object.entries(getGroupedInvoices()).map(([groupName, groupInvoices]) => ( <div key={groupName}> {groupBy !== 'none' && ( <div className="mb-3 flex items-center justify-between"> <h3 className="text-lg font-bold text-gray-700 flex items-center space-x-2"> <span>{groupName}</span> <span className="text-sm font-normal text-gray-500">({groupInvoices.length} invoices)</span></h3></div>)}
<div className="overflow-x-auto"> <table className="w-full"> <thead className="bg-gray-50"> <tr>
{visibleColumns.invoiceNumber && ( <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Invoice #</th>)}
{visibleColumns.vendor && ( <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Vendor</th>)}
{visibleColumns.amount && ( <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Amount</th>)}
{visibleColumns.status && ( <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status</th>)}
{visibleColumns.spendApproval && ( <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Spend Approval</th>)}
{visibleColumns.date && ( <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Invoice Date</th>)}
{visibleColumns.dueDate && ( <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Due Date</th>)}
{visibleColumns.file && ( <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">File</th>)}
{visibleColumns.submittedBy && ( <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Submitted By</th>)}
{visibleColumns.approvedBy && ( <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Approved By</th>)}
{visibleColumns.approvedDate && ( <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Approved Date</th>)}
{canDeleteInvoices() && ( <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Actions</th>)}</tr></thead> <tbody className="divide-y divide-gray-200"> {groupInvoices.map((invoice) => ( <tr key={invoice.id} className="hover:bg-gray-50">
{visibleColumns.invoiceNumber && ( <td className="px-4 py-3 text-sm"> <button
onClick={() => setSelectedInvoice(invoice)} className="text-indigo-600 hover:text-indigo-800 font-semibold underline" > {invoice.invoiceNumber}</button></td>)}
{visibleColumns.vendor && ( <td className="px-4 py-3 text-sm">{invoice.vendor}</td>)}
{visibleColumns.amount && ( <td className="px-4 py-3 text-sm font-semibold">${invoice.amount}</td>)}
{visibleColumns.status && ( <td className="px-4 py-3 text-sm"> <span className={`px-2 py-1 rounded-full text-xs font-semibold ${ invoice.status === 'Approved' ? 'bg-green-100 text-green-800' : invoice.status === 'Rejected' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800' }`}> {invoice.status}</span></td>)}
{visibleColumns.spendApproval && ( <td className="px-4 py-3 text-sm">{(() => { const sp = invoice.spendApprovalId ? spendApprovals.find(s => s.id === invoice.spendApprovalId) : null; return sp ? (<span className="font-medium text-indigo-600">{sp.ref}</span>) : (<span className="text-gray-400">—</span>); })()}</td>)}
{visibleColumns.date && ( <td className="px-4 py-3 text-sm">{invoice.date}</td>)}
{visibleColumns.dueDate && ( <td className="px-4 py-3 text-sm">{invoice.dueDate}</td>)}
{visibleColumns.file && ( <td className="px-4 py-3 text-sm"> {invoice.fileUrl ? (<div className="relative"> <a
href={invoice.fileUrl}
download={invoice.fileName} className="flex items-center space-x-1 text-indigo-600 hover:text-indigo-800"
title="View/Download Invoice"
onMouseEnter={() => setHoveredInvoice(invoice.id)}
onMouseLeave={() => setHoveredInvoice(null)} > <FileText className="w-4 h-4"/> <span className="underline">{invoice.fileName}</span></a> {hoveredInvoice === invoice.id && ( <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50 bg-white rounded-lg shadow-2xl border-2 border-indigo-200 p-2"> <div className="relative"> {invoice.fileType?.startsWith('image/') ? ( <img
src={invoice.fileUrl}
alt="Invoice preview" className="w-64 h-80 object-contain rounded"/> ) : invoice?.fileType === 'application/pdf' ? ( <div className="w-64 h-80 flex items-center justify-center bg-gray-100 rounded"> <div className="text-center"> <FileText className="w-16 h-16 text-gray-400 mx-auto mb-2"/> <p className="text-sm text-gray-600">PDF Preview</p> <p className="text-xs text-gray-500 mt-1">Click to view full document</p></div></div> ) : ( <div className="w-64 h-80 flex items-center justify-center bg-gray-100 rounded">
<FileText className="w-16 h-16 text-gray-400"/></div>)}
<div className="absolute left-0 top-1/2 -translate-x-full -translate-y-1/2"> <div className="w-0 h-0 border-t-8 border-t-transparent border-r-8 border-r-indigo-200 border-b-8 border-b-transparent"></div></div></div></div>)}</div> ) : <span className="text-gray-400 text-xs">No file</span>}</td>)}
{visibleColumns.submittedBy && ( <td className="px-4 py-3 text-sm">{invoice.submittedBy}</td>)}
{visibleColumns.approvedBy && ( <td className="px-4 py-3 text-sm">{invoice.approvedBy || '-'}</td>)}
{visibleColumns.approvedDate && ( <td className="px-4 py-3 text-sm"> {invoice.approvedDate ? new Date(invoice.approvedDate).toLocaleDateString() : '-'}</td>)}
{canDeleteInvoices() && ( <td className="px-4 py-3 text-sm"> {invoice.status === 'Pending' && canDeleteInvoices() && ( <button
onClick={() => initiateDeleteInvoice(invoice)} className="flex items-center space-x-1 px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700"
title="Delete Invoice" > <Trash2 className="w-4 h-4"/></button>)}</td>)}</tr> ))}</tbody></table></div></div> ))}</div>)}</div></div></div>);};
export default InvoiceWorkflowApp;