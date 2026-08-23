import React, { useState, useEffect } from 'react';
import { UserCheck, Clock, Activity, Search, ShieldAlert, ArrowDownLeft, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';

export default function StaffActivity({ role }: { role?: string }) {
  const [activities, setActivities] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchActivity();
  }, []);

  const fetchActivity = async () => {
    try {
      const res = await fetch('/api/staff-activity');
      const data = await res.json();
      setActivities(data);
    } catch (err) {
      console.error(err);
    }
  };

  if (role !== 'admin' && role !== 'manager') {
    return (
      <div className="p-8 text-center">
        <ShieldAlert size={48} className="mx-auto text-rose-500 mb-4" />
        <h2 className="text-xl font-bold text-slate-800">Access Denied</h2>
        <p className="text-slate-500 mt-2">Only Admin and Manager can view staff tracking data.</p>
      </div>
    );
  }

  const filtered = activities.filter(a => 
    a.user_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    a.action_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (a.description && a.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="p-5 max-w-7xl mx-auto w-full flex-1 flex flex-col h-[calc(100vh-64px)] overflow-hidden">
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Activity size={18} className="text-indigo-600" /> Employee Tracking System
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Track all staff actions, sales, and system events</p>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-2 text-slate-400" size={14} />
          <input
            type="text"
            placeholder="Search staff, action..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-indigo-500 w-64 shadow-2xs"
          />
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl flex-1 flex flex-col overflow-hidden shadow-2xs">
        <div className="overflow-y-auto flex-1">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 font-bold text-slate-600 uppercase">Time</th>
                <th className="px-4 py-3 font-bold text-slate-600 uppercase">Employee</th>
                <th className="px-4 py-3 font-bold text-slate-600 uppercase">Role</th>
                <th className="px-4 py-3 font-bold text-slate-600 uppercase">Action</th>
                <th className="px-4 py-3 font-bold text-slate-600 uppercase">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap text-slate-500 font-mono">
                    {format(new Date(log.timestamp), 'dd MMM, HH:mm:ss')}
                  </td>
                  <td className="px-4 py-3 font-bold text-slate-900 flex items-center gap-2">
                    <UserCheck size={14} className="text-slate-400" />
                    {log.user_name}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded font-bold uppercase text-[10px]">
                      {log.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${
                      log.severity === 'critical' ? 'bg-rose-100 text-rose-700' :
                      log.severity === 'warning' ? 'bg-amber-100 text-amber-700' :
                      log.severity === 'success' ? 'bg-emerald-100 text-emerald-700' :
                      'bg-indigo-100 text-indigo-700'
                    }`}>
                      {log.action_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {log.description}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500 font-medium">
                    No activity logs found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
