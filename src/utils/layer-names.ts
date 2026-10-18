// Layer names are not part of the VIA protocol or the keyboard definitions,
// so they are stored in this browser, per keyboard model (vendorProductId).
// Shape in localStorage: {"0": "Base", "1": "Fn", ...}
type LayerNames = Record<string, string>;

const storageKey = (vendorProductId: number) =>
  `via.layerNames.${vendorProductId}`;

export const loadLayerNames = (vendorProductId: number): LayerNames => {
  try {
    const raw = localStorage.getItem(storageKey(vendorProductId));
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

export const saveLayerNames = (vendorProductId: number, names: LayerNames) => {
  try {
    localStorage.setItem(storageKey(vendorProductId), JSON.stringify(names));
  } catch {
    // storage unavailable (private mode, quota): names just won't persist
  }
};
