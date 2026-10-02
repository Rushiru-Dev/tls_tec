import type { SQLiteDatabase } from 'react-native-sqlite-storage';
import { getDatabase } from '../database/database';

export type QuotationLine = {
  productId: number;
  category: string;
  model: string;
  description: string;
  quantity: number;
  unitPrice: number;
};

export type QuotationRecord = {
  quotationNumber: string;
  date: string;
  customerName: string;
  phoneNumber: string;
  address: string;
  items: QuotationLine[];
  discount: number;
};

export type QuotationHistoryRecord = {
  id: number;
  quotationNumber: string;
  date: string;
  customerName: string;
  phoneNumber: string;
  total: number;
  itemCount: number;
};

export async function saveQuotation(quotation: QuotationRecord): Promise<number> {
  const database: SQLiteDatabase = await getDatabase();
  const subtotal = quotation.items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0,
  );
  const discount = Math.max(0, quotation.discount);
  const netTotal = Math.max(0, subtotal - discount);

  return new Promise((resolve, reject) => {
    let quotationId = 0;
    database.transaction(
      tx => {
        const saveItems = () => {
          tx.executeSql('DELETE FROM quotation_items WHERE quotation_id = ?', [quotationId]);
          quotation.items.forEach(item => {
            tx.executeSql(
              `INSERT INTO quotation_items (
                quotation_id, product_id, category_name, item_model,
                item_description, quantity, unit_price, amount
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                quotationId,
                item.productId || null,
                item.category,
                item.model,
                item.description,
                item.quantity,
                item.unitPrice,
                item.quantity * item.unitPrice,
              ],
            );
          });
        };
        const values = [
          quotation.quotationNumber.trim(),
          quotation.customerName.trim(),
          quotation.phoneNumber.trim(),
          quotation.address.trim(),
          quotation.date,
          subtotal,
          discount,
          netTotal,
        ];

        tx.executeSql(
          'SELECT id FROM quotations WHERE quotation_number = ? COLLATE NOCASE LIMIT 1',
          [quotation.quotationNumber.trim()],
          (_transaction, result) => {
            if (result.rows.length) {
              quotationId = Number(result.rows.item(0).id);
              tx.executeSql(
                `UPDATE quotations SET customer_name = ?, phone_number = ?,
                  installation_address = ?, quotation_date = ?, subtotal = ?,
                  discount = ?, net_total = ? WHERE id = ?`,
                [
                  quotation.customerName.trim(),
                  quotation.phoneNumber.trim(),
                  quotation.address.trim(),
                  quotation.date,
                  subtotal,
                  discount,
                  netTotal,
                  quotationId,
                ],
                saveItems,
              );
              return;
            }
            tx.executeSql(
              `INSERT INTO quotations (
                quotation_number, customer_name, phone_number, installation_address,
                quotation_date, subtotal, discount, net_total
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              values,
              () => {
                tx.executeSql(
                  'SELECT last_insert_rowid() AS id',
                  [],
                  (_selectTransaction, inserted) => {
                    quotationId = Number(inserted.rows.item(0)?.id ?? 0);
                    saveItems();
                  },
                );
              },
            );
          },
        );
      },
      reject,
      () => resolve(quotationId),
    );
  });
}

export async function listQuotations(): Promise<QuotationHistoryRecord[]> {
  const database = await getDatabase();
  const [result] = await database.executeSql(`
    SELECT q.id, q.quotation_number, q.quotation_date, q.customer_name,
      q.phone_number, q.net_total,
      (SELECT COUNT(*) FROM quotation_items item WHERE item.quotation_id = q.id) AS item_count
    FROM quotations q ORDER BY q.id DESC
  `);
  const records: QuotationHistoryRecord[] = [];
  for (let index = 0; index < result.rows.length; index += 1) {
    const row = result.rows.item(index);
    records.push({
      id: Number(row.id),
      quotationNumber: String(row.quotation_number ?? ''),
      date: String(row.quotation_date ?? ''),
      customerName: String(row.customer_name ?? ''),
      phoneNumber: String(row.phone_number ?? ''),
      total: Number(row.net_total ?? 0),
      itemCount: Number(row.item_count ?? 0),
    });
  }
  return records;
}

export async function getQuotationById(id: number): Promise<QuotationRecord | null> {
  const database = await getDatabase();
  const [quotationResult] = await database.executeSql(
    'SELECT * FROM quotations WHERE id = ?',
    [id],
  );
  if (!quotationResult.rows.length) return null;
  const row = quotationResult.rows.item(0);
  const [itemResult] = await database.executeSql(
    'SELECT * FROM quotation_items WHERE quotation_id = ? ORDER BY id',
    [id],
  );
  const items: QuotationLine[] = [];
  for (let index = 0; index < itemResult.rows.length; index += 1) {
    const item = itemResult.rows.item(index);
    items.push({
      productId: Number(item.product_id ?? 0),
      category: String(item.category_name ?? ''),
      model: String(item.item_model ?? ''),
      description: String(item.item_description ?? ''),
      quantity: Number(item.quantity ?? 1),
      unitPrice: Number(item.unit_price ?? 0),
    });
  }
  return {
    quotationNumber: String(row.quotation_number ?? ''),
    date: String(row.quotation_date ?? ''),
    customerName: String(row.customer_name ?? ''),
    phoneNumber: String(row.phone_number ?? ''),
    address: String(row.installation_address ?? ''),
    items,
    discount: Number(row.discount ?? 0),
  };
}

export async function deleteQuotation(id: number): Promise<void> {
  const database = await getDatabase();
  await database.executeSql('DELETE FROM quotations WHERE id = ?', [id]);
}
