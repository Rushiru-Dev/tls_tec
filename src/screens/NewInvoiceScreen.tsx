import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Alert,
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Share from 'react-native-share';
import {
  listCategories,
  listProducts,
  type ProductCategory,
  type SavedProduct,
} from '../database/repositories/productRepository';
import {
  createInvoiceNumber,
  getInvoiceById,
  invoiceNumberExists,
  saveInvoice,
  type InvoiceLine,
  type InvoicePayment,
  type InvoiceRecord,
} from '../services/invoiceService';
import { generateInvoicePdf } from '../services/pdfService';
import { defaultAppSettings, getAppSettings, type AppSettings } from '../services/settingsService';

type Props = {
  darkMode: boolean;
  onInvoiceComplete: () => void;
  invoiceId?: number;
};
type Warranty = 'No Warranty' | '1 yrs' | '2 yrs' | '3 yrs';

const warranties: Warranty[] = ['No Warranty', '1 yrs', '2 yrs', '3 yrs'];

function formatDate(date: Date) {
  return `${String(date.getDate()).padStart(2, '0')}.${String(
    date.getMonth() + 1,
  ).padStart(2, '0')}.${date.getFullYear()}`;
}

function formatMoney(value: number) {
  return `LKR ${value.toLocaleString('en-LK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function looksLikeModelNumber(value: string) {
  return /^[A-Z0-9][A-Z0-9-]{4,}$/i.test(value.trim()) && value.includes('-');
}

function invoiceItemTitle(item: InvoiceLine) {
  const description = item.description.trim();
  return description && !looksLikeModelNumber(description) &&
    description.toLowerCase() !== item.model.toLowerCase()
    ? `${description} (${item.model})`
    : item.model;
}

function invoiceItemModelNumber(item: InvoiceLine) {
  return item.modelNumber.trim() ||
    (looksLikeModelNumber(item.description) &&
    item.description.toLowerCase() !== item.model.toLowerCase()
      ? item.description.trim()
      : '');
}

export default function NewInvoiceScreen({
  darkMode,
  onInvoiceComplete,
  invoiceId,
}: Props) {
  const today = useMemo(() => formatDate(new Date()), []);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [products, setProducts] = useState<SavedProduct[]>([]);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(today);
  const [customerName, setCustomerName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [installationAddress, setInstallationAddress] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [productId, setProductId] = useState<number | null>(null);
  const [manualModel, setManualModel] = useState('');
  const [modelNumber, setModelNumber] = useState('');
  const [showModelSerialFields, setShowModelSerialFields] = useState(false);
  const [serialNumber, setSerialNumber] = useState('');
  const [warranty, setWarranty] = useState<Warranty>('No Warranty');
  const [quantity, setQuantity] = useState('1');
  const [unitPrice, setUnitPrice] = useState('');
  const [items, setItems] = useState<InvoiceLine[]>([]);
  const [discount, setDiscount] = useState('');
  const [paymentDate, setPaymentDate] = useState(today);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [payments, setPayments] = useState<InvoicePayment[]>([]);
  const [picker, setPicker] = useState<
    'category' | 'product' | 'warranty' | null
  >(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [working, setWorking] = useState(false);
  const [loadingInvoice, setLoadingInvoice] = useState(true);

  const colors = darkMode
    ? {
        background: '#111216',
        surface: '#1C1D23',
        border: '#2B2D35',
        heading: '#F4F4F6',
        text: '#E7E7EA',
        muted: '#A0A2AA',
        placeholder: '#777A83',
      }
    : {
        background: '#F6F7F9',
        surface: '#FFFFFF',
        border: '#E7E8EB',
        heading: '#18191E',
        text: '#24252B',
        muted: '#7B7E87',
        placeholder: '#9A9CA4',
      };

  useEffect(() => {
    let mounted = true;
    Promise.all([
      listCategories(),
      listProducts(),
      invoiceId ? getInvoiceById(invoiceId) : Promise.resolve(null),
    ])
      .then(async ([savedCategories, savedProducts, savedInvoice]) => {
        if (!mounted) return;
        setCategories(savedCategories);
        setProducts(savedProducts);
        if (invoiceId && savedInvoice) {
          setInvoiceNumber(savedInvoice.invoiceNumber);
          setInvoiceDate(savedInvoice.date);
          setCustomerName(savedInvoice.customerName);
          setPhoneNumber(savedInvoice.phoneNumber);
          setInstallationAddress(savedInvoice.installationAddress);
          setItems(savedInvoice.items);
          setPayments(savedInvoice.payments);
          setDiscount(savedInvoice.discount ? String(savedInvoice.discount) : '');
        } else if (invoiceId) {
          Alert.alert('Invoice not found', 'This invoice could not be loaded.');
        } else {
          const generatedNumber = await createInvoiceNumber(new Date());
          if (mounted) setInvoiceNumber(generatedNumber);
        }
      })
      .catch(() =>
        Alert.alert('Database error', 'Could not load invoice data.'),
      )
      .finally(() => {
        if (mounted) setLoadingInvoice(false);
      });
    return () => {
      mounted = false;
    };
  }, [invoiceId]);

  const selectedCategory = categories.find(item => item.id === categoryId);
  const categoryProducts = products.filter(
    item => item.categoryId === categoryId,
  );
  const selectedProduct = products.find(item => item.id === productId);
  const isManualCategory =
    selectedCategory?.name.trim().toLowerCase() ===
    'custom item / manual entry';
  const subtotal = items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0,
  );
  const discountValue = Number(discount) || 0;
  const netTotal = Math.max(0, subtotal - discountValue);
  const advanceTotal = payments.reduce(
    (sum, payment) => sum + payment.amount,
    0,
  );
  const balance = Math.max(0, netTotal - advanceTotal);
  const quantityValue = Math.floor(Number(quantity));
  const unitPriceValue = Number(unitPrice);
  const currentAmount =
    Number.isFinite(quantityValue) &&
    quantityValue > 0 &&
    Number.isFinite(unitPriceValue) &&
    unitPriceValue >= 0
      ? quantityValue * unitPriceValue
      : 0;

  const record: InvoiceRecord = {
    invoiceNumber: invoiceNumber.trim(),
    date: invoiceDate,
    customerName,
    phoneNumber,
    installationAddress,
    items,
    payments,
    discount: discountValue,
  };

  const inputStyle = [
    styles.input,
    {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      color: colors.text,
    },
  ];

  const addItem = () => {
    if (!selectedCategory || (!isManualCategory && !selectedProduct)) {
      Alert.alert('Select Item', 'Choose a category and item first.');
      return;
    }
    const model = isManualCategory ? manualModel.trim() : selectedProduct?.model ?? '';
    if (!model) {
      Alert.alert('Item / Model', 'Type the item or model name.');
      return;
    }
    const qty = Number(quantity);
    const price = Number(unitPrice);
    if (!Number.isInteger(qty) || qty < 1) {
      Alert.alert('Quantity', 'Enter a quantity of at least 1.');
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      Alert.alert('Unit Price', 'Enter a valid unit price.');
      return;
    }
    setItems(current => [
      ...current,
      {
        productId: selectedProduct?.id ?? 0,
        category: selectedCategory.name,
        model,
        description: isManualCategory ? model : selectedProduct?.description ?? model,
        modelNumber:
          modelNumber.trim() ||
          (selectedProduct && looksLikeModelNumber(selectedProduct.description)
            ? selectedProduct.description.trim()
            : ''),
        serialNumber: serialNumber.trim(),
        warranty,
        quantity: qty,
        unitPrice: price,
      },
    ]);
    setSerialNumber('');
    setModelNumber('');
    setQuantity('1');
    setUnitPrice(isManualCategory ? '' : String(selectedProduct?.unitPrice ?? ''));
    if (isManualCategory) setManualModel('');
  };

  const applyPayment = () => {
    const amount = Number(paymentAmount);
    if (!/^\d{2}\.\d{2}\.\d{4}$/.test(paymentDate)) {
      Alert.alert('Payment Date', 'Use DD.MM.YYYY format.');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert('Payment Amount', 'Enter an amount greater than zero.');
      return;
    }
    if (amount > balance) {
      Alert.alert(
        'Payment Amount',
        'This amount is greater than the remaining balance.',
      );
      return;
    }
    setPayments(current => [...current, { date: paymentDate, amount }]);
    setPaymentAmount('');
  };

  const ensureInvoiceValid = () => {
    if (!invoiceNumber.trim()) {
      Alert.alert(
        'Invoice Number',
        'Enter an invoice number to continue.',
      );
      return false;
    }
    if (items.length === 0) {
      Alert.alert('Invoice Items', 'Add at least one item to the invoice.');
      return false;
    }
    if (discountValue < 0 || discountValue > subtotal) {
      Alert.alert('Discount', 'Discount must be between 0 and the subtotal.');
      return false;
    }
    if (advanceTotal > netTotal) {
      Alert.alert(
        'Discount',
        'The discount cannot reduce the total below the advance payments already applied.',
      );
      return false;
    }
    return true;
  };

  const previewInvoice = () => {
    if (ensureInvoiceValid()) setPreviewOpen(true);
  };

  const saveAndSharePdf = async () => {
    if (!ensureInvoiceValid()) return;
    setWorking(true);
    try {
      if (await invoiceNumberExists(record.invoiceNumber, invoiceId)) {
        Alert.alert(
          'Invoice Number Already Used',
          'Enter a different invoice number. Each invoice number can only be used once.',
        );
        return;
      }
      await saveInvoice(record, invoiceId);
      const filePath = await generateInvoicePdf(record);
      await Share.open({
        title: `Invoice ${record.invoiceNumber}`,
        message: `Invoice ${record.invoiceNumber} - ${customerName}`,
        url: filePath.startsWith('file://') ? filePath : `file://${filePath}`,
        type: 'application/pdf',
        failOnCancel: false,
      });
      onInvoiceComplete();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Please try again.';
      Alert.alert(
        'Invoice PDF',
        `Could not finish creating or sharing the PDF. ${message}`,
      );
    } finally {
      setWorking(false);
    }
  };

  const openPicker = () => {
    if (picker === 'category') {
      return categories.map(category => ({
        label: category.name,
        value: category.id,
      }));
    }
    if (picker === 'product') {
      return categoryProducts.map(product => ({
        label: product.model,
        value: product.id,
      }));
    }
    if (picker === 'warranty') {
      return warranties.map(value => ({ label: value, value }));
    }
    return [];
  };

  const pickerOptions = openPicker();
  const pickerTitle =
    picker === 'category'
      ? 'Select Category'
      : picker === 'product'
      ? 'Select Item / Model'
      : 'Select Warranty';

  if (loadingInvoice) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#E51D2A" />
        <Text style={[styles.loadingText, { color: colors.muted }]}>
          Loading invoice…
        </Text>
      </View>
    );
  }

  const section = (title: string, children: ReactNode) => (
    <View
      style={[
        styles.section,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <Text style={[styles.sectionTitle, { color: colors.heading }]}>
        {title}
      </Text>
      {children}
    </View>
  );

  const field = (label: string, child: ReactNode) => (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.heading }]}>{label}</Text>
      {child}
    </View>
  );

  const pickerField = (label: string, value: string, onPress: () => void) =>
    field(
      label,
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={[...inputStyle, styles.pickerInput]}
      >
        <Text
          numberOfLines={1}
          style={{ color: value ? colors.text : colors.placeholder }}
        >
          {value || `Select ${label.toLowerCase()}`}
        </Text>
        <Text style={{ color: colors.muted }}>⌄</Text>
      </Pressable>,
    );

  return (
    <View style={styles.container}>
      {section(
        invoiceId ? 'Update Invoice' : '1. Client Details (Optional)',
        <>
          {field(
            'Customer Name (Optional)',
            <TextInput
              value={customerName}
              onChangeText={setCustomerName}
              placeholder="Customer name"
              placeholderTextColor={colors.placeholder}
              style={inputStyle}
            />,
          )}
          {field(
            'Phone Number (Optional)',
            <TextInput
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              placeholder="Phone number"
              placeholderTextColor={colors.placeholder}
              keyboardType="phone-pad"
              style={inputStyle}
            />,
          )}
          {field(
            'Installation Address (Optional)',
            <TextInput
              value={installationAddress}
              onChangeText={setInstallationAddress}
              placeholder="Installation address"
              placeholderTextColor={colors.placeholder}
              multiline
              style={[...inputStyle, styles.addressInput]}
            />,
          )}
          <View style={styles.twoColumns}>
            {field(
              'Invoice Number (Auto)',
              <TextInput
                value={invoiceNumber}
                editable={false}
                placeholder="Generating invoice number…"
                placeholderTextColor={colors.placeholder}
                maxLength={40}
                style={inputStyle}
              />,
            )}
            {field(
              'Date',
              <TextInput
                value={invoiceDate}
                editable={false}
                style={[...inputStyle, styles.readOnlyInput]}
              />,
            )}
          </View>
        </>,
      )}

      {section(
        '2. Item Select & Adding',
        <>
          {pickerField('Category', selectedCategory?.name ?? '', () =>
            setPicker('category'),
          )}
          {isManualCategory ? (
            field(
              'Item / Model *',
              <TextInput
                value={manualModel}
                onChangeText={setManualModel}
                placeholder="Type item or model name"
                placeholderTextColor={colors.placeholder}
                style={inputStyle}
              />,
            )
          ) : (
            pickerField('Item / Model', selectedProduct?.model ?? '', () => {
              if (categoryId === null) {
                Alert.alert(
                  'Select Category',
                  'Choose a category before selecting a product.',
                );
                return;
              }
              setPicker('product');
            })
          )}
          <View style={styles.optionalDetailsRow}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setShowModelSerialFields(current => !current)}
              style={styles.addOptionalDetailsButton}
            >
              <Text style={styles.addOptionalDetailsText}>
                {showModelSerialFields ? '− Hide Model / S/N' : '+ Add Model / S/N'}
              </Text>
            </Pressable>
          </View>
          {showModelSerialFields ? (
            <>
              {field(
                'Model Number (Optional)',
                <TextInput
                  value={modelNumber}
                  onChangeText={setModelNumber}
                  placeholder="Type model / part number"
                  placeholderTextColor={colors.placeholder}
                  style={inputStyle}
                />,
              )}
              {field(
                'Serial Number(s) (Optional)',
                <TextInput
                  value={serialNumber}
                  onChangeText={setSerialNumber}
                  placeholder="Separate multiple serial numbers with commas"
                  placeholderTextColor={colors.placeholder}
                  style={inputStyle}
                />,
              )}
            </>
          ) : null}
          {pickerField('Warranty', warranty, () => setPicker('warranty'))}
          <View style={styles.twoColumns}>
            {field(
              'Quantity',
              <TextInput
                value={quantity}
                onChangeText={setQuantity}
                keyboardType="number-pad"
                style={inputStyle}
              />,
            )}
            {field(
              'Unit Price (LKR)',
              <TextInput
                value={unitPrice}
                onChangeText={setUnitPrice}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={colors.placeholder}
                style={inputStyle}
              />,
            )}
          </View>
          <View
            style={[
              styles.subtotalPreview,
              { backgroundColor: darkMode ? '#272027' : '#FFF1F2' },
            ]}
          >
            <Text style={[styles.subtotalLabel, { color: colors.muted }]}>
              Item Subtotal · {quantityValue > 0 ? quantityValue : 0} ×{' '}
              {Number.isFinite(unitPriceValue) && unitPriceValue >= 0
                ? formatMoney(unitPriceValue)
                : formatMoney(0)}
            </Text>
            <Text style={styles.subtotalAmount}>
              {formatMoney(currentAmount)}
            </Text>
          </View>
          <Pressable
            onPress={addItem}
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.secondaryButtonText}>
              + Add Item to Invoice
            </Text>
          </Pressable>
        </>,
      )}

      {section(
        'Added Items',
        items.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.muted }]}>
            Select products above to add invoice lines.
          </Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator>
            <View>
              <View style={styles.itemsHeader}>
                <Text style={[styles.tableHead, styles.noColumn]}>#</Text>
                <Text style={[styles.tableHead, styles.itemColumn]}>
                  ITEM / DESCRIPTION
                </Text>
                <Text style={[styles.tableHead, styles.warrantyColumn]}>
                  WARRANTY
                </Text>
                <Text style={[styles.tableHead, styles.qtyColumn]}>QTY</Text>
                <Text style={[styles.tableHead, styles.unitColumn]}>
                  UNIT PRICE
                </Text>
                <Text style={[styles.tableHead, styles.amountColumn]}>
                  AMOUNT (LKR)
                </Text>
                <Text style={[styles.tableHead, styles.actionColumn]}>
                  ACTION
                </Text>
              </View>
              {items.map((item, index) => (
                <View
                  key={`${item.productId}-${index}`}
                  style={[
                    styles.itemsRow,
                    { borderBottomColor: colors.border },
                  ]}
                >
                  <Text
                    style={[
                      styles.tableCell,
                      styles.noColumn,
                      { color: colors.text },
                    ]}
                  >
                    {index + 1}
                  </Text>
                  <View style={[styles.itemColumn, styles.descriptionCell]}>
                    <Text style={[styles.itemText, { color: colors.text }]}>
                      {item.model}
                    </Text>
                    {item.description &&
                    !looksLikeModelNumber(item.description) &&
                    item.description.toLowerCase() !== item.model.toLowerCase() ? (
                      <Text style={[styles.serialText, { color: colors.muted }]}>
                        {item.description}
                      </Text>
                    ) : null}
                    {invoiceItemModelNumber(item) ? (
                      <Text
                        style={[styles.serialText, { color: colors.muted }]}
                      >
                        {invoiceItemModelNumber(item)}
                      </Text>
                    ) : null}
                    {item.serialNumber ? (
                      <Text
                        style={[styles.serialText, { color: colors.muted }]}
                      >
                        S/N: {item.serialNumber}
                      </Text>
                    ) : null}
                  </View>
                  <Text
                    style={[
                      styles.tableCell,
                      styles.warrantyColumn,
                      { color: colors.text },
                    ]}
                  >
                    {item.warranty === 'No Warranty' ? '-' : item.warranty}
                  </Text>
                  <Text
                    style={[
                      styles.tableCell,
                      styles.qtyColumn,
                      { color: colors.text },
                    ]}
                  >
                    {item.quantity}
                  </Text>
                  <Text
                    style={[
                      styles.tableCell,
                      styles.unitColumn,
                      { color: colors.text },
                    ]}
                  >
                    {item.unitPrice.toFixed(2)}
                  </Text>
                  <Text
                    style={[
                      styles.tableCell,
                      styles.amountColumn,
                      styles.amountText,
                    ]}
                  >
                    {(item.unitPrice * item.quantity).toFixed(2)}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${item.model}`}
                    onPress={() =>
                      setItems(current =>
                        current.filter((_, itemIndex) => itemIndex !== index),
                      )
                    }
                    style={[styles.deleteItemButton, styles.actionColumn]}
                  >
                    <Text style={styles.deleteItemText}>×</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          </ScrollView>
        ),
      )}

      {section(
        '3. Payment & Instalment',
        <>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: colors.text }]}>
              Total Amount
            </Text>
            <Text style={[styles.summaryValue, { color: colors.heading }]}>
              {formatMoney(subtotal)}
            </Text>
          </View>
          {field(
            'Discount (LKR) · Optional',
            <TextInput
              value={discount}
              onChangeText={setDiscount}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={colors.placeholder}
              style={inputStyle}
            />,
          )}
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: colors.text }]}>
              Net Total
            </Text>
            <Text style={[styles.summaryValue, { color: colors.heading }]}>
              {formatMoney(netTotal)}
            </Text>
          </View>
          <Text style={[styles.subheading, { color: colors.heading }]}>
            Advance Payments (Instalments)
          </Text>
          <View style={styles.twoColumns}>
            {field(
              'Advance Date',
              <TextInput
                value={paymentDate}
                onChangeText={setPaymentDate}
                placeholder="DD.MM.YYYY"
                placeholderTextColor={colors.placeholder}
                style={inputStyle}
              />,
            )}
            {field(
              'Amount (LKR)',
              <TextInput
                value={paymentAmount}
                onChangeText={setPaymentAmount}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={colors.placeholder}
                style={inputStyle}
              />,
            )}
          </View>
          <Pressable
            onPress={applyPayment}
            style={({ pressed }) => [
              styles.outlineButton,
              { borderColor: '#E51D2A' },
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.outlineButtonText}>Apply Payment</Text>
          </Pressable>
          {payments.map((payment, index) => (
            <View
              key={`${payment.date}-${index}`}
              style={[styles.paymentRow, { borderBottomColor: colors.border }]}
            >
              <Text style={[styles.paymentText, { color: colors.text }]}>
                Advance {String(index + 1).padStart(2, '0')} · {payment.date}
              </Text>
              <View style={styles.paymentRight}>
                <Text style={[styles.paymentText, { color: colors.text }]}>
                  {formatMoney(payment.amount)}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Remove applied payment"
                  onPress={() =>
                    setPayments(current =>
                      current.filter(
                        (_, paymentIndex) => paymentIndex !== index,
                      ),
                    )
                  }
                >
                  <Text style={styles.removePayment}>×</Text>
                </Pressable>
              </View>
            </View>
          ))}
          <View
            style={[
              styles.balanceCard,
              { backgroundColor: darkMode ? '#202027' : '#F0F1F4' },
            ]}
          >
            <Text style={[styles.balanceLabel, { color: colors.muted }]}>
              Balance Payment Due
            </Text>
            <Text style={styles.balanceValue}>{formatMoney(balance)}</Text>
          </View>
        </>,
      )}

      <View style={styles.actions}>
        <Pressable
          onPress={previewInvoice}
          style={({ pressed }) => [
            styles.previewButton,
            { borderColor: colors.border, backgroundColor: colors.surface },
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.previewButtonText, { color: colors.heading }]}>
            Preview Invoice
          </Text>
        </Pressable>
        <Pressable
          disabled={working}
          onPress={saveAndSharePdf}
          style={({ pressed }) => [
            styles.saveButton,
            (pressed || working) && styles.pressed,
          ]}
        >
          {working ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.saveButtonText}>
              {invoiceId ? 'Update & Generate PDF' : 'Save & Generate PDF'}
            </Text>
          )}
        </Pressable>
      </View>

      <Modal
        transparent
        visible={picker !== null}
        animationType="fade"
        onRequestClose={() => setPicker(null)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close selection"
            style={StyleSheet.absoluteFill}
            onPress={() => setPicker(null)}
          />
          <View
            style={[
              styles.modalCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.heading }]}>
                {pickerTitle}
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setPicker(null)}
              >
                <Text style={styles.closeButton}>×</Text>
              </Pressable>
            </View>
            {pickerOptions.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.muted }]}>
                {picker === 'category'
                  ? 'No categories found. Add a product category first.'
                  : 'No products in this category yet.'}
              </Text>
            ) : (
              <ScrollView style={styles.optionList}>
                {pickerOptions.map(option => (
                  <Pressable
                    key={String(option.value)}
                    onPress={() => {
                      if (picker === 'category') {
                        setCategoryId(Number(option.value));
                        setProductId(null);
                        setManualModel('');
                        setUnitPrice('');
                        setWarranty('No Warranty');
                      } else if (picker === 'product') {
                        const selected = products.find(
                          product => product.id === option.value,
                        );
                        setProductId(Number(option.value));
                        setUnitPrice(
                          selected ? String(selected.unitPrice) : '',
                        );
                        const defaultWarranty = selected?.defaultWarranty as Warranty;
                        setWarranty(
                          warranties.includes(defaultWarranty)
                            ? defaultWarranty
                            : 'No Warranty',
                        );
                      } else if (picker === 'warranty') {
                        setWarranty(option.value as Warranty);
                      }
                      setPicker(null);
                    }}
                    style={[
                      styles.optionRow,
                      { borderBottomColor: colors.border },
                    ]}
                  >
                    <Text style={[styles.optionText, { color: colors.text }]}>
                      {option.label}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      <Modal
        transparent
        visible={previewOpen}
        animationType="slide"
        onRequestClose={() => setPreviewOpen(false)}
      >
        <View style={styles.previewBackdrop}>
          <View
            style={[
              styles.previewModal,
              { backgroundColor: colors.background },
            ]}
          >
            <View
              style={[
                styles.previewToolbar,
                { borderBottomColor: colors.border },
              ]}
            >
              <Text
                style={[styles.previewToolbarTitle, { color: colors.heading }]}
              >
                Invoice Preview
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setPreviewOpen(false)}
              >
                <Text style={styles.closeButton}>×</Text>
              </Pressable>
            </View>
            <InvoicePreview invoice={record} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

function InvoicePreview({ invoice }: { invoice: InvoiceRecord }) {
  const [businessSettings, setBusinessSettings] = useState<AppSettings>(defaultAppSettings);
  useEffect(() => {
    getAppSettings().then(setBusinessSettings).catch(() => {});
  }, []);
  const subtotal = invoice.items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0,
  );
  const paid = invoice.payments.reduce(
    (sum, payment) => sum + payment.amount,
    0,
  );
  const net = Math.max(0, subtotal - invoice.discount);
  const balance = Math.max(0, net - paid);
  const printAmount = (amount: number) =>
    amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  return (
    <ScrollView
      style={styles.previewScroll}
      contentContainerStyle={styles.previewPage}
    >
      <View style={styles.invoiceHeader}>
        <Image
          source={require('../img/logo.png')}
          style={styles.previewLogo}
          resizeMode="contain"
        />
        <View style={styles.invoiceBrand}>
          <Text style={styles.invoiceBrandTitle}>{businessSettings.businessName}</Text>
          <Text style={styles.invoiceBrandDetails}>
            {businessSettings.businessAddress}{'\n'}Tel: {businessSettings.businessMobile}{'\n'}
            Email: {businessSettings.businessEmail}
          </Text>
        </View>
      </View>
      <View style={styles.invoiceTitleBadge}>
        <Text style={styles.invoiceHeading}>INVOICE</Text>
      </View>
      <View style={styles.invoiceInfoRow}>
        <View style={styles.invoiceInfoColumn}>
          <Text style={styles.invoiceInfoLabel}>Customer / Installation Site</Text>
          <Text style={styles.invoiceText}>
            <Text style={styles.invoiceStrong}>Name:</Text>
            {invoice.customerName ? ` ${invoice.customerName}` : ''}
          </Text>
          <Text style={styles.invoiceText}>
            <Text style={styles.invoiceStrong}>Mobile:</Text>
            {invoice.phoneNumber ? ` ${invoice.phoneNumber}` : ''}
          </Text>
          <Text style={styles.invoiceText}>
            <Text style={styles.invoiceStrong}>Address:</Text>
            {invoice.installationAddress
              ? ` ${invoice.installationAddress}`
              : ''}
          </Text>
        </View>
        <View style={[styles.invoiceInfoColumn, styles.invoiceRightInfo]}>
          <Text style={[styles.invoiceInfoLabel, styles.invoiceInfoRightTitle]}>Invoice Information</Text>
          <View style={styles.invoiceMetaLine}>
            <Text style={styles.invoiceText}>
              <Text style={styles.invoiceStrong}>Invoice No:</Text> {invoice.invoiceNumber}
            </Text>
          </View>
          <View style={styles.invoiceMetaLine}>
            <Text style={styles.invoiceText}>
              <Text style={styles.invoiceStrong}>Date:</Text> {invoice.date}
            </Text>
          </View>
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator>
        <View>
          <View style={styles.previewTableHeader}>
            <Text style={[styles.previewTh, styles.previewNoColumn]}>#</Text>
            <Text style={[styles.previewTh, styles.previewItemColumn, styles.previewDescriptionHeader]}>
              Item / Description
            </Text>
            <Text style={[styles.previewTh, styles.previewWarrantyColumn]}>
              Warranty
            </Text>
            <Text style={[styles.previewTh, styles.previewQtyColumn]}>Qty</Text>
            <Text style={[styles.previewTh, styles.previewUnitColumn, styles.previewRight]}>
              Unit Price
            </Text>
            <Text style={[styles.previewTh, styles.previewAmountColumn, styles.previewRight]}>Amount</Text>
          </View>
          {invoice.items.map((item, index) => (
            <View
              key={`${item.productId}-${index}`}
              style={styles.previewTableRow}
            >
              <Text style={[styles.previewTd, styles.previewNoColumn]}>
                {index + 1}
              </Text>
              <View style={[styles.previewItemColumn, styles.previewItemCell]}>
                <Text style={[styles.previewTd, styles.previewDescription]}>
                  {invoiceItemTitle(item)}
                </Text>
                {invoiceItemModelNumber(item) ? (
                  <Text style={styles.previewSerial}>
                    {invoiceItemModelNumber(item)}
                  </Text>
                ) : null}
                {item.serialNumber ? (
                  <Text style={styles.previewSerial}>
                    S/N: {item.serialNumber}
                  </Text>
                ) : null}
              </View>
              <Text style={[styles.previewTd, styles.previewWarrantyColumn]}>
                {item.warranty === 'No Warranty'
                  ? ''
                  : item.warranty.replace(' yrs', 'yr')}
              </Text>
              <Text style={[styles.previewTd, styles.previewQtyColumn]}>
                {item.quantity}
              </Text>
              <Text style={[styles.previewTd, styles.previewUnitColumn, styles.previewRight]}>
                {printAmount(item.unitPrice)}
              </Text>
              <Text style={[styles.previewTdStrong, styles.previewAmountColumn, styles.previewRight]}>
                {printAmount(item.unitPrice * item.quantity)}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
      <View style={styles.previewSummaryContainer}>
        <View style={styles.previewSummaryCard}>
          <View style={[styles.previewSummaryLine, styles.previewTotalLine]}>
            <Text style={[styles.previewPaymentText, styles.previewSummaryStrong]}>Total Amount</Text>
            <Text style={[styles.previewSummaryAmount, styles.previewSummaryStrong]}>LKR {printAmount(subtotal)}</Text>
          </View>
          {invoice.discount > 0 ? (
            <View style={styles.previewSummaryLine}>
              <Text style={styles.previewPaymentText}>Discount</Text>
              <Text style={styles.previewSummaryAmount}>- LKR {printAmount(invoice.discount)}</Text>
            </View>
          ) : null}
        {invoice.payments.map((payment, index) => (
          <View
            key={`${payment.date}-${index}`}
            style={styles.previewSummaryLine}
          >
            <Text style={styles.previewPaymentText}>
              Advance Payment {String(index + 1).padStart(2, '0')} ({payment.date})
            </Text>
            <Text style={styles.previewSummaryAmount}>
              LKR {printAmount(payment.amount)}
            </Text>
          </View>
        ))}
          <View style={[styles.previewSummaryLine, styles.previewBalanceLine]}>
            <Text style={[styles.previewPaymentText, styles.previewBalanceText]}>Balance Payment Due</Text>
            <Text style={[styles.previewSummaryAmount, styles.previewBalanceText]}>LKR {printAmount(balance)}</Text>
          </View>
        </View>
      </View>
      {businessSettings.invoiceTerms.trim() ? <Text style={styles.invoiceTerms}>{businessSettings.invoiceTerms}</Text> : null}
      <Text style={styles.invoiceFooter}>Thank You. {businessSettings.businessName}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: 18, paddingBottom: 130 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontSize: 13, marginTop: 10 },
  section: { borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 13 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 6 },
  field: { flex: 1, marginTop: 11 },
  label: { fontSize: 12, fontWeight: '600', marginBottom: 6 },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 9,
    fontSize: 14,
  },
  addressInput: { minHeight: 68, textAlignVertical: 'top' },
  readOnlyInput: { opacity: 0.75 },
  twoColumns: { flexDirection: 'row', gap: 10 },
  pickerInput: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  subtotalPreview: {
    marginTop: 14,
    padding: 12,
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subtotalLabel: { fontSize: 12 },
  subtotalAmount: { color: '#D91825', fontSize: 14, fontWeight: '700' },
  secondaryButton: {
    minHeight: 45,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#E51D2A',
    marginTop: 13,
  },
  secondaryButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  emptyText: { fontSize: 13, lineHeight: 19, paddingVertical: 8 },
  itemsHeader: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7,
  },
  itemsRow: {
    minHeight: 53,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  tableHead: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
    paddingHorizontal: 6,
  },
  tableCell: { fontSize: 11, paddingHorizontal: 6, textAlign: 'center' },
  noColumn: { width: 30, textAlign: 'center' },
  itemColumn: { width: 160 },
  warrantyColumn: { width: 73, textAlign: 'center' },
  qtyColumn: { width: 42, textAlign: 'center' },
  unitColumn: { width: 83, textAlign: 'right' },
  amountColumn: { width: 96, textAlign: 'right' },
  actionColumn: { width: 48, textAlign: 'center' },
  descriptionCell: { paddingHorizontal: 6, paddingVertical: 6 },
  itemText: { fontSize: 11, fontWeight: '700' },
  serialText: { fontSize: 9, marginTop: 2 },
  optionalDetailsRow: { alignItems: 'flex-end', marginTop: -5 },
  addOptionalDetailsButton: { minHeight: 30, paddingHorizontal: 8, justifyContent: 'center' },
  addOptionalDetailsText: { color: '#D91825', fontSize: 12, fontWeight: '700' },
  amountText: { color: '#0F172A', fontWeight: '700' },
  deleteItemButton: { paddingVertical: 7 },
  deleteItemText: {
    color: '#E51D2A',
    textAlign: 'center',
    fontSize: 23,
    lineHeight: 25,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 11,
  },
  summaryLabel: { fontSize: 13 },
  summaryValue: { fontSize: 14, fontWeight: '700' },
  subheading: { fontSize: 14, fontWeight: '700', marginTop: 19 },
  outlineButton: {
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 10,
    marginTop: 11,
  },
  outlineButtonText: { color: '#D91825', fontSize: 13, fontWeight: '700' },
  paymentRow: {
    minHeight: 43,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  paymentRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  paymentText: { fontSize: 12 },
  removePayment: { color: '#E51D2A', fontSize: 21, paddingHorizontal: 4 },
  balanceCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 10,
    padding: 13,
    marginTop: 13,
  },
  balanceLabel: { fontSize: 12, fontWeight: '600' },
  balanceValue: { color: '#D91825', fontSize: 16, fontWeight: '800' },
  actions: { gap: 10, marginTop: 4 },
  previewButton: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewButtonText: { fontSize: 14, fontWeight: '700' },
  saveButton: {
    minHeight: 50,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E51D2A',
  },
  saveButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  pressed: { opacity: 0.78 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: 22,
  },
  modalCard: {
    borderWidth: 1,
    borderRadius: 17,
    padding: 17,
    maxHeight: '75%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  closeButton: {
    color: '#E51D2A',
    fontSize: 29,
    lineHeight: 32,
    paddingHorizontal: 6,
  },
  optionList: { maxHeight: 390 },
  optionRow: {
    minHeight: 46,
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  optionText: { fontSize: 14 },
  previewBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.68)',
    paddingTop: 36,
    paddingHorizontal: 12,
    paddingBottom: 20,
  },
  previewModal: { flex: 1, borderRadius: 16, overflow: 'hidden' },
  previewToolbar: {
    height: 48,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    borderBottomWidth: 1,
  },
  previewToolbarTitle: { fontSize: 15, fontWeight: '700' },
  previewScroll: { flex: 1 },
  previewPage: { backgroundColor: '#FFFFFF', padding: 10, minHeight: 700 },
  invoiceHeader: {
    minHeight: 92,
    backgroundColor: '#000000',
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: '#0F172A',
    marginBottom: 14,
  },
  previewLogo: { width: 115, height: 58, alignSelf: 'center' },
  invoiceBrand: { alignItems: 'flex-end' },
  invoiceBrandTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '800', textTransform: 'uppercase' },
  invoiceBrandDetails: {
    color: '#CCCCCC',
    fontSize: 7,
    lineHeight: 11,
    textAlign: 'right',
    marginTop: 2,
  },
  invoiceTitleBadge: { alignItems: 'center', marginBottom: 14 },
  invoiceHeading: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 2,
  },
  invoiceInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 82,
    marginBottom: 16,
    paddingHorizontal: 10,
  },
  invoiceInfoColumn: { flex: 1 },
  invoiceInfoLabel: {
    color: '#64748B',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginBottom: 5,
    textTransform: 'uppercase',
  },
  invoiceInfoRightTitle: { textAlign: 'right' },
  invoiceRightInfo: { alignItems: 'flex-end', justifyContent: 'flex-start' },
  invoiceMetaLine: {
    width: '100%',
    alignItems: 'flex-end',
  },
  invoiceStrong: {
    color: '#0F172A',
    fontSize: 9,
    fontWeight: '700',
    marginBottom: 3,
  },
  invoiceText: { color: '#111111', fontSize: 9, lineHeight: 15 },
  previewTableHeader: {
    width: 484,
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
  },
  previewTh: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '400',
    paddingHorizontal: 5,
  },
  previewDescriptionHeader: { textAlign: 'left' },
  previewTableRow: {
    width: 484,
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  previewTd: {
    color: '#111111',
    fontSize: 8,
    textAlign: 'center',
    paddingHorizontal: 5,
  },
  previewDescription: { textAlign: 'left' },
  previewCentered: { textAlign: 'center' },
  previewRight: { textAlign: 'right' },
  previewNoColumn: { width: 24, textAlign: 'center' },
  previewItemColumn: { width: 227 },
  previewWarrantyColumn: { width: 48, textAlign: 'center' },
  previewQtyColumn: { width: 39, textAlign: 'center' },
  previewUnitColumn: { width: 73 },
  previewAmountColumn: { width: 73 },
  previewTdStrong: {
    color: '#111111',
    fontSize: 8,
    fontWeight: '700',
    textAlign: 'right',
    paddingHorizontal: 5,
  },
  previewItemCell: { paddingVertical: 5 },
  previewSerial: {
    color: '#111111',
    fontSize: 8,
    fontWeight: '700',
    marginLeft: 5,
    marginTop: 2,
  },
  previewSummaryContainer: { alignItems: 'flex-end', marginTop: 0, marginBottom: 18 },
  previewSummaryCard: {
    width: 300,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    overflow: 'hidden',
  },
  previewSummaryLine: {
    minHeight: 32,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  previewTotalLine: { backgroundColor: '#F1F5F9' },
  previewSummaryStrong: { fontWeight: '700', color: '#0F172A' },
  previewPaymentText: { color: '#334155', fontSize: 9, flexShrink: 1 },
  previewSummaryAmount: {
    color: '#334155',
    fontSize: 9,
    textAlign: 'right',
    flexShrink: 0,
  },
  previewBalanceLine: {
    minHeight: 36,
    backgroundColor: '#FEF2F2',
    borderBottomWidth: 0,
  },
  previewBalanceText: { color: '#B91C1C', fontWeight: '800', fontSize: 10 },
  invoiceFooter: {
    textAlign: 'center',
    color: '#64748B',
    fontSize: 9,
    marginTop: 8,
  },
  invoiceTerms: { color: '#475569', fontSize: 8, lineHeight: 12, marginTop: 10 },
});
