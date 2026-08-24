import { useState, useEffect } from 'react';
import { 
  BarChart3, PieChart, Download, Printer, Calendar, TrendingUp, 
  IndianRupee, Package, ArrowUpRight, ShieldCheck, FileSpreadsheet, Wallet
} from 'lucide-react';
import { format } from 'date-fns';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart as RechartsPieChart, Pie, Cell
} from 'recharts';

const COLORS = ['#4f46e5', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

type DashboardData = {
  today: { invoices: number; sales: number; taxable: number };
  all_time: { invoices: number; sales: number };
  payment_breakdown: { payment_method: string; count: number; total: number }[];
  top_products: { product_name: string; total_qty: number; total_sales: number }[];
  low_stock_items: { id: number; name: string; category: string; current_stock: number; min_stock_alert: number; retail_price: number; unit: string }[];
  inventory_summary: { total_cost_value: number; total_retail_value: number; total_items: number };
};

type HsnItem = {
  hsn_code: string;
  total_qty: number;
  taxable_value: number;
  gst_rate: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  total_value: number;
};

type GstReportData = {
  hsn_summary: HsnItem[];
  tax_totals: {
    total_taxable: number;
    total_cgst: number;
    total_sgst: number;
    total_igst: number;
    total_grand: number;
  };
  sale_bills: {
    id: number;
    invoice_number: string;
    date: string;
    customer_name: string;
    customer_gstin: string;
    taxable_value: number;
    cgst_total: number;
    sgst_total: number;
    igst_total: number;
    grand_total: number;
    payment_method: string;
    status: string;
  }[];
};


type ProfitLossData = {
  revenue: number;
  cogs: number;
  gross_profit: number;
  expenses: number;
  net_profit: number;
  margin_percentage: number;
  daily_trends: {
    date: string;
    daily_revenue: number;
    daily_cogs: number;
  }[];
};

type DaybookData = {
  date: string;
  in_sales: { payment_method: string; amount: number }[];
  in_udhar: { payment_mode: string; amount: number }[];
  out_purchases: { payment_method: string; amount: number }[];
  out_expenses: { payment_mode: string; amount: number }[];
};

export default function Reports() {
  const [activeTab, setActiveTab] = useState<'kpi' | 'profit_loss' | 'gstr1' | 'inventory' | 'daybook'>('kpi');
  const [gstViewTab, setGstViewTab] = useState<'hsn' | 'bills'>('bills');
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [gstData, setGstData] = useState<GstReportData | null>(null);
  const [daybookData, setDaybookData] = useState<DaybookData | null>(null);
  const [plData, setPlData] = useState<ProfitLossData | null>(null);
  const [daybookDate, setDaybookDate] = useState(() => new Date().toISOString().split('T')[0]);
  
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(1); // 1st of current month
    return d.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().split('T')[0]);

  useEffect(() => {
    fetchDashboard();
    fetchGstReport();
    fetchProfitLoss();
  }, [fromDate, toDate]);

  useEffect(() => {
    fetchDaybook();
  }, [daybookDate]);

  const fetchDaybook = async () => {
    try {
      const res = await fetch(`/api/reports/daybook?date=${daybookDate}`);
      if (res.ok) setDaybookData(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  
  const fetchProfitLoss = async () => {
    try {
      const res = await fetch(`/api/reports/profit-loss?from=${fromDate}&to=${toDate}`);
      if (res.ok) setPlData(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const fetchDashboard = async () => {
    try {
      const res = await fetch('/api/reports/dashboard');
      if (res.ok) setDashboard(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const fetchGstReport = async () => {
    try {
      const res = await fetch(`/api/reports/gst?from=${fromDate}&to=${toDate}`);
      if (res.ok) setGstData(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const exportSaleBillsCsv = () => {
    if (!gstData || !gstData.sale_bills || !gstData.sale_bills.length) {
      alert('No Sale Bills available to export.');
      return;
    }

    const headers = ['Invoice No', 'Date', 'Customer Name', 'GSTIN', 'Taxable Value', 'CGST', 'SGST', 'IGST', 'Total Invoice Value', 'Payment Mode', 'Status'];
    const rows = gstData.sale_bills.map(bill => [
      bill.invoice_number,
      format(new Date(bill.date), 'dd/MM/yyyy'),
      `"${(bill.customer_name || 'Walk-in Customer').replace(/"/g, '""')}"`,
      bill.customer_gstin || 'URD',
      bill.taxable_value.toFixed(2),
      bill.cgst_total.toFixed(2),
      bill.sgst_total.toFixed(2),
      bill.igst_total.toFixed(2),
      bill.grand_total.toFixed(2),
      bill.payment_method.toUpperCase(),
      bill.status.toUpperCase()
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `GST_Sale_Bills_${fromDate}_to_${toDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportGstr1Csv = () => {
    if (!gstData || !gstData.hsn_summary?.length) {
      alert('No GST data available to export.');
      return;
    }

    const headers = ['HSN/SAC Code', 'Total Qty', 'Taxable Value (INR)', 'GST Rate (%)', 'CGST (INR)', 'SGST (INR)', 'IGST (INR)', 'Total Value (INR)'];
    const rows = gstData.hsn_summary.map(item => [
      item.hsn_code,
      item.total_qty,
      item.taxable_value.toFixed(2),
      `${item.gst_rate}%`,
      item.cgst_amount.toFixed(2),
      item.sgst_amount.toFixed(2),
      item.igst_amount.toFixed(2),
      item.total_value.toFixed(2)
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `GSTR-1_HSN_Summary_${fromDate}_to_${toDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-5 max-w-7xl mx-auto w-full flex-1 flex flex-col overflow-hidden">
      {/* Header & Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Reports & GST Compliance</h2>
            <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-700 text-[11px] font-bold rounded uppercase tracking-wider">
              Govt. GST Format
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">HSN-wise tax summary, GSTR-1 export, sales revenue, and inventory valuation</p>
        </div>

        {/* View Switcher & Action */}
        <div className="flex items-center gap-2.5">
          <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('profit_loss')}
              className={`px-3 py-1 rounded-md transition-colors flex items-center gap-1 ${
                activeTab === 'profit_loss' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart3 size={13} /> Profit & Loss
            </button>

            <button
              onClick={() => setActiveTab('kpi')}
              className={`px-3 py-1 rounded-md transition-colors ${
                activeTab === 'kpi' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sales Analytics
            </button>
            <button
              onClick={() => setActiveTab('daybook')}
              className={`px-3 py-1 rounded-md transition-colors flex items-center gap-1 ${
                activeTab === 'daybook' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Wallet size={13} /> Daybook / EOD
            </button>
            <button
              onClick={() => setActiveTab('gstr1')}
              className={`px-3 py-1 rounded-md transition-colors flex items-center gap-1 ${
                activeTab === 'gstr1' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileSpreadsheet size={13} /> GSTR-1 HSN Summary
            </button>
            <button
              onClick={() => setActiveTab('inventory')}
              className={`px-3 py-1 rounded-md transition-colors ${
                activeTab === 'inventory' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Stock Valuation
            </button>
          </div>

          {activeTab === 'gstr1' && (
            <div className="flex gap-2">
              <button 
                onClick={exportSaleBillsCsv}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all uppercase tracking-wider"
              >
                <Download size={13} /> Export Sale Bills (B2B/B2C)
              </button>
              <button 
                onClick={exportGstr1Csv}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all uppercase tracking-wider"
              >
                <Download size={13} /> Export HSN
              </button>
            </div>
          )}
        </div>
      </div>

      
      {activeTab === 'profit_loss' && plData && (
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
              <PieChart size={16} className="text-indigo-600" /> P&L Statement
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Net Revenue</p>
                <p className="text-xl font-mono font-black text-slate-900 mt-1">₹ {plData.revenue.toFixed(2)}</p>
              </div>
              <div className="bg-rose-50 p-4 rounded-xl border border-rose-100">
                <p className="text-[11px] font-bold text-rose-600 uppercase tracking-wider">Cost of Goods (COGS)</p>
                <p className="text-xl font-mono font-black text-rose-900 mt-1">₹ {plData.cogs.toFixed(2)}</p>
              </div>
              <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
                <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Operating Expenses</p>
                <p className="text-xl font-mono font-black text-amber-900 mt-1">₹ {plData.expenses.toFixed(2)}</p>
              </div>
              <div className={`p-4 rounded-xl border ${plData.net_profit >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                <p className={`text-[11px] font-bold uppercase tracking-wider ${plData.net_profit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>Net Profit</p>
                <p className={`text-xl font-mono font-black mt-1 ${plData.net_profit >= 0 ? 'text-emerald-900' : 'text-red-900'}`}>
                  ₹ {plData.net_profit.toFixed(2)}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-900 rounded-xl text-white">
              <div>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Gross Profit Margin</p>
                <p className="text-2xl font-mono font-black mt-1">{plData.margin_percentage.toFixed(2)}%</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Gross Profit</p>
                <p className="text-2xl font-mono font-black mt-1 text-emerald-400">₹ {plData.gross_profit.toFixed(2)}</p>
              </div>
            </div>
            
            {/* Daily Trends Table */}
            <div className="mt-6 border border-slate-200 rounded-xl overflow-hidden">
              <div className="bg-slate-50 px-4 py-2 border-b border-slate-200">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Daily Margin Breakdown</h4>
              </div>
              <div className="max-h-64 overflow-y-auto">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-white sticky top-0 border-b border-slate-200 shadow-xs z-10">
                    <tr>
                      <th className="py-2.5 px-4 font-bold text-slate-500 uppercase">Date</th>
                      <th className="py-2.5 px-4 font-bold text-slate-500 uppercase text-right">Revenue</th>
                      <th className="py-2.5 px-4 font-bold text-slate-500 uppercase text-right">COGS</th>
                      <th className="py-2.5 px-4 font-bold text-slate-500 uppercase text-right">Gross Profit</th>
                      <th className="py-2.5 px-4 font-bold text-slate-500 uppercase text-right">Margin %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {plData.daily_trends.map((day, i) => {
                      const dayProfit = day.daily_revenue - day.daily_cogs;
                      const dayMargin = day.daily_revenue > 0 ? (dayProfit / day.daily_revenue) * 100 : 0;
                      return (
                        <tr key={i} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2 px-4 font-mono text-slate-600">{day.date}</td>
                          <td className="py-2 px-4 font-mono text-slate-900 text-right">₹ {day.daily_revenue.toFixed(2)}</td>
                          <td className="py-2 px-4 font-mono text-rose-600 text-right">₹ {day.daily_cogs.toFixed(2)}</td>
                          <td className="py-2 px-4 font-mono text-emerald-600 font-bold text-right">₹ {dayProfit.toFixed(2)}</td>
                          <td className="py-2 px-4 font-mono text-slate-700 font-bold text-right">{dayMargin.toFixed(1)}%</td>
                        </tr>
                      );
                    })}
                    {plData.daily_trends.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400 font-sans">No daily data available for this period.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'kpi' && dashboard && (
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex justify-between items-center text-slate-500 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider">Today's Revenue</span>
                <TrendingUp size={15} className="text-indigo-600" />
              </div>
              <p className="text-xl font-mono font-extrabold text-slate-900">
                ₹ {dashboard.today.sales.toFixed(2)}
              </p>
              <p className="text-[11px] text-slate-500 mt-1 font-medium">
                {dashboard.today.invoices} invoices billed today
              </p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex justify-between items-center text-slate-500 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider">All-Time Sales</span>
                <IndianRupee size={15} className="text-emerald-600" />
              </div>
              <p className="text-xl font-mono font-extrabold text-slate-900">
                ₹ {dashboard.all_time.sales.toFixed(2)}
              </p>
              <p className="text-[11px] text-slate-500 mt-1 font-medium">
                {dashboard.all_time.invoices} total invoices generated
              </p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex justify-between items-center text-slate-500 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider">Stock Valuation (Cost)</span>
                <Package size={15} className="text-blue-600" />
              </div>
              <p className="text-xl font-mono font-extrabold text-slate-900">
                ₹ {Number(dashboard.inventory_summary.total_cost_value || 0).toFixed(2)}
              </p>
              <p className="text-[11px] text-slate-500 mt-1 font-medium">
                Across {dashboard.inventory_summary.total_items} items in catalog
              </p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex justify-between items-center text-slate-500 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider">Stock Valuation (Retail)</span>
                <ArrowUpRight size={15} className="text-purple-600" />
              </div>
              <p className="text-xl font-mono font-extrabold text-slate-900">
                ₹ {Number(dashboard.inventory_summary.total_retail_value || 0).toFixed(2)}
              </p>
              <p className="text-[11px] text-emerald-600 font-bold mt-1">
                Potential Margin: ₹ {(Number(dashboard.inventory_summary.total_retail_value || 0) - Number(dashboard.inventory_summary.total_cost_value || 0)).toFixed(2)}
              </p>
            </div>
          </div>

          {/* Grid of Top Selling Products & Payment Distribution */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Top 5 Products */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
                Top 5 Best Selling Items
              </h3>
              <div className="h-48">
                {dashboard.top_products.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dashboard.top_products} layout="vertical" margin={{ top: 0, right: 20, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="product_name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} width={120} />
                      <RechartsTooltip 
                        cursor={{ fill: '#f8fafc' }}
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        formatter={(value: any) => [`₹${Number(value).toFixed(2)}`, 'Sales']}
                      />
                      <Bar dataKey="total_sales" fill="#4f46e5" radius={[0, 4, 4, 0]} barSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-400 text-xs">No sales recorded yet</div>
                )}
              </div>
            </div>

            {/* Payment Method Distribution */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
                Sales Collection by Payment Mode
              </h3>
              <div className="h-48 flex items-center">
                {dashboard.payment_breakdown.length > 0 ? (
                  <>
                    <div className="w-1/2 h-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsPieChart>
                          <Pie
                            data={dashboard.payment_breakdown}
                            dataKey="total"
                            nameKey="payment_method"
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={70}
                            paddingAngle={2}
                          >
                            {dashboard.payment_breakdown.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <RechartsTooltip 
                            formatter={(value: any) => [`₹${Number(value).toFixed(2)}`, 'Amount']}
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                          />
                        </RechartsPieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="w-1/2 pl-2 flex flex-col justify-center space-y-2">
                      {dashboard.payment_breakdown.map((pm, idx) => (
                        <div key={idx} className="flex justify-between items-center text-xs">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></span>
                            <span className="font-bold text-slate-700 capitalize">{pm.payment_method === 'credit' ? 'Udhar' : pm.payment_method}</span>
                          </div>
                          <span className="font-mono font-bold text-slate-900">₹{Number(pm.total).toFixed(0)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs">No collections recorded</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'gstr1' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Date Range Selector */}
          <div className="flex items-center gap-3 mb-3 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
              <Calendar size={13} /> Filing Period:
            </span>
            <div className="flex items-center gap-2 text-xs">
              <input
                type="date"
                value={fromDate}
                onChange={e => setFromDate(e.target.value)}
                className="border border-slate-300 rounded px-2 py-1 bg-white font-mono"
              />
              <span className="text-slate-400 font-bold">to</span>
              <input
                type="date"
                value={toDate}
                onChange={e => setToDate(e.target.value)}
                className="border border-slate-300 rounded px-2 py-1 bg-white font-mono"
              />
            </div>

            {gstData && (
              <div className="ml-auto flex items-center gap-4 text-xs font-mono">
                <div>Taxable: <span className="font-bold">₹{Number(gstData.tax_totals?.total_taxable || 0).toFixed(2)}</span></div>
                <div>CGST: <span className="font-bold">₹{Number(gstData.tax_totals?.total_cgst || 0).toFixed(2)}</span></div>
                <div>SGST: <span className="font-bold">₹{Number(gstData.tax_totals?.total_sgst || 0).toFixed(2)}</span></div>
                <div>IGST: <span className="font-bold">₹{Number(gstData.tax_totals?.total_igst || 0).toFixed(2)}</span></div>
                <div className="text-indigo-700 font-bold">Total: ₹{Number(gstData.tax_totals?.total_grand || 0).toFixed(2)}</div>
              </div>
            )}
          </div>

          {/* GSTR-1 Tables View Toggler */}
          <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden flex-1 flex flex-col">
            <div className="flex items-center gap-2 bg-slate-50 border-b border-slate-200 px-3 py-2">
              <button 
                onClick={() => setGstViewTab('bills')} 
                className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${gstViewTab === 'bills' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-200'}`}
              >
                All Sale Invoices
              </button>
              <button 
                onClick={() => setGstViewTab('hsn')} 
                className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${gstViewTab === 'hsn' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-200'}`}
              >
                HSN Summary
              </button>
            </div>
            <div className="overflow-auto flex-1">
              {gstViewTab === 'hsn' ? (
                <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider sticky top-0 z-10 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3.5">HSN/SAC Code</th>
                      <th className="py-2.5 px-3.5 text-right">Total Qty</th>
                      <th className="py-2.5 px-3.5 text-right">Taxable Value (₹)</th>
                      <th className="py-2.5 px-3.5 text-right">Rate %</th>
                      <th className="py-2.5 px-3.5 text-right">Central Tax (CGST)</th>
                      <th className="py-2.5 px-3.5 text-right">State Tax (SGST)</th>
                      <th className="py-2.5 px-3.5 text-right">Integrated Tax (IGST)</th>
                      <th className="py-2.5 px-3.5 text-right">Total Invoice Value</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-100 font-mono text-xs">
                    {gstData?.hsn_summary.map((row, idx) => (
                      <tr key={idx} className={idx % 2 === 1 ? 'bg-indigo-50/20' : 'hover:bg-slate-50/80 transition-colors'}>
                        <td className="py-2.5 px-3.5 font-bold text-slate-900">{row.hsn_code}</td>
                        <td className="py-2.5 px-3.5 text-right text-slate-700">{row.total_qty}</td>
                        <td className="py-2.5 px-3.5 text-right font-bold text-slate-900">₹ {row.taxable_value.toFixed(2)}</td>
                        <td className="py-2.5 px-3.5 text-right text-indigo-700 font-bold">{row.gst_rate}%</td>
                        <td className="py-2.5 px-3.5 text-right text-slate-600">₹ {row.cgst_amount.toFixed(2)}</td>
                        <td className="py-2.5 px-3.5 text-right text-slate-600">₹ {row.sgst_amount.toFixed(2)}</td>
                        <td className="py-2.5 px-3.5 text-right text-slate-600">₹ {row.igst_amount.toFixed(2)}</td>
                        <td className="py-2.5 px-3.5 text-right font-bold text-slate-900">₹ {row.total_value.toFixed(2)}</td>
                      </tr>
                    ))}
                    {(!gstData || gstData.hsn_summary.length === 0) && (
                      <tr>
                        <td colSpan={8} className="text-center py-16 text-slate-400 font-sans">
                          <FileSpreadsheet size={32} className="mx-auto mb-2 text-slate-300 stroke-1" />
                          <p className="text-xs font-semibold text-slate-600">No GST invoices for selected period</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              ) : (
                <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider sticky top-0 z-10 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3.5">Date</th>
                      <th className="py-2.5 px-3.5">Invoice No</th>
                      <th className="py-2.5 px-3.5">Customer Name & GSTIN</th>
                      <th className="py-2.5 px-3.5 text-right">Taxable (₹)</th>
                      <th className="py-2.5 px-3.5 text-right">CGST</th>
                      <th className="py-2.5 px-3.5 text-right">SGST</th>
                      <th className="py-2.5 px-3.5 text-right">IGST</th>
                      <th className="py-2.5 px-3.5 text-right">Total (₹)</th>
                      <th className="py-2.5 px-3.5 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-100 font-mono text-xs">
                    {gstData?.sale_bills?.map((bill, idx) => (
                      <tr key={idx} className={idx % 2 === 1 ? 'bg-indigo-50/20' : 'hover:bg-slate-50/80 transition-colors'}>
                        <td className="py-2.5 px-3.5 text-slate-700">{format(new Date(bill.date), 'dd-MMM-yy')}</td>
                        <td className="py-2.5 px-3.5 font-bold text-indigo-700">{bill.invoice_number}</td>
                        <td className="py-2.5 px-3.5">
                          <div className="font-bold text-slate-900 font-sans">{bill.customer_name || 'Walk-in Customer'}</div>
                          {bill.customer_gstin && <div className="text-[10px] text-slate-500 font-mono">GSTIN: {bill.customer_gstin}</div>}
                        </td>
                        <td className="py-2.5 px-3.5 text-right font-bold text-slate-900">{bill.taxable_value.toFixed(2)}</td>
                        <td className="py-2.5 px-3.5 text-right text-slate-600">{bill.cgst_total.toFixed(2)}</td>
                        <td className="py-2.5 px-3.5 text-right text-slate-600">{bill.sgst_total.toFixed(2)}</td>
                        <td className="py-2.5 px-3.5 text-right text-slate-600">{bill.igst_total.toFixed(2)}</td>
                        <td className="py-2.5 px-3.5 text-right font-bold text-slate-900 bg-slate-50/50">{bill.grand_total.toFixed(2)}</td>
                        <td className="py-2.5 px-3.5 text-center">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${bill.status === 'cancelled' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                            {bill.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {(!gstData || !gstData.sale_bills || gstData.sale_bills.length === 0) && (
                      <tr>
                        <td colSpan={9} className="text-center py-16 text-slate-400 font-sans">
                          <FileSpreadsheet size={32} className="mx-auto mb-2 text-slate-300 stroke-1" />
                          <p className="text-xs font-semibold text-slate-600">No sale bills found for selected period</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'inventory' && dashboard && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden flex-1 flex flex-col">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Low Stock & Reorder Alert List ({dashboard.low_stock_items.length} items)
              </h3>
            </div>
            <div className="overflow-auto flex-1">
              <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider sticky top-0 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3.5">Item Name</th>
                    <th className="py-2.5 px-3.5">Category</th>
                    <th className="py-2.5 px-3.5 text-right">Retail Rate</th>
                    <th className="py-2.5 px-3.5 text-center">Current Stock</th>
                    <th className="py-2.5 px-3.5 text-center">Reorder Threshold</th>
                    <th className="py-2.5 px-3.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100 font-mono text-xs">
                  {dashboard.low_stock_items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3.5 font-sans font-bold text-slate-900">{item.name}</td>
                      <td className="py-2.5 px-3.5 font-sans text-slate-600">{item.category}</td>
                      <td className="py-2.5 px-3.5 text-right">₹ {item.retail_price.toFixed(2)}</td>
                      <td className="py-2.5 px-3.5 text-center font-bold text-rose-700">{item.current_stock} {item.unit}</td>
                      <td className="py-2.5 px-3.5 text-center text-slate-500">{item.min_stock_alert} {item.unit}</td>
                      <td className="py-2.5 px-3.5 text-center font-sans">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          item.current_stock <= 0 ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {item.current_stock <= 0 ? 'OUT OF STOCK' : 'LOW STOCK'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {dashboard.low_stock_items.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-16 text-slate-400 font-sans">
                        <Package size={32} className="mx-auto mb-2 text-emerald-400 stroke-1" />
                        <p className="text-xs font-semibold text-slate-700">All inventory items are well-stocked</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'daybook' && daybookData && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center gap-3 mb-3 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
              <Calendar size={13} /> Select Date:
            </span>
            <input
              type="date"
              value={daybookDate}
              onChange={e => setDaybookDate(e.target.value)}
              className="border border-slate-300 rounded px-2 py-1 text-xs bg-white font-mono"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 overflow-y-auto pr-1">
            {/* CASH IN */}
            <div className="bg-emerald-50/50 rounded-xl border border-emerald-200 p-4 flex flex-col">
              <h3 className="text-xs font-bold text-emerald-900 uppercase tracking-wider mb-4 border-b border-emerald-200 pb-2">
                Cash Flow IN (+)
              </h3>
              <div className="space-y-4 flex-1">
                <div>
                  <div className="flex justify-between items-center text-xs font-bold text-slate-800 mb-2">
                    <span>From Cash Sales</span>
                    <span className="font-mono text-emerald-700">
                      ₹ {(daybookData?.in_sales?.find(x => x.payment_method === 'cash')?.amount || 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs font-bold text-slate-800 mb-2">
                    <span>From Udhar Collections</span>
                    <span className="font-mono text-emerald-700">
                      ₹ {(daybookData?.in_udhar?.find(x => x.payment_mode === 'cash')?.amount || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-emerald-200 flex justify-between items-center">
                <span className="text-sm font-bold text-emerald-900">Total Cash In</span>
                <span className="text-lg font-bold font-mono text-emerald-700">
                  ₹ {((daybookData?.in_sales?.find(x => x.payment_method === 'cash')?.amount || 0) + 
                       (daybookData?.in_udhar?.find(x => x.payment_mode === 'cash')?.amount || 0)).toFixed(2)}
                </span>
              </div>
            </div>

            {/* CASH OUT */}
            <div className="bg-rose-50/50 rounded-xl border border-rose-200 p-4 flex flex-col">
              <h3 className="text-xs font-bold text-rose-900 uppercase tracking-wider mb-4 border-b border-rose-200 pb-2">
                Cash Flow OUT (-)
              </h3>
              <div className="space-y-4 flex-1">
                <div>
                  <div className="flex justify-between items-center text-xs font-bold text-slate-800 mb-2">
                    <span>To Vendor Purchases</span>
                    <span className="font-mono text-rose-700">
                      ₹ {(daybookData?.out_purchases?.find(x => x.payment_method === 'cash')?.amount || 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs font-bold text-slate-800 mb-2">
                    <span>Petty Cash Expenses</span>
                    <span className="font-mono text-rose-700">
                      ₹ {(daybookData?.out_expenses?.find(x => x.payment_mode === 'cash')?.amount || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-rose-200 flex justify-between items-center">
                <span className="text-sm font-bold text-rose-900">Total Cash Out</span>
                <span className="text-lg font-bold font-mono text-rose-700">
                  ₹ {((daybookData?.out_purchases?.find(x => x.payment_method === 'cash')?.amount || 0) + 
                       (daybookData?.out_expenses?.find(x => x.payment_mode === 'cash')?.amount || 0)).toFixed(2)}
                </span>
              </div>
            </div>

            {/* SUMMARY (Full width below) */}
            <div className="col-span-1 md:col-span-2 bg-indigo-50/50 rounded-xl border border-indigo-200 p-5 mt-2 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-indigo-900 uppercase tracking-wider">End of Day Expected Cash</h3>
                <p className="text-[11px] text-indigo-600 font-medium">Expected physical cash in drawer for {format(new Date(daybookDate + 'T00:00:00'), 'dd MMM yyyy')}</p>
              </div>
              <div className="text-right">
                <span className="text-2xl font-bold font-mono text-indigo-700">
                  ₹ {(((daybookData?.in_sales?.find(x => x.payment_method === 'cash')?.amount || 0) + 
                       (daybookData?.in_udhar?.find(x => x.payment_mode === 'cash')?.amount || 0)) - 
                      ((daybookData?.out_purchases?.find(x => x.payment_method === 'cash')?.amount || 0) + 
                       (daybookData?.out_expenses?.find(x => x.payment_mode === 'cash')?.amount || 0))).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
