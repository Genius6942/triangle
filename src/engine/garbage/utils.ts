export const columnWidth = (width: number, garbageHoleSize: number) => {
  return Math.max(0, width - (garbageHoleSize - 1));
};
