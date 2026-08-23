import { useState, useEffect, type FormEvent } from 'react';
import { 
  DollarSign, ArrowDownRight, ArrowUpRight, Lock, 
  Unlock, History, Printer, Clock, AlertCircle, 
  CheckCircle2, Plus, ArrowRight, FileText, User
} from 'lucide-react';
import { format } from 'date-fns';

type RegisterSession = {
  id: number;
  cashier_name: string;
  opened_at: string;
  closed_at: string | null;
  opening_cash: number;
  expected_cash: number;
  closing_cash: number | null;
  difference: number | null;
  status: 'open' | 'closed';
  notes: string | null;
};

type DrawerTransaction = {
  id: number;
  register_id: number;
  type: 'CASH_IN' | 'CASH_OUT';
  amount: number;
  reason: string;
  performed_by: string;
  created_at: string;
};

type CurrentRegisterData = {
  isOpen: boolean;
  register: RegisterSession | null;
  summary: {
    openingCash: number;
    cashSales: number;
    cashRefunds: number;
    cashIn: number;
    cashOut: number;
    expectedCash: number;
  };
  transactions: DrawerTransaction[];
};

export default function Register({ role = 'admin' }: { role?: 'admin' | 'cashier' | null }) {
  const [currentShift, setCurrentShift] = useState<CurrentRegisterData | null>(null);
  const [history, setHistory] = useState<RegisterSession[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isOpenShiftModalOpen, setIsOpenShiftModalOpen] = useState(false);
  const [isCloseShiftModalOpen, setIsCloseShiftModalOpen] = useState(false);
  const [isCashActionModalOpen, setIsCashActionModalOpen] = useState(false);
  const [cashActionType, setCashActionType] = useState<'CASH_IN' | 'CASH_OUT'>('CASH_IN');

  // Form states
  const [openFloatCash, setOpenFloatCash] = useState('2000');
  const [openNotes, setOpenNotes] = useState('Morning Counter Opening');
  
  const [cashActionAmount, setCashActionAmount] = useState('');
  const [cashActionReason, setCashActionReason] = useState('');

  const [countedClosingCash, setCountedClosingCash] = useState('');
  const [closeNotes, setCloseNotes] = useState('End of Shift Count');
  
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchCurrentRegister = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/register/current');
      if (res.ok) {
        const data = await res.json();
        setCurrentShift(data);
      }
      const histRes = await fetch('/api/register/history');
      if (histRes.ok) {
        const histData = await histRes.json();
        setHistory(histData);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentRegister();
  }, []);

  const handleOpenShift = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/register/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opening_cash: Number(openFloatCash) || 0,
          cashier_name: role === 'admin' ? 'Admin Desk' : 'Counter Cashier',
          notes: openNotes
        })
      });
      const data = await res.json();
      if (res.ok) {
        setIsOpenShiftModalOpen(false);
        fetchCurrentRegister();
      } else {
        setFormError(data.error || 'Failed to open register.');
      }
    } catch (err: any) {
      setFormError(err.message || 'Error opening register.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCashAction = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentShift?.register?.id) return;
    if (!cashActionAmount || Number(cashActionAmount) <= 0) {
      setFormError('Please enter a valid amount.');
      return;
    }
    if (!cashActionReason.trim()) {
      setFormError('Please enter a reason or note.');
      return;
    }

    setFormError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/register/cash-transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          register_id: currentShift.register.id,
          type: cashActionType,
          amount: Number(cashActionAmount),
          reason: cashActionReason,
          performed_by: role === 'admin' ? 'Admin Desk' : 'Cashier'
        })
      });
      const data = await res.json();
      if (res.ok) {
        setIsCashActionModalOpen(false);
        setCashActionAmount('');
        setCashActionReason('');
        fetchCurrentRegister();
      } else {
        setFormError(data.error || 'Failed to record cash transaction.');
      }
    } catch (err: any) {
      setFormError(err.message || 'Error recording transaction.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseShift = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentShift?.register?.id) return;
    if (countedClosingCash === '') {
      setFormError('Please enter the physical cash counted in drawer.');
      return;
    }

    setFormError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/register/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          register_id: currentShift.register.id,
          closing_cash: Number(countedClosingCash),
          expected_cash: currentShift.summary.expectedCash,
          notes: closeNotes
        })
      });
      const data = await res.json();
      if (res.ok) {
        setIsCloseShiftModalOpen(false);
        setCountedClosingCash('');
        fetchCurrentRegister();
      } else {
        setFormError(data.error || 'Failed to close register.');
      }
    } catch (err: any) {
      setFormError(err.message || 'Error closing shift.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col p-4 overflow-hidden">
      {/* Header */}
      <div className="flex justify-between items-center mb-4 shrink-0">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <DollarSign className="text-indigo-600" size={22} />
            Cash Register & Shift Management
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Track opening float cash, drawer in/outs, live cash balance, and shift reconciliation
          </p>
        </div>

        <div className="flex gap-2">
          {currentShift?.isOpen ? (
            <>
              <button
                onClick={() => {
                  setCashActionType('CASH_IN');
                  setFormError(null);
                  setIsCashActionModalOpen(true);
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1 shadow-sm transition-all uppercase tracking-wider"
              >
                <ArrowDownRight size={14} /> Cash In
              </button>
              <button
                onClick={() => {
                  setCashActionType('CASH_OUT');
                  setFormError(null);
                  setIsCashActionModalOpen(true);
                }}
                className="bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1 shadow-sm transition-all uppercase tracking-wider"
              >
                <ArrowUpRight size={14} /> Cash Out
              </button>
              <button
                onClick={() => {
                  setFormError(null);
                  setCountedClosingCash(currentShift.summary.expectedCash.toString());
                  setIsCloseShiftModalOpen(true);
                }}
                className="bg-slate-800 hover:bg-slate-900 text-white px-3.5 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all uppercase tracking-wider"
              >
                <Lock size={14} /> Close Register (Z-Report)
              </button>
            </>
          ) : (
            <button
              onClick={() => {
                setFormError(null);
                setIsOpenShiftModalOpen(true);
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all uppercase tracking-wider"
            >
              <Unlock size={14} /> Start New Shift (Open Register)
            </button>
          )}
        </div>
      </div>

      {/* ACTIVE SHIFT STATUS */}
      {currentShift?.isOpen ? (
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs mb-4 shrink-0">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-3">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Register Active & Open
              </span>
              <span className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                <User size={13} className="text-slate-400" /> Cashier: <strong className="text-slate-900">{currentShift.register?.cashier_name}</strong>
              </span>
              <span className="text-xs text-slate-500 font-mono flex items-center gap-1">
                <Clock size={13} className="text-slate-400" /> Opened at: {currentShift.register?.opened_at ? format(new Date(currentShift.register.opened_at), 'hh:mm a') : '-'}
              </span>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Current Drawer Balance</p>
              <p className="text-2xl font-mono font-bold text-indigo-700">₹ {currentShift.summary.expectedCash.toFixed(2)}</p>
            </div>
          </div>

          {/* Cash Flow Breakdown Grid */}
          <div className="grid grid-cols-5 gap-3">
            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">1. Float Opening</span>
              <span className="text-sm font-mono font-bold text-slate-800">₹ {currentShift.summary.openingCash.toFixed(2)}</span>
            </div>
            <div className="bg-emerald-50/60 p-2.5 rounded-lg border border-emerald-200">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">2. Cash Sales (+)</span>
              <span className="text-sm font-mono font-bold text-emerald-700">+ ₹ {currentShift.summary.cashSales.toFixed(2)}</span>
            </div>
            <div className="bg-blue-50/60 p-2.5 rounded-lg border border-blue-200">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-800 block">3. Cash In (+)</span>
              <span className="text-sm font-mono font-bold text-blue-700">+ ₹ {currentShift.summary.cashIn.toFixed(2)}</span>
            </div>
            <div className="bg-rose-50/60 p-2.5 rounded-lg border border-rose-200">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-800 block">4. Cash Out (-)</span>
              <span className="text-sm font-mono font-bold text-rose-700">- ₹ {currentShift.summary.cashOut.toFixed(2)}</span>
            </div>
            <div className="bg-amber-50/60 p-2.5 rounded-lg border border-amber-200">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block">5. Cash Returns (-)</span>
              <span className="text-sm font-mono font-bold text-amber-700">- ₹ {currentShift.summary.cashRefunds.toFixed(2)}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 shadow-2xs mb-4 shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-200/80 text-amber-800 flex items-center justify-center">
              <Lock size={20} />
            </div>
            <div>
              <p className="text-sm font-bold text-amber-900">Cash Register is Currently Closed</p>
              <p className="text-xs text-amber-700 mt-0.5">Please start a new shift to record opening float cash and track drawer transactions.</p>
            </div>
          </div>
          <button
            onClick={() => setIsOpenShiftModalOpen(true)}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs uppercase tracking-wider shadow-sm"
          >
            Open Register Now
          </button>
        </div>
      )}

      {/* SHIFT TRANSACTIONS & HISTORY TABS */}
      <div className="flex-1 flex gap-4 overflow-hidden">
        {/* Left: Active Drawer Transactions (if open) */}
        {currentShift?.isOpen && (
          <div className="w-1/3 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs flex flex-col">
            <div className="p-3 bg-slate-50 border-b border-slate-200 font-bold text-xs text-slate-800 uppercase tracking-wider flex justify-between items-center">
              <span>Shift Cash Drawer Logs</span>
              <span className="text-[10px] text-slate-500 font-mono font-normal">{(currentShift.transactions || []).length} logs</span>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2 text-xs">
              {(currentShift.transactions || []).length === 0 ? (
                <div className="text-center py-10 text-slate-400">
                  <p className="text-xs">No manual cash in/out recorded yet this shift.</p>
                </div>
              ) : (
                currentShift.transactions.map((tx) => (
                  <div key={tx.id} className="p-2 hover:bg-slate-50 rounded-lg flex justify-between items-center">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                          tx.type === 'CASH_IN' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {tx.type === 'CASH_IN' ? 'Cash In' : 'Cash Out'}
                        </span>
                        <span className="font-semibold text-slate-800">{tx.reason}</span>
                      </div>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                        {tx.created_at ? format(new Date(tx.created_at), 'hh:mm a') : ''} • By {tx.performed_by}
                      </p>
                    </div>
                    <span className={`font-mono font-bold ${
                      tx.type === 'CASH_IN' ? 'text-emerald-600' : 'text-rose-600'
                    }`}>
                      {tx.type === 'CASH_IN' ? '+' : '-'} ₹{tx.amount.toFixed(2)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Right: Past Shifts & Reconciliation History */}
        <div className={`bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs flex flex-col ${currentShift?.isOpen ? 'w-2/3' : 'w-full'}`}>
          <div className="p-3 bg-slate-50 border-b border-slate-200 font-bold text-xs text-slate-800 uppercase tracking-wider flex justify-between items-center">
            <span>Previous Shift Z-Reports & History</span>
            <span className="text-[10px] text-slate-500 font-normal">Showing last {history.length} shifts</span>
          </div>

          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="py-2.5 px-3">Shift Date & Cashier</th>
                  <th className="py-2.5 px-3 text-right">Opening Float</th>
                  <th className="py-2.5 px-3 text-right">Expected</th>
                  <th className="py-2.5 px-3 text-right">Counted</th>
                  <th className="py-2.5 px-3 text-right">Variance</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-center">Print</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {history.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <History size={32} className="mx-auto mb-2 text-slate-300 stroke-1" />
                      <p className="text-xs font-semibold">No past shift records found</p>
                    </td>
                  </tr>
                ) : (
                  history.map((shift) => {
                    const diff = Number(shift.difference) || 0;
                    return (
                      <tr key={shift.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-slate-900">{shift.cashier_name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {shift.opened_at ? format(new Date(shift.opened_at), 'dd-MMM-yyyy hh:mm a') : ''}
                            {shift.closed_at ? ` to ${format(new Date(shift.closed_at), 'hh:mm a')}` : ''}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono">
                          ₹{Number(shift.opening_cash).toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-800">
                          ₹{Number(shift.expected_cash).toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                          {shift.closing_cash !== null ? `₹${Number(shift.closing_cash).toFixed(2)}` : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold">
                          {shift.status === 'open' ? (
                            <span className="text-slate-400">Active</span>
                          ) : diff === 0 ? (
                            <span className="text-emerald-600">₹0.00 (Balanced)</span>
                          ) : diff > 0 ? (
                            <span className="text-blue-600">+₹{diff.toFixed(2)} (Excess)</span>
                          ) : (
                            <span className="text-rose-600">-₹{Math.abs(diff).toFixed(2)} (Shortage)</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            shift.status === 'open' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {shift.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center font-sans">
                          <button
                            onClick={() => window.print()}
                            className="p-1 text-slate-500 hover:text-indigo-600 rounded hover:bg-slate-100"
                            title="Print Z-Report"
                          >
                            <Printer size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* OPEN SHIFT MODAL */}
      {isOpenShiftModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-3.5 border-b border-slate-200 bg-slate-50">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Unlock size={16} className="text-indigo-600" />
                Start Shift (Open Drawer)
              </h2>
            </div>
            <form onSubmit={handleOpenShift} className="p-4 space-y-3 text-xs">
              {formError && (
                <div className="p-2 bg-rose-50 border border-rose-200 text-rose-700 rounded text-xs font-semibold">
                  {formError}
                </div>
              )}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Starting Float Cash in Drawer (₹) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={openFloatCash}
                  onChange={(e) => setOpenFloatCash(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-mono font-bold text-slate-900 focus:ring-1 focus:ring-indigo-500"
                  placeholder="e.g. 2000"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Shift Notes
                </label>
                <input
                  type="text"
                  value={openNotes}
                  onChange={(e) => setOpenNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsOpenShiftModalOpen(false)}
                  className="px-3.5 py-1.5 border border-slate-300 rounded-lg font-bold text-xs text-slate-700 hover:bg-slate-100 uppercase"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs shadow-sm uppercase tracking-wider disabled:opacity-50"
                >
                  {isSubmitting ? 'Opening...' : 'Open Shift'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CASH IN / OUT MODAL */}
      {isCashActionModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-3.5 border-b border-slate-200 bg-slate-50">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                {cashActionType === 'CASH_IN' ? (
                  <>
                    <ArrowDownRight size={16} className="text-emerald-600" /> Cash In (Add to Drawer)
                  </>
                ) : (
                  <>
                    <ArrowUpRight size={16} className="text-rose-600" /> Cash Out (Pay from Drawer)
                  </>
                )}
              </h2>
            </div>
            <form onSubmit={handleCashAction} className="p-4 space-y-3 text-xs">
              {formError && (
                <div className="p-2 bg-rose-50 border border-rose-200 text-rose-700 rounded text-xs font-semibold">
                  {formError}
                </div>
              )}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Amount (₹) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={cashActionAmount}
                  onChange={(e) => setCashActionAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-mono font-bold text-slate-900 focus:ring-1 focus:ring-indigo-500"
                  placeholder="e.g. 500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Reason / Purpose *
                </label>
                <input
                  type="text"
                  required
                  placeholder={cashActionType === 'CASH_IN' ? 'e.g. Change from Bank / Cash Inflow' : 'e.g. Tea & Refreshment / Courier Cash'}
                  value={cashActionReason}
                  onChange={(e) => setCashActionReason(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCashActionModalOpen(false)}
                  className="px-3.5 py-1.5 border border-slate-300 rounded-lg font-bold text-xs text-slate-700 hover:bg-slate-100 uppercase"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`px-4 py-1.5 text-white rounded-lg font-bold text-xs shadow-sm uppercase tracking-wider disabled:opacity-50 ${
                    cashActionType === 'CASH_IN' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {isSubmitting ? 'Saving...' : 'Record Cash'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CLOSE SHIFT / RECONCILIATION MODAL */}
      {isCloseShiftModalOpen && currentShift && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-3.5 border-b border-slate-200 bg-slate-50">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Lock size={16} className="text-slate-800" />
                Close Register & Shift Reconciliation
              </h2>
            </div>
            <form onSubmit={handleCloseShift} className="p-4 space-y-3 text-xs">
              {formError && (
                <div className="p-2 bg-rose-50 border border-rose-200 text-rose-700 rounded text-xs font-semibold">
                  {formError}
                </div>
              )}

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-500">Opening Float:</span>
                  <span className="font-mono font-bold">₹ {currentShift.summary.openingCash.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Cash Sales (+):</span>
                  <span className="font-mono font-bold text-emerald-700">+ ₹ {currentShift.summary.cashSales.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Cash In (+):</span>
                  <span className="font-mono font-bold text-blue-700">+ ₹ {currentShift.summary.cashIn.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Cash Out & Returns (-):</span>
                  <span className="font-mono font-bold text-rose-700">- ₹ {(currentShift.summary.cashOut + currentShift.summary.cashRefunds).toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-1 font-bold text-xs text-slate-900">
                  <span>Expected Drawer Cash:</span>
                  <span className="font-mono text-indigo-700">₹ {currentShift.summary.expectedCash.toFixed(2)}</span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Actual Physical Cash Counted in Drawer (₹) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={countedClosingCash}
                  onChange={(e) => setCountedClosingCash(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-mono font-bold text-slate-900 focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {countedClosingCash !== '' && (
                <div className={`p-2 rounded border text-[11px] flex justify-between font-bold ${
                  Number(countedClosingCash) - currentShift.summary.expectedCash === 0
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : Number(countedClosingCash) - currentShift.summary.expectedCash > 0
                    ? 'bg-blue-50 border-blue-200 text-blue-800'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}>
                  <span>Variance / Discrepancy:</span>
                  <span className="font-mono">
                    {Number(countedClosingCash) - currentShift.summary.expectedCash === 0
                      ? '₹ 0.00 (Perfect Match)'
                      : Number(countedClosingCash) - currentShift.summary.expectedCash > 0
                      ? `+ ₹ ${(Number(countedClosingCash) - currentShift.summary.expectedCash).toFixed(2)} (Excess)`
                      : `- ₹ ${Math.abs(Number(countedClosingCash) - currentShift.summary.expectedCash).toFixed(2)} (Shortage)`
                    }
                  </span>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Handover Notes / Reason for Discrepancy
                </label>
                <input
                  type="text"
                  value={closeNotes}
                  onChange={(e) => setCloseNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCloseShiftModalOpen(false)}
                  className="px-3.5 py-1.5 border border-slate-300 rounded-lg font-bold text-xs text-slate-700 hover:bg-slate-100 uppercase"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-bold text-xs shadow-sm uppercase tracking-wider disabled:opacity-50"
                >
                  {isSubmitting ? 'Closing...' : 'Close Shift & Reconcile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
