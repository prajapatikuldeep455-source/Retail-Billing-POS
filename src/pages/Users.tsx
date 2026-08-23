import { useState, useEffect, type FormEvent } from 'react';
import { 
  UserCheck, ShieldCheck, UserPlus, Search, 
  Key, Phone, Mail, CheckCircle2, AlertCircle, 
  X, Lock, ShieldAlert, Edit3, Trash2, Power,
  Clock, Shield, User
} from 'lucide-react';
import { format } from 'date-fns';

export type UserAccount = {
  id: number;
  username: string;
  full_name: string;
  phone?: string;
  email?: string;
  role: 'admin' | 'manager' | 'cashier' | 'salesman' | 'accountant';
  status: 'active' | 'inactive';
  pin?: string;
  last_login?: string;
  created_at: string;
};

export default function UsersPage({ 
  currentUser, 
  role = 'admin' 
}: { 
  currentUser?: UserAccount | null;
  role?: string | null;
}) {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<string>('ALL');

  // Modals
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [resetPinModalOpen, setResetPinModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserAccount | null>(null);
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{ open: boolean; user: UserAccount | null }>({ open: false, user: null });

  // Forms
  const [form, setForm] = useState({
    username: '',
    full_name: '',
    phone: '',
    email: '',
    role: 'cashier' as UserAccount['role'],
    pin: '',
    status: 'active' as 'active' | 'inactive'
  });

  const [newPin, setNewPin] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 3500);
  };

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        setUsers(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const openRegisterModal = () => {
    setEditingUserId(null);
    setFormError(null);
    setForm({
      username: '',
      full_name: '',
      phone: '',
      email: '',
      role: 'cashier',
      pin: '',
      status: 'active'
    });
    setRegisterModalOpen(true);
  };

  const openEditModal = (u: UserAccount) => {
    setEditingUserId(u.id);
    setFormError(null);
    setForm({
      username: u.username,
      full_name: u.full_name,
      phone: u.phone || '',
      email: u.email || '',
      role: u.role,
      pin: '', // Blank unless changing
      status: u.status
    });
    setRegisterModalOpen(true);
  };

  const openResetPin = (u: UserAccount) => {
    setSelectedUser(u);
    setNewPin('');
    setFormError(null);
    setResetPinModalOpen(true);
  };

  const handleSaveUser = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!editingUserId && (!form.pin || form.pin.length < 4)) {
      setFormError('Security PIN must be at least 4 digits.');
      return;
    }

    setIsSaving(true);
    try {
      const url = editingUserId ? `/api/users/${editingUserId}` : '/api/users/register';
      const method = editingUserId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });

      const data = await res.json();
      if (res.ok) {
        setRegisterModalOpen(false);
        showToast(editingUserId ? `User @${form.username} updated!` : `Staff member @${form.username} registered!`);
        fetchUsers();
      } else {
        setFormError(data.error || 'Failed to save staff account.');
      }
    } catch (err: any) {
      console.error(err);
      setFormError(err.message || 'Error communicating with server.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdatePin = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    if (!newPin || newPin.length < 4) {
      setFormError('PIN must be at least 4 digits.');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(`/api/users/${selectedUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: selectedUser.full_name,
          phone: selectedUser.phone,
          email: selectedUser.email,
          role: selectedUser.role,
          status: selectedUser.status,
          pin: newPin
        })
      });
      if (res.ok) {
        setResetPinModalOpen(false);
        showToast(`Security PIN for @${selectedUser.username} has been updated.`);
        fetchUsers();
      } else {
        const data = await res.json();
        setFormError(data.error || 'Failed to update PIN.');
      }
    } catch (err: any) {
      console.error(err);
      setFormError('Error updating PIN.');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleUserStatus = async (u: UserAccount) => {
    const newStatus = u.status === 'active' ? 'inactive' : 'active';
    try {
      const res = await fetch(`/api/users/${u.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: u.full_name,
          phone: u.phone,
          email: u.email,
          role: u.role,
          status: newStatus
        })
      });
      if (res.ok) {
        showToast(`User @${u.username} is now ${newStatus.toUpperCase()}`);
        fetchUsers();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const executeDeleteUser = async () => {
    if (!deleteConfirmModal.user) return;
    const u = deleteConfirmModal.user;
    try {
      const res = await fetch(`/api/users/${u.id}`, { method: 'DELETE' });
      if (res.ok) {
        setDeleteConfirmModal({ open: false, user: null });
        showToast(`User @${u.username} deleted.`);
        fetchUsers();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete user.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = 
      u.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.phone && u.phone.includes(searchTerm)) ||
      (u.email && u.email.toLowerCase().includes(searchTerm.toLowerCase()));
    
    if (filterRole === 'ALL') return matchesSearch;
    return matchesSearch && u.role === filterRole;
  });

  const getRoleBadge = (r: string) => {
    switch (r) {
      case 'admin':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1"><ShieldCheck size={11} /> Admin / Owner</span>;
      case 'manager':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1"><Shield size={11} /> Manager</span>;
      case 'cashier':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1"><UserCheck size={11} /> Cashier</span>;
      case 'salesman':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1"><User size={11} /> Salesman</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">{r}</span>;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50">
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-700 text-white px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2 text-xs font-semibold animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 size={16} />
          {successToast}
        </div>
      )}

      {/* Header Bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 shadow-2xs">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <UserCheck className="text-indigo-600" size={22} /> Registered Staff & User System
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Manage authenticated cashier accounts, manager overrides, PIN access, and operator permissions
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={openRegisterModal}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors shadow-2xs"
          >
            <UserPlus size={15} /> Register New Staff
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 px-6 py-4 shrink-0">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Registered Accounts</p>
          <h3 className="text-2xl font-black text-slate-900 font-mono mt-1">{users.length}</h3>
          <p className="text-[10px] text-slate-400 mt-0.5">Store operators & staff</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Active Cashiers</p>
          <h3 className="text-2xl font-black text-indigo-600 font-mono mt-1">
            {users.filter(u => u.role === 'cashier' && u.status === 'active').length}
          </h3>
          <p className="text-[10px] text-slate-400 mt-0.5">Counter billing operators</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Managers & Admins</p>
          <h3 className="text-2xl font-black text-purple-600 font-mono mt-1">
            {users.filter(u => ['admin', 'manager'].includes(u.role) && u.status === 'active').length}
          </h3>
          <p className="text-[10px] text-slate-400 mt-0.5">Override & report permissions</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Security Protection</p>
          <h3 className="text-2xl font-black text-emerald-600 font-mono mt-1 flex items-center gap-1.5">
            <Lock size={18} /> PIN Secured
          </h3>
          <p className="text-[10px] text-slate-400 mt-0.5">All actions logged to System Audit Trail</p>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="px-6 pb-3 shrink-0 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative flex-1 w-full max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, username, phone or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Role:</span>
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none"
          >
            <option value="ALL">All Roles</option>
            <option value="admin">Admin / Owner</option>
            <option value="manager">Manager</option>
            <option value="cashier">Cashier</option>
            <option value="salesman">Salesman</option>
          </select>
        </div>
      </div>

      {/* Staff Table */}
      <div className="flex-1 overflow-auto px-6 pb-6">
        <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-4">Operator / Staff Member</th>
                <th className="py-3.5 px-4">Role & Access</th>
                {currentUser?.role === 'admin' && <th className="py-3.5 px-4">Security PIN</th>}
                <th className="py-3.5 px-4">Contact Info</th>
                <th className="py-3.5 px-4">Last Active</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">Loading registered staff...</td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <UserCheck size={32} className="mx-auto text-slate-300 mb-2" />
                    <p className="font-semibold text-slate-600">No staff members found</p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                        {u.full_name}
                        {currentUser?.id === u.id && (
                          <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 text-[9px] font-black uppercase rounded">
                            You (Active)
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        Username: <strong className="text-slate-600 font-bold">@{u.username}</strong> • ID #{u.id}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {getRoleBadge(u.role)}
                    </td>
                    {currentUser?.role === 'admin' && (
                      <td className="py-3 px-4 font-mono font-bold text-slate-700 tracking-widest text-sm">
                        {u.pin || '••••'}
                      </td>
                    )}
                    <td className="py-3 px-4">
                      <div className="font-mono text-slate-700 flex items-center gap-1.5">
                        <Phone size={12} className="text-slate-400" /> {u.phone || '—'}
                      </div>
                      {u.email && <div className="text-[10px] text-slate-500 mt-0.5">{u.email}</div>}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">
                      {u.last_login ? (
                        <div className="flex items-center gap-1 text-[11px]">
                          <Clock size={12} className="text-slate-400" />
                          {format(new Date(u.last_login), 'dd-MMM-yy HH:mm')}
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">Never logged in</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => u.username !== 'admin' && toggleUserStatus(u)}
                        disabled={u.username === 'admin'}
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors ${
                          u.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                            : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200'
                        } ${u.username === 'admin' ? 'cursor-default' : 'cursor-pointer'}`}
                        title={u.username === 'admin' ? 'Admin account cannot be deactivated' : 'Click to toggle status'}
                      >
                        {u.status}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Reset PIN */}
                        <button
                          onClick={() => openResetPin(u)}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 transition-colors"
                          title="Reset Security PIN"
                        >
                          <Key size={12} /> PIN
                        </button>

                        {/* Edit User */}
                        <button
                          onClick={() => openEditModal(u)}
                          className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded transition-colors"
                          title="Edit Staff Info"
                        >
                          <Edit3 size={14} />
                        </button>

                        {/* Delete User (Cannot delete root admin) */}
                        {u.username !== 'admin' && (
                          <button
                            onClick={() => setDeleteConfirmModal({ open: true, user: u })}
                            className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded transition-colors"
                            title="Delete Staff Account"
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
        </div>
      </div>

      {/* ========================================================= */}
      {/* MODAL: REGISTER / EDIT USER */}
      {/* ========================================================= */}
      {registerModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <h2 className="font-black text-slate-900 text-sm uppercase tracking-wider flex items-center gap-2">
                <UserPlus size={16} className="text-indigo-600" />
                {editingUserId ? 'Edit Staff Account' : 'Register New Staff Member'}
              </h2>
              <button onClick={() => setRegisterModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs font-semibold text-rose-700 flex items-center gap-2">
                  <AlertCircle size={15} /> {formError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Username / Login ID *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!!editingUserId}
                    placeholder="e.g. rahul_pos"
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rahul Sharma"
                    value={form.full_name}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Assigned Role *
                  </label>
                  <select
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value as any })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="cashier">Counter Cashier (POS & Billing)</option>
                    <option value="manager">Store Manager (Shifts & Overrides)</option>
                    <option value="admin">Administrator / Store Owner</option>
                    <option value="salesman">Floor Salesman (Catalog & Queries)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Account Status *
                  </label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value as any })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="active">Active (Can Login)</option>
                    <option value="inactive">Inactive (Suspended)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Phone / Mobile *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="+91-9876543210"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="staff@store.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  {editingUserId ? 'New Security PIN (Leave blank to keep existing)' : 'Security PIN (4 to 6 Digits) *'}
                </label>
                <input
                  type="text"
                  maxLength={6}
                  required={!editingUserId}
                  placeholder={editingUserId ? 'Enter new PIN' : 'Enter 4-digit PIN (e.g. 1122)'}
                  value={form.pin}
                  onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/[^0-9]/g, '') })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono font-bold tracking-widest focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
                <p className="text-[10px] text-slate-500 mt-1">This PIN will be used by the staff member to log in to the POS system.</p>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRegisterModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 uppercase tracking-wider hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider shadow-2xs disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : editingUserId ? 'Update Staff Member' : 'Register Staff Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: RESET PIN */}
      {/* ========================================================= */}
      {resetPinModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <h2 className="font-black text-slate-900 text-sm uppercase tracking-wider flex items-center gap-2">
                <Key size={16} className="text-amber-600" />
                Reset Security PIN
              </h2>
              <button onClick={() => setResetPinModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdatePin} className="p-6 space-y-4">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
                <span className="text-slate-500">Staff Account:</span>
                <strong className="block text-slate-900 text-sm">{selectedUser.full_name} (@{selectedUser.username})</strong>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Enter New PIN (4 to 6 Digits) *
                </label>
                <input
                  type="text"
                  maxLength={6}
                  required
                  placeholder="e.g. 5566"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/[^0-9]/g, ''))}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-lg font-mono font-black tracking-widest text-center focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setResetPinModalOpen(false)}
                  className="flex-1 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 uppercase tracking-wider hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider shadow-2xs disabled:opacity-50"
                >
                  {isSaving ? 'Updating...' : 'Set New PIN'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: DELETE CONFIRMATION */}
      {/* ========================================================= */}
      {deleteConfirmModal.open && deleteConfirmModal.user && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-slate-200 p-6 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 mx-auto mb-3">
              <ShieldAlert size={24} />
            </div>
            <h3 className="text-center font-black text-slate-900 text-sm">Delete Staff Account?</h3>
            <p className="text-center text-xs text-slate-500 mt-1">
              Are you sure you want to delete user <strong className="text-slate-800">@{deleteConfirmModal.user.username}</strong> ({deleteConfirmModal.user.full_name})?
            </p>
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setDeleteConfirmModal({ open: false, user: null })}
                className="flex-1 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 uppercase tracking-wider hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={executeDeleteUser}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider shadow-2xs"
              >
                Delete Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
