import { useState, useEffect, type FormEvent, type ChangeEvent } from 'react';
import { 
  Settings as SettingsIcon, Save, Store, QrCode, 
  Printer, CheckCircle2, ShieldCheck, Cpu, Copy, 
  Check, Lock, Database, DownloadCloud, UploadCloud,
  HardDrive, Server, Laptop
} from 'lucide-react';

export default function Settings({ onSettingsSaved }: { onSettingsSaved?: () => void }) {
  const [settings, setSettings] = useState({
    shop_name: 'AMAN ELECTRONICS & RETAIL',
    shop_address: '123 Commercial Plaza, Main Market, Mumbai, MH - 400001',
    shop_gstin: '27AAAAA0000A1Z5',
    shop_phone: '+91-9876543210',
    shop_email: 'desk@amanretail.in',
    owner_name: 'Aman Singh',
    machine_hd_id: 'HD-7B9A-81F4-4CE2-90D1',
    shop_upi_id: 'amanelectronics@okaxis',
    shop_upi_name: 'Aman Electronics',
    receipt_footer: 'Thank you for your visit! No return without original tax bill.',
    allow_negative_stock: 'false',
    installed_version: '2.6.2',
    admin_pin: '1234',
    cashier_pin: '0000',
  });

  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [copiedHd, setCopiedHd] = useState(false);
  const [backupStatus, setBackupStatus] = useState<string | null>(null);

  const handleBackup = () => {
    window.location.href = '/api/system/backup';
  };

  const handleRestore = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) return;
    const file = event.target.files[0];
    
    if (!confirm('Are you sure you want to restore the database? This will overwrite current data and reload the application.')) {
      return;
    }

    const formData = new FormData();
    formData.append('dbfile', file);

    try {
      setBackupStatus('Restoring database...');
      const response = await fetch('/api/system/restore', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (response.ok) {
        setBackupStatus('Database restored successfully! Reloading...');
        alert('Database restored successfully! The application will now reload.');
        window.location.reload();
      } else {
        setBackupStatus(`Restore failed: ${data.error}`);
        alert(`Restore failed: ${data.error}`);
      }
    } catch (err: any) {
      setBackupStatus(`Restore failed: ${err.message}`);
      alert(`Restore failed: ${err.message}`);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        setSettings(prev => ({ ...prev, ...data }));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      if (res.ok) {
        setSavedSuccess(true);
        if (onSettingsSaved) onSettingsSaved();
        setTimeout(() => setSavedSuccess(false), 3000);
      } else {
        alert('Failed to save settings');
      }
    } catch (e) {
      console.error(e);
      alert('Error saving settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyHd = () => {
    navigator.clipboard.writeText(settings.machine_hd_id);
    setCopiedHd(true);
    setTimeout(() => setCopiedHd(false), 2000);
  };

  return (
    <div className="p-6 sm:p-8 max-w-5xl mx-auto w-full flex-1 flex flex-col overflow-y-auto space-y-8 bg-slate-50/30">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <div className="p-2.5 bg-indigo-100 rounded-xl">
              <SettingsIcon size={24} className="text-indigo-600" />
            </div>
            Store Profile & Terminal Settings
          </h2>
          <p className="text-sm text-slate-500 mt-2 font-medium">
            Configure your store identity, tax rates, UPI payment QR, thermal printer, and local database.
          </p>
        </div>

        {savedSuccess && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 animate-in fade-in shadow-sm">
            <CheckCircle2 size={16} /> Configuration Saved
          </div>
        )}
      </div>

      {/* Terminal & Hardware Status Card */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
        <div className="p-6 sm:p-8 relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <span className="px-3 py-1 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-full text-[11px] font-black uppercase tracking-widest flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-emerald-600" /> Standalone POS Terminal
              </span>
              <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-[11px] font-mono font-bold border border-slate-200 flex items-center gap-1.5">
                <HardDrive size={13} className="text-indigo-600" /> Local SQLite Storage
              </span>
              <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-[11px] font-mono font-bold border border-indigo-100 flex items-center gap-1.5">
                <Laptop size={13} className="text-indigo-600" /> v{settings.installed_version || '2.6.2'}
              </span>
            </div>

            <div>
              <h3 className="text-xl font-black tracking-tight text-slate-900">
                {settings.shop_name}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Offline-ready desktop point-of-sale machine. Low-latency data persistence on local hardware.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleBackup}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border border-slate-200 cursor-pointer shadow-xs"
            >
              <DownloadCloud size={16} className="text-slate-600" />
              <span>Quick Backup</span>
            </button>
          </div>
        </div>

        {/* Machine Hardware ID Bar */}
        <div className="bg-slate-50 px-6 sm:px-8 py-3.5 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2.5">
            <div className="p-1 bg-white rounded-md border border-slate-200 shadow-2xs">
              <Cpu size={14} className="text-indigo-600" />
            </div>
            <span className="text-slate-600 font-medium">Terminal Device ID:</span>
            <span className="font-mono font-bold text-slate-900">
              {settings.machine_hd_id}
            </span>
          </div>

          <button
            type="button"
            onClick={handleCopyHd}
            className="text-[11px] text-indigo-600 hover:text-indigo-700 font-bold uppercase tracking-wider flex items-center gap-1 transition-colors cursor-pointer"
          >
            {copiedHd ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
            {copiedHd ? 'Copied Device ID' : 'Copy Device ID'}
          </button>
        </div>
      </div>

      {/* Main Settings Form */}
      <form onSubmit={handleSave} className="space-y-6">
        {/* Business Information */}
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="p-2 bg-indigo-50 rounded-xl">
              <Store size={18} className="text-indigo-600" />
            </div>
            Store & Tax Bill Identity
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2 ml-1">
                Store / Company Name *
              </label>
              <input
                required
                type="text"
                value={settings.shop_name}
                onChange={e => setSettings({ ...settings, shop_name: e.target.value })}
                className="w-full border border-slate-200 bg-slate-50/50 rounded-2xl px-4 py-3 text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none transition-all shadow-sm"
              />
            </div>

            <div>
              <label className="block text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2 ml-1">
                Owner / Manager Name *
              </label>
              <input
                required
                type="text"
                value={settings.owner_name || ''}
                onChange={e => setSettings({ ...settings, owner_name: e.target.value })}
                className="w-full border border-slate-200 bg-slate-50/50 rounded-2xl px-4 py-3 text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none transition-all shadow-sm"
              />
            </div>

            <div>
              <label className="block text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2 ml-1">
                GSTIN / Tax Registration No. *
              </label>
              <input
                required
                type="text"
                value={settings.shop_gstin}
                onChange={e => setSettings({ ...settings, shop_gstin: e.target.value })}
                className="w-full border border-slate-200 bg-slate-50/50 rounded-2xl px-4 py-3 text-sm font-mono font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none transition-all shadow-sm uppercase"
              />
            </div>

            <div>
              <label className="block text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2 ml-1">
                Store Contact Phone *
              </label>
              <input
                required
                type="text"
                value={settings.shop_phone}
                onChange={e => setSettings({ ...settings, shop_phone: e.target.value })}
                className="w-full border border-slate-200 bg-slate-50/50 rounded-2xl px-4 py-3 text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none transition-all shadow-sm"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2 ml-1">
                Store Billing Address (Printed on Invoices) *
              </label>
              <textarea
                required
                rows={2}
                value={settings.shop_address}
                onChange={e => setSettings({ ...settings, shop_address: e.target.value })}
                className="w-full border border-slate-200 bg-slate-50/50 rounded-2xl px-4 py-3 text-sm font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none transition-all shadow-sm"
              />
            </div>
          </div>
        </div>

        {/* Dynamic UPI Payment Settings */}
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="p-2 bg-indigo-50 rounded-xl">
              <QrCode size={18} className="text-indigo-600" />
            </div>
            Dynamic Customer UPI QR Settings
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2 ml-1">
                Merchant UPI ID / VPA *
              </label>
              <input
                required
                type="text"
                placeholder="e.g. store@okaxis"
                value={settings.shop_upi_id}
                onChange={e => setSettings({ ...settings, shop_upi_id: e.target.value })}
                className="w-full border border-slate-200 bg-slate-50/50 rounded-2xl px-4 py-3 text-sm font-mono font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none transition-all shadow-sm"
              />
            </div>

            <div>
              <label className="block text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2 ml-1">
                Payee Display Name
              </label>
              <input
                type="text"
                value={settings.shop_upi_name}
                onChange={e => setSettings({ ...settings, shop_upi_name: e.target.value })}
                className="w-full border border-slate-200 bg-slate-50/50 rounded-2xl px-4 py-3 text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none transition-all shadow-sm"
              />
            </div>
          </div>
        </div>

        {/* Thermal Receipt & Stock Controls */}
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="p-2 bg-indigo-50 rounded-xl">
              <Printer size={18} className="text-indigo-600" />
            </div>
            ESC/POS Thermal Printing & Inventory Policy
          </h3>
          
          <div className="space-y-5">
            <div>
              <label className="block text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2 ml-1">
                Receipt Footer Terms & Policy Note
              </label>
              <input
                type="text"
                value={settings.receipt_footer}
                onChange={e => setSettings({ ...settings, receipt_footer: e.target.value })}
                className="w-full border border-slate-200 bg-slate-50/50 rounded-2xl px-4 py-3 text-sm font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none transition-all shadow-sm"
              />
            </div>

            <div className="flex items-center justify-between p-5 bg-slate-50 rounded-2xl border border-slate-200">
              <div>
                <p className="font-bold text-slate-900 text-sm">Allow Negative Stock Billing</p>
                <p className="text-xs text-slate-500 mt-1">Allow counter cashiers to bill items even when stock count reaches 0</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.allow_negative_stock === 'true'}
                  onChange={e => setSettings({ ...settings, allow_negative_stock: e.target.checked ? 'true' : 'false' })}
                  className="sr-only peer"
                />
                <div className="w-12 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Security & Access PINs */}
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="p-2 bg-rose-50 rounded-xl">
              <Lock size={18} className="text-rose-600" />
            </div>
            Security & Counter PIN Controls
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2 ml-1">
                Admin PIN (Access All Modules)
              </label>
              <input
                type="text"
                placeholder="Default: 1234"
                maxLength={6}
                value={settings.admin_pin || ''}
                onChange={e => setSettings({ ...settings, admin_pin: e.target.value.replace(/[^0-9]/g, '') })}
                className="w-full border border-slate-200 bg-slate-50/50 rounded-2xl px-4 py-3 text-lg font-mono font-black text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none tracking-[0.5em] text-center transition-all shadow-sm"
              />
            </div>
            <div>
              <label className="block text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2 ml-1">
                Default Cashier PIN (Billing Only)
              </label>
              <input
                type="text"
                placeholder="Default: 0000"
                maxLength={6}
                value={settings.cashier_pin || ''}
                onChange={e => setSettings({ ...settings, cashier_pin: e.target.value.replace(/[^0-9]/g, '') })}
                className="w-full border border-slate-200 bg-slate-50/50 rounded-2xl px-4 py-3 text-lg font-mono font-black text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none tracking-[0.5em] text-center transition-all shadow-sm"
              />
            </div>
          </div>
        </div>

        {/* Local Data Maintenance */}
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="p-2 bg-blue-50 rounded-xl">
              <Database size={18} className="text-blue-600" />
            </div>
            Local Data Maintenance
          </h3>
          <p className="text-sm text-slate-500">
            Export a full copy of your SQLite database for safe backup, or restore from a previous backup file.
          </p>
          {backupStatus && (
             <div className="text-sm text-indigo-700 font-bold bg-indigo-50 p-3 rounded-xl border border-indigo-100">
                {backupStatus}
             </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              type="button"
              onClick={handleBackup}
              className="px-5 py-3.5 bg-slate-50 border border-slate-200 hover:bg-white text-slate-800 rounded-2xl text-xs font-bold tracking-wider transition-all flex items-center justify-center gap-2.5 shadow-sm cursor-pointer"
            >
              <DownloadCloud size={18} className="text-slate-600" />
              <span>Backup (.db)</span>
            </button>
            <label className="px-5 py-3.5 bg-slate-50 border border-slate-200 hover:bg-white text-slate-800 rounded-2xl text-xs font-bold tracking-wider transition-all flex items-center justify-center gap-2.5 shadow-sm cursor-pointer">
              <UploadCloud size={18} className="text-slate-600" />
              <span>Restore (.db)</span>
              <input
                type="file"
                accept=".db,.sqlite,.sqlite3"
                className="hidden"
                onChange={handleRestore}
              />
            </label>
            <button
              type="button"
              onClick={async () => {
                if (!confirm('Run database self-repair and integrity check? This will ensure all database tables and indexes are validated.')) return;
                setBackupStatus('Validating and repairing database integrity...');
                try {
                  const res = await fetch('/api/system/repair-database', { method: 'POST' });
                  const d = await res.json();
                  if (res.ok && d.success) {
                    setBackupStatus('Database integrity verified and repaired successfully!');
                    fetchSettings();
                  } else {
                    setBackupStatus(`Repair failed: ${d.error || d.message}`);
                  }
                } catch (e: any) {
                  setBackupStatus(`Repair error: ${e.message}`);
                }
              }}
              className="px-5 py-3.5 bg-slate-50 border border-slate-200 hover:bg-white text-slate-800 rounded-2xl text-xs font-bold tracking-wider transition-all flex items-center justify-center gap-2.5 shadow-sm cursor-pointer"
            >
              <HardDrive size={18} className="text-indigo-600" />
              <span>Self-Repair DB</span>
            </button>
          </div>
        </div>

        {/* Save Changes Button */}
        <div className="flex justify-end pt-4 pb-12">
          <button
            type="submit"
            disabled={isSaving}
            className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-sm shadow-xl shadow-indigo-600/20 uppercase tracking-widest flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer min-w-[240px]"
          >
            <Save size={18} /> {isSaving ? 'Saving Profile...' : 'Save Configuration'}
          </button>
        </div>
      </form>
    </div>
  );
}
