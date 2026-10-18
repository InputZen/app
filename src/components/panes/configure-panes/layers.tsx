import {FC, useEffect, useState} from 'react';
import styled from 'styled-components';
import {useTranslation} from 'react-i18next';
import {title, component} from '../../icons/layers';
import {ControlRow, Detail, Label, SpanOverflowCell} from '../grid';
import {CenterPane} from '../pane';
import {AccentButton} from '../../inputs/accent-button';
import TextInput from '../../inputs/text-input';
import {useAppSelector} from 'src/store/hooks';
import {getSelectedConnectedDevice} from 'src/store/devicesSlice';
import {getNumberOfLayers} from 'src/store/keymapSlice';
import {loadLayerNames, saveLayerNames} from 'src/utils/layer-names';

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

const LayerNumber = styled.span`
  display: inline-block;
  min-width: 40px;
  color: var(--color_label-highlighted);
  font-variant-numeric: tabular-nums;
`;

const DefaultName = styled.span`
  font-style: italic;
`;

const Buttons = styled(Detail)`
  column-gap: 10px;
`;

const NameInput = styled(TextInput)`
  margin-bottom: 0;
  width: 260px;
`;

type LayerRowProps = {
  index: number;
  name: string | undefined;
  onRename: (name: string) => void;
};

const LayerRow: FC<LayerRowProps> = ({index, name, onRename}) => {
  const {t} = useTranslation();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const startEdit = () => {
    setDraft(name ?? '');
    setEditing(true);
  };
  const commit = () => {
    onRename(draft.trim());
    setEditing(false);
  };

  return (
    <ControlRow>
      <Label>
        <LayerNumber>{index}</LayerNumber>
        {editing ? (
          <NameInput
            autoFocus
            value={draft}
            maxLength={32}
            placeholder={`${t('Layer')} ${index}`}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit();
              if (e.key === 'Escape') setEditing(false);
            }}
          />
        ) : name ? (
          name
        ) : (
          <DefaultName>{`${t('Layer')} ${index}`}</DefaultName>
        )}
      </Label>
      <Buttons>
        {editing ? (
          <>
            <AccentButton onClick={commit}>{t('Save')}</AccentButton>
            <AccentButton onClick={() => setEditing(false)}>
              {t('Cancel')}
            </AccentButton>
          </>
        ) : (
          <>
            <AccentButton onClick={startEdit}>{t('Edit name')}</AccentButton>
            <AccentButton disabled title={t('Coming soon')}>
              {t('Edit icon')}
            </AccentButton>
          </>
        )}
      </Buttons>
    </ControlRow>
  );
};

export const Pane: FC = () => {
  const {t} = useTranslation();
  const device = useAppSelector(getSelectedConnectedDevice);
  const numberOfLayers = useAppSelector(getNumberOfLayers);
  const vendorProductId = device?.vendorProductId;

  const [names, setNames] = useState<Record<string, string>>({});
  useEffect(() => {
    setNames(
      vendorProductId === undefined ? {} : loadLayerNames(vendorProductId),
    );
  }, [vendorProductId]);

  const rename = (index: number, name: string) => {
    if (vendorProductId === undefined) return;
    const next = {...names};
    if (name) next[index] = name;
    else delete next[index];
    setNames(next);
    saveLayerNames(vendorProductId, next);
  };

  return (
    <SpanOverflowCell>
      <LayersPane>
        <Container>
          {numberOfLayers === 0 ? (
            <ControlRow>
              <Label>{t('No layers found on this keyboard.')}</Label>
            </ControlRow>
          ) : (
            new Array(numberOfLayers)
              .fill(0)
              .map((_, idx) => (
                <LayerRow
                  key={idx}
                  index={idx}
                  name={names[idx]}
                  onRename={(name) => rename(idx, name)}
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
