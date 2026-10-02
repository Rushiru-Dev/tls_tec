import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SQLiteDatabase } from 'react-native-sqlite-storage';

export async function runMigrations(database: SQLiteDatabase): Promise<void> {
  await database.executeSql('PRAGMA foreign_keys = ON');
  await database.executeSql(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL COLLATE NOCASE UNIQUE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  const defaultCategories = [
    'DVR/NVR Recorders',
    'Storage / Hard Drives',
    'Cameras (Bullet / Dome / Eyeball )',
    'Accessories & Wiring',
    'Installation & Setup Charges',
    'Custom Item / Manual Entry',
  ];
  for (const category of defaultCategories) {
    await database.executeSql(
      'INSERT OR IGNORE INTO categories (name) VALUES (?)',
      [category],
    );
  }
  await database.executeSql(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL,
      model TEXT NOT NULL,
      description TEXT NOT NULL,
      unit_price REAL NOT NULL CHECK (unit_price >= 0),
      default_warranty TEXT NOT NULL DEFAULT 'No Warranty',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT
    )
  `);
  await database.executeSql(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    )
  `);
  const [productColumns] = await database.executeSql('PRAGMA table_info(products)');
  let hasDefaultWarranty = false;
  for (let index = 0; index < productColumns.rows.length; index += 1) {
    if (productColumns.rows.item(index).name === 'default_warranty') {
      hasDefaultWarranty = true;
      break;
    }
  }
  if (!hasDefaultWarranty) {
    await database.executeSql(
      "ALTER TABLE products ADD COLUMN default_warranty TEXT NOT NULL DEFAULT 'No Warranty'",
    );
  }
  await database.executeSql(`
    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT NOT NULL UNIQUE,
      customer_name TEXT NOT NULL,
      phone_number TEXT NOT NULL,
      installation_address TEXT NOT NULL,
      invoice_date TEXT NOT NULL,
      subtotal REAL NOT NULL,
      discount REAL NOT NULL DEFAULT 0,
      net_total REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await database.executeSql(`
    CREATE TABLE IF NOT EXISTS invoice_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL,
      product_id INTEGER,
      category_name TEXT NOT NULL,
      item_model TEXT NOT NULL,
      item_description TEXT NOT NULL,
      model_number TEXT NOT NULL DEFAULT '',
      serial_number TEXT,
      warranty TEXT NOT NULL,
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      unit_price REAL NOT NULL,
      amount REAL NOT NULL,
      FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
    )
  `);
  const [invoiceItemColumns] = await database.executeSql(
    'PRAGMA table_info(invoice_items)',
  );
  let hasModelNumber = false;
  for (let index = 0; index < invoiceItemColumns.rows.length; index += 1) {
    if (invoiceItemColumns.rows.item(index).name === 'model_number') {
      hasModelNumber = true;
      break;
    }
  }
  if (!hasModelNumber) {
    await database.executeSql(
      "ALTER TABLE invoice_items ADD COLUMN model_number TEXT NOT NULL DEFAULT ''",
    );
  }
  await database.executeSql(`
    CREATE TABLE IF NOT EXISTS invoice_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL,
      payment_date TEXT NOT NULL,
      amount REAL NOT NULL CHECK (amount > 0),
      FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
    )
  `);
  await database.executeSql(`
    CREATE TABLE IF NOT EXISTS quotations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quotation_number TEXT NOT NULL UNIQUE COLLATE NOCASE,
      customer_name TEXT NOT NULL DEFAULT '',
      phone_number TEXT NOT NULL DEFAULT '',
      installation_address TEXT NOT NULL DEFAULT '',
      quotation_date TEXT NOT NULL,
      subtotal REAL NOT NULL,
      discount REAL NOT NULL DEFAULT 0,
      net_total REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await database.executeSql(`
    CREATE TABLE IF NOT EXISTS quotation_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quotation_id INTEGER NOT NULL,
      product_id INTEGER,
      category_name TEXT NOT NULL,
      item_model TEXT NOT NULL,
      item_description TEXT NOT NULL,
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      unit_price REAL NOT NULL,
      amount REAL NOT NULL,
      FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE
    )
  `);
  await seedDefaultProducts(database);
  await database.executeSql(
    'CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id)',
  );
  await database.executeSql(
    'CREATE INDEX IF NOT EXISTS idx_quotation_items_quotation_id ON quotation_items(quotation_id)',
  );
  await migrateProductDataFromAsyncStorage(database);
}

async function seedDefaultProducts(database: SQLiteDatabase): Promise<void> {
  const marker = 'catalog-seed-2026-10';
  const [seedState] = await database.executeSql(
    'SELECT value FROM app_settings WHERE key = ?',
    ['default-product-catalog'],
  );
  if (seedState.rows.item(0)?.value === marker) return;

  const products = [
    { category: 'DVR/NVR Recorders', model: 'Dahua 5MP 8 channel DVR', description: 'DH-XVRIB08-1', price: 23500, warranty: '2 yrs' },
    { category: 'Storage / Hard Drives', model: '1 TB Surveillance HDD', description: '1 TB Surveillance HDD', price: 20500, warranty: '2 yrs' },
    { category: 'Cameras (Bullet / Dome / Eyeball )', model: 'Dahua 2MP 30m Smart Light Full Colour Mic Camera', description: 'DH-HAC-HFW1209CLP-A-LED', price: 9100, warranty: '2 yrs' },
    { category: 'Cameras (Bullet / Dome / Eyeball )', model: 'Dahua 2MP 30m Smart Light Full Colour with Mic Eyeball Camera', description: 'DH-HAC-HFW1209CLQP-A-LED', price: 9300, warranty: '2 yrs' },
    { category: 'Accessories & Wiring', model: '12V 2A Power Supply', description: '12V 2A Power Supply', price: 500, warranty: 'No Warranty' },
    { category: 'Accessories & Wiring', model: 'Video Balun (8 MP/1080P)', description: 'Video Balun (8 MP/1080P)', price: 500, warranty: 'No Warranty' },
    { category: 'Accessories & Wiring', model: 'DVR Box', description: 'DVR Box', price: 2200, warranty: 'No Warranty' },
    { category: 'Accessories & Wiring', model: 'Power Extension', description: 'Power Extension', price: 5000, warranty: 'No Warranty' },
    { category: 'Accessories & Wiring', model: 'Camera Mount Box', description: 'Camera Mount Box', price: 600, warranty: 'No Warranty' },
    { category: 'Accessories & Wiring', model: 'Monitor Bracket', description: 'Monitor Bracket', price: 1500, warranty: 'No Warranty' },
    { category: 'Installation & Setup Charges', model: 'Installation Charges', description: 'Installation Charges', price: 3000, warranty: 'No Warranty' },
    { category: 'Accessories & Wiring', model: 'Deep Sunk Box', description: 'Deep Sunk Box', price: 200, warranty: 'No Warranty' },
    { category: 'Accessories & Wiring', model: 'Blank Plate', description: 'Blank Plate', price: 300, warranty: 'No Warranty' },
  ];

  for (const product of products) {
    const [categoryResult] = await database.executeSql(
      'SELECT id FROM categories WHERE name = ? COLLATE NOCASE LIMIT 1',
      [product.category],
    );
    const categoryId = Number(categoryResult.rows.item(0)?.id);
    if (!categoryId) continue;

    const [existingResult] = await database.executeSql(
      'SELECT id FROM products WHERE category_id = ? AND model = ? COLLATE NOCASE LIMIT 1',
      [categoryId, product.model],
    );
    if (existingResult.rows.length) {
      await database.executeSql(
        `UPDATE products SET default_warranty = ?
         WHERE id = ? AND default_warranty = 'No Warranty'`,
        [product.warranty, Number(existingResult.rows.item(0).id)],
      );
      continue;
    }
    await database.executeSql(
      `INSERT INTO products (
        category_id, model, description, unit_price, default_warranty
      ) VALUES (?, ?, ?, ?, ?)`,
      [categoryId, product.model, product.description, product.price, product.warranty],
    );
  }

  await database.executeSql(
    'INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)',
    ['default-product-catalog', marker],
  );
}

async function migrateProductDataFromAsyncStorage(
  database: SQLiteDatabase,
): Promise<void> {
  const markerKey = '@tls_tec/product-data-sqlite-migrated';
  if ((await AsyncStorage.getItem(markerKey)) === 'true') return;

  const [savedCategories, savedProducts] = await Promise.all([
    AsyncStorage.getItem('@tls_tec/product-categories'),
    AsyncStorage.getItem('@tls_tec/products'),
  ]);
  const categories: string[] = savedCategories
    ? JSON.parse(savedCategories)
    : [];
  const products: Array<{
    category: string;
    model: string;
    description: string;
    unitPrice: number;
  }> = savedProducts ? JSON.parse(savedProducts) : [];

  for (const category of categories) {
    await database.executeSql(
      'INSERT OR IGNORE INTO categories (name) VALUES (?)',
      [category.trim()],
    );
  }
  for (const product of products) {
    const categoryName = product.category.trim();
    if (!categoryName || !product.model?.trim()) continue;
    await database.executeSql(
      'INSERT OR IGNORE INTO categories (name) VALUES (?)',
      [categoryName],
    );
    const [categoryResult] = await database.executeSql(
      'SELECT id FROM categories WHERE name = ?',
      [categoryName],
    );
    const categoryId = categoryResult.rows.item(0)?.id as number | undefined;
    if (categoryId === undefined) continue;
    await database.executeSql(
      `INSERT INTO products (category_id, model, description, unit_price)
       SELECT ?, ?, ?, ?
       WHERE NOT EXISTS (
         SELECT 1 FROM products WHERE category_id = ? AND model = ?
       )`,
      [
        categoryId,
        product.model.trim(),
        product.description?.trim() ?? '',
        Number(product.unitPrice) || 0,
        categoryId,
        product.model.trim(),
      ],
    );
  }

  await AsyncStorage.setItem(markerKey, 'true');
  await Promise.all([
    AsyncStorage.removeItem('@tls_tec/product-categories'),
    AsyncStorage.removeItem('@tls_tec/products'),
  ]);
}
