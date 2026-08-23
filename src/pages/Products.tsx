import Papa from 'papaparse';
import Barcode from 'react-barcode';
import { useState, useEffect, type FormEvent, useRef } from 'react';
import { 
  Plus, Edit2, Trash2, Search, Package, AlertTriangle, 
  SlidersHorizontal, History, ArrowUpDown, Check, X, ShieldAlert, UploadCloud, FileDown, Download, Printer 
} from 'lucide-react';

type Product = {
  id: number;
  name: string;
  barcode: string;
  category: string;
  hsn_code: string;
  gst_rate: number;
  retail_price: number;
  wholesale_price: number;
  purchase_cost: number;
  mrp: number;
  unit: string;
  current_stock: number;
  min_stock_alert: number;
  allow_negative_stock: number;
};

type StockAdjustment = {
  id: number;
  product_id: number;
  product_name: string;
  change_qty: number;
  previous_stock: number;
  new_stock: number;
  type: string;
  reason: string;
  user_name: string;
  created_at: string;
};


function BulkImportModal({ isOpen, onClose, onRefresh }: { isOpen: boolean, onClose: () => void, onRefresh: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDownloadTemplate = () => {
    const template = [
      ['name', 'barcode', 'category', 'hsn_code', 'gst_rate', 'retail_price', 'wholesale_price', 'purchase_cost', 'mrp', 'unit', 'current_stock', 'min_stock_alert']
    ];
    const csv = Papa.unparse(template);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'inventory_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    setError(null);
    
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          // Normalize headers & map
          const products = results.data.map((row: any) => ({
            name: row.name,
            barcode: row.barcode || '',
            category: row.category || 'Uncategorized',
            hsn_code: row.hsn_code || '',
            gst_rate: Number(row.gst_rate) || 0,
            retail_price: Number(row.retail_price) || 0,
            wholesale_price: Number(row.wholesale_price) || 0,
            purchase_cost: Number(row.purchase_cost) || 0,
            mrp: Number(row.mrp) || 0,
            unit: row.unit || 'pcs',
            current_stock: Number(row.current_stock) || 0,
            min_stock_alert: Number(row.min_stock_alert) || 5,
            allow_negative_stock: false
          })).filter((p: any) => p.name); // only include rows with a name
          
          if (products.length === 0) {
            throw new Error("No valid products found in CSV. Make sure the 'name' column exists.");
          }

          const res = await fetch('/api/products/bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ products })
          });
          
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Import failed');
          
          onRefresh();
          onClose();
        } catch (err: any) {
          setError(err.message);
        } finally {
          setImporting(false);
        }
      },
      error: (err) => {
        setError(err.message);
        setImporting(false);
      }
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-slate-200 bg-slate-50/50">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <UploadCloud size={20} className="text-indigo-600" />
            Bulk Import Inventory
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-4 flex flex-col gap-4">
          <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 text-sm text-indigo-800 flex flex-col gap-2">
            <p>1. Download the CSV template.</p>
            <p>2. Fill in your inventory details.</p>
            <p>3. Upload the filled file here.</p>
            <button 
              onClick={handleDownloadTemplate}
              className="mt-1 flex items-center gap-2 w-fit px-3 py-1.5 bg-white border border-indigo-200 text-indigo-700 font-semibold rounded-md shadow-sm hover:bg-indigo-50 transition-colors"
            >
              <FileDown size={16} /> Download Template
            </button>
          </div>
          
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-bold text-slate-700">Select CSV File</label>
            <input 
              type="file" 
              accept=".csv"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer border border-slate-300 rounded-lg"
            />
          </div>
          
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-sm font-semibold">
              {error}
            </div>
          )}
        </div>
        
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-2 mt-auto">
          <button
            onClick={onClose}
            className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={!file || importing}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {importing ? 'Importing...' : 'Upload & Import'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Products({ role = 'admin' }: { role?: 'admin' | 'cashier' }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [adjustments, setAdjustments] = useState<StockAdjustment[]>([]);
  const [activeTab, setActiveTab] = useState<'catalog' | 'audit'>('catalog');
  const [searchTerm, setSearchTerm] = useState('');
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [filterStock, setFilterStock] = useState<'ALL' | 'LOW' | 'OUT'>('ALL');
  
  // Product Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  
  // Stock Adjust Modal
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [selectedProductForAdjust, setSelectedProductForAdjust] = useState<Product | null>(null);
  const [adjustForm, setAdjustForm] = useState({
    change_qty: 1,
    type: 'ADD' as 'ADD' | 'SUBTRACT' | 'SET',
    reason: 'Damage / Expired'
  });

  // Barcode Print Modal
  const [barcodeModalOpen, setBarcodeModalOpen] = useState(false);
  const [selectedProductForBarcode, setSelectedProductForBarcode] = useState<Product | null>(null);
  const [barcodePrintQty, setBarcodePrintQty] = useState<number>(1);

  const [form, setForm] = useState({
    name: '',
    barcode: '',
    category: '',
    hsn_code: '',
    gst_rate: 18,
    retail_price: 0,
    wholesale_price: 0,
    purchase_cost: 0,
    mrp: 0,
    unit: 'pcs',
    current_stock: 0,
    min_stock_alert: 10,
    allow_negative_stock: 0
  });

  useEffect(() => {
    fetchProducts();
    if (activeTab === 'audit') {
      fetchAdjustments();
    }
  }, [activeTab]);

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products');
      const data = await res.json();
      setProducts(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAdjustments = async () => {
    try {
      const res = await fetch('/api/stock/adjustments');
      if (res.ok) {
        const data = await res.json();
        setAdjustments(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveProduct = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const url = editingId ? `/api/products/${editingId}` : '/api/products';
      const method = editingId ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      
      if (res.ok) {
        setIsModalOpen(false);
        setEditingId(null);
        setForm({
          name: '', barcode: '', category: '', hsn_code: '', gst_rate: 18,
          retail_price: 0, wholesale_price: 0, purchase_cost: 0, mrp: 0,
          unit: 'pcs', current_stock: 0, min_stock_alert: 10, allow_negative_stock: 0
        });
        fetchProducts();
      } else {
        alert('Failed to save product');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleEdit = (p: Product) => {
    setForm({
      name: p.name,
      barcode: p.barcode || '',
      category: p.category || '',
      hsn_code: p.hsn_code || '',
      gst_rate: p.gst_rate,
      retail_price: p.retail_price,
      wholesale_price: p.wholesale_price,
      purchase_cost: p.purchase_cost || 0,
      mrp: p.mrp || 0,
      unit: p.unit || 'pcs',
      current_stock: p.current_stock,
      min_stock_alert: p.min_stock_alert,
      allow_negative_stock: p.allow_negative_stock || 0
    });
    setEditingId(p.id);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    try {
      await fetch(`/api/products/${id}`, { method: 'DELETE' });
      fetchProducts();
    } catch (err) {
      console.error(err);
    }
  };

  const openAdjustStock = (p: Product) => {
    setSelectedProductForAdjust(p);
    setAdjustForm({
      change_qty: 1,
      type: 'ADD',
      reason: 'Physical Count Correction'
    });
    setAdjustModalOpen(true);
  };

  const handleSaveStockAdjust = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedProductForAdjust) return;

    try {
      const res = await fetch('/api/stock/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: selectedProductForAdjust.id,
          change_qty: adjustForm.change_qty,
          type: adjustForm.type,
          reason: adjustForm.reason,
          user_name: role === 'admin' ? 'Admin' : 'Cashier'
        })
      });

      if (res.ok) {
        setAdjustModalOpen(false);
        setSelectedProductForAdjust(null);
        fetchProducts();
      } else {
        const d = await res.json();
        alert(d.error || 'Failed to adjust stock');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.barcode && p.barcode.includes(searchTerm)) ||
      (p.hsn_code && p.hsn_code.includes(searchTerm)) ||
      (p.category && p.category.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchesSearch) return false;

    if (filterStock === 'LOW') {
      return p.current_stock > 0 && p.current_stock <= p.min_stock_alert;
    }
    if (filterStock === 'OUT') {
      return p.current_stock <= 0;
    }
    return true;
  });

  const lowStockCount = products.filter(p => p.current_stock > 0 && p.current_stock <= p.min_stock_alert).length;
  const outOfStockCount = products.filter(p => p.current_stock <= 0).length;

  return (
    <div className="p-5 max-w-7xl mx-auto w-full flex-1 flex flex-col overflow-hidden print:p-0 print:overflow-visible">
      <div className="flex-1 flex flex-col min-h-0 print:hidden">
        {/* Header & Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Inventory & Stock Master</h2>
            <div className="flex gap-1.5 ml-2">
              <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[11px] font-mono font-bold rounded">
                {products.length} Items
              </span>
              {lowStockCount > 0 && (
                <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[11px] font-mono font-bold rounded flex items-center gap-1">
                  <AlertTriangle size={11} /> {lowStockCount} Low
                </span>
              )}
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">Realtime inventory levels, HSN codes, GST slabs, and stock audit trails</p>
        </div>

        {/* View Switcher & Action */}
        <div className="flex items-center gap-2.5">
          <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('catalog')}
              className={`px-3 py-1 rounded-md transition-colors ${
                activeTab === 'catalog' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Product Catalog
            </button>
            <button
              onClick={() => setActiveTab('audit')}
              className={`px-3 py-1 rounded-md transition-colors flex items-center gap-1 ${
                activeTab === 'audit' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <History size={13} /> Stock Audit Log
            </button>
          </div>

          {activeTab === 'catalog' && (
            <div className="flex items-center">
            {role === 'admin' && (
              <button
                onClick={() => setImportModalOpen(true)}
                className="bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 px-3.5 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all uppercase tracking-wider mr-2"
              >
                <UploadCloud size={14} /> Import CSV
              </button>
            )}
            <button 
              onClick={() => {

                setForm({
                  name: '', barcode: '', category: '', hsn_code: '', gst_rate: 18,
                  retail_price: 0, wholesale_price: 0, purchase_cost: 0, mrp: 0,
                  unit: 'pcs', current_stock: 10, min_stock_alert: 5, allow_negative_stock: 0
                });
                setIsModalOpen(true);
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all uppercase tracking-wider"
            >
              <Plus size={14} /> Add Product
            </button>
            </div>
          )}
        </div>
      </div>

      {activeTab === 'catalog' ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Filter Toolbar */}
          <div className="flex justify-between items-center mb-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2 text-slate-400" size={14} />
              <input
                type="text"
                placeholder="Search catalog by name, HSN, barcode..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 w-72 shadow-2xs"
              />
            </div>

            {/* Quick stock status filters */}
            <div className="flex items-center gap-1 text-xs">
              <button
                onClick={() => setFilterStock('ALL')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold ${
                  filterStock === 'ALL' ? 'bg-slate-800 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                All Items
              </button>
              <button
                onClick={() => setFilterStock('LOW')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold ${
                  filterStock === 'LOW' ? 'bg-amber-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Low Stock ({lowStockCount})
              </button>
              <button
                onClick={() => setFilterStock('OUT')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold ${
                  filterStock === 'OUT' ? 'bg-rose-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Out of Stock ({outOfStockCount})
              </button>
            </div>
          </div>

          {/* Catalog Table */}
          <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden flex-1 flex flex-col">
            <div className="overflow-auto flex-1">
              <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider sticky top-0 z-10 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3.5 w-10">#</th>
                    <th className="py-2.5 px-3.5">Product Name</th>
                    <th className="py-2.5 px-3.5">Barcode / HSN</th>
                    <th className="py-2.5 px-3.5">Category</th>
                    <th className="py-2.5 px-3.5 text-right">Cost (₹)</th>
                    <th className="py-2.5 px-3.5 text-right">Retail Rate</th>
                    <th className="py-2.5 px-3.5 text-right">Wholesale</th>
                    <th className="py-2.5 px-3.5 text-right">GST %</th>
                    <th className="py-2.5 px-3.5 text-center">Stock Level</th>
                    <th className="py-2.5 px-3.5 text-center w-28">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100 font-mono text-xs">
                  {filteredProducts.map((p, idx) => {
                    const isLow = p.current_stock > 0 && p.current_stock <= p.min_stock_alert;
                    const isOut = p.current_stock <= 0;

                    return (
                      <tr key={p.id} className={idx % 2 === 1 ? 'bg-indigo-50/20' : 'hover:bg-slate-50/80 transition-colors'}>
                        <td className="py-2.5 px-3.5 text-slate-400">{idx + 1}</td>
                        <td className="py-2.5 px-3.5 font-sans">
                          <div className="font-bold text-slate-900 text-xs leading-tight">{p.name}</div>
                          {p.unit && <span className="text-[10px] font-mono text-slate-500">Unit: {p.unit}</span>}
                        </td>
                        <td className="py-2.5 px-3.5 text-slate-600">
                          <div>{p.barcode || '—'}</div>
                          <div className="text-[10px] text-slate-400">HSN: {p.hsn_code || '—'}</div>
                        </td>
                        <td className="py-2.5 px-3.5 font-sans">
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-medium">
                            {p.category || 'General'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3.5 text-right text-slate-600">₹ {(p.purchase_cost || 0).toFixed(2)}</td>
                        <td className="py-2.5 px-3.5 text-right font-bold text-slate-900">₹ {p.retail_price.toFixed(2)}</td>
                        <td className="py-2.5 px-3.5 text-right text-slate-700">₹ {p.wholesale_price.toFixed(2)}</td>
                        <td className="py-2.5 px-3.5 text-right text-indigo-700 font-bold">{p.gst_rate}%</td>
                        <td className="py-2.5 px-3.5 text-center font-sans">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1 font-mono ${
                            isOut 
                              ? 'bg-rose-100 text-rose-800' 
                              : isLow 
                              ? 'bg-amber-100 text-amber-800' 
                              : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {p.current_stock} {p.unit || 'pcs'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3.5 text-center">
                          <div className="flex justify-center items-center gap-1.5">
                            {p.barcode && (
                              <button
                                onClick={() => {
                                  setSelectedProductForBarcode(p);
                                  setBarcodePrintQty(1);
                                  setBarcodeModalOpen(true);
                                }}
                                className="text-slate-500 hover:text-emerald-600 p-1 rounded hover:bg-emerald-50"
                                title="Print Barcode Labels"
                              >
                                <Printer size={14} />
                              </button>
                            )}
                            <button
                              onClick={() => openAdjustStock(p)}
                              className="text-slate-500 hover:text-indigo-600 p-1 rounded hover:bg-indigo-50"
                              title="Adjust Stock Qty"
                            >
                              <ArrowUpDown size={14} />
                            </button>
                            {role === 'admin' && (
                              <button
                                onClick={() => handleEdit(p)}
                                className="text-slate-500 hover:text-indigo-600 p-1 rounded hover:bg-indigo-50"
                                title="Edit Item"
                              >
                                <Edit2 size={14} />
                              </button>
                            )}
                            {role === 'admin' && (
                              <button
                                onClick={() => handleDelete(p.id)}
                                className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50"
                                title="Delete Item"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredProducts.length === 0 && (
                    <tr>
                      <td colSpan={10} className="text-center py-16 text-slate-400 font-sans">
                        <Package size={32} className="mx-auto mb-2 text-slate-300 stroke-1" />
                        <p className="text-xs font-semibold text-slate-600">No products found matching filters</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* Stock Adjustments Audit Log */
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden flex-1 flex flex-col">
          <div className="overflow-auto flex-1">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider sticky top-0 z-10 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3.5 w-12">#</th>
                  <th className="py-2.5 px-3.5">Product Name</th>
                  <th className="py-2.5 px-3.5">Action Type</th>
                  <th className="py-2.5 px-3.5 text-right">Adjustment Qty</th>
                  <th className="py-2.5 px-3.5 text-right">Before</th>
                  <th className="py-2.5 px-3.5 text-right">After Stock</th>
                  <th className="py-2.5 px-3.5">Audit Reason</th>
                  <th className="py-2.5 px-3.5">User</th>
                  <th className="py-2.5 px-3.5">Date & Time</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100 font-mono text-xs">
                {adjustments.map((adj, idx) => (
                  <tr key={adj.id} className={idx % 2 === 1 ? 'bg-indigo-50/20' : 'hover:bg-slate-50/80 transition-colors'}>
                    <td className="py-2.5 px-3.5 text-slate-400">{idx + 1}</td>
                    <td className="py-2.5 px-3.5 font-sans font-bold text-slate-900">{adj.product_name}</td>
                    <td className="py-2.5 px-3.5 font-sans">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        adj.type === 'ADD' ? 'bg-emerald-100 text-emerald-800' : adj.type === 'SUBTRACT' ? 'bg-rose-100 text-rose-800' : 'bg-indigo-100 text-indigo-800'
                      }`}>
                        {adj.type}
                      </span>
                    </td>
                    <td className="py-2.5 px-3.5 text-right font-bold text-slate-800">
                      {adj.type === 'ADD' ? `+${adj.change_qty}` : adj.type === 'SUBTRACT' ? `-${adj.change_qty}` : adj.change_qty}
                    </td>
                    <td className="py-2.5 px-3.5 text-right text-slate-500">{adj.previous_stock}</td>
                    <td className="py-2.5 px-3.5 text-right font-bold text-slate-900">{adj.new_stock}</td>
                    <td className="py-2.5 px-3.5 font-sans text-slate-700">{adj.reason}</td>
                    <td className="py-2.5 px-3.5 font-sans text-slate-600">{adj.user_name || 'Admin'}</td>
                    <td className="py-2.5 px-3.5 text-slate-500 font-sans text-[11px]">
                      {new Date(adj.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
                {adjustments.length === 0 && (
                  <tr>
                    <td colSpan={9} className="text-center py-16 text-slate-400 font-sans">
                      <History size={32} className="mx-auto mb-2 text-slate-300 stroke-1" />
                      <p className="text-xs font-semibold text-slate-600">No stock adjustment entries yet</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      </div>
      
      {/* Add / Edit Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-2xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-100">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-slate-200 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {editingId ? 'Edit Product Details' : 'Add New Inventory Item'}
                </h3>
                <p className="text-[11px] text-slate-500">Configure catalog prices, HSN, taxes, and initial stock</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-5 overflow-y-auto grid grid-cols-2 gap-3.5 flex-1 text-xs">
              <div className="col-span-2">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Product Name *
                </label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Syska LED Bulb 12W White"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Barcode / SKU
                </label>
                <input
                  type="text"
                  placeholder="e.g. 890123456789"
                  value={form.barcode}
                  onChange={e => setForm({ ...form, barcode: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Category
                </label>
                <input
                  type="text"
                  placeholder="e.g. Lighting / Switches"
                  value={form.category}
                  onChange={e => setForm({ ...form, category: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  HSN / SAC Code
                </label>
                <input
                  type="text"
                  placeholder="e.g. 8539"
                  value={form.hsn_code}
                  onChange={e => setForm({ ...form, hsn_code: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  GST Rate Slab
                </label>
                <select
                  value={form.gst_rate}
                  onChange={e => setForm({ ...form, gst_rate: Number(e.target.value) })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-900 bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                >
                  <option value={0}>0% (Tax Exempt / Nil)</option>
                  <option value={5}>5% (Essential Goods)</option>
                  <option value={12}>12% (Standard Low)</option>
                  <option value={18}>18% (Standard High)</option>
                  <option value={28}>28% (Luxury / De-merit)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Purchase / Cost Price (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.purchase_cost || ''}
                  onChange={e => setForm({ ...form, purchase_cost: Number(e.target.value) })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Retail Price (₹) *
                </label>
                <input
                  required
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.retail_price || ''}
                  onChange={e => setForm({ ...form, retail_price: Number(e.target.value) })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Wholesale Price (₹) *
                </label>
                <input
                  required
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.wholesale_price || ''}
                  onChange={e => setForm({ ...form, wholesale_price: Number(e.target.value) })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Initial Stock Quantity
                </label>
                <input
                  type="number"
                  min="0"
                  value={form.current_stock}
                  onChange={e => setForm({ ...form, current_stock: Number(e.target.value) })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Low Stock Alert Threshold
                </label>
                <input
                  type="number"
                  min="0"
                  value={form.min_stock_alert}
                  onChange={e => setForm({ ...form, min_stock_alert: Number(e.target.value) })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Unit of Measurement
                </label>
                <select
                  value={form.unit}
                  onChange={e => setForm({ ...form, unit: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                >
                  <option value="pcs">Pieces (pcs)</option>
                  <option value="box">Box (box)</option>
                  <option value="kg">Kilograms (kg)</option>
                  <option value="g">Grams (g)</option>
                  <option value="m">Meters (m)</option>
                  <option value="l">Liters (l)</option>
                  <option value="set">Set (set)</option>
                </select>
              </div>

              <div className="col-span-2 pt-3 border-t border-slate-200 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-1.5 border border-slate-300 rounded-lg font-bold text-xs text-slate-700 hover:bg-slate-100 uppercase tracking-wider"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-1.5 bg-indigo-600 rounded-lg font-bold text-xs text-white hover:bg-indigo-700 shadow-sm uppercase tracking-wider"
                >
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Stock Adjustment Modal */}
      {adjustModalOpen && selectedProductForAdjust && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-2xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-100">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md border border-slate-200 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Adjust Stock Quantity</h3>
                <p className="text-[11px] text-slate-500 font-mono font-semibold">{selectedProductForAdjust.name}</p>
              </div>
              <button onClick={() => setAdjustModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveStockAdjust} className="p-5 space-y-3.5 text-xs">
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 flex justify-between items-center">
                <span className="text-slate-600 font-medium">Current In-Stock:</span>
                <span className="font-mono font-bold text-slate-900 text-sm">
                  {selectedProductForAdjust.current_stock} {selectedProductForAdjust.unit || 'pcs'}
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Adjustment Type
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['ADD', 'SUBTRACT', 'SET'] as const).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setAdjustForm({ ...adjustForm, type: t })}
                      className={`py-1.5 rounded-md font-bold text-xs uppercase tracking-wider ${
                        adjustForm.type === t ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {t === 'ADD' ? '+ Add' : t === 'SUBTRACT' ? '- Subtract' : '= Set Total'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Quantity
                </label>
                <input
                  required
                  type="number"
                  min="1"
                  value={adjustForm.change_qty}
                  onChange={e => setAdjustForm({ ...adjustForm, change_qty: Math.max(1, Number(e.target.value) || 1) })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Reason for Adjustment (Audit)
                </label>
                <select
                  value={adjustForm.reason}
                  onChange={e => setAdjustForm({ ...adjustForm, reason: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                >
                  <option value="Damage / Expired">Damage / Expired</option>
                  <option value="Physical Count Correction">Physical Count Correction</option>
                  <option value="Customer Return">Customer Return</option>
                  <option value="Supplier Replacement">Supplier Replacement</option>
                  <option value="Theft / Lost">Theft / Lost</option>
                  <option value="Opening Stock Entry">Opening Stock Entry</option>
                </select>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setAdjustModalOpen(false)}
                  className="px-3.5 py-1.5 border border-slate-300 rounded-lg font-bold text-xs text-slate-700 hover:bg-slate-100 uppercase tracking-wider"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 rounded-lg font-bold text-xs text-white hover:bg-indigo-700 shadow-sm uppercase tracking-wider"
                >
                  Commit Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <BulkImportModal 
        isOpen={importModalOpen} 
        onClose={() => setImportModalOpen(false)} 
        onRefresh={fetchProducts} 
      />

      {/* Barcode Print Modal */}
      {barcodeModalOpen && selectedProductForBarcode && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in zoom-in-95 print:hidden">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-900 uppercase tracking-wider text-xs">Print Barcodes</h3>
              <button onClick={() => setBarcodeModalOpen(false)} className="text-slate-400 hover:text-slate-700 transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex justify-center">
                <Barcode 
                  value={selectedProductForBarcode.barcode} 
                  format="CODE128"
                  width={1.5}
                  height={50}
                  fontSize={12}
                  background="transparent"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Number of Labels to Print</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={barcodePrintQty}
                    onChange={(e) => setBarcodePrintQty(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                  <span className="text-xs text-slate-500 font-bold">Labels</span>
                </div>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setBarcodeModalOpen(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg font-bold text-xs text-slate-700 hover:bg-slate-100 uppercase tracking-wider transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 bg-indigo-600 rounded-lg font-bold text-xs text-white hover:bg-indigo-700 shadow-sm uppercase tracking-wider transition-colors flex items-center gap-2"
              >
                <Printer size={14} /> Print Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden Print Section */}
      <div className="hidden print:flex flex-wrap gap-4 bg-white items-start justify-start p-4 w-full">
        {selectedProductForBarcode && Array.from({ length: barcodePrintQty }).map((_, i) => (
          <div key={i} className="flex flex-col items-center justify-center p-2 border border-slate-300 rounded" style={{ pageBreakInside: 'avoid', width: '2in', height: '1in' }}>
            <div className="text-[10px] font-bold uppercase truncate max-w-full text-center leading-tight mb-1">{selectedProductForBarcode.name}</div>
            <Barcode 
              value={selectedProductForBarcode.barcode} 
              format="CODE128"
              width={1.2}
              height={30}
              fontSize={10}
              margin={0}
            />
            <div className="text-[11px] font-black mt-1">₹ {selectedProductForBarcode.retail_price.toFixed(2)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
