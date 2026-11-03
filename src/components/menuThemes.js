export const MENU_THEMES = {
  dull: { allowPictures: false, colorFromTitle: false },
  win8: { allowPictures: true, colorFromTitle: true }
};

export function normalizeMenuTheme(value) {
  if (value === "theme-1") return "dull";
  if (value === "theme-2") return "win8";
  return Object.hasOwn(MENU_THEMES, value) ? value : "dull";
}

export function resolveTileVariant(variant, allowPictures, pictureAvailable) {
  const tiny = variant === "icon-tiny" || variant === "picture-tiny";
  return `${allowPictures && pictureAvailable ? "picture" : "icon"}${tiny ? "-tiny" : ""}`;
}
