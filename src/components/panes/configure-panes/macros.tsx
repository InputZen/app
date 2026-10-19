import {useState, FC, useCallback, useRef} from 'react';
import styled from 'styled-components';
import {useTranslation} from 'react-i18next';
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import {faPen} from '@fortawesome/free-solid-svg-icons';
import {OverflowCell, SubmenuOverflowCell, SubmenuRow} from '../grid';
import {CenterPane} from '../pane';
import {title, component} from '../../icons/adjust';
import {MacroDetailPane} from './submenus/macros/macro-detail';
import {ErrorMessage} from '../../styled';
import {useAppDispatch, useAppSelector} from '../../../store/hooks';
import {getSelectedConnectedDevice} from '../../../store/devicesSlice';
import {
  getExpressions,
  getMacroCount,
  saveMacros,
} from '../../../store/macrosSlice';
import {
  getViaExtraCaps,
  getViaExtraMacroNames,
  renameMacro,
} from '../../../store/viaExtraSlice';
import {sanitizeName} from '../../../utils/via-extra';

const MacroPane = styled(CenterPane)`
  height: 100%;
  background: var(--color_dark_grey);
`;

const Container = styled.div`
  display: flex;
  align-items: center;
  flex-direction: column;
  padding: 12px;
  padding-top: 0;
`;

const MenuContainer = styled.div`
  padding: 15px 10px 20px 10px;
`;

// One row of the macro list: M0 | name | pencil
const MacroRowContent = styled.span`
  display: flex;
  align-items: center;
  column-gap: 8px;
`;

const MacroNumber = styled.span`
  min-width: 34px;
  text-align: left;
`;

// Same style as the M0 text: font, size and colour come from the row
const MacroName = styled.span`
  max-width: 110px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const PencilButton = styled.button`
  border: none;
  background: transparent;
  padding: 2px 4px;
  font-size: 13px;
  color: var(--color_label);
  cursor: pointer;
  &:hover {
    color: var(--color_accent);
  }
`;

const NameInput = styled.input`
  width: 110px;
  box-sizing: border-box;
  padding: 0 4px;
  font: inherit;
  line-height: inherit;
  color: var(--color_accent);
  background: none;
  border: none;
  border-bottom: 1px solid var(--color_accent);
  outline: none;
`;

export const Pane: FC = () => {
  const {t} = useTranslation();
  const dispatch = useAppDispatch();
  const selectedDevice = useAppSelector(getSelectedConnectedDevice);
  const macroExpressions = useAppSelector(getExpressions);
  const macroCount = useAppSelector(getMacroCount);
  const caps = useAppSelector(getViaExtraCaps);
  const macroNames = useAppSelector(getViaExtraMacroNames);

  const [selectedMacro, setSelectedMacro] = useState(0);
  const [editingMacro, setEditingMacro] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  // set when Escape is pressed, so the blur that follows does not save
  const cancelled = useRef(false);

  // Names are stored in the keyboard's EEPROM (via_extra), not in the macro text.
  // Without keyboard support there is no pencil.
  const canName = !!caps?.hasMacroNames;

  const saveMacro = useCallback(
    async (macro: string) => {
      if (!selectedDevice) {
        return;
      }

      const newMacros = macroExpressions.map((oldMacro, i) =>
        i === selectedMacro ? macro : oldMacro,
      );

      dispatch(saveMacros(selectedDevice, newMacros));
    },
    [macroExpressions, saveMacros, dispatch, selectedDevice, selectedMacro],
  );

  const startEdit = (idx: number) => {
    cancelled.current = false;
    setError('');
    setDraft(macroNames[idx] ?? '');
    setEditingMacro(idx);
  };

  // Saved to the keyboard as soon as editing finishes (Enter or leaving the field)
  const finishEdit = async (idx: number) => {
    if (cancelled.current) {
      cancelled.current = false;
      setEditingMacro(null);
      return;
    }
    const next = draft.trim();
    if (next === (macroNames[idx] ?? '')) {
      setEditingMacro(null);
      return;
    }
    setSaving(true);
    try {
      await dispatch(renameMacro(idx, next));
    } catch (e) {
      setError(
        t('Could not save the macro name to the keyboard. Please try again.'),
      );
    } finally {
      setEditingMacro(null);
      setSaving(false);
    }
  };

  const macroMenus = Array(macroCount)
    .fill(0)
    .map((_, idx) => idx)
    .map((idx) => {
      const nameable = canName && idx < caps!.macroCount;
      const name = macroNames[idx];
      const editing = editingMacro === idx;
      return (
        <SubmenuRow
          $selected={selectedMacro === idx}
          onClick={() => setSelectedMacro(idx)}
          key={idx}
          style={{borderWidth: 0}}
        >
          <MacroRowContent>
            <MacroNumber>{`M${idx}`}</MacroNumber>
            {editing ? (
              <NameInput
                autoFocus
                value={draft}
                maxLength={caps!.macroNameLen}
                disabled={saving}
                placeholder={t('Name')}
                onChange={(e) => setDraft(sanitizeName(e.target.value))}
                onBlur={() => finishEdit(idx)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    (e.target as HTMLInputElement).blur();
                  }
                  if (e.key === 'Escape') {
                    cancelled.current = true;
                    (e.target as HTMLInputElement).blur();
                  }
                }}
              />
            ) : (
              name && <MacroName title={name}>{name}</MacroName>
            )}
            {nameable && !editing && (
              <PencilButton
                title={t('Edit macro name')}
                disabled={saving}
                onClick={() => startEdit(idx)}
              >
                <FontAwesomeIcon icon={faPen} />
              </PencilButton>
            )}
          </MacroRowContent>
        </SubmenuRow>
      );
    });

  if (!selectedDevice) {
    return null;
  }
  return (
    <>
      <SubmenuOverflowCell>
        <MenuContainer>{macroMenus}</MenuContainer>
      </SubmenuOverflowCell>
      <OverflowCell>
        <MacroPane>
          <Container>
            {error ? <ErrorMessage>{error}</ErrorMessage> : null}
            <MacroDetailPane
              macroExpressions={macroExpressions}
              selectedMacro={selectedMacro}
              saveMacros={saveMacro}
              protocol={selectedDevice ? selectedDevice.protocol : -1}
            />
          </Container>
        </MacroPane>
      </OverflowCell>
    </>
  );
};

// TODO: these are used in the context that configure.tsx imports menus with props Icon, Title, Pane.
// Should we encapsulate this type and wrap the exports to conform to them?
export const Icon = component;
export const Title = title;
