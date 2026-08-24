import { useState, useEffect, type FormEvent } from 'react';
import { 
  Plus, Truck, Search, Calendar, Package, Trash2, 
  FileText, CheckCircle2, IndianRupee, Layers, X, Eye 
} from 'lucide-react';
import { format } from 'date-fns';

type Supplier = {
  id: number;
  name: string;
  phone: string;
  email: string;
  gstin: string;
  address: string;
};

type Product = {
  id: number;
  name: string;
  purchase_cost: number;
  gst_rate: number;
  current_stock: number;
};

type PurchaseItemRow = {
  product_id: number;
  product_name: string;
  batch_number: string;
  expiry_date: string;
  quantity: number;
  purchase_cost: number;
  gst_rate: number;
  tax_amount: number;
  line_total: number;
};

type Purchase = {
  id: number;
  purchase_number: string;
  supplier_name: string;
  invoice_ref: string;
  date: string;
  subtotal: number;
  tax_total: number;
  grand_total: number;
  payment_status: string;
  payment_method: string;
};

export default function Purchases({ role = 'admin' }: { role?: 'admin' | 'cashier' }) {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeTab, setActiveTab] = useState<'purchases' | 'suppliers'>('purchases');
  
  // Modals
  const [newPurchaseModalOpen, setNewPurchaseModalOpen] = useState(false);
  const [newSupplierModalOpen, setNewSupplierModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // New Purchase Inward State
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | ''>('');
  const [supplierInvoiceRef, setSupplierInvoiceRef] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
  const [paymentStatus, setPaymentStatus] = useState('paid');
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItemRow[]>([]);
  
  // Supplier Form
  const [supplierForm, setSupplierForm] = useState({
    name: '',
    phone: '',
    email: '',
    gstin: '',
    address: ''
  });

  useEffect(() => {
    fetchPurchases();
    fetchSuppliers();
    fetchProducts();
  }, []);

  const fetchPurchases = async () => {
    try {
      const res = await fetch('/api/purchases');
      if (res.ok) setPurchases(await res.json());
    } catch (e) {
      console.error(e);
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

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products');
      if (res.ok) setProducts(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const addPurchaseItem = (product: Product) => {
    const defaultQty = 10;
    const cost = product.purchase_cost || 0;
    const gstRate = product.gst_rate || 0;
    const sub = cost * defaultQty;
    const tax = (sub * gstRate) / 100;
    const item: PurchaseItemRow = {
      product_id: product.id,
      product_name: product.name,
      batch_number: '',
      expiry_date: '',
      quantity: defaultQty,
      purchase_cost: cost,
      gst_rate: gstRate,
      tax_amount: tax,
      line_total: sub + tax
    };
    setPurchaseItems([...purchaseItems, item]);
  };

  const updatePurchaseItem = (index: number, updates: Partial<PurchaseItemRow>) => {
    const items = [...purchaseItems];
    const item = { ...items[index], ...updates };
    const sub = item.purchase_cost * item.quantity;
    item.tax_amount = (sub * item.gst_rate) / 100;
    item.line_total = sub + item.tax_amount;
    items[index] = item;
    setPurchaseItems(items);
  };

  const removePurchaseItem = (index: number) => {
    setPurchaseItems(purchaseItems.filter((_, i) => i !== index));
  };

  const subtotal = purchaseItems.reduce((sum, i) => sum + i.purchase_cost * i.quantity, 0);
  const taxTotal = purchaseItems.reduce((sum, i) => sum + i.tax_amount, 0);
  const grandTotal = Math.round(subtotal + taxTotal);

  const handleSavePurchase = async (e: FormEvent) => {
    e.preventDefault();
    if (purchaseItems.length === 0) {
      alert('Please add at least one product to the purchase inward.');
      return;
    }

    const supplier = suppliers.find(s => s.id === Number(selectedSupplierId));
    const supplierName = supplier ? supplier.name : 'Direct Supplier';

    try {
      const res = await fetch('/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplier_id: selectedSupplierId || null,
          supplier_name: supplierName,
          invoice_ref: supplierInvoiceRef,
          date: purchaseDate,
          payment_method: paymentMethod,
          payment_status: paymentStatus,
          subtotal,
          tax_total: taxTotal,
          grand_total: grandTotal,
          items: purchaseItems
        })
      });

      if (res.ok) {
        setNewPurchaseModalOpen(false);
        setPurchaseItems([]);
        setSupplierInvoiceRef('');
        fetchPurchases();
        fetchProducts(); // Stock was incremented
      } else {
        const d = await res.json();
        alert(d.error || 'Failed to save purchase');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveSupplier = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(supplierForm)
      });
      if (res.ok) {
        setNewSupplierModalOpen(false);
        setSupplierForm({ name: '', phone: '', email: '', gstin: '', address: '' });
        fetchSuppliers();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredPurchases = purchases.filter(p => 
    (p.purchase_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.supplier_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.invoice_ref || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-5 max-w-7xl mx-auto w-full flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Purchase Management & Inward</h2>
            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[11px] font-mono font-bold rounded">
              {purchases.length} Purchase Bills
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">Record vendor invoices, automatic stock inventory increments, and supplier ledgers</p>
        </div>

        {/* View Switcher & Action */}
        <div className="flex items-center gap-2.5">
          <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('purchases')}
              className={`px-3 py-1 rounded-md transition-colors ${
                activeTab === 'purchases' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Purchase Bills
            </button>
            <button
              onClick={() => setActiveTab('suppliers')}
              className={`px-3 py-1 rounded-md transition-colors flex items-center gap-1 ${
                activeTab === 'suppliers' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Truck size={13} /> Suppliers Directory
            </button>
          </div>

          {activeTab === 'purchases' ? (
            <button 
              onClick={() => {
                setPurchaseItems([]);
                setNewPurchaseModalOpen(true);
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all uppercase tracking-wider"
            >
              <Plus size={14} /> New Purchase Inward
            </button>
          ) : (
            <button 
              onClick={() => setNewSupplierModalOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all uppercase tracking-wider"
            >
              <Plus size={14} /> Add Supplier
            </button>
          )}
        </div>
      </div>

      {activeTab === 'purchases' ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Search bar */}
          <div className="mb-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2 text-slate-400" size={14} />
              <input
                type="text"
                placeholder="Search by Purchase #, Supplier, Vendor Bill Ref..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 w-80 shadow-2xs"
              />
            </div>
          </div>

          {/* Purchases Table */}
          <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden flex-1 flex flex-col">
            <div className="overflow-auto flex-1">
              <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider sticky top-0 z-10 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3.5 w-12">#</th>
                    <th className="py-2.5 px-3.5">Purchase No.</th>
                    <th className="py-2.5 px-3.5">Date</th>
                    <th className="py-2.5 px-3.5">Supplier Name</th>
                    <th className="py-2.5 px-3.5">Vendor Bill Ref</th>
                    <th className="py-2.5 px-3.5 text-right">Taxable Subtotal</th>
                    <th className="py-2.5 px-3.5 text-right">GST Total</th>
                    <th className="py-2.5 px-3.5 text-right">Grand Total (₹)</th>
                    <th className="py-2.5 px-3.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100 font-mono text-xs">
                  {filteredPurchases.map((p, idx) => (
                    <tr key={p.id} className={idx % 2 === 1 ? 'bg-indigo-50/20' : 'hover:bg-slate-50/80 transition-colors'}>
                      <td className="py-2.5 px-3.5 text-slate-400">{idx + 1}</td>
                      <td className="py-2.5 px-3.5 font-bold text-indigo-700">{p.purchase_number}</td>
                      <td className="py-2.5 px-3.5 text-slate-600 font-sans">
                        {p.date && !isNaN(new Date(p.date).getTime()) ? format(new Date(p.date), 'dd-MMM-yyyy') : '—'}
                      </td>
                      <td className="py-2.5 px-3.5 font-sans font-bold text-slate-900">{p.supplier_name}</td>
                      <td className="py-2.5 px-3.5 text-slate-600">{p.invoice_ref || '—'}</td>
                      <td className="py-2.5 px-3.5 text-right text-slate-700">₹ {p.subtotal.toFixed(2)}</td>
                      <td className="py-2.5 px-3.5 text-right text-slate-500">₹ {p.tax_total.toFixed(2)}</td>
                      <td className="py-2.5 px-3.5 text-right font-bold text-slate-900 text-sm">
                        ₹ {p.grand_total.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3.5 text-center font-sans">
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-bold uppercase tracking-wider">
                          {p.payment_status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {filteredPurchases.length === 0 && (
                    <tr>
                      <td colSpan={9} className="text-center py-16 text-slate-400 font-sans">
                        <FileText size={32} className="mx-auto mb-2 text-slate-300 stroke-1" />
                        <p className="text-xs font-semibold text-slate-600">No purchase inward records yet</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* Suppliers Table */
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden flex-1 flex flex-col">
          <div className="overflow-auto flex-1">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider sticky top-0 z-10 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3.5 w-12">#</th>
                  <th className="py-2.5 px-3.5">Supplier Name</th>
                  <th className="py-2.5 px-3.5">Phone Number</th>
                  <th className="py-2.5 px-3.5">Email</th>
                  <th className="py-2.5 px-3.5">GSTIN</th>
                  <th className="py-2.5 px-3.5">Address</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100 font-mono text-xs">
                {suppliers.map((s, idx) => (
                  <tr key={s.id} className={idx % 2 === 1 ? 'bg-indigo-50/20' : 'hover:bg-slate-50/80 transition-colors'}>
                    <td className="py-2.5 px-3.5 text-slate-400">{idx + 1}</td>
                    <td className="py-2.5 px-3.5 font-sans font-bold text-slate-900">{s.name}</td>
                    <td className="py-2.5 px-3.5 text-slate-700">{s.phone || '—'}</td>
                    <td className="py-2.5 px-3.5 text-slate-600 font-sans">{s.email || '—'}</td>
                    <td className="py-2.5 px-3.5 text-slate-600 font-bold">{s.gstin || '—'}</td>
                    <td className="py-2.5 px-3.5 font-sans text-slate-600 truncate max-w-xs">{s.address || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* New Purchase Inward Modal */}
      {newPurchaseModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-2xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-100">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[92vh] flex flex-col border border-slate-200 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Record Purchase Inward</h3>
                <p className="text-[11px] text-slate-500">Add products received from vendor. Inventory stock will automatically increase.</p>
              </div>
              <button onClick={() => setNewPurchaseModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSavePurchase} className="p-5 overflow-y-auto flex flex-col flex-1 text-xs gap-4">
              {/* Top metadata grid */}
              <div className="grid grid-cols-4 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Select Supplier *
                  </label>
                  <select
                    required
                    value={selectedSupplierId}
                    onChange={e => setSelectedSupplierId(e.target.value ? Number(e.target.value) : '')}
                    className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  >
                    <option value="">-- Select Vendor --</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.phone || 'No phone'})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Vendor Invoice Ref #
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. INV-2026-99"
                    value={supplierInvoiceRef}
                    onChange={e => setSupplierInvoiceRef(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Inward Date
                  </label>
                  <input
                    type="date"
                    value={purchaseDate}
                    onChange={e => setPurchaseDate(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Payment Mode
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={e => setPaymentMethod(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  >
                    <option value="bank_transfer">Bank NEFT / RTGS</option>
                    <option value="upi">UPI</option>
                    <option value="cash">Cash</option>
                    <option value="cheque">Cheque</option>
                    <option value="credit">Vendor Credit</option>
                  </select>
                </div>
              </div>

              {/* Product quick add bar */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Add Products To Inward:
                </label>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1.5 bg-slate-100/70 border border-slate-200 rounded-lg">
                  {products.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => addPurchaseItem(p)}
                      className="px-2.5 py-1 bg-white border border-slate-300 rounded-md text-[11px] font-medium text-slate-800 hover:border-indigo-500 hover:bg-indigo-50/50 transition-all flex items-center gap-1 shadow-2xs"
                    >
                      <Plus size={11} className="text-indigo-600" />
                      <span>{p.name}</span>
                      <span className="font-mono text-slate-400 text-[10px]">(Cost: ₹{p.purchase_cost})</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Items Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden flex-1">
                <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider">
                    <tr>
                      <th className="py-2 px-3">Item</th>
                      <th className="py-2 px-3 w-28">Batch No.</th>
                      <th className="py-2 px-3 w-24 text-right">Inward Qty</th>
                      <th className="py-2 px-3 w-24 text-right">Cost Price (₹)</th>
                      <th className="py-2 px-3 w-16 text-right">GST %</th>
                      <th className="py-2 px-3 w-28 text-right">Total (₹)</th>
                      <th className="py-2 px-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-xs">
                    {purchaseItems.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-sans font-semibold text-slate-900">{item.product_name}</td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            placeholder="Batch #"
                            value={item.batch_number}
                            onChange={e => updatePurchaseItem(idx, { batch_number: e.target.value })}
                            className="w-full border border-slate-300 rounded px-1.5 py-0.5 font-mono text-xs"
                          />
                        </td>
                        <td className="py-2 px-3 text-right">
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={e => updatePurchaseItem(idx, { quantity: Math.max(1, Number(e.target.value) || 1) })}
                            className="w-16 border border-slate-300 rounded px-1.5 py-0.5 text-right font-bold text-xs"
                          />
                        </td>
                        <td className="py-2 px-3 text-right">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.purchase_cost}
                            onChange={e => updatePurchaseItem(idx, { purchase_cost: Number(e.target.value) || 0 })}
                            className="w-20 border border-slate-300 rounded px-1.5 py-0.5 text-right font-mono text-xs"
                          />
                        </td>
                        <td className="py-2 px-3 text-right text-slate-600">{item.gst_rate}%</td>
                        <td className="py-2 px-3 text-right font-bold text-slate-900">
                          {item.line_total.toFixed(2)}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => removePurchaseItem(idx)}
                            className="text-slate-400 hover:text-rose-600 p-0.5"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {purchaseItems.length === 0 && (
                      <tr>
                        <td colSpan={7} className="text-center py-8 text-slate-400 font-sans">
                          Click products above to add to this purchase inward
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Total Calculation Footer */}
              <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="text-slate-600 font-medium">
                  Total Items: <span className="font-bold text-slate-900">{purchaseItems.length}</span>
                </div>
                <div className="flex items-center gap-6 font-mono text-xs">
                  <div>Taxable: <span className="font-bold">₹{subtotal.toFixed(2)}</span></div>
                  <div>GST: <span className="font-bold">₹{taxTotal.toFixed(2)}</span></div>
                  <div className="text-base font-bold text-indigo-700">
                    Grand Total: ₹{grandTotal.toFixed(2)}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setNewPurchaseModalOpen(false)}
                  className="px-4 py-1.5 border border-slate-300 rounded-lg font-bold text-xs text-slate-700 hover:bg-slate-100 uppercase tracking-wider"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={purchaseItems.length === 0}
                  className="px-5 py-1.5 bg-indigo-600 rounded-lg font-bold text-xs text-white hover:bg-indigo-700 shadow-sm uppercase tracking-wider disabled:opacity-50"
                >
                  Save Inward & Increment Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Supplier Modal */}
      {newSupplierModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-2xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-100">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md border border-slate-200 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900">Add New Supplier / Vendor</h3>
              <button onClick={() => setNewSupplierModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveSupplier} className="p-5 space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Supplier / Company Name *
                </label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Havells India Ltd"
                  value={supplierForm.name}
                  onChange={e => setSupplierForm({ ...supplierForm, name: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Phone Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. +91-9820011223"
                  value={supplierForm.phone}
                  onChange={e => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  GSTIN
                </label>
                <input
                  type="text"
                  placeholder="e.g. 27AAAAA0000A1Z5"
                  value={supplierForm.gstin}
                  onChange={e => setSupplierForm({ ...supplierForm, gstin: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Address
                </label>
                <textarea
                  rows={2}
                  placeholder="Warehouse / Office address"
                  value={supplierForm.address}
                  onChange={e => setSupplierForm({ ...supplierForm, address: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div className="pt-2 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setNewSupplierModalOpen(false)}
                  className="px-3.5 py-1.5 border border-slate-300 rounded-lg font-bold text-xs text-slate-700 hover:bg-slate-100 uppercase tracking-wider"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 rounded-lg font-bold text-xs text-white hover:bg-indigo-700 shadow-sm uppercase tracking-wider"
                >
                  Save Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
