const datetimeLocalPattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

function getTimeZoneOffsetMilliseconds(timeZone: string, instant: Date) {
  try {
    const timeZoneName = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'longOffset',
    })
      .formatToParts(instant)
      .find((part) => part.type === 'timeZoneName')?.value;
    if (timeZoneName === 'GMT') return 0;

    const match = timeZoneName?.match(/^GMT([+-])(\d{2}):(\d{2})$/);
    if (!match) return null;

    const [, sign, hours, minutes] = match;
    const offset = (Number(hours) * 60 + Number(minutes)) * 60_000;
    return sign === '+' ? offset : -offset;
  } catch {
    return null;
  }
}

/** Converts a datetime-local wall clock in the launch policy zone to UTC. */
export function quizDatetimeLocalToIso(
  value: string,
  timeZone: string
): string | null {
  const match = value.match(datetimeLocalPattern);
  if (!match) return null;

  const [, year, month, day, hours, minutes] = match;
  const wallClockMilliseconds = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hours),
    Number(minutes)
  );
  const wallClock = new Date(wallClockMilliseconds);
  if (
    wallClock.getUTCFullYear() !== Number(year) ||
    wallClock.getUTCMonth() !== Number(month) - 1 ||
    wallClock.getUTCDate() !== Number(day) ||
    wallClock.getUTCHours() !== Number(hours) ||
    wallClock.getUTCMinutes() !== Number(minutes)
  ) {
    return null;
  }

  const offset = getTimeZoneOffsetMilliseconds(timeZone, wallClock);
  return offset === null
    ? null
    : new Date(wallClockMilliseconds - offset).toISOString();
}
