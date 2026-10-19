import {createSlice, PayloadAction} from '@reduxjs/toolkit';
import type {KeyboardAPI} from 'src/utils/keyboard-api';
import {
  ViaExtraSetting,
  type ViaExtraCaps,
} from 'src/utils/via-extra';
import type {ConnectedDevice} from '../types/types';
import {getSelectedKeyboardAPI} from './devicesSlice';
import type {AppThunk, RootState} from './index';

// State of the via_extra keyboard extension (layer names/icons stored on the keyboard).
// `caps` is null when the keyboard does not support via_extra.
type ViaExtraState = {
  caps: ViaExtraCaps | null;
  layerNames: string[];
  layerIcons: number[];
  macroNames: string[];
  // layer the keyboard is currently on (highest active layer), null if unknown
  activeLayer: number | null;
  // bitmask of all active layers
  layerMask: number;
  // device settings, null until read from the keyboard
  screensaverMinutes: number | null;
  dialHoldMs: number | null;
};

const viaExtraInitialState: ViaExtraState = {
  caps: null,
  layerNames: [],
  layerIcons: [],
  macroNames: [],
  activeLayer: null,
  layerMask: 0,
  screensaverMinutes: null,
  dialHoldMs: null,
};

const viaExtraSlice = createSlice({
  name: 'viaExtra',
  initialState: viaExtraInitialState,
  reducers: {
    resetViaExtra: () => viaExtraInitialState,
    loadViaExtraSuccess: (
      state,
      action: PayloadAction<{
        caps: ViaExtraCaps;
        layerNames: string[];
        layerIcons: number[];
      }>,
    ) => {
      state.caps = action.payload.caps;
      state.layerNames = action.payload.layerNames;
      state.layerIcons = action.payload.layerIcons;
    },
    setLayerNameSuccess: (
      state,
      action: PayloadAction<{layer: number; name: string}>,
    ) => {
      state.layerNames[action.payload.layer] = action.payload.name;
    },
    setMacroNamesSuccess: (state, action: PayloadAction<string[]>) => {
      state.macroNames = action.payload;
    },
    setMacroNameSuccess: (
      state,
      action: PayloadAction<{macro: number; name: string}>,
    ) => {
      state.macroNames[action.payload.macro] = action.payload.name;
    },
    setLayerIconSuccess: (
      state,
      action: PayloadAction<{layer: number; icon: number}>,
    ) => {
      state.layerIcons[action.payload.layer] = action.payload.icon;
    },
    setViaExtraSettingsSuccess: (
      state,
      action: PayloadAction<{screensaverMinutes: number; dialHoldMs: number}>,
    ) => {
      state.screensaverMinutes = action.payload.screensaverMinutes;
      state.dialHoldMs = action.payload.dialHoldMs;
    },
    setViaExtraStateSuccess: (
      state,
      action: PayloadAction<{activeLayer: number; layerMask: number}>,
    ) => {
      state.activeLayer = action.payload.activeLayer;
      state.layerMask = action.payload.layerMask;
    },
  },
});

export const {
  resetViaExtra,
  loadViaExtraSuccess,
  setLayerNameSuccess,
  setLayerIconSuccess,
  setMacroNamesSuccess,
  setMacroNameSuccess,
  setViaExtraStateSuccess,
  setViaExtraSettingsSuccess,
} = viaExtraSlice.actions;

export default viaExtraSlice.reducer;

const readSettings = async (api: KeyboardAPI) => ({
  screensaverMinutes: await api.getViaExtraSetting(
    ViaExtraSetting.SCREENSAVER_IDLE_MINUTES,
  ),
  dialHoldMs: await api.getViaExtraSetting(ViaExtraSetting.DIAL_SETTING_HOLD_MS),
});

// Never throws: a keyboard without via_extra (or a failed read) just leaves via_extra off,
// and the app falls back to its browser-only layer names.
export const loadViaExtra =
  (_connectedDevice: ConnectedDevice): AppThunk =>
  async (dispatch, getState) => {
    dispatch(resetViaExtra());
    try {
      const api = getSelectedKeyboardAPI(getState()) as KeyboardAPI;
      const caps = await api.getViaExtraCaps();
      if (!caps) {
        return;
      }
      const layerNames: string[] = [];
      const layerIcons: number[] = [];
      for (let layer = 0; layer < caps.layerCount; layer++) {
        if (caps.hasNames) {
          layerNames[layer] = await api.getLayerName(layer);
        }
        if (caps.hasIcons) {
          layerIcons[layer] = await api.getLayerIcon(layer);
        }
      }
      dispatch(loadViaExtraSuccess({caps, layerNames, layerIcons}));
      if (caps.hasMacroNames) {
        try {
          const macroNames: string[] = [];
          for (let macro = 0; macro < caps.macroCount; macro++) {
            macroNames[macro] = await api.getMacroName(macro);
          }
          dispatch(setMacroNamesSuccess(macroNames));
        } catch (e) {
          // macro names stay unknown; the rest still works
        }
      }
      if (caps.hasSettings) {
        try {
          dispatch(setViaExtraSettingsSuccess(await readSettings(api)));
        } catch (e) {
          // settings stay unknown; names and icons still work
        }
      }
    } catch (e) {
      dispatch(resetViaExtra());
    }
  };

// Writes the name to the keyboard, saves it, then reads it back so the UI shows
// what the keyboard really stores (an empty name returns the built-in name).
// Rejects if the keyboard refuses or the connection fails.
export const renameLayer =
  (layer: number, name: string): AppThunk<Promise<void>> =>
  async (dispatch, getState) => {
    const api = getSelectedKeyboardAPI(getState()) as KeyboardAPI;
    await api.setLayerName(layer, name);
    await api.saveViaExtra();
    const stored = await api.getLayerName(layer);
    dispatch(setLayerNameSuccess({layer, name: stored}));
  };

// Writes a macro's name to the keyboard, saves it, then reads it back.
// An empty name clears it. Rejects if the keyboard refuses or the connection fails.
export const renameMacro =
  (macro: number, name: string): AppThunk<Promise<void>> =>
  async (dispatch, getState) => {
    const api = getSelectedKeyboardAPI(getState()) as KeyboardAPI;
    await api.setMacroName(macro, name);
    await api.saveViaExtra();
    const stored = await api.getMacroName(macro);
    dispatch(setMacroNameSuccess({macro, name: stored}));
  };

// icon 0 restores the layer's default icon. Reads back the icon the keyboard
// really uses, since the default depends on the layer.
export const changeLayerIcon =
  (layer: number, icon: number): AppThunk<Promise<void>> =>
  async (dispatch, getState) => {
    const api = getSelectedKeyboardAPI(getState()) as KeyboardAPI;
    await api.setLayerIcon(layer, icon);
    await api.saveViaExtra();
    const stored = await api.getLayerIcon(layer);
    dispatch(setLayerIconSuccess({layer, icon: stored}));
  };

// Sends the settings to the keyboard, saves them, then reads them back so the
// screen shows what the keyboard really stores. `dialHoldMs` is null when the hold
// time must stay as it is (the keyboard can hold a value that SET refuses).
// Rejects if the keyboard refuses a value or the connection fails.
export const saveViaExtraSettings =
  (
    screensaverMinutes: number,
    dialHoldMs: number | null,
  ): AppThunk<Promise<void>> =>
  async (dispatch, getState) => {
    const api = getSelectedKeyboardAPI(getState()) as KeyboardAPI;
    await api.setViaExtraSetting(
      ViaExtraSetting.SCREENSAVER_IDLE_MINUTES,
      screensaverMinutes,
    );
    if (dialHoldMs !== null) {
      await api.setViaExtraSetting(
        ViaExtraSetting.DIAL_SETTING_HOLD_MS,
        dialHoldMs,
      );
    }
    await api.saveViaExtra();
    dispatch(setViaExtraSettingsSuccess(await readSettings(api)));
  };

// Restores the layer's built-in name and default icon, saves, and reads both back.
export const resetLayer =
  (layer: number): AppThunk<Promise<void>> =>
  async (dispatch, getState) => {
    const state = getState();
    const caps = state.viaExtra.caps;
    const api = getSelectedKeyboardAPI(state) as KeyboardAPI;
    if (caps?.hasNames) {
      await api.setLayerName(layer, '');
    }
    if (caps?.hasIcons) {
      await api.setLayerIcon(layer, 0);
    }
    await api.saveViaExtra();
    if (caps?.hasNames) {
      const name = await api.getLayerName(layer);
      dispatch(setLayerNameSuccess({layer, name}));
    }
    if (caps?.hasIcons) {
      const icon = await api.getLayerIcon(layer);
      dispatch(setLayerIconSuccess({layer, icon}));
    }
  };

// Reads which layer the keyboard is on. Errors are ignored: a missed poll is harmless.
export const pollViaExtraState =
  (): AppThunk<Promise<void>> => async (dispatch, getState) => {
    const state = getState();
    if (!state.viaExtra.caps?.hasState) {
      return;
    }
    try {
      const api = getSelectedKeyboardAPI(state) as KeyboardAPI;
      dispatch(setViaExtraStateSuccess(await api.getViaExtraState()));
    } catch (e) {
      // ignore
    }
  };

export const getViaExtraCaps = (state: RootState) => state.viaExtra.caps;
export const getViaExtraLayerNames = (state: RootState) => state.viaExtra.layerNames;
export const getViaExtraLayerIcons = (state: RootState) => state.viaExtra.layerIcons;
export const getViaExtraMacroNames = (state: RootState) =>
  state.viaExtra.macroNames;
export const getScreensaverMinutes = (state: RootState) =>
  state.viaExtra.screensaverMinutes;
export const getDialHoldMs = (state: RootState) => state.viaExtra.dialHoldMs;
export const getViaExtraActiveLayer = (state: RootState) => state.viaExtra.activeLayer;
export const getViaExtraLayerMask = (state: RootState) => state.viaExtra.layerMask;
