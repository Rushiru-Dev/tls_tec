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
  getQuotationById,
  listQuotations,
  type QuotationHistoryRecord,
  type QuotationRecord,
} from '../services/quotationService';

type Props = {
  darkMode: boolean;
  onUpdateQuotation: (quotationId: number) => void;
};

function money(value: number) {
  return `LKR ${value.toLocaleString('en-LK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function QuotationsScreen({ darkMode, onUpdateQuotation }: Props) {
  const [quotations, setQuotations] = useState<QuotationHistoryRecord[]>([]);
  const [selected, setSelected] = useState<QuotationRecord | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const colors = darkMode
    ? { surface: '#1C1D23', border: '#2B2D35', heading: '#F4F4F6', text: '#E7E7EA', muted: '#A0A2AA', input: '#111216' }
    : { surface: '#FFFFFF', border: '#E7E8EB', heading: '#18191E', text: '#24252B', muted: '#7B7E87', input: '#FFFFFF' };

  const refresh = () => {
    setLoading(true);
    setError('');
    listQuotations()
      .then(setQuotations)
      .catch(() => setError('Could not load quotation history. Please retry.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refresh();
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return quotations;
    return quotations.filter(quotation =>
      [quotation.quotationNumber, quotation.customerName, quotation.phoneNumber]
        .join(' ')
        .toLowerCase()
        .includes(needle),
    );
  }, [quotations, query]);

  const openQuotation = async (id: number) => {
    setLoading(true);
    try {
      const quotation = await getQuotationById(id);
      setSelected(quotation);
      setSelectedId(quotation ? id : null);
    } catch {
      setError('Could not open this quotation. Please retry.');
    } finally {
      setLoading(false);
    }
  };

  const subtotal = selected?.items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0,
  ) ?? 0;

  return (
    <View style={styles.container}>
      <View style={styles.headingRow}>
        <View>
          <Text style={[styles.title, { color: colors.heading }]}>
            {selected ? 'Quotation Details' : 'Quotation History'}
          </Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>
            {selected ? selected.quotationNumber : 'Saved quotations'}
          </Text>
        </View>
        {selected ? (
          <Pressable onPress={() => setSelected(null)} style={styles.refreshButton}>
            <Text style={styles.refreshText}>‹</Text>
          </Pressable>
        ) : (
          <Pressable accessibilityRole="button" onPress={refresh} style={styles.refreshButton}>
            <Text style={styles.refreshText}>↻</Text>
          </Pressable>
        )}
      </View>

      {selected ? (
        <View style={[styles.detailCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.customer, { color: colors.text }]}>{selected.customerName || 'Customer not provided'}</Text>
          {!!selected.phoneNumber && <Text style={[styles.meta, { color: colors.muted }]}>{selected.phoneNumber}</Text>}
          {!!selected.address && <Text style={[styles.meta, { color: colors.muted }]}>{selected.address}</Text>}
          <Text style={[styles.meta, { color: colors.muted }]}>Date: {selected.date}</Text>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          {selected.items.map((item, index) => (
            <View key={`${item.productId}-${index}`} style={[styles.itemRow, { borderBottomColor: colors.border }]}>
              <View style={styles.itemDescription}>
                <Text style={[styles.itemTitle, { color: colors.text }]}>
                  {index + 1}. {item.description && item.description !== item.model ? `${item.description} (${item.model})` : item.model}
                </Text>
                <Text style={[styles.meta, { color: colors.muted }]}>{item.quantity} × {money(item.unitPrice)}</Text>
              </View>
              <Text style={[styles.amount, { color: colors.heading }]}>{money(item.quantity * item.unitPrice)}</Text>
            </View>
          ))}
          <View style={styles.totalRow}><Text style={[styles.meta, { color: colors.muted }]}>Subtotal</Text><Text style={[styles.amount, { color: colors.heading }]}>{money(subtotal)}</Text></View>
          {selected.discount > 0 && <View style={styles.totalRow}><Text style={[styles.meta, { color: colors.muted }]}>Discount</Text><Text style={[styles.amount, { color: colors.heading }]}>- {money(selected.discount)}</Text></View>}
          <View style={styles.totalRow}><Text style={styles.totalLabel}>Quotation Total</Text><Text style={styles.totalAmount}>{money(Math.max(0, subtotal - selected.discount))}</Text></View>
          <Pressable
            accessibilityRole="button"
            disabled={selectedId === null}
            onPress={() => selectedId !== null && onUpdateQuotation(selectedId)}
            style={styles.updateButton}
          >
            <Text style={styles.updateButtonText}>Update Quotation</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search quotation, customer or mobile"
            placeholderTextColor={colors.muted}
            style={[styles.search, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }]}
          />
          {loading ? (
            <ActivityIndicator color="#E51D2A" style={styles.loader} />
          ) : error ? (
            <Pressable onPress={refresh} style={styles.emptyState}>
              <Text style={[styles.emptyTitle, { color: colors.heading }]}>{error}</Text>
              <Text style={[styles.emptyHint, { color: colors.muted }]}>Tap to retry</Text>
            </Pressable>
          ) : filtered.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyTitle, { color: colors.heading }]}>{quotations.length ? 'No matching quotations' : 'No quotations yet'}</Text>
              <Text style={[styles.emptyHint, { color: colors.muted }]}>{quotations.length ? 'Try another quotation number, customer or mobile.' : 'Saved quotations will appear here.'}</Text>
            </View>
          ) : (
            <View style={styles.list}>
              {filtered.map(quotation => (
                <Pressable
                  key={quotation.id}
                  accessibilityRole="button"
                  accessibilityLabel={`View quotation ${quotation.quotationNumber}`}
                  onPress={() => openQuotation(quotation.id)}
                  style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <View style={styles.cardTop}>
                    <View style={styles.itemDescription}>
                      <Text style={[styles.quotationNumber, { color: colors.heading }]}>{quotation.quotationNumber}</Text>
                      <Text style={[styles.customer, { color: colors.text }]}>{quotation.customerName || 'Customer not provided'}</Text>
                    </View>
                    <Text style={styles.amount}>{money(quotation.total)}</Text>
                  </View>
                  <Text style={[styles.meta, { color: colors.muted }]}>{quotation.date}{quotation.phoneNumber ? `  ·  ${quotation.phoneNumber}` : ''}</Text>
                  <Text style={[styles.meta, { color: colors.muted, marginTop: 7 }]}>{quotation.itemCount} {quotation.itemCount === 1 ? 'item' : 'items'} · Tap to view</Text>
                </Pressable>
              ))}
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: 18, paddingBottom: 130 },
  headingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 24, fontWeight: '800' },
  subtitle: { fontSize: 13, marginTop: 3 },
  refreshButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FDEBED' },
  refreshText: { color: '#D91825', fontSize: 26, lineHeight: 30 },
  search: { minHeight: 46, borderWidth: 1, borderRadius: 12, paddingHorizontal: 13, fontSize: 14, marginBottom: 14 },
  loader: { marginTop: 42 },
  emptyState: { alignItems: 'center', paddingHorizontal: 20, paddingVertical: 42 },
  emptyTitle: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  emptyHint: { fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 6 },
  list: { gap: 11 },
  card: { borderWidth: 1, borderRadius: 15, padding: 14 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  itemDescription: { flex: 1 },
  quotationNumber: { fontSize: 14, fontWeight: '800' },
  customer: { fontSize: 13, fontWeight: '600', marginTop: 5 },
  meta: { fontSize: 11, lineHeight: 16, marginTop: 4 },
  amount: { color: '#D91825', fontSize: 12, fontWeight: '800' },
  detailCard: { borderWidth: 1, borderRadius: 15, padding: 14 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 11 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10 },
  totalLabel: { color: '#D91825', fontSize: 14, fontWeight: '800' },
  totalAmount: { color: '#D91825', fontSize: 15, fontWeight: '900' },
  updateButton: { minHeight: 48, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E51D2A', marginTop: 16 },
  updateButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
});
