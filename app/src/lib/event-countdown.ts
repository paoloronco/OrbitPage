const getTimezoneOffset = (date: Date, timeZone: string) => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value]),
  );
  return Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  ) - date.getTime();
};

export const eventDateTime = (date: string, time = '00:00', timeZone = 'UTC') => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;

  const wallClockUtc = Date.UTC(year, month - 1, day, hour, minute);
  try {
    let instant = new Date(wallClockUtc);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      instant = new Date(wallClockUtc - getTimezoneOffset(instant, timeZone));
    }
    return Number.isNaN(instant.getTime()) ? null : instant;
  } catch {
    const fallback = new Date(`${date}T${time}:00Z`);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }
};

export interface CountdownParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export const countdownParts = (target: Date | null, now = new Date()): CountdownParts | null => {
  if (!target) return null;
  const remainingSeconds = Math.floor((target.getTime() - now.getTime()) / 1000);
  if (remainingSeconds <= 0) return null;
  return {
    days: Math.floor(remainingSeconds / 86_400),
    hours: Math.floor((remainingSeconds % 86_400) / 3_600),
    minutes: Math.floor((remainingSeconds % 3_600) / 60),
    seconds: remainingSeconds % 60,
  };
};
