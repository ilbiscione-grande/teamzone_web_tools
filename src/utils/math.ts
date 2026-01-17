export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const round = (value: number, decimals = 2) => {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
};
