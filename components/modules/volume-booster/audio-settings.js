export const BANDS = [60, 170, 350, 1000, 3500, 10000];
export const PRESETS = {
  flat: [0, 0, 0, 0, 0, 0],
  bass: [6, 4, 2, 0, -1, 0],
  vocal: [-2, -1, 1, 4, 3, 0],
  rock: [4, 2, -1, 1, 3, 4],
  electronic: [5, 3, 0, -2, 3, 5]
};

export function normalizeSettings(settings = {}) {
  const numericGain = Number(settings.gain);
  return {
    gain: Number.isFinite(numericGain) ? Math.min(6, Math.max(0, numericGain)) : 1,
    eq: BANDS.map((_, i) => {
      const value = Number(settings.eq?.[i]);
      return Number.isFinite(value) ? Math.min(12, Math.max(-12, value)) : 0;
    }),
    preset: Object.hasOwn(PRESETS, settings.preset) ? settings.preset : "custom"
  };
}
