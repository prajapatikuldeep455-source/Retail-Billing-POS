import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { format } from 'date-fns';
import Barcode from 'react-barcode';

type ReturnDetails = {
  id: number;
  return_number: string;
  invoice_number: string;
  customer_name: string;
  customer_phone: string;
  return_date: string;
  total_refund_amount: number;
  refund_method: string;
  reason: string;
  processed_by: string;
  items: Array<{
    id: number;
    product_name: string;
    quantity: number;
    unit_price: number;
    gst_rate: number;
    tax_amount: number;
    refund_amount: number;
    restock_to_inventory: number;
  }>;
};

export default function ReturnPrint() {
  const { id } = useParams();
  const [returnDoc, setReturnDoc] = useState<ReturnDetails | null>(null);
  const [settings, setSettings] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(setSettings)
      .catch(console.error);

    if (id) {
      fetch(`/api/returns/${id}`)
        .then(async res => {
          if (!res.ok) return;
          const data = await res.json();
          if (data && data.return_number) {
            setReturnDoc(data);
            setTimeout(() => {
              window.print();
            }, 500);
          }
        })
        .catch(console.error);
    }
  }, [id]);

  if (!returnDoc) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white text-slate-500 font-mono text-sm">
        Loading Credit Note / Return Voucher...
      </div>
    );
  }

  const formattedDate = returnDoc.return_date 
    ? format(new Date(returnDoc.return_date), 'dd/MM/yyyy hh:mm a') 
    : '';

  return (
    <div className="w-[80mm] mx-auto p-3 bg-white text-black font-mono text-xs leading-tight" style={{ minHeight: '100vh' }}>
      {/* ─── Store Header ─── */}
      <div className="text-center mb-2">
        <h1 className="text-sm font-bold uppercase tracking-tight">{settings.shop_name || 'RETAIL POS'}</h1>
        {settings.shop_address && <p className="text-[9px] leading-snug">{settings.shop_address}</p>}
        {settings.shop_phone && <p className="text-[9px]">Tel: {settings.shop_phone}</p>}
        {settings.shop_gstin && <p className="text-[9px] font-bold">GSTIN: {settings.shop_gstin}</p>}
      </div>

      {/* ─── Title ─── */}
      <div className="border-y border-black py-0.5 text-center mb-2 bg-black text-white">
        <h2 className="text-[10px] font-bold tracking-wider uppercase">CREDIT NOTE / RETURN VOUCHER</h2>
      </div>

      {/* ─── Voucher Meta ─── */}
      <div className="text-[10px] border-b border-dashed border-black pb-2 mb-2 space-y-0.5">
        <div className="flex justify-between font-bold">
          <span>CN No:</span>
          <span>{returnDoc.return_number}</span>
        </div>
        <div className="flex justify-between">
          <span>Orig. Invoice:</span>
          <span className="font-bold">{returnDoc.invoice_number}</span>
        </div>
        <div className="flex justify-between">
          <span>Date:</span>
          <span>{formattedDate}</span>
        </div>
        <div className="flex justify-between">
          <span>Customer:</span>
          <span>{returnDoc.customer_name || 'Walk-in'}</span>
        </div>
        {returnDoc.customer_phone && (
          <div className="flex justify-between">
            <span>Mobile:</span>
            <span>{returnDoc.customer_phone}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span>By:</span>
          <span>{returnDoc.processed_by || 'Admin'}</span>
        </div>
        <div className="flex justify-between">
          <span>Reason:</span>
          <span>{returnDoc.reason || 'Customer Return'}</span>
        </div>
      </div>

      {/* ─── Items Table ─── */}
      <div className="border-b border-dashed border-black pb-2 mb-2">
        <table className="w-full text-left text-[10px]">
          <thead>
            <tr className="border-b border-black text-[9px] font-bold uppercase">
              <th className="py-0.5 w-4 text-center">#</th>
              <th className="py-0.5">Item</th>
              <th className="py-0.5 text-center w-7">Qty</th>
              <th className="py-0.5 text-right w-12">Price</th>
              <th className="py-0.5 text-right w-14">Refund</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dotted divide-gray-400">
            {returnDoc.items.map((item, idx) => (
              <tr key={idx}>
                <td className="py-0.5 text-center text-[9px] text-gray-600">{idx + 1}</td>
                <td className="py-0.5 pr-1">
                  <div className="font-bold text-[10px]">{item.product_name}</div>
                  <div className="text-[8px] text-gray-600 flex gap-1">
                    {item.gst_rate > 0 && <span>GST:{item.gst_rate}%</span>}
                    {item.restock_to_inventory === 1 && <span>✓Restocked</span>}
                  </div>
                </td>
                <td className="py-0.5 text-center font-bold">{item.quantity}</td>
                <td className="py-0.5 text-right">₹{item.unit_price.toFixed(2)}</td>
                <td className="py-0.5 text-right font-bold">₹{item.refund_amount.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ─── Refund Summary ─── */}
      <div className="text-[10px] space-y-0.5 border-b border-dashed border-black pb-2 mb-2">
        <div className="flex justify-between font-bold text-sm border-t border-double border-black pt-1">
          <span>TOTAL REFUND:</span>
          <span>₹{returnDoc.total_refund_amount.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-[10px]">
          <span>Refund Method:</span>
          <span className="font-bold uppercase">
            {returnDoc.refund_method === 'credit_deduction' ? 'Udhar Deducted' : returnDoc.refund_method}
          </span>
        </div>
      </div>

      {/* ─── Return Barcode ─── */}
      <div className="flex justify-center mb-2">
        <Barcode
          value={returnDoc.return_number}
          width={1.2}
          height={30}
          fontSize={8}
          displayValue={true}
          margin={0}
        />
      </div>

      {/* ─── Footer ─── */}
      <div className="text-center text-[9px] space-y-0.5">
        <p className="text-[8px] text-gray-600">Credit note issued in accordance with GST rules.</p>
        <p className="text-[8px] text-gray-500 mt-2">Authorised Signatory _______________</p>
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
