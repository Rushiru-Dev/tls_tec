import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Share from 'react-native-share';
import { listCategories, listProducts } from '../database/repositories/productRepository';
import type { ProductCategory, SavedProduct } from '../database/repositories/productRepository';
import { invoiceLogoDataUri } from '../img/logoData';
import { generatePDF } from 'react-native-html-to-pdf';
import { defaultAppSettings, getAppSettings, type AppSettings } from '../services/settingsService';

type Props = { darkMode: boolean };
type QuoteLine = {
  productId: number;
  category: string;
  model: string;
  description: string;
  quantity: number;
  unitPrice: number;
};

function formatDate(date: Date) {
  return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`;
}

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function money(value: number) {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function NewQuotationScreen({ darkMode }: Props) {
  const today = useMemo(() => formatDate(new Date()), []);
  const quotationNumber = useMemo(() => {
    const now = new Date();
    const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
    return `QT-${stamp}`;
  }, []);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [products, setProducts] = useState<SavedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [productId, setProductId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState('1');
  const [unitPrice, setUnitPrice] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [address, setAddress] = useState('');
  const [discount, setDiscount] = useState('');
  const [lines, setLines] = useState<QuoteLine[]>([]);
  const [picker, setPicker] = useState<'category' | 'product' | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [working, setWorking] = useState(false);
  const [businessSettings, setBusinessSettings] = useState<AppSettings>(defaultAppSettings);

  const colors = darkMode
    ? { surface: '#1C1D23', background: '#111216', border: '#2B2D35', heading: '#F4F4F6', text: '#E7E7EA', muted: '#A0A2AA', input: '#111216' }
    : { surface: '#FFFFFF', background: '#F6F7F9', border: '#E7E8EB', heading: '#18191E', text: '#24252B', muted: '#7B7E87', input: '#FFFFFF' };

  useEffect(() => {
    Promise.all([listCategories(), listProducts()])
      .then(([savedCategories, savedProducts]) => {
        setCategories(savedCategories);
        setProducts(savedProducts);
      })
      .catch(() => Alert.alert('Product data', 'Could not load the saved product catalog.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    getAppSettings().then(setBusinessSettings).catch(() => {});
  }, []);

  const selectedCategory = categories.find(category => category.id === categoryId);
  const availableProducts = products.filter(product => product.categoryId === categoryId);
  const selectedProduct = products.find(product => product.id === productId);
  const subtotal = lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
  const discountValue = Math.max(0, Number(discount) || 0);
  const total = Math.max(0, subtotal - discountValue);

  const inputStyle = [styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }];
  const addLine = () => {
    if (!selectedCategory || !selectedProduct) {
      Alert.alert('Select a product', 'Choose a category and product first.');
      return;
    }
    const qty = Number(quantity);
    const price = Number(unitPrice);
    if (!Number.isInteger(qty) || qty < 1 || !Number.isFinite(price) || price < 0) {
      Alert.alert('Item details', 'Enter a valid quantity and unit price.');
      return;
    }
    setLines(current => [...current, {
      productId: selectedProduct.id,
      category: selectedCategory.name,
      model: selectedProduct.model,
      description: selectedProduct.description,
      quantity: qty,
      unitPrice: price,
    }]);
    setQuantity('1');
  };

  const quotationHtml = (settings: AppSettings) => {
    const rows = lines.map((line, index) => {
      const title = line.description && line.description.toLowerCase() !== line.model.toLowerCase()
        ? `${line.description} (${line.model})`
        : line.model;
      return `<tr><td>${index + 1}</td><td>${escapeHtml(title)}</td><td>${line.quantity}</td><td>${money(line.unitPrice)}</td><td>${money(line.quantity * line.unitPrice)}</td></tr>`;
    }).join('');
    return `<!doctype html><html><head><meta charset="utf-8"><style>
      @page{size:Letter;margin:18pt}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#1e293b;font-size:9pt;margin:0}
      .header{background:#000;color:#fff;display:flex;justify-content:space-between;align-items:center;padding:10pt 14pt;min-height:72pt;margin-bottom:14pt}
      .logo{width:130pt;height:48pt;object-fit:contain;object-position:left center}.brand{text-align:right;color:#ccc;font-size:8pt;line-height:1.5}.brand b{display:block;color:#fff;font-size:14pt}
      h1{text-align:center;font-size:15pt;letter-spacing:2pt;margin:8pt 0 16pt;color:#0f172a}.meta{display:flex;justify-content:space-between;margin:0 10pt 16pt;line-height:1.7}
      .meta-right{text-align:right}table{border-collapse:collapse;width:100%;table-layout:fixed}th{background:#0f172a;color:white;padding:7pt 5pt;text-align:left;font-size:8pt}td{padding:7pt 5pt;border-bottom:.6pt solid #e2e8f0;font-size:8pt;overflow-wrap:anywhere}
      th:first-child,td:first-child,th:nth-child(3),td:nth-child(3){text-align:center}th:nth-child(n+3),td:nth-child(n+3){text-align:right}.summary{width:260pt;margin:0 0 0 auto;border:1pt solid #cbd5e1}.sum{display:flex;justify-content:space-between;padding:7pt 9pt;border-bottom:.6pt solid #e2e8f0}.total{font-weight:bold;background:#f1f5f9}.grand{font-size:10pt;font-weight:800;color:#b91c1c;background:#fef2f2}footer{text-align:center;color:#64748b;margin-top:20pt;font-size:8pt}
      </style></head><body><div class="header"><img class="logo" src="${invoiceLogoDataUri}"/><div class="brand"><b>${escapeHtml(settings.businessName)}</b>${escapeHtml(settings.businessAddress)}<br/>Tel: ${escapeHtml(settings.businessMobile)}<br/>${escapeHtml(settings.businessEmail)}</div></div>
      <h1>QUOTATION</h1><div class="meta"><div><b>Customer / Installation Site</b><br/>Name: ${escapeHtml(customerName)}<br/>Mobile: ${escapeHtml(phoneNumber)}<br/>Address: ${escapeHtml(address)}</div><div class="meta-right"><b>Quotation Information</b><br/>Quotation No: ${quotationNumber}<br/>Date: ${today}</div></div>
      <table><colgroup><col style="width:7%"><col style="width:47%"><col style="width:10%"><col style="width:18%"><col style="width:18%"></colgroup><thead><tr><th>#</th><th>Item / Description</th><th>Qty</th><th>Unit Price</th><th>Amount</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="summary"><div class="sum total"><span>Total Amount</span><span>LKR ${money(subtotal)}</span></div>${discountValue > 0 ? `<div class="sum"><span>Discount</span><span>- LKR ${money(discountValue)}</span></div>` : ''}<div class="sum grand"><span>Quotation Total</span><span>LKR ${money(total)}</span></div></div><footer>Quotation only — this document is not stored in the app.</footer></body></html>`;
  };

  const createAndShare = async () => {
    if (!lines.length) {
      Alert.alert('Quotation items', 'Add at least one item first.');
      return;
    }
    if (discountValue > subtotal) {
      Alert.alert('Discount', 'Discount cannot be greater than the total amount.');
      return;
    }
    setWorking(true);
    try {
      const pdf = await generatePDF({
        html: quotationHtml(businessSettings),
        fileName: quotationNumber,
        width: 612,
        height: 792,
        padding: 0,
        baseURL: 'about:blank',
      });
      if (!pdf.filePath) throw new Error('PDF file was not created.');
      await Share.open({
        title: `Quotation ${quotationNumber}`,
        message: `Quotation ${quotationNumber} - ${customerName}`,
        url: pdf.filePath.startsWith('file://') ? pdf.filePath : `file://${pdf.filePath}`,
        type: 'application/pdf',
        failOnCancel: false,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Please try again.';
      Alert.alert('Quotation PDF', `Could not create or share the quotation. ${message}`);
    } finally {
      setWorking(false);
    }
  };

  if (loading) {
    return <View style={styles.loading}><ActivityIndicator color="#E51D2A" size="large" /></View>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.notice}>
        <Text style={styles.noticeTitle}>Temporary quotation</Text>
        <Text style={styles.noticeText}>Quotation details are not saved in local storage. Generate and share the PDF before leaving this page.</Text>
      </View>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.heading }]}>Customer Details (Optional)</Text>
        <TextInput value={customerName} onChangeText={setCustomerName} placeholder="Customer name" placeholderTextColor={colors.muted} style={inputStyle} />
        <TextInput value={phoneNumber} onChangeText={setPhoneNumber} placeholder="Mobile number" placeholderTextColor={colors.muted} keyboardType="phone-pad" style={inputStyle} />
        <TextInput value={address} onChangeText={setAddress} placeholder="Installation address" placeholderTextColor={colors.muted} style={[...inputStyle, styles.address]} multiline />
        <View style={styles.dateLine}><Text style={[styles.infoText, { color: colors.muted }]}>Quotation No: {quotationNumber}</Text><Text style={[styles.infoText, { color: colors.muted }]}>{today}</Text></View>
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.heading }]}>Add Items</Text>
        <Pressable onPress={() => setPicker('category')} style={[styles.select, { borderColor: colors.border }]}>
          <Text style={{ color: selectedCategory ? colors.text : colors.muted }}>{selectedCategory?.name ?? 'Select category'}</Text><Text style={{ color: colors.muted }}>⌄</Text>
        </Pressable>
        <Pressable onPress={() => categoryId ? setPicker('product') : Alert.alert('Select category', 'Choose a category first.')} style={[styles.select, { borderColor: colors.border }]}>
          <Text style={{ color: selectedProduct ? colors.text : colors.muted }}>{selectedProduct?.model ?? 'Select item / model'}</Text><Text style={{ color: colors.muted }}>⌄</Text>
        </Pressable>
        <View style={styles.twoColumns}>
          <TextInput value={quantity} onChangeText={setQuantity} placeholder="Qty" keyboardType="number-pad" placeholderTextColor={colors.muted} style={[...inputStyle, styles.halfInput]} />
          <TextInput value={unitPrice} onChangeText={setUnitPrice} placeholder="Unit price (LKR)" keyboardType="decimal-pad" placeholderTextColor={colors.muted} style={[...inputStyle, styles.halfInput]} />
        </View>
        <Pressable onPress={addLine} style={styles.addButton}><Text style={styles.addButtonText}>Add Item</Text></Pressable>
        {lines.map((line, index) => (
          <View key={`${line.productId}-${index}`} style={[styles.itemRow, { borderBottomColor: colors.border }]}>
            <View style={styles.itemDetails}><Text style={[styles.itemTitle, { color: colors.text }]}>{line.model}</Text><Text style={[styles.infoText, { color: colors.muted }]}>{line.quantity} × LKR {money(line.unitPrice)}</Text></View>
            <Text style={[styles.itemAmount, { color: colors.heading }]}>LKR {money(line.quantity * line.unitPrice)}</Text>
            <Pressable onPress={() => setLines(current => current.filter((_, row) => row !== index))}><Text style={styles.remove}>×</Text></Pressable>
          </View>
        ))}
        <TextInput value={discount} onChangeText={setDiscount} placeholder="Discount (LKR) - Optional" keyboardType="decimal-pad" placeholderTextColor={colors.muted} style={inputStyle} />
        <View style={styles.totalLine}><Text style={[styles.sectionTitle, { color: colors.heading }]}>Quotation Total</Text><Text style={styles.total}>{`LKR ${money(total)}`}</Text></View>
      </View>

      <View style={styles.actions}>
        <Pressable onPress={() => setPreviewVisible(true)} style={[styles.secondaryButton, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.secondaryText, { color: colors.heading }]}>Preview Quotation</Text></Pressable>
        <Pressable disabled={working} onPress={createAndShare} style={[styles.primaryButton, working && styles.disabled]}>{working ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Generate & Share PDF</Text>}</Pressable>
      </View>

      <Modal transparent visible={picker !== null} animationType="fade" onRequestClose={() => setPicker(null)}>
        <View style={styles.modalBackdrop}><View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
          <View style={styles.modalHeader}><Text style={[styles.sectionTitle, { color: colors.heading }]}>{picker === 'category' ? 'Select Category' : 'Select Product'}</Text><Pressable onPress={() => setPicker(null)}><Text style={styles.remove}>×</Text></Pressable></View>
          <ScrollView>{(picker === 'category' ? categories.map(category => ({ id: category.id, label: category.name })) : availableProducts.map(product => ({ id: product.id, label: product.model }))).map(option => (
            <Pressable key={option.id} onPress={() => {
              if (picker === 'category') { setCategoryId(option.id); setProductId(null); setUnitPrice(''); }
              else { const product = products.find(item => item.id === option.id); setProductId(option.id); setUnitPrice(product ? String(product.unitPrice) : ''); }
              setPicker(null);
            }} style={[styles.option, { borderBottomColor: colors.border }]}><Text style={{ color: colors.text }}>{option.label}</Text></Pressable>
          ))}</ScrollView>
        </View></View>
      </Modal>

      <Modal transparent visible={previewVisible} animationType="slide" onRequestClose={() => setPreviewVisible(false)}>
        <View style={styles.modalBackdrop}><View style={[styles.previewCard, { backgroundColor: colors.surface }]}>
          <View style={styles.modalHeader}><Text style={[styles.sectionTitle, { color: colors.heading }]}>Quotation Preview</Text><Pressable onPress={() => setPreviewVisible(false)}><Text style={styles.remove}>×</Text></Pressable></View>
          <Text style={[styles.previewTitle, { color: colors.heading }]}>QUOTATION</Text>
          <Text style={[styles.infoText, { color: colors.muted }]}>{quotationNumber} · {today}</Text>
          <Text style={[styles.previewCustomer, { color: colors.text }]}>{customerName || 'Customer'}{phoneNumber ? ` · ${phoneNumber}` : ''}{address ? `\n${address}` : ''}</Text>
          <ScrollView style={styles.previewList}>{lines.map((line, index) => <View key={`${line.productId}-preview-${index}`} style={[styles.previewItem, { borderBottomColor: colors.border }]}><Text style={{ color: colors.text, flex: 1 }}>{index + 1}. {line.model} × {line.quantity}</Text><Text style={{ color: colors.heading }}>LKR {money(line.quantity * line.unitPrice)}</Text></View>)}</ScrollView>
          <Text style={styles.previewTotal}>Total: LKR {money(total)}</Text>
          <Text style={[styles.infoText, { color: colors.muted, textAlign: 'center', marginTop: 12 }]}>Not saved in local storage</Text>
        </View></View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: 16, paddingBottom: 130, gap: 12 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 200 },
  notice: { borderWidth: 1, borderColor: '#F2C46D', backgroundColor: '#FFF8E8', borderRadius: 12, padding: 13 },
  noticeTitle: { color: '#855500', fontSize: 13, fontWeight: '800', marginBottom: 4 },
  noticeText: { color: '#745B2B', fontSize: 12, lineHeight: 17 },
  card: { borderWidth: 1, borderRadius: 15, padding: 14, gap: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '800', marginBottom: 2 },
  input: { minHeight: 44, borderWidth: 1, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 9, fontSize: 14 },
  address: { minHeight: 60, textAlignVertical: 'top' },
  dateLine: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 5 },
  infoText: { fontSize: 11 },
  select: { minHeight: 44, borderWidth: 1, borderRadius: 10, paddingHorizontal: 11, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  twoColumns: { flexDirection: 'row', gap: 9 },
  halfInput: { flex: 1 },
  addButton: { minHeight: 42, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FDEBED' },
  addButtonText: { color: '#D91825', fontWeight: '800', fontSize: 13 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth },
  itemDetails: { flex: 1 },
  itemTitle: { fontSize: 12, fontWeight: '700' },
  itemAmount: { fontSize: 11, fontWeight: '700' },
  remove: { color: '#D91825', fontSize: 24, lineHeight: 27, paddingHorizontal: 3 },
  totalLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 3 },
  total: { color: '#D91825', fontSize: 15, fontWeight: '800' },
  actions: { gap: 9 },
  secondaryButton: { minHeight: 47, borderWidth: 1, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontSize: 14, fontWeight: '700' },
  primaryButton: { minHeight: 50, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E51D2A' },
  primaryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  disabled: { opacity: 0.7 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.58)', justifyContent: 'center', padding: 22 },
  modalCard: { maxHeight: '75%', borderRadius: 16, padding: 16 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  option: { minHeight: 46, justifyContent: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
  previewCard: { maxHeight: '85%', borderRadius: 16, padding: 18 },
  previewTitle: { textAlign: 'center', fontSize: 20, fontWeight: '900', letterSpacing: 2, marginVertical: 8 },
  previewCustomer: { fontSize: 12, lineHeight: 19, marginTop: 12 },
  previewList: { marginVertical: 12 },
  previewItem: { minHeight: 38, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', gap: 8 },
  previewTotal: { color: '#D91825', fontSize: 16, fontWeight: '900', textAlign: 'right' },
});
