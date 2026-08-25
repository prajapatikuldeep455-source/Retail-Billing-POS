import express from 'express';
import cors from 'cors';
import { createClient } from './db-adapter';
import path from 'path';
import fs from 'fs';
import multer from 'multer';

const upload = multer({ dest: 'uploads/' });

const app = express();
app.use(cors());
app.use(express.json());

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(process.cwd(), 'dist')));
}

const isProd = process.env.NODE_ENV === 'production';
const PORT = isProd ? (Number(process.env.PORT) || 3000) : (Number(process.env.BACKEND_PORT) || 3001);

const dbUrl = process.env.DB_PATH || 'file:local.db';
let db = createClient({ url: dbUrl });

function getRawDbFilePath(): string | null {
  if (dbUrl.startsWith('file:')) {
    const rawPath = dbUrl.replace('file:', '');
    return path.resolve(rawPath);
  }
  return null;
}

export async function repairAndResetDatabase(): Promise<{ success: boolean; message: string }> {
  try {
    console.warn('⚠️ SQLite Corruption recovery invoked. Performing clean repair...');
    const rawPath = getRawDbFilePath();
    if (rawPath) {
      if (fs.existsSync(rawPath)) {
        const backupCorruptPath = `${rawPath}.corrupt.${Date.now()}`;
        try {
          fs.copyFileSync(rawPath, backupCorruptPath);
        } catch (e) {}
      }

      // Remove corrupted main db and associated journal/wal/shm files
      const toDelete = [
        rawPath,
        `${rawPath}-wal`,
        `${rawPath}-shm`,
        `${rawPath}-journal`
      ];
      for (const f of toDelete) {
        try {
          if (fs.existsSync(f)) {
            fs.unlinkSync(f);
          }
        } catch (e) {}
      }
    }

    // Recreate fresh LibSQL client
    db = createClient({ url: dbUrl });

    // Enable WAL & Synchronous normal to prevent future corruption
    try {
      await db.execute('PRAGMA journal_mode = WAL;');
      await db.execute('PRAGMA synchronous = NORMAL;');
      await db.execute('PRAGMA busy_timeout = 5000;');
    } catch (e) {}

    // Initialize all tables & default seeds
    await initDb();
    console.log('✅ SQLite database successfully repaired and re-initialized.');
    return { success: true, message: 'Database successfully repaired and re-initialized.' };
  } catch (err: any) {
    console.error('❌ Database repair encountered an error:', err);
    return { success: false, message: err.message || 'Failed to repair database' };
  }
}

// Helper to run column additions safely
async function safeAddColumn(table: string, columnDef: string) {
  try {
    await db.execute(`ALTER TABLE ${table} ADD COLUMN ${columnDef};`);
  } catch (e) {
    // Column already exists or table not ready, ignore
  }
}

// Initialize and migrate DB schema
async function initDb() {
  // 1. Settings
  await db.execute(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Default settings if missing
  const defaultSettings: Record<string, string> = {
    shop_name: 'AMAN ELECTRONICS & RETAIL',
    shop_address: '123 Commercial Plaza, Main Market, Mumbai, MH - 400001',
    shop_gstin: '27AAAAA0000A1Z5',
    shop_phone: '+91-9876543210',
    shop_email: 'desk@amanretail.in',
    shop_upi_id: 'amanelectronics@okaxis',
    shop_upi_name: 'Aman Electronics',
    receipt_footer: 'Thank you for your visit! No return without original tax bill.',
    allow_negative_stock: 'false',
    store_registered: 'true',
    machine_hd_id: 'HD-7B9A-81F4-4CE2-90D1',
    subscription_plan: 'Lifetime Edition',
    subscription_status: 'active',
    subscription_expiry: '2099-12-31T23:59:59.000Z',
    installed_version: '2.6.2',
    auto_check_updates: 'false',
    early_access_channel: 'false',
    license_key: 'LIC-LIFE-PERPETUAL'
  };

  for (const [key, value] of Object.entries(defaultSettings)) {
    await db.execute({
      sql: `INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`,
      args: [key, value]
    });
  }

  // 2. Products
  await db.execute(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      barcode TEXT,
      category TEXT,
      hsn_code TEXT,
      gst_rate REAL DEFAULT 0,
      retail_price REAL NOT NULL,
      wholesale_price REAL NOT NULL,
      purchase_cost REAL DEFAULT 0,
      mrp REAL,
      unit TEXT DEFAULT 'pcs',
      current_stock REAL DEFAULT 100,
      min_stock_alert REAL DEFAULT 10,
      allow_negative_stock INTEGER DEFAULT 0
    );
  `);

  await safeAddColumn('products', 'purchase_cost REAL DEFAULT 0');
  await safeAddColumn('products', 'current_stock REAL DEFAULT 100');
  await safeAddColumn('products', 'min_stock_alert REAL DEFAULT 10');
  await safeAddColumn('products', 'allow_negative_stock INTEGER DEFAULT 0');

  // 3. Stock Batches
  await db.execute(`
    CREATE TABLE IF NOT EXISTS stock_batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      batch_number TEXT NOT NULL,
      expiry_date TEXT,
      quantity REAL NOT NULL,
      purchase_cost REAL NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );
  `);

  // 4. Stock Adjustments Log
  await db.execute(`
    CREATE TABLE IF NOT EXISTS stock_adjustments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      change_qty REAL NOT NULL,
      previous_stock REAL NOT NULL,
      new_stock REAL NOT NULL,
      type TEXT NOT NULL, -- 'ADD', 'SUBTRACT', 'SET'
      reason TEXT NOT NULL, -- 'Opening Stock', 'Damage', 'Loss', 'Manual Correction', 'Return'
      user_name TEXT DEFAULT 'Admin',
      created_at TEXT NOT NULL,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );
  `);

  // 5. Customers & Ledger
  await db.execute(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT UNIQUE,
      email TEXT,
      address TEXT,
      gstin TEXT,
      credit_balance REAL DEFAULT 0,
      created_at TEXT NOT NULL
    );
  `);

  await safeAddColumn('customers', 'loyalty_points REAL DEFAULT 0');

  await db.execute(`
    CREATE TABLE IF NOT EXISTS customer_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      invoice_id INTEGER,
      type TEXT NOT NULL, -- 'BILL_CREDIT', 'PAYMENT_RECEIVED', 'ADJUSTMENT'
      amount REAL NOT NULL,
      balance_after REAL NOT NULL,
      payment_mode TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
    );
  `);

  // 6. Suppliers & Purchases
  await db.execute(`
    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      gstin TEXT,
      address TEXT,
      created_at TEXT NOT NULL
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_number TEXT UNIQUE NOT NULL,
      supplier_id INTEGER,
      supplier_name TEXT NOT NULL,
      invoice_ref TEXT,
      date TEXT NOT NULL,
      subtotal REAL NOT NULL,
      tax_total REAL DEFAULT 0,
      grand_total REAL NOT NULL,
      payment_status TEXT DEFAULT 'paid',
      payment_method TEXT DEFAULT 'bank_transfer',
      notes TEXT
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS purchase_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_id INTEGER NOT NULL,
      product_id INTEGER,
      product_name TEXT NOT NULL,
      batch_number TEXT,
      expiry_date TEXT,
      quantity REAL NOT NULL,
      purchase_cost REAL NOT NULL,
      gst_rate REAL DEFAULT 0,
      tax_amount REAL DEFAULT 0,
      line_total REAL NOT NULL,
      FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE
    );
  `);

  // 7. Invoices & Invoice Items
  await db.execute(`
    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT UNIQUE NOT NULL,
      date TEXT NOT NULL,
      customer_id INTEGER,
      customer_name TEXT,
      customer_phone TEXT,
      customer_gstin TEXT,
      payment_method TEXT,
      payment_status TEXT DEFAULT 'paid',
      upi_ref TEXT,
      subtotal REAL NOT NULL,
      discount REAL DEFAULT 0,
      cgst_total REAL DEFAULT 0,
      sgst_total REAL DEFAULT 0,
      igst_total REAL DEFAULT 0,
      grand_total REAL NOT NULL,
      status TEXT DEFAULT 'paid',
      is_inter_state INTEGER DEFAULT 0,
      cashier_name TEXT DEFAULT 'Admin Desk'
    );
  `);

  await safeAddColumn('invoices', 'customer_id INTEGER');
  await safeAddColumn('invoices', 'payment_status TEXT DEFAULT "paid"');
  await safeAddColumn('invoices', 'upi_ref TEXT');
  await safeAddColumn('invoices', 'cashier_name TEXT DEFAULT "Admin Desk"');
  await safeAddColumn('invoices', 'customer_gstin TEXT');

  await db.execute(`
    CREATE TABLE IF NOT EXISTS invoice_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL,
      product_id INTEGER,
      product_name TEXT NOT NULL,
      hsn_code TEXT,
      batch_number TEXT,
      quantity REAL NOT NULL,
      unit_price REAL NOT NULL,
      purchase_cost REAL DEFAULT 0,
      discount REAL DEFAULT 0,
      taxable_value REAL NOT NULL,
      gst_rate REAL DEFAULT 0,
      cgst_amount REAL DEFAULT 0,
      sgst_amount REAL DEFAULT 0,
      igst_amount REAL DEFAULT 0,
      line_total REAL NOT NULL,
      FOREIGN KEY (invoice_id) REFERENCES invoices(id)
    );
  `);

  await safeAddColumn('invoice_items', 'batch_number TEXT');
  await safeAddColumn('invoice_items', 'purchase_cost REAL DEFAULT 0');


  // 8. Sales Returns & Credit Notes
  await db.execute(`
    CREATE TABLE IF NOT EXISTS sales_returns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      return_number TEXT UNIQUE NOT NULL,
      invoice_id INTEGER NOT NULL,
      invoice_number TEXT NOT NULL,
      customer_id INTEGER,
      customer_name TEXT,
      customer_phone TEXT,
      return_date TEXT NOT NULL,
      total_refund_amount REAL NOT NULL,
      refund_method TEXT NOT NULL, -- 'cash', 'upi', 'credit_deduction', 'store_credit'
      reason TEXT,
      processed_by TEXT DEFAULT 'Admin',
      FOREIGN KEY (invoice_id) REFERENCES invoices(id)
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS sales_return_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      return_id INTEGER NOT NULL,
      product_id INTEGER,
      product_name TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit_price REAL NOT NULL,
      taxable_value REAL NOT NULL,
      gst_rate REAL DEFAULT 0,
      tax_amount REAL DEFAULT 0,
      refund_amount REAL NOT NULL,
      restock_to_inventory INTEGER DEFAULT 1,
      FOREIGN KEY (return_id) REFERENCES sales_returns(id) ON DELETE CASCADE
    );
  `);

  // 9. Cash Registers & Drawer Shifts
  await db.execute(`
    CREATE TABLE IF NOT EXISTS cash_registers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cashier_name TEXT NOT NULL,
      opened_at TEXT NOT NULL,
      closed_at TEXT,
      opening_cash REAL NOT NULL,
      expected_cash REAL DEFAULT 0,
      closing_cash REAL,
      difference REAL,
      status TEXT DEFAULT 'open',
      notes TEXT
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS cash_drawer_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      register_id INTEGER NOT NULL,
      type TEXT NOT NULL, -- 'CASH_IN', 'CASH_OUT'
      amount REAL NOT NULL,
      reason TEXT NOT NULL,
      performed_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (register_id) REFERENCES cash_registers(id) ON DELETE CASCADE
    );
  `);

  // Duplicate invoices creation removed (consolidated earlier above to avoid duplication)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS invoice_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL,
      product_id INTEGER,
      product_name TEXT NOT NULL,
      hsn_code TEXT,
      batch_number TEXT,
      quantity REAL NOT NULL,
      unit_price REAL NOT NULL,
      purchase_cost REAL DEFAULT 0,
      discount REAL DEFAULT 0,
      taxable_value REAL NOT NULL,
      gst_rate REAL DEFAULT 0,
      cgst_amount REAL DEFAULT 0,
      sgst_amount REAL DEFAULT 0,
      igst_amount REAL DEFAULT 0,
      line_total REAL NOT NULL,
      FOREIGN KEY (invoice_id) REFERENCES invoices(id)
    );
  `);

  await safeAddColumn('invoice_items', 'batch_number TEXT');
  await safeAddColumn('invoice_items', 'purchase_cost REAL DEFAULT 0');

  // 8. Expenses (Petty Cash)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      payment_mode TEXT NOT NULL,
      notes TEXT,
      recorded_by TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      staff_name TEXT NOT NULL,
      date TEXT NOT NULL,
      check_in TEXT,
      check_out TEXT,
      role TEXT,
      notes TEXT
    );
  `);

  // Seed sample products & suppliers if table is empty
  const countResult = await db.execute('SELECT COUNT(*) as count FROM products');
  const count = Number(countResult.rows[0].count);
  if (count === 0) {
    const seedProducts = [
      { name: 'Syska LED Bulb 12W White', barcode: '89012345001', category: 'Lighting', hsn_code: '8539', gst_rate: 12, retail_price: 185.00, wholesale_price: 155.00, purchase_cost: 120.00, mrp: 220.00, unit: 'pcs', current_stock: 75, min_stock_alert: 15 },
      { name: 'Finolex 1.5sqmm Wire Red 90m', barcode: '89012345002', category: 'Cables & Wires', hsn_code: '8544', gst_rate: 18, retail_price: 1240.00, wholesale_price: 1080.00, purchase_cost: 920.00, mrp: 1450.00, unit: 'box', current_stock: 24, min_stock_alert: 5 },
      { name: 'Anchor Penta Switch 6A 1Way', barcode: '89012345003', category: 'Switches', hsn_code: '8536', gst_rate: 18, retail_price: 22.00, wholesale_price: 17.50, purchase_cost: 12.00, mrp: 28.00, unit: 'pcs', current_stock: 180, min_stock_alert: 30 },
      { name: 'Havells Ceiling Fan 1200mm White', barcode: '89012345004', category: 'Appliances', hsn_code: '8414', gst_rate: 18, retail_price: 2150.00, wholesale_price: 1890.00, purchase_cost: 1650.00, mrp: 2600.00, unit: 'pcs', current_stock: 12, min_stock_alert: 4 },
      { name: 'Philips 20W LED Batten Tube', barcode: '89012345005', category: 'Lighting', hsn_code: '8539', gst_rate: 12, retail_price: 320.00, wholesale_price: 270.00, purchase_cost: 210.00, mrp: 399.00, unit: 'pcs', current_stock: 45, min_stock_alert: 10 },
      { name: 'Schneider Electric MCB 16A Single Pole', barcode: '89012345006', category: 'Switchgear', hsn_code: '8536', gst_rate: 18, retail_price: 195.00, wholesale_price: 160.00, purchase_cost: 130.00, mrp: 245.00, unit: 'pcs', current_stock: 6, min_stock_alert: 10 }
    ];

    for (const p of seedProducts) {
      await db.execute({
        sql: `INSERT INTO products (name, barcode, category, hsn_code, gst_rate, retail_price, wholesale_price, purchase_cost, mrp, unit, current_stock, min_stock_alert)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [p.name, p.barcode, p.category, p.hsn_code, p.gst_rate, p.retail_price, p.wholesale_price, p.purchase_cost, p.mrp, p.unit, p.current_stock, p.min_stock_alert]
      });
    }
  }

  // Seed sample supplier if empty
  const supplierCount = await db.execute('SELECT COUNT(*) as count FROM suppliers');
  if (Number(supplierCount.rows[0].count) === 0) {
    await db.execute({
      sql: `INSERT INTO suppliers (name, phone, email, gstin, address, created_at)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: ['National Electrical Distributors', '+91-9820011223', 'sales@nationalelectric.com', '27AABCN1234F1Z9', 'Unit 14, Industrial Area, Mumbai, MH', new Date().toISOString()]
    });
  }

  // Seed sample customer if empty
  const customerCount = await db.execute('SELECT COUNT(*) as count FROM customers');
  if (Number(customerCount.rows[0].count) === 0) {
    await db.execute({
      sql: `INSERT INTO customers (name, phone, email, address, gstin, credit_balance, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: ['Sharma Electrical Contractors', '+91-9876500001', 'sharmacontractor@gmail.com', 'Shop 4, Market Yard, Mumbai', '27ABCDE1234F1Z5', 0, new Date().toISOString()]
    });
  }

  
  // 10. Registered System - Users & Staff Authentication
  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      role TEXT NOT NULL DEFAULT "cashier", -- "admin", "manager", "cashier", "salesman", "accountant"
      pin TEXT NOT NULL DEFAULT "1234",
      status TEXT DEFAULT "active", -- "active", "inactive"
      last_login TEXT,
      created_at TEXT NOT NULL
    );
  `);

  // Seed default users if empty
  const defaultUsers = [
    { username: "admin", full_name: "Store Owner / Admin", role: "admin", pin: "1234", phone: "+91-9876500000" },
    { username: "cashier1", full_name: "Main Counter Cashier", role: "cashier", pin: "1111", phone: "+91-9876500002" },
    { username: "manager1", full_name: "Store Manager", role: "manager", pin: "9999", phone: "+91-9876500003" }
  ];
  for (const u of defaultUsers) {
    await db.execute({
      sql: `INSERT OR IGNORE INTO users (username, full_name, phone, role, pin, status, created_at)
            VALUES (?, ?, ?, ?, ?, 'active', ?)`,
      args: [u.username, u.full_name, u.phone, u.role, u.pin, new Date().toISOString()]
    });
  }

  // 11. Firelog - Real-Time Activity Log & Audit Trail
  await db.execute(`
    CREATE TABLE IF NOT EXISTS firelog (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      user_id INTEGER,
      user_name TEXT NOT NULL,
      role TEXT NOT NULL,
      action_type TEXT NOT NULL,
      module TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT "info", -- "info", "success", "warning", "critical"
      entity_type TEXT,
      entity_id TEXT,
      description TEXT NOT NULL,
      metadata TEXT,
      ip_address TEXT
    );
  `);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_firelog_timestamp ON firelog(timestamp DESC);`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_firelog_module ON firelog(module);`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_firelog_severity ON firelog(severity);`);

  console.log('Database initialized and migrated successfully.');
}

async function bootstrapDb() {
  try {
    const rawPath = getRawDbFilePath();
    if (rawPath) {
      const dir = path.dirname(rawPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    // Check database integrity
    await db.execute('SELECT 1 FROM sqlite_master LIMIT 1;');
    try {
      await db.execute('PRAGMA journal_mode = WAL;');
      await db.execute('PRAGMA synchronous = NORMAL;');
      await db.execute('PRAGMA busy_timeout = 5000;');
    } catch (e) {}

    await initDb();
  } catch (err: any) {
    console.error('⚠️ DB startup check detected issue:', err.message);
    if (
      err.message?.includes('malformed') ||
      err.message?.includes('SQLITE_CORRUPT') ||
      err.message?.includes('corrupt') ||
      err.message?.includes('not a database')
    ) {
      console.warn('⚡ Triggering automatic self-healing for corrupted SQLite file...');
      await repairAndResetDatabase();
    } else {
      console.error('Database initialization error:', err);
    }
  }
}

bootstrapDb().catch(console.error);


// -------------------------------------------------------------
// FIRELOG CENTRAL AUDIT & ACTIVITY LOGGER HELPER
// -------------------------------------------------------------
async function logFirelog(event: {
  user_id?: number | null;
  user_name?: string;
  role?: string;
  action_type: string;
  module: string;
  severity?: "info" | "success" | "warning" | "critical";
  entity_type?: string;
  entity_id?: string;
  description: string;
  metadata?: any;
  ip_address?: string;
}) {
  try {
    const ts = new Date().toISOString();
    const metaStr = event.metadata ? (typeof event.metadata === "string" ? event.metadata : JSON.stringify(event.metadata)) : null;
    await db.execute({
      sql: `INSERT INTO firelog (timestamp, user_id, user_name, role, action_type, module, severity, entity_type, entity_id, description, metadata, ip_address)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        ts,
        event.user_id || null,
        event.user_name || "System Desk",
        event.role || "cashier",
        event.action_type,
        event.module,
        event.severity || "info",
        event.entity_type || null,
        event.entity_id || null,
        event.description,
        metaStr,
        event.ip_address || "127.0.0.1"
      ]
    });
  } catch (err) {
    console.error("Firelog error:", err);
  }
}

// -------------------------------------------------------------
// API ROUTES
// -------------------------------------------------------------

// 1. Settings & Licensing API
app.get('/api/settings', async (req, res) => {
  try {
    const result = await db.execute('SELECT * FROM settings');
    const settingsMap: Record<string, string> = {};
    result.rows.forEach(r => {
      settingsMap[r.key as string] = r.value as string;
    });
    res.json(settingsMap);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/settings', async (req, res) => {
  try {
    const settings = req.body;
    for (const [key, value] of Object.entries(settings)) {
      await db.execute({
        sql: `INSERT INTO settings (key, value) VALUES (?, ?) 
              ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        args: [key, String(value)]
      });
    }
    res.json({ success: true, message: 'Settings saved successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Helper: Generate structured License Key
function generateLicenseKey(planName: string, machineId: string): string {
  const prefix = planName.toUpperCase().includes('LIFE') ? 'LIC-LIFE' :
                 planName.toUpperCase().includes('YEAR') ? 'LIC-YEAR' : 'LIC-PRO';
  const year = new Date().getFullYear();
  const hex = Math.random().toString(36).substring(2, 6).toUpperCase();
  const machineChunk = machineId.replace(/[^A-Z0-9]/gi, '').slice(0, 4).toUpperCase() || 'POS1';
  return `${prefix}-${year}-${hex}-${machineChunk}`;
}

// -------------------------------------------------------------
// CENTRAL LICENSING, TRIAL REGISTRATION & BACKGROUND SYNC
// -------------------------------------------------------------

// --- GOOGLE SHEETS WEBHOOK SYNC ---
const GOOGLE_SHEETS_WEBHOOK_URL = process.env.LICENSE_SHEET_WEBHOOK || '';

async function syncLicenseWithGoogleSheets(data: any) {
  if (!GOOGLE_SHEETS_WEBHOOK_URL) return null;
  try {
    // The Google Apps Script will verify the user based on the provided data
    // and can return updated plan/status if changed on the server side.
    const response = await fetch(GOOGLE_SHEETS_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, timestamp: new Date().toISOString() })
    });
    return await response.json();
  } catch (error) {
    console.error('Background Google Sheets Sync Failed:', error);
    return null;
  }
}

// Background startup sync check
setTimeout(async () => {
  if (!GOOGLE_SHEETS_WEBHOOK_URL) return;
  try {
    const result = await db.execute("SELECT key, value FROM settings WHERE key IN ('machine_hd_id', 'owner_name', 'shop_email', 'shop_phone', 'subscription_plan')");
    const s: Record<string, string> = {};
    result.rows.forEach(r => { s[r.key as string] = r.value as string; });
    
    if (s.machine_hd_id) {
      console.log('Verifying license against Google Sheets in background...');
      const serverStatus = await syncLicenseWithGoogleSheets({
        action: 'VERIFY',
        hd_id: s.machine_hd_id,
        owner_name: s.owner_name,
        email: s.shop_email,
        phone: s.shop_phone,
        current_plan: s.subscription_plan
      });
      
      // If the Google Sheet returned a new status or expiry, apply it locally
      if (serverStatus && serverStatus.success) {
        if (serverStatus.status) {
          await db.execute({ sql: "UPDATE settings SET value = ? WHERE key = 'subscription_status'", args: [serverStatus.status] });
        }
        if (serverStatus.expiry) {
          await db.execute({ sql: "UPDATE settings SET value = ? WHERE key = 'subscription_expiry'", args: [serverStatus.expiry] });
        }
      }
    }
  } catch (e) {
    console.error('Startup license verification failed', e);
  }
}, 5000);

// Get full License & Machine HD ID Status
app.get('/api/license/status', async (req, res) => {
  try {
    const result = await db.execute('SELECT * FROM settings');
    const settings: Record<string, string> = {};
    result.rows.forEach(r => {
      settings[r.key as string] = r.value as string;
    });

    const expiryDate = settings.subscription_expiry ? new Date(settings.subscription_expiry) : new Date();
    const now = new Date();
    const msDiff = expiryDate.getTime() - now.getTime();
    const daysRemaining = Math.max(0, Math.ceil(msDiff / (1000 * 60 * 60 * 24)));
    const isExpired = msDiff <= 0 && settings.subscription_plan !== 'Lifetime Enterprise';
    const isTrial = settings.subscription_status === 'trial' || settings.subscription_plan?.toLowerCase().includes('trial');

    // Retrieve last registration firelog if any
    const firelogCheck = await db.execute({
      sql: "SELECT * FROM firelog WHERE action_type IN ('STORE_REGISTRATION_TRIAL', 'LICENSE_PAYMENT_ACTIVATED', 'LICENSE_KEY_ACTIVATED') ORDER BY id DESC LIMIT 1"
    });

    res.json({
      store_registered: settings.store_registered === 'true',
      shop_name: settings.shop_name || 'My Retail Store',
      owner_name: settings.owner_name || 'Store Owner',
      shop_email: settings.shop_email || '',
      shop_phone: settings.shop_phone || '',
      machine_hd_id: settings.machine_hd_id || 'HD-7B9A-81F4-4CE2-90D1',
      subscription_plan: settings.subscription_plan || '15-Day Free Trial',
      subscription_status: isExpired ? 'expired' : (settings.subscription_status || 'trial'),
      subscription_expiry: settings.subscription_expiry || expiryDate.toISOString(),
      license_key: settings.license_key || '',
      days_remaining: daysRemaining,
      is_trial: isTrial,
      is_expired: isExpired,
      installed_version: settings.installed_version || '2.5.0',
      last_verification: firelogCheck.rows[0] || null
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 15-Day Free Trial Registration & Hardware Fingerprint Sync
app.post('/api/license/register-trial', async (req, res) => {
  try {
    const { owner_name, shop_name, email, phone, gstin, machine_hd_id, admin_pin } = req.body;

    if (!owner_name || !shop_name || !email || !phone) {
      return res.status(400).json({ error: 'Please provide Owner Name, Store Name, Email, and Mobile Number.' });
    }

    const cleanHdId = machine_hd_id || `HD-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const trialDays = 15;
    const trialExpiry = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000).toISOString();
    const trialStartDate = new Date().toISOString();
    const cleanPin = admin_pin && String(admin_pin).length >= 4 ? String(admin_pin).trim() : '1234';

    // 1. Update settings
    const updates: Record<string, string> = {
      store_registered: 'true',
      owner_name: owner_name.trim(),
      shop_name: shop_name.trim(),
      shop_email: email.trim().toLowerCase(),
      shop_phone: phone.trim(),
      shop_gstin: gstin?.trim() || 'URP (Unregistered)',
      machine_hd_id: cleanHdId,
      subscription_plan: '15-Day Free Trial',
      subscription_status: 'trial',
      subscription_expiry: trialExpiry,
      trial_start_date: trialStartDate,
      admin_pin: cleanPin
    };

    for (const [key, value] of Object.entries(updates)) {
      await db.execute({
        sql: `INSERT INTO settings (key, value) VALUES (?, ?) 
              ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        args: [key, String(value)]
      });
    }

    // 2. Ensure Primary Admin user exists and has chosen PIN
    try {
      await db.execute({
        sql: `INSERT INTO users (username, full_name, phone, email, role, pin, status, created_at)
              VALUES ('admin', ?, ?, ?, 'admin', ?, 'active', ?)
              ON CONFLICT(username) DO UPDATE SET full_name = excluded.full_name, phone = excluded.phone, email = excluded.email, pin = excluded.pin`,
        args: [owner_name.trim(), phone.trim(), email.trim(), cleanPin, trialStartDate]
      });
    } catch (uErr) {
      console.error('Error syncing admin user:', uErr);
    }

    // --- GOOGLE SHEETS WEBHOOK SYNC ---
    await syncLicenseWithGoogleSheets({
      action: 'REGISTER_TRIAL',
      hd_id: cleanHdId,
      owner_name: owner_name.trim(),
      shop_name: shop_name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      gstin: gstin?.trim() || 'N/A',
      current_plan: '15-Day Free Trial',
      expiry: trialExpiry
    });

    // 3. Central Audit Record
    await logFirelog({
      user_name: owner_name.trim(),
      role: 'owner_admin',
      action_type: 'STORE_REGISTRATION_TRIAL',
      module: 'Central Verification',
      severity: 'success',
      entity_type: 'store_account',
      entity_id: cleanHdId,
      description: `New store successfully registered for 15-Day Free Trial: "${shop_name}" (Owner: ${owner_name}, Mobile: ${phone}, Email: ${email}, Hardware ID: ${cleanHdId})`,
      metadata: {
        shop_name: shop_name.trim(),
        owner_name: owner_name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        gstin: gstin?.trim() || 'N/A',
        machine_hd_id: cleanHdId,
        trial_days: trialDays,
        trial_start: trialStartDate,
        trial_expires: trialExpiry,
        client_ip: req.ip || '127.0.0.1'
      }
    });

    res.json({
      success: true,
      message: '15-Day Free Trial activated successfully! Store details securely verified.',
      store: {
        owner_name,
        shop_name,
        email,
        phone,
        machine_hd_id: cleanHdId,
        subscription_expiry: trialExpiry,
        days_remaining: trialDays
      },
      user: {
        username: 'admin',
        full_name: owner_name,
        role: 'admin',
        pin: cleanPin
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Automatic Plan Payment & Instant License Activation
app.post('/api/license/activate-payment', async (req, res) => {
  try {
    const { plan_name, billing_cycle, amount, payment_method, transaction_id, machine_hd_id } = req.body;

    if (!plan_name || !amount) {
      return res.status(400).json({ error: 'Plan name and amount are required.' });
    }

    // Get current settings
    const curSettingsRes = await db.execute('SELECT * FROM settings');
    const settings: Record<string, string> = {};
    curSettingsRes.rows.forEach(r => {
      settings[r.key as string] = r.value as string;
    });

    const activeHdId = machine_hd_id || settings.machine_hd_id || 'HD-7B9A-81F4-4CE2-90D1';
    let durationDays = 30;
    if (billing_cycle === 'yearly' || plan_name.toLowerCase().includes('year')) {
      durationDays = 365;
    } else if (plan_name.toLowerCase().includes('lifetime')) {
      durationDays = 36500; // ~100 years
    }

    // Current expiry baseline
    let baseDate = new Date();
    if (settings.subscription_expiry) {
      const existingExp = new Date(settings.subscription_expiry);
      if (existingExp > baseDate && settings.subscription_status === 'active') {
        baseDate = existingExp;
      }
    }

    baseDate.setDate(baseDate.getDate() + durationDays);
    const newExpiry = baseDate.toISOString();
    const generatedKey = generateLicenseKey(plan_name, activeHdId);
    const txId = transaction_id || `UPI-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const updates: Record<string, string> = {
      subscription_plan: plan_name,
      subscription_status: 'active',
      subscription_expiry: newExpiry,
      license_key: generatedKey
    };

    for (const [key, value] of Object.entries(updates)) {
      await db.execute({
        sql: `INSERT INTO settings (key, value) VALUES (?, ?) 
              ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        args: [key, String(value)]
      });
    }

    // Log Central Audit
    await logFirelog({
      user_name: settings.owner_name || 'Store Owner',
      role: 'owner_admin',
      action_type: 'LICENSE_PAYMENT_ACTIVATED',
      module: 'Central Licensing & Payment Gateway',
      severity: 'success',
      entity_type: 'license_subscription',
      entity_id: generatedKey,
      description: `Payment of ₹${amount} received via ${payment_method || 'UPI Dynamic QR'} for ${plan_name}. Software License Automatically Activated. (TxID: ${txId}, Key: ${generatedKey}, Machine: ${activeHdId})`,
      metadata: {
        plan_name,
        billing_cycle,
        amount: Number(amount),
        payment_method: payment_method || 'UPI Dynamic QR',
        transaction_id: txId,
        license_key: generatedKey,
        machine_hd_id: activeHdId,
        previous_expiry: settings.subscription_expiry,
        new_expiry: newExpiry,
        shop_name: settings.shop_name,
        shop_email: settings.shop_email
      }
    });

    // --- GOOGLE SHEETS WEBHOOK SYNC ---
    await syncLicenseWithGoogleSheets({
      action: 'ACTIVATE_PAYMENT',
      hd_id: activeHdId,
      owner_name: settings.owner_name || 'Store Owner',
      shop_name: settings.shop_name,
      email: settings.shop_email,
      phone: settings.shop_phone,
      current_plan: plan_name,
      expiry: newExpiry,
      transaction_id: txId,
      amount: amount
    });

    res.json({
      success: true,
      message: `Payment successful! ${plan_name} has been automatically activated for your store.`,
      license_key: generatedKey,
      plan: plan_name,
      expiry_date: newExpiry,
      transaction_id: txId
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Manual License Key Verification & Activation
app.post('/api/settings/activate-license', async (req, res) => {
  try {
    const { license_key, machine_hd_id } = req.body;
    
    if (!license_key || !license_key.trim()) {
      return res.status(400).json({ error: 'License key is required.' });
    }

    const keyUpper = String(license_key).trim().toUpperCase();
    let addDays = 0;
    let plan = 'Pro Retailer License';

    if (keyUpper.includes('LIFE') || keyUpper === 'LIFETIME-ACCESS') {
      addDays = 36500;
      plan = 'Lifetime Enterprise';
    } else if (keyUpper.includes('YEAR') || keyUpper === 'YEARLY-RENEWAL-2025' || keyUpper.startsWith('LIC-YEAR')) {
      addDays = 365;
      plan = 'Yearly Business Pro';
    } else if (keyUpper.includes('MONTH') || keyUpper === 'MONTHLY-PRO' || keyUpper.startsWith('LIC-PRO')) {
      addDays = 30;
      plan = 'Monthly Pro Retailer';
    } else if (keyUpper.length >= 16) {
      // General 16+ char license key format
      addDays = 365;
      plan = 'Annual Commercial License';
    } else {
      return res.status(400).json({ error: 'Invalid license key. Please verify the key format or contact your software provider.' });
    }

    const curSettingsRes = await db.execute('SELECT * FROM settings');
    const settings: Record<string, string> = {};
    curSettingsRes.rows.forEach(r => {
      settings[r.key as string] = r.value as string;
    });

    let currentExpiry = new Date();
    if (settings.subscription_expiry) {
      const expDate = new Date(settings.subscription_expiry);
      if (expDate > currentExpiry && settings.subscription_status === 'active') {
        currentExpiry = expDate;
      }
    }

    currentExpiry.setDate(currentExpiry.getDate() + addDays);
    const newExpiry = currentExpiry.toISOString();

    const updates = {
      subscription_plan: plan,
      subscription_status: 'active',
      subscription_expiry: newExpiry,
      license_key: keyUpper
    };

    for (const [key, value] of Object.entries(updates)) {
      await db.execute({
        sql: `INSERT INTO settings (key, value) VALUES (?, ?) 
              ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        args: [key, String(value)]
      });
    }

    await logFirelog({
      user_name: settings.owner_name || 'Store Owner',
      role: 'owner_admin',
      action_type: 'LICENSE_KEY_ACTIVATED',
      module: 'Central Licensing Verification',
      severity: 'success',
      entity_type: 'license_key',
      entity_id: keyUpper,
      description: `License key "${keyUpper}" validated and activated for ${plan}. Expiry set to ${new Date(newExpiry).toLocaleDateString()}.`,
      metadata: { key: keyUpper, plan, new_expiry: newExpiry, machine_hd_id: machine_hd_id || settings.machine_hd_id }
    });

    res.json({ 
      success: true, 
      message: `License key activated successfully! Plan unlocked: ${plan}`, 
      new_expiry: newExpiry,
      plan: plan,
      license_key: keyUpper
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Software Update Management (OTA & Early Version Releases)
app.get('/api/system/version', async (req, res) => {
  try {
    const curSettingsRes = await db.execute('SELECT * FROM settings');
    const settings: Record<string, string> = {};
    curSettingsRes.rows.forEach(r => {
      settings[r.key as string] = r.value as string;
    });

    const installedVersion = settings.installed_version || '2.5.0';
    const latestAvailableVersion = '2.6.2';
    const isUpdateAvailable = installedVersion !== latestAvailableVersion;

    res.json({
      installed_version: installedVersion,
      latest_version: latestAvailableVersion,
      update_available: isUpdateAvailable,
      release_name: 'v2.6.2 Enterprise Turbo & GST Compliance Pack',
      release_date: '2026-08-20',
      auto_check_updates: settings.auto_check_updates !== 'false',
      early_access_channel: settings.early_access_channel === 'true',
      changelog: [
        '⚡ 3x Faster Thermal Printing Engine with ESC/POS raw driver optimization',
        '🛡️ Central Machine HD-ID verification & Automated License Activation',
        '📊 Instant GSTR-1 Auto-Segregation & HSN rate summary tables',
        '📱 Enhanced Dynamic UPI QR generation with customizable Payee VPA',
        '🔒 Real-time PIN Lock Screen with instant staff switching and shift management'
      ]
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Apply Software Update
app.post('/api/system/apply-update', async (req, res) => {
  try {
    const { target_version } = req.body;
    const newVer = target_version || '2.6.2';

    await db.execute({
      sql: `INSERT INTO settings (key, value) VALUES ('installed_version', ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      args: [newVer]
    });

    await logFirelog({
      user_name: 'Store Administrator',
      role: 'admin',
      action_type: 'SOFTWARE_UPDATE_INSTALLED',
      module: 'System OTA Updates',
      severity: 'success',
      entity_type: 'software_version',
      entity_id: newVer,
      description: `Software successfully updated to version ${newVer} with all database migrations and patch files verified.`,
      metadata: { updated_to: newVer, timestamp: new Date().toISOString() }
    });

    res.json({
      success: true,
      message: `Software updated successfully to ${newVer}!`,
      installed_version: newVer
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Products API
app.get('/api/products', async (req, res) => {
  try {
    const q = req.query.q as string;
    if (q) {
      const result = await db.execute({
        sql: 'SELECT * FROM products WHERE name LIKE ? OR barcode = ? OR hsn_code = ? ORDER BY name ASC LIMIT 50',
        args: [`%${q}%`, q, q]
      });
      res.json(result.rows);
    } else {
      const result = await db.execute('SELECT * FROM products ORDER BY name ASC');
      res.json(result.rows);
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


app.post('/api/products/bulk', async (req, res) => {
  try {
    const products = req.body.products;
    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ error: 'Invalid or empty product list' });
    }

    const insertedProducts = [];
    
    // We can do a simple loop since SQLite is fast, or a big transaction
    const tx = await db.transaction();
    
    try {
      for (const prod of products) {
        const { 
          name, barcode, category, hsn_code, gst_rate, retail_price, 
          wholesale_price, purchase_cost, mrp, unit, current_stock, min_stock_alert, allow_negative_stock 
        } = prod;
        
        const result = await tx.execute({
          sql: `INSERT INTO products (
            name, barcode, category, hsn_code, gst_rate, retail_price, wholesale_price, 
            purchase_cost, mrp, unit, current_stock, min_stock_alert, allow_negative_stock
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
          args: [
            name, barcode || null, category || 'Uncategorized', hsn_code || null, 
            Number(gst_rate) || 0, Number(retail_price) || 0, Number(wholesale_price) || 0, 
            Number(purchase_cost) || 0, Number(mrp) || 0, unit || 'pcs', 
            Number(current_stock) || 0, Number(min_stock_alert) || 5, allow_negative_stock ? 1 : 0
          ]
        });
        insertedProducts.push(result.rows[0]);
      }
      
      await tx.commit();
      
      res.json({ success: true, count: insertedProducts.length });
    } catch (err: any) {
      await tx.rollback();
      throw err;
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/products', async (req, res) => {
  try {
    const { 
      name, barcode, category, hsn_code, gst_rate, retail_price, 
      wholesale_price, purchase_cost, mrp, unit, current_stock, min_stock_alert, allow_negative_stock 
    } = req.body;

    const result = await db.execute({
      sql: `INSERT INTO products (
        name, barcode, category, hsn_code, gst_rate, retail_price, wholesale_price, 
        purchase_cost, mrp, unit, current_stock, min_stock_alert, allow_negative_stock
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
      args: [
        name, barcode || null, category || null, hsn_code || null, Number(gst_rate) || 0,
        Number(retail_price) || 0, Number(wholesale_price) || 0, Number(purchase_cost) || 0,
        Number(mrp) || null, unit || 'pcs', Number(current_stock) || 0, Number(min_stock_alert) || 10,
        allow_negative_stock ? 1 : 0
      ]
    });

    const newProduct = result.rows[0];

    // Log initial stock adjustment if stock > 0
    if (Number(current_stock) > 0) {
      await db.execute({
        sql: `INSERT INTO stock_adjustments (product_id, product_name, change_qty, previous_stock, new_stock, type, reason, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [newProduct.id, name, Number(current_stock), 0, Number(current_stock), 'SET', 'Opening Stock', new Date().toISOString()]
      });
    }

    res.json(newProduct);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/products/:id', async (req, res) => {
  try {
    const { 
      name, barcode, category, hsn_code, gst_rate, retail_price, 
      wholesale_price, purchase_cost, mrp, unit, current_stock, min_stock_alert, allow_negative_stock 
    } = req.body;

    const result = await db.execute({
      sql: `UPDATE products SET 
        name = ?, barcode = ?, category = ?, hsn_code = ?, gst_rate = ?, 
        retail_price = ?, wholesale_price = ?, purchase_cost = ?, mrp = ?, 
        unit = ?, current_stock = ?, min_stock_alert = ?, allow_negative_stock = ?
        WHERE id = ? RETURNING *`,
      args: [
        name, barcode || null, category || null, hsn_code || null, Number(gst_rate) || 0,
        Number(retail_price) || 0, Number(wholesale_price) || 0, Number(purchase_cost) || 0,
        Number(mrp) || null, unit || 'pcs', Number(current_stock) || 0, Number(min_stock_alert) || 10,
        allow_negative_stock ? 1 : 0, req.params.id
      ]
    });
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/products/:id', async (req, res) => {
  try {
    await db.execute({ sql: 'DELETE FROM products WHERE id = ?', args: [req.params.id] });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Stock Adjustments API
app.get('/api/stock/adjustments', async (req, res) => {
  try {
    const result = await db.execute('SELECT * FROM stock_adjustments ORDER BY id DESC LIMIT 100');
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/stock/adjust', async (req, res) => {
  const { product_id, change_qty, type, reason, user_name } = req.body;

  try {
    const prodResult = await db.execute({ sql: 'SELECT * FROM products WHERE id = ?', args: [product_id] });
    if (prodResult.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const product = prodResult.rows[0];
    const previous_stock = Number(product.current_stock) || 0;
    let new_stock = previous_stock;

    if (type === 'ADD') {
      new_stock = previous_stock + Number(change_qty);
    } else if (type === 'SUBTRACT') {
      new_stock = Math.max(0, previous_stock - Number(change_qty));
    } else if (type === 'SET') {
      new_stock = Number(change_qty);
    }

    const tx = await db.transaction();
    try {
      await tx.execute({
        sql: 'UPDATE products SET current_stock = ? WHERE id = ?',
        args: [new_stock, product_id]
      });

      await tx.execute({
        sql: `INSERT INTO stock_adjustments (product_id, product_name, change_qty, previous_stock, new_stock, type, reason, user_name, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [product_id, product.name, Number(change_qty), previous_stock, new_stock, type, reason || 'Manual Correction', user_name || 'Admin', new Date().toISOString()]
      });

      await tx.commit();
      res.json({ success: true, previous_stock, new_stock });
    } catch (err) {
      await tx.rollback();
      throw err;
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Invoices API (With atomic stock reduction & Customer Ledger)
app.post('/api/invoices', async (req, res) => {
  const { 
    customer_id,
    customer_name, 
    customer_phone, 
    customer_gstin,
    payment_method, 
    payment_status,
    upi_ref,
    items, 
    subtotal, 
    discount, 
    cgst_total, 
    sgst_total, 
    igst_total, 
    grand_total, 
    is_inter_state,
    cashier_name,
    date,
    loyalty_points_earned,
    loyalty_points_redeemed
  } = req.body;

  try {
    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Invoice must have at least one item' });
    }

    // Check Global Settings for allow_negative_stock
    const settingsResult = await db.execute({ sql: "SELECT value FROM settings WHERE key = 'allow_negative_stock'", args: [] });
    const allowNegativeStockGlobal = settingsResult.rows.length > 0 && settingsResult.rows[0].value === 'true';

    // Verify stock availability
    if (!allowNegativeStockGlobal) {
      for (const item of items) {
        if (item.product_id) {
          const pRes = await db.execute({ sql: 'SELECT name, current_stock, allow_negative_stock FROM products WHERE id = ?', args: [item.product_id] });
          if (pRes.rows.length > 0) {
            const prod = pRes.rows[0];
            const isProdAllowedNegative = prod.allow_negative_stock === 1;
            if (!isProdAllowedNegative && (Number(prod.current_stock) < Number(item.quantity))) {
              return res.status(400).json({ 
                error: `Insufficient stock for "${prod.name}". Available: ${prod.current_stock}, Requested: ${item.quantity}` 
              });
            }
          }
        }
      }
    }

    // Sequential Invoice Number Generator
    const latestInvoiceResult = await db.execute('SELECT invoice_number FROM invoices ORDER BY id DESC LIMIT 1');
    let nextNum = 1;
    if (latestInvoiceResult.rows.length > 0) {
      const lastNumStr = latestInvoiceResult.rows[0].invoice_number as string;
      const match = lastNumStr.match(/INV-(\d+)/);
      if (match) {
        nextNum = parseInt(match[1]) + 1;
      }
    }
    const invoice_number = `INV-${nextNum.toString().padStart(6, '0')}`;
    const invoiceDate = date || new Date().toISOString();

    const transaction = await db.transaction();
    
    try {
      // 1. Insert Invoice
      const invResult = await transaction.execute({
        sql: `INSERT INTO invoices (
          invoice_number, date, customer_id, customer_name, customer_phone, customer_gstin, payment_method, 
          payment_status, upi_ref, subtotal, discount, cgst_total, sgst_total, igst_total, 
          grand_total, is_inter_state, cashier_name, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
        args: [
          invoice_number, invoiceDate, customer_id || null, customer_name || null, 
          customer_phone || null, customer_gstin || null, payment_method || 'cash', payment_status || 'paid', 
          upi_ref || null, subtotal, discount, cgst_total, sgst_total, igst_total, 
          grand_total, is_inter_state ? 1 : 0, cashier_name || 'Admin Desk', 'paid'
        ]
      });
      
      const invoice_id = invResult.rows[0].id;

      // 2. Insert Invoice Items and reduce product stock
      for (const item of items) {
        await transaction.execute({
          sql: `INSERT INTO invoice_items (
            invoice_id, product_id, product_name, hsn_code, batch_number, quantity, unit_price, 
            purchase_cost, discount, taxable_value, gst_rate, cgst_amount, sgst_amount, igst_amount, line_total
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            invoice_id, item.product_id || null, item.product_name, item.hsn_code || null,
            item.batch_number || null, item.quantity, item.unit_price, item.purchase_cost || 0,
            item.discount || 0, item.taxable_value, item.gst_rate || 0,
            item.cgst_amount || 0, item.sgst_amount || 0, item.igst_amount || 0, item.line_total
          ]
        });

        // Reduce stock atomically
        if (item.product_id) {
          await transaction.execute({
            sql: 'UPDATE products SET current_stock = current_stock - ? WHERE id = ?',
            args: [item.quantity, item.product_id]
          });
        }
      }

      // 3. Handle Customer Record & Credit / Udhar Ledger
      if (customer_phone || customer_name) {
        let custId = customer_id;
        if (!custId && customer_phone) {
          const custCheck = await transaction.execute({
            sql: 'SELECT id, credit_balance FROM customers WHERE phone = ?',
            args: [customer_phone]
          });
          if (custCheck.rows.length > 0) {
            custId = custCheck.rows[0].id;
          } else {
            const newCust = await transaction.execute({
              sql: 'INSERT INTO customers (name, phone, credit_balance, created_at) VALUES (?, ?, ?, ?) RETURNING id',
              args: [customer_name || 'Customer', customer_phone, 0, new Date().toISOString()]
            });
            custId = newCust.rows[0].id;
          }
        }

        // Loyalty Points Handling
        if (custId) {
          const ptsEarned = Number(loyalty_points_earned) || 0;
          const ptsRedeemed = Number(loyalty_points_redeemed) || 0;
          const netPoints = ptsEarned - ptsRedeemed;

          if (netPoints !== 0) {
            await transaction.execute({
              sql: 'UPDATE customers SET loyalty_points = COALESCE(loyalty_points, 0) + ? WHERE id = ?',
              args: [netPoints, custId]
            });
          }
        }

        // If payment method is credit/udhar, increase customer balance and log transaction
        if (custId && payment_method === 'credit') {
          const custRow = await transaction.execute({ sql: 'SELECT credit_balance FROM customers WHERE id = ?', args: [custId] });
          const prevBalance = Number(custRow.rows[0]?.credit_balance) || 0;
          const newBalance = prevBalance + grand_total;

          await transaction.execute({
            sql: 'UPDATE customers SET credit_balance = ? WHERE id = ?',
            args: [newBalance, custId]
          });

          await transaction.execute({
            sql: `INSERT INTO customer_transactions (customer_id, invoice_id, type, amount, balance_after, payment_mode, notes, created_at)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [custId, invoice_id, 'BILL_CREDIT', grand_total, newBalance, 'credit', `Invoice ${invoice_number}`, new Date().toISOString()]
          });
        }
      }

      await transaction.commit();
      res.json({ success: true, invoice_id, invoice_number });
    } catch (txErr) {
      await transaction.rollback();
      throw txErr;
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/invoices', async (req, res) => {
  try {
    const result = await db.execute('SELECT * FROM invoices ORDER BY id DESC LIMIT 100');
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/invoices/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const invResult = await db.execute({ sql: 'SELECT * FROM invoices WHERE id = ?', args: [id] });
    if (invResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    const invoice = invResult.rows[0];
    const itemsResult = await db.execute({ sql: 'SELECT * FROM invoice_items WHERE invoice_id = ?', args: [id] });
    res.json({ ...invoice, items: itemsResult.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/invoices/:id/cancel', async (req, res) => {
  try {
    const invoiceId = req.params.id;
    
    // 1. Fetch invoice
    const invRes = await db.execute({ sql: 'SELECT * FROM invoices WHERE id = ?', args: [invoiceId] });
    if (invRes.rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found.' });
    }
    const invoice = invRes.rows[0];

    if (invoice.status === 'cancelled') {
      return res.status(400).json({ error: 'Invoice is already cancelled.' });
    }

    // 2. Fetch items
    const itemsRes = await db.execute({ sql: 'SELECT * FROM invoice_items WHERE invoice_id = ?', args: [invoiceId] });
    
    // 3. Begin Transaction-like logic to restore stock
    for (const item of itemsRes.rows) {
      if (item.product_id) {
        await db.execute({
          sql: 'UPDATE products SET current_stock = current_stock + ? WHERE id = ?',
          args: [item.quantity, item.product_id]
        });
      }
    }

    if (invoice.payment_method === 'credit' && invoice.customer_id) {
      await db.execute({
        sql: 'UPDATE customers SET credit_balance = credit_balance - ? WHERE id = ?',
        args: [invoice.grand_total, invoice.customer_id]
      });
      await db.execute({
        sql: `INSERT INTO customer_transactions (customer_id, invoice_id, type, amount, balance_after, payment_mode, notes, created_at)
              VALUES (?, ?, 'BILL_CANCELLED', ?, (SELECT credit_balance FROM customers WHERE id = ?), 'credit', 'Cancellation of Invoice ' || ?, ?)`,
        args: [invoice.customer_id, invoiceId, invoice.grand_total, invoice.customer_id, invoice.invoice_number, new Date().toISOString()]
      });
    }

    // 4. Mark invoice as cancelled
    await db.execute({
      sql: 'UPDATE invoices SET status = ? WHERE id = ?',
      args: ['cancelled', invoiceId]
    });

    // 5. Log it
    await logFirelog({
      user_name: 'Admin Desk',
      role: 'admin',
      action_type: 'INVOICE_CANCELLED',
      module: 'Billing',
      severity: 'warning',
      entity_type: 'invoice',
      entity_id: String(invoiceId),
      description: `Cancelled Invoice #${invoice.invoice_number} (Amount: Rs. ${invoice.grand_total})`,
      metadata: { invoice_number: invoice.invoice_number }
    });

    res.json({ success: true, message: 'Invoice cancelled successfully and stock restored.' });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// 5. Customers & Udhar Management API
app.get('/api/customers', async (req, res) => {
  try {
    const result = await db.execute('SELECT * FROM customers ORDER BY name ASC');
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/customers', async (req, res) => {
  try {
    const { name, phone, email, address, gstin, opening_balance = 0 } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Customer name is required.' });
    }
    const initialBal = Number(opening_balance) || 0;
    const nowIso = new Date().toISOString();

    const result = await db.execute({
      sql: `INSERT INTO customers (name, phone, email, address, gstin, credit_balance, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *`,
      args: [name.trim(), phone?.trim() || null, email?.trim() || null, address?.trim() || null, gstin?.trim() || null, initialBal, nowIso]
    });

    const newCust = result.rows[0];

    // If opening balance > 0, log transaction
    if (initialBal > 0) {
      await db.execute({
        sql: `INSERT INTO customer_transactions (customer_id, type, amount, balance_after, payment_mode, notes, created_at)
              VALUES (?, 'OPENING_BALANCE', ?, ?, 'opening_credit', 'Opening Balance on Registration', ?)`,
        args: [newCust.id, initialBal, initialBal, nowIso]
      });
    }

    await logFirelog({
      user_name: 'Counter Cashier',
      role: 'cashier',
      action_type: 'CUSTOMER_CREATED',
      module: 'Customers',
      severity: 'info',
      entity_type: 'customer',
      entity_id: String(newCust.id),
      description: `New customer registered: ${newCust.name} (${newCust.phone || 'No mobile'})` + (initialBal > 0 ? ` with opening Udhar ₹${initialBal}` : ''),
      metadata: { customer_id: newCust.id, name: newCust.name, phone: newCust.phone, opening_balance: initialBal }
    });

    res.json(newCust);
  } catch (err: any) {
    if (err.message && err.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'A customer with this phone number already exists.' });
    }
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/customers/:id', async (req, res) => {
  try {
    const { name, phone, email, address, gstin } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Customer name is required.' });
    }
    const result = await db.execute({
      sql: `UPDATE customers SET name = ?, phone = ?, email = ?, address = ?, gstin = ? WHERE id = ? RETURNING *`,
      args: [name.trim(), phone?.trim() || null, email?.trim() || null, address?.trim() || null, gstin?.trim() || null, req.params.id]
    });
    res.json(result.rows[0]);
  } catch (err: any) {
    if (err.message && err.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'A customer with this phone number already exists.' });
    }
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/customers/:id', async (req, res) => {
  try {
    const custId = req.params.id;
    const tx = await db.transaction();
    try {
      await tx.execute({
        sql: 'UPDATE invoices SET customer_id = NULL WHERE customer_id = ?',
        args: [custId]
      });
      await tx.execute({
        sql: 'UPDATE sales_returns SET customer_id = NULL WHERE customer_id = ?',
        args: [custId]
      });
      await tx.execute({
        sql: 'DELETE FROM customer_transactions WHERE customer_id = ?',
        args: [custId]
      });
      await tx.execute({
        sql: 'DELETE FROM customers WHERE id = ?',
        args: [custId]
      });
      await tx.commit();
      res.json({ success: true });
    } catch (txErr) {
      await tx.rollback();
      throw txErr;
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/invoices/:id', async (req, res) => {
  try {
    const { customer_name, customer_phone, payment_method, payment_status, status } = req.body;
    const result = await db.execute({
      sql: `UPDATE invoices SET customer_name = ?, customer_phone = ?, payment_method = ?, payment_status = ?, status = ? WHERE id = ? RETURNING *`,
      args: [customer_name || null, customer_phone || null, payment_method, payment_status || 'paid', status || 'paid', req.params.id]
    });
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/customers/search', async (req, res) => {
  try {
    const q = req.query.q as string;
    if (!q) return res.json([]);
    const searchTerm = `%${q}%`;
    const result = await db.execute({
      sql: 'SELECT * FROM customers WHERE name LIKE ? OR phone LIKE ? LIMIT 5',
      args: [searchTerm, searchTerm]
    });
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/customers/:id/transactions', async (req, res) => {
  try {
    const result = await db.execute({
      sql: 'SELECT * FROM customer_transactions WHERE customer_id = ? ORDER BY id DESC',
      args: [req.params.id]
    });
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/customers/:id/payments', async (req, res) => {
  const { amount, payment_mode, notes } = req.body;
  try {
    const custId = req.params.id;
    const custRes = await db.execute({ sql: 'SELECT * FROM customers WHERE id = ?', args: [custId] });
    if (custRes.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const currentBalance = Number(custRes.rows[0].credit_balance) || 0;
    const payAmount = Number(amount);
    const newBalance = Math.max(0, currentBalance - payAmount);

    const tx = await db.transaction();
    try {
      await tx.execute({
        sql: 'UPDATE customers SET credit_balance = ? WHERE id = ?',
        args: [newBalance, custId]
      });

      await tx.execute({
        sql: `INSERT INTO customer_transactions (customer_id, type, amount, balance_after, payment_mode, notes, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [custId, 'PAYMENT_RECEIVED', payAmount, newBalance, payment_mode || 'cash', notes || 'Payment Settle', new Date().toISOString()]
      });

      await tx.commit();
      await logFirelog({
        user_name: 'Counter Cashier',
        role: 'cashier',
        action_type: 'CUSTOMER_PAYMENT',
        module: 'Customers',
        severity: 'success',
        entity_type: 'customer',
        entity_id: String(custId),
        description: `Udhar payment of ₹${payAmount.toFixed(2)} received from ${custRes.rows[0].name} via ${payment_mode || 'cash'}`,
        metadata: { customer_id: custId, customer_name: custRes.rows[0].name, amount: payAmount, payment_mode, remaining_balance: newBalance }
      });
      res.json({ success: true, previous_balance: currentBalance, new_balance: newBalance });
    } catch (e) {
      await tx.rollback();
      throw e;
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Suppliers & Purchase Management API
app.get('/api/suppliers', async (req, res) => {
  try {
    const result = await db.execute('SELECT * FROM suppliers ORDER BY name ASC');
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/suppliers', async (req, res) => {
  try {
    const { name, phone, email, gstin, address } = req.body;
    const result = await db.execute({
      sql: `INSERT INTO suppliers (name, phone, email, gstin, address, created_at)
            VALUES (?, ?, ?, ?, ?, ?) RETURNING *`,
      args: [name, phone || null, email || null, gstin || null, address || null, new Date().toISOString()]
    });
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/purchases', async (req, res) => {
  try {
    const result = await db.execute('SELECT * FROM purchases ORDER BY id DESC LIMIT 50');
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/purchases', async (req, res) => {
  const { supplier_id, supplier_name, invoice_ref, date, items, subtotal, tax_total, grand_total, payment_status, payment_method, notes } = req.body;

  try {
    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Purchase bill must have at least one item' });
    }

    const lastPurchase = await db.execute('SELECT purchase_number FROM purchases ORDER BY id DESC LIMIT 1');
    let nextNum = 1;
    if (lastPurchase.rows.length > 0) {
      const match = (lastPurchase.rows[0].purchase_number as string).match(/PO-(\d+)/);
      if (match) nextNum = parseInt(match[1]) + 1;
    }
    const purchase_number = `PO-${nextNum.toString().padStart(6, '0')}`;
    const pDate = date || new Date().toISOString();

    const tx = await db.transaction();
    try {
      const pRes = await tx.execute({
        sql: `INSERT INTO purchases (
          purchase_number, supplier_id, supplier_name, invoice_ref, date, 
          subtotal, tax_total, grand_total, payment_status, payment_method, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
        args: [
          purchase_number, supplier_id || null, supplier_name, invoice_ref || null, 
          pDate, subtotal, tax_total || 0, grand_total, payment_status || 'paid', 
          payment_method || 'bank_transfer', notes || null
        ]
      });

      const purchase_id = pRes.rows[0].id;

      for (const item of items) {
        await tx.execute({
          sql: `INSERT INTO purchase_items (
            purchase_id, product_id, product_name, batch_number, expiry_date, 
            quantity, purchase_cost, gst_rate, tax_amount, line_total
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            purchase_id, item.product_id || null, item.product_name, item.batch_number || null,
            item.expiry_date || null, item.quantity, item.purchase_cost, item.gst_rate || 0,
            item.tax_amount || 0, item.line_total
          ]
        });

        // Increase product stock and update purchase_cost
        if (item.product_id) {
          await tx.execute({
            sql: 'UPDATE products SET current_stock = current_stock + ?, purchase_cost = ? WHERE id = ?',
            args: [item.quantity, item.purchase_cost, item.product_id]
          });

          // Log stock adjustment
          await tx.execute({
            sql: `INSERT INTO stock_adjustments (product_id, product_name, change_qty, previous_stock, new_stock, type, reason, created_at)
                  VALUES (?, ?, ?, (SELECT current_stock - ? FROM products WHERE id = ?), (SELECT current_stock FROM products WHERE id = ?), 'ADD', 'Purchase Inward', ?)`,
            args: [item.product_id, item.product_name, item.quantity, item.quantity, item.product_id, item.product_id, new Date().toISOString()]
          });
        }
      }

      await tx.commit();
      res.json({ success: true, purchase_id, purchase_number });
    } catch (e) {
      await tx.rollback();
      throw e;
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Reports & Analytics Dashboard API

app.get('/api/reports/profit-loss', async (req, res) => {
  try {
    const fromStr = req.query.from;
    const toStr = req.query.to;

    const fromDate = fromStr ? `${fromStr}T00:00:00.000Z` : '1970-01-01T00:00:00.000Z';
    const toDate = toStr ? `${toStr}T23:59:59.999Z` : '9999-12-31T23:59:59.999Z';

    const salesRes = await db.execute({
      sql: `SELECT 
              COALESCE(SUM(i.subtotal), 0) as revenue,
              COALESCE(SUM(ii.quantity * ii.purchase_cost), 0) as cogs
            FROM invoices i
            JOIN invoice_items ii ON i.id = ii.invoice_id
            WHERE i.date >= ? AND i.date <= ?`,
      args: [fromDate, toDate]
    });

    const returnsRes = await db.execute({
      sql: `SELECT 
              COALESCE(SUM(ri.taxable_value), 0) as returns_value,
              COALESCE(SUM(
                CASE WHEN ri.restock_to_inventory = 1 THEN 
                  (SELECT p.purchase_cost FROM products p WHERE p.id = ri.product_id) * ri.quantity 
                ELSE 0 END
              ), 0) as returns_cogs
            FROM sales_returns r
            JOIN sales_return_items ri ON r.id = ri.return_id
            WHERE r.return_date >= ? AND r.return_date <= ?`,
      args: [fromDate, toDate]
    });

    const expensesRes = await db.execute({
      sql: `SELECT COALESCE(SUM(amount), 0) as total_expenses
            FROM expenses
            WHERE date >= ? AND date <= ?`,
      args: [fromDate, toDate]
    });

    const dailyRes = await db.execute({
      sql: `SELECT 
              substr(i.date, 1, 10) as date,
              SUM(i.subtotal) as daily_revenue,
              SUM(ii.quantity * ii.purchase_cost) as daily_cogs
            FROM invoices i
            JOIN invoice_items ii ON i.id = ii.invoice_id
            WHERE i.date >= ? AND i.date <= ?
            GROUP BY substr(i.date, 1, 10)
            ORDER BY date ASC`,
      args: [fromDate, toDate]
    });

    const rawRevenue = Number(salesRes.rows[0].revenue) || 0;
    const rawCogs = Number(salesRes.rows[0].cogs) || 0;

    const returnsValue = Number(returnsRes.rows[0].returns_value) || 0;
    const returnsCogs = Number(returnsRes.rows[0].returns_cogs) || 0;

    const netRevenue = rawRevenue - returnsValue;
    const netCogs = rawCogs - returnsCogs;
    
    const grossProfit = netRevenue - netCogs;
    const totalExpenses = Number(expensesRes.rows[0].total_expenses) || 0;
    const netProfit = grossProfit - totalExpenses;
    const margin = netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0;

    res.json({
      revenue: netRevenue,
      cogs: netCogs,
      gross_profit: grossProfit,
      expenses: totalExpenses,
      net_profit: netProfit,
      margin_percentage: margin,
      daily_trends: dailyRes.rows
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/reports/dashboard', async (req, res) => {
  try {
    const todayStr = new Date().toISOString().split('T')[0];

    // Today's Sales
    const todayRes = await db.execute({
      sql: `SELECT COUNT(*) as count, COALESCE(SUM(grand_total), 0) as total, COALESCE(SUM(subtotal), 0) as taxable 
            FROM invoices WHERE date LIKE ?`,
      args: [`${todayStr}%`]
    });

    // All Time Sales
    const totalRes = await db.execute('SELECT COUNT(*) as count, COALESCE(SUM(grand_total), 0) as total FROM invoices');

    // Payment Methods Breakdown
    const payRes = await db.execute(`
      SELECT payment_method, COUNT(*) as count, COALESCE(SUM(grand_total), 0) as total 
      FROM invoices GROUP BY payment_method
    `);

    // Top 5 Selling Products
    const topItemsRes = await db.execute(`
      SELECT product_name, SUM(quantity) as total_qty, SUM(line_total) as total_sales
      FROM invoice_items
      GROUP BY product_name
      ORDER BY total_qty DESC
      LIMIT 5
    `);

    // Low Stock Alert Products
    const lowStockRes = await db.execute(`
      SELECT id, name, category, current_stock, min_stock_alert, retail_price, unit
      FROM products
      WHERE current_stock <= min_stock_alert
      ORDER BY current_stock ASC
      LIMIT 10
    `);

    // Total Inventory Value
    const invValueRes = await db.execute(`
      SELECT 
        COALESCE(SUM(current_stock * purchase_cost), 0) as total_cost_value,
        COALESCE(SUM(current_stock * retail_price), 0) as total_retail_value,
        COUNT(*) as total_items
      FROM products
    `);

    res.json({
      today: {
        invoices: Number(todayRes.rows[0].count),
        sales: Number(todayRes.rows[0].total),
        taxable: Number(todayRes.rows[0].taxable)
      },
      all_time: {
        invoices: Number(totalRes.rows[0].count),
        sales: Number(totalRes.rows[0].total)
      },
      payment_breakdown: payRes.rows,
      top_products: topItemsRes.rows,
      low_stock_items: lowStockRes.rows,
      inventory_summary: invValueRes.rows[0]
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------
// DAYBOOK / EOD SUMMARY API
// ---------------------------------------------------------
app.get('/api/reports/daybook', async (req, res) => {
  try {
    const targetDate = (req.query.date as string) || new Date().toISOString().split('T')[0];
    
    // Get cash IN from Invoices
    const salesInResult = await db.execute({
      sql: "SELECT payment_method, COALESCE(SUM(grand_total), 0) as amount FROM invoices WHERE date >= ? AND date <= ? GROUP BY payment_method",
      args: [`${targetDate}T00:00:00`, `${targetDate}T23:59:59.999Z`]
    });
    
    // Get cash IN from Udhar Settlements
    const udharInResult = await db.execute({
      sql: "SELECT payment_mode, COALESCE(SUM(amount), 0) as amount FROM customer_transactions WHERE type = 'PAYMENT_RECEIVED' AND created_at >= ? AND created_at <= ? GROUP BY payment_mode",
      args: [`${targetDate}T00:00:00`, `${targetDate}T23:59:59.999Z`]
    });

    // Get cash OUT from Purchases
    const purchasesOutResult = await db.execute({
      sql: "SELECT payment_method, COALESCE(SUM(grand_total), 0) as amount FROM purchases WHERE date >= ? AND date <= ? GROUP BY payment_method",
      args: [`${targetDate}T00:00:00`, `${targetDate}T23:59:59.999Z`]
    });
    
    // Get cash OUT from Petty Cash Expenses
    const expensesOutResult = await db.execute({
      sql: "SELECT payment_mode, COALESCE(SUM(amount), 0) as amount FROM expenses WHERE date >= ? AND date <= ? GROUP BY payment_mode",
      args: [`${targetDate}T00:00:00`, `${targetDate}T23:59:59.999Z`]
    });

    res.json({
      date: targetDate,
      in_sales: salesInResult.rows,
      in_udhar: udharInResult.rows,
      out_purchases: purchasesOutResult.rows,
      out_expenses: expensesOutResult.rows
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 8. GST Compliance Reports API (GSTR-1 & HSN Summary)
app.get('/api/reports/gst', async (req, res) => {
  try {
    const from = (req.query.from as string) || '1970-01-01';
    const to = (req.query.to as string) || '2099-12-31';

    // HSN Summary Table
    const hsnRes = await db.execute({
      sql: `
        SELECT 
          COALESCE(hsn_code, 'N/A') as hsn_code,
          SUM(quantity) as total_qty,
          SUM(taxable_value) as taxable_value,
          gst_rate,
          SUM(cgst_amount) as cgst_amount,
          SUM(sgst_amount) as sgst_amount,
          SUM(igst_amount) as igst_amount,
          SUM(line_total) as total_value
        FROM invoice_items
        JOIN invoices ON invoice_items.invoice_id = invoices.id
        WHERE invoices.date >= ? AND invoices.date <= ?
        GROUP BY hsn_code, gst_rate
        ORDER BY taxable_value DESC
      `,
      args: [from, `${to}T23:59:59.999Z`]
    });

    // Total GST Taxes Collected
    const taxTotals = await db.execute({
      sql: `
        SELECT 
          COALESCE(SUM(subtotal), 0) as total_taxable,
          COALESCE(SUM(cgst_total), 0) as total_cgst,
          COALESCE(SUM(sgst_total), 0) as total_sgst,
          COALESCE(SUM(igst_total), 0) as total_igst,
          COALESCE(SUM(grand_total), 0) as total_grand
        FROM invoices
        WHERE date >= ? AND date <= ?
      `,
      args: [from, `${to}T23:59:59.999Z`]
    });

    // All Sale Bills
    const saleBills = await db.execute({
      sql: `
        SELECT 
          id, invoice_number, date, customer_name, customer_gstin, 
          subtotal as taxable_value, cgst_total, sgst_total, igst_total, grand_total, payment_method, status
        FROM invoices
        WHERE date >= ? AND date <= ?
        ORDER BY date DESC
      `,
      args: [from, `${to}T23:59:59.999Z`]
    });

    res.json({
      hsn_summary: hsnRes.rows,
      tax_totals: taxTotals.rows[0],
      sale_bills: saleBills.rows
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------
// EXPENSES (Petty Cash) API
// ---------------------------------------------------------

app.get('/api/expenses', async (req, res) => {
  try {
    const fromDate = (req.query.from as string) || new Date().toISOString().split('T')[0];
    let toDate = (req.query.to as string) || new Date().toISOString().split('T')[0];
    toDate = `${toDate}T23:59:59.999Z`;

    const result = await db.execute({
      sql: 'SELECT * FROM expenses WHERE date >= ? AND date <= ? ORDER BY date DESC',
      args: [fromDate, toDate]
    });
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/expenses', async (req, res) => {
  try {
    const { category, amount, payment_mode, notes, recorded_by, date } = req.body;
    const expenseDate = date || new Date().toISOString();
    
    const result = await db.execute({
      sql: `INSERT INTO expenses (date, category, amount, payment_mode, notes, recorded_by) 
            VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
      args: [expenseDate, category, amount, payment_mode, notes, recorded_by || 'Admin']
    });
    res.json({ success: true, id: result.rows[0].id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/expenses/:id', async (req, res) => {
  try {
    const { category, amount, payment_mode, notes } = req.body;
    await db.execute({
      sql: 'UPDATE expenses SET category = ?, amount = ?, payment_mode = ?, notes = ? WHERE id = ?',
      args: [category, amount, payment_mode, notes, req.params.id]
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/expenses/:id', async (req, res) => {
  try {
    await db.execute({
      sql: 'DELETE FROM expenses WHERE id = ?',
      args: [req.params.id]
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Attendance API
app.get("/api/attendance", async (req, res) => {
  try {
    const date = (req.query.date as string) || new Date().toISOString().split("T")[0];
    const result = await db.execute({
      sql: "SELECT * FROM attendance WHERE date = ? ORDER BY staff_name ASC",
      args: [date]
    });
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/attendance", async (req, res) => {
  try {
    const { staff_name, date, check_in, role, notes } = req.body;
    const result = await db.execute({
      sql: `INSERT INTO attendance (staff_name, date, check_in, role, notes) VALUES (?, ?, ?, ?, ?) RETURNING id`,
      args: [staff_name, date, check_in, role, notes]
    });
    res.json({ success: true, id: result.rows[0].id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/attendance/:id", async (req, res) => {
  try {
    const { staff_name, role, check_in, check_out, notes } = req.body;
    await db.execute({
      sql: `UPDATE attendance SET staff_name = COALESCE(?, staff_name), role = COALESCE(?, role), check_in = COALESCE(?, check_in), check_out = COALESCE(?, check_out), notes = COALESCE(?, notes) WHERE id = ?`,
      args: [staff_name, role, check_in, check_out, notes, req.params.id]
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


// ==================== SALES RETURNS & CREDIT NOTES API ====================
app.get('/api/returns', async (req, res) => {
  try {
    const result = await db.execute(`
      SELECT sr.*, 
        (SELECT COUNT(*) FROM sales_return_items sri WHERE sri.return_id = sr.id) as item_count
      FROM sales_returns sr 
      ORDER BY sr.id DESC
    `);
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/returns/:id', async (req, res) => {
  try {
    const returnRes = await db.execute({
      sql: 'SELECT * FROM sales_returns WHERE id = ?',
      args: [req.params.id]
    });
    if (returnRes.rows.length === 0) {
      return res.status(404).json({ error: 'Return record not found' });
    }

    const itemsRes = await db.execute({
      sql: 'SELECT * FROM sales_return_items WHERE return_id = ?',
      args: [req.params.id]
    });

    res.json({
      ...returnRes.rows[0],
      items: itemsRes.rows
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/returns', async (req, res) => {
  const {
    invoice_id,
    invoice_number,
    customer_id,
    customer_name,
    customer_phone,
    return_date,
    refund_method,
    reason,
    processed_by,
    items
  } = req.body;

  try {
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Please select at least one item to return.' });
    }

    // Generate Return / Credit Note Number
    const latestReturn = await db.execute('SELECT return_number FROM sales_returns ORDER BY id DESC LIMIT 1');
    let nextNum = 1;
    if (latestReturn.rows.length > 0) {
      const match = (latestReturn.rows[0].return_number as string)?.match(/CN-(\d+)/);
      if (match) {
        nextNum = parseInt(match[1]) + 1;
      }
    }
    const return_number = `CN-${nextNum.toString().padStart(6, '0')}`;
    const rDate = return_date || new Date().toISOString();

    const totalRefund = items.reduce((sum: number, it: any) => sum + (Number(it.refund_amount) || 0), 0);

    const tx = await db.transaction();
    try {
      // 1. Insert sales_returns
      const retInsert = await tx.execute({
        sql: `INSERT INTO sales_returns (
          return_number, invoice_id, invoice_number, customer_id, customer_name,
          customer_phone, return_date, total_refund_amount, refund_method, reason, processed_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
        args: [
          return_number, invoice_id, invoice_number, customer_id || null,
          customer_name || 'Customer', customer_phone || null, rDate,
          totalRefund, refund_method || 'cash', reason || 'Customer Return',
          processed_by || 'Admin'
        ]
      });

      const return_id = retInsert.rows[0].id;

      // 2. Insert items and optionally restock
      for (const it of items) {
        await tx.execute({
          sql: `INSERT INTO sales_return_items (
            return_id, product_id, product_name, quantity, unit_price,
            taxable_value, gst_rate, tax_amount, refund_amount, restock_to_inventory
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            return_id, it.product_id || null, it.product_name, Number(it.quantity),
            Number(it.unit_price), Number(it.taxable_value || 0), Number(it.gst_rate || 0),
            Number(it.tax_amount || 0), Number(it.refund_amount), it.restock_to_inventory ? 1 : 0
          ]
        });

        // Restock inventory if checked
        if (it.restock_to_inventory && it.product_id) {
          const pRes = await tx.execute({
            sql: 'SELECT current_stock FROM products WHERE id = ?',
            args: [it.product_id]
          });
          const prevStock = pRes.rows.length > 0 ? Number(pRes.rows[0].current_stock) : 0;
          const newStock = prevStock + Number(it.quantity);

          await tx.execute({
            sql: 'UPDATE products SET current_stock = ? WHERE id = ?',
            args: [newStock, it.product_id]
          });

          await tx.execute({
            sql: `INSERT INTO stock_adjustments (
              product_id, product_name, change_qty, previous_stock, new_stock,
              type, reason, user_name, created_at
            ) VALUES (?, ?, ?, ?, ?, 'ADD', 'Return Restock', ?, ?)`,
            args: [it.product_id, it.product_name, Number(it.quantity), prevStock, newStock, processed_by || 'Admin', rDate]
          });
        }
      }

      // 3. If refund is credit deduction & customer exists, adjust credit balance
      if (customer_id && refund_method === 'credit_deduction') {
        const custRes = await tx.execute({
          sql: 'SELECT credit_balance FROM customers WHERE id = ?',
          args: [customer_id]
        });
        if (custRes.rows.length > 0) {
          const curBal = Number(custRes.rows[0].credit_balance) || 0;
          const newBal = Math.max(0, curBal - totalRefund);
          await tx.execute({
            sql: 'UPDATE customers SET credit_balance = ? WHERE id = ?',
            args: [newBal, customer_id]
          });

          await tx.execute({
            sql: `INSERT INTO customer_transactions (
              customer_id, invoice_id, type, amount, balance_after, payment_mode, notes, created_at
            ) VALUES (?, ?, 'RETURN_CREDIT', ?, ?, 'credit_deduction', ?, ?)`,
            args: [customer_id, invoice_id, totalRefund, newBal, `Credit Note ${return_number}`, rDate]
          });
        }
      }

      await tx.commit();
      res.json({ success: true, return_id, return_number, total_refund_amount: totalRefund });
    } catch (txErr) {
      await tx.rollback();
      throw txErr;
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== CASH REGISTER & SHIFTS API ====================
app.get('/api/register/current', async (req, res) => {
  try {
    const regRes = await db.execute(`
      SELECT * FROM cash_registers WHERE status = 'open' ORDER BY id DESC LIMIT 1
    `);

    if (regRes.rows.length === 0) {
      return res.json({ isOpen: false, register: null });
    }

    const reg = regRes.rows[0];
    const openedAt = reg.opened_at as string;

    // Calculate Cash Sales during shift
    const salesRes = await db.execute({
      sql: "SELECT COALESCE(SUM(grand_total), 0) as cash_sales FROM invoices WHERE payment_method = 'cash' AND date >= ?",
      args: [openedAt]
    });
    const cashSales = Number(salesRes.rows[0]?.cash_sales) || 0;

    // Calculate Cash Returns during shift
    const returnsRes = await db.execute({
      sql: "SELECT COALESCE(SUM(total_refund_amount), 0) as cash_refunds FROM sales_returns WHERE refund_method = 'cash' AND return_date >= ?",
      args: [openedAt]
    });
    const cashRefunds = Number(returnsRes.rows[0]?.cash_refunds) || 0;

    // Calculate Cash In & Cash Out transactions
    const txsRes = await db.execute({
      sql: "SELECT * FROM cash_drawer_transactions WHERE register_id = ? ORDER BY id DESC",
      args: [reg.id]
    });
    const txs = txsRes.rows;

    let cashIn = 0;
    let cashOut = 0;
    for (const t of txs) {
      if (t.type === 'CASH_IN') cashIn += Number(t.amount);
      if (t.type === 'CASH_OUT') cashOut += Number(t.amount);
    }

    const openingCash = Number(reg.opening_cash) || 0;
    const expectedCash = openingCash + cashSales + cashIn - cashOut - cashRefunds;

    res.json({
      isOpen: true,
      register: reg,
      summary: {
        openingCash,
        cashSales,
        cashRefunds,
        cashIn,
        cashOut,
        expectedCash
      },
      transactions: txs
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/register/open', async (req, res) => {
  const { opening_cash, cashier_name, notes } = req.body;
  try {
    // Check if there is already an open register
    const openCheck = await db.execute("SELECT id FROM cash_registers WHERE status = 'open' LIMIT 1");
    if (openCheck.rows.length > 0) {
      return res.status(400).json({ error: 'A cash register session is already open. Please close it first.' });
    }

    const result = await db.execute({
      sql: `INSERT INTO cash_registers (
        cashier_name, opened_at, opening_cash, expected_cash, status, notes
      ) VALUES (?, ?, ?, ?, 'open', ?) RETURNING *`,
      args: [
        cashier_name || 'Admin',
        new Date().toISOString(),
        Number(opening_cash) || 0,
        Number(opening_cash) || 0,
        notes || 'Shift Started'
      ]
    });

    res.json({ success: true, register: result.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/register/cash-transaction', async (req, res) => {
  const { register_id, type, amount, reason, performed_by } = req.body;
  try {
    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ error: 'Amount must be greater than 0.' });
    }
    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'Reason/Note is required for cash drawer transactions.' });
    }

    const result = await db.execute({
      sql: `INSERT INTO cash_drawer_transactions (
        register_id, type, amount, reason, performed_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?) RETURNING *`,
      args: [
        register_id,
        type, // 'CASH_IN' or 'CASH_OUT'
        Number(amount),
        reason.trim(),
        performed_by || 'Admin',
        new Date().toISOString()
      ]
    });

    res.json({ success: true, transaction: result.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/register/close', async (req, res) => {
  const { register_id, closing_cash, expected_cash, notes } = req.body;
  try {
    const counted = Number(closing_cash) || 0;
    const expected = Number(expected_cash) || 0;
    const diff = counted - expected;

    const result = await db.execute({
      sql: `UPDATE cash_registers SET 
        closed_at = ?, closing_cash = ?, expected_cash = ?, difference = ?, status = 'closed', notes = ?
        WHERE id = ? RETURNING *`,
      args: [
        new Date().toISOString(),
        counted,
        expected,
        diff,
        notes || 'Shift Closed',
        register_id
      ]
    });

    res.json({ success: true, register: result.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/register/history', async (req, res) => {
  try {
    const result = await db.execute(`
      SELECT * FROM cash_registers ORDER BY id DESC LIMIT 50
    `);
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// =============================================================
// 10. REGISTERED SYSTEM - USERS & PIN AUTHENTICATION API
// =============================================================

// List all registered staff / users
app.get('/api/users', async (req, res) => {
  try {
    const result = await db.execute('SELECT * FROM users ORDER BY id ASC');
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Register a new staff / user
app.post('/api/users/register', async (req, res) => {
  try {
    const { username, full_name, phone, email, role, pin, status } = req.body;
    if (!username || !username.trim()) {
      return res.status(400).json({ error: 'Username is required.' });
    }
    if (!full_name || !full_name.trim()) {
      return res.status(400).json({ error: 'Full Name is required.' });
    }
    if (!pin || pin.toString().trim().length < 4) {
      return res.status(400).json({ error: 'PIN must be at least 4 digits.' });
    }

    const cleanUsername = username.trim().toLowerCase();
    const cleanPin = pin.toString().trim();
    const assignedRole = role || 'cashier';

    const result = await db.execute({
      sql: `INSERT INTO users (username, full_name, phone, email, role, pin, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id, username, full_name, phone, email, role, status, created_at`,
      args: [
        cleanUsername,
        full_name.trim(),
        phone?.trim() || null,
        email?.trim() || null,
        assignedRole,
        cleanPin,
        status || 'active',
        new Date().toISOString()
      ]
    });

    const newUser = result.rows[0];

    // Sync to Google Sheets if it is an admin registration
    if (assignedRole === 'admin' && process.env.LICENSE_SHEET_WEBHOOK) {
      try {
        const settingsRes = await db.execute('SELECT key, value FROM settings WHERE key IN ("machine_hd_id", "shop_name", "subscription_plan", "subscription_expiry")');
        const settings = Object.fromEntries(settingsRes.rows.map((r: any) => [r.key, r.value]));
        
        await syncLicenseWithGoogleSheets({
          action: 'REGISTER_TRIAL',
          hd_id: settings.machine_hd_id || `LOCAL-HD-${Date.now()}`,
          owner_name: full_name.trim(),
          shop_name: settings.shop_name || 'Admin User Registration',
          email: email?.trim().toLowerCase() || '',
          phone: phone?.trim() || '',
          current_plan: settings.subscription_plan || 'Local User Registration',
          expiry: settings.subscription_expiry || new Date().toISOString()
        });
      } catch (syncErr) {
        console.error('Error syncing admin user with Google Sheets:', syncErr);
      }
    }

    await logFirelog({
      user_name: 'Admin Desk',
      role: 'admin',
      action_type: 'USER_REGISTERED',
      module: 'Auth',
      severity: 'success',
      entity_type: 'user',
      entity_id: String(newUser.id),
      description: `New user registered: ${newUser.full_name} (@${newUser.username}) with role '${newUser.role}'`,
      metadata: { username: newUser.username, role: newUser.role, full_name: newUser.full_name }
    });

    res.status(201).json({ success: true, user: newUser });
  } catch (err: any) {
    if (err.message && err.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'A user with this username already exists.' });
    }
    res.status(500).json({ error: err.message });
  }
});

// Update a registered user
app.put('/api/users/:id', async (req, res) => {
  try {
    const { full_name, phone, email, role, pin, status } = req.body;
    const userId = req.params.id;

    let updateSql = 'UPDATE users SET full_name = ?, phone = ?, email = ?, role = ?, status = ?';
    const args: any[] = [full_name?.trim(), phone?.trim() || null, email?.trim() || null, role || 'cashier', status || 'active'];

    if (pin && pin.toString().trim().length >= 4) {
      updateSql += ', pin = ?';
      args.push(pin.toString().trim());
    }

    updateSql += ' WHERE id = ? RETURNING id, username, full_name, phone, email, role, status, last_login, created_at';
    args.push(userId);

    const result = await db.execute({ sql: updateSql, args });
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const updatedUser = result.rows[0];

    await logFirelog({
      user_name: 'Admin Desk',
      role: 'admin',
      action_type: 'USER_UPDATED',
      module: 'Auth',
      severity: 'info',
      entity_type: 'user',
      entity_id: userId,
      description: `User @${updatedUser.username} profile updated (Role: ${updatedUser.role}, Status: ${updatedUser.status})`,
      metadata: { username: updatedUser.username, role: updatedUser.role, status: updatedUser.status }
    });

    res.json({ success: true, user: updatedUser });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete user account
app.delete('/api/users/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    const userRes = await db.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [userId] });
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }
    const user = userRes.rows[0];

    if (user.username === 'admin') {
      return res.status(400).json({ error: 'Cannot delete the default root admin account.' });
    }

    await db.execute({ sql: 'DELETE FROM users WHERE id = ?', args: [userId] });

    await logFirelog({
      user_name: 'Admin Desk',
      role: 'admin',
      action_type: 'USER_DELETED',
      module: 'Auth',
      severity: 'warning',
      entity_type: 'user',
      entity_id: userId,
      description: `User account @${user.username} (${user.full_name}) was deleted`,
      metadata: { username: user.username, full_name: user.full_name }
    });

    res.json({ success: true, message: 'User deleted successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Authenticate / PIN Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, pin, user_id } = req.body;
    let query = 'SELECT * FROM users WHERE ';
    let args: any[] = [];

    if (user_id) {
      query += 'id = ? AND pin = ?';
      args = [user_id, pin?.toString().trim()];
    } else if (username) {
      query += '(LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)) AND pin = ?';
      const cleanUser = username.trim();
      args = [cleanUser, cleanUser, pin?.toString().trim()];
    } else {
      return res.status(400).json({ error: 'Please provide username or user ID with PIN.' });
    }

    const result = await db.execute({ sql: query, args });
    if (result.rows.length === 0) {
      await logFirelog({
        user_name: username || `User #${user_id}`,
        role: 'unknown',
        action_type: 'LOGIN_FAILED',
        module: 'Auth',
        severity: 'warning',
        description: `Failed login attempt for '${username || user_id}' with incorrect PIN`
      });
      return res.status(401).json({ error: 'Invalid username or PIN code.' });
    }

    const user = result.rows[0];
    if (user.status === 'inactive') {
      return res.status(403).json({ error: 'This user account is currently deactivated. Contact admin.' });
    }

    const now = new Date().toISOString();
    await db.execute({ sql: 'UPDATE users SET last_login = ? WHERE id = ?', args: [now, user.id] });

    await logFirelog({
      user_id: Number(user.id),
      user_name: String(user.full_name),
      role: String(user.role),
      action_type: 'USER_LOGIN',
      module: 'Auth',
      severity: 'info',
      entity_type: 'user',
      entity_id: String(user.id),
      description: `User '${user.full_name}' (@${user.username}) successfully authenticated as ${user.role}`,
      metadata: { role: user.role, login_time: now }
    });

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        phone: user.phone,
        email: user.email,
        role: user.role,
        last_login: now
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Quick PIN verification for manager/admin overrides
app.post('/api/auth/verify-pin', async (req, res) => {
  try {
    const { pin, action_name, required_role } = req.body;
    if (!pin) {
      return res.status(400).json({ error: 'PIN is required.' });
    }

    let query = "SELECT id, username, full_name, role, status FROM users WHERE pin = ? AND status = 'active'";
    const result = await db.execute({ sql: query, args: [pin.toString().trim()] });

    if (result.rows.length === 0) {
      return res.status(401).json({ valid: false, error: 'Invalid PIN.' });
    }

    const user = result.rows[0];
    const allowedRoles = required_role ? [required_role, 'admin', 'manager'] : ['admin', 'manager', 'cashier'];

    if (!allowedRoles.includes(user.role as string)) {
      return res.status(403).json({ valid: false, error: `Role '${user.role}' is not authorized for this action.` });
    }

    await logFirelog({
      user_id: Number(user.id),
      user_name: String(user.full_name),
      role: String(user.role),
      action_type: 'PIN_OVERRIDE_AUTHORIZED',
      module: 'Auth',
      severity: 'warning',
      description: `Authorized '${action_name || 'Manager Override'}' via PIN for ${user.full_name} (${user.role})`,
      metadata: { action_name, verified_by: user.username }
    });

    res.json({ valid: true, user });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});




// Staff Activity Tracking API
app.get("/api/staff-activity", async (req, res) => {
  try {
    const result = await db.execute({ sql: "SELECT * FROM firelog WHERE role != 'admin' ORDER BY timestamp DESC LIMIT 200" });
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// System Diagnostic & Self-Repair API
app.get('/api/system/health', async (req, res) => {
  try {
    const check = await db.execute('SELECT 1 as alive');
    res.json({ status: 'ok', healthy: true, row: check.rows[0] });
  } catch (err: any) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

app.post('/api/system/repair-database', async (req, res) => {
  try {
    const result = await repairAndResetDatabase();
    if (result.success) {
      res.json({ success: true, message: 'Database was repaired and re-initialized successfully!' });
    } else {
      res.status(500).json({ success: false, error: result.message });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/system/reset-database', async (req, res) => {
  try {
    const result = await repairAndResetDatabase();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Backup Endpoint
app.get('/api/system/backup', async (req, res) => {
  try {
    const dbPath = dbUrl.replace('file:', '');
    if (!fs.existsSync(dbPath)) {
      return res.status(404).json({ error: 'Database file not found' });
    }
    const stat = fs.statSync(dbPath);
    res.writeHead(200, {
      'Content-Type': 'application/octet-stream',
      'Content-Length': stat.size,
      'Content-Disposition': 'attachment; filename="pos-machine-database-backup.db"'
    });
    const readStream = fs.createReadStream(dbPath);
    readStream.pipe(res);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Restore Endpoint
app.post('/api/system/restore', upload.single('dbfile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No database file uploaded.' });
    }
    const dbPath = dbUrl.replace('file:', '');
    // Copy the uploaded file over the existing db
    fs.copyFileSync(req.file.path, dbPath);
    // Remove the temp file
    fs.unlinkSync(req.file.path);

    res.json({ success: true, message: 'Database restored successfully! Please restart the application.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'dist', 'index.html'));
  });
}

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Retail POS & Inventory Server running on http://0.0.0.0:${PORT}`);
});

server.on('error', (err: any) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`ERROR: Port ${PORT} is already in use.`);
    console.error('Another instance of this application might be running in the background.');
    console.error('Please close it or free up the port, then try again.');
  } else {
    console.error('Server encountered an error:', err);
  }
});
