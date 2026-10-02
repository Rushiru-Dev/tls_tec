import { useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentRef, ComponentType } from 'react';
import { BlurView } from '@react-native-community/blur';
import type { SvgProps } from 'react-native-svg';
import {
  Alert,
  Image,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AddIcon from '../img/icons/add.svg';
import InvoiceIcon from '../img/icons/invoice.svg';
import LightIcon from '../img/icons/light.svg';
import HomeIcon from '../img/icons/home.svg';
import ProductIcon from '../img/icons/products-outlined.svg';
import AddProductIcon from '../img/icons/products-gifts-bold.svg';
import SettingsIcon from '../img/icons/setting-4-svgrepo-com.svg';
import QuotationIcon from '../img/icons/quotation-mark-16-solid.svg';
import AddProductScreen from './AddProductScreen';
import ViewProductsScreen from './ViewProductsScreen';
import { listProducts } from '../database/repositories/productRepository';
import { listInvoices } from '../services/invoiceService';
import NewInvoiceScreen from './NewInvoiceScreen';
import InvoicesScreen from './InvoicesScreen';
import NewQuotationScreen from './NewQuotationScreen';
import QuotationsScreen from './QuotationsScreen';
import SettingsScreen from './SettingsScreen';

type IconComponent = ComponentType<SvgProps>;

const actions = [
  { title: 'New Invoice', icon: InvoiceIcon, style: 'primary' as const },
  { title: 'New Quotation', icon: QuotationIcon, style: 'secondary' as const },
  { title: 'Add Product', icon: AddProductIcon, style: 'secondary' as const },
];

const homeHeroSlides = [
  {
    image: require('../img/home_hero_1.jpg'),
    eyebrow: 'TLS TEC  •  CCTV SOLUTIONS',
    title: 'Security, installed with care.',
    subtitle: 'Professional protection for your home.',
  },
  {
    image: require('../img/home_hero_2.jpg'),
    eyebrow: 'HOME & BUSINESS SECURITY',
    title: 'Safer spaces start here.',
    subtitle: 'Reliable systems for every space.',
  },
  {
    image: require('../img/home_hero_3.jpg'),
    eyebrow: 'SMART MONITORING',
    title: 'Keep every view in sight.',
    subtitle: 'Clear monitoring, day after day.',
  },
  {
    image: require('../img/home_hero_4.jpg'),
    eyebrow: 'PROTECTION  •  DAY & NIGHT',
    title: 'Confidence around the clock.',
    subtitle: 'Security you can count on.',
  },
];

function formatToday(date: Date) {
  return {
    weekday: date.toLocaleDateString('en-US', { weekday: 'long' }),
    date: date.toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }),
  };
}

type HomeScreenProps = {
  darkMode: boolean;
  onToggleDarkMode: () => void;
};

export default function HomeScreen({
  darkMode,
  onToggleDarkMode,
}: HomeScreenProps) {
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const [activeTab, setActiveTab] = useState('Home');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null);
  const [selectedQuotationId, setSelectedQuotationId] = useState<number | null>(null);
  const [productCount, setProductCount] = useState(0);
  const [invoiceCount, setInvoiceCount] = useState(0);
  const [pendingPaymentCount, setPendingPaymentCount] = useState(0);
  const [heroIndex, setHeroIndex] = useState(0);
  const heroScrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const heroWidth = width - 44;
  const today = useMemo(() => formatToday(new Date()), []);

  useEffect(() => {
    let active = true;
    if (activeTab === 'Home') {
      Promise.all([listProducts(), listInvoices()])
        .then(([products, invoices]) => {
          if (!active) return;
          setProductCount(products.length);
          setInvoiceCount(invoices.length);
          setPendingPaymentCount(
            invoices.filter(invoice => invoice.balance > 0).length,
          );
        })
        .catch(() => {
          if (!active) return;
          setProductCount(0);
          setInvoiceCount(0);
          setPendingPaymentCount(0);
        });
    }
    return () => {
      active = false;
    };
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'Home') return;
    const timer = setInterval(() => {
      const nextIndex = (heroIndex + 1) % homeHeroSlides.length;
      heroScrollRef.current?.scrollTo({ x: nextIndex * heroWidth, animated: true });
    }, 30_000);
    return () => clearInterval(timer);
  }, [activeTab, heroIndex, heroWidth]);
  const colors = darkMode
    ? {
        background: '#111216',
        surface: '#1C1D23',
        border: '#2B2D35',
        heading: '#F4F4F6',
        text: '#E7E7EA',
        muted: '#A0A2AA',
        symbol: '#342126',
      }
    : {
        background: '#F6F7F9',
        surface: '#FFFFFF',
        border: '#E7E8EB',
        heading: '#18191E',
        text: '#24252B',
        muted: '#7B7E87',
        symbol: '#FDEBED',
      };

  const showComingSoon = (feature: string) =>
    Alert.alert(feature, 'This feature is coming soon.');
  const openFeature = (feature: string) => {
    if (feature === 'New Invoice') {
      setSelectedInvoiceId(null);
      setActiveTab('New Invoice');
      return;
    }
    if (feature === 'Add Product') {
      setActiveTab('Add Product');
      return;
    }
    if (feature === 'New Quotation') {
      setActiveTab('New Quotation');
      return;
    }
    if (feature === 'Quotation History') {
      setActiveTab('Quotation History');
      return;
    }
    showComingSoon(feature);
  };

  const statsContent = (
    <>
      {darkMode && (
        <View pointerEvents="none" style={styles.statsPanelOverlay} />
      )}
      <View style={styles.statsHeader}>
        <Text
          style={[
            styles.sectionTitle,
            darkMode ? styles.statsTitleDark : styles.statsTitleLight,
          ]}
        >
          Quick Stats
        </Text>
      </View>
      <View style={styles.statsRow}>
        <StatCard label="Invoices" value={String(invoiceCount)} darkMode={darkMode} />
        <StatCard
          label="Pending Payments"
          value={String(pendingPaymentCount)}
          darkMode={darkMode}
        />
        <StatCard
          label="Products"
          value={String(productCount)}
          darkMode={darkMode}
        />
      </View>
    </>
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          {
            minHeight: Math.max(0, height - insets.top - insets.bottom),
            paddingTop: insets.top + 12,
            paddingBottom: insets.bottom + 108,
          },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          {activeTab === 'Add Product' ||
          activeTab === 'Products' ||
          activeTab === 'New Invoice' ||
          activeTab === 'Edit Invoice' ||
          activeTab === 'Edit Quotation' ||
          activeTab === 'New Quotation' ||
          activeTab === 'Quotation History' ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                activeTab === 'Edit Invoice'
                  ? 'Back to Invoices'
                  : activeTab === 'Edit Quotation'
                    ? 'Back to Quotation History'
                    : 'Back to Home'
              }
              onPress={() => {
                if (activeTab === 'Edit Invoice') setActiveTab('Invoices');
                else if (activeTab === 'Edit Quotation') setActiveTab('Quotation History');
                else setActiveTab('Home');
              }}
              style={({ pressed }) => [
                styles.backButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.backArrow, { color: colors.heading }]}>
                ‹
              </Text>
            </Pressable>
          ) : (
            <Image
              source={
                darkMode
                  ? require('../img/logo.png')
                  : require('../img/log1.png')
              }
              style={styles.logo}
              resizeMode="contain"
              accessibilityLabel="TLS Tec logo"
            />
          )}
          <View style={styles.headerRight}>
            <View style={styles.dateBlock}>
              <Text style={[styles.weekday, { color: colors.heading }]}>
                {today.weekday}
              </Text>
              <Text style={[styles.date, { color: colors.muted }]}>
                {today.date}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Switch to ${
                darkMode ? 'light' : 'dark'
              } mode`}
              onPress={onToggleDarkMode}
              style={({ pressed }) => [
                styles.modeButton,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
                pressed && styles.pressed,
              ]}
            >
              {darkMode ? (
                <LightIcon width={20} height={20} color="#E51D2A" />
              ) : (
                <Text style={styles.themeToggleIcon}>☾</Text>
              )}
            </Pressable>
          </View>
        </View>

        {activeTab === 'Home' ? (
          <>
            <View style={styles.welcome}>
              <Text style={[styles.welcomeTitle, { color: colors.heading }]}>
                Welcome, Tharindu 👋
              </Text>
            </View>

            <View style={styles.main}>
              <View style={styles.heroSection}>
                <ScrollView
                  ref={heroScrollRef}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  style={{ width: heroWidth }}
                  scrollEventThrottle={16}
                  onScroll={event => {
                    const index = Math.round(
                      event.nativeEvent.contentOffset.x / heroWidth,
                    );
                    setHeroIndex(Math.max(0, Math.min(index, homeHeroSlides.length - 1)));
                  }}
                  onMomentumScrollEnd={event => {
                    const index = Math.round(
                      event.nativeEvent.contentOffset.x / heroWidth,
                    );
                    setHeroIndex(Math.max(0, Math.min(index, homeHeroSlides.length - 1)));
                  }}
                >
                  {homeHeroSlides.map(slide => (
                    <ImageBackground
                      key={slide.eyebrow}
                      source={slide.image}
                      style={[styles.heroCard, { width: heroWidth }]}
                      imageStyle={styles.heroImage}
                      resizeMode="cover"
                    >
                      <View pointerEvents="none" style={styles.heroShade} />
                      <View style={styles.heroCopy}>
                        <Text style={styles.heroEyebrow}>{slide.eyebrow}</Text>
                        <Text style={styles.heroTitle}>{slide.title}</Text>
                        <Text style={styles.heroSubtitle}>{slide.subtitle}</Text>
                      </View>
                    </ImageBackground>
                  ))}
                </ScrollView>
                <View style={styles.heroDots} accessibilityLabel={`Slide ${heroIndex + 1} of ${homeHeroSlides.length}`}>
                  {homeHeroSlides.map((slide, index) => (
                    <View
                      key={slide.eyebrow}
                      style={[
                        styles.heroDot,
                        index === heroIndex && styles.heroDotActive,
                      ]}
                    />
                  ))}
                </View>
              </View>

              <Text
                style={[
                  styles.sectionTitle,
                  styles.actionsTitle,
                  { color: colors.heading },
                ]}
              >
                Main Actions
              </Text>
              <View style={styles.actions}>
                {actions.map(action => {
                  const actionButton = (
                  <Pressable
                    key={action.title}
                    accessibilityRole="button"
                    onPress={() => openFeature(action.title)}
                    style={({ pressed }) => [
                      styles.actionButton,
                      {
                        backgroundColor: 'transparent',
                        flex: action.title === 'New Quotation' ? 1 : undefined,
                        borderColor:
                          action.style === 'primary'
                            ? 'rgba(229,29,42,0.72)'
                            : colors.border,
                      },
                      pressed && styles.pressed,
                    ]}
                  >
                    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                      <BlurView
                        style={StyleSheet.absoluteFill}
                        blurType={darkMode ? 'dark' : 'light'}
                        blurAmount={18}
                        reducedTransparencyFallbackColor={
                          darkMode ? '#202127' : '#FFFFFF'
                        }
                      />
                      <View
                        style={[
                          StyleSheet.absoluteFill,
                          {
                            backgroundColor:
                              action.style === 'primary'
                                ? 'rgba(229,29,42,0.76)'
                                : darkMode
                                ? 'rgba(28,29,35,0.58)'
                                : 'rgba(255,255,255,0.68)',
                          },
                        ]}
                      />
                    </View>
                    <View
                      style={[
                        styles.actionSymbol,
                        { backgroundColor: colors.symbol },
                        action.style === 'primary' && styles.primarySymbol,
                      ]}
                    >
                      <action.icon
                        width={22}
                        height={22}
                        color={
                          action.style === 'primary' ? '#FFFFFF' : '#D91825'
                        }
                      />
                    </View>
                    <Text
                      style={[
                        styles.actionTitle,
                        { color: colors.text },
                        action.style === 'primary' && styles.primaryTitle,
                      ]}
                    >
                      {action.title}
                    </Text>
                    <Text
                      style={[
                        styles.actionArrow,
                        { color: colors.muted },
                        action.style === 'primary' && styles.primaryTitle,
                      ]}
                    >
                      ›
                    </Text>
                  </Pressable>
                  );
                  return action.title === 'New Quotation' ? (
                    <View key="quotation-actions" style={styles.quotationActionRow}>
                      {actionButton}
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Open quotation history"
                        onPress={() => openFeature('Quotation History')}
                        style={({ pressed }) => [
                          styles.quotationHistoryButton,
                          {
                            backgroundColor: darkMode ? '#2C1B1E' : '#FDEBED',
                            borderColor: darkMode ? '#643039' : '#F4C7CC',
                          },
                          pressed && styles.pressed,
                        ]}
                      >
                        <Text style={[styles.quotationHistoryText, { color: darkMode ? '#FF7D86' : '#C91625' }]}>History</Text>
                      </Pressable>
                    </View>
                  ) : actionButton;
                })}
              </View>

              {darkMode ? (
                <ImageBackground
                  source={require('../img/quick_stats_bg.png')}
                  style={styles.statsPanel}
                  imageStyle={styles.statsPanelImage}
                  resizeMode="cover"
                >
                  {statsContent}
                </ImageBackground>
              ) : (
                <View style={[styles.statsPanel, styles.statsPanelLight]}>
                  {statsContent}
                </View>
              )}
            </View>
          </>
        ) : activeTab === 'Add Product' ? (
          <AddProductScreen darkMode={darkMode} />
        ) : activeTab === 'New Invoice' || activeTab === 'Edit Invoice' ? (
          <NewInvoiceScreen
            darkMode={darkMode}
            invoiceId={selectedInvoiceId ?? undefined}
            onInvoiceComplete={() => setActiveTab('Invoices')}
          />
        ) : activeTab === 'New Quotation' ? (
          <NewQuotationScreen darkMode={darkMode} />
        ) : activeTab === 'Edit Quotation' ? (
          <NewQuotationScreen
            darkMode={darkMode}
            quotationId={selectedQuotationId ?? undefined}
            onQuotationComplete={() => setActiveTab('Quotation History')}
          />
        ) : activeTab === 'Quotation History' ? (
          <QuotationsScreen
            darkMode={darkMode}
            onUpdateQuotation={quotationId => {
              setSelectedQuotationId(quotationId);
              setActiveTab('Edit Quotation');
            }}
          />
        ) : activeTab === 'Settings' ? (
          <SettingsScreen darkMode={darkMode} />
        ) : activeTab === 'Invoices' ? (
          <InvoicesScreen
            darkMode={darkMode}
            onSelectInvoice={invoiceId => {
              setSelectedInvoiceId(invoiceId);
              setActiveTab('Edit Invoice');
            }}
          />
        ) : activeTab === 'Products' ? (
          <ViewProductsScreen
            darkMode={darkMode}
            onAddProduct={() => setActiveTab('Add Product')}
          />
        ) : (
          <View style={styles.placeholder}>
            <Text style={[styles.placeholderTitle, { color: colors.heading }]}>
              {activeTab}
            </Text>
            <Text style={[styles.placeholderText, { color: colors.muted }]}>
              {activeTab === 'New Invoice'
                ? 'The invoice form is coming soon.'
                : 'This section is coming soon.'}
            </Text>
          </View>
        )}
      </ScrollView>

      <BottomNavigation
        activeTab={activeTab === 'Edit Invoice' ? 'Invoices' : activeTab}
        darkMode={darkMode}
        bottomInset={insets.bottom}
        onSelectTab={setActiveTab}
        onNewInvoice={() => {
          setSelectedInvoiceId(null);
          setActiveTab('New Invoice');
        }}
      />
    </View>
  );
}

function BottomNavigation({
  activeTab,
  darkMode,
  bottomInset,
  onSelectTab,
  onNewInvoice,
}: {
  activeTab: string;
  darkMode: boolean;
  bottomInset: number;
  onSelectTab: (tab: string) => void;
  onNewInvoice: () => void;
}) {
  const tabs = [
    { label: 'Home', icon: HomeIcon },
    { label: 'Invoices', icon: InvoiceIcon },
    { label: 'Products', icon: ProductIcon },
    { label: 'Settings', icon: SettingsIcon },
  ];

  return (
    <View style={[styles.navPosition, { bottom: Math.max(bottomInset, 10) }]}>
      <View
        style={[
          styles.navShell,
          {
            backgroundColor: darkMode
              ? 'rgba(22,23,28,0.48)'
              : 'rgba(255,255,255,0.44)',
            borderColor: darkMode
              ? 'rgba(255,255,255,0.14)'
              : 'rgba(255,255,255,0.72)',
          },
        ]}
      >
        <BlurView
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
          blurType={darkMode ? 'dark' : 'light'}
          blurAmount={18}
          reducedTransparencyFallbackColor={darkMode ? '#202127' : '#FFFFFF'}
        />
        <View style={styles.navItems}>
          {tabs.slice(0, 2).map(tab => (
            <NavItem
              key={tab.label}
              tab={tab}
              active={activeTab === tab.label}
              darkMode={darkMode}
              onPress={() => onSelectTab(tab.label)}
            />
          ))}
          <View style={styles.navCenterSpace} />
          {tabs.slice(2).map(tab => (
            <NavItem
              key={tab.label}
              tab={tab}
              active={activeTab === tab.label}
              darkMode={darkMode}
              onPress={() => onSelectTab(tab.label)}
            />
          ))}
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Create a new invoice"
        onPress={onNewInvoice}
        style={({ pressed }) => [
          styles.newInvoiceButton,
          { borderColor: darkMode ? '#111216' : '#F6F7F9' },
          pressed && styles.pressed,
        ]}
      >
        <AddIcon width={26} height={26} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}

function NavItem({
  tab,
  active,
  darkMode,
  onPress,
}: {
  tab: { label: string; icon: IconComponent };
  active: boolean;
  darkMode: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [styles.navItem, pressed && styles.pressed]}
    >
      <tab.icon
        width={22}
        height={22}
        color={active ? '#E51D2A' : darkMode ? '#B9BAC1' : '#777A83'}
      />
      <Text
        style={[
          styles.navLabel,
          { color: active ? '#E51D2A' : darkMode ? '#B9BAC1' : '#777A83' },
        ]}
      >
        {tab.label}
      </Text>
    </Pressable>
  );
}

function StatCard({
  label,
  value,
  darkMode,
}: {
  label: string;
  value: string;
  darkMode: boolean;
}) {
  return (
    <View
      style={[
        styles.statCard,
        {
          backgroundColor: darkMode
            ? 'rgba(14,16,22,0.58)'
            : 'rgba(255,255,255,0.78)',
          borderColor: darkMode
            ? 'rgba(255,255,255,0.2)'
            : 'rgba(255,255,255,0.68)',
        },
      ]}
    >
      <Text
        style={[styles.statValue, { color: darkMode ? '#F4F4F6' : '#1D1E24' }]}
      >
        {value}
      </Text>
      <Text
        numberOfLines={1}
        style={[styles.statLabel, { color: darkMode ? '#A0A2AA' : '#7B7E87' }]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F6F7F9',
  },
  content: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    paddingHorizontal: 22,
  },
  header: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E7E8EB',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  backArrow: {
    fontSize: 42,
    lineHeight: 46,
    fontWeight: '300',
  },
  logo: {
    width: 76,
    height: 66,
  },
  dateBlock: {
    alignItems: 'flex-end',
  },
  modeButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 21,
  },
  weekday: {
    color: '#202127',
    fontSize: 14,
    fontWeight: '700',
  },
  date: {
    marginTop: 3,
    color: '#747780',
    fontSize: 12,
  },
  welcome: {
    marginTop: 22,
  },
  welcomeTitle: {
    fontSize: 22,
    fontWeight: '700',
  },
  main: {
    width: '100%',
    paddingTop: 30,
    paddingBottom: 24,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 8,
  },
  heroCard: {
    height: 218,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    borderRadius: 19,
    backgroundColor: '#25272D',
  },
  heroImage: {
    borderRadius: 19,
  },
  heroShade: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(7,9,14,0.38)',
  },
  heroCopy: {
    paddingHorizontal: 18,
    paddingBottom: 17,
    paddingTop: 26,
  },
  heroEyebrow: {
    color: '#FFB8BE',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.1,
    marginBottom: 7,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '800',
    maxWidth: '78%',
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.86)',
    fontSize: 11,
    marginTop: 5,
  },
  heroDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  heroDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#C7C9CF',
  },
  heroDotActive: {
    width: 18,
    backgroundColor: '#E51D2A',
  },
  sectionTitle: {
    color: '#18191E',
    fontSize: 18,
    fontWeight: '700',
  },
  actionsTitle: {
    marginTop: 10,
  },
  actions: {
    gap: 11,
    marginTop: 14,
    marginBottom: 26,
  },
  quotationActionRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
  },
  quotationHistoryButton: {
    minWidth: 78,
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 15,
    borderWidth: 1,
  },
  quotationHistoryText: {
    fontSize: 14,
    fontWeight: '800',
  },
  actionButton: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    borderRadius: 15,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#EAEBEF',
  },
  pressed: {
    opacity: 0.82,
  },
  actionSymbol: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    backgroundColor: '#FDEBED',
  },
  primarySymbol: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  actionTitle: {
    flex: 1,
    marginLeft: 13,
    color: '#24252B',
    fontSize: 15,
    fontWeight: '600',
  },
  primaryTitle: {
    color: '#FFFFFF',
  },
  actionArrow: {
    marginLeft: 8,
    color: '#9699A2',
    fontSize: 25,
    lineHeight: 28,
  },
  statsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 13,
  },
  statsPanel: {
    position: 'relative',
    overflow: 'hidden',
    marginBottom: 26,
    padding: 16,
    borderRadius: 20,
  },
  statsPanelImage: {
    borderRadius: 20,
  },
  statsPanelLight: {
    backgroundColor: '#EEF0F4',
    borderWidth: 1,
    borderColor: '#E3E5EA',
  },
  statsPanelOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(5,8,15,0.24)',
  },
  statsTitleDark: {
    color: '#FFFFFF',
  },
  statsTitleLight: {
    color: '#18191E',
  },
  themeToggle: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 18,
  },
  themeToggleIcon: {
    color: '#E51D2A',
    fontSize: 20,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    minHeight: 102,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAEBEF',
  },
  statValue: {
    color: '#1D1E24',
    fontSize: 24,
    fontWeight: '700',
  },
  statLabel: {
    marginTop: 5,
    color: '#7B7E87',
    fontSize: 11,
  },
  scroll: {
    flex: 1,
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 280,
  },
  placeholderTitle: {
    fontSize: 24,
    fontWeight: '700',
  },
  placeholderText: {
    marginTop: 8,
    fontSize: 14,
  },
  navPosition: {
    position: 'absolute',
    left: 20,
    right: 20,
    height: 72,
    justifyContent: 'center',
  },
  navShell: {
    width: '100%',
    height: 68,
    overflow: 'hidden',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.32)',
    borderRadius: 36,
    elevation: 10,
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  navItems: {
    height: '100%',
    width: '100%',
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    zIndex: 1,
  },
  navItem: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  navLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  navCenterSpace: {
    width: 62,
  },
  newInvoiceButton: {
    position: 'absolute',
    top: -20,
    alignSelf: 'center',
    width: 62,
    height: 62,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 5,
    borderColor: '#F6F7F9',
    borderRadius: 31,
    backgroundColor: '#E51D2A',
    elevation: 8,
    shadowColor: '#E51D2A',
    shadowOpacity: 0.28,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
});
