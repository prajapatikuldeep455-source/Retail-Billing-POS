import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { format } from 'date-fns';
import Barcode from 'react-barcode';
import { QRCodeSVG } from 'qrcode.react';

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

// Convert number to Indian words for amount in words on invoice
function numberToWords(num: number): string {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  if (num === 0) return 'Zero';
  
  const intPart = Math.floor(num);
  const decPart = Math.round((num - intPart) * 100);

  function convert(n: number): string {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convert(n % 100) : '');
    if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convert(n % 1000) : '');
    if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + convert(n % 100000) : '');
    return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + convert(n % 10000000) : '');
  }

  let result = 'Rupees ' + convert(intPart);
  if (decPart > 0) {
    result += ' and ' + convert(decPart) + ' Paise';
  }
  return result + ' Only';
}

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
        .then(async res => {
          if (!res.ok) return;
          const data = await res.json();
          if (data && data.invoice_number) {
            setInvoice(data);
            setTimeout(() => {
              window.print();
            }, 500);
          }
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

  // Build UPI deep link for QR code payment
  const upiId = settings.shop_upi_id;
  const upiName = settings.shop_upi_name || settings.shop_name || 'Merchant';
  const upiLink = upiId
    ? `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(upiName)}&am=${invoice.grand_total.toFixed(2)}&cu=INR&tn=${encodeURIComponent('INV ' + invoice.invoice_number)}`
    : '';

  // Count total items & total quantity
  const totalItems = invoice.items?.length || 0;
  const totalQty = invoice.items?.reduce((sum, item) => sum + item.quantity, 0) || 0;

  return (
    <div className="w-[80mm] mx-auto p-3 bg-white text-black font-mono text-xs leading-tight" style={{ minHeight: '100vh' }}>
      {/* ─── Store Header ─── */}
      <div className="text-center mb-2 flex flex-col items-center">
        {settings.shop_logo && (
          <img src={settings.shop_logo} alt="Store Logo" className="max-w-[35mm] max-h-[25mm] object-contain mb-1.5 grayscale" style={{ filter: 'grayscale(100%) contrast(1.5)' }} />
        )}
        <h1 className="text-sm font-bold uppercase tracking-tight mb-0.5">
          {settings.shop_name || 'RETAIL POS'}
        </h1>
        <p className="text-[9px] leading-snug">{settings.shop_address || ''}</p>
        {settings.shop_gstin && <p className="text-[9px] font-bold">GSTIN: {settings.shop_gstin}</p>}
        {settings.shop_phone && <p className="text-[9px]">Ph: {settings.shop_phone}</p>}
      </div>

      {/* ─── Title ─── */}
      <div className="border-y border-black py-0.5 text-center mb-2">
        <h2 className="text-xs font-bold tracking-wider uppercase">TAX INVOICE</h2>
      </div>

      {/* ─── Invoice Meta ─── */}
      <div className="mb-2 space-y-0.5 text-[10px]">
        <div className="flex justify-between">
          <span className="font-bold">INV: {invoice.invoice_number}</span>
          <span>{format(new Date(invoice.date), 'dd/MM/yy HH:mm')}</span>
        </div>
        <div className="flex justify-between text-[9px] text-gray-700">
          <span>POS: Counter-01</span>
          <span>Cashier: {invoice.cashier_name || 'Admin'}</span>
        </div>
        {(invoice.customer_name || invoice.customer_phone) && (
          <div className="mt-1 pt-1 border-t border-dashed border-gray-400 text-[10px]">
            {invoice.customer_name && <p>Cust: <span className="font-bold">{invoice.customer_name}</span></p>}
            {invoice.customer_phone && <p>Ph: {invoice.customer_phone}</p>}
          </div>
        )}
      </div>

      {/* ─── Items Table Header ─── */}
      <div className="border-t border-b border-black py-0.5 mb-1 font-bold flex text-[9px] uppercase">
        <div className="w-4 text-center">#</div>
        <div className="flex-1 pl-1">Item</div>
        <div className="w-7 text-right">Qty</div>
        <div className="w-12 text-right">Rate</div>
        <div className="w-14 text-right">Amt</div>
      </div>

      {/* ─── Items ─── */}
      <div className="mb-1 space-y-1 text-[10px]">
        {invoice.items?.map((item, idx) => (
          <div key={idx} className="flex flex-col">
            <div className="flex items-start">
              <div className="w-4 text-center text-[9px] text-gray-600">{idx + 1}</div>
              <div className="flex-1 pl-1">
                <div className="font-bold leading-none text-[10px]">{item.product_name}</div>
                <div className="flex text-[8px] text-gray-600 mt-0.5 gap-1">
                  <span>HSN:{item.hsn_code || '—'}</span>
                  <span>GST:{item.gst_rate}%</span>
                  {item.discount > 0 && <span>Disc:-₹{item.discount}</span>}
                </div>
              </div>
              <div className="w-7 text-right">{item.quantity}</div>
              <div className="w-12 text-right">{item.unit_price.toFixed(2)}</div>
              <div className="w-14 text-right font-bold">{item.line_total.toFixed(2)}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ─── Item Count Summary ─── */}
      <div className="border-t border-dashed border-black pt-0.5 mb-1 flex justify-between text-[9px] text-gray-700">
        <span>Total Items: {totalItems}</span>
        <span>Total Qty: {totalQty}</span>
      </div>

      {/* ─── Totals ─── */}
      <div className="border-t border-black pt-1 mb-2 text-[10px] space-y-0.5">
        <div className="flex justify-between">
          <span>Subtotal:</span>
          <span>₹{invoice.subtotal.toFixed(2)}</span>
        </div>
        {invoice.discount > 0 && (
          <>
            <div className="flex justify-between">
              <span>Discount:</span>
              <span>-₹{invoice.discount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold">
              <span>Taxable Amt:</span>
              <span>₹{(invoice.subtotal - invoice.discount).toFixed(2)}</span>
            </div>
          </>
        )}
        {invoice.is_inter_state === 1 ? (
          <div className="flex justify-between">
            <span>IGST:</span>
            <span>₹{invoice.igst_total.toFixed(2)}</span>
          </div>
        ) : (
          <>
            <div className="flex justify-between text-[9px]">
              <span>CGST:</span>
              <span>₹{invoice.cgst_total.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-[9px]">
              <span>SGST:</span>
              <span>₹{invoice.sgst_total.toFixed(2)}</span>
            </div>
          </>
        )}
        <div className="flex justify-between font-bold text-sm mt-1 pt-1 border-t border-double border-black">
          <span>GRAND TOTAL:</span>
          <span>₹{invoice.grand_total.toFixed(2)}</span>
        </div>
      </div>

      {/* ─── Amount in Words ─── */}
      <div className="text-[8px] text-gray-700 italic mb-2 border-b border-dashed border-gray-400 pb-1">
        {numberToWords(invoice.grand_total)}
      </div>

      {/* ─── Payment & UPI QR ─── */}
      <div className="text-center text-[10px] mb-2">
        <p>Payment: <span className="uppercase font-bold">{invoice.payment_method}</span></p>
      </div>

      {upiLink && invoice.payment_method !== 'credit' && (
        <div className="flex flex-col items-center mb-2 border border-dashed border-gray-400 rounded p-2">
          <p className="text-[8px] font-bold uppercase tracking-wider text-gray-700 mb-1">Scan to Pay via UPI</p>
          <QRCodeSVG value={upiLink} size={100} level="M" />
          <p className="text-[8px] text-gray-500 mt-1">{upiId}</p>
        </div>
      )}

      {/* ─── Invoice Barcode ─── */}
      <div className="flex justify-center mb-2">
        <Barcode
          value={invoice.invoice_number}
          width={1.2}
          height={30}
          fontSize={8}
          displayValue={true}
          margin={0}
        />
      </div>

      {/* ─── Footer ─── */}
      <div className="border-t border-dashed border-black pt-1.5 text-center text-[9px] space-y-0.5">
        <p className="font-bold">Thank you for your visit!</p>
        <p className="text-[8px] text-gray-600">
          {settings.receipt_footer || 'Goods once sold cannot be returned without original tax bill.'}
        </p>
        <p className="text-[7px] text-gray-500 mt-1">** Computer Generated Tax Invoice **</p>
      </div>
      
      <style>{`
        @media print {
          @page { margin: 0; size: 80mm auto; }
          body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </div>
  );
}
