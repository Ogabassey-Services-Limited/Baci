import BottomSheet, {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetFooter,
  type BottomSheetFooterProps,
} from '@gorhom/bottom-sheet';
import Ionicons from '@react-native-vector-icons/ionicons';
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
} from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';

const PRODUCT_PICKER_SNAP_POINTS = ['60%', '92%'];
const PRODUCT_PICKER_FOOTER_BOTTOM_INSET = 2;
const noopClose = () => undefined;

interface ProductPickerSheetFooterContextValue {
  bottomInset: number;
  footer: ReactNode;
  onClose: () => void;
}

const ProductPickerSheetFooterContext =
  createContext<ProductPickerSheetFooterContextValue>({
    bottomInset: PRODUCT_PICKER_FOOTER_BOTTOM_INSET,
    footer: null,
    onClose: noopClose,
  });

interface ProductPickerSheetColors {
  background: string;
  border: string;
  card: string;
  primary: string;
  text: string;
  textMuted: string;
}

interface NewOrderProductPickerSheetFrameProps {
  activeIndex?: number;
  children: ReactNode;
  closeLabel: string;
  colors: ProductPickerSheetColors;
  enableContentPanningGesture?: boolean;
  footer?: ReactNode;
  footerBottomInset?: number;
  leadingAccessory?: ReactNode;
  onClose: () => void;
  snapPoints?: string[];
  title: string;
  trailingAccessory?: ReactNode;
  visible: boolean;
}

function ProductPickerSheetFooter(props: BottomSheetFooterProps) {
  const { bottomInset, footer } = useContext(ProductPickerSheetFooterContext);

  if (!footer) {
    return null;
  }

  return (
    <BottomSheetFooter {...props} bottomInset={bottomInset}>
      <View style={styles.footer}>{footer}</View>
    </BottomSheetFooter>
  );
}

function ProductPickerSheetBackdrop(props: BottomSheetBackdropProps) {
  const { onClose } = useContext(ProductPickerSheetFooterContext);

  return (
    <BottomSheetBackdrop
      {...props}
      appearsOnIndex={0}
      disappearsOnIndex={-1}
      onPress={onClose}
      opacity={0.52}
      pressBehavior="close"
    />
  );
}

export function NewOrderProductPickerSheetFrame({
  activeIndex = 0,
  children,
  closeLabel,
  colors,
  enableContentPanningGesture = true,
  footer,
  footerBottomInset = PRODUCT_PICKER_FOOTER_BOTTOM_INSET,
  leadingAccessory,
  onClose,
  snapPoints = PRODUCT_PICKER_SNAP_POINTS,
  title,
  trailingAccessory,
  visible,
}: NewOrderProductPickerSheetFrameProps) {
  const insets = useSafeAreaInsets();
  const sheetRef = useRef<BottomSheet>(null);
  const footerInset = footerBottomInset + insets.bottom;

  useEffect(() => {
    sheetRef.current?.snapToIndex(activeIndex);
  }, [activeIndex]);

  if (!visible) {
    return null;
  }

  return (
    <Modal
      animationType="none"
      onRequestClose={onClose}
      transparent={true}
      visible={visible}
    >
      <GestureHandlerRootView
        style={styles.gestureRoot}
        testID="product-picker-sheet-root"
      >
        <ProductPickerSheetFooterContext.Provider
          value={{ bottomInset: footerInset, footer, onClose }}
        >
          <BottomSheet
            android_keyboardInputMode="adjustResize"
            backdropComponent={ProductPickerSheetBackdrop}
            backgroundStyle={[
              styles.sheetBackground,
              {
                backgroundColor: colors.background,
                borderColor: colors.border,
              },
            ]}
            enableContentPanningGesture={enableContentPanningGesture}
            enableDynamicSizing={false}
            enablePanDownToClose={true}
            footerComponent={footer ? ProductPickerSheetFooter : undefined}
            handleIndicatorStyle={[
              styles.handleIndicator,
              { backgroundColor: colors.textMuted },
            ]}
            index={activeIndex}
            keyboardBehavior="interactive"
            keyboardBlurBehavior="restore"
            onClose={onClose}
            ref={sheetRef}
            snapPoints={snapPoints}
            // Reserve the safe-area top so the sheet (and the keyboard-driven
            // interactive lift) can never rise behind the notch. Snap-point
            // percentages are measured against the area below this inset.
            topInset={insets.top}
          >
            {/*
              Plain View, NOT BottomSheetView: in @gorhom/bottom-sheet v5,
              wrapping a BottomSheetFlatList inside a BottomSheetView breaks list
              scrolling at the top snap point (regression from v4 — see
              gorhom/react-native-bottom-sheet#2539). The sheet still drags via
              the handle, and the scrollable connects its scroll directly.
            */}
            <View
              style={styles.sheetContent}
              testID="product-picker-sheet-content"
            >
              <View
                style={[
                  styles.header,
                  {
                    backgroundColor: colors.card,
                    borderBottomColor: colors.border,
                    paddingTop: Math.max(insets.top * 0.25, SPACING.md),
                  },
                ]}
              >
                <View style={styles.headerSide}>
                  {leadingAccessory ?? (
                    <Pressable
                      accessibilityLabel={closeLabel}
                      accessibilityRole="button"
                      hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
                      onPress={onClose}
                      style={[
                        styles.headerButton,
                        { backgroundColor: `${colors.text}10` },
                      ]}
                    >
                      <Ionicons color={colors.text} name="close" size={20} />
                    </Pressable>
                  )}
                </View>
                <Text
                  accessibilityRole="header"
                  numberOfLines={1}
                  style={[styles.title, { color: colors.text }]}
                >
                  {title}
                </Text>
                <View style={styles.headerSideRight}>{trailingAccessory}</View>
              </View>
              {children}
            </View>
          </BottomSheet>
        </ProductPickerSheetFooterContext.Provider>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  gestureRoot: {
    flex: 1,
  },
  sheetBackground: {
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  handleIndicator: {
    height: 5,
    width: 46,
  },
  sheetContent: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: SPACING.md,
    paddingHorizontal: SPACING.lg,
  },
  headerSide: {
    alignItems: 'flex-start',
    justifyContent: 'center',
    minHeight: 36,
    minWidth: 48,
  },
  headerSideRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    minHeight: 36,
    minWidth: 48,
  },
  headerButton: {
    alignItems: 'center',
    borderRadius: RADIUS.full,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  title: {
    flex: 1,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.size.lg,
    paddingHorizontal: SPACING.md,
    textAlign: 'center',
  },
  footer: {
    paddingBottom: PRODUCT_PICKER_FOOTER_BOTTOM_INSET,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xs,
  } satisfies ViewStyle,
});
