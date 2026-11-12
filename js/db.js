const DB = (function () {
  const STORAGE_KEY = 'sj_database';

  const DEFAULT_METAL_PRICES = {
    '24K': 6200, '22K': 5800, '18K': 4800, '14K': 3700, '9K': 2400,
    'Silver 999': 75, 'Silver Ornaments': 80, 'Gold Ornaments': 5800
  };

  function deriveRateConfigFromMetalPrices(mp) {
    mp = mp || {};
    const asNum = (v) => Number(v) || 0;
    const k22 = asNum(mp['22K']) || 5800;
    const k18 = asNum(mp['18K']) || 4800;
    return {
      updatedAt: null,
      silver999: { rate: asNum(mp['Silver 999']) || 75 },
      silverOrnaments: {
        '999': { rate: asNum(mp['Silver 999']) || 75 },
        '50T': { rate: 0 },
        tunch: {
          '50':   { rate: 0, wastage: 0 },
          '60':   { rate: 0, wastage: 0 },
          '70':   { rate: 0, wastage: 0 },
          '80':   { rate: asNum(mp['Silver Ornaments']) || 80, wastage: 0 },
          '92.5': { rate: 0, wastage: 0 }
        }
      },
      goldOrnaments: {
        '24K': asNum(mp['24K']) || 6200,
        '22K': k22,
        '20K': asNum(mp['20K']) || Math.round((k22 + k18) / 2),
        '18K': k18,
        '14K': asNum(mp['14K']) || 3700,
        '9K':  asNum(mp['9K'])  || 2400
      },
      gems: { ordinary: { rate: 0, basis: 'carat' } }
    };
  }

  function mergeRateConfig(...sources) {
    const template = deriveRateConfigFromMetalPrices(DEFAULT_METAL_PRICES);
    const result = {
      updatedAt: null,
      silver999: { ...template.silver999 },
      silverOrnaments: { ...template.silverOrnaments, tunch: { ...template.silverOrnaments.tunch } },
      goldOrnaments: { ...template.goldOrnaments },
      gems: { ...template.gems }
    };
    sources.forEach(src => {
      if (!src) return;
      if (src.updatedAt) result.updatedAt = src.updatedAt;
      if (src.silver999) result.silver999 = { ...result.silver999, ...src.silver999 };
      if (src.silverOrnaments) {
        const so = src.silverOrnaments;
        if (so['999']) result.silverOrnaments['999'] = { ...result.silverOrnaments['999'], ...so['999'] };
        if (so['50T']) result.silverOrnaments['50T'] = { ...result.silverOrnaments['50T'], ...so['50T'] };
        if (so.tunch) result.silverOrnaments.tunch = { ...result.silverOrnaments.tunch, ...so.tunch };
      }
      if (src.goldOrnaments) result.goldOrnaments = { ...result.goldOrnaments, ...src.goldOrnaments };
      if (src.gems && src.gems.ordinary) result.gems.ordinary = { ...result.gems.ordinary, ...src.gems.ordinary };
    });
    return result;
  }

  const DEFAULT_SETTINGS = {
    businessName: 'SWARN JYOTI JEWELLERS',
    gstin: '10CQAPS4738P1ZH',
    phone: '9939332968',
    address: 'Soni Gali, Sasamusa, Gopalganj, Bihar',
    pin: '841505',
    metalPrices: { ...DEFAULT_METAL_PRICES },
    rateConfig: deriveRateConfigFromMetalPrices(DEFAULT_METAL_PRICES)
  };

  function generateId(prefix) {
    const ts = Date.now().toString(36).toUpperCase();
    const rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `${prefix}-${ts}${rnd}`;
  }

  function normaliseDate(d) {
    if (d instanceof Date) return d.toLocaleDateString('en-GB');
    if (!d) return new Date().toLocaleDateString('en-GB');
    const s = String(d).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
      const [y, m, day] = s.slice(0, 10).split('-');
      return `${day}/${m}/${y}`;
    }
    return s;
  }

  function parseDate(str) {
    if (!str) return new Date(0);
    if (str instanceof Date) return isNaN(str.getTime()) ? new Date(0) : str;
    const s = String(str).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) { const d = new Date(s); return isNaN(d.getTime()) ? new Date(0) : d; }
    const parts = s.split('/');
    if (parts.length === 3) { const d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`); return isNaN(d.getTime()) ? new Date(0) : d; }
    const d = new Date(s);
    return isNaN(d.getTime()) ? new Date(0) : d;
  }

  function normaliseMode(mode) {
    if (Array.isArray(mode)) return mode.filter(Boolean).join(' + ') || 'Cash';
    return String(mode || 'Cash').trim() || 'Cash';
  }

  function emptyData() {
    return {
      customers: [], invoices: [], transactions: [], stock: [],
      settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS))
    };
  }

  function recalcInvoice(data, inv) {
    if (!inv) return;
    const paid = data.transactions
      .filter(t => t.invoiceId === inv.id && (t.type === 'Payment' || t.type === 'Advance'))
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    inv.totalPaid = Math.round(paid * 100) / 100;
    const total = Number(inv.total) || 0;
    if (inv.totalPaid <= 0.01) inv.status = 'DUE';
    else if (inv.totalPaid >= total - 0.01) inv.status = 'PAID';
    else inv.status = 'PARTIAL';
  }

  function recalcAll(data) { (data.invoices || []).forEach(inv => recalcInvoice(data, inv)); }

  function migrate(raw) {
    if (!raw || typeof raw !== 'object') return emptyData();

    const existingSettings = raw.settings || {};
    const mergedMetalPrices = { ...DEFAULT_METAL_PRICES, ...(existingSettings.metalPrices || {}) };
    const hasRateConfig = existingSettings.rateConfig && existingSettings.rateConfig.goldOrnaments;
    const mergedRateConfig = hasRateConfig
      ? mergeRateConfig(existingSettings.rateConfig)
      : deriveRateConfigFromMetalPrices(mergedMetalPrices);

    const data = {
      customers:    Array.isArray(raw.customers)    ? raw.customers    : [],
      invoices:     Array.isArray(raw.invoices)     ? raw.invoices     : [],
      transactions: Array.isArray(raw.transactions) ? raw.transactions : [],
      stock:        Array.isArray(raw.stock)        ? raw.stock        : [],
      settings: {
        ...DEFAULT_SETTINGS, ...existingSettings,
        metalPrices: mergedMetalPrices,
        rateConfig: mergedRateConfig
      }
    };

    data.customers.forEach(c => {
      if (!c.id) c.id = generateId('CUST');
      c.mobile = String(c.mobile || '');
      c.name = String(c.name || '');
    });

    data.invoices.forEach(inv => {
      if (!inv.id) inv.id = generateId('SJ');
      if (!inv.date) inv.date = new Date().toLocaleDateString('en-GB');
      inv.total = Number(inv.total) || 0;
      if (!inv.customerId) {
        const phone = (inv.customerInfo && inv.customerInfo.phone) || '';
        const name = inv.customer || '';
        let match = phone ? data.customers.find(c => c.mobile === phone) : null;
        if (!match && name && !phone) match = data.customers.find(c => c.name === name);
        if (match) inv.customerId = match.id;
        else if (name || phone) {
          const newCust = {
            id: generateId('CUST'),
            name: name || 'Walk-in', mobile: phone,
            address: (inv.customerInfo && inv.customerInfo.address) || '',
            pan: (inv.customerInfo && inv.customerInfo.pan) || '',
            aadhar: (inv.customerInfo && inv.customerInfo.aadhar) || ''
          };
          data.customers.push(newCust);
          inv.customerId = newCust.id;
        }
      }
    });

    data.transactions.forEach(tx => {
      if (!tx.id) tx.id = generateId('TX');
      if (!tx.receiptNo) tx.receiptNo = generateId('REC');
      if (!tx.type) tx.type = 'Payment';
      if (!tx.date) tx.date = new Date().toLocaleDateString('en-GB');
      tx.amount = Number(tx.amount) || 0;
      if (tx.modes && !Array.isArray(tx.modes)) tx.modes = null;
    });

    recalcAll(data);
    return data;
  }

  function findOrCreateCustomer(data, info) {
    const name   = String(info.name   || info.customer || '').trim();
    const mobile = String(info.mobile || info.phone    || '').trim();
    let cust = null;
    if (mobile) cust = data.customers.find(c => c.mobile === mobile);
    if (!cust && name && !mobile) cust = data.customers.find(c => !c.mobile && c.name === name);
    if (!cust) {
      cust = {
        id: generateId('CUST'), name: name || 'Walk-in', mobile,
        address: info.address || '', pan: info.pan || '', aadhar: info.aadhar || ''
      };
      data.customers.push(cust);
    } else {
      if (name) cust.name = name;
      if (info.address) cust.address = info.address;
      if (info.pan) cust.pan = info.pan;
      if (info.aadhar) cust.aadhar = info.aadhar;
    }
    return cust;
  }

  return {
    init() {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) { localStorage.setItem(STORAGE_KEY, JSON.stringify(emptyData())); return; }
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(migrate(JSON.parse(raw)))); }
      catch { localStorage.setItem(STORAGE_KEY, JSON.stringify(emptyData())); }
    },

    getData() {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) { const blank = emptyData(); localStorage.setItem(STORAGE_KEY, JSON.stringify(blank)); return blank; }
      try { return migrate(JSON.parse(raw)); }
      catch { const blank = emptyData(); localStorage.setItem(STORAGE_KEY, JSON.stringify(blank)); return blank; }
    },

    saveData(data) {
      if (!data) return;
      recalcAll(data);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    },

    reset() { localStorage.removeItem(STORAGE_KEY); this.init(); },

    findCustomerByMobile(mobile) {
      if (!mobile) return null;
      return this.getData().customers.find(c => c.mobile === String(mobile)) || null;
    },

    addCustomer(customer) {
      const data = this.getData();
      const cust = findOrCreateCustomer(data, customer);
      this.saveData(data);
      return cust;
    },

    getInvoice(id) { return this.getData().invoices.find(i => i.id === id) || null; },

    addInvoice(invoice) {
      const data = this.getData();
      const cust = findOrCreateCustomer(data, {
        name: invoice.customer, mobile: invoice.customerInfo?.phone,
        address: invoice.customerInfo?.address, pan: invoice.customerInfo?.pan,
        aadhar: invoice.customerInfo?.aadhar
      });
      const record = {
        ...invoice,
        id: invoice.id || generateId('SJ'),
        customerId: cust.id,
        customer: invoice.customer || cust.name,
        date: normaliseDate(invoice.date),
        total: Number(invoice.total) || 0,
        totalPaid: 0, status: 'DUE'
      };
      data.invoices.push(record);
      this.saveData(data);
      return record;
    },

    updateInvoice(id, updated) {
      const data = this.getData();
      const idx = data.invoices.findIndex(i => i.id === id);
      if (idx === -1) return null;
      const cust = findOrCreateCustomer(data, {
        name: updated.customer, mobile: updated.customerInfo?.phone,
        address: updated.customerInfo?.address, pan: updated.customerInfo?.pan,
        aadhar: updated.customerInfo?.aadhar
      });
      const merged = {
        ...data.invoices[idx], ...updated, id,
        customerId: cust.id,
        customer: updated.customer || cust.name,
        date: normaliseDate(updated.date),
        total: Number(updated.total) || 0
      };
      data.invoices[idx] = merged;
      this.saveData(data);
      return merged;
    },

    deleteInvoice(id) {
      const data = this.getData();
      data.invoices = data.invoices.filter(i => i.id !== id);
      data.transactions = data.transactions.filter(t => t.invoiceId !== id);
      this.saveData(data);
    },

    /**
     * NON-DESTRUCTIVE — update or create the INITIAL payment.
     *  • Existing initial → update amount / mode / date
     *  • No initial, amount > 0 → create one marked 'Initial'
     *  • No initial, amount = 0 → no-op (no fake ₹0 transaction)
     *  • Never touches subsequent payments
     */
    setInvoicePayment(invoiceId, paidAmount, mode, date) {
      const data = this.getData();
      const inv = data.invoices.find(i => i.id === invoiceId);
      if (!inv) return null;
      const amount = Number(paidAmount) || 0;

      let initialTx = data.transactions.find(t =>
        t.invoiceId === invoiceId &&
        (t.type === 'Payment' || t.type === 'Advance') &&
        (t.paymentType === 'Initial' ||
         (t.remarks && String(t.remarks).startsWith('Initial payment on invoice #')) ||
         t.remarks === 'Reconciled from legacy invoice data')
      );

      if (initialTx) {
        if (amount > 0) {
          initialTx.amount = amount;
          initialTx.mode = normaliseMode(mode);
          initialTx.date = normaliseDate(date);
          initialTx.paymentType = 'Initial';
        }
      } else if (amount > 0) {
        data.transactions.push({
          id: generateId('TX'), receiptNo: generateId('REC'),
          customerId: inv.customerId, invoiceId, type: 'Payment',
          amount, mode: normaliseMode(mode), date: normaliseDate(date),
          remarks: `Initial payment on invoice #${invoiceId}`,
          paymentType: 'Initial'
        });
      }

      this.saveData(data);
      return inv;
    },

    addTransaction(tx) {
      const data = this.getData();
      const record = {
        id: tx.id || generateId('TX'),
        receiptNo: tx.receiptNo || generateId('REC'),
        customerId: tx.customerId || null,
        invoiceId: tx.invoiceId || null,
        type: tx.type || 'Payment',
        amount: Number(tx.amount) || 0,
        mode: normaliseMode(tx.mode),
        date: normaliseDate(tx.date),
        remarks: tx.remarks || '',
        paymentType: tx.paymentType || null,
        modes: Array.isArray(tx.modes) && tx.modes.length > 0
          ? tx.modes.map(m => ({ mode: String(m.mode || ''), amount: Number(m.amount) || 0 }))
          : null
      };
      data.transactions.push(record);
      this.saveData(data);
      return record;
    },

    addLedgerEntry(entry) {
      const data = this.getData();
      const cust = findOrCreateCustomer(data, { name: entry.customer, mobile: entry.mobile });
      this.saveData(data);
      const amount = Number(entry.paid ?? entry.amount ?? 0);
      if (!amount) return null;
      return this.addTransaction({
        customerId: cust.id, invoiceId: entry.invoiceId || null,
        type: entry.type || 'Payment', amount, mode: entry.mode || 'Cash',
        date: entry.date, remarks: entry.remark || entry.remarks || ''
      });
    },

    updateTransaction(id, updated) {
      const data = this.getData();
      const idx = data.transactions.findIndex(t => t.id === id);
      if (idx === -1) return null;
      const oldTx = data.transactions[idx];
      const merged = {
        ...oldTx, ...updated,
        amount: Number(updated.amount ?? oldTx.amount) || 0,
        mode: normaliseMode(updated.mode ?? oldTx.mode),
        date: updated.date ? normaliseDate(updated.date) : oldTx.date,
        modes: Array.isArray(updated.modes)
          ? updated.modes.map(m => ({ mode: String(m.mode || ''), amount: Number(m.amount) || 0 }))
          : (updated.modes === null ? null : oldTx.modes),
        paymentType: updated.paymentType !== undefined ? updated.paymentType : oldTx.paymentType
      };
      data.transactions[idx] = merged;
      const touched = new Set([oldTx.invoiceId, merged.invoiceId].filter(Boolean));
      touched.forEach(iid => {
        const inv = data.invoices.find(i => i.id === iid);
        if (inv) recalcInvoice(data, inv);
      });
      this.saveData(data);
      return merged;
    },

    deleteTransaction(id) {
      const data = this.getData();
      data.transactions = data.transactions.filter(t => t.id !== id);
      this.saveData(data);
    },

    getInvoicePayments(invoiceId) {
      return this.getData().transactions.filter(t => t.invoiceId === invoiceId);
    },

    getCustomerLedger(customerId) {
      const data = this.getData();
      const invoiceDebits = data.invoices.filter(i => i.customerId === customerId).map(i => ({
        id: `INV-${i.id}`, type: 'Invoice', amount: Number(i.total) || 0,
        date: i.date, remarks: `Invoice #${i.id}`, customerId, invoiceId: i.id
      }));
      const payments = data.transactions.filter(t => t.customerId === customerId && t.type !== 'Invoice');
      const all = [...invoiceDebits, ...payments].sort((a, b) => parseDate(a.date) - parseDate(b.date));
      let running = 0;
      return all.map(tx => {
        let debit = 0, credit = 0;
        const amt = Number(tx.amount) || 0;
        if (['Invoice', 'Opening Due', 'Debit Adj'].includes(tx.type)) { debit = amt; running += amt; }
        else if (['Payment', 'Advance', 'Credit Adj', 'Refund'].includes(tx.type)) { credit = amt; running -= amt; }
        return { ...tx, debit, credit, balance: running };
      });
    },

    addStock(item) {
      const data = this.getData();
      data.stock.push({
        id: item.id || generateId('STK'), item: item.item,
        metal: item.metal || 'Gold', carat: item.carat || '-',
        cat: item.cat || 'General', weight: String(item.weight ?? '0'),
        price: String(item.price ?? '0'), status: item.status || 'In Stock'
      });
      this.saveData(data);
    },

    updateStock(id, updated) {
      const data = this.getData();
      const idx = data.stock.findIndex(s => s.id === id);
      if (idx === -1) return null;
      data.stock[idx] = { ...data.stock[idx], ...updated, id };
      this.saveData(data);
      return data.stock[idx];
    },

    deleteStock(id) {
      const data = this.getData();
      data.stock = data.stock.filter(s => s.id !== id);
      this.saveData(data);
    },

    updateSettings(newSettings) {
      newSettings = newSettings || {};
      const data = this.getData();
      const existing = data.settings || {};
      const mergedMetalPrices = {
        ...DEFAULT_METAL_PRICES, ...(existing.metalPrices || {}), ...(newSettings.metalPrices || {})
      };
      const hasNewRC = newSettings.rateConfig && newSettings.rateConfig.goldOrnaments;
      const hasExistingRC = existing.rateConfig && existing.rateConfig.goldOrnaments;
      const mergedRateConfig = (hasNewRC || hasExistingRC)
        ? mergeRateConfig(existing.rateConfig, newSettings.rateConfig)
        : deriveRateConfigFromMetalPrices(mergedMetalPrices);

      data.settings = {
        ...DEFAULT_SETTINGS, ...existing, ...newSettings,
        metalPrices: mergedMetalPrices,
        rateConfig: mergedRateConfig
      };
      this.saveData(data);
    },

    exportBackup() {
      const data = this.getData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SwarnJyoti_Backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },

    importBackup(file, callback) {
      const reader = new FileReader();
      reader.onload = (e) => {
        let parsed;
        try { parsed = JSON.parse(e.target.result); }
        catch { return callback(false, 'That file is not valid JSON.'); }
        if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.invoices) || !Array.isArray(parsed.stock)) {
          return callback(false, 'Invalid backup — missing invoices or stock table.');
        }
        try {
          const clean = migrate(parsed);
          this.saveData(clean);
          callback(true, 'Data imported successfully!');
        } catch (err) { callback(false, 'Import failed: ' + err.message); }
      };
      reader.onerror = () => callback(false, 'Could not read the file.');
      reader.readAsText(file);
    }
  };
})();

DB.init();