import { useState, useEffect, type FormEvent } from 'react';
import { 
  IndianRupee, Plus, Calendar, Search, 
  Coffee, Zap, Truck, Users, Settings as Tool, 
  Trash2, FileText, CheckCircle2, Wallet, X
} from 'lucide-react';
import { format } from 'date-fns';

type Expense = {
  id: number;
  date: string;
  category: string;
  amount: number;
  payment_mode: string;
  notes: string;
  recorded_by: string;
  created_at: string;
};

const EXPENSE_CATEGORIES = [
  { id: 'Tea & Snacks', icon: Coffee },
  { id: 'Electricity / Utility', icon: Zap },
  { id: 'Transport / Freight', icon: Truck },
  { id: 'Staff Salary / Helper', icon: Users },
  { id: 'Shop Maintenance', icon: Tool },
  { id: 'Miscellaneous', icon: FileText }
];

export default function Expenses({ role = 'admin' }: { role?: 'admin' | 'cashier' | null }) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [filterDate, setFilterDate] = useState(() => new Date().toISOString().split('T')[0]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // New Expense Form
  const [form, setForm] = useState({
    category: 'Tea & Snacks',
    amount: '',
    payment_mode: 'cash',
    notes: ''
  });

  useEffect(() => {
    fetchExpenses();
  }, [filterDate]);

  const fetchExpenses = async () => {
    try {
      const res = await fetch(`/api/expenses?from=${filterDate}&to=${filterDate}`);
      if (res.ok) setExpenses(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveExpense = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.amount || Number(form.amount) <= 0) return;

    setIsSaving(true);
    try {
      const method = editingId ? 'PUT' : 'POST';
      const url = editingId ? `/api/expenses/${editingId}` : '/api/expenses';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          amount: Number(form.amount)
        })
      });
      if (res.ok) {
        setIsModalOpen(false);
        setEditingId(null);
        setForm({ category: 'Tea & Snacks', amount: '', payment_mode: 'cash', notes: '' });
        fetchExpenses();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (exp: Expense) => {
    setEditingId(exp.id);
    setForm({
      category: exp.category,
      amount: exp.amount.toString(),
      payment_mode: exp.payment_mode,
      notes: exp.notes || ''
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this expense record?')) return;
    
    try {
      const res = await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
      if (res.ok) fetchExpenses();
    } catch (err) {
      console.error(err);
    }
  };

  const totalExpense = expenses.reduce((sum, exp) => sum + exp.amount, 0);

  const filteredExpenses = expenses.filter(exp => 
    exp.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (exp.notes && exp.notes.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="p-5 max-w-6xl mx-auto w-full flex-1 flex flex-col overflow-hidden">
      {/* Header & Metrics */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Daily Expenses (Petty Cash)</h2>
            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[11px] font-mono font-bold rounded">
              {expenses.length} Records
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">Track shop expenditures to balance your daily cash-in-drawer accurately</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-lg flex items-center gap-2">
            <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider">Total Exp:</span>
            <span className="font-mono font-bold text-rose-900 text-sm">₹ {totalExpense.toFixed(2)}</span>
          </div>

          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all uppercase tracking-wider"
          >
            <Plus size={14} /> Log Expense
          </button>
        </div>
      </div>

      {/* Filter and Table */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex justify-between items-center mb-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2 text-slate-400" size={14} />
            <input
              type="text"
              placeholder="Search category, notes..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64 shadow-sm"
            />
          </div>

          <div className="flex items-center gap-2 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200">
            <Calendar size={14} className="text-slate-500" />
            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Date:</span>
            <input
              type="date"
              value={filterDate}
              onChange={e => setFilterDate(e.target.value)}
              className="bg-white border border-slate-300 rounded px-2 py-0.5 text-xs font-mono font-bold text-slate-900 outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Expenses Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col">
          <div className="overflow-auto flex-1">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider sticky top-0 z-10 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4 w-12">Time</th>
                  <th className="py-2.5 px-4">Category</th>
                  <th className="py-2.5 px-4">Payment Mode</th>
                  <th className="py-2.5 px-4">Notes</th>
                  <th className="py-2.5 px-4 text-right">Amount (₹)</th>
                  <th className="py-2.5 px-4 text-center w-20">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100 font-mono text-xs">
                {filteredExpenses.map((exp, idx) => {
                  const CategoryIcon = EXPENSE_CATEGORIES.find(c => c.id === exp.category)?.icon || FileText;
                  
                  return (
                    <tr key={exp.id} className={idx % 2 === 1 ? 'bg-slate-50/50' : 'hover:bg-slate-50 transition-colors'}>
                      <td className="py-2.5 px-4 text-slate-500 font-sans">
                        {format(new Date(exp.date), 'HH:mm')}
                      </td>
                      <td className="py-2.5 px-4 font-sans font-bold text-slate-900 flex items-center gap-2">
                        <span className="p-1.5 bg-slate-100 text-slate-600 rounded-md">
                          <CategoryIcon size={14} />
                        </span>
                        {exp.category}
                      </td>
                      <td className="py-2.5 px-4 font-sans">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700">
                          {exp.payment_mode}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-sans text-slate-600">{exp.notes || '—'}</td>
                      <td className="py-2.5 px-4 text-right font-bold text-rose-700">
                        ₹ {exp.amount.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        {role === 'admin' && (
                          <div className="flex justify-center items-center gap-1">
                            <button
                              onClick={() => handleEdit(exp)}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                              title="Edit Expense"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </button>
                            <button
                              onClick={() => handleDelete(exp.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                              title="Delete Expense"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filteredExpenses.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-16 text-slate-400 font-sans">
                      <Wallet size={32} className="mx-auto mb-2 text-slate-300 stroke-1" />
                      <p className="text-xs font-semibold text-slate-600">No expenses recorded for this date</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add Expense Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-100">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md border border-slate-200 overflow-hidden flex flex-col">
            <div className="px-5 py-3.5 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900">Log Daily Expense</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                <X size={16} />
                <span className="sr-only">Close</span>
              </button>
            </div>

            <form onSubmit={handleSaveExpense} className="p-5 space-y-4 text-xs flex-1 overflow-y-auto">
              
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Expense Category *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {EXPENSE_CATEGORIES.map(cat => {
                    const Icon = cat.icon;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setForm({ ...form, category: cat.id })}
                        className={`flex items-center gap-2 p-2 rounded-lg border text-left transition-colors ${
                          form.category === cat.id 
                            ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-bold' 
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <Icon size={14} className={form.category === cat.id ? 'text-indigo-600' : 'text-slate-400'} />
                        <span className="truncate text-[11px]">{cat.id}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Amount Spent (₹) *
                </label>
                <input
                  required
                  type="number"
                  step="0.01"
                  min="0.1"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={e => setForm({ ...form, amount: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Paid Via *
                </label>
                <select
                  required
                  value={form.payment_mode}
                  onChange={e => setForm({ ...form, payment_mode: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none font-bold uppercase tracking-wider"
                >
                  <option value="cash">Cash (From Drawer)</option>
                  <option value="upi">UPI / Bank (Owner Acc)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Notes / Description
                </label>
                <input
                  type="text"
                  placeholder="e.g. 2 teas and biscuits"
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg font-bold text-xs text-slate-700 hover:bg-slate-100 uppercase tracking-wider"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-indigo-600 rounded-lg font-bold text-xs text-white hover:bg-indigo-700 shadow-sm uppercase tracking-wider disabled:opacity-50 flex items-center gap-2"
                >
                  {isSaving ? 'Saving...' : 'Save Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
