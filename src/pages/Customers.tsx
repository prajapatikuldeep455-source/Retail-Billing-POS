import { useState, useEffect, type FormEvent } from 'react';
import { 
  Plus, Users, Search, IndianRupee, Phone, 
  Send, History, CheckCircle2, AlertCircle, X, ArrowDownLeft,
  Trash2, Printer, Edit2, Truck, Mail, MapPin, Download,
  ArrowUpRight, AlertTriangle
} from 'lucide-react';
import { format } from 'date-fns';

type Customer = {
  id: number;
  name: string;
  phone: string;
  email: string;
  address: string;
  gstin: string;
  credit_balance: number;
  created_at: string;
};

type Supplier = {
  id: number;
  name: string;
  phone: string;
  email: string;
  gstin: string;
  address: string;
  created_at: string;
};

type CustomerTransaction = {
  id: number;
  customer_id: number;
  invoice_id?: number;
  type: string;
  amount: number;
  balance_after: number;
  payment_mode?: string;
  notes?: string;
  created_at: string;
};

export default function Customers({ role = 'admin' }: { role?: 'admin' | 'cashier' | 'manager' | null }) {
  const [activeTab, setActiveTab] = useState<'customers' | 'suppliers'>('customers');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDueOnly, setFilterDueOnly] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Modals
  const [newCustModalOpen, setNewCustModalOpen] = useState(false);
  const [newSupplierModalOpen, setNewSupplierModalOpen] = useState(false);
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [ledgerModalOpen, setLedgerModalOpen] = useState(false);
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{ open: boolean; customer: Customer | null }>({ open: false, customer: null });
  
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [transactions, setTransactions] = useState<CustomerTransaction[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // New Customer Form
  const [custForm, setCustForm] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    gstin: '',
    opening_balance: 0
  });

  // Supplier Form
  const [supplierForm, setSupplierForm] = useState({
    name: '',
    phone: '',
    email: '',
    gstin: '',
    address: ''
  });
  const [editingSupplierId, setEditingSupplierId] = useState<number | null>(null);

  // Payment Settle Form
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<'cash' | 'upi' | 'bank_transfer' | 'cheque'>('cash');
  const [paymentNotes, setPaymentNotes] = useState('Udhar Payment Clearance');

  const [editingCustomerId, setEditingCustomerId] = useState<number | null>(null);

  useEffect(() => {
    fetchCustomers();
    fetchSuppliers();
  }, []);

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 3500);
  };

  const fetchCustomers = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/customers');
      if (res.ok) setCustomers(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const res = await fetch('/api/suppliers');
      if (res.ok) setSuppliers(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const openLedger = async (cust: Customer) => {
    setSelectedCustomer(cust);
    try {
      const res = await fetch(`/api/customers/${cust.id}/transactions`);
      if (res.ok) {
        setTransactions(await res.json());
        setLedgerModalOpen(true);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const openPaymentModal = (cust: Customer) => {
    setFormError(null);
    setSelectedCustomer(cust);
    setPaymentAmount(cust.credit_balance);
    setPaymentNotes('Udhar Payment Settle');
    setPayModalOpen(true);
  };

  const openNewCustomerModal = () => {
    setEditingCustomerId(null);
    setFormError(null);
    setCustForm({ name: '', phone: '', email: '', address: '', gstin: '', opening_balance: 0 });
    setNewCustModalOpen(true);
  };

  const openEditCustomerModal = (cust: Customer) => {
    setEditingCustomerId(cust.id);
    setFormError(null);
    setCustForm({ 
      name: cust.name || '', 
      phone: cust.phone || '', 
      email: cust.email || '', 
      address: cust.address || '', 
      gstin: cust.gstin || '',
      opening_balance: 0
    });
    setNewCustModalOpen(true);
  };

  const handleSaveCustomer = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSaving(true);
    try {
      const url = editingCustomerId ? `/api/customers/${editingCustomerId}` : '/api/customers';
      const method = editingCustomerId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(custForm)
      });
      const data = await res.json();
      if (res.ok) {
        setNewCustModalOpen(false);
        setEditingCustomerId(null);
        setCustForm({ name: '', phone: '', email: '', address: '', gstin: '', opening_balance: 0 });
        showToast(editingCustomerId ? 'Customer details updated successfully!' : 'Customer registered successfully!');
        fetchCustomers();
      } else {
        setFormError(data.error || 'Failed to save customer. Please verify details.');
      }
    } catch (err: any) {
      console.error(err);
      setFormError(err.message || 'Network error while saving customer.');
    } finally {
      setIsSaving(false);
    }
  };

  const executeDeleteCustomer = async () => {
    if (!deleteConfirmModal.customer) return;
    const cust = deleteConfirmModal.customer;
    try {
      const res = await fetch(`/api/customers/${cust.id}`, { method: 'DELETE' });
      if (res.ok) {
        setDeleteConfirmModal({ open: false, customer: null });
        showToast(`Customer "${cust.name}" removed.`);
        fetchCustomers();
      } else {
        const data = await res.json();
        setFormError(data.error || 'Failed to delete customer.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveSupplier = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSaving(true);
    try {
      const url = '/api/suppliers';
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(supplierForm)
      });
      const data = await res.json();
      if (res.ok) {
        setNewSupplierModalOpen(false);
        setEditingSupplierId(null);
        setSupplierForm({ name: '', phone: '', email: '', gstin: '', address: '' });
        showToast('Supplier contact saved successfully!');
        fetchSuppliers();
      } else {
        setFormError(data.error || 'Failed to save supplier.');
      }
    } catch (err: any) {
      console.error(err);
      setFormError(err.message || 'Error saving supplier');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSettlePayment = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    if (paymentAmount <= 0) {
      setFormError('Payment amount must be greater than zero.');
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch(`/api/customers/${selectedCustomer.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: paymentAmount,
          payment_mode: paymentMode,
          notes: paymentNotes
        })
      });
      if (res.ok) {
        setPayModalOpen(false);
        showToast(`₹${paymentAmount.toFixed(2)} payment recorded for ${selectedCustomer.name}`);
        fetchCustomers();
      } else {
        const data = await res.json();
        setFormError(data.error || 'Failed to settle payment');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const sendWhatsAppReminder = (cust: Customer) => {
    if (!cust.phone) {
      alert('Customer has no phone number registered.');
      return;
    }
    let cleanPhone = cust.phone.replace(/[^0-9]/g, '');
    if (cleanPhone.length === 10) {
      cleanPhone = `91${cleanPhone}`;
    }
    const message = encodeURIComponent(
      `Namaste ${cust.name},\n\nThis is a gentle reminder regarding your outstanding Udhar balance of ₹${cust.credit_balance.toFixed(2)} at our store.\n\nPlease clear the balance via UPI/Cash at your earliest convenience.\n\nThank you for your business!`
    );
    window.open(`https://wa.me/${cleanPhone}?text=${message}`, '_blank');
  };

  const exportLedgerCSV = () => {
    if (!selectedCustomer || transactions.length === 0) return;
    let csv = 'Date,Type,Amount (INR),Balance After (INR),Payment Mode,Notes\n';
    transactions.forEach(t => {
      csv += `"${format(new Date(t.created_at), 'dd-MMM-yyyy HH:mm')}","${t.type}","${t.amount}","${t.balance_after}","${t.payment_mode || ''}","${t.notes || ''}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Khata_Statement_${selectedCustomer.name.replace(/\s+/g, '_')}.csv`;
    a.click();
  };

  const printStatement = () => {
    window.print();
  };

  const filteredCustomers = customers.filter(c => {
    const matchesSearch = 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.phone && c.phone.includes(searchTerm)) ||
      (c.gstin && c.gstin.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (c.address && c.address.toLowerCase().includes(searchTerm.toLowerCase()));
    
    if (filterDueOnly) {
      return matchesSearch && c.credit_balance > 0;
    }
    return matchesSearch;
  });

  const filteredSuppliers = suppliers.filter(s => {
    return (
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.phone && s.phone.includes(searchTerm)) ||
      (s.gstin && s.gstin.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (s.address && s.address.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  });

  const totalOutstanding = customers.reduce((acc, c) => acc + (c.credit_balance || 0), 0);
  const totalDueCustomers = customers.filter(c => (c.credit_balance || 0) > 0).length;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50">
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-700 text-white px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2 text-xs font-semibold animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 size={16} />
          {successToast}
        </div>
      )}

      {/* Top Header Controls */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 shadow-2xs">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="text-indigo-600" size={22} /> Contacts & Khata Management
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Manage customer credit ledger (Udhar), supplier directory, and settlement records
          </p>
        </div>

        {/* Tab & Action Controls */}
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button
              onClick={() => { setActiveTab('customers'); setSearchTerm(''); }}
              className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${
                activeTab === 'customers' ? 'bg-white text-indigo-700 shadow-xs border border-slate-200' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Customers ({customers.length})
            </button>
            <button
              onClick={() => { setActiveTab('suppliers'); setSearchTerm(''); }}
              className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${
                activeTab === 'suppliers' ? 'bg-white text-indigo-700 shadow-xs border border-slate-200' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Suppliers ({suppliers.length})
            </button>
          </div>

          {activeTab === 'customers' ? (
            <button
              onClick={openNewCustomerModal}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors shadow-2xs"
            >
              <Plus size={15} /> Add Customer
            </button>
          ) : (
            <button
              onClick={() => {
                setSupplierForm({ name: '', phone: '', email: '', gstin: '', address: '' });
                setNewSupplierModalOpen(true);
              }}
              className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors shadow-2xs"
            >
              <Plus size={15} /> Add Supplier
            </button>
          )}
        </div>
      </div>

      {/* KPI Overview Summary (Visible on Customers tab) */}
      {activeTab === 'customers' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 px-6 py-4 shrink-0">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Outstanding Udhar</p>
              <h3 className="text-2xl font-black text-rose-600 font-mono mt-1">₹{totalOutstanding.toFixed(2)}</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Receivable from active parties</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
              <IndianRupee size={24} />
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Parties with Due Balance</p>
              <h3 className="text-2xl font-black text-amber-600 font-mono mt-1">{totalDueCustomers} / {customers.length}</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Customers with pending payments</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
              <AlertTriangle size={24} />
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Registered Accounts</p>
              <h3 className="text-2xl font-black text-slate-900 font-mono mt-1">{customers.length}</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">B2B, Retail & Contractors</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <Users size={24} />
            </div>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="px-6 pb-3 shrink-0 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative flex-1 w-full max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={activeTab === 'customers' ? 'Search by name, phone, GSTIN, address...' : 'Search suppliers...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
          />
        </div>

        {activeTab === 'customers' && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilterDueOnly(!filterDueOnly)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all border ${
                filterDueOnly
                  ? 'bg-rose-50 border-rose-200 text-rose-700'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {filterDueOnly ? 'Showing: Due Udhar Only' : 'Filter: Due Balance Only'}
            </button>
          </div>
        )}
      </div>

      {/* Main Table Content */}
      <div className="flex-1 overflow-auto px-6 pb-6">
        <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
          {activeTab === 'customers' ? (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Customer / Party Name</th>
                  <th className="py-3.5 px-4">Contact & Phone</th>
                  <th className="py-3.5 px-4">GSTIN & Address</th>
                  <th className="py-3.5 px-4 text-right">Outstanding Due</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">Loading contacts directory...</td>
                  </tr>
                ) : filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center">
                      <Users size={32} className="mx-auto text-slate-300 mb-2" />
                      <p className="font-semibold text-slate-600">No customers found</p>
                      <p className="text-[11px] text-slate-400 mt-1">Try changing the search query or add a new customer</p>
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map(cust => (
                    <tr key={cust.id} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 text-sm">{cust.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">ID: #{cust.id} • Registered {format(new Date(cust.created_at), 'dd-MMM-yy')}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-mono text-slate-700 flex items-center gap-1.5">
                          <Phone size={12} className="text-slate-400" /> {cust.phone || '—'}
                        </div>
                        {cust.email && <div className="text-[10px] text-slate-500 mt-0.5">{cust.email}</div>}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-mono text-[11px] text-slate-600 font-medium">{cust.gstin || 'Unregistered'}</div>
                        <div className="text-[10px] text-slate-400 truncate max-w-xs">{cust.address || '—'}</div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className={`font-mono text-sm font-black ${
                          cust.credit_balance > 0 ? 'text-rose-600' : 'text-emerald-600'
                        }`}>
                          ₹{cust.credit_balance.toFixed(2)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {cust.credit_balance > 0 ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-100">
                            Due Pending
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                            Clear
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Settle Udhar Payment */}
                          {cust.credit_balance > 0 && (
                            <button
                              onClick={() => openPaymentModal(cust)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold uppercase tracking-wider transition-colors flex items-center gap-1 shadow-2xs"
                              title="Settle Udhar Payment"
                            >
                              <ArrowDownLeft size={13} /> Settle
                            </button>
                          )}

                          {/* WhatsApp Reminder */}
                          {cust.credit_balance > 0 && cust.phone && (
                            <button
                              onClick={() => sendWhatsAppReminder(cust)}
                              className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded transition-colors"
                              title="Send WhatsApp Payment Reminder"
                            >
                              <Send size={14} />
                            </button>
                          )}

                          {/* View Khata Ledger */}
                          <button
                            onClick={() => openLedger(cust)}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors"
                            title="View Khata Ledger Statement"
                          >
                            <History size={14} />
                          </button>

                          {/* Edit Customer */}
                          <button
                            onClick={() => openEditCustomerModal(cust)}
                            className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded transition-colors"
                            title="Edit Customer Details"
                          >
                            <Edit2 size={14} />
                          </button>

                          {/* Delete Customer */}
                          {role === 'admin' && (
                            <button
                              onClick={() => { setFormError(null); setDeleteConfirmModal({ open: true, customer: cust }); }}
                              className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded transition-colors"
                              title="Delete Customer"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Supplier / Vendor Name</th>
                  <th className="py-3.5 px-4">Phone & Mobile</th>
                  <th className="py-3.5 px-4">Email</th>
                  <th className="py-3.5 px-4">GSTIN</th>
                  <th className="py-3.5 px-4">Address</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSuppliers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center">
                      <Truck size={32} className="mx-auto text-slate-300 mb-2" />
                      <p className="font-semibold text-slate-600">No suppliers registered</p>
                      <p className="text-[11px] text-slate-400 mt-1">Add your distributor and vendor contacts</p>
                    </td>
                  </tr>
                ) : (
                  filteredSuppliers.map(s => (
                    <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 text-sm">{s.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">Supplier ID: #{s.id}</div>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-700">{s.phone || '—'}</td>
                      <td className="py-3 px-4 text-slate-600">{s.email || '—'}</td>
                      <td className="py-3 px-4 font-mono font-medium text-slate-700">{s.gstin || 'Unregistered'}</td>
                      <td className="py-3 px-4 text-slate-500 max-w-xs truncate">{s.address || '—'}</td>
                      <td className="py-3 px-4 text-right">
                        {s.phone && (
                          <a
                            href={`tel:${s.phone}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-bold uppercase tracking-wider transition-colors"
                          >
                            <Phone size={12} /> Call
                          </a>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* MODAL: ADD / EDIT CUSTOMER */}
      {/* ========================================================= */}
      {newCustModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <h2 className="font-black text-slate-900 text-sm uppercase tracking-wider flex items-center gap-2">
                <Users size={16} className="text-indigo-600" />
                {editingCustomerId ? 'Edit Customer Information' : 'Register New Customer / Party'}
              </h2>
              <button onClick={() => setNewCustModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs font-semibold text-rose-700 flex items-center gap-2">
                  <AlertCircle size={15} /> {formError}
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Customer / Business Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Electrical Works or Amit Kumar"
                  value={custForm.name}
                  onChange={(e) => setCustForm({ ...custForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Phone / Mobile Number *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="10-digit mobile number"
                    value={custForm.phone}
                    onChange={(e) => setCustForm({ ...custForm, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    GSTIN (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="15-character GSTIN"
                    value={custForm.gstin}
                    onChange={(e) => setCustForm({ ...custForm, gstin: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono uppercase focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="customer@email.com"
                    value={custForm.email}
                    onChange={(e) => setCustForm({ ...custForm, email: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                {!editingCustomerId && (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                      Opening Udhar Balance (₹)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={custForm.opening_balance || ''}
                      onChange={(e) => setCustForm({ ...custForm, opening_balance: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono font-bold text-rose-600 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Billing & Delivery Address
                </label>
                <textarea
                  rows={2}
                  placeholder="Street, City, Pincode"
                  value={custForm.address}
                  onChange={(e) => setCustForm({ ...custForm, address: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setNewCustModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 uppercase tracking-wider hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-colors shadow-2xs disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : editingCustomerId ? 'Update Customer' : 'Register Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: ADD SUPPLIER */}
      {/* ========================================================= */}
      {newSupplierModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <h2 className="font-black text-slate-900 text-sm uppercase tracking-wider flex items-center gap-2">
                <Truck size={16} className="text-slate-800" />
                Register New Supplier Contact
              </h2>
              <button onClick={() => setNewSupplierModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveSupplier} className="p-6 space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Supplier / Distributor Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Havells India Ltd or Local Distributor"
                  value={supplierForm.name}
                  onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-slate-900 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Phone / Mobile *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="Contact number"
                    value={supplierForm.phone}
                    onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono focus:ring-2 focus:ring-slate-900 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    GSTIN
                  </label>
                  <input
                    type="text"
                    placeholder="15-digit GSTIN"
                    value={supplierForm.gstin}
                    onChange={(e) => setSupplierForm({ ...supplierForm, gstin: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono uppercase focus:ring-2 focus:ring-slate-900 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Email
                </label>
                <input
                  type="email"
                  placeholder="vendor@company.com"
                  value={supplierForm.email}
                  onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Address / Warehouse Location
                </label>
                <textarea
                  rows={2}
                  placeholder="Address"
                  value={supplierForm.address}
                  onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-slate-900 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setNewSupplierModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 uppercase tracking-wider hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-slate-900 hover:bg-black text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-colors shadow-2xs disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Save Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: SETTLE UDHAR PAYMENT */}
      {/* ========================================================= */}
      {payModalOpen && selectedCustomer && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 bg-emerald-50 border-b border-emerald-100 flex justify-between items-center">
              <h2 className="font-black text-emerald-950 text-sm uppercase tracking-wider flex items-center gap-2">
                <ArrowDownLeft size={16} className="text-emerald-700" />
                Record Udhar Payment Clearance
              </h2>
              <button onClick={() => setPayModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSettlePayment} className="p-6 space-y-4">
              {formError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs font-semibold text-rose-700 flex items-center gap-2">
                  <AlertCircle size={14} /> {formError}
                </div>
              )}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Party Account</p>
                <p className="text-sm font-black text-slate-900 mt-0.5">{selectedCustomer.name}</p>
                <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-200/60">
                  <span className="text-xs text-slate-600 font-medium">Current Outstanding:</span>
                  <span className="font-mono text-base font-black text-rose-600">₹{selectedCustomer.credit_balance.toFixed(2)}</span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Payment Amount Received (₹) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  max={selectedCustomer.credit_balance}
                  required
                  value={paymentAmount || ''}
                  onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-lg font-mono font-black text-emerald-700 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
                <div className="flex gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => setPaymentAmount(selectedCustomer.credit_balance)}
                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-bold uppercase tracking-wider"
                  >
                    Full Balance (₹{selectedCustomer.credit_balance.toFixed(2)})
                  </button>
                  {selectedCustomer.credit_balance > 500 && (
                    <button
                      type="button"
                      onClick={() => setPaymentAmount(Math.floor(selectedCustomer.credit_balance / 2))}
                      className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-bold uppercase tracking-wider"
                    >
                      50% Partial
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Payment Mode *
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(['cash', 'upi', 'bank_transfer', 'cheque'] as const).map(mode => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setPaymentMode(mode)}
                      className={`py-2 px-1 text-center rounded-lg text-xs font-bold uppercase tracking-wider border transition-all ${
                        paymentMode === mode
                          ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {mode.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Payment Notes / Reference
                </label>
                <input
                  type="text"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  placeholder="e.g. Received via GPay or Cheque #1234"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPayModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 uppercase tracking-wider hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider shadow-2xs disabled:opacity-50"
                >
                  {isSaving ? 'Processing...' : 'Confirm Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: CUSTOMER KHATA LEDGER STATEMENT */}
      {/* ========================================================= */}
      {ledgerModalOpen && selectedCustomer && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center shrink-0">
              <div>
                <h2 className="font-black text-slate-900 text-base uppercase tracking-tight flex items-center gap-2">
                  <History size={18} className="text-indigo-600" />
                  Khata Ledger Statement: {selectedCustomer.name}
                </h2>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  Phone: {selectedCustomer.phone || 'N/A'} • Current Balance: ₹{selectedCustomer.credit_balance.toFixed(2)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={exportLedgerCSV}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1 transition-colors"
                  title="Export Statement to CSV"
                >
                  <Download size={14} /> CSV
                </button>
                <button
                  onClick={printStatement}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1 transition-colors"
                  title="Print Ledger"
                >
                  <Printer size={14} /> Print
                </button>
                <button onClick={() => setLedgerModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Ledger Transactions Table */}
            <div className="flex-1 overflow-auto p-6">
              {transactions.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <History size={36} className="mx-auto text-slate-300 mb-2" />
                  <p className="font-semibold text-slate-600">No transaction entries found in this ledger</p>
                </div>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="py-2.5 px-3">Date & Time</th>
                      <th className="py-2.5 px-3">Entry Type</th>
                      <th className="py-2.5 px-3">Payment Mode / Ref</th>
                      <th className="py-2.5 px-3 text-right">Debit (+) / Credit (-)</th>
                      <th className="py-2.5 px-3 text-right">Balance After</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {transactions.map(tx => {
                      const isCreditSale = tx.type === 'BILL_CREDIT' || tx.type === 'OPENING_BALANCE';
                      return (
                        <tr key={tx.id} className="hover:bg-slate-50/60">
                          <td className="py-2.5 px-3 font-mono text-slate-600">
                            {format(new Date(tx.created_at), 'dd-MMM-yyyy HH:mm')}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              isCreditSale ? 'bg-rose-50 text-rose-700 border border-rose-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                            }`}>
                              {tx.type.replace('_', ' ')}
                            </span>
                            {tx.notes && <div className="text-[10px] text-slate-400 mt-0.5">{tx.notes}</div>}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-700">
                            {tx.payment_mode || '—'}
                          </td>
                          <td className={`py-2.5 px-3 text-right font-mono font-bold ${
                            isCreditSale ? 'text-rose-600' : 'text-emerald-600'
                          }`}>
                            {isCreditSale ? `+₹${tx.amount.toFixed(2)}` : `-₹${tx.amount.toFixed(2)}`}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-black text-slate-900">
                            ₹{tx.balance_after.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-between items-center shrink-0">
              <div className="text-xs text-slate-500 font-medium">
                Total Ledger Entries: <strong className="text-slate-900">{transactions.length}</strong>
              </div>
              <button
                onClick={() => setLedgerModalOpen(false)}
                className="px-4 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-bold uppercase tracking-wider"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: DELETE CONFIRMATION */}
      {/* ========================================================= */}
      {deleteConfirmModal.open && deleteConfirmModal.customer && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-slate-200 p-6 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 mx-auto mb-3">
              <AlertTriangle size={24} />
            </div>
            <h3 className="text-center font-black text-slate-900 text-sm">Delete Customer Account?</h3>
            {formError && (
              <div className="mt-3 p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs font-semibold text-rose-700 flex items-center gap-2">
                <AlertCircle size={14} /> {formError}
              </div>
            )}
            <p className="text-center text-xs text-slate-500 mt-1">
              Are you sure you want to remove <strong className="text-slate-800">{deleteConfirmModal.customer.name}</strong>?
            </p>
            {deleteConfirmModal.customer.credit_balance > 0 && (
              <div className="mt-3 p-2.5 bg-rose-50 border border-rose-100 rounded-lg text-[11px] font-bold text-rose-700 text-center">
                Warning: Customer has ₹{deleteConfirmModal.customer.credit_balance.toFixed(2)} due balance!
              </div>
            )}
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setDeleteConfirmModal({ open: false, customer: null })}
                className="flex-1 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 uppercase tracking-wider hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={executeDeleteCustomer}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider shadow-2xs"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
