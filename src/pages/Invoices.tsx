import { useState, useEffect, FormEvent } from 'react';
import { 
  ReceiptText, Search, Printer, Eye, Edit, Calendar, 
  Send, FileSpreadsheet, CheckCircle2, X, Download, RotateCcw
} from 'lucide-react';
import { useNavigate } from 'react-router';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type Invoice = {
  id: number;
  invoice_number: string;
  date: string;
  customer_name: string;
  customer_phone: string;
  payment_method: string;
  payment_status: string;
  subtotal: number;
  discount: number;
  cgst_total: number;
  sgst_total: number;
  igst_total: number;
  grand_total: number;
  status: string;
  is_inter_state: number;
  cashier_name: string;
};

type InvoiceItem = {
  id: number;
  product_name: string;
  hsn_code: string;
  quantity: number;
  unit_price: number;
  discount: number;
  taxable_value: number;
  gst_rate: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  line_total: number;
};

type InvoiceDetail = Invoice & {
  items: InvoiceItem[];
};

export default function Invoices({ role = 'admin' }: { role?: 'admin' | 'cashier' | null }) {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceDetail | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({ id: 0, customer_name: '', customer_phone: '', payment_method: 'cash', payment_status: 'paid' });

  const openEditModal = (inv: Invoice) => {
    setEditForm({
      id: inv.id,
      customer_name: inv.customer_name || '',
      customer_phone: inv.customer_phone || '',
      payment_method: inv.payment_method || 'cash',
      payment_status: inv.payment_status || 'paid'
    });
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/invoices/${editForm.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      });
      if (res.ok) {
        setIsEditModalOpen(false);
        fetchInvoices();
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    try {
      const res = await fetch('/api/invoices');
      const data = await res.json();
      setInvoices(data);
    } catch (err) {
      console.error(err);
    }
  };

  const viewInvoiceDetail = async (id: number) => {
    try {
      const res = await fetch(`/api/invoices/${id}`);
      const data = await res.json();
      setSelectedInvoice(data);
      setIsDetailModalOpen(true);
    } catch (err) {
      console.error(err);
    }
  };

  const downloadInvoicePDF = async (inv: Invoice) => {
    try {
      const res = await fetch(`/api/invoices/${inv.id}`);
      if (!res.ok) throw new Error('Failed to fetch invoice details');
      const invoiceData: InvoiceDetail = await res.json();
      
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      
      doc.setFontSize(20);
      doc.text('TAX INVOICE', pageWidth / 2, 20, { align: 'center' });
      
      doc.setFontSize(10);
      doc.text(`Invoice No: ${invoiceData.invoice_number}`, 14, 35);
      doc.text(`Date: ${format(new Date(invoiceData.date), 'dd-MMM-yyyy')}`, 14, 42);
      
      doc.text(`Customer Name: ${invoiceData.customer_name || 'Walk-in'}`, 140, 35);
      doc.text(`Mobile: ${invoiceData.customer_phone || 'N/A'}`, 140, 42);
      
      const tableData = invoiceData.items.map((item, index) => [
        index + 1,
        item.product_name,
        item.quantity,
        item.unit_price.toFixed(2),
        item.taxable_value.toFixed(2),
        item.gst_rate + '%',
        item.line_total.toFixed(2)
      ]);
      
      autoTable(doc, {
        startY: 50,
        head: [['#', 'Item', 'Qty', 'Rate', 'Taxable', 'GST%', 'Total']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229] },
      });
      
      const finalY = (doc as any).lastAutoTable.finalY || 50;
      doc.setFontSize(12);
      doc.text(`Subtotal: Rs. ${invoiceData.subtotal.toFixed(2)}`, 140, finalY + 10);
      const totalGst = (invoiceData.cgst_total || 0) + (invoiceData.sgst_total || 0) + (invoiceData.igst_total || 0);
      doc.text(`Total GST: Rs. ${totalGst.toFixed(2)}`, 140, finalY + 18);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text(`Grand Total: Rs. ${invoiceData.grand_total.toFixed(2)}`, 140, finalY + 28);
      
      doc.save(`${invoiceData.invoice_number}.pdf`);
    } catch (err) {
      console.error(err);
      alert('Error generating PDF');
    }
  };

  const sendWhatsAppBill = async (inv: Invoice) => {
    const phone = (inv.customer_phone || '').replace(/[^0-9]/g, '');
    if (!phone) {
      alert('No customer phone number available for this invoice.');
      return;
    }
    
    await downloadInvoicePDF(inv);

    const text = encodeURIComponent(
      `Tax Invoice: ${inv.invoice_number}\n` +
      `Date: ${format(new Date(inv.date), 'dd-MMM-yyyy')}\n` +
      `Customer: ${inv.customer_name || 'Walk-in'}\n` +
      `Grand Total: Rs. ${inv.grand_total.toFixed(2)}\n` +
      `Payment Mode: ${inv.payment_method.toUpperCase()}\n\n` +
      `Please find the PDF attached (Downloaded to your device). Thank you for shopping with us!`
    );
    window.open(`https://api.whatsapp.com/send?phone=${phone}&text=${text}`, '_blank');
  };

  const cancelInvoice = async (invoiceId: number, invoiceNum: string) => {
    if (!confirm(`Are you sure you want to CANCEL invoice ${invoiceNum}?\n\nThis will mark it as cancelled and restore the stock of all items to inventory. This cannot be undone.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/invoices/${invoiceId}/cancel`, {
        method: 'POST'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to cancel invoice');
      alert('Invoice cancelled successfully and stock restored.');
      fetchInvoices();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const filteredInvoices = invoices.filter(inv => 
    inv.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (inv.customer_name && inv.customer_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (inv.customer_phone && inv.customer_phone.includes(searchTerm))
  );

  return (
    <div className="p-5 max-w-7xl mx-auto w-full flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Invoice History & Registers</h2>
            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[11px] font-mono font-bold rounded">
              {invoices.length} Bills
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">Sequential, non-editable GST tax invoices with thermal reprint and WhatsApp sharing</p>
        </div>

        <div className="relative">
          <Search className="absolute left-2.5 top-2 text-slate-400" size={14} />
          <input
            type="text"
            placeholder="Search by Invoice #, Customer, Mobile..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 w-72 shadow-2xs"
          />
        </div>
      </div>

      {/* Invoice Table */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden flex-1 flex flex-col">
        <div className="overflow-auto flex-1">
          <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider sticky top-0 z-10 border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3.5 w-10">#</th>
                <th className="py-2.5 px-3.5">Invoice No.</th>
                <th className="py-2.5 px-3.5">Date & Time</th>
                <th className="py-2.5 px-3.5">Customer Details</th>
                <th className="py-2.5 px-3.5">Payment Mode</th>
                <th className="py-2.5 px-3.5 text-right">Taxable Subtotal</th>
                <th className="py-2.5 px-3.5 text-right">GST Total</th>
                <th className="py-2.5 px-3.5 text-right">Grand Total (₹)</th>
                <th className="py-2.5 px-3.5 text-center w-28">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100 font-mono text-xs">
              {filteredInvoices.map((inv, idx) => {
                const totalGst = (inv.cgst_total || 0) + (inv.sgst_total || 0) + (inv.igst_total || 0);
                return (
                  <tr key={inv.id} className={idx % 2 === 1 ? 'bg-indigo-50/20' : 'hover:bg-slate-50/80 transition-colors'}>
                    <td className="py-2.5 px-3.5 text-slate-400">{idx + 1}</td>
                    <td className="py-2.5 px-3.5 font-bold text-indigo-700 font-mono">
                      <div className="flex flex-col gap-0.5">
                        <span>{inv.invoice_number}</span>
                        {inv.status === 'cancelled' && (
                          <span className="w-fit px-1.5 py-[1px] bg-rose-100 text-rose-700 text-[9px] uppercase font-black rounded tracking-wider">Cancelled</span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-3.5 text-slate-600 font-sans">
                      {format(new Date(inv.date), 'dd-MMM-yyyy HH:mm')}
                    </td>
                    <td className="py-2.5 px-3.5 font-sans">
                      <div className="font-semibold text-slate-900 leading-tight">
                        {inv.customer_name || 'Walk-in Customer'}
                      </div>
                      {inv.customer_phone && (
                        <div className="text-[10px] text-slate-500 font-mono">{inv.customer_phone}</div>
                      )}
                    </td>
                    <td className="py-2.5 px-3.5 font-sans">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        inv.payment_method === 'cash' 
                          ? 'bg-slate-100 text-slate-800'
                          : inv.payment_method === 'upi'
                          ? 'bg-indigo-100 text-indigo-800'
                          : inv.payment_method === 'credit'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {inv.payment_method === 'credit' ? 'Udhar' : inv.payment_method}
                      </span>
                    </td>
                    <td className="py-2.5 px-3.5 text-right text-slate-700">
                      <span className={inv.status === 'cancelled' ? 'line-through opacity-50' : ''}>₹ {inv.subtotal.toFixed(2)}</span>
                    </td>
                    <td className="py-2.5 px-3.5 text-right text-slate-500">
                      <span className={inv.status === 'cancelled' ? 'line-through opacity-50' : ''}>₹ {totalGst.toFixed(2)}</span>
                    </td>
                    <td className="py-2.5 px-3.5 text-right font-bold text-slate-900 text-sm">
                      <span className={inv.status === 'cancelled' ? 'line-through opacity-50 text-slate-400' : ''}>₹ {inv.grand_total.toFixed(2)}</span>
                    </td>
                    <td className="py-2.5 px-3.5 text-center font-sans">
                      <div className="flex justify-center items-center gap-1">
                        {role === 'admin' && inv.status !== 'cancelled' && (
                          <button
                            onClick={() => cancelInvoice(inv.id, inv.invoice_number)}
                            className="text-slate-500 hover:text-rose-600 p-1 rounded hover:bg-rose-50"
                            title="Cancel Invoice & Restore Stock"
                          >
                            <X size={14} />
                          </button>
                        )}
                        {role === 'admin' && (
                          <button
                            onClick={() => openEditModal(inv)}
                            className="text-slate-500 hover:text-indigo-600 p-1 rounded hover:bg-indigo-50"
                            title="Edit Invoice Details"
                          >
                            <Edit size={14} />
                          </button>
                        )}
                        <button
                          onClick={() => viewInvoiceDetail(inv.id)}
                          className="text-slate-500 hover:text-indigo-600 p-1 rounded hover:bg-indigo-50"
                          title="View Invoice Detail"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          onClick={() => window.open(`/print/${inv.id}`, '_blank')}
                          className="text-slate-500 hover:text-slate-900 p-1 rounded hover:bg-slate-100"
                          title="Print Thermal 80mm Receipt"
                        >
                          <Printer size={14} />
                        </button>
                        <button
                          onClick={() => navigate('/returns')}
                          className="text-slate-500 hover:text-rose-600 p-1 rounded hover:bg-rose-50"
                          title="Process Return / Credit Note"
                        >
                          <RotateCcw size={14} />
                        </button>
                        <button
                          onClick={() => downloadInvoicePDF(inv)}
                          className="text-slate-500 hover:text-rose-600 p-1 rounded hover:bg-rose-50"
                          title="Download A4 PDF"
                        >
                          <Download size={14} />
                        </button>
                        {inv.customer_phone && (
                          <button
                            onClick={() => sendWhatsAppBill(inv)}
                            className="text-emerald-600 hover:text-emerald-700 p-1 rounded hover:bg-emerald-50"
                            title="Share on WhatsApp"
                          >
                            <Send size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredInvoices.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-16 text-slate-400 font-sans">
                    <ReceiptText size={32} className="mx-auto mb-2 text-slate-300 stroke-1" />
                    <p className="text-xs font-semibold text-slate-600">No invoices found matching criteria</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invoice Details Modal */}
      {isDetailModalOpen && selectedInvoice && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-2xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-100">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col border border-slate-200 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{selectedInvoice.invoice_number}</h3>
                  <p className="text-[11px] text-slate-500 font-mono">
                    {format(new Date(selectedInvoice.date), 'dd-MMM-yyyy | HH:mm:ss')} • Billed by {selectedInvoice.cashier_name || 'Admin'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => downloadInvoicePDF(selectedInvoice as Invoice)}
                  className="px-3 py-1 bg-rose-600 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-2xs hover:bg-rose-700 uppercase tracking-wide"
                >
                  <Download size={13} /> PDF
                </button>
                <button
                  onClick={() => window.open(`/print/${selectedInvoice.id}`, '_blank')}
                  className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-2xs hover:bg-indigo-700 uppercase tracking-wide"
                >
                  <Printer size={13} /> Print 80mm
                </button>
                <button onClick={() => setIsDetailModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="p-5 overflow-y-auto flex-1 text-xs space-y-4">
              {/* Customer Box */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 grid grid-cols-3 gap-2">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Customer</span>
                  <span className="font-bold text-slate-900">{selectedInvoice.customer_name || 'Walk-in'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Phone</span>
                  <span className="font-mono text-slate-800">{selectedInvoice.customer_phone || '—'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Payment Mode</span>
                  <span className="font-bold text-indigo-700 uppercase">{selectedInvoice.payment_method}</span>
                </div>
              </div>

              {/* Items Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider">
                    <tr>
                      <th className="py-2 px-3">Item Description</th>
                      <th className="py-2 px-3 text-right">HSN</th>
                      <th className="py-2 px-3 text-right">Qty</th>
                      <th className="py-2 px-3 text-right">Rate (₹)</th>
                      <th className="py-2 px-3 text-right">Taxable</th>
                      <th className="py-2 px-3 text-right">GST %</th>
                      <th className="py-2 px-3 text-right">Total (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-xs">
                    {selectedInvoice.items?.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-sans font-semibold text-slate-900">{item.product_name}</td>
                        <td className="py-2 px-3 text-right text-slate-500">{item.hsn_code || '—'}</td>
                        <td className="py-2 px-3 text-right font-bold text-slate-900">{item.quantity}</td>
                        <td className="py-2 px-3 text-right text-slate-700">{item.unit_price.toFixed(2)}</td>
                        <td className="py-2 px-3 text-right text-slate-700">{item.taxable_value.toFixed(2)}</td>
                        <td className="py-2 px-3 text-right text-slate-600">{item.gst_rate}%</td>
                        <td className="py-2 px-3 text-right font-bold text-slate-900">{item.line_total.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Summary Calculation */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex justify-between items-center">
                <div className="text-slate-600">
                  <span>Type: </span>
                  <span className="font-bold text-slate-900 font-mono">
                    {selectedInvoice.is_inter_state ? 'Inter-state IGST' : 'Intra-state (CGST + SGST)'}
                  </span>
                </div>
                <div className="space-y-1 text-right font-mono">
                  <div className="text-slate-600">Taxable Value: ₹{selectedInvoice.subtotal.toFixed(2)}</div>
                  {selectedInvoice.is_inter_state ? (
                    <div className="text-slate-600">IGST: ₹{selectedInvoice.igst_total.toFixed(2)}</div>
                  ) : (
                    <div className="text-slate-600">
                      CGST: ₹{selectedInvoice.cgst_total.toFixed(2)} | SGST: ₹{selectedInvoice.sgst_total.toFixed(2)}
                    </div>
                  )}
                  <div className="text-sm font-bold text-indigo-700 pt-1 border-t border-slate-200">
                    Grand Total: ₹{selectedInvoice.grand_total.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Invoice Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-2xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-100">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md border border-slate-200 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900">Edit Invoice Info</h3>
              <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="p-5 space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Customer Name
                </label>
                <input
                  type="text"
                  value={editForm.customer_name}
                  onChange={e => setEditForm({ ...editForm, customer_name: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Customer Phone
                </label>
                <input
                  type="text"
                  value={editForm.customer_phone}
                  onChange={e => setEditForm({ ...editForm, customer_phone: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Payment Method
                </label>
                <select
                  value={editForm.payment_method}
                  onChange={e => setEditForm({ ...editForm, payment_method: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                >
                  <option value="cash">Cash</option>
                  <option value="upi">UPI / Online</option>
                  <option value="credit">Udhar / Credit</option>
                  <option value="card">Card</option>
                </select>
              </div>
              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full bg-indigo-600 text-white rounded-lg py-2 font-bold text-xs hover:bg-indigo-700 shadow-md transition-colors uppercase tracking-wider"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
