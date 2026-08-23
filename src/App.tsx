import { useState, useEffect, type ReactNode, type FormEvent, Suspense, lazy } from 'react';
import { Routes, Route, Link, useLocation, Navigate } from 'react-router';
import { 
  ShoppingCart, Package, ReceiptText, Users, 
  Truck, BarChart3, Settings, UserCheck, 
  Wallet, Lock, Store, ChevronDown, RotateCcw, 
  DollarSign, ArrowRight, Activity, User as UserIcon,
  AlertCircle, X, CheckCircle2, Wrench, UserPlus,
  LogIn, Eye, EyeOff, KeyRound, Phone, Mail, Building2, Loader2
} from 'lucide-react';
import { clsx } from 'clsx';
import { format } from 'date-fns';

const POS = lazy(() => import('./pages/POS'));
const Products = lazy(() => import('./pages/Products'));
const Purchases = lazy(() => import('./pages/Purchases'));
const Customers = lazy(() => import('./pages/Customers'));
const Invoices = lazy(() => import('./pages/Invoices'));
const Returns = lazy(() => import('./pages/Returns'));
const Register = lazy(() => import('./pages/Register'));
const Reports = lazy(() => import('./pages/Reports'));
const SettingsPage = lazy(() => import('./pages/Settings'));
const InvoicePrint = lazy(() => import('./pages/InvoicePrint'));
const ReturnPrint = lazy(() => import('./pages/ReturnPrint'));
const Expenses = lazy(() => import('./pages/Expenses'));
const Attendance = lazy(() => import('./pages/Attendance'));
const StaffActivity = lazy(() => import('./pages/StaffActivity'));
const UsersPage = lazy(() => import('./pages/Users'));

import type { UserAccount } from './pages/Users';

function FallbackLoader() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-white h-full">
      <Loader2 size={32} className="text-indigo-500 animate-spin mb-4" />
      <p className="text-sm font-bold text-slate-500">Loading module...</p>
    </div>
  );
}

type AuthMode = 'pin' | 'login' | 'register';

export default function App() {
  const location = useLocation();
  const isPrintPage = location.pathname.includes('/print');
  const [currentTime, setCurrentTime] = useState(new Date());

  // Staff & Session State
  const [registeredUsers, setRegisteredUsers] = useState<UserAccount[]>([]);
  const [selectedLoginUser, setSelectedLoginUser] = useState<UserAccount | null>(null);
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => {
    try {
      const saved = localStorage.getItem('pos_active_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return !!localStorage.getItem('pos_active_user');
  });

  // Auth Screen State
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPin, setLoginPin] = useState('');
  const [loginError, setLoginError] = useState('');
  const [repairSuccessMsg, setRepairSuccessMsg] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isRepairingDb, setIsRepairingDb] = useState(false);

  // Registration Form State
  const [regForm, setRegForm] = useState({
    full_name: '',
    username: '',
    phone: '',
    email: '',
    role: 'admin' as UserAccount['role'],
    pin: '',
    confirm_pin: ''
  });
  const [isRegistering, setIsRegistering] = useState(false);
  const [regSuccessMsg, setRegSuccessMsg] = useState('');

  // Store Setup Quick Modal State
  const [storeModalOpen, setStoreModalOpen] = useState(false);
  const [storeForm, setStoreForm] = useState({
    shop_name: '',
    owner_name: '',
    shop_gstin: '',
    shop_phone: '',
    shop_address: '',
    shop_upi_id: '',
    shop_upi_name: ''
  });
  const [isSavingStore, setIsSavingStore] = useState(false);

  // In-App Switch User Modal
  const [switchUserModalOpen, setSwitchUserModalOpen] = useState(false);
  const [switchPinInput, setSwitchPinInput] = useState('');
  const [switchTargetUser, setSwitchTargetUser] = useState<UserAccount | null>(null);

  const [storeSettings, setStoreSettings] = useState<{ 
    shop_name?: string; 
    shop_gstin?: string; 
    shop_upi_id?: string;
    shop_upi_name?: string;
    machine_hd_id?: string;
    admin_pin?: string; 
    cashier_pin?: string;
    shop_address?: string;
    shop_phone?: string;
    owner_name?: string;
  }>({});

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    fetchStoreSettings();
    fetchUsers();
    return () => clearInterval(timer);
  }, []);

  const fetchStoreSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        setStoreSettings(data);
        setStoreForm({
          shop_name: data.shop_name || 'AMAN ELECTRONICS & RETAIL',
          owner_name: data.owner_name || 'Aman Singh',
          shop_gstin: data.shop_gstin || '27AAAAA0000A1Z5',
          shop_phone: data.shop_phone || '+91-9876543210',
          shop_address: data.shop_address || '123 Commercial Plaza, Main Market, Mumbai, MH',
          shop_upi_id: data.shop_upi_id || 'amanelectronics@okaxis',
          shop_upi_name: data.shop_upi_name || 'Aman Electronics'
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const data: UserAccount[] = await res.json();
        setRegisteredUsers(data);
        if (data.length > 0) {
          const defaultAdmin = data.find(u => u.role === 'admin') || data[0];
          setSelectedLoginUser(defaultAdmin);
          if (!loginUsername) {
            setLoginUsername(defaultAdmin.username);
          }
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        if (errData.error && (errData.error.includes('corrupt') || errData.error.includes('malformed'))) {
          setLoginError(errData.error);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSelfRepairDb = async () => {
    setIsRepairingDb(true);
    setLoginError('');
    setRepairSuccessMsg('');
    try {
      const res = await fetch('/api/system/repair-database', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        setRepairSuccessMsg('Database self-repaired and restored! Default Admin login: username "admin", PIN 1234.');
        await fetchStoreSettings();
        await fetchUsers();
        setPinInput('');
        setLoginUsername('admin');
        setLoginPin('1234');
      } else {
        setLoginError(data.error || data.message || 'Failed to auto-repair database.');
      }
    } catch (err: any) {
      setLoginError(`Database repair error: ${err.message}`);
    } finally {
      setIsRepairingDb(false);
    }
  };

  // Keyboard number listener for PIN pad mode
  useEffect(() => {
    if (isAuthenticated || switchUserModalOpen || authMode !== 'pin') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        if (pinInput.length < 6) {
          setPinInput(prev => prev + e.key);
          setLoginError('');
        }
      } else if (e.key === 'Backspace') {
        setPinInput(prev => prev.slice(0, -1));
        setLoginError('');
      } else if (e.key === 'Enter') {
        if (pinInput.length > 0) {
          performPinLogin(pinInput);
        }
      } else if (e.key === 'Escape') {
        setPinInput('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAuthenticated, pinInput, switchUserModalOpen, selectedLoginUser, authMode]);

  const handleNumpadPress = (digit: string) => {
    if (pinInput.length < 6) {
      setPinInput(prev => prev + digit);
      setLoginError('');
    }
  };

  const handleNumpadClear = () => {
    setPinInput('');
    setLoginError('');
  };

  const handleNumpadBackspace = () => {
    setPinInput(prev => prev.slice(0, -1));
    setLoginError('');
  };

  const performPinLogin = async (pinToVerify: string) => {
    setIsLoggingIn(true);
    setLoginError('');

    try {
      const targetUser = selectedLoginUser || registeredUsers.find(u => u.role === 'admin') || { username: 'admin' };
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: targetUser.username,
          pin: pinToVerify
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setCurrentUser(data.user);
        setIsAuthenticated(true);
        localStorage.setItem('pos_active_user', JSON.stringify(data.user));
        setPinInput('');
      } else {
        setLoginError(data.error || 'Invalid Security PIN. Please try again.');
        setPinInput('');
      }
    } catch (e) {
      console.error(e);
      setLoginError('Error connecting to authentication service');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleStandardLoginSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!loginUsername.trim()) {
      setLoginError('Please enter your username or email address.');
      return;
    }
    if (!loginPin.trim()) {
      setLoginError('Please enter your security PIN / Password.');
      return;
    }

    setIsLoggingIn(true);
    setLoginError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: loginUsername.trim(),
          pin: loginPin.trim()
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setCurrentUser(data.user);
        setIsAuthenticated(true);
        localStorage.setItem('pos_active_user', JSON.stringify(data.user));
        setLoginPin('');
      } else {
        setLoginError(data.error || 'Invalid username or PIN. Please try again.');
      }
    } catch (e) {
      console.error(e);
      setLoginError('Error connecting to authentication service');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleRegisterSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setRegSuccessMsg('');

    if (!regForm.full_name.trim()) {
      setLoginError('Full Name is required.');
      return;
    }
    if (!regForm.username.trim()) {
      setLoginError('Username is required.');
      return;
    }
    if (!regForm.pin || regForm.pin.length < 4) {
      setLoginError('Security PIN must be at least 4 digits.');
      return;
    }
    if (regForm.pin !== regForm.confirm_pin) {
      setLoginError('PINs do not match. Please re-confirm.');
      return;
    }

    setIsRegistering(true);

    try {
      const res = await fetch('/api/users/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: regForm.full_name.trim(),
          username: regForm.username.trim().toLowerCase(),
          phone: regForm.phone.trim(),
          email: regForm.email.trim(),
          role: regForm.role,
          pin: regForm.pin.trim(),
          status: 'active'
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setRegSuccessMsg(`Registration successful! Your Username is: ${data.user.username}. You can log in using this Username or your Email ID.`);
        await fetchUsers();
        
        // Switch to login tab and prefill the email/username
        setAuthMode('login');
        setLoginUsername(data.user.email || data.user.username);
        setLoginPin('');
      } else {
        setLoginError(data.error || 'Failed to register new staff member.');
      }
    } catch (e: any) {
      console.error(e);
      setLoginError(e.message || 'Network error during registration.');
    } finally {
      setIsRegistering(false);
    }
  };

  const handleStoreFormSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSavingStore(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(storeForm)
      });
      if (res.ok) {
        await fetchStoreSettings();
        setStoreModalOpen(false);
      } else {
        alert('Failed to update store details.');
      }
    } catch (e) {
      console.error(e);
      alert('Error updating store details.');
    } finally {
      setIsSavingStore(false);
    }
  };

  const quickAdminLogin = () => {
    setLoginUsername('admin');
    setLoginPin('1234');
    const adminUser = registeredUsers.find(u => u.role === 'admin') || { username: 'admin' };
    setSelectedLoginUser(adminUser as UserAccount);
    performPinLogin('1234');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('pos_active_user');
    setPinInput('');
    setLoginPin('');
    setLoginError('');
    setRepairSuccessMsg('');
    fetchUsers();
  };

  const handleSwitchUser = async (e: FormEvent) => {
    e.preventDefault();
    if (!switchTargetUser) {
      alert('Please select a staff member to switch to.');
      return;
    }
    if (!switchPinInput) {
      alert('Please enter your security PIN.');
      return;
    }

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: switchTargetUser.username || switchTargetUser.email,
          pin: switchPinInput
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setCurrentUser(data.user);
        localStorage.setItem('pos_active_user', JSON.stringify(data.user));
        setSwitchUserModalOpen(false);
        setSwitchPinInput('');
        setSwitchTargetUser(null);
      } else {
        alert(data.error || 'Invalid PIN for selected staff member.');
      }
    } catch (e) {
      console.error(e);
      alert('Network error switching user.');
    }
  };

  if (isPrintPage) {
    return (
      <Suspense fallback={<FallbackLoader />}>
        <Routes>
          <Route path="/invoices/print/:id" element={<InvoicePrint />} />
          <Route path="/returns/print/:id" element={<ReturnPrint />} />
        </Routes>
      </Suspense>
    );
  }

  // -------------------------------------------------------------
  // VIEW: AUTHENTICATION & REGISTRATION SCREEN
  // -------------------------------------------------------------
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen w-screen bg-slate-900 flex flex-col justify-between items-center p-4 sm:p-6 relative overflow-hidden select-none">
        {/* Subtle Background Lighting */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -right-10 w-96 h-96 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header & Store Identity Bar */}
        <div className="w-full max-w-4xl flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black shadow-lg shadow-indigo-600/30">
              <Store size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-black text-white tracking-tight uppercase">
                  {storeSettings.shop_name || 'AMAN ELECTRONICS & RETAIL'}
                </h1>
                <button
                  type="button"
                  onClick={() => setStoreModalOpen(true)}
                  className="text-[10px] text-indigo-300 hover:text-white px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 transition-colors flex items-center gap-1 cursor-pointer font-semibold"
                  title="Configure Shop Info"
                >
                  <Building2 size={11} /> Edit Store
                </button>
              </div>
              <p className="text-[11px] text-slate-400 font-mono">
                GSTIN: {storeSettings.shop_gstin || '27AAAAA0000A1Z5'} • Terminal: <span className="text-indigo-300">{storeSettings.machine_hd_id || 'HD-7B9A-81F4'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl text-xs font-bold font-mono">
              ● Ready for Billing
            </span>
          </div>
        </div>

        {/* Center Card with Interactive Mode Switcher */}
        <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-100 relative z-10 animate-in fade-in zoom-in-95 my-auto">
          {/* Mode Switcher Tabs */}
          <div className="flex items-center p-1 bg-slate-100 rounded-2xl mb-5">
            <button
              type="button"
              onClick={() => { setAuthMode('login'); setLoginError(''); setRepairSuccessMsg(''); }}
              className={clsx(
                "flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                authMode === 'login'
                  ? "bg-white text-indigo-600 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <LogIn size={14} />
              <span>Login</span>
            </button>
            <button
              type="button"
              onClick={() => { setAuthMode('pin'); setLoginError(''); setRepairSuccessMsg(''); }}
              className={clsx(
                "flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                authMode === 'pin'
                  ? "bg-white text-indigo-600 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <KeyRound size={14} />
              <span>PIN Pad</span>
            </button>
            <button
              type="button"
              onClick={() => { setAuthMode('register'); setLoginError(''); setRepairSuccessMsg(''); }}
              className={clsx(
                "flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                authMode === 'register'
                  ? "bg-white text-indigo-600 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <UserPlus size={14} />
              <span>Register</span>
            </button>
          </div>

          {/* Success Banners */}
          {repairSuccessMsg && (
            <div className="p-3 mb-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] rounded-xl flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
              <span className="font-bold">{repairSuccessMsg}</span>
            </div>
          )}

          {regSuccessMsg && (
            <div className="p-3 mb-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] rounded-xl flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
              <span className="font-bold">{regSuccessMsg}</span>
            </div>
          )}

          {/* Error Message & Auto-Repair Action */}
          {loginError && (
            <div className="p-3 mb-4 bg-rose-50 border border-rose-200 text-rose-800 text-[11px] rounded-xl flex flex-col gap-2 animate-in fade-in">
              <div className="flex items-start gap-2">
                <AlertCircle size={15} className="shrink-0 text-rose-600 mt-0.5" />
                <span className="font-semibold">{loginError}</span>
              </div>
              {(loginError.toLowerCase().includes('corrupt') ||
                loginError.toLowerCase().includes('malformed') ||
                loginError.toLowerCase().includes('disk image') ||
                loginError.toLowerCase().includes('database') ||
                loginError.toLowerCase().includes('connecting')) && (
                <button
                  type="button"
                  disabled={isRepairingDb}
                  onClick={handleSelfRepairDb}
                  className="w-full py-2 px-3 bg-rose-600 hover:bg-rose-700 active:scale-98 text-white rounded-xl text-[11px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                >
                  <Wrench size={13} className={isRepairingDb ? 'animate-spin' : ''} />
                  {isRepairingDb ? 'Repairing Database...' : '⚡ Click to Auto-Repair Database Now'}
                </button>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 1: STANDARD FORM LOGIN & LOGIN BUTTON */}
          {/* ======================================================== */}
          {authMode === 'login' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="text-center mb-3">
                <div className="w-11 h-11 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-1.5 shadow-2xs">
                  <LogIn size={20} />
                </div>
                <h2 className="text-base font-black text-slate-900 tracking-tight">
                  Sign In to POS Counter
                </h2>
                <p className="text-xs text-slate-500">
                  Enter your username / email and security PIN
                </p>
              </div>

              {/* Quick Staff Selector Chips */}
              {registeredUsers.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Quick Select Staff:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {registeredUsers.slice(0, 4).map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => {
                          setLoginUsername(u.username);
                          setSelectedLoginUser(u);
                        }}
                        className={clsx(
                          "px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 cursor-pointer",
                          loginUsername === u.username
                            ? "bg-indigo-50 border-indigo-600 text-indigo-700 font-bold"
                            : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                        )}
                      >
                        <UserIcon size={12} className="text-indigo-600" />
                        <span>{u.full_name.split(' ')[0]}</span>
                        <span className="text-[9px] uppercase px-1 py-0.2 bg-white rounded text-slate-500 font-mono">
                          {u.role}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <form onSubmit={handleStandardLoginSubmit} className="space-y-3 pt-1">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1 ml-0.5">
                    Username / Email Address *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      placeholder="e.g. admin or cashier1"
                      value={loginUsername}
                      onChange={(e) => setLoginUsername(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
                    />
                    <UserIcon size={15} className="absolute left-3 top-3.5 text-slate-400" />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1 ml-0.5">
                    Security PIN / Password *
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="••••"
                      value={loginPin}
                      onChange={(e) => setLoginPin(e.target.value)}
                      className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono tracking-widest text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
                    />
                    <Lock size={15} className="absolute left-3 top-3.5 text-slate-400" />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Quick 1-Click Admin Shortcut */}
                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={quickAdminLogin}
                    className="text-[11px] text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <span>⚡ Quick Admin (1234)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => { setAuthMode('register'); setLoginError(''); }}
                    className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold hover:underline cursor-pointer"
                  >
                    + Register New Staff
                  </button>
                </div>

                {/* Prominent Login Button */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isLoggingIn}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 cursor-pointer"
                  >
                    <LogIn size={15} />
                    <span>{isLoggingIn ? 'Verifying Account...' : 'Log In to Terminal'}</span>
                    <ArrowRight size={15} />
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 2: QUICK PIN KEYPAD UNLOCK */}
          {/* ======================================================== */}
          {authMode === 'pin' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="text-center mb-2">
                <div className="w-11 h-11 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-1.5 shadow-2xs">
                  <KeyRound size={20} />
                </div>
                <h2 className="text-base font-black text-slate-900 tracking-tight">
                  Touch PIN Keypad
                </h2>
                <p className="text-xs text-slate-500">
                  Select cashier and tap PIN digits
                </p>
              </div>

              {/* Operator Selection Avatars */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">
                  Active Operator
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {registeredUsers.length > 0 ? (
                    registeredUsers.slice(0, 3).map((u) => {
                      const isSelected = selectedLoginUser?.id === u.id || (!selectedLoginUser && u.role === 'admin');
                      return (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => {
                            setSelectedLoginUser(u);
                            setPinInput('');
                            setLoginError('');
                          }}
                          className={clsx(
                            "p-2 rounded-2xl border text-center transition-all flex flex-col items-center gap-1 cursor-pointer",
                            isSelected
                              ? "bg-indigo-50 border-indigo-600 ring-2 ring-indigo-600/20 shadow-xs"
                              : "bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-600"
                          )}
                        >
                          <div className={clsx(
                            "w-6 h-6 rounded-xl flex items-center justify-center text-xs font-bold uppercase",
                            isSelected ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-700"
                          )}>
                            {u.full_name.charAt(0)}
                          </div>
                          <span className="text-[10px] font-bold text-slate-900 truncate w-full">
                            {u.full_name.split(' ')[0]}
                          </span>
                          <span className="text-[8px] uppercase font-mono px-1 rounded bg-white text-slate-500">
                            {u.role}
                          </span>
                        </button>
                      );
                    })
                  ) : (
                    <div className="col-span-3 text-center text-xs text-slate-400 py-2">
                      Admin Terminal Ready
                    </div>
                  )}
                </div>
              </div>

              {/* PIN Input Indicator */}
              <div className="text-center space-y-1">
                <div className="flex justify-center gap-2">
                  {[0, 1, 2, 3].map((idx) => (
                    <div
                      key={idx}
                      className={clsx(
                        "w-3.5 h-3.5 rounded-full border transition-all flex items-center justify-center",
                        pinInput.length > idx
                          ? "bg-indigo-600 border-indigo-600 scale-110 shadow-xs"
                          : "bg-slate-100 border-slate-300"
                      )}
                    />
                  ))}
                </div>
                <p className="text-[10px] text-slate-400 font-mono">
                  {pinInput.length === 0 ? 'Type digits on numpad or keyboard' : `${pinInput.length} of 4 digits entered`}
                </p>
              </div>

              {/* Numeric Keypad */}
              <div className="grid grid-cols-3 gap-1.5 max-w-xs mx-auto">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handleNumpadPress(num)}
                    className="h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-mono text-sm font-bold transition-all active:scale-95 shadow-2xs cursor-pointer"
                  >
                    {num}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={handleNumpadClear}
                  className="h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 text-[11px] font-bold uppercase tracking-wider active:scale-95 cursor-pointer"
                >
                  CLR
                </button>
                <button
                  type="button"
                  onClick={() => handleNumpadPress('0')}
                  className="h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-mono text-sm font-bold active:scale-95 shadow-2xs cursor-pointer"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={handleNumpadBackspace}
                  className="h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold uppercase active:scale-95 cursor-pointer"
                >
                  ⌫
                </button>
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={quickAdminLogin}
                  className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 shadow-2xs cursor-pointer"
                >
                  <span>⚡ Admin (1234)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode('login')}
                  className="text-[11px] text-indigo-600 hover:underline font-bold cursor-pointer"
                >
                  Use Username Login
                </button>
              </div>

              <button
                type="button"
                disabled={isLoggingIn || pinInput.length === 0}
                onClick={() => performPinLogin(pinInput)}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
              >
                {isLoggingIn ? 'Verifying PIN...' : 'Unlock POS Counter'}
                <ArrowRight size={14} />
              </button>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 3: REGISTER NEW STAFF / ACCOUNT FORM */}
          {/* ======================================================== */}
          {authMode === 'register' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="text-center mb-2">
                <div className="w-11 h-11 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-1.5 shadow-2xs">
                  <UserPlus size={20} />
                </div>
                <h2 className="text-base font-black text-slate-900 tracking-tight">
                  Register New Staff Member
                </h2>
                <p className="text-xs text-slate-500">
                  Create a new staff or manager profile with counter PIN
                </p>
              </div>

              <form onSubmit={handleRegisterSubmit} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1 ml-0.5">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Ramesh Patel"
                      value={regForm.full_name}
                      onChange={e => setRegForm({ ...regForm, full_name: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1 ml-0.5">
                      Username *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. ramesh_pos"
                      value={regForm.username}
                      onChange={e => setRegForm({ ...regForm, username: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1 ml-0.5">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      placeholder="e.g. 9876543210"
                      value={regForm.phone}
                      onChange={e => setRegForm({ ...regForm, phone: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1 ml-0.5">
                      Email Address
                    </label>
                    <input
                      type="email"
                      placeholder="e.g. owner@shop.com"
                      value={regForm.email}
                      onChange={e => setRegForm({ ...regForm, email: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1 ml-0.5">
                      4-Digit PIN *
                    </label>
                    <input
                      type="password"
                      maxLength={6}
                      required
                      placeholder="••••"
                      value={regForm.pin}
                      onChange={e => setRegForm({ ...regForm, pin: e.target.value.replace(/[^0-9]/g, '') })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold tracking-widest text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none text-center"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1 ml-0.5">
                      Confirm PIN *
                    </label>
                    <input
                      type="password"
                      maxLength={6}
                      required
                      placeholder="••••"
                      value={regForm.confirm_pin}
                      onChange={e => setRegForm({ ...regForm, confirm_pin: e.target.value.replace(/[^0-9]/g, '') })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold tracking-widest text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none text-center"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={() => { setAuthMode('login'); setLoginError(''); }}
                    className="text-[11px] text-slate-600 hover:text-slate-900 font-bold hover:underline cursor-pointer"
                  >
                    ← Back to Login
                  </button>
                </div>

                <div className="pt-1">
                  <button
                    type="submit"
                    disabled={isRegistering}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 cursor-pointer"
                  >
                    <UserPlus size={15} />
                    <span>{isRegistering ? 'Registering Account...' : 'Register & Create Account'}</span>
                    <ArrowRight size={15} />
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Bottom Footer */}
        <div className="text-center text-xs text-slate-400 font-mono z-10">
          Retail POS Terminal • Offline SQLite Engine
        </div>

        {/* QUICK STORE IDENTITY SETUP MODAL */}
        {storeModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
              <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                <h2 className="font-black text-slate-900 text-sm uppercase tracking-wider flex items-center gap-2">
                  <Building2 size={18} className="text-indigo-600" /> Store Profile & Tax Bill Header
                </h2>
                <button
                  type="button"
                  onClick={() => setStoreModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleStoreFormSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Store / Company Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={storeForm.shop_name}
                    onChange={e => setStoreForm({ ...storeForm, shop_name: e.target.value })}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                      Owner / Manager Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={storeForm.owner_name}
                      onChange={e => setStoreForm({ ...storeForm, owner_name: e.target.value })}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                      GSTIN / Tax Registration *
                    </label>
                    <input
                      type="text"
                      required
                      value={storeForm.shop_gstin}
                      onChange={e => setStoreForm({ ...storeForm, shop_gstin: e.target.value })}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none uppercase"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                      Contact Phone *
                    </label>
                    <input
                      type="text"
                      required
                      value={storeForm.shop_phone}
                      onChange={e => setStoreForm({ ...storeForm, shop_phone: e.target.value })}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                      Merchant UPI ID (for QR)
                    </label>
                    <input
                      type="text"
                      value={storeForm.shop_upi_id}
                      onChange={e => setStoreForm({ ...storeForm, shop_upi_id: e.target.value })}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Store Billing Address *
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={storeForm.shop_address}
                    onChange={e => setStoreForm({ ...storeForm, shop_address: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setStoreModalOpen(false)}
                    className="flex-1 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 uppercase tracking-wider hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingStore}
                    className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm cursor-pointer"
                  >
                    {isSavingStore ? 'Saving...' : 'Save Store Details'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  const role = currentUser?.role || 'cashier';

  // -------------------------------------------------------------
  // MAIN POS APPLICATION
  // -------------------------------------------------------------
  return (
    <div className="flex flex-col h-screen w-screen bg-[#F8FAFC] text-slate-900 font-sans overflow-hidden antialiased select-none print:h-auto print:w-auto print:overflow-visible print:bg-white">
      {/* Top Header Bar */}
      <header className="bg-white border-b border-slate-200/80 px-4 py-2.5 flex items-center justify-between shadow-2xs shrink-0 z-30 print:hidden">
        {/* Brand & Store Zone */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-black text-sm shadow-xs">
            <Store size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-slate-900 text-sm tracking-tight uppercase">
                {storeSettings.shop_name || 'AMAN ELECTRONICS & RETAIL'}
              </span>
              <span className="px-1.5 py-0.5 bg-emerald-50 border border-emerald-100 text-emerald-700 text-[9px] font-black rounded uppercase tracking-wider">
                GST Ready
              </span>
            </div>
            <p className="text-[10px] text-slate-500 font-mono font-medium mt-0.5 uppercase tracking-wider">
              GSTIN: {storeSettings.shop_gstin || '27AAAAA0000A1Z5'}
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex-1 min-w-0 flex items-center bg-slate-100/90 p-1 rounded-lg border border-slate-200 mx-4">
          <nav className="flex-1 flex items-center gap-1 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <NavTab to="/" icon={<ShoppingCart size={14} />} label="POS Billing" active={location.pathname === '/'} />
            <NavTab to="/products" icon={<Package size={14} />} label="Inventory" active={location.pathname === '/products'} />
            <NavTab to="/purchases" icon={<Truck size={14} />} label="Purchases" active={location.pathname === '/purchases'} />
            <NavTab to="/customers" icon={<Users size={14} />} label="Contacts" active={location.pathname === '/customers'} />
            <NavTab to="/register" icon={<DollarSign size={14} />} label="Register" active={location.pathname === '/register'} />
          </nav>
          <div className="pl-1 border-l border-slate-200 ml-1 shrink-0">
            <MoreDropdown active={['/invoices', '/returns', '/expenses', '/attendance', '/staff-activity', '/reports', '/users', '/settings'].includes(location.pathname)}>
              <DropdownItem to="/invoices" icon={<ReceiptText size={14} />} label="Invoices & Bills" active={location.pathname === '/invoices'} />
              <DropdownItem to="/returns" icon={<RotateCcw size={14} />} label="Returns / Credit Notes" active={location.pathname === '/returns'} />
              <DropdownItem to="/expenses" icon={<Wallet size={14} />} label="Expenses (Petty Cash)" active={location.pathname === '/expenses'} />
              <DropdownItem to="/attendance" icon={<UserCheck size={14} />} label="Staff Attendance" active={location.pathname === '/attendance'} />
              {['admin', 'manager'].includes(role) && (
                <>
                  <DropdownItem to="/staff-activity" icon={<Activity size={14} />} label="Staff Activity Log" active={location.pathname === '/staff-activity'} />
                  <DropdownItem to="/users" icon={<Users size={14} />} label="Registered Staff" active={location.pathname === '/users'} />
                  <DropdownItem to="/reports" icon={<BarChart3 size={14} />} label="Analytics & GST Reports" active={location.pathname === '/reports'} />
                  <DropdownItem to="/settings" icon={<Settings size={14} />} label="Store Settings" active={location.pathname === '/settings'} />
                </>
              )}
            </MoreDropdown>
          </div>
        </div>

        {/* Operator Profile & Switcher */}
        <div className="flex gap-3 items-center shrink-0">
          <div className="text-right hidden xl:block">
            <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">System Clock</p>
            <p className="text-xs font-mono font-semibold text-slate-700">
              {format(currentTime, 'dd-MMM-yyyy | HH:mm:ss')}
            </p>
          </div>

          <div className="h-6 w-px bg-slate-200 hidden xl:block" />

          {/* Active Operator Badge with Switch User Option */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 pl-2.5 rounded-lg border border-slate-200">
            <button
              onClick={() => { setSwitchTargetUser(null); setSwitchPinInput(''); setSwitchUserModalOpen(true); }}
              className="text-left hover:opacity-80 transition-opacity cursor-pointer"
              title="Click to Switch Operator / Cashier"
            >
              <span className="text-[10px] font-bold text-slate-900 flex items-center gap-1">
                <UserIcon size={12} className="text-indigo-600" />
                {currentUser?.full_name || 'Administrator'}
              </span>
              <span className="text-[9px] font-black uppercase text-indigo-600 tracking-wider block">
                {role}
              </span>
            </button>

            <button
              onClick={handleLogout}
              className="px-3 py-1.5 ml-2 bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-bold cursor-pointer"
              title="Lock / Logout"
            >
              <Lock size={13} />
              LOCK
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Workspace */}
      <main className="flex-1 overflow-hidden flex flex-col bg-[#F8FAFC] print:overflow-visible print:bg-white">
        <Suspense fallback={<FallbackLoader />}>
          <Routes>
            <Route path="/" element={<POS role={role as any} />} />
            <Route path="/products" element={<Products role={role as any} />} />
            <Route path="/purchases" element={<Purchases role={role as any} />} />
            <Route path="/customers" element={<Customers role={role as any} />} />
            <Route path="/expenses" element={<Expenses role={role as any} />} />
            <Route path="/register" element={<Register role={role as any} />} />
            <Route path="/invoices" element={<Invoices role={role as any} />} />
            <Route path="/returns" element={<Returns role={role as any} />} />
            <Route path="/attendance" element={<Attendance role={role as any} />} />
            <Route path="/staff-activity" element={<StaffActivity role={role} />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/users" element={<UsersPage currentUser={currentUser} role={role} />} />
            <Route path="/settings" element={<SettingsPage onSettingsSaved={fetchStoreSettings} />} />
          </Routes>
        </Suspense>
      </main>

      {/* Footer Bar */}
      <footer className="bg-slate-900 text-slate-400 px-6 py-1.5 text-[11px] flex justify-between items-center font-medium shrink-0 border-t border-slate-800 print:hidden">
        <div className="flex gap-4 uppercase tracking-tight text-slate-300">
          <span><kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-indigo-400 font-mono font-bold border border-slate-700">F1</kbd> Search</span>
          <span><kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-indigo-400 font-mono font-bold border border-slate-700">F2</kbd> Customer</span>
          <span><kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-indigo-400 font-mono font-bold border border-slate-700">F4</kbd> Wholesale</span>
          <span><kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-indigo-400 font-mono font-bold border border-slate-700">F9</kbd> Cash</span>
          <span><kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-indigo-400 font-mono font-bold border border-slate-700">F12</kbd> Settle & Print</span>
        </div>

        <div className="flex items-center gap-4 text-slate-400 text-[11px]">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" /> 80mm ESC/POS Ready
          </span>
          <span className="text-slate-500 font-mono text-[10px]">OPERATOR: {currentUser?.username?.toUpperCase()}</span>
        </div>
      </footer>

      {/* MODAL: QUICK SWITCH OPERATOR */}
      {switchUserModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <h2 className="font-black text-slate-900 text-sm uppercase tracking-wider flex items-center gap-2">
                <Users size={16} className="text-indigo-600" /> Switch Counter Operator
              </h2>
              <button onClick={() => setSwitchUserModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSwitchUser} className="p-6 space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  Select Staff Member:
                </label>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {registeredUsers.filter(u => u.status === 'active').map(u => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => setSwitchTargetUser(u)}
                      className={clsx(
                        "w-full text-left p-2 rounded-lg border text-xs flex items-center justify-between transition-colors cursor-pointer",
                        switchTargetUser?.id === u.id
                          ? "bg-indigo-50 border-indigo-500 font-bold text-indigo-900"
                          : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
                      )}
                    >
                      <span>{u.full_name} (@{u.username})</span>
                      <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 bg-slate-100 rounded font-mono">
                        {u.role}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {switchTargetUser && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Enter PIN for {switchTargetUser.full_name}:
                  </label>
                  <input
                    type="password"
                    maxLength={6}
                    required
                    autoFocus
                    placeholder="••••"
                    value={switchPinInput}
                    onChange={(e) => setSwitchPinInput(e.target.value.replace(/[^0-9]/g, ''))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono tracking-widest text-center focus:ring-2 focus:ring-indigo-500 focus:outline-none mb-2"
                  />
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSwitchUserModalOpen(false)}
                  className="flex-1 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 uppercase tracking-wider hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!switchTargetUser || switchPinInput.length === 0}
                  className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold uppercase tracking-wider shadow-sm cursor-pointer"
                >
                  Switch Now
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------
// NAVIGATION COMPONENTS
// -------------------------------------------------------------

function NavTab({ to, icon, label, active }: { to: string; icon: ReactNode; label: string; active: boolean }) {
  return (
    <Link
      to={to}
      className={clsx(
        "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold tracking-tight transition-all shrink-0 whitespace-nowrap",
        active
          ? "bg-white text-indigo-600 shadow-xs border border-slate-200/60"
          : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
      )}
    >
      <span className={clsx(active ? "text-indigo-600" : "text-slate-500")}>{icon}</span>
      <span>{label}</span>
    </Link>
  );
}

function MoreDropdown({ children, active }: { children: ReactNode; active: boolean }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const close = () => setOpen(false);
    if (open) {
      window.addEventListener('click', close);
      return () => window.removeEventListener('click', close);
    }
  }, [open]);

  return (
    <div className="relative" onClick={e => e.stopPropagation()}>
      <button
        onClick={() => setOpen(!open)}
        className={clsx(
          "flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-bold tracking-tight transition-all shrink-0 cursor-pointer",
          active || open
            ? "bg-white text-indigo-600 shadow-xs border border-slate-200/60"
            : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
        )}
      >
        <span>More</span>
        <ChevronDown size={13} className={clsx("transition-transform duration-200", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-56 bg-white rounded-xl shadow-xl border border-slate-200/80 p-1.5 z-50 animate-in fade-in zoom-in-95">
          <div className="space-y-0.5" onClick={() => setOpen(false)}>
            {children}
          </div>
        </div>
      )}
    </div>
  );
}

function DropdownItem({ to, icon, label, active }: { to: string; icon: ReactNode; label: string; active: boolean }) {
  return (
    <Link
      to={to}
      className={clsx(
        "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
        active
          ? "bg-indigo-50 text-indigo-600 font-bold"
          : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
      )}
    >
      <span className={clsx(active ? "text-indigo-600" : "text-slate-500")}>{icon}</span>
      <span>{label}</span>
    </Link>
  );
}
