export const IST_TIMEZONE = 'Asia/Kolkata';

/**
 * Formats an ISO string (or Date object/epoch) into Indian Standard Time (IST) full date & time.
 * Example output: "30 Sep 2026, 12:20 PM IST"
 */
export function formatIstDateTime(isoString?: string | number | Date | null, fallback: string = 'Awaiting Observation'): string {
  if (!isoString) return fallback;
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return fallback;

    const dateParts = new Intl.DateTimeFormat('en-GB', {
      timeZone: IST_TIMEZONE,
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(d);

    const timeStr = new Intl.DateTimeFormat('en-US', {
      timeZone: IST_TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(d);

    const cleanDate = dateParts.replace(/Sept/g, 'Sep').replace(/-/g, ' ');
    return `${cleanDate}, ${timeStr} IST`;
  } catch {
    return fallback;
  }
}

/**
 * Formats an ISO string into IST time only.
 * Example output: "12:50 PM IST"
 */
export function formatIstTime(isoString?: string | number | Date | null, fallback: string = '--:-- IST'): string {
  if (!isoString) return fallback;
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return fallback;

    const timeStr = new Intl.DateTimeFormat('en-US', {
      timeZone: IST_TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(d);

    return `${timeStr} IST`;
  } catch {
    return fallback;
  }
}

/**
 * Formats forecast validity window in IST.
 * Example output: "12:50 PM IST → 02:20 PM IST"
 */
export function formatIstValidityWindow(startIso?: string | null, endIso?: string | null): string {
  const startStr = formatIstTime(startIso, '+30m');
  const endStr = formatIstTime(endIso, '+120m');
  return `${startStr} → ${endStr}`;
}
