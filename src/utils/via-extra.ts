// via_extra: keyboard extension protocol between this web app and the BuildBox firmware.
// The single source of truth is D:\Claude_Software\buildbox-protocol\PROTOCOL.md
// (draft v1). Change that spec first, then update the constants here.

export const VIA_EXTRA_CMD = 0xe0;
export const VIA_EXTRA_VERSION = 1;

export const ViaExtraOp = {
  GET_CAPS: 0x01,
  GET_LAYER_NAME: 0x10,
  SET_LAYER_NAME: 0x11,
  GET_LAYER_ICON: 0x20,
  SET_LAYER_ICON: 0x21,
  SAVE: 0x30,
  GET_STATE: 0x41,
  GET_SETTING: 0x50,
  SET_SETTING: 0x51,
} as const;

// Device settings (PROTOCOL.md section 4a). Values are unsigned 16-bit, big-endian.
export const ViaExtraSetting = {
  SCREENSAVER_IDLE_MINUTES: 0x01,
  DIAL_SETTING_HOLD_MS: 0x02,
} as const;

// Values the keyboard accepts for DIAL_SETTING_HOLD_MS
export const DIAL_SETTING_HOLD_OPTIONS_MS = [1000, 1500, 2000, 2500, 3000];

export enum ViaExtraStatus {
  OK = 0x00,
  UNKNOWN_OP = 0x01,
  BAD_ARGS = 0x02,
  BUSY = 0x03,
  UNSUPPORTED_VERSION = 0x04,
  STORAGE_ERROR = 0x05,
}

// Bits of the `features` byte returned by GET_CAPS
const FEATURE_NAMES = 0x01;
const FEATURE_ICONS = 0x02;
const FEATURE_STATE = 0x04;
const FEATURE_SETTINGS = 0x10;

// Built-in layer names of the BuildBox firmware (PROTOCOL.md, Appendix B).
// The protocol does not say whether a name is custom, so the UI compares the
// name it reads against this list to tell a custom name from the built-in one.
export const BUILTIN_LAYER_NAMES = ['Default', 'Media', 'Mouse', 'RGB LED'];

// The name field on the wire is always 16 bytes, whatever name_len is.
export const VIA_EXTRA_NAME_FIELD_LEN = 16;

export type ViaExtraCaps = {
  firmwareVersion: number;
  hasNames: boolean;
  hasIcons: boolean;
  hasState: boolean;
  hasSettings: boolean;
  layerCount: number;
  nameLen: number;
  iconCount: number;
};

export class ViaExtraError extends Error {
  status: number;
  constructor(op: number, status: number) {
    super(
      `via_extra operation 0x${op.toString(16)} failed: ${
        ViaExtraStatus[status] ?? `status 0x${status.toString(16)}`
      }`,
    );
    this.status = status;
  }
}

export const parseCaps = (data: number[]): ViaExtraCaps => {
  const [firmwareVersion, features, layerCount, nameLen, iconCount] = data;
  return {
    firmwareVersion,
    hasNames: (features & FEATURE_NAMES) !== 0,
    hasIcons: (features & FEATURE_ICONS) !== 0,
    hasState: (features & FEATURE_STATE) !== 0,
    hasSettings: (features & FEATURE_SETTINGS) !== 0,
    layerCount,
    nameLen: Math.min(nameLen, VIA_EXTRA_NAME_FIELD_LEN),
    iconCount,
  };
};

// Names are printable ASCII only (0x20..0x7E)
export const sanitizeName = (name: string) => name.replace(/[^\x20-\x7e]/g, '');

export const encodeName = (name: string): number[] => {
  if (name.length > VIA_EXTRA_NAME_FIELD_LEN || sanitizeName(name) !== name) {
    throw new Error('Layer name must be printable ASCII, 16 characters max');
  }
  const bytes = new Array<number>(VIA_EXTRA_NAME_FIELD_LEN).fill(0);
  for (let i = 0; i < name.length; i++) {
    bytes[i] = name.charCodeAt(i);
  }
  return bytes;
};

// data = [len, chars x 16]
export const decodeName = (data: number[]): string => {
  const len = Math.min(data[0], VIA_EXTRA_NAME_FIELD_LEN);
  return String.fromCharCode(...data.slice(1, 1 + len));
};
