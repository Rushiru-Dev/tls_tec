import type { ResultSet, SQLiteDatabase } from 'react-native-sqlite-storage';
import { getDatabase } from '../database';

export type ProductCategory = { id: number; name: string };
export type SavedProduct = {
  id: number;
  categoryId: number;
  category: string;
  model: string;
  description: string;
  unitPrice: number;
};

function resultRows<T>(result: ResultSet): T[] {
  return result.rows.raw() as T[];
}

export async function listCategories(): Promise<ProductCategory[]> {
  const database = await getDatabase();
  const [result] = await database.executeSql(
    'SELECT id, name FROM categories ORDER BY name COLLATE NOCASE',
  );
  return resultRows<ProductCategory>(result);
}

export async function createCategory(name: string): Promise<ProductCategory> {
  const database = await getDatabase();
  const cleanName = name.trim();
  const [result] = await database.executeSql(
    'INSERT INTO categories (name) VALUES (?)',
    [cleanName],
  );
  return { id: result.insertId, name: cleanName };
}

export async function listProducts(): Promise<SavedProduct[]> {
  const database = await getDatabase();
  const [result] = await database.executeSql(`
    SELECT products.id,
           products.category_id AS categoryId,
           categories.name AS category,
           products.model,
           products.description,
           products.unit_price AS unitPrice
    FROM products
    INNER JOIN categories ON categories.id = products.category_id
    ORDER BY products.id DESC
  `);
  return resultRows<SavedProduct>(result);
}

export async function createProduct(product: {
  categoryId: number;
  model: string;
  description: string;
  unitPrice: number;
}): Promise<void> {
  const database: SQLiteDatabase = await getDatabase();
  await database.executeSql(
    'INSERT INTO products (category_id, model, description, unit_price) VALUES (?, ?, ?, ?)',
    [
      product.categoryId,
      product.model.trim(),
      product.description.trim(),
      product.unitPrice,
    ],
  );
}

export async function updateProduct(
  id: number,
  product: { model: string; description: string; unitPrice: number },
): Promise<void> {
  const database = await getDatabase();
  await database.executeSql(
    'UPDATE products SET model = ?, description = ?, unit_price = ? WHERE id = ?',
    [product.model.trim(), product.description.trim(), product.unitPrice, id],
  );
}

export async function deleteProduct(id: number): Promise<void> {
  const database = await getDatabase();
  await database.executeSql('DELETE FROM products WHERE id = ?', [id]);
}

export type ProductViewMode = 'card' | 'table';

export async function getProductViewMode(): Promise<ProductViewMode> {
  const database = await getDatabase();
  const [result] = await database.executeSql(
    'SELECT value FROM app_settings WHERE key = ?',
    ['products-view-mode'],
  );
  const saved = result.rows.item(0)?.value;
  return saved === 'table' ? 'table' : 'card';
}

export async function setProductViewMode(mode: ProductViewMode): Promise<void> {
  const database = await getDatabase();
  await database.executeSql(
    'INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)',
    ['products-view-mode', mode],
  );
}
