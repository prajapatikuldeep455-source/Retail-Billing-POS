import { useState, useEffect, useRef, type FormEvent, type KeyboardEvent } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { 
  Search, Plus, Minus, Trash2, QrCode, User, Phone, 
  CheckCircle2, AlertCircle, RefreshCw, X, Receipt, 
  Smartphone, CreditCard, Banknote, Clock, Send, Printer,
  Pause, Play, Gift
} from 'lucide-react';
import { useNavigate } from 'react-router';

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
  current_stock: number;
  min_stock_alert: number;
  allow_negative_stock: number;
  unit?: string;
};

type CartItem = Product & {
  quantity: number;
  use_wholesale: boolean;
  discount: number;
};

type Customer = {
  id: number;
  name: string;
  phone: string;
  credit_balance: number;
  loyalty_points?: number;
};

export default function POS({ role = 'admin' }: { role?: 'admin' | 'cashier' }) {
  const navigate = useNavigate();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const customerInputRef = useRef<HTMLInputElement>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [heldBills, setHeldBills] = useState<{ id: string, time: string, cart: CartItem[], customerName: string, customerPhone: string, selectedCustomerId: number | null }[]>([]);
  const [showHeldBillsModal, setShowHeldBillsModal] = useState(false);
  
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerCredit, setCustomerCredit] = useState<number>(0);
  const [isInterState, setIsInterState] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi' | 'card' | 'credit'>('cash');
  const [isSaving, setIsSaving] = useState(false);
  const [autoPrint, setAutoPrint] = useState(true);
  const [pointsToRedeem, setPointsToRedeem] = useState<number>(0);
  const [upiPaymentSimulated, setUpiPaymentSimulated] = useState(false);
  const [lastCreatedInvoice, setLastCreatedInvoice] = useState<{ id: number; number: string; total: number } | null>(null);

  useEffect(() => {
    fetchProducts();
  }, [search]);

  useEffect(() => {
    fetchCustomers();
    fetchSettings();
  }, []);

  // Global Keyboard shortcuts & Background Barcode Scanner
  useEffect(() => {
    let barcodeBuffer = '';
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. F-Key Shortcuts
      if (e.key === 'F1') {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      } else if (e.key === 'F2') {
        e.preventDefault();
        customerInputRef.current?.focus();
        return;
      } else if (e.key === 'F4') {
        e.preventDefault();
        setCart(prev => prev.map(item => ({ ...item, use_wholesale: !item.use_wholesale })));
        return;
      } else if (e.key === 'F9') {
        e.preventDefault();
        setPaymentMethod('cash');
        return;
      } else if (e.key === 'F12') {
        e.preventDefault();
        if (!isSaving && cart.length > 0) {
          handleCheckout();
        }
        return;
      }

      // 2. Global Barcode Scanner Capture
      const activeTag = document.activeElement?.tagName.toLowerCase();
      const isInputFocused = activeTag === 'input' || activeTag === 'textarea';
      
      const currentTime = Date.now();
      
      if (e.key.length === 1) {
        if (currentTime - lastKeyTime > 50) {
          barcodeBuffer = ''; // Reset if typing slowly (human)
        }
        barcodeBuffer += e.key;
        lastKeyTime = currentTime;
      }

      if (e.key === 'Enter') {
        if (barcodeBuffer.length > 3 && (currentTime - lastKeyTime < 50) && !isInputFocused) {
          e.preventDefault();
          const scannedCode = barcodeBuffer;
          barcodeBuffer = '';
          
          // Background fetch and add to cart
          fetch(`/api/products?q=${encodeURIComponent(scannedCode)}`)
            .then(res => res.json())
            .then(data => {
              const exactMatch = data.find((p: Product) => p.barcode === scannedCode || p.hsn_code === scannedCode) || (data.length === 1 ? data[0] : null);
              if (exactMatch) {
                // Call addToCart logic manually since addToCart function might be stale in this closure
                const allowNegative = settings.allow_negative_stock === 'true' || exactMatch.allow_negative_stock === 1;
                setCart(prev => {
                  const existing = prev.find(item => item.id === exactMatch.id);
                  const newQty = existing ? existing.quantity + 1 : 1;
                  
                  if (!allowNegative && exactMatch.current_stock < newQty) {
                    alert(`Warning: Insufficient stock for ${exactMatch.name}. Current Available Stock is ${exactMatch.current_stock}.`);
                    return prev;
                  }
                  
                  if (existing) {
                    return prev.map(item => item.id === exactMatch.id ? { ...item, quantity: newQty } : item);
                  }
                  return [...prev, { ...exactMatch, quantity: 1, use_wholesale: false, discount: 0 }];
                });
              }
            })
            .catch(console.error);
        } else {
          barcodeBuffer = '';
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, customerName, customerPhone, paymentMethod, isInterState, selectedCustomerId, isSaving, settings]);

  const fetchProducts = async () => {
    try {
      const url = search ? `/api/products?q=${encodeURIComponent(search)}` : '/api/products';
      const res = await fetch(url);
      const data = await res.json();
      setProducts(data);
    } catch (err) {
      console.error('Failed to fetch products', err);
    }
  };

  const fetchCustomers = async () => {
    try {
      const res = await fetch('/api/customers');
      if (res.ok) {
        const data = await res.json();
        setCustomers(data);
      }
    } catch (err) {
      console.error('Failed to fetch customers', err);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const categories = ['All', ...Array.from(new Set(products.map(p => p.category || 'General').filter(Boolean)))];

  const filteredProducts = selectedCategory === 'All'
    ? products
    : products.filter(p => (p.category || 'General') === selectedCategory);

  const addToCart = (product: Product) => {
    const allowNegative = settings.allow_negative_stock === 'true' || product.allow_negative_stock === 1;
    const existing = cart.find(item => item.id === product.id);
    const newQty = existing ? existing.quantity + 1 : 1;

    if (!allowNegative && product.current_stock < newQty) {
      alert(`Warning: Insufficient stock for ${product.name}. Current Available Stock is ${product.current_stock}.`);
      return;
    }

    setCart(prev => {
      if (existing) {
        return prev.map(item => 
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...product, quantity: 1, use_wholesale: false, discount: 0 }];
    });
    setSearch('');
  };

  const handleSearchKeyDown = async (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && search.trim() !== '') {
      e.preventDefault();
      // Auto-add exact match (barcode or HSN) or if only one product matches
      let exactMatch = products.find(p => p.barcode === search || p.hsn_code === search);
      
      // If not found in current state due to fast scanner / fetch delay, fetch directly
      if (!exactMatch) {
        try {
          const res = await fetch(`/api/products?q=${encodeURIComponent(search)}`);
          const data = await res.json();
          exactMatch = data.find((p: Product) => p.barcode === search || p.hsn_code === search);
          if (!exactMatch && data.length === 1) {
             exactMatch = data[0];
          }
        } catch (err) {
          console.error('Barcode fetch error', err);
        }
      }

      if (exactMatch) {
        addToCart(exactMatch);
      } else if (filteredProducts.length === 1) {
        addToCart(filteredProducts[0]);
      }
    }
  };

  const updateCartItem = (id: number, updates: Partial<CartItem>) => {
    const item = cart.find(i => i.id === id);
    if (!item) return;

    if (updates.quantity !== undefined) {
      const allowNegative = settings.allow_negative_stock === 'true' || item.allow_negative_stock === 1;
      if (!allowNegative && updates.quantity > item.current_stock) {
        alert(`Cannot add more than available stock (${item.current_stock} ${item.unit || 'pcs'}).`);
        return;
      }
    }

    setCart(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i));
  };

  const removeFromCart = (id: number) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const clearCart = () => {
    if (cart.length > 0 && confirm('Are you sure you want to clear the current bill?')) {
      setCart([]);
      setCustomerName('');
      setPointsToRedeem(0);
      setCustomerPhone('');
      setSelectedCustomerId(null);
      setCustomerCredit(0);
      setUpiPaymentSimulated(false);
    }
  };

  const holdCurrentBill = () => {
    if (cart.length === 0) return;
    const newHold = {
      id: Math.random().toString(36).substring(7),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      cart: [...cart],
      customerName,
      customerPhone,
      selectedCustomerId
    };
    setHeldBills([...heldBills, newHold]);
    setCart([]);
    setCustomerName('');
    setCustomerPhone('');
    setSelectedCustomerId(null);
    setCustomerCredit(0);
    setUpiPaymentSimulated(false);
  };

  const resumeBill = (heldBill: any) => {
    if (cart.length > 0) {
      if (!confirm("Current cart is not empty. It will be put on hold to load this bill. Continue?")) {
         return;
      }
      holdCurrentBill();
    }
    setCart(heldBill.cart);
    setCustomerName(heldBill.customerName);
    setCustomerPhone(heldBill.customerPhone);
    setSelectedCustomerId(heldBill.selectedCustomerId);
    
    // Fetch customer credit if applicable
    const cust = customers.find(c => c.id === heldBill.selectedCustomerId);
    if (cust) {
      setCustomerCredit(cust.credit_balance);
    } else {
      setCustomerCredit(0);
    }
    
    setHeldBills(prev => prev.filter(b => b.id !== heldBill.id));
    setShowHeldBillsModal(false);
  };

  const handleSelectCustomer = (phone: string) => {
    const cust = customers.find(c => c.phone === phone);
    if (cust) {
      setSelectedCustomerId(cust.id);
      setCustomerName(cust.name);
      setCustomerPhone(cust.phone);
      setCustomerCredit(cust.credit_balance);
    } else {
      setSelectedCustomerId(null);
      setCustomerCredit(0);
    }
  };

  // Tax and line item calculations
  const calculatedCart = cart.map(item => {
    const unitPrice = item.use_wholesale ? item.wholesale_price : item.retail_price;
    const grossTotal = unitPrice * item.quantity;
    const netTotalBeforeTax = Math.max(0, grossTotal - item.discount);
    
    const taxAmount = (netTotalBeforeTax * item.gst_rate) / 100;
    
    let cgst = 0, sgst = 0, igst = 0;
    if (isInterState) {
      igst = taxAmount;
    } else {
      cgst = taxAmount / 2;
      sgst = taxAmount / 2;
    }

    const lineTotal = netTotalBeforeTax + taxAmount;

    return {
      ...item,
      unitPrice,
      grossTotal,
      netTotalBeforeTax,
      taxAmount,
      cgst,
      sgst,
      igst,
      lineTotal
    };
  });

  const subtotal = calculatedCart.reduce((sum, item) => sum + item.grossTotal, 0);
  const totalTaxable = calculatedCart.reduce((sum, item) => sum + item.netTotalBeforeTax, 0);
  const totalDiscount = calculatedCart.reduce((sum, item) => sum + item.discount, 0);
  const totalCGST = calculatedCart.reduce((sum, item) => sum + item.cgst, 0);
  const totalSGST = calculatedCart.reduce((sum, item) => sum + item.sgst, 0);
  
  const totalIGST = calculatedCart.reduce((sum, item) => sum + item.igst, 0);

  const rawGrandTotal = calculatedCart.reduce((sum, item) => sum + item.lineTotal, 0);
  const selectedCustomerObj = customers.find(c => c.phone === customerPhone);
  const availablePoints = selectedCustomerObj?.loyalty_points || 0;
  
  // Ensure we don't redeem more points than available or more than the bill total
  const actualPointsToRedeem = Math.min(pointsToRedeem, availablePoints, Math.floor(rawGrandTotal));
  const grandTotal = Math.round(rawGrandTotal - actualPointsToRedeem);
  const pointsEarned = Math.floor(grandTotal / 100); // 1 point per 100 Rs spent


  // Dynamic UPI URI Generator (Real NPCI UPI Protocol)
  const upiId = settings.shop_upi_id || 'amanelectronics@okaxis';
  const upiMerchant = encodeURIComponent(settings.shop_upi_name || settings.shop_name || 'Retail POS');
  const upiURI = `upi://pay?pa=${upiId}&pn=${upiMerchant}&am=${grandTotal.toFixed(2)}&cu=INR&tn=Retail_POS_Bill`;

  const handleCheckout = async () => {
    if (isSaving) return;
    if (paymentMethod === 'upi' && !upiPaymentSimulated) {
      alert('Please verify UPI payment before generating invoice.');
      return;
    }

    if (cart.length === 0) {
      alert('Cart is empty. Please add items to generate invoice.');
      return;
    }

    if (paymentMethod === 'credit' && (!customerName.trim() || !customerPhone.trim())) {
      alert('Customer Name and Mobile Number are required for Credit / Udhar bills.');
      customerInputRef.current?.focus();
      return;
    }

    setIsSaving(true);
    
    const invoiceData = {
      customer_id: selectedCustomerId,
      customer_name: customerName,
      customer_phone: customerPhone,
      payment_method: paymentMethod,
      payment_status: paymentMethod === 'credit' ? 'unpaid' : 'paid',
      upi_ref: paymentMethod === 'upi' ? `UPI-${Date.now().toString().slice(-6)}` : null,
      subtotal,
      discount: totalDiscount + actualPointsToRedeem,
      loyalty_points_redeemed: actualPointsToRedeem,
      loyalty_points_earned: pointsEarned,
      cgst_total: totalCGST,

      sgst_total: totalSGST,
      igst_total: totalIGST,
      grand_total: grandTotal,
      is_inter_state: isInterState,
      cashier_name: role === 'admin' ? 'Admin Desk' : 'Counter Cashier',
      items: calculatedCart.map(item => ({
        product_id: item.id,
        product_name: item.name,
        hsn_code: item.hsn_code,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        purchase_cost: item.purchase_cost || 0,
        discount: item.discount,
        taxable_value: item.netTotalBeforeTax,
        gst_rate: item.gst_rate,
        cgst_amount: item.cgst,
        sgst_amount: item.sgst,
        igst_amount: item.igst,
        line_total: item.lineTotal
      }))
    };

    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invoiceData)
      });
      const data = await res.json();
      if (data.success) {
        setLastCreatedInvoice({
          id: data.invoice_id,
          number: data.invoice_number,
          total: grandTotal
        });

        // Reset POS state
        setCart([]);
        setCustomerName('');
        setCustomerPhone('');
        setSelectedCustomerId(null);
        setCustomerCredit(0);
        setUpiPaymentSimulated(false);
        fetchProducts(); // Refresh live stock counts

        if (autoPrint) {
          window.open(`/print/${data.invoice_id}`, '_blank');
        }
      } else {
        alert(data.error || 'Failed to save invoice');
      }
    } catch (err) {
      console.error(err);
      alert('Error saving invoice');
    } finally {
      setIsSaving(false);
    }
  };

  const sendWhatsAppBill = (invoiceNumber: string, phone: string, total: number) => {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const text = encodeURIComponent(
      `Hello! Here is your bill from ${settings.shop_name || 'Retail POS'}.\n` +
      `Invoice: ${invoiceNumber}\n` +
      `Amount: Rs. ${total.toFixed(2)}\n` +
      `Status: ${paymentMethod === 'credit' ? 'Due (Credit)' : 'Paid'}\n` +
      `Thank you for shopping with us!`
    );
    window.open(`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${text}`, '_blank');
  };

  return (
    <div className="flex-1 flex overflow-hidden bg-[#F8FAFC]">
      {/* Left Main Section: Search, Fast Pick & Line Items */}
      <section className="flex-1 flex flex-col bg-white border-r border-slate-200 overflow-hidden">
        {/* Search & Category Filter Bar */}
        <div className="p-3.5 bg-slate-50 border-b border-slate-200">
          <div className="flex gap-3 items-center">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <span className="text-slate-400 font-mono text-xs font-bold bg-slate-100 border border-slate-300 px-1.5 py-0.5 rounded">[F1]</span>
              </div>
              <input
                ref={searchInputRef}
                autoFocus
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Search Item by Name or Scan Barcode..."
                className="block w-full pl-14 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 shadow-2xs"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3 top-2 text-slate-400 hover:text-slate-600">
                  <X size={15} />
                </button>
              )}
            </div>
            
            {/* Category pills */}
            <div className="hidden lg:flex items-center gap-1 overflow-x-auto max-w-sm shrink-0">
              {categories.slice(0, 4).map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                    selectedCategory === cat
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Quick Product Pick Drawer */}
          {products.length > 0 && search && (
            <div className="mt-2.5 max-h-36 overflow-y-auto grid grid-cols-2 md:grid-cols-3 gap-2 p-1 bg-slate-100/70 rounded-lg border border-slate-200">
              {filteredProducts.map(p => {
                const isLowStock = p.current_stock <= p.min_stock_alert;
                return (
                  <button
                    key={p.id}
                    onClick={() => addToCart(p)}
                    className="flex flex-col text-left p-2 bg-white rounded-md border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/30 transition-all shadow-2xs"
                  >
                    <div className="flex justify-between items-start gap-1">
                      <span className="text-xs font-bold text-slate-900 truncate">{p.name}</span>
                      <span className={`text-[9px] font-mono px-1 rounded font-bold shrink-0 ${
                        p.current_stock <= 0 ? 'bg-rose-100 text-rose-700' : isLowStock ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {p.current_stock} {p.unit}
                      </span>
                    </div>
                    <div className="flex justify-between items-center mt-1 text-[11px]">
                      <span className="font-mono font-bold text-indigo-700">₹{p.retail_price.toFixed(2)}</span>
                      <span className="text-slate-500 text-[10px]">GST {p.gst_rate}%</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Cart Line Items Table - Geometric Balance */}
        <div className="flex-1 overflow-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50 sticky top-0 z-10">
              <tr>
                <th className="px-3 py-2.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider w-8">#</th>
                <th className="px-3 py-2.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Item Description</th>
                <th className="px-3 py-2.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider w-16">HSN</th>
                <th className="px-3 py-2.5 text-right text-xs font-bold text-slate-500 uppercase tracking-wider w-24">Qty</th>
                <th className="px-3 py-2.5 text-right text-xs font-bold text-slate-500 uppercase tracking-wider w-20">Rate (₹)</th>
                <th className="px-3 py-2.5 text-right text-xs font-bold text-slate-500 uppercase tracking-wider w-16">Disc</th>
                <th className="px-3 py-2.5 text-right text-xs font-bold text-slate-500 uppercase tracking-wider w-14">GST%</th>
                <th className="px-3 py-2.5 text-right text-xs font-bold text-slate-500 uppercase tracking-wider w-24">Amount (₹)</th>
                <th className="px-2 py-2.5 text-center text-xs font-bold text-slate-500 uppercase tracking-wider w-8"></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100 font-mono text-xs">
              {calculatedCart.map((item, idx) => {
                const isOverStock = item.quantity > item.current_stock;
                return (
                  <tr key={item.id} className={idx % 2 === 1 ? 'bg-indigo-50/20' : 'bg-white hover:bg-slate-50/80 transition-colors'}>
                    <td className="px-3 py-2.5 text-slate-400 text-[11px] font-medium">{idx + 1}</td>
                    <td className="px-3 py-2.5 font-sans">
                      <div className="font-semibold text-slate-900 text-xs leading-tight flex items-center gap-1.5">
                        {item.name}
                        {isOverStock && (
                          <span className="text-[9px] bg-rose-100 text-rose-700 px-1 py-0.2 rounded font-bold">
                            Low Stock ({item.current_stock})
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 font-mono text-[10px] text-slate-500">
                        {item.barcode && <span>Bar: {item.barcode}</span>}
                        <label className="inline-flex items-center gap-1 cursor-pointer bg-slate-100 px-1.5 py-0.5 rounded text-[10px] font-sans font-medium text-slate-700 hover:bg-slate-200">
                          <input
                            type="checkbox"
                            checked={item.use_wholesale}
                            onChange={e => updateCartItem(item.id, { use_wholesale: e.target.checked })}
                            className="rounded text-indigo-600 focus:ring-indigo-500 w-3 h-3"
                          />
                          Wholesale
                        </label>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-slate-500 text-[11px]">{item.hsn_code || '—'}</td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="inline-flex items-center gap-0.5 border border-slate-300 rounded-md bg-white p-0.5 shadow-2xs">
                        <button
                          onClick={() => updateCartItem(item.id, { quantity: Math.max(1, item.quantity - 1) })}
                          className="px-1 py-0.5 hover:bg-slate-100 text-slate-600 rounded"
                        >
                          <Minus size={11} />
                        </button>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={e => updateCartItem(item.id, { quantity: Math.max(1, Number(e.target.value) || 1) })}
                          className="w-8 text-center font-bold text-slate-900 focus:outline-hidden py-0.5 hide-arrows text-xs"
                        />
                        <button
                          onClick={() => updateCartItem(item.id, { quantity: item.quantity + 1 })}
                          className="px-1 py-0.5 hover:bg-slate-100 text-slate-600 rounded"
                        >
                          <Plus size={11} />
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right text-slate-900 font-medium">{item.unitPrice.toFixed(2)}</td>
                    <td className="px-3 py-2.5 text-right">
                      <input
                        type="number"
                        min="0"
                        value={item.discount === 0 ? '' : item.discount}
                        placeholder="0"
                        onChange={e => {
                          const val = e.target.value;
                          updateCartItem(item.id, { discount: val === '' ? 0 : Math.max(0, Number(val)) });
                        }}
                        className="w-12 px-1 py-0.5 text-right border border-slate-300 rounded-md font-mono text-[11px] focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                      />
                    </td>
                    <td className="px-3 py-2.5 text-right text-slate-600 text-[11px]">{item.gst_rate}%</td>
                    <td className="px-3 py-2.5 text-right font-bold text-slate-900 text-xs">
                      {item.lineTotal.toFixed(2)}
                    </td>
                    <td className="px-2 py-2.5 text-center">
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="text-slate-400 hover:text-rose-600 p-1 rounded transition-colors"
                        title="Remove Item"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {cart.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-16">
                    <div className="flex flex-col items-center justify-center text-slate-400">
                      <Receipt size={36} className="stroke-1 text-slate-300 mb-2" />
                      <p className="text-xs font-semibold text-slate-600 font-sans">Current bill is empty</p>
                      <p className="text-[11px] text-slate-400 mt-0.5 font-sans">
                        Press <kbd className="bg-slate-100 px-1 py-0.5 rounded border border-slate-300 font-mono">F1</kbd> to search catalog or scan barcode
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Quick Toolbar at Bottom of Cart */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-xs">
          <div className="flex gap-2">
            <button
              onClick={() => customerInputRef.current?.focus()}
              className="px-2.5 py-1 bg-white border border-slate-300 rounded-md shadow-2xs font-bold text-slate-700 hover:bg-slate-100 uppercase tracking-tight flex items-center gap-1 text-[11px]"
            >
              <User size={12} className="text-slate-500" /> [F2] Customer
            </button>
            <button
              onClick={() => setCart(prev => prev.map(item => ({ ...item, use_wholesale: !item.use_wholesale })))}
              className="px-2.5 py-1 bg-white border border-slate-300 rounded-md shadow-2xs font-bold text-slate-700 hover:bg-slate-100 uppercase tracking-tight text-[11px]"
            >
              [F4] Wholesale
            </button>
            {cart.length > 0 && (
              <button
                onClick={holdCurrentBill}
                className="px-2.5 py-1 bg-white border border-amber-300 rounded-md shadow-2xs font-bold text-amber-700 hover:bg-amber-50 uppercase tracking-tight flex items-center gap-1 text-[11px]"
              >
                <Pause size={12} /> Hold Bill
              </button>
            )}
            <button
              onClick={() => setShowHeldBillsModal(true)}
              className="px-2.5 py-1 bg-white border border-indigo-300 rounded-md shadow-2xs font-bold text-indigo-700 hover:bg-indigo-50 uppercase tracking-tight flex items-center gap-1 text-[11px]"
            >
              <Play size={12} /> Resume {heldBills.length > 0 && `(${heldBills.length})`}
            </button>
            {cart.length > 0 && (
              <button
                onClick={clearCart}
                className="px-2.5 py-1 bg-white border border-rose-200 rounded-md shadow-2xs font-bold text-rose-600 hover:bg-rose-50 uppercase tracking-tight text-[11px]"
              >
                Clear Cart
              </button>
            )}
          </div>
          <div className="text-slate-500 font-medium text-[11px]">
            <span className="font-bold text-slate-800">{cart.length}</span> items • Realtime stock sync
          </div>
        </div>
      </section>

      {/* Right Drawer: Customer Info, Payment Summary, UPI QR & Actions */}
      <aside className="w-[370px] bg-white flex flex-col shrink-0 border-l border-slate-200 overflow-y-auto">
        <div className="p-4 flex-1 flex flex-col">
          
          {/* Customer Details Box */}
          <div className="mb-3.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <User size={11} /> Customer & GST
              </span>
              <label className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isInterState}
                  onChange={e => setIsInterState(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-3 h-3"
                />
                Inter-state (IGST)
              </label>
            </div>
            <div className="space-y-1.5">
              <input
                ref={customerInputRef}
                type="text"
                placeholder="Customer Name (Optional)"
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md text-xs font-medium text-slate-900 focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
              />
              <div className="relative">
                <input
                  type="text"
                  placeholder="Mobile No. (for WhatsApp & Udhar)"
                  value={customerPhone}
                  onChange={e => {
                    setCustomerPhone(e.target.value);
                    handleSelectCustomer(e.target.value);
                  }}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md text-xs font-medium text-slate-900 focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>
              
              {customerCredit > 0 && (
                <div className="text-[10px] bg-rose-50 border border-rose-200 text-rose-700 px-2 py-1 rounded font-medium flex justify-between">
                  <span>Previous Udhar Due:</span>
                  <span className="font-mono font-bold">₹ {customerCredit.toFixed(2)}</span>
                </div>
              )}
              
              {availablePoints > 0 && (
                <div className="text-[10px] bg-amber-50 border border-amber-200 text-amber-800 p-2 rounded flex flex-col gap-1.5 mt-1">
                  <div className="flex justify-between items-center font-bold">
                    <span className="flex items-center gap-1"><Gift size={11} /> Loyalty Points Available</span>
                    <span className="font-mono">{availablePoints} pts</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input 
                      type="number" 
                      min="0"
                      max={Math.min(availablePoints, Math.floor(rawGrandTotal))}
                      value={pointsToRedeem}
                      onChange={(e) => setPointsToRedeem(Number(e.target.value) || 0)}
                      className="w-full px-2 py-1 border border-amber-300 rounded text-xs focus:ring-1 focus:ring-amber-500 font-mono"
                      placeholder="Pts to redeem"
                    />
                    <button 
                      onClick={() => setPointsToRedeem(Math.min(availablePoints, Math.floor(rawGrandTotal)))}
                      className="whitespace-nowrap px-2 py-1 bg-amber-200 hover:bg-amber-300 rounded font-bold text-amber-900 transition-colors"
                    >
                      Use Max
                    </button>
                  </div>
                  {pointsToRedeem > 0 && (
                    <div className="text-[9px] text-amber-700 text-right">
                      -₹{actualPointsToRedeem.toFixed(2)} off bill
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Payment Summary */}
          <div className="mb-3">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
              Payment Summary
            </h3>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-slate-600">
                <span>Subtotal (Gross)</span>
                <span className="font-mono font-bold text-slate-900">₹ {subtotal.toFixed(2)}</span>
              </div>
              
              {totalDiscount > 0 && (
                <div className="flex justify-between text-xs text-emerald-600">
                  <span>Discount (-)</span>
                  <span className="font-mono font-bold">-₹ {totalDiscount.toFixed(2)}</span>
                </div>
              )}
              {actualPointsToRedeem > 0 && (
                <div className="flex justify-between text-xs text-amber-600">
                  <span>Loyalty Pts Redeemed (-)</span>
                  <span className="font-mono font-bold">-₹ {actualPointsToRedeem.toFixed(2)}</span>
                </div>
              )}
              {(totalDiscount > 0 || actualPointsToRedeem > 0) && (
                <div className="flex justify-between text-xs text-slate-700 font-medium">
                  <span>Taxable Amount</span>
                  <span className="font-mono font-bold">₹ {totalTaxable.toFixed(2)}</span>
                </div>
              )}
              
              <div className="h-px bg-slate-100 my-0.5"></div>
              {!isInterState ? (
                <>
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>CGST</span>
                    <span className="font-mono font-bold text-slate-900">₹ {totalCGST.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>SGST</span>
                    <span className="font-mono font-bold text-slate-900">₹ {totalSGST.toFixed(2)}</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between text-xs text-slate-600">
                  <span>IGST</span>
                  <span className="font-mono font-bold text-slate-900">₹ {totalIGST.toFixed(2)}</span>
                </div>
              )}
              
              <div className="bg-indigo-50 border border-indigo-100 p-2.5 rounded-lg flex justify-between items-center mt-2">
                <span className="text-xs font-black text-indigo-900 uppercase tracking-wider">Grand Total</span>
                <span className="text-2xl font-mono font-black text-indigo-700">₹ {grandTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Payment Method */}
          <div className="mb-4 flex-1">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex justify-between">
              Payment Method
              <label className="flex items-center gap-1 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={autoPrint} 
                  onChange={e => setAutoPrint(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-3 h-3"
                /> 
                <span className="text-slate-600">Auto-Print</span>
              </label>
            </h3>
            
            <div className="grid grid-cols-2 gap-2 mb-3">
              <button
                onClick={() => setPaymentMethod('cash')}
                className={`py-2 px-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${
                  paymentMethod === 'cash' ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Banknote size={16} />
                <span className="text-[10px] font-bold uppercase tracking-wider">Cash</span>
              </button>
              <button
                onClick={() => setPaymentMethod('upi')}
                className={`py-2 px-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${
                  paymentMethod === 'upi' ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Smartphone size={16} />
                <span className="text-[10px] font-bold uppercase tracking-wider">UPI / QR</span>
              </button>
              <button
                onClick={() => setPaymentMethod('card')}
                className={`py-2 px-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${
                  paymentMethod === 'card' ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <CreditCard size={16} />
                <span className="text-[10px] font-bold uppercase tracking-wider">Card</span>
              </button>
              <button
                onClick={() => setPaymentMethod('credit')}
                className={`py-2 px-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${
                  paymentMethod === 'credit' ? 'bg-rose-600 border-rose-600 text-white shadow-md' : 'bg-white border-slate-200 text-slate-600 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200'
                }`}
              >
                <User size={16} />
                <span className="text-[10px] font-bold uppercase tracking-wider">Udhar</span>
              </button>
            </div>
            
            {paymentMethod === 'upi' && (
              <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col items-center justify-center mb-3">
                <div className="w-32 h-32 bg-slate-100 rounded-lg mb-2 flex items-center justify-center">
                  <QRCodeSVG value={upiURI} size={110} />
                </div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">
                  Scan to Pay ₹ {grandTotal.toFixed(2)}<br/>
                  <span className="text-indigo-600">via any UPI app</span>
                </p>
                <div className="mt-2 w-full">
                  <button 
                    onClick={() => setUpiPaymentSimulated(true)}
                    className={`w-full py-1.5 rounded border text-[10px] font-bold uppercase tracking-wider ${
                      upiPaymentSimulated 
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {upiPaymentSimulated ? 'Payment Verified ✓' : 'Verify Payment Receipt'}
                  </button>
                </div>
              </div>
            )}
          </div>
          
          <button
            onClick={handleCheckout}
            disabled={cart.length === 0 || isSaving || (paymentMethod === 'upi' && !upiPaymentSimulated)}
            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-black text-sm uppercase tracking-widest shadow-lg flex items-center justify-center gap-2 transition-all mt-auto"
          >
            {isSaving ? 'Processing...' : (
              <>
                <CheckCircle2 size={18} /> GENERATE BILL (F12)
              </>
            )}
          </button>
        </div>
      </aside>
      {showHeldBillsModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <h3 className="font-black text-sm text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Pause size={16} className="text-indigo-600" /> Held Bills ({heldBills.length})
              </h3>
              <button onClick={() => setShowHeldBillsModal(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <div className="p-6">
              {heldBills.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-8">No held bills. Use the Hold button to park a bill for later.</p>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {heldBills.map(b => (
                    <div key={b.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex justify-between items-center">
                      <div>
                        <p className="font-bold text-xs text-slate-800">{b.customerName || 'Walk-in Customer'}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{b.cart.length} items • Held at {b.time}</p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => { resumeBill(b); setShowHeldBillsModal(false); }} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold">Resume</button>
                        <button onClick={() => setHeldBills(prev => prev.filter(h => h.id !== b.id))} className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-xs font-bold">Discard</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
