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
      <div className="flex items-center justify-center min-h-screen bg-slate-100 text-slate-500 font-mono text-sm">
        Loading Credit Note / Return Voucher...
      </div>
    );
  }

  const formattedDate = returnDoc.return_date 
    ? format(new Date(returnDoc.return_date), 'dd/MM/yyyy hh:mm a') 
    : '';

  return (
    <div className="bg-white min-h-screen p-4 flex justify-center text-black font-mono">
      <div className="w-[80mm] text-[12px] leading-tight flex flex-col items-center">
        {/* Store Header */}
        <div className="text-center w-full border-b border-dashed border-black pb-2 mb-2">
          <h1 className="text-base font-bold uppercase tracking-wider">{settings.shop_name || 'RETAIL POS'}</h1>
          {settings.shop_address && <p className="text-[11px] mt-0.5">{settings.shop_address}</p>}
          {settings.shop_phone && <p className="text-[11px]">Tel: {settings.shop_phone}</p>}
          {settings.shop_gstin && <p className="text-[11px] font-bold">GSTIN: {settings.shop_gstin}</p>}
        </div>

        {/* Document Title */}
        <div className="w-full text-center my-1 bg-black text-white py-0.5 font-bold uppercase text-[12px] tracking-wide">
          CREDIT NOTE / RETURN VOUCHER
        </div>

        {/* Voucher Meta */}
        <div className="w-full text-[11px] border-b border-dashed border-black pb-2 mb-2 space-y-0.5">
          <div className="flex justify-between font-bold">
            <span>Credit Note No:</span>
            <span>{returnDoc.return_number}</span>
          </div>
          <div className="flex justify-between">
            <span>Original Invoice:</span>
            <span className="font-bold">{returnDoc.invoice_number}</span>
          </div>
          <div className="flex justify-between">
            <span>Date & Time:</span>
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
            <span>Processed By:</span>
            <span>{returnDoc.processed_by || 'Admin'}</span>
          </div>
          <div className="flex justify-between">
            <span>Reason:</span>
            <span>{returnDoc.reason || 'Customer Return'}</span>
          </div>
        </div>

        {/* Items Table */}
        <div className="w-full border-b border-dashed border-black pb-2 mb-2">
          <table className="w-full text-left text-[11px]">
            <thead>
              <tr className="border-b border-black">
                <th className="py-1">Item</th>
                <th className="py-1 text-center">Qty</th>
                <th className="py-1 text-right">Price</th>
                <th className="py-1 text-right">Refund</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dotted divide-gray-400">
              {returnDoc.items.map((item, idx) => (
                <tr key={idx}>
                  <td className="py-1 pr-1">
                    <div className="font-bold">{item.product_name}</div>
                    {item.gst_rate > 0 && (
                      <div className="text-[9px] text-gray-600">GST: {item.gst_rate}%</div>
                    )}
                  </td>
                  <td className="py-1 text-center font-bold">{item.quantity}</td>
                  <td className="py-1 text-right">₹{item.unit_price.toFixed(2)}</td>
                  <td className="py-1 text-right font-bold">₹{item.refund_amount.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Refund Summary */}
        <div className="w-full text-[11px] space-y-1 border-b border-dashed border-black pb-2 mb-2">
          <div className="flex justify-between font-bold text-sm">
            <span>TOTAL REFUND:</span>
            <span>₹ {returnDoc.total_refund_amount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span>Refund Method:</span>
            <span className="font-bold uppercase tracking-wider">
              {returnDoc.refund_method === 'credit_deduction' ? 'Udhar Deducted' : returnDoc.refund_method}
            </span>
          </div>
        </div>

        {/* Footer Note */}
        <div className="text-center text-[10px] space-y-1 mt-1">
          <p>Credit note issued in accordance with GST rules.</p>
          <p className="text-[9px] text-gray-500">Authorized Signature _________________</p>
        </div>
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
