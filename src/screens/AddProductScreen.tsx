import { useEffect, useState } from 'react';
import {
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
  createCategory,
  createProduct,
  listCategories,
  listProducts,
  type ProductCategory,
  type SavedProduct,
} from '../database/repositories/productRepository';

export default function AddProductScreen({ darkMode }: { darkMode: boolean }) {
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [products, setProducts] = useState<SavedProduct[]>([]);
  const [model, setModel] = useState('');
  const [description, setDescription] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [categoryModal, setCategoryModal] = useState(false);
  const [categoryPicker, setCategoryPicker] = useState(false);
  const [newCategory, setNewCategory] = useState('');

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
    Promise.all([listCategories(), listProducts()])
      .then(([savedCategories, savedProducts]) => {
        if (!mounted) return;
        setCategories(savedCategories);
        setProducts(savedProducts);
      })
      .catch(() =>
        Alert.alert('Database error', 'Could not load categories and items.'),
      );
    return () => {
      mounted = false;
    };
  }, []);

  const saveCategory = async () => {
    const value = newCategory.trim();
    if (!value) {
      Alert.alert('New Category', 'Please enter a category name.');
      return;
    }
    if (
      categories.some(item => item.name.toLowerCase() === value.toLowerCase())
    ) {
      Alert.alert('New Category', 'This category already exists.');
      return;
    }
    try {
      const created = await createCategory(value);
      setCategories(current => [...current, created]);
      setCategoryId(created.id);
      setNewCategory('');
      setCategoryModal(false);
    } catch {
      Alert.alert('Database error', 'Could not save this category.');
    }
  };

  const saveProduct = async () => {
    const price = Number(unitPrice);
    if (
      categoryId === null ||
      !model.trim() ||
      !description.trim() ||
      !unitPrice.trim()
    ) {
      Alert.alert('Add New Item', 'Please complete all fields.');
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      Alert.alert('Unit Price', 'Enter a valid price for one item.');
      return;
    }
    try {
      await createProduct({
        categoryId,
        model,
        description,
        unitPrice: price,
      });
      setProducts(await listProducts());
      setModel('');
      setDescription('');
      setUnitPrice('');
      Alert.alert('Product added', `${model.trim()} was added successfully.`);
    } catch {
      Alert.alert('Database error', 'Could not save this item.');
    }
  };

  const fieldStyle = [
    styles.input,
    {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      color: colors.text,
    },
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.titleRow}>
        <Text style={[styles.title, { color: colors.heading }]}>
          Add Product
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => setCategoryModal(true)}
          style={({ pressed }) => [
            styles.categoryButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.categoryButtonText}>+ Add New Category</Text>
        </Pressable>
      </View>

      <View
        style={[
          styles.form,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.label, { color: colors.heading }]}>
          Select Category
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => setCategoryPicker(true)}
          style={[...fieldStyle, styles.selectField]}
        >
          <Text
            style={{
              color: categoryId !== null ? colors.text : colors.placeholder,
            }}
          >
            {categories.find(item => item.id === categoryId)?.name ||
              'Choose a category'}
          </Text>
          <Text style={[styles.chevron, { color: colors.muted }]}>⌄</Text>
        </Pressable>

        <Text style={[styles.label, { color: colors.heading }]}>
          Item / Model
        </Text>
        <TextInput
          value={model}
          onChangeText={setModel}
          placeholder="Enter item or model"
          placeholderTextColor={colors.placeholder}
          style={fieldStyle}
        />

        <Text style={[styles.label, { color: colors.heading }]}>
          Item Description
        </Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Describe the item"
          placeholderTextColor={colors.placeholder}
          multiline
          textAlignVertical="top"
          style={[...fieldStyle, styles.descriptionInput]}
        />

        <Text style={[styles.label, { color: colors.heading }]}>
          Unit Price
        </Text>
        <TextInput
          value={unitPrice}
          onChangeText={setUnitPrice}
          placeholder="Price for 1 item"
          placeholderTextColor={colors.placeholder}
          keyboardType="decimal-pad"
          style={fieldStyle}
        />
        <Text style={[styles.helper, { color: colors.muted }]}>
          Enter the price for one item (quantity 1).
        </Text>

        <Pressable
          accessibilityRole="button"
          onPress={saveProduct}
          style={({ pressed }) => [
            styles.submitButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.submitText}>Add New Item</Text>
        </Pressable>
      </View>

      {products.length > 0 && (
        <Text style={[styles.savedCount, { color: colors.muted }]}>
          {products.length} {products.length === 1 ? 'item' : 'items'} saved
        </Text>
      )}

      <Modal
        transparent
        visible={categoryModal}
        animationType="fade"
        onRequestClose={() => setCategoryModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close new category popup"
            style={StyleSheet.absoluteFill}
            onPress={() => setCategoryModal(false)}
          />
          <View
            style={[
              styles.modalCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.heading }]}>
                New Category
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close new category popup"
                onPress={() => {
                  setCategoryModal(false);
                  setNewCategory('');
                }}
                style={({ pressed }) => [
                  styles.closeButton,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                  },
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.closeButtonText, { color: colors.muted }]}>
                  ×
                </Text>
              </Pressable>
            </View>
            <TextInput
              autoFocus
              value={newCategory}
              onChangeText={setNewCategory}
              placeholder="Category name"
              placeholderTextColor={colors.placeholder}
              style={fieldStyle}
              returnKeyType="done"
              onSubmitEditing={saveCategory}
            />
            <Pressable
              onPress={saveCategory}
              style={({ pressed }) => [
                styles.submitButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.submitText}>Add Category</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        transparent
        visible={categoryPicker}
        animationType="fade"
        onRequestClose={() => setCategoryPicker(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close category list"
            style={StyleSheet.absoluteFill}
            onPress={() => setCategoryPicker(false)}
          />
          <View
            style={[
              styles.modalCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.heading }]}>
                Select Category
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close category list"
                onPress={() => setCategoryPicker(false)}
                style={({ pressed }) => [
                  styles.closeButton,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                  },
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.closeButtonText, { color: colors.muted }]}>
                  ×
                </Text>
              </Pressable>
            </View>
            {categories.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.muted }]}>
                Add a category first.
              </Text>
            ) : (
              categories.map(item => (
                <Pressable
                  key={item.id}
                  onPress={() => {
                    setCategoryId(item.id);
                    setCategoryPicker(false);
                  }}
                  style={[
                    styles.categoryOption,
                    { borderBottomColor: colors.border },
                  ]}
                >
                  <Text style={{ color: colors.text }}>{item.name}</Text>
                </Pressable>
              ))
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingTop: 20, paddingBottom: 124 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 18,
  },
  title: { fontSize: 22, fontWeight: '700' },
  categoryButton: {
    backgroundColor: '#E51D2A',
    borderRadius: 11,
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  categoryButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  form: { borderWidth: 1, borderRadius: 18, padding: 16 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8, marginTop: 14 },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 11,
    paddingHorizontal: 13,
    fontSize: 15,
  },
  selectField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
  },
  chevron: { fontSize: 21 },
  descriptionInput: { minHeight: 88, paddingTop: 13 },
  helper: { marginTop: 7, fontSize: 12 },
  submitButton: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E51D2A',
    borderRadius: 12,
    marginTop: 22,
  },
  submitText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  savedCount: { textAlign: 'center', marginTop: 14, fontSize: 13 },
  pressed: { opacity: 0.8 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 18,
    maxHeight: '75%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
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
  closeButtonText: { fontSize: 26, lineHeight: 29, fontWeight: '400' },
  emptyText: { fontSize: 14, paddingVertical: 8 },
  categoryOption: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
