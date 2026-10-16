import { useMemo, useState } from 'react';
import { View, StyleSheet, Pressable, Image, useWindowDimensions } from 'react-native';

import { BottomSheet } from '@/components/ui/BottomSheet';
import { Text } from '@/components/ui/Text';
import { menuImage } from '@/lib/menuImage';
import { PhotoDim } from '@/components/ui/PhotoDim';
import { Button } from '@/components/ui/Button';
import { Stepper } from '@/components/ui/Stepper';
import { Icon } from '@/components/ui/Icon';
import { colors, spacing, radius } from '@/constants/theme';
import { config } from '@/constants/config';
import { useI18n } from '@/hooks/useI18n';
import { useMenuState } from '@/hooks/useMenuState';
import { formatJOD } from '@/lib/format';
import { iconForCategory } from '@/lib/productIcon';
import { secondaryName } from '@/lib/itemName';
import { tagsFor } from '@almond/shared/menu/publicFeed';
import { getMenu } from '@almond/shared/menu/store';
import { resolveItemSize } from '@almond/shared/menu';
import { getSizeUpsell, getItemPairings } from '@/lib/recommendations';
import { addSheetToCart, quickAddPrice, sheetTotal, stagedPairingsLine, togglePairing } from '@/lib/pairings';
import { choiceA11y, choiceGroupA11y, MIN_TOUCH_TARGET } from '@/lib/a11y';
import { useCartStore } from '@/stores/cartStore';
import { useFavouritesStore } from '@/stores/favouritesStore';
import { cartEditCollision, draftForCartLine, resolveCartEdit, type CartEditIssue } from '@/lib/cartEdit';
import { lineUnitPrice } from '@almond/shared/cart';
import type { MenuItem, ItemSize, CartCustomization, CartItem } from '@/types';

interface Props {
  item: MenuItem | null;
  visible: boolean;
  onClose: () => void;
  editingLine?: CartItem;
}

/** Item customization bottom sheet (section 4.5). */
export function ItemModal(props: Props) {
  const menu = useMenuState();
  // Closing discards this local draft. Reopening the same item starts from
  // the actual cart again; a live menu refresh never resets an open draft.
  if (!props.visible || (!props.item && !props.editingLine)) return null;
  const item = props.editingLine
    ? menu.items.find((m) => m.id === props.editingLine!.itemId) ?? null
    : props.item;
  return <ItemSheet key={props.editingLine?.lineId ?? item?.id} {...props} item={item} />;
}

function ItemSheet({ item, visible, onClose, editingLine }: Props) {
  const { t, lang } = useI18n();
  const { width, fontScale } = useWindowDimensions();
  const stackFooter = width < 360 || fontScale > 1.2;
  const addItem = useCartStore((s) => s.addItem);
  const editLine = useCartStore((s) => s.editLine);
  const cartItems = useCartStore((s) => s.items);
  const favIds = useFavouritesStore((s) => s.ids);
  const toggleFav = useFavouritesStore((s) => s.toggle);
  const isFav = !!item && favIds.includes(item.id);
  const [sizeId, setSizeId] = useState<ItemSize['id']>(editingLine?.sizeId ?? item?.sizes[0]?.id ?? 'M');
  const [selected, setSelected] = useState<CartCustomization[]>(() => editingLine
    ? draftForCartLine(editingLine).customizations
    : (item?.customizations ?? []).flatMap((g) => {
      const first = g.options[0];
      return !g.multiple && first ? [{ groupId: g.id, optionId: first.id, nameAr: first.nameAr, nameEn: first.nameEn, priceDelta: first.priceDelta }] : [];
    }));
  const [qty, setQty] = useState(editingLine?.qty ?? 1);
  const [saveIssue, setSaveIssue] = useState<CartEditIssue | null>(null);
  // Pairings the customer ticked; they join the cart with «أضف للسلة», not before.
  const [staged, setStaged] = useState<string[]>([]);
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const hasPhoto = !!item?.imageUrl && failedImage !== item.imageUrl;

  const size = useMemo(
    () => resolveItemSize(item, sizeId),
    [item, sizeId],
  );

  const resolved = editingLine ? resolveCartEdit(item, { sizeId, customizations: selected, qty }) : null;
  const customizations = resolved?.line?.customizations ?? selected;
  const issue = resolved?.issue ?? saveIssue;
  const originalPrice = editingLine ? resolveCartEdit(item, draftForCartLine(editingLine)).line : null;
  const priceChanged = !!editingLine && !!originalPrice && Math.abs(lineUnitPrice(originalPrice) - lineUnitPrice(editingLine)) > 0.000001;
  const collision = editingLine && resolved?.line ? cartEditCollision(cartItems, editingLine, resolved.line) : null;

  const unit = (size?.price ?? 0) + customizations.reduce((s, c) => s + c.priceDelta, 0);

  if (!item) return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      label={editingLine ? t('cart.editItem', { name: lang === 'ar' ? editingLine.nameAr : editingLine.nameEn }) : undefined}
      footer={<Button title={t('common.cancel')} variant="secondary" onPress={onClose} />}
    >
      <Text variant="body" accessibilityRole="alert" selectable>{t('cart.editItemUnavailable')}</Text>
    </BottomSheet>
  );
  const hasUnavailableSizes = item.sizes.some((choice) => !resolveItemSize(item, choice.id));

  // Upsell + cross-sell (Starbucks-style).
  const upsell = getSizeUpsell(item, sizeId);
  const pairings = editingLine ? [] : getItemPairings(item, 4);
  const stagedItems = pairings.filter((p) => staged.includes(p.id));
  // The button says what one tap will put in the cart: this item × qty and
  // every ticked pairing once.
  const total = collision?.total ?? sheetTotal(unit, qty, stagedItems);
  // …and says what is in it beyond this item, so the jump is explained.
  const includes = stagedPairingsLine(stagedItems, lang);

  const toggle = (groupId: string, optId: string, multiple: boolean) => {
    const option = item.customizations.find((g) => g.id === groupId)?.options.find((o) => o.id === optId);
    if (!option) return;
    const choice = { groupId, optionId: optId, nameAr: option.nameAr, nameEn: option.nameEn, priceDelta: option.priceDelta };
    setSaveIssue(null);
    setSelected((prev) => {
      const isSelected = prev.some((c) => c.groupId === groupId && c.optionId === optId);
      if (multiple) {
        return isSelected
          ? prev.filter((c) => c.groupId !== groupId || c.optionId !== optId)
          : [...prev, choice];
      }
      return [...prev.filter((c) => c.groupId !== groupId), choice];
    });
  };

  const onAdd = () => {
    if (editingLine) {
      const result = editLine(editingLine, { sizeId, customizations: selected, qty }, unit, collision);
      if (!result.saved) {
        setSaveIssue(result.issue);
        return;
      }
      onClose();
      return;
    }
    if (!size) return;
    addSheetToCart(addItem, { item, size, customizations, qty }, stagedItems);
    onClose();
  };

  const chooseSize = (id: ItemSize['id']) => { setSizeId(id); setSaveIssue(null); };

  // earn-arith-exempt: an offer LABEL — no invoice, no grant. §3.5 / §7 T7.
  const comboPoints = config.COMBO_BONUS_POINTS;
  const desc = (lang === 'ar' ? item.descAr : item.descEn)?.trim();
  // The section's English name, for the gluten-free claim Odoo files by section.
  const categoryEn = getMenu().categories.find((c) => c.id === item.categoryId)?.nameEn ?? '';

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      label={editingLine ? t('cart.editItem', { name: lang === 'ar' ? item.nameAr : item.nameEn }) : lang === 'ar' ? item.nameAr : item.nameEn}
      footer={
        <View style={styles.footer}>
          {editingLine && issue ? (
            <Text variant="caption" accessibilityRole="alert" selectable>{t(EDIT_ISSUE_COPY[issue])}</Text>
          ) : null}
          {collision ? (
            <View aria-live="polite">
              <Text variant="caption" selectable>{t('cart.editMergeNotice', {
                qty: collision.mergedQty,
                unit: formatJOD(collision.unitPrice, lang),
                total: formatJOD(collision.total, lang),
              })}</Text>
            </View>
          ) : null}
          {includes ? (
            <View aria-live="polite">
              <Text variant="caption" color={colors.dark} center>
                {t('menu.totalIncludes', {
                  items: includes.names,
                  price: formatJOD(includes.total, lang),
                })}
              </Text>
            </View>
          ) : null}
          <View style={[styles.footerActions, stackFooter && styles.footerActionsStacked]}>
            <Stepper value={qty} max={Math.max(99, editingLine?.qty ?? 1)} onChange={(value) => { setQty(value); setSaveIssue(null); }} label={lang === 'ar' ? item.nameAr : item.nameEn} />
            <Button
              title={editingLine
                ? `${t('cart.saveChanges')}${resolved?.line ? ` · ${formatJOD(total, lang)}` : ''}`
                : size ? `${t('menu.addToCart')} · ${formatJOD(total, lang)}` : t('menu.sizeUnavailable')}
              onPress={onAdd}
              disabled={!size || (!!editingLine && !resolved?.line)}
              fullWidth={stackFooter}
              style={stackFooter ? styles.addButtonStacked : styles.addButton}
            />
          </View>
          {editingLine ? <Button title={t('common.cancel')} variant="ghost" onPress={onClose} /> : null}
        </View>
      }
    >
      <View style={styles.header}>
        {priceChanged ? <Text variant="caption" selectable>{t('cart.editPriceUpdated')}</Text> : null}
        {/* Favourite ♥ — saves the drink to the Order › Favourites sub-tab (§2.4). */}
        <Pressable
          onPress={() => toggleFav(item.id)}
          style={({ pressed }) => [styles.favBtn, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={isFav ? t('order.favRemove') : t('order.favAdd')}
          aria-pressed={isFav}
        >
          <Icon name="heart" size={22} color={isFav ? colors.red : colors.warmGray} strokeWidth={2} />
        </Pressable>
        {/* The photograph is the page's first word: full width and tall,
            where it was a 112pt thumbnail, about a fifth of the width (expert
            panel, 2026-10-15). Precedent: Talabat and Starbucks open an item
            on its photo. White in both schemes: the menu photos are shot on
            white. */}
        <View style={[styles.hero, hasPhoto ? styles.heroPhoto : styles.heroIcon]}>
          {hasPhoto ? (
            <Image
              source={{ uri: menuImage(item.imageUrl, 720) }}
              style={styles.photo}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
              onError={() => setFailedImage(item.imageUrl ?? null)}
            />
          ) : (
            <Icon name={iconForCategory(item.categoryId)} size={72} color={colors.dark} strokeWidth={1.4} />
          )}
          {hasPhoto ? <PhotoDim /> : null}
        </View>
        <Text variant="h2">{lang === 'ar' ? item.nameAr : item.nameEn}</Text>
        {secondaryName(item, lang) ? (
          <Text variant="caption" color={colors.warmGray}>
            {secondaryName(item, lang)}
          </Text>
        ) : null}
        {!editingLine || resolved?.line ? <Text variant="price" style={styles.unitPrice}>{formatJOD(unit, lang)}</Text> : null}
        {/* The description in the reader's language, gated on THAT field: the
            gate read `descAr` in English too, so an English description with
            no Arabic one never showed, and an Arabic one with no English one
            printed an empty line. */}
        {desc ? (
          <Text variant="body" color={colors.warmGray} style={styles.desc}>
            {desc}
          </Text>
        ) : null}

        {/* 🔴 ONLY WHAT THE SHOP ITSELF SAYS. This row printed calories, sugar
            and «يحتوي على الجلوتين» from one estimate per category group: the
            same «120 سعرة · 9 غ سكر» on 47 items, «150 سعرة» on the birthday
            candles, and «يحتوي على الجلوتين» on the 23 cakes and desserts Odoo
            sells under «خالٍ من الجلوتين» (Dunkin' panel, 2026-10-15). No item
            has real nutrition data, so none is shown. The one claim left is
            Odoo's own: an item filed under a gluten-free category, or named
            gluten-free, says so, by the rule the public feed already uses
            (menu/publicFeed.ts tagsFor). Precedent: Starbucks shows nutrition
            per size from lab data, or nothing. */}
        {tagsFor(item, categoryEn).includes('gluten_free') ? (
          <View style={styles.diet}>
            <View style={styles.dietPill}>
              <Icon name="wheat" size={13} color={colors.green} strokeWidth={2} />
              <Text variant="caption" color={colors.green}>
                {t('menu.glutenFree')}
              </Text>
            </View>
          </View>
        ) : null}
      </View>

      {/* The banner promised «save 1.000 JOD» for months after
          BRUNCH_COMBO_DISCOUNT went to 0 and the offer became points — a
          discount the till no longer gave, printed beside the price. It states
          the points now, and reads them from the dial so it cannot go stale
          again. */}
      {item.isBrunch ? (
        <View style={styles.brunchBanner}>
          <Icon name="brunch" size={15} color={colors.dark} strokeWidth={1.9} />
          <Text variant="caption" color={colors.dark} style={styles.flex}>
            {/* The points, from the dial — never a number typed into the
                string. This banner promised «save 1.000 JOD» for months after
                BRUNCH_COMBO_DISCOUNT went to 0 and the offer became points:
                a discount the till no longer gave, printed beside the price. */}
            {t('menu.brunchOffer', { count: comboPoints, points: comboPoints })}
          </Text>
        </View>
      ) : null}

      {resolved?.unavailable.length ? (
        <Section title={t('cart.editUnavailableOptions')}>
          {resolved.unavailable.map((choice) => {
            const name = lang === 'ar' ? choice.nameAr : choice.nameEn;
            return (
              <Pressable
                key={`${choice.groupId}:${choice.optionId}`}
                style={({ pressed }) => [styles.optionItem, styles.optChip, pressed && styles.optionPressed]}
                accessibilityRole="button"
                accessibilityLabel={t('cart.editRemoveOption', { name })}
                onPress={() => { setSelected((prev) => prev.filter((c) => c.groupId !== choice.groupId || c.optionId !== choice.optionId)); setSaveIssue(null); }}
              >
                <Text variant="body" style={styles.flex}>{name}</Text>
                <Text variant="caption">{t('cart.remove')}</Text>
              </Pressable>
            );
          })}
        </Section>
      ) : null}

      {item.sizes.length > 1 || (editingLine && !size) ? (
        <Section title={t('menu.size')}>
          <View style={styles.optionRow} {...choiceGroupA11y(false, t('menu.size'))}>
            {item.sizes.map((s, index) => {
              const available = !!resolveItemSize(item, s.id);
              const active = available && s.id === sizeId;
              return (
                <Pressable
                  key={`${s.id}:${index}`}
                  style={({ pressed }) => [styles.sizeChip, active && styles.sizeChipActive, pressed && styles.pressed]}
                  disabled={!available}
                  aria-disabled={!available}
                  onPress={() => chooseSize(s.id)}
                  {...choiceA11y(
                    'radio',
                    active,
                    `${t('common.withPrice', {
                      name: lang === 'ar' ? s.nameAr : s.nameEn,
                      price: formatJOD(s.price, lang),
                    })}${available ? '' : `, ${t('menu.sizeUnavailable')}`}`,
                  )}
                >
                  <Text variant="bodyBold" color={active ? colors.onInk : colors.dark} center>
                    {lang === 'ar' ? s.nameAr : s.nameEn}
                  </Text>
                  <Text variant="caption" color={active ? colors.onInk : colors.warmGray} center>
                    {formatJOD(s.price, lang)}
                  </Text>
                  {!available ? <Text variant="caption" center>{t('menu.sizeUnavailable')}</Text> : null}
                </Pressable>
              );
            })}
          </View>
          {hasUnavailableSizes ? <Text variant="caption" selectable>{t('menu.sizeUnavailableNotice')}</Text> : null}
        </Section>
      ) : null}

      {/* Size upsell (Starbucks "upsize") */}
      {upsell ? (
        <Pressable style={({ pressed }) => [styles.upsell, pressed && styles.pressed]} onPress={() => chooseSize(upsell.size.id)} accessibilityRole="button">
          <Icon name="arrow-up" size={18} color={colors.dark} strokeWidth={2.2} />
          <Text variant="caption" color={colors.dark} style={styles.flex}>
            {t('menu.upsize', {
              size: lang === 'ar' ? upsell.size.nameAr : upsell.size.nameEn,
              delta: formatJOD(upsell.delta, lang),
            })}
          </Text>
        </Pressable>
      ) : null}

      {item.customizations.map((g) => (
        <Section key={g.id} title={lang === 'ar' ? g.nameAr : g.nameEn}>
          {/* One answer (milk, size-like choices) is a radiogroup; many
              («إضافات», flavours) are checkboxes — so a screen reader says
              which, and which are on. */}
          <View style={styles.optionList} {...choiceGroupA11y(g.multiple, lang === 'ar' ? g.nameAr : g.nameEn)}>
            {g.options.map((o) => {
              const isSel = selected.some((c) => c.groupId === g.id && c.optionId === o.id);
              const name = lang === 'ar' ? o.nameAr : o.nameEn;
              return (
                <Pressable
                  key={o.id}
                  style={({ pressed }) => [styles.optionItem, styles.optChip, pressed && styles.optionPressed]}
                  onPress={() => toggle(g.id, o.id, g.multiple)}
                  {...choiceA11y(
                    g.multiple ? 'checkbox' : 'radio',
                    isSel,
                    o.priceDelta > 0
                      ? t('common.withPrice', { name, price: `+${formatJOD(o.priceDelta, lang)}` })
                      : name,
                  )}
                >
                  <ChoiceMark selected={isSel} multiple={g.multiple} />
                  <Text variant="body" style={styles.flex}>
                    {lang === 'ar' ? o.nameAr : o.nameEn}
                  </Text>
                  {o.priceDelta > 0 ? (
                    <Text variant="caption" color={colors.warmGray} style={styles.optionPrice}>
                      +{formatJOD(o.priceDelta, lang)}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </Section>
      ))}

      {/* Cross-sell: goes great with */}
      {pairings.length > 0 ? (
        <Section title={t('menu.pairsWith')}>
          <View style={styles.optionList} {...choiceGroupA11y(true, t('menu.pairsWith'))}>
            {pairings.map((p) => {
              // A tick, not an add: a second tap takes it back off, and nothing
              // reaches the cart until «أضف للسلة» (which now counts it).
              const isStaged = staged.includes(p.id);
              const name = lang === 'ar' ? p.nameAr : p.nameEn;
              const price = `+${formatJOD(quickAddPrice(p), lang)}`;
              return (
                <Pressable
                  key={p.id}
                  style={({ pressed }) => [styles.optionItem, styles.pairChip, pressed && styles.optionPressed]}
                  onPress={() => setStaged((prev) => togglePairing(prev, p.id))}
                  {...choiceA11y('checkbox', isStaged, t('common.withPrice', { name, price }))}
                >
                  <ChoiceMark selected={isStaged} multiple />
                  <Text variant="body" style={styles.flex}>
                    {name}
                  </Text>
                  <Text variant="caption" color={colors.warmGray} style={styles.optionPrice}>
                    {price}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Section>
      ) : null}
    </BottomSheet>
  );
}

const EDIT_ISSUE_COPY: Record<CartEditIssue, string> = {
  itemUnavailable: 'cart.editItemUnavailable',
  sizeUnavailable: 'cart.editSizeUnavailable',
  optionsUnavailable: 'cart.editOptionsUnavailable',
  optionsChanged: 'cart.editOptionsChanged',
  quantityInvalid: 'cart.editQuantityInvalid',
  unpriced: 'cart.editUnpriced',
  lineChanged: 'cart.editLineChanged',
  menuChanged: 'cart.editMenuChanged',
  mergeChanged: 'cart.editMergeChanged',
};

/** Selection is visible in the control itself, alongside the spoken state. */
function ChoiceMark({ selected, multiple }: { selected: boolean; multiple: boolean }) {
  return (
    <View
      aria-hidden
      style={[
        styles.choiceMark,
        multiple ? styles.checkMark : styles.radioMark,
        selected && styles.choiceMarkSelected,
        selected && multiple && styles.checkMarkSelected,
      ]}
    >
      {selected ? (
        multiple ? <Icon name="check" size={14} color={colors.onInk} strokeWidth={2.4} /> : <View style={styles.radioDot} />
      ) : null}
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="bodyBold" style={styles.sectionTitle}>
        {title}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: 2, marginBottom: spacing.lg },
  footer: { gap: spacing.sm },
  footerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  footerActionsStacked: { flexDirection: 'column', alignItems: 'stretch' },
  addButton: { flex: 1, paddingHorizontal: spacing.sm },
  addButtonStacked: { paddingHorizontal: spacing.md },
  pressed: { opacity: 0.75 },
  // Inside the photograph's corner, where Talabat and Starbucks put it.
  favBtn: {
    position: 'absolute',
    top: spacing.sm,
    end: spacing.sm,
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  hero: {
    alignSelf: 'stretch',
    height: 248,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  heroPhoto: { backgroundColor: colors.white },
  // No photo: a quiet fill under an ink icon, which is light in dark mode
  // and would vanish on white.
  heroIcon: { backgroundColor: colors.neutralWarm },
  // Trim only the photograph's white margin; the product and handle remain
  // inside the frame at every sheet width.
  photo: { width: '100%', height: '100%', transform: [{ scale: 1.15 }] },
  unitPrice: { marginTop: spacing.xs },
  desc: { marginTop: spacing.sm },
  diet: { flexDirection: 'row', marginTop: spacing.md },
  // On the quiet fill, not the selection fill: green on `neutralWarm` is
  // 4.57:1 (7.6:1 dark); on `lightGold` it was 4.21:1 and read as selected.
  dietPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.neutralWarm,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  brunchBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  flex: { flex: 1 },
  upsell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.lightGold,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  optionList: { alignSelf: 'stretch' },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.neutralWarm,
    paddingVertical: spacing.md,
  },
  optChip: { minHeight: MIN_TOUCH_TARGET },
  pairChip: { minHeight: MIN_TOUCH_TARGET },
  optionPressed: { backgroundColor: colors.surface },
  optionPrice: { flexShrink: 0, fontVariant: ['tabular-nums'] },
  choiceMark: { width: 18, height: 18, borderWidth: 1, borderColor: colors.outline, alignItems: 'center', justifyContent: 'center' },
  radioMark: { borderRadius: radius.pill },
  checkMark: { borderRadius: spacing.xs },
  choiceMarkSelected: { borderColor: colors.primary },
  checkMarkSelected: { backgroundColor: colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: radius.pill, backgroundColor: colors.primary },
  section: { marginBottom: spacing.xl },
  sectionTitle: { marginBottom: spacing.sm },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  sizeChip: {
    flexBasis: 0,
    flexGrow: 1,
    minWidth: 80,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.outline,
  },
  sizeChipActive: { borderColor: colors.primary, backgroundColor: colors.primary },
});
