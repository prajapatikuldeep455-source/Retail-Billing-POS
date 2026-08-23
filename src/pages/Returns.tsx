import { useState, useEffect, type FormEvent } from 'react';
import { 
  RotateCcw, Search, Printer, Eye, Plus, Calendar, 
  Send, X, CheckCircle2, AlertCircle, ArrowLeft,
  FileSpreadsheet, Package, IndianRupee, User, Undo2
} from 'lucide-react';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type ReturnRecord = {
  id: number;
  return_number: string;
  invoice_id: number;
  invoice_number: string;
  customer_id: number | null;
  customer_name: string;
  customer_phone: string | null;
  return_date: string;
  total_refund_amount: number;
  refund_method: string;
  reason: string;
  processed_by: string;
  item_count?: number;
};

type ReturnItem = {
  id: number;
  product_id: number | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  taxable_value: number;
  gst_rate: number;
  tax_amount: number;
  refund_amount: number;
  restock_to_inventory: number;
};

type ReturnDetail = ReturnRecord & {
  items: ReturnItem[];
};

type InvoiceItemForReturn = {
  id: number;
  product_id: number | null;
  product_name: string;
  hsn_code: string | null;
  quantity: number;
  unit_price: number;
  taxable_value: number;
  gst_rate: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  line_total: number;
  // Return form state
  returnQty: number;
  restock: boolean;
};

export default function Returns({ role = 'admin' }: { role?: 'admin' | 'cashier' | null }) {
  const [returnsList, setReturnsList] = useState<ReturnRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReturn, setSelectedReturn] = useState<ReturnDetail | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isNewReturnModalOpen, setIsNewReturnModalOpen] = useState(false);

  // New Return Workflow State
  const [invoiceQuery, setInvoiceQuery] = useState('');
  const [searchingInvoice, setSearchingInvoice] = useState(false);
  const [foundInvoices, setFoundInvoices] = useState<any[]>([]);
  const [selectedInvoiceForReturn, setSelectedInvoiceForReturn] = useState<any | null>(null);
  const [returnItems, setReturnItems] = useState<InvoiceItemForReturn[]>([]);
  const [refundMethod, setRefundMethod] = useState<'cash' | 'upi' | 'credit_deduction' | 'store_credit'>('cash');
  const [returnReason, setReturnReason] = useState('Customer Changed Mind');
  const [customReason, setCustomReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchReturns = async () => {
    try {
      const res = await fetch('/api/returns');
      if (res.ok) {
        const data = await res.json();
        setReturnsList(data);
      }
    } catch (err) {
      console.error('Failed to load returns', err);
    }
  };

  useEffect(() => {
    fetchReturns();
  }, []);

  const viewReturnDetail = async (id: number) => {
    try {
      const res = await fetch(`/api/returns/${id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedReturn(data);
        setIsDetailModalOpen(true);
      }
    } catch (err) {
      console.error('Failed to fetch return details', err);
    }
  };

  const handleSearchInvoice = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!invoiceQuery.trim()) return;
    setSearchingInvoice(true);
    setFoundInvoices([]);
    try {
      const res = await fetch('/api/invoices');
      if (res.ok) {
        const allInvs: any[] = await res.json();
        const q = invoiceQuery.toLowerCase().trim();
        const filtered = allInvs.filter(inv => 
          inv.invoice_number?.toLowerCase().includes(q) ||
          inv.customer_phone?.includes(q) ||
          inv.customer_name?.toLowerCase().includes(q)
        );
        setFoundInvoices(filtered);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSearchingInvoice(false);
    }
  };

  const selectInvoiceToReturn = async (inv: any) => {
    try {
      const res = await fetch(`/api/invoices/${inv.id}`);
      if (res.ok) {
        const fullInv = await res.json();
        setSelectedInvoiceForReturn(fullInv);
        const mappedItems: InvoiceItemForReturn[] = (fullInv.items || []).map((it: any) => ({
          ...it,
          returnQty: 0,
          restock: true
        }));
        setReturnItems(mappedItems);
        // Default refund method based on original payment
        if (fullInv.payment_method === 'credit') {
          setRefundMethod('credit_deduction');
        } else {
          setRefundMethod('cash');
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const updateItemReturnQty = (idx: number, qty: number) => {
    setReturnItems(prev => {
      const next = [...prev];
      const maxQty = next[idx].quantity;
      const clamped = Math.max(0, Math.min(qty, maxQty));
      next[idx] = { ...next[idx], returnQty: clamped };
      return next;
    });
  };

  const updateItemRestock = (idx: number, restock: boolean) => {
    setReturnItems(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], restock };
      return next;
    });
  };

  // Calculate total refund
  const calculatedRefundItems = returnItems.filter(it => it.returnQty > 0).map(it => {
    const ratio = it.returnQty / it.quantity;
    const itemRefund = it.line_total * ratio;
    const itemTaxable = it.taxable_value * ratio;
    const itemTax = (it.cgst_amount + it.sgst_amount + it.igst_amount) * ratio;
    return {
      product_id: it.product_id,
      product_name: it.product_name,
      quantity: it.returnQty,
      unit_price: it.unit_price,
      taxable_value: itemTaxable,
      gst_rate: it.gst_rate,
      tax_amount: itemTax,
      refund_amount: itemRefund,
      restock_to_inventory: it.restock
    };
  });

  const totalRefundAmount = calculatedRefundItems.reduce((sum, it) => sum + it.refund_amount, 0);

  const handleSubmitReturn = async (e: FormEvent) => {
    e.preventDefault();
    if (calculatedRefundItems.length === 0) {
      setFormError('Please enter return quantity for at least one item.');
      return;
    }

    setFormError(null);
    setIsSubmitting(true);

    try {
      const payload = {
        invoice_id: selectedInvoiceForReturn.id,
        invoice_number: selectedInvoiceForReturn.invoice_number,
        customer_id: selectedInvoiceForReturn.customer_id,
        customer_name: selectedInvoiceForReturn.customer_name,
        customer_phone: selectedInvoiceForReturn.customer_phone,
        refund_method: refundMethod,
        reason: returnReason === 'Other' ? (customReason || 'Other') : returnReason,
        processed_by: role === 'admin' ? 'Admin Desk' : 'Counter Cashier',
        items: calculatedRefundItems
      };

      const res = await fetch('/api/returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok) {
        setIsNewReturnModalOpen(false);
        setSelectedInvoiceForReturn(null);
        setInvoiceQuery('');
        setFoundInvoices([]);
        fetchReturns();
        // Open the newly created return for print
        if (data.return_id) {
          viewReturnDetail(data.return_id);
        }
      } else {
        setFormError(data.error || 'Failed to process return.');
      }
    } catch (err: any) {
      console.error(err);
      setFormError(err.message || 'Error processing return.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const exportPDF = (ret: ReturnDetail) => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('CREDIT NOTE / SALES RETURN', 14, 20);

    doc.setFontSize(10);
    doc.text(`Credit Note: ${ret.return_number}`, 14, 28);
    doc.text(`Original Invoice: ${ret.invoice_number}`, 14, 34);
    doc.text(`Date: ${format(new Date(ret.return_date), 'dd-MMM-yyyy hh:mm a')}`, 14, 40);

    doc.text(`Customer: ${ret.customer_name || 'Walk-in'}`, 120, 28);
    doc.text(`Phone: ${ret.customer_phone || 'N/A'}`, 120, 34);
    doc.text(`Refund Method: ${ret.refund_method.toUpperCase()}`, 120, 40);

    const tableRows = ret.items.map(item => [
      item.product_name,
      item.quantity,
      `₹${item.unit_price.toFixed(2)}`,
      `${item.gst_rate}%`,
      `₹${item.tax_amount.toFixed(2)}`,
      `₹${item.refund_amount.toFixed(2)}`
    ]);

    autoTable(doc, {
      startY: 48,
      head: [['Item Name', 'Qty', 'Rate', 'GST', 'Tax', 'Refund']],
      body: tableRows,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(11);
    doc.text(`Total Refund Amount: Rs. ${ret.total_refund_amount.toFixed(2)}`, 130, finalY);

    doc.save(`${ret.return_number}.pdf`);
  };

  const sendWhatsAppCreditNote = (ret: ReturnRecord) => {
    if (!ret.customer_phone) {
      alert('No customer phone number available.');
      return;
    }
    let cleanPhone = ret.customer_phone.replace(/[^0-9]/g, '');
    if (cleanPhone.length === 10) cleanPhone = `91${cleanPhone}`;
    const text = encodeURIComponent(
      `Dear ${ret.customer_name || 'Customer'},\n\n` +
      `Your Credit Note / Return Voucher *${ret.return_number}* for Invoice *${ret.invoice_number}* has been issued.\n` +
      `Total Refund Amount: *₹${ret.total_refund_amount.toFixed(2)}*\n` +
      `Refund Method: *${ret.refund_method.toUpperCase()}*\n\n` +
      `Thank you!`
    );
    window.open(`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${text}`, '_blank');
  };

  const filteredReturns = returnsList.filter(r => {
    const q = searchTerm.toLowerCase();
    return (
      r.return_number.toLowerCase().includes(q) ||
      r.invoice_number.toLowerCase().includes(q) ||
      (r.customer_name && r.customer_name.toLowerCase().includes(q)) ||
      (r.customer_phone && r.customer_phone.includes(q))
    );
  });

  const totalRefundsValue = returnsList.reduce((sum, r) => sum + (r.total_refund_amount || 0), 0);
  const totalReturnsCount = returnsList.length;

  return (
    <div className="flex-1 flex flex-col p-4 overflow-hidden">
      {/* Header Bar */}
      <div className="flex justify-between items-center mb-4 shrink-0">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <RotateCcw className="text-indigo-600" size={22} />
            Sales Returns & Credit Notes
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Process item returns, issue credit notes, restock inventory and handle refunds
          </p>
        </div>

        <button
          onClick={() => {
            setSelectedInvoiceForReturn(null);
            setInvoiceQuery('');
            setFoundInvoices([]);
            setFormError(null);
            setIsNewReturnModalOpen(true);
          }}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all uppercase tracking-wider"
        >
          <Plus size={14} /> Process Return
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-3 mb-4 shrink-0">
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Returns</p>
            <p className="text-xl font-mono font-bold text-slate-900 mt-0.5">{totalReturnsCount}</p>
          </div>
          <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <RotateCcw size={18} />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Refund Value</p>
            <p className="text-xl font-mono font-bold text-rose-600 mt-0.5">₹ {totalRefundsValue.toFixed(2)}</p>
          </div>
          <div className="w-9 h-9 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
            <IndianRupee size={18} />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">GST Credit Notes</p>
            <p className="text-xl font-mono font-bold text-emerald-600 mt-0.5">Automated</p>
          </div>
          <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 size={18} />
          </div>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex justify-between items-center mb-3 shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-2 text-slate-400" size={14} />
          <input
            type="text"
            placeholder="Search by Credit Note #, Invoice #, or Customer Phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs w-80 font-medium text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <span className="text-xs font-semibold text-slate-500">
          Showing {filteredReturns.length} records
        </span>
      </div>

      {/* Returns Table */}
      <div className="flex-1 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs flex flex-col">
        <div className="overflow-y-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10">
              <tr className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-2.5 px-3.5">Credit Note #</th>
                <th className="py-2.5 px-3.5">Original Inv #</th>
                <th className="py-2.5 px-3.5">Date & Time</th>
                <th className="py-2.5 px-3.5">Customer</th>
                <th className="py-2.5 px-3.5">Refund Method</th>
                <th className="py-2.5 px-3.5">Reason</th>
                <th className="py-2.5 px-3.5 text-right">Refund Amount</th>
                <th className="py-2.5 px-3.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
              {filteredReturns.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <RotateCcw size={32} className="mx-auto mb-2 text-slate-300 stroke-1" />
                    <p className="text-xs font-semibold text-slate-600">No return records found</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Click "Process Return" above to issue a new credit note.</p>
                  </td>
                </tr>
              ) : (
                filteredReturns.map((ret) => (
                  <tr key={ret.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-3.5 font-bold font-mono text-indigo-700">
                      {ret.return_number}
                    </td>
                    <td className="py-2.5 px-3.5 font-mono text-slate-600">
                      {ret.invoice_number}
                    </td>
                    <td className="py-2.5 px-3.5 text-slate-500 font-mono">
                      {ret.return_date ? format(new Date(ret.return_date), 'dd-MMM-yyyy HH:mm') : '-'}
                    </td>
                    <td className="py-2.5 px-3.5">
                      <div className="font-semibold text-slate-800">{ret.customer_name || 'Walk-in Customer'}</div>
                      {ret.customer_phone && (
                        <div className="text-[10px] text-slate-400 font-mono">{ret.customer_phone}</div>
                      )}
                    </td>
                    <td className="py-2.5 px-3.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        ret.refund_method === 'cash'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : ret.refund_method === 'credit_deduction'
                          ? 'bg-purple-50 text-purple-700 border border-purple-200'
                          : 'bg-blue-50 text-blue-700 border border-blue-200'
                      }`}>
                        {ret.refund_method === 'credit_deduction' ? 'Udhar Deducted' : ret.refund_method}
                      </span>
                    </td>
                    <td className="py-2.5 px-3.5 text-slate-600 truncate max-w-[150px]" title={ret.reason}>
                      {ret.reason || 'Customer Return'}
                    </td>
                    <td className="py-2.5 px-3.5 text-right font-bold text-rose-600 font-mono">
                      ₹ {ret.total_refund_amount.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3.5 text-center font-sans">
                      <div className="flex justify-center items-center gap-1">
                        <button
                          onClick={() => viewReturnDetail(ret.id)}
                          className="text-slate-500 hover:text-indigo-600 p-1 rounded hover:bg-indigo-50"
                          title="View Return Detail"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          onClick={() => window.open(`/print-return/${ret.id}`, '_blank')}
                          className="text-slate-500 hover:text-indigo-600 p-1 rounded hover:bg-indigo-50"
                          title="Print Thermal Credit Note"
                        >
                          <Printer size={14} />
                        </button>
                        {ret.customer_phone && (
                          <button
                            onClick={() => sendWhatsAppCreditNote(ret)}
                            className="text-emerald-600 hover:text-emerald-700 p-1 rounded hover:bg-emerald-50"
                            title="Send WhatsApp Credit Note"
                          >
                            <Send size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* NEW RETURN MODAL */}
      {isNewReturnModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-3.5 border-b border-slate-200 bg-slate-50">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <RotateCcw size={16} className="text-indigo-600" />
                Process Sales Return / Credit Note
              </h2>
              <button 
                onClick={() => setIsNewReturnModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 space-y-4 text-xs">
              {formError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 font-semibold rounded-lg flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* STEP 1: SELECT INVOICE */}
              {!selectedInvoiceForReturn ? (
                <div className="space-y-3">
                  <p className="font-bold text-slate-700 text-xs">Step 1: Locate Original Invoice</p>
                  <form onSubmit={handleSearchInvoice} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Enter Invoice Number (e.g. INV-000001) or Customer Mobile..."
                      value={invoiceQuery}
                      onChange={(e) => setInvoiceQuery(e.target.value)}
                      className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                    />
                    <button
                      type="submit"
                      disabled={searchingInvoice || !invoiceQuery.trim()}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <Search size={14} /> {searchingInvoice ? 'Searching...' : 'Find Bill'}
                    </button>
                  </form>

                  {foundInvoices.length > 0 && (
                    <div className="border border-slate-200 rounded-lg overflow-hidden mt-3">
                      <div className="bg-slate-50 px-3 py-1.5 font-bold text-[11px] text-slate-600 border-b border-slate-200">
                        Matching Invoices Found:
                      </div>
                      <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto">
                        {foundInvoices.map(inv => (
                          <div 
                            key={inv.id}
                            onClick={() => selectInvoiceToReturn(inv)}
                            className="p-3 hover:bg-indigo-50/60 cursor-pointer flex justify-between items-center transition-colors"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold font-mono text-indigo-700">{inv.invoice_number}</span>
                                <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">
                                  {inv.date ? format(new Date(inv.date), 'dd-MMM-yyyy') : ''}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 mt-0.5">
                                Customer: {inv.customer_name || 'Walk-in'} • Ph: {inv.customer_phone || 'N/A'}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold font-mono text-slate-900">₹ {Number(inv.grand_total).toFixed(2)}</p>
                              <span className="text-[10px] text-indigo-600 font-bold uppercase">Select & Continue →</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* STEP 2: SELECT ITEMS TO RETURN */
                <form onSubmit={handleSubmitReturn} className="space-y-4">
                  <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold font-mono text-indigo-700">{selectedInvoiceForReturn.invoice_number}</span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {format(new Date(selectedInvoiceForReturn.date), 'dd-MMM-yyyy')}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-0.5">
                        Customer: <span className="font-semibold">{selectedInvoiceForReturn.customer_name || 'Walk-in'}</span> {selectedInvoiceForReturn.customer_phone ? `(${selectedInvoiceForReturn.customer_phone})` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedInvoiceForReturn(null)}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1"
                    >
                      <ArrowLeft size={13} /> Change Invoice
                    </button>
                  </div>

                  <div>
                    <label className="block font-bold uppercase tracking-wider text-[11px] text-slate-700 mb-1.5">
                      Select Items & Quantities to Return
                    </label>
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                          <tr>
                            <th className="py-2 px-3">Item Name</th>
                            <th className="py-2 px-2 text-center">Billed Qty</th>
                            <th className="py-2 px-2 text-center">Return Qty</th>
                            <th className="py-2 px-2 text-center">Restock?</th>
                            <th className="py-2 px-3 text-right">Refund</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium">
                          {returnItems.map((item, idx) => {
                            const ratio = item.returnQty / item.quantity;
                            const itemRefund = item.line_total * ratio;
                            return (
                              <tr key={idx} className={item.returnQty > 0 ? 'bg-indigo-50/40' : ''}>
                                <td className="py-2.5 px-3">
                                  <div className="font-bold text-slate-800">{item.product_name}</div>
                                  <div className="text-[10px] text-slate-400 font-mono">₹{item.unit_price.toFixed(2)} ea • GST {item.gst_rate}%</div>
                                </td>
                                <td className="py-2.5 px-2 text-center font-mono font-semibold text-slate-600">
                                  {item.quantity}
                                </td>
                                <td className="py-2.5 px-2 text-center">
                                  <input
                                    type="number"
                                    min={0}
                                    max={item.quantity}
                                    value={item.returnQty}
                                    onChange={(e) => updateItemReturnQty(idx, Number(e.target.value))}
                                    className="w-16 px-2 py-1 text-center font-bold border border-slate-300 rounded text-xs focus:ring-1 focus:ring-indigo-500"
                                  />
                                </td>
                                <td className="py-2.5 px-2 text-center">
                                  <input
                                    type="checkbox"
                                    checked={item.restock}
                                    disabled={item.returnQty === 0}
                                    onChange={(e) => updateItemRestock(idx, e.target.checked)}
                                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                                    title="Restock back to inventory"
                                  />
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-600">
                                  ₹ {itemRefund.toFixed(2)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Return Details */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                        Refund Method *
                      </label>
                      <select
                        value={refundMethod}
                        onChange={(e) => setRefundMethod(e.target.value as any)}
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="cash">Cash Refund</option>
                        <option value="upi">UPI / Online Refund</option>
                        <option value="credit_deduction">Deduct from Customer Udhar (Credit)</option>
                        <option value="store_credit">Store Credit / Note</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                        Return Reason *
                      </label>
                      <select
                        value={returnReason}
                        onChange={(e) => setReturnReason(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="Customer Changed Mind">Customer Changed Mind</option>
                        <option value="Defective / Damaged Item">Defective / Damaged Item</option>
                        <option value="Wrong Item Supplied">Wrong Item Supplied</option>
                        <option value="Size / Model Issue">Size / Model Issue</option>
                        <option value="Other">Other Reason</option>
                      </select>
                    </div>
                  </div>

                  {returnReason === 'Other' && (
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                        Custom Reason Note
                      </label>
                      <input
                        type="text"
                        placeholder="Specify reason..."
                        value={customReason}
                        onChange={(e) => setCustomReason(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                      />
                    </div>
                  )}

                  {/* Summary & Settle */}
                  <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 flex justify-between items-center">
                    <div>
                      <p className="text-[11px] font-bold text-rose-800 uppercase tracking-wider">Total Refund Due</p>
                      <p className="text-[11px] text-rose-600">{calculatedRefundItems.length} item(s) being returned</p>
                    </div>
                    <p className="text-xl font-mono font-bold text-rose-700">₹ {totalRefundAmount.toFixed(2)}</p>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() => setIsNewReturnModalOpen(false)}
                      className="px-3.5 py-1.5 border border-slate-300 rounded-lg font-bold text-xs text-slate-700 hover:bg-slate-100 uppercase tracking-wider"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting || totalRefundAmount <= 0}
                      className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-xs shadow-sm uppercase tracking-wider disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <RotateCcw size={13} /> {isSubmitting ? 'Processing...' : 'Confirm Return & Issue Credit Note'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* DETAIL MODAL */}
      {isDetailModalOpen && selectedReturn && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center p-3.5 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2">
                <span className="font-bold text-indigo-700 font-mono text-sm">{selectedReturn.return_number}</span>
                <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-mono">
                  {format(new Date(selectedReturn.return_date), 'dd-MMM-yyyy HH:mm')}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => exportPDF(selectedReturn)}
                  className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded"
                  title="Download PDF"
                >
                  <FileSpreadsheet size={16} />
                </button>
                <button
                  onClick={() => window.open(`/print-return/${selectedReturn.id}`, '_blank')}
                  className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded"
                  title="Print Thermal Receipt"
                >
                  <Printer size={16} />
                </button>
                <button 
                  onClick={() => setIsDetailModalOpen(false)} 
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="p-4 overflow-y-auto flex-1 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200 text-[11px]">
                <div>
                  <span className="text-slate-400 block font-bold uppercase">Customer:</span>
                  <span className="font-bold text-slate-800">{selectedReturn.customer_name || 'Walk-in Customer'}</span>
                  {selectedReturn.customer_phone && <span className="block text-slate-500 font-mono">{selectedReturn.customer_phone}</span>}
                </div>
                <div>
                  <span className="text-slate-400 block font-bold uppercase">Original Invoice:</span>
                  <span className="font-mono font-bold text-indigo-600">{selectedReturn.invoice_number}</span>
                  <span className="block text-slate-500">Method: {selectedReturn.refund_method.toUpperCase()}</span>
                </div>
              </div>

              <div>
                <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden">
                  <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3">Item</th>
                      <th className="py-2 px-2 text-center">Qty</th>
                      <th className="py-2 px-2 text-right">Price</th>
                      <th className="py-2 px-2 text-center">Restocked</th>
                      <th className="py-2 px-3 text-right">Refund</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {selectedReturn.items.map((it, idx) => (
                      <tr key={idx}>
                        <td className="py-2 px-3">
                          <div className="font-bold text-slate-800">{it.product_name}</div>
                          {it.gst_rate > 0 && <div className="text-[10px] text-slate-400">GST {it.gst_rate}%</div>}
                        </td>
                        <td className="py-2 px-2 text-center font-bold font-mono">{it.quantity}</td>
                        <td className="py-2 px-2 text-right font-mono">₹{it.unit_price.toFixed(2)}</td>
                        <td className="py-2 px-2 text-center">
                          {it.restock_to_inventory ? (
                            <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-bold">Yes</span>
                          ) : (
                            <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">No</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-rose-600">
                          ₹{it.refund_amount.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 flex justify-between items-center">
                <span className="text-xs font-bold uppercase tracking-wider text-rose-900">Total Refund Issued:</span>
                <span className="text-lg font-mono font-bold text-rose-700">₹ {selectedReturn.total_refund_amount.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
