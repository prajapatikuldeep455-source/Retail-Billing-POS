import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { format } from 'date-fns';
import Barcode from 'react-barcode';

type InvoiceDetails = {
  id: number;
  invoice_number: string;
  date: string;
  customer_name: string;
  customer_phone: string;
  payment_method: string;
  subtotal: number;
  discount: number;
  cgst_total: number;
  sgst_total: number;
  igst_total: number;
  grand_total: number;
  is_inter_state: number;
  cashier_name?: string;
  items: Array<{
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
  }>;
};

export default function InvoicePrint() {
  const { id } = useParams();
  const [invoice, setInvoice] = useState<InvoiceDetails | null>(null);
  const [settings, setSettings] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(setSettings)
      .catch(console.error);

    if (id) {
      fetch(`/api/invoices/${id}`)
        .then(res => res.json())
        .then(data => {
          setInvoice(data);
          setTimeout(() => {
            window.print();
          }, 500);
        })
        .catch(console.error);
    }
  }, [id]);

  if (!invoice) {
    return (
      <div className="p-8 text-center font-mono text-xs text-slate-500">
        Loading Tax Invoice #{id}...
      </div>
    );
  }

  return (
    <div className="w-[80mm] mx-auto p-4 bg-white text-black font-mono text-xs leading-tight" style={{ minHeight: '100vh' }}>
      <div className="text-center mb-3 flex flex-col items-center">
        {settings.shop_logo && (
          <img src={settings.shop_logo} alt="Store Logo" className="max-w-[40mm] max-h-[30mm] object-contain mb-2 grayscale" style={{ filter: 'grayscale(100%) contrast(1.5)' }} />
        )}
        <h1 className="text-base font-bold uppercase tracking-tight mb-0.5">
          {settings.shop_name || 'AMAN ELECTRONICS & RETAIL'}
        </h1>
        <p className="text-[10px]">{settings.shop_address || '123 Commercial Plaza, Main Market, Mumbai, MH'}</p>
        <p className="text-[10px] font-bold">GSTIN: {settings.shop_gstin || '27AAAAA0000A1Z5'}</p>
        <p className="text-[10px]">Ph: {settings.shop_phone || '+91-9876543210'}</p>
        <div className="border-b border-dashed border-black my-2"></div>
        <h2 className="text-sm font-bold tracking-wider">TAX INVOICE</h2>
      </div>

      <div className="mb-2 space-y-0.5 text-[11px]">
        <div className="flex justify-between">
          <span className="font-bold">INV NO: {invoice.invoice_number}</span>
          <span>{format(new Date(invoice.date), 'dd/MM/yy HH:mm')}</span>
        </div>
        <div className="flex justify-between text-[10px] text-gray-700">
          <span>POS: Counter-01</span>
          <span>Cashier: {invoice.cashier_name || 'Admin'}</span>
        </div>
        {(invoice.customer_name || invoice.customer_phone) && (
          <div className="mt-1 pt-1 border-t border-dashed border-gray-400">
            {invoice.customer_name && <p>Cust: <span className="font-bold">{invoice.customer_name}</span></p>}
            {invoice.customer_phone && <p>Ph: {invoice.customer_phone}</p>}
          </div>
        )}
      </div>

      <div className="border-t border-b border-black py-1 mb-2 font-bold flex text-[10px] uppercase">
        <div className="flex-1">Item Description</div>
        <div className="w-8 text-right">Qty</div>
        <div className="w-12 text-right">Rate</div>
        <div className="w-14 text-right">Amount</div>
      </div>

      <div className="mb-2 space-y-1.5 text-[11px]">
        {invoice.items?.map((item, idx) => (
          <div key={idx} className="flex flex-col">
            <div className="font-bold leading-none">{item.product_name}</div>
            <div className="flex text-[9px] text-gray-700 mt-0.5">
              <span className="flex-1">HSN: {item.hsn_code || '—'} | GST {item.gst_rate}%</span>
              {item.discount > 0 && <span className="text-right">Disc: -₹{item.discount}</span>}
            </div>
            <div className="flex text-[11px] mt-0.5">
              <div className="flex-1"></div>
              <div className="w-8 text-right">{item.quantity}</div>
              <div className="w-12 text-right font-mono">{item.unit_price.toFixed(2)}</div>
              <div className="w-14 text-right font-bold font-mono">{item.line_total.toFixed(2)}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-black pt-1.5 mb-3 text-[11px] space-y-0.5">
        <div className="flex justify-between">
          <span>Subtotal (Gross):</span>
          <span className="font-mono">₹{invoice.subtotal.toFixed(2)}</span>
        </div>
        {invoice.discount > 0 && (
          <>
            <div className="flex justify-between">
              <span>Total Discount:</span>
              <span className="font-mono">-₹{invoice.discount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold">
              <span>Taxable Amount:</span>
              <span className="font-mono">₹{(invoice.subtotal - invoice.discount).toFixed(2)}</span>
            </div>
          </>
        )}
        {invoice.is_inter_state === 1 ? (
          <div className="flex justify-between">
            <span>IGST Total:</span>
            <span className="font-mono">₹{invoice.igst_total.toFixed(2)}</span>
          </div>
        ) : (
          <>
            <div className="flex justify-between text-[10px]">
              <span>CGST Total:</span>
              <span className="font-mono">₹{invoice.cgst_total.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span>SGST Total:</span>
              <span className="font-mono">₹{invoice.sgst_total.toFixed(2)}</span>
            </div>
          </>
        )}
        <div className="flex justify-between font-bold text-sm mt-1.5 pt-1.5 border-t border-black">
          <span>GRAND TOTAL:</span>
          <span className="font-mono">₹{invoice.grand_total.toFixed(2)}</span>
        </div>
      </div>

      <div className="border-t border-dashed border-black pt-2 text-center text-[10px] space-y-0.5">
        <p>Payment Mode: <span className="uppercase font-bold">{invoice.payment_method}</span></p>
        <p className="font-bold mt-2">Thank you for your visit!</p>
        <p className="text-[9px] text-gray-600">
          {settings.receipt_footer || 'Goods once sold cannot be returned without original tax bill.'}
        </p>
        <p className="text-[8px] text-gray-500 mt-1 font-mono">** Computer Generated Tax Invoice **</p>
      </div>
      
      <style>{`
        @media print {
          @page { margin: 0; size: 80mm 297mm; }
          body { margin: 0; padding: 0; }
        }
      `}</style>
    </div>
  );
}
