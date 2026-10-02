import type { SQLiteDatabase } from 'react-native-sqlite-storage';
import { getDatabase } from '../database/database';
import { getAppSettings } from './settingsService';

export type InvoiceLine = {
  productId: number;
  category: string;
  model: string;
  description: string;
  modelNumber: string;
  serialNumber: string;
  warranty: string;
  quantity: number;
  unitPrice: number;
};

export type InvoicePayment = { date: string; amount: number };

export type InvoiceRecord = {
  invoiceNumber: string;
  date: string;
  customerName: string;
  phoneNumber: string;
  installationAddress: string;
  items: InvoiceLine[];
  payments: InvoicePayment[];
  discount: number;
};

export type InvoiceHistoryRecord = {
  id: number;
  invoiceNumber: string;
  customerName: string;
  phoneNumber: string;
  date: string;
  total: number;
  discount: number;
  paid: number;
  balance: number;
  itemCount: number;
};

export async function invoiceNumberExists(
  invoiceNumber: string,
  excludingInvoiceId?: number,
): Promise<boolean> {
  const database = await getDatabase();
  const sql = excludingInvoiceId
    ? 'SELECT id FROM invoices WHERE invoice_number = ? COLLATE NOCASE AND id <> ? LIMIT 1'
    : 'SELECT id FROM invoices WHERE invoice_number = ? COLLATE NOCASE LIMIT 1';
  const [result] = await database.executeSql(
    sql,
    excludingInvoiceId
      ? [invoiceNumber.trim(), excludingInvoiceId]
      : [invoiceNumber.trim()],
  );
  return result.rows.length > 0;
}

export async function getInvoiceById(
  invoiceId: number,
): Promise<InvoiceRecord | null> {
  const database = await getDatabase();
  const [invoiceResult] = await database.executeSql(
    'SELECT * FROM invoices WHERE id = ?',
    [invoiceId],
  );
  if (invoiceResult.rows.length === 0) return null;
  const invoice = invoiceResult.rows.item(0);
  const [itemResult] = await database.executeSql(
    'SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY id',
    [invoiceId],
  );
  const [paymentResult] = await database.executeSql(
    'SELECT * FROM invoice_payments WHERE invoice_id = ? ORDER BY id',
    [invoiceId],
  );

  const items: InvoiceLine[] = [];
  for (let index = 0; index < itemResult.rows.length; index += 1) {
    const row = itemResult.rows.item(index);
    items.push({
      productId: Number(row.product_id ?? 0),
      category: String(row.category_name ?? ''),
      model: String(row.item_model ?? ''),
      description: String(row.item_description ?? ''),
      modelNumber: String(row.model_number ?? ''),
      serialNumber: String(row.serial_number ?? ''),
      warranty: String(row.warranty ?? 'No Warranty'),
      quantity: Number(row.quantity ?? 1),
      unitPrice: Number(row.unit_price ?? 0),
    });
  }
  const payments: InvoicePayment[] = [];
  for (let index = 0; index < paymentResult.rows.length; index += 1) {
    const row = paymentResult.rows.item(index);
    payments.push({
      date: String(row.payment_date ?? ''),
      amount: Number(row.amount ?? 0),
    });
  }

  return {
    invoiceNumber: String(invoice.invoice_number ?? ''),
    customerName: String(invoice.customer_name ?? ''),
    phoneNumber: String(invoice.phone_number ?? ''),
    installationAddress: String(invoice.installation_address ?? ''),
    date: String(invoice.invoice_date ?? ''),
    items,
    payments,
    discount: Number(invoice.discount ?? 0),
  };
}

export async function listInvoices(): Promise<InvoiceHistoryRecord[]> {
  const database = await getDatabase();
  const [result] = await database.executeSql(`
    SELECT
      i.id,
      i.invoice_number,
      i.customer_name,
      i.phone_number,
      i.invoice_date,
      i.subtotal,
      i.discount,
      i.net_total,
      COALESCE((SELECT SUM(p.amount) FROM invoice_payments p WHERE p.invoice_id = i.id), 0) AS paid,
      (SELECT COUNT(*) FROM invoice_items item WHERE item.invoice_id = i.id) AS item_count
    FROM invoices i
    ORDER BY i.id DESC
  `);
  const invoices: InvoiceHistoryRecord[] = [];
  for (let index = 0; index < result.rows.length; index += 1) {
    const row = result.rows.item(index);
    invoices.push({
      id: Number(row.id),
      invoiceNumber: String(row.invoice_number),
      customerName: String(row.customer_name ?? ''),
      phoneNumber: String(row.phone_number ?? ''),
      date: String(row.invoice_date ?? ''),
      total: Number(row.subtotal ?? 0),
      discount: Number(row.discount ?? 0),
      paid: Number(row.paid ?? 0),
      balance: Math.max(0, Number(row.net_total ?? 0) - Number(row.paid ?? 0)),
      itemCount: Number(row.item_count ?? 0),
    });
  }
  return invoices;
}

export async function createInvoiceNumber(date = new Date()): Promise<string> {
  const database = await getDatabase();
  const settings = await getAppSettings();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);
  const invoicePrefix = settings.invoicePrefix || 'IN/';
  const escapedPrefix = invoicePrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const numberPattern = new RegExp(
    `^${escapedPrefix}(\\d+)\\/${month}\\/${year}$`,
    'i',
  );
  const [result] = await database.executeSql(
    'SELECT invoice_number FROM invoices WHERE invoice_number LIKE ? COLLATE NOCASE',
    [`${invoicePrefix}%/${month}/${year}`],
  );
  let next = 1;
  for (let index = 0; index < result.rows.length; index += 1) {
    const match = String(result.rows.item(index).invoice_number ?? '').match(
      numberPattern,
    );
    if (match) next = Math.max(next, Number(match[1]) + 1);
  }

  let candidate = `${invoicePrefix}${next}/${month}/${year}`;
  while (await invoiceNumberExists(candidate)) {
    next += 1;
    candidate = `${invoicePrefix}${next}/${month}/${year}`;
  }
  return candidate;
}

export async function saveInvoice(
  invoice: InvoiceRecord,
  existingInvoiceId?: number,
): Promise<number> {
  const database: SQLiteDatabase = await getDatabase();
  const subtotal = invoice.items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0,
  );
  const netTotal = Math.max(0, subtotal - invoice.discount);

  return new Promise((resolve, reject) => {
    let invoiceId = existingInvoiceId ?? 0;
    database.transaction(
      tx => {
        const persistItemsAndPayments = () => {
          if (!invoiceId) throw new Error('Could not save the invoice.');
          tx.executeSql('DELETE FROM invoice_items WHERE invoice_id = ?', [invoiceId]);
          tx.executeSql('DELETE FROM invoice_payments WHERE invoice_id = ?', [invoiceId]);
          invoice.items.forEach(item => {
            tx.executeSql(
              `INSERT INTO invoice_items (
                invoice_id, product_id, category_name, item_model, item_description,
                model_number, serial_number, warranty, quantity, unit_price, amount
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                invoiceId,
                item.productId || null,
                item.category,
                item.model,
                item.description,
                item.modelNumber,
                item.serialNumber || null,
                item.warranty,
                item.quantity,
                item.unitPrice,
                item.quantity * item.unitPrice,
              ],
            );
          });
          invoice.payments.forEach(payment => {
            tx.executeSql(
              'INSERT INTO invoice_payments (invoice_id, payment_date, amount) VALUES (?, ?, ?)',
              [invoiceId, payment.date, payment.amount],
            );
          });
        };
        const invoiceValues = [
          invoice.invoiceNumber.trim(),
          invoice.customerName.trim(),
          invoice.phoneNumber.trim(),
          invoice.installationAddress.trim(),
          invoice.date,
          subtotal,
          invoice.discount,
          netTotal,
        ];

        if (existingInvoiceId) {
          tx.executeSql(
            `UPDATE invoices SET invoice_number = ?, customer_name = ?, phone_number = ?,
              installation_address = ?, invoice_date = ?, subtotal = ?, discount = ?, net_total = ?
             WHERE id = ?`,
            [...invoiceValues, existingInvoiceId],
            (_transaction, result) => {
              if (result.rowsAffected === 0) {
                throw new Error('Invoice was not found to update.');
              }
              persistItemsAndPayments();
            },
          );
        } else {
          tx.executeSql(
            `INSERT INTO invoices (
              invoice_number, customer_name, phone_number, installation_address,
              invoice_date, subtotal, discount, net_total
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            invoiceValues,
            () => {
              tx.executeSql(
                'SELECT last_insert_rowid() AS id',
                [],
                (_selectTransaction, result) => {
                  invoiceId = Number(result.rows.item(0)?.id ?? 0);
                  persistItemsAndPayments();
                },
              );
            },
          );
        }
      },
      reject,
      () => resolve(invoiceId),
    );
  });
}
