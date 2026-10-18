import {FC, useEffect, useMemo, useState} from 'react';
import styled from 'styled-components';
import {useTranslation} from 'react-i18next';
import {title, component} from '../../icons/debug';
import {ControlRow, Detail, Label, SpanOverflowCell} from '../grid';
import {CenterPane} from '../pane';
import TextInput from '../../inputs/text-input';
import {AccentSelect} from '../../inputs/accent-select';
import {AccentButton} from '../../inputs/accent-button';
import {ErrorMessage, SuccessMessage} from '../../styled';
import {useAppDispatch, useAppSelector} from 'src/store/hooks';
import {
  getDialHoldMs,
  getScreensaverMinutes,
  getViaExtraCaps,
  saveViaExtraSettings,
} from 'src/store/viaExtraSlice';
import {DIAL_SETTING_HOLD_OPTIONS_MS} from 'src/utils/via-extra';

const DebugPane = styled(CenterPane)`
  height: 100%;
  background: var(--color_dark_grey);
`;

const Container = styled.div`
  display: flex;
  align-items: center;
  flex-direction: column;
  padding: 0 12px;
`;

// Same narrow rows as the Layers screen
const NarrowRow = styled(ControlRow)`
  max-width: 540px;
`;

const NumberInput = styled(TextInput)`
  margin-bottom: 0;
  width: 120px;
  box-sizing: border-box;
  padding: 0.25rem 0.4rem;
  text-align: right;
`;

const Unit = styled.span`
  margin-left: 8px;
  min-width: 28px;
  color: var(--color_label);
`;

const PaneTitle = styled.div`
  width: 100%;
  max-width: 540px;
  box-sizing: border-box;
  padding: 14px 5px 8px;
  font-size: 22px;
  font-weight: 400;
  font-style: italic;
  text-align: center;
  color: var(--color_label-highlighted);
`;

// Centered Save button, without the divider line the other rows have
const SaveRow = styled.div`
  width: 100%;
  max-width: 540px;
  display: flex;
  justify-content: center;
  padding: 14px 0 4px;
`;

const Messages = styled.div`
  width: 100%;
  max-width: 540px;
  margin-top: 12px;
  text-align: center;
`;

// Dial Setting Hold choices: the values the keyboard accepts, shown as "1s", "1.5s", ...
const holdOption = (ms: number) => ({label: `${ms / 1000}s`, value: ms});
const DIAL_HOLD_OPTIONS = DIAL_SETTING_HOLD_OPTIONS_MS.map(holdOption);

// BuildBox accepts 1..60 minutes (0 is not "off", see PROTOCOL.md section 4a)
const MIN_MINUTES = 1;
const MAX_MINUTES = 60;

export const Pane: FC = () => {
  const {t} = useTranslation();
  const dispatch = useAppDispatch();
  const caps = useAppSelector(getViaExtraCaps);
  const storedMinutes = useAppSelector(getScreensaverMinutes);
  const storedHoldMs = useAppSelector(getDialHoldMs);
  const supported = !!caps?.hasSettings;

  const [minutes, setMinutes] = useState('');
  const [dialHold, setDialHold] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ok: boolean; text: string} | null>(
    null,
  );

  // Show what the keyboard currently stores (initially and after every save)
  useEffect(() => {
    if (storedMinutes !== null) setMinutes(String(storedMinutes));
    if (storedHoldMs !== null) setDialHold(storedHoldMs);
  }, [storedMinutes, storedHoldMs]);

  // The keyboard can hold a hold time that is not in the list (set on its own screen).
  // Show it as it is, as an extra choice.
  const holdOptions = useMemo(() => {
    const extra =
      storedHoldMs !== null && !DIAL_SETTING_HOLD_OPTIONS_MS.includes(storedHoldMs)
        ? [holdOption(storedHoldMs)]
        : [];
    return [...extra, ...DIAL_HOLD_OPTIONS].sort((a, b) => a.value - b.value);
  }, [storedHoldMs]);

  const minutesValue = Number(minutes);
  const holdAllowed =
    dialHold !== null &&
    (DIAL_SETTING_HOLD_OPTIONS_MS.includes(dialHold) ||
      dialHold === storedHoldMs);
  const valid =
    minutes.trim() !== '' &&
    Number.isInteger(minutesValue) &&
    minutesValue >= MIN_MINUTES &&
    minutesValue <= MAX_MINUTES &&
    holdAllowed;

  const save = async () => {
    if (!valid) return;
    setSaving(true);
    setMessage(null);
    try {
      // A hold time the keyboard would refuse is only sent if the user changed it
      await dispatch(
        saveViaExtraSettings(
          minutesValue,
          dialHold !== storedHoldMs ? dialHold : null,
        ),
      );
      setMessage({ok: true, text: t('Saved to the keyboard.')});
    } catch (e) {
      setMessage({
        ok: false,
        text: t('Could not save to the keyboard. Please check the values and try again.'),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <SpanOverflowCell>
      <DebugPane>
        <Container>
          <PaneTitle>{t('For testing phase only')}</PaneTitle>
          <NarrowRow>
            <Label>{t('Screen-saver Timeout')}</Label>
            <Detail>
              <NumberInput
                type="number"
                min={MIN_MINUTES}
                max={MAX_MINUTES}
                step={1}
                placeholder={String(MIN_MINUTES)}
                disabled={!supported || saving}
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
              />
              <Unit>{t('min')}</Unit>
            </Detail>
          </NarrowRow>
          <NarrowRow>
            <Label>{t('Dial Setting Hold')}</Label>
            <Detail>
              <AccentSelect
                {...({width: 120} as object)}
                placeholder={t('Select')}
                isDisabled={!supported || saving}
                value={
                  holdOptions.find((o) => o.value === dialHold) ?? null
                }
                options={holdOptions}
                onChange={(option: any) => {
                  if (option) {
                    setDialHold(option.value);
                  }
                }}
              />
              <Unit />
            </Detail>
          </NarrowRow>
          <SaveRow>
            <AccentButton
              disabled={!supported || !valid || saving}
              onClick={save}
            >
              {t('Save')}
            </AccentButton>
          </SaveRow>
          <Messages>
            {!supported && (
              <Label>{t('This keyboard does not support these settings yet.')}</Label>
            )}
            {message &&
              (message.ok ? (
                <SuccessMessage>{message.text}</SuccessMessage>
              ) : (
                <ErrorMessage>{message.text}</ErrorMessage>
              ))}
          </Messages>
        </Container>
      </DebugPane>
    </SpanOverflowCell>
  );
};

export const Title = title;
export const Icon = component;
