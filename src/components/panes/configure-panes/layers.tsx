import {FC, useEffect, useRef, useState} from 'react';
import styled from 'styled-components';
import {useTranslation} from 'react-i18next';
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import {faArrowsRotate, faPen, faXmark} from '@fortawesome/free-solid-svg-icons';
import {title, component} from '../../icons/layers';
import {ControlRow, Detail, Label, SpanOverflowCell} from '../grid';
import {CenterPane} from '../pane';
import {AccentButton} from '../../inputs/accent-button';
import TextInput from '../../inputs/text-input';
import {useAppDispatch, useAppSelector} from 'src/store/hooks';
import {getSelectedConnectedDevice} from 'src/store/devicesSlice';
import {getNumberOfLayers} from 'src/store/keymapSlice';
import {
  changeLayerIcon,
  getViaExtraActiveLayer,
  getViaExtraCaps,
  getViaExtraLayerIcons,
  getViaExtraLayerNames,
  renameLayer,
  resetLayer,
} from 'src/store/viaExtraSlice';
import {BUILTIN_LAYER_NAMES, sanitizeName} from 'src/utils/via-extra';
import {loadLayerNames, saveLayerNames} from 'src/utils/layer-names';
import {ErrorMessage} from '../../styled';

const LayersPane = styled(CenterPane)`
  height: 100%;
  background: var(--color_dark_grey);
`;

const Container = styled.div`
  display: flex;
  align-items: center;
  flex-direction: column;
  padding: 0 12px;
`;

// Narrower than the shared 960px rows used by the other sections
const NarrowRow = styled(ControlRow)`
  max-width: 540px;
`;

const LayerNumber = styled.span`
  display: inline-block;
  min-width: 26px;
  color: var(--color_label-highlighted);
  font-variant-numeric: tabular-nums;
`;

const DefaultName = styled.span`
  font-style: italic;
`;

// A name the user changed: white, like the layer number
const CustomName = styled.span`
  color: var(--color_label-highlighted);
`;

// Row content as fixed columns: number | icon | name | active badge.
// The name and badge columns have a fixed width, so the badge stays in the
// same vertical place on every row when the active layer changes.
const RowContent = styled.span`
  display: flex;
  align-items: center;
`;

const NameCell = styled.span`
  display: flex;
  align-items: center;
  width: 176px;
  white-space: nowrap;
  overflow: hidden;
`;

const ActiveSlot = styled.span`
  display: flex;
  align-items: center;
  width: 64px;
  margin-left: 6px;
`;

const ActiveBadge = styled.span`
  display: inline-block;
  padding: 0 7px;
  font-size: 13px;
  line-height: 18px;
  vertical-align: middle;
  color: var(--color_accent);
  border: 1px solid var(--color_accent);
  border-radius: 10px;
`;

const Buttons = styled(Detail)`
  column-gap: 6px;
`;

const NameInput = styled(TextInput)`
  margin-bottom: 0;
  width: 100%;
  box-sizing: border-box;
  padding: 0.25rem 0.4rem;
`;

// Smaller than the default 100px-wide accent button
const CompactButton = styled(AccentButton)`
  min-width: 0;
  height: 32px;
  line-height: 30px;
  padding: 0 10px;
  font-size: 16px;
`;

const SquareButton = styled(CompactButton)`
  width: 32px;
  padding: 0;
`;

// The 22x22 icons come from the keyboard's icon pack. They are drawn on a dark
// tile so they stay visible in both light and dark themes.
const IconTile = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  margin-right: 8px;
  vertical-align: middle;
  background: #1b1b1b;
  border-radius: 5px;
`;

const iconUrl = (icon: number) =>
  `${import.meta.env.BASE_URL}via-extra-icons/${String(icon).padStart(2, '0')}.png`;

const PopoverAnchor = styled.span`
  position: relative;
  display: inline-flex;
`;

// Floating panel under the "Edit icon" button, in the style of the color picker
const IconPanel = styled.div`
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 20;
  display: grid;
  grid-template-columns: repeat(6, 34px);
  gap: 4px;
  padding: 6px;
  line-height: normal;
  background: var(--bg_menu);
  border: 4px solid var(--border_color_cell);
  box-shadow: rgba(0, 0, 0, 0.3) 0 4px 12px;
`;

const PickerButton = styled.button<{$selected: boolean}>`
  width: 34px;
  height: 34px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #1b1b1b;
  border-radius: 5px;
  cursor: pointer;
  border: 2px solid ${(p) => (p.$selected ? '#e53935' : 'transparent')};
  &:hover:not(:disabled) {
    border-color: rgba(229, 57, 53, 0.6);
  }
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

type LayerRowProps = {
  index: number;
  name: string | undefined;
  maxLength: number;
  // true when the name is stored on the keyboard (printable ASCII only)
  onKeyboard: boolean;
  editable: boolean;
  active: boolean;
  // set when the keyboard stores icons: current icon and how many exist
  icon: number | undefined;
  iconCount: number;
  onRename: (name: string) => Promise<void> | void;
  onChangeIcon: (icon: number) => Promise<void>;
  // restore the built-in name and the default icon
  onReset: () => Promise<void>;
};

const LayerRow: FC<LayerRowProps> = ({
  index,
  name,
  maxLength,
  onKeyboard,
  editable,
  active,
  icon,
  iconCount,
  onRename,
  onChangeIcon,
  onReset,
}) => {
  const {t} = useTranslation();
  const [editing, setEditing] = useState(false);
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState('');
  const pickerRef = useRef<HTMLSpanElement>(null);

  // Close the icon panel on an outside click or Escape, like the color picker
  useEffect(() => {
    if (!picking) {
      return;
    }
    const onMouseDown = (e: MouseEvent) => {
      if (!pickerRef.current?.contains(e.target as Node)) {
        setPicking(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPicking(false);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [picking]);

  const startEdit = () => {
    setPicking(false);
    setDraft(name ?? '');
    setEditing(true);
  };
  const commit = async () => {
    const next = draft.trim();
    if (next === (name ?? '')) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onRename(next);
      setEditing(false);
    } catch (e) {
      // the screen shows the error; stay in edit mode so nothing is lost
    } finally {
      setSaving(false);
    }
  };
  const pickIcon = async (next: number) => {
    setSaving(true);
    try {
      await onChangeIcon(next);
      setPicking(false);
    } catch (e) {
      // the screen shows the error; keep the panel open
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    setSaving(true);
    try {
      await onReset();
      setPicking(false);
    } catch (e) {
      // the screen shows the error
    } finally {
      setSaving(false);
    }
  };

  const iconsDisabled = icon === undefined || !editable;
  // keyboard names: custom unless it equals the built-in name of this layer
  const isCustomName = onKeyboard
    ? !!name && name !== BUILTIN_LAYER_NAMES[index]
    : !!name;

  return (
    <NarrowRow>
      <Label>
        <RowContent>
        <LayerNumber>{index}</LayerNumber>
        {icon !== undefined && icon > 0 && (
          <IconTile>
            <img src={iconUrl(icon)} width={22} height={22} alt="" />
          </IconTile>
        )}
        <NameCell>
        {editing ? (
          <NameInput
            autoFocus
            value={draft}
            maxLength={maxLength}
            disabled={saving}
            placeholder={
              onKeyboard ? t('Built-in name') : `${t('Layer')} ${index}`
            }
            onChange={(e) =>
              setDraft(
                onKeyboard ? sanitizeName(e.target.value) : e.target.value,
              )
            }
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit();
              if (e.key === 'Escape') setEditing(false);
            }}
          />
        ) : name ? (
          isCustomName ? (
            <CustomName>{name}</CustomName>
          ) : (
            name
          )
        ) : (
          <DefaultName>{`${t('Layer')} ${index}`}</DefaultName>
        )}
        </NameCell>
        <ActiveSlot>
          {active && <ActiveBadge>{t('Active')}</ActiveBadge>}
        </ActiveSlot>
        </RowContent>
      </Label>
      <Buttons>
        {editing ? (
          <>
            <CompactButton disabled={saving} onClick={commit}>
              {t('Save')}
            </CompactButton>
            <SquareButton
              disabled={saving}
              title={t('Cancel')}
              onClick={() => setEditing(false)}
            >
              <FontAwesomeIcon icon={faXmark} />
            </SquareButton>
          </>
        ) : (
          <>
            <SquareButton
              disabled={!editable}
              title={t('Edit name')}
              onClick={startEdit}
            >
              <FontAwesomeIcon icon={faPen} />
            </SquareButton>
            <PopoverAnchor ref={pickerRef}>
              <CompactButton
                disabled={iconsDisabled}
                title={
                  icon === undefined
                    ? t('This keyboard does not store layer icons')
                    : undefined
                }
                onClick={() => setPicking((p) => !p)}
              >
                {t('Edit icon')}
              </CompactButton>
              {picking && !iconsDisabled && (
                <IconPanel>
                  {new Array(iconCount).fill(0).map((_, i) => (
                    <PickerButton
                      key={i + 1}
                      $selected={icon === i + 1}
                      disabled={saving}
                      title={`${i + 1}`}
                      onClick={() => pickIcon(i + 1)}
                    >
                      <img src={iconUrl(i + 1)} width={22} height={22} alt="" />
                    </PickerButton>
                  ))}
                </IconPanel>
              )}
            </PopoverAnchor>
            <SquareButton
              disabled={!editable || saving}
              title={t('Restore default')}
              onClick={reset}
            >
              <FontAwesomeIcon icon={faArrowsRotate} />
            </SquareButton>
          </>
        )}
      </Buttons>
    </NarrowRow>
  );
};

export const Pane: FC = () => {
  const {t} = useTranslation();
  const dispatch = useAppDispatch();
  const device = useAppSelector(getSelectedConnectedDevice);
  const numberOfLayers = useAppSelector(getNumberOfLayers);
  const viaExtraCaps = useAppSelector(getViaExtraCaps);
  const keyboardNames = useAppSelector(getViaExtraLayerNames);
  const keyboardIcons = useAppSelector(getViaExtraLayerIcons);
  const activeLayer = useAppSelector(getViaExtraActiveLayer);
  const vendorProductId = device?.vendorProductId;
  const namesOnKeyboard = !!viaExtraCaps?.hasNames;
  const iconsOnKeyboard = !!viaExtraCaps?.hasIcons;
  const [error, setError] = useState('');

  const [names, setNames] = useState<Record<string, string>>({});
  useEffect(() => {
    setNames(
      vendorProductId === undefined ? {} : loadLayerNames(vendorProductId),
    );
  }, [vendorProductId]);

  const rename = async (index: number, name: string) => {
    setError('');
    if (namesOnKeyboard) {
      try {
        await dispatch(renameLayer(index, name));
      } catch (e) {
        setError(
          t('Could not save the name to the keyboard. Please try again.'),
        );
        throw e;
      }
      return;
    }
    if (vendorProductId === undefined) return;
    const next = {...names};
    if (name) next[index] = name;
    else delete next[index];
    setNames(next);
    saveLayerNames(vendorProductId, next);
  };

  const changeIcon = async (index: number, icon: number) => {
    setError('');
    try {
      await dispatch(changeLayerIcon(index, icon));
    } catch (e) {
      setError(t('Could not save the icon to the keyboard. Please try again.'));
      throw e;
    }
  };

  const reset = async (index: number) => {
    setError('');
    if (!viaExtraCaps) {
      // browser-only names: just forget the custom name
      await rename(index, '');
      return;
    }
    try {
      await dispatch(resetLayer(index));
    } catch (e) {
      setError(t('Could not restore the defaults on the keyboard. Please try again.'));
      throw e;
    }
  };

  return (
    <SpanOverflowCell>
      <LayersPane>
        <Container>
          {error ? <ErrorMessage>{error}</ErrorMessage> : null}
          {numberOfLayers === 0 ? (
            <NarrowRow>
              <Label>{t('No layers found on this keyboard.')}</Label>
            </NarrowRow>
          ) : (
            new Array(numberOfLayers)
              .fill(0)
              .map((_, idx) => (
                <LayerRow
                  key={idx}
                  index={idx}
                  name={namesOnKeyboard ? keyboardNames[idx] : names[idx]}
                  maxLength={namesOnKeyboard ? viaExtraCaps!.nameLen : 32}
                  onKeyboard={namesOnKeyboard}
                  editable={!viaExtraCaps || idx < viaExtraCaps.layerCount}
                  active={activeLayer === idx}
                  icon={iconsOnKeyboard ? keyboardIcons[idx] : undefined}
                  iconCount={viaExtraCaps?.iconCount ?? 0}
                  onRename={(name) => rename(idx, name)}
                  onChangeIcon={(icon) => changeIcon(idx, icon)}
                  onReset={() => reset(idx)}
                />
              ))
          )}
        </Container>
      </LayersPane>
    </SpanOverflowCell>
  );
};

export const Title = title;
export const Icon = component;
