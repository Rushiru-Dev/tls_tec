import { useCallback, useEffect, useMemo, useState } from 'react';
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
import {
  deleteProduct,
  getProductViewMode,
  listCategories,
  listProducts,
  setProductViewMode,
  updateProduct,
  type ProductViewMode,
  type ProductCategory,
  type SavedProduct,
} from '../database/repositories/productRepository';

type Props = { darkMode: boolean; onAddProduct: () => void };

export default function ViewProductsScreen({ darkMode, onAddProduct }: Props) {
  const [products, setProducts] = useState<SavedProduct[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(
    null,
  );
  const [viewMode, setViewMode] = useState<ProductViewMode>('card');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<SavedProduct | null>(null);
  const [model, setModel] = useState('');
  const [description, setDescription] = useState('');
  const [unitPrice, setUnitPrice] = useState('');

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

  const refreshProducts = useCallback(async () => {
    setProducts(await listProducts());
  }, []);

  useEffect(() => {
    let mounted = true;
    Promise.all([listProducts(), listCategories(), getProductViewMode()])
      .then(([savedProducts, savedCategories, savedMode]) => {
        if (!mounted) return;
        setProducts(savedProducts);
        setCategories(savedCategories);
        setViewMode(savedMode);
      })
      .catch(() => Alert.alert('Database error', 'Could not load products.'))
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const visibleProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return products.filter(product => {
      const matchesCategory =
        selectedCategoryId === null ||
        product.categoryId === selectedCategoryId;
      const matchesSearch =
        !query ||
        [product.model, product.description, product.category].some(value =>
          value.toLowerCase().includes(query),
        );
      return matchesCategory && matchesSearch;
    });
  }, [products, search, selectedCategoryId]);

  const chooseView = async (mode: ProductViewMode) => {
    setViewMode(mode);
    try {
      await setProductViewMode(mode);
    } catch {
      Alert.alert('Database error', 'Could not save your preferred view.');
    }
  };

  const startEditing = (product: SavedProduct) => {
    setEditing(product);
    setModel(product.model);
    setDescription(product.description);
    setUnitPrice(String(product.unitPrice));
  };

  const saveChanges = async () => {
    if (!editing) return;
    const price = Number(unitPrice);
    if (!model.trim() || !description.trim() || !unitPrice.trim()) {
      Alert.alert('Update Product', 'Please complete all fields.');
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      Alert.alert('Unit Price', 'Enter a valid price for one item.');
      return;
    }
    try {
      await updateProduct(editing.id, { model, description, unitPrice: price });
      await refreshProducts();
      setEditing(null);
    } catch {
      Alert.alert('Database error', 'Could not update this product.');
    }
  };

  const confirmDelete = (product: SavedProduct) => {
    Alert.alert(
      'Delete Product',
      `Delete ${product.model} from ${product.category}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteProduct(product.id);
              await refreshProducts();
            } catch {
              Alert.alert('Database error', 'Could not delete this product.');
            }
          },
        },
      ],
    );
  };

  const formatPrice = (price: number) =>
    `LKR ${price.toLocaleString('en-LK', { minimumFractionDigits: 2 })}`;
  const formatWarranty = (warranty: string) =>
    warranty === 'No Warranty' ? 'No warranty' : warranty;

  const textInputStyle = [
    styles.input,
    {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      color: colors.text,
    },
  ];

  const renderActions = (product: SavedProduct) => (
    <View style={styles.rowActions}>
      <Pressable
        accessibilityRole="button"
        onPress={() => startEditing(product)}
        style={({ pressed }) => [
          styles.smallButton,
          styles.updateButton,
          pressed && styles.pressed,
        ]}
      >
        <Text style={styles.updateText}>Update</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={() => confirmDelete(product)}
        style={({ pressed }) => [
          styles.smallButton,
          styles.deleteButton,
          pressed && styles.pressed,
        ]}
      >
        <Text style={styles.deleteText}>Delete</Text>
      </Pressable>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.topActions}>
        <Text style={[styles.title, { color: colors.heading }]}>Products</Text>
        <Pressable
          accessibilityRole="button"
          onPress={onAddProduct}
          style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
        >
          <Text style={styles.addButtonText}>+ Add New Product</Text>
        </Pressable>
      </View>

      <View style={styles.toolbar}>
        <View
          style={[
            styles.viewSelector,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          {(['card', 'table'] as const).map(mode => {
            const active = viewMode === mode;
            return (
              <Pressable
                key={mode}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => chooseView(mode)}
                style={[styles.viewOption, active && styles.viewOptionActive]}
              >
                <Text
                  style={[
                    styles.viewOptionText,
                    { color: active ? '#FFFFFF' : colors.muted },
                  ]}
                >
                  {mode === 'card' ? 'Cards' : 'Table'}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={[styles.productCount, { color: colors.muted }]}>
          {products.length} {products.length === 1 ? 'product' : 'products'}
        </Text>
      </View>

      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search name, category or description"
        placeholderTextColor={colors.placeholder}
        style={[...textInputStyle, styles.searchInput]}
        returnKeyType="search"
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoryFilters}
        contentContainerStyle={styles.categoryFilterContent}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: selectedCategoryId === null }}
          onPress={() => setSelectedCategoryId(null)}
          style={[
            styles.categoryFilter,
            { backgroundColor: colors.surface, borderColor: colors.border },
            selectedCategoryId === null && styles.categoryFilterActive,
          ]}
        >
          <Text
            style={[
              styles.categoryFilterText,
              { color: selectedCategoryId === null ? '#FFFFFF' : colors.text },
            ]}
          >
            All Categories
          </Text>
        </Pressable>
        {categories.map(category => {
          const active = selectedCategoryId === category.id;
          return (
            <Pressable
              key={category.id}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => setSelectedCategoryId(category.id)}
              style={[
                styles.categoryFilter,
                { backgroundColor: colors.surface, borderColor: colors.border },
                active && styles.categoryFilterActive,
              ]}
            >
              <Text
                style={[
                  styles.categoryFilterText,
                  { color: active ? '#FFFFFF' : colors.text },
                ]}
              >
                {category.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {loading ? (
        <ActivityIndicator color="#E51D2A" style={styles.loading} />
      ) : visibleProducts.length === 0 ? (
        <View
          style={[
            styles.emptyCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.emptyTitle, { color: colors.heading }]}>
            {products.length === 0 ? 'No products yet' : 'No matching products'}
          </Text>
          <Text style={[styles.emptyText, { color: colors.muted }]}>
            {products.length === 0
              ? 'Add your first product to see it listed here.'
              : 'Try another name or category.'}
          </Text>
        </View>
      ) : viewMode === 'card' ? (
        <View style={styles.productList}>
          {visibleProducts.map(product => (
            <View
              key={product.id}
              style={[
                styles.productCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <View style={styles.productHeading}>
                <View style={styles.productNameBlock}>
                  <Text style={[styles.productName, { color: colors.heading }]}>
                    {product.model}
                  </Text>
                  <Text style={styles.categoryBadge}>{product.category}</Text>
                </View>
                <Text style={styles.price}>
                  {formatPrice(product.unitPrice)}
                </Text>
              </View>
              <Text style={[styles.description, { color: colors.muted }]}>
                {product.description}{`\nWarranty: ${formatWarranty(product.defaultWarranty)}`}
              </Text>
              {renderActions(product)}
            </View>
          ))}
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator>
          <View style={[styles.table, { borderColor: colors.border }]}>
            <View
              style={[
                styles.tableHeader,
                { backgroundColor: darkMode ? '#25262D' : '#F0F1F4' },
              ]}
            >
              <Text
                style={[
                  styles.tableHeaderCell,
                  styles.modelColumn,
                  { color: colors.heading },
                ]}
              >
                Item / Model
              </Text>
              <Text
                style={[
                  styles.tableHeaderCell,
                  styles.categoryColumn,
                  { color: colors.heading },
                ]}
              >
                Category
              </Text>
              <Text
                style={[
                  styles.tableHeaderCell,
                  styles.descriptionColumn,
                  { color: colors.heading },
                ]}
              >
                Description
              </Text>
              <Text
                style={[
                  styles.tableHeaderCell,
                  styles.priceColumn,
                  { color: colors.heading },
                ]}
              >
                Unit Price
              </Text>
              <Text
                style={[
                  styles.tableHeaderCell,
                  styles.actionColumn,
                  { color: colors.heading },
                ]}
              >
                Actions
              </Text>
            </View>
            {visibleProducts.map(product => (
              <View
                key={product.id}
                style={[styles.tableRow, { borderTopColor: colors.border }]}
              >
                <Text
                  style={[
                    styles.tableCell,
                    styles.modelColumn,
                    { color: colors.heading },
                  ]}
                >
                  {product.model}
                </Text>
                <Text
                  style={[
                    styles.tableCell,
                    styles.categoryColumn,
                    { color: colors.muted },
                  ]}
                >
                  {product.category}
                </Text>
                <Text
                  style={[
                    styles.tableCell,
                    styles.descriptionColumn,
                    { color: colors.muted },
                  ]}
                  numberOfLines={2}
                >
                  {product.description}{`\nWarranty: ${formatWarranty(product.defaultWarranty)}`}
                </Text>
                <Text
                  style={[
                    styles.tableCell,
                    styles.priceColumn,
                    { color: colors.heading },
                  ]}
                >
                  {formatPrice(product.unitPrice)}
                </Text>
                <View style={[styles.actionColumn, styles.tableAction]}>
                  {renderActions(product)}
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      )}

      <Modal
        transparent
        visible={editing !== null}
        animationType="fade"
        onRequestClose={() => setEditing(null)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close update product popup"
            style={StyleSheet.absoluteFill}
            onPress={() => setEditing(null)}
          />
          <View
            style={[
              styles.modalCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.heading }]}>
                Update Product
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close update product popup"
                onPress={() => setEditing(null)}
                style={[
                  styles.closeButton,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text style={[styles.closeButtonText, { color: colors.muted }]}>
                  ×
                </Text>
              </Pressable>
            </View>
            <Text style={[styles.label, { color: colors.heading }]}>
              Category (cannot be changed)
            </Text>
            <View
              style={[
                styles.lockedCategory,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text style={{ color: colors.muted }}>{editing?.category}</Text>
            </View>
            <Text style={[styles.label, { color: colors.heading }]}>
              Item / Model
            </Text>
            <TextInput
              value={model}
              onChangeText={setModel}
              placeholder="Item or model"
              placeholderTextColor={colors.placeholder}
              style={textInputStyle}
            />
            <Text style={[styles.label, { color: colors.heading }]}>
              Item Description
            </Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              multiline
              textAlignVertical="top"
              placeholder="Describe the item"
              placeholderTextColor={colors.placeholder}
              style={[...textInputStyle, styles.descriptionInput]}
            />
            <Text style={[styles.label, { color: colors.heading }]}>
              Unit Price
            </Text>
            <TextInput
              value={unitPrice}
              onChangeText={setUnitPrice}
              keyboardType="decimal-pad"
              placeholder="Price for one item"
              placeholderTextColor={colors.placeholder}
              style={textInputStyle}
            />
            <Pressable
              onPress={saveChanges}
              style={({ pressed }) => [
                styles.saveButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.addButtonText}>Save Changes</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 20, paddingBottom: 120 },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 16,
  },
  title: { fontSize: 22, fontWeight: '700' },
  addButton: {
    backgroundColor: '#E51D2A',
    borderRadius: 11,
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  addButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  viewSelector: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 10,
    padding: 3,
  },
  viewOption: {
    minWidth: 64,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 7,
  },
  viewOptionActive: { backgroundColor: '#E51D2A' },
  viewOptionText: { fontSize: 13, fontWeight: '600' },
  productCount: { fontSize: 13 },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 11,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  searchInput: { marginBottom: 10 },
  categoryFilters: { maxHeight: 42, marginBottom: 14, flexGrow: 0 },
  categoryFilterContent: { alignItems: 'center', gap: 8, paddingRight: 4 },
  categoryFilter: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  categoryFilterActive: { backgroundColor: '#E51D2A', borderColor: '#E51D2A' },
  categoryFilterText: { fontSize: 12, fontWeight: '600' },
  loading: { marginTop: 36 },
  emptyCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 22,
    alignItems: 'center',
    marginTop: 4,
  },
  emptyTitle: { fontSize: 17, fontWeight: '700', marginBottom: 7 },
  emptyText: { fontSize: 13, textAlign: 'center', lineHeight: 19 },
  productList: { gap: 11 },
  productCard: { borderWidth: 1, borderRadius: 16, padding: 15 },
  productHeading: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  productNameBlock: { flex: 1, gap: 7 },
  productName: { fontSize: 17, fontWeight: '700' },
  categoryBadge: {
    alignSelf: 'flex-start',
    color: '#D91825',
    backgroundColor: 'rgba(229,29,42,0.1)',
    overflow: 'hidden',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    fontSize: 11,
    fontWeight: '700',
  },
  price: { color: '#D91825', fontSize: 14, fontWeight: '700' },
  description: { fontSize: 13, lineHeight: 19, marginTop: 11 },
  rowActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 14,
  },
  smallButton: { borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  updateButton: { backgroundColor: 'rgba(229,29,42,0.1)' },
  deleteButton: { backgroundColor: 'rgba(120,30,35,0.12)' },
  updateText: { color: '#D91825', fontSize: 12, fontWeight: '700' },
  deleteText: { color: '#C62828', fontSize: 12, fontWeight: '700' },
  pressed: { opacity: 0.78 },
  table: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
    minWidth: 700,
  },
  tableHeader: { flexDirection: 'row', minHeight: 42, alignItems: 'center' },
  tableHeaderCell: { paddingHorizontal: 10, fontSize: 12, fontWeight: '700' },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 62,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tableCell: { paddingHorizontal: 10, paddingVertical: 10, fontSize: 12 },
  modelColumn: { width: 130 },
  categoryColumn: { width: 110 },
  descriptionColumn: { width: 175 },
  priceColumn: { width: 115 },
  actionColumn: { width: 170 },
  tableAction: { paddingHorizontal: 8 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 18,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  modalTitle: { fontSize: 19, fontWeight: '700' },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: { fontSize: 26, lineHeight: 29 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 7, marginTop: 12 },
  lockedCategory: {
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  descriptionInput: { minHeight: 76, paddingTop: 12 },
  saveButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E51D2A',
    borderRadius: 11,
    marginTop: 20,
  },
});
