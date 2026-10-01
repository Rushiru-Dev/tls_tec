import { generatePDF } from 'react-native-html-to-pdf';
import type { InvoiceRecord } from './invoiceService';
import { invoiceLogoDataUri } from '../img/logoData';
import { getAppSettings, type AppSettings } from './settingsService';

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const amountText = (amount: number) =>
  amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export function createInvoiceHtml(invoice: InvoiceRecord, settings: AppSettings): string {
  const subtotal = invoice.items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0,
  );
  const netTotal = Math.max(0, subtotal - invoice.discount);
  const paid = invoice.payments.reduce((sum, payment) => sum + payment.amount, 0);
  const balance = Math.max(0, netTotal - paid);

  const rows = invoice.items
    .map((item, index) => {
      const description = item.description.trim();
      const title =
        description && description.toLowerCase() !== item.model.toLowerCase()
          ? `${description} (${item.model})`
          : item.model;
      const serial = item.serialNumber
        ? `<div class="sn-text">S/N: ${escapeHtml(item.serialNumber)}</div>`
        : '';
      const warranty =
        item.warranty === 'No Warranty'
          ? '-'
          : escapeHtml(item.warranty.replace(' yrs', 'yr'));

      return `<tr>
        <td class="text-center">${index + 1}</td>
        <td><div class="item-title">${escapeHtml(title)}</div>${serial}</td>
        <td class="text-center">${warranty}</td>
        <td class="text-center">${item.quantity}</td>
        <td class="text-right">${amountText(item.unitPrice)}</td>
        <td class="text-right">${amountText(item.unitPrice * item.quantity)}</td>
      </tr>`;
    })
    .join('');

  const discountRow =
    invoice.discount > 0
      ? `<div class="summary-row"><span>Discount</span><span>- LKR ${amountText(invoice.discount)}</span></div>`
      : '';
  const paymentRows = invoice.payments
    .map(
      (payment, index) =>
        `<div class="summary-row"><span>Advance Payment ${String(index + 1).padStart(2, '0')} (${escapeHtml(payment.date)})</span><span>LKR ${amountText(payment.amount)}</span></div>`,
    )
    .join('');

  return `<!doctype html><html><head><meta charset="utf-8" />
  <style>
    @page { size: Letter; margin: 14pt; }
    * { box-sizing: border-box; }
    body { font-family: Arial, "Segoe UI", sans-serif; color: #1e293b; font-size: 9pt; margin: 0; }
    .invoice-card { width: 100%; background: #fff; padding: 0; }
    .header { min-height: 83pt; display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2pt solid #0f172a; padding: 12pt 14pt; margin-bottom: 16pt; background: #000; }
    .logo-section { width: 170pt; }
    .logo-section img { width: 150pt; height: 58pt; object-fit: contain; object-position: left center; }
    .company-details { text-align: right; font-size: 8pt; color: #ccc; line-height: 1.5; }
    .company-name { font-size: 15pt; font-weight: 800; color: #fff; text-transform: uppercase; margin-bottom: 3pt; }
    .company-details p { margin: 0; }
    .doc-badge { text-align: center; margin-bottom: 14pt; }
    .doc-badge h1 { display: inline-block; color: #000; font-size: 14pt; font-weight: 700; letter-spacing: 2pt; margin: 0; }
    .meta-grid { display: flex; justify-content: space-between; border-radius: 6pt; padding: 10pt 12pt; margin-bottom: 16pt; font-size: 9pt; min-height: 70pt; }
    .customer-details, .invoice-details { width: 48%; }
    .customer-details p, .invoice-details p { margin: 0 0 3pt; color: #334155; }
    .meta-title { font-size: 7.5pt; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: .4pt; margin-bottom: 5pt; }
    .invoice-details { text-align: right; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; margin-bottom: 0; }
    th { background: #0f172a; color: #fff; font-size: 7.2pt; text-transform: uppercase; letter-spacing: .15pt; padding: 6pt 3pt; text-align: left; overflow-wrap: anywhere; }
    td { padding: 6pt 3pt; font-size: 7.5pt; border-bottom: .6pt solid #e2e8f0; vertical-align: top; color: #334155; overflow-wrap: anywhere; }
    tbody tr:nth-child(even) td { background: #f8fafc; }
    .item-title { font-weight: 600; color: #0f172a; }
    .sn-text { font-family: monospace; font-size: 6.5pt; color: #64748b; margin-top: 2pt; overflow-wrap: anywhere; }
    .text-center { text-align: center; }
    .text-right { text-align: right; white-space: nowrap; }
    .summary-container { display: flex; justify-content: flex-end; margin: 0 0 18pt; }
    .summary-table { width: 270pt; border: 1pt solid #cbd5e1; border-radius: 5pt; overflow: hidden; }
    .summary-row { display: flex; justify-content: space-between; gap: 10pt; padding: 6pt 9pt; font-size: 8pt; border-bottom: .6pt solid #e2e8f0; color: #334155; }
    .summary-row:last-child { border-bottom: none; }
    .summary-row span:last-child { text-align: right; white-space: nowrap; }
    .total-row { font-size: 9pt; font-weight: 700; background: #f1f5f9; color: #0f172a; }
    .balance-row { font-size: 9.5pt; font-weight: 800; color: #b91c1c; background: #fef2f2; }
    footer { text-align: center; color: #64748b; font-size: 8pt; margin-top: 8pt; }
  </style></head><body>
    <div class="invoice-card">
      <div class="header">
        <div class="logo-section"><img src="${invoiceLogoDataUri}" alt="TLS Technology Logo" /></div>
        <div class="company-details">
          <div class="company-name">${escapeHtml(settings.businessName)}</div>
          <p>${escapeHtml(settings.businessAddress)}</p>
          <p><strong>Tel:</strong> ${escapeHtml(settings.businessMobile)}</p>
          <p><strong>Email:</strong> ${escapeHtml(settings.businessEmail)}</p>
        </div>
      </div>
      <div class="doc-badge"><h1>INVOICE</h1></div>
      <div class="meta-grid">
        <div class="customer-details">
          <div class="meta-title">Customer / Installation Site</div>
          <p><strong>Name:</strong> ${escapeHtml(invoice.customerName || '')}</p>
          <p><strong>Mobile:</strong> ${escapeHtml(invoice.phoneNumber || '')}</p>
          <p><strong>Address:</strong> ${escapeHtml(invoice.installationAddress || '')}</p>
        </div>
        <div class="invoice-details">
          <div class="meta-title">Invoice Information</div>
          <p><strong>Invoice No:</strong> ${escapeHtml(invoice.invoiceNumber)}</p>
          <p><strong>Date:</strong> ${escapeHtml(invoice.date)}</p>
        </div>
      </div>
      <table>
        <colgroup><col style="width:5%"/><col style="width:41%"/><col style="width:10%"/><col style="width:7%"/><col style="width:18.5%"/><col style="width:18.5%"/></colgroup>
        <thead><tr>
          <th class="text-center">#</th><th>Item / Description</th>
          <th class="text-center">Warranty</th><th class="text-center">Qty</th>
          <th class="text-right">Unit Price</th><th class="text-right">Amount</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="summary-container"><div class="summary-table">
        <div class="summary-row total-row"><span>Total Amount</span><span>LKR ${amountText(subtotal)}</span></div>
        ${discountRow}
        ${paymentRows}
        <div class="summary-row balance-row"><span>Balance Payment Due</span><span>LKR ${amountText(balance)}</span></div>
      </div></div>
      ${settings.invoiceTerms.trim() ? `<div class="terms">${escapeHtml(settings.invoiceTerms).replace(/\n/g, '<br/>')}</div>` : ''}
      <footer>Thank You. ${escapeHtml(settings.businessName)}</footer>
    </div>
  </body></html>`;
}

export async function generateInvoicePdf(invoice: InvoiceRecord): Promise<string> {
  const safeName = invoice.invoiceNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
  const result = await generatePDF({
    html: createInvoiceHtml(invoice, await getAppSettings()),
    fileName: safeName,
    width: 612,
    height: 792,
    padding: 0,
    // Keep the PDF under app cache; react-native-share's FileProvider exposes
    // the cache path, while its default provider does not expose Documents.
    // Use a valid base URI; Android WebView can fail while parsing an empty one.
    baseURL: 'about:blank',
  });
  if (!result.filePath) {
    throw new Error('PDF converter did not return a file path.');
  }
  return result.filePath;
}
