export function offsetToTimestamp(
  offset: number,
  now: Date | number = Date.now()
): number {
  return round(now.valueOf() + offset).valueOf();
}

export function round(date: Date | number): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}
