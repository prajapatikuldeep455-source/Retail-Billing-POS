import { useState, useEffect, FormEvent } from 'react';
import { UserCheck, Clock, CheckCircle2, Search, Plus, Calendar } from 'lucide-react';
import { format } from 'date-fns';

type AttendanceRecord = {
  id: number;
  staff_name: string;
  date: string;
  check_in: string;
  check_out: string | null;
  role: string;
  notes: string | null;
};

export default function Attendance({ role }: { role?: 'admin' | 'cashier' }) {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [searchTerm, setSearchTerm] = useState('');
  const [isCheckInModalOpen, setIsCheckInModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [checkInForm, setCheckInForm] = useState({ staff_name: '', role: 'cashier', notes: '' });

  useEffect(() => {
    fetchAttendance();
  }, [selectedDate]);

  const fetchAttendance = async () => {
    try {
      const res = await fetch(`/api/attendance?date=${selectedDate}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setRecords(data);
      } else {
        console.error("Failed to fetch attendance:", data);
        setRecords([]);
      }
    } catch (err) {
      console.error(err);
      setRecords([]);
    }
  };

  const handleCheckIn = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const now = new Date().toISOString();
      
      const method = editingId ? 'PUT' : 'POST';
      const url = editingId ? `/api/attendance/${editingId}` : '/api/attendance';
      
      const bodyParams: any = {
        staff_name: checkInForm.staff_name,
        role: checkInForm.role,
        notes: checkInForm.notes
      };
      
      if (!editingId) {
        bodyParams.date = selectedDate;
        bodyParams.check_in = now;
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyParams)
      });
      if (res.ok) {
        setIsCheckInModalOpen(false);
        setEditingId(null);
        setCheckInForm({ staff_name: '', role: 'cashier', notes: '' });
        fetchAttendance();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleEdit = (record: AttendanceRecord) => {
    setEditingId(record.id);
    setCheckInForm({
      staff_name: record.staff_name,
      role: record.role,
      notes: record.notes || ''
    });
    setIsCheckInModalOpen(true);
  };

  const handleCheckOut = async (id: number) => {
    try {
      const now = new Date().toISOString();
      const res = await fetch(`/api/attendance/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ check_out: now, notes: '' })
      });
      if (res.ok) {
        fetchAttendance();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredRecords = records.filter(r => 
    r.staff_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-5 max-w-7xl mx-auto w-full flex-1 flex flex-col overflow-hidden">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <UserCheck size={18} className="text-indigo-600" /> Staff Attendance
            </h2>
            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[11px] font-mono font-bold rounded">
              {records.length} Present
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">Manage daily check-in/check-out and track shifts</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Calendar className="absolute left-2.5 top-2 text-slate-400" size={14} />
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 w-40 shadow-2xs"
            />
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-2 text-slate-400" size={14} />
            <input
              type="text"
              placeholder="Search Staff..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 w-56 shadow-2xs"
            />
          </div>
          <button
            onClick={() => setIsCheckInModalOpen(true)}
            className="px-3.5 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold shadow-md hover:bg-indigo-700 uppercase tracking-wide flex items-center gap-1 transition-all"
          >
            <Plus size={14} /> Check In
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden flex-1 flex flex-col">
        <div className="overflow-auto flex-1">
          <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider sticky top-0 z-10 border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Staff Name</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Check In</th>
                <th className="py-3 px-4">Check Out</th>
                <th className="py-3 px-4">Hours</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100 font-mono text-xs">
              {filteredRecords.map(r => {
                let duration = '—';
                if (r.check_in && r.check_out) {
                  const diff = new Date(r.check_out).getTime() - new Date(r.check_in).getTime();
                  const hours = Math.floor(diff / 3600000);
                  const mins = Math.floor((diff % 3600000) / 60000);
                  duration = `${hours}h ${mins}m`;
                } else if (r.check_in && selectedDate === format(new Date(), 'yyyy-MM-dd')) {
                  const diff = new Date().getTime() - new Date(r.check_in).getTime();
                  const hours = Math.floor(diff / 3600000);
                  const mins = Math.floor((diff % 3600000) / 60000);
                  duration = `${hours}h ${mins}m (Active)`;
                }

                return (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900 font-sans">{r.staff_name}</td>
                    <td className="py-3 px-4 font-sans uppercase text-[10px] tracking-wider">
                      <span className={`px-2 py-0.5 rounded ${r.role === 'admin' ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-800'}`}>
                        {r.role}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-emerald-600 font-bold">
                      {format(new Date(r.check_in), 'HH:mm')}
                    </td>
                    <td className="py-3 px-4">
                      {r.check_out ? (
                        <span className="text-slate-600 font-bold">{format(new Date(r.check_out), 'HH:mm')}</span>
                      ) : (
                        <span className="text-slate-400">Not Checked Out</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-700 font-bold">{duration}</td>
                    <td className="py-3 px-4 text-center font-sans">
                      <div className="flex items-center justify-center gap-2">
                        {!r.check_out ? (
                          <button
                            onClick={() => handleCheckOut(r.id)}
                            className="px-3 py-1 bg-slate-800 text-white rounded text-[10px] font-bold uppercase tracking-wider hover:bg-slate-900 shadow-2xs"
                          >
                            Check Out
                          </button>
                        ) : (
                          <span className="text-slate-400 flex items-center justify-center gap-1 text-[10px] uppercase font-bold tracking-wider mr-2">
                            <CheckCircle2 size={12} /> Completed
                          </span>
                        )}
                        {role === 'admin' && (
                          <button
                            onClick={() => handleEdit(r)}
                            className="p-1 text-slate-500 hover:text-indigo-600 bg-slate-100 hover:bg-indigo-50 rounded"
                            title="Edit Record"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredRecords.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-16 text-slate-400 font-sans">
                    <UserCheck size={32} className="mx-auto mb-2 text-slate-300 stroke-1" />
                    <p className="text-xs font-semibold text-slate-600">No attendance records for {format(new Date(selectedDate), 'dd-MMM-yyyy')}</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isCheckInModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-2xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-100">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm border border-slate-200 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Clock size={16} className="text-indigo-600" /> New Check In
              </h3>
            </div>
            <form onSubmit={handleCheckIn} className="p-5 space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Staff Name
                </label>
                <input
                  required
                  type="text"
                  value={checkInForm.staff_name}
                  onChange={e => setCheckInForm({ ...checkInForm, staff_name: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  placeholder="e.g. Ramesh"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Role
                </label>
                <select
                  value={checkInForm.role}
                  onChange={e => setCheckInForm({ ...checkInForm, role: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                >
                  <option value="cashier">Cashier</option>
                  <option value="admin">Admin</option>
                  <option value="manager">Manager</option>
                  <option value="helper">Helper / Delivery</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Notes (Optional)
                </label>
                <input
                  type="text"
                  value={checkInForm.notes}
                  onChange={e => setCheckInForm({ ...checkInForm, notes: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  placeholder="Late reason, shift details..."
                />
              </div>
              <div className="pt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsCheckInModalOpen(false)}
                  className="flex-1 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg font-bold hover:bg-slate-50 transition-colors uppercase tracking-wider"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold shadow-md hover:bg-indigo-700 transition-colors uppercase tracking-wider"
                >
                  Check In Now
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
