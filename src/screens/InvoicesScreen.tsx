import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  listInvoices,
  type InvoiceHistoryRecord,
} from '../services/invoiceService';

type Props = {
  darkMode: boolean;
  onSelectInvoice: (invoiceId: number) => void;
};

function money(value: number) {
  return `LKR ${value.toLocaleString('en-LK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function InvoicesScreen({ darkMode, onSelectInvoice }: Props) {
  const [invoices, setInvoices] = useState<InvoiceHistoryRecord[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const colors = darkMode
    ? {
        surface: '#1C1D23',
        border: '#2B2D35',
        heading: '#F4F4F6',
        text: '#E7E7EA',
        muted: '#A0A2AA',
        input: '#111216',
      }
    : {
        surface: '#FFFFFF',
        border: '#E7E8EB',
        heading: '#18191E',
        text: '#24252B',
        muted: '#7B7E87',
        input: '#FFFFFF',
      };

  const refresh = () => {
    setLoading(true);
    setError('');
    listInvoices()
      .then(setInvoices)
      .catch(() => setError('Could not load invoice history. Please retry.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refresh();
  }, []);

  const filteredInvoices = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return invoices;
    return invoices.filter(invoice =>
      [invoice.invoiceNumber, invoice.customerName, invoice.phoneNumber]
        .join(' ')
        .toLowerCase()
        .includes(needle),
    );
  }, [invoices, query]);

  return (
    <View style={styles.container}>
      <View style={styles.headingRow}>
        <View>
          <Text style={[styles.title, { color: colors.heading }]}>Invoices</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>Invoice history</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={refresh}
          style={({ pressed }) => [styles.refreshButton, pressed && styles.pressed]}
        >
          <Text style={styles.refreshText}>↻</Text>
        </Pressable>
      </View>

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search invoice, customer or mobile"
        placeholderTextColor={colors.muted}
        style={[
          styles.search,
          {
            backgroundColor: colors.input,
            borderColor: colors.border,
            color: colors.text,
          },
        ]}
      />

      {loading ? (
        <ActivityIndicator color="#E51D2A" style={styles.loader} />
      ) : error ? (
        <Pressable onPress={refresh} style={styles.emptyState}>
          <Text style={[styles.emptyTitle, { color: colors.heading }]}>{error}</Text>
          <Text style={[styles.emptyHint, { color: colors.muted }]}>Tap to retry</Text>
        </Pressable>
      ) : filteredInvoices.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyTitle, { color: colors.heading }]}>
            {invoices.length === 0 ? 'No invoices yet' : 'No matching invoices'}
          </Text>
          <Text style={[styles.emptyHint, { color: colors.muted }]}>
            {invoices.length === 0
              ? 'Saved invoices will appear here.'
              : 'Try another invoice number, customer or mobile.'}
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {filteredInvoices.map(invoice => {
            const status =
              invoice.balance <= 0
                ? 'Paid'
                : invoice.paid > 0
                  ? 'Partially Paid'
                  : 'Unpaid';
            return (
              <Pressable
                key={invoice.id}
                accessibilityRole="button"
                accessibilityLabel={`Update invoice ${invoice.invoiceNumber}`}
                onPress={() => onSelectInvoice(invoice.id)}
                style={[
                  styles.card,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <View style={styles.cardTop}>
                  <View style={styles.cardIdentity}>
                    <Text style={[styles.invoiceNumber, { color: colors.heading }]}>
                      {invoice.invoiceNumber}
                    </Text>
                    <Text style={[styles.customer, { color: colors.text }]}>
                      {invoice.customerName || 'Customer not provided'}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.status,
                      status === 'Paid' ? styles.paidStatus : styles.openStatus,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        status === 'Paid' ? styles.paidText : styles.openText,
                      ]}
                    >
                      {status}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.meta, { color: colors.muted }]}>
                  {invoice.date}{invoice.phoneNumber ? `  ·  ${invoice.phoneNumber}` : ''}
                </Text>
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <View style={styles.amountRow}>
                  <View>
                    <Text style={[styles.amountLabel, { color: colors.muted }]}>Total Amount</Text>
                    <Text style={[styles.amount, { color: colors.heading }]}>
                      {money(invoice.total)}
                    </Text>
                  </View>
                  <View style={styles.balanceBlock}>
                    <Text style={[styles.amountLabel, { color: colors.muted }]}>Balance Due</Text>
                    <Text style={[styles.balance, { color: invoice.balance > 0 ? '#D91825' : colors.heading }]}>
                      {money(invoice.balance)}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.itemCount, { color: colors.muted }]}>
                  {invoice.itemCount} {invoice.itemCount === 1 ? 'item' : 'items'}
                  {invoice.discount > 0 ? `  ·  Discount ${money(invoice.discount)}` : ''}
                </Text>
                <Text style={styles.updateHint}>Tap to open and update</Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: 18, paddingBottom: 130 },
  headingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 24, fontWeight: '800' },
  subtitle: { fontSize: 13, marginTop: 3 },
  refreshButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FDEBED',
  },
  refreshText: { color: '#D91825', fontSize: 26, lineHeight: 30 },
  search: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 13,
    fontSize: 14,
    marginBottom: 14,
  },
  loader: { marginTop: 42 },
  emptyState: { alignItems: 'center', paddingHorizontal: 20, paddingVertical: 42 },
  emptyTitle: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  emptyHint: { fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 6 },
  list: { gap: 11 },
  card: { borderWidth: 1, borderRadius: 15, padding: 14 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  cardIdentity: { flex: 1 },
  invoiceNumber: { fontSize: 14, fontWeight: '800' },
  customer: { fontSize: 13, fontWeight: '600', marginTop: 5 },
  status: { borderRadius: 20, paddingHorizontal: 9, paddingVertical: 5 },
  paidStatus: { backgroundColor: '#E8F7EE' },
  openStatus: { backgroundColor: '#FFF3E5' },
  statusText: { fontSize: 10, fontWeight: '700' },
  paidText: { color: '#16803C' },
  openText: { color: '#A95600' },
  meta: { fontSize: 11, marginTop: 8 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 11 },
  amountRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  balanceBlock: { alignItems: 'flex-end' },
  amountLabel: { fontSize: 10 },
  amount: { fontSize: 13, fontWeight: '700', marginTop: 4 },
  balance: { fontSize: 13, fontWeight: '800', marginTop: 4 },
  itemCount: { fontSize: 10, marginTop: 10 },
  updateHint: { color: '#D91825', fontSize: 10, fontWeight: '700', marginTop: 8 },
  pressed: { opacity: 0.75 },
});
