interface SchedulableLink {
  isActive?: boolean;
  status?: 'draft' | 'live' | 'expired';
  startDate?: string;
  startTime?: string;
  endDate?: string;
  endTime?: string;
  timezone?: string;
}

const parseTimeToMinutes = (value?: string) => {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) return null;
  const [hours, minutes] = value.split(':').map(Number);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
};

const getDatePartsForTimezone = (date: Date, timezone?: string) => {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone || 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = Object.fromEntries(
      formatter.formatToParts(date).map((part) => [part.type, part.value])
    );
    const hour = Number(parts.hour === '24' ? '00' : parts.hour);
    const minute = Number(parts.minute);
    return {
      date: `${parts.year}-${parts.month}-${parts.day}`,
      minutes: hour * 60 + minute,
    };
  } catch {
    return {
      date: date.toISOString().slice(0, 10),
      minutes: date.getUTCHours() * 60 + date.getUTCMinutes(),
    };
  }
};

export function isLinkVisibleNow(link: SchedulableLink, now = new Date()) {
  if (link.isActive === false) return false;
  if ((link.status || 'live') !== 'live') return false;

  const { date: currentDate, minutes: currentMinutes } = getDatePartsForTimezone(now, link.timezone || 'UTC');
  const startMinutes = parseTimeToMinutes(link.startTime);
  const endMinutes = parseTimeToMinutes(link.endTime);

  if (link.startDate && link.startDate > currentDate) return false;
  if (link.endDate && link.endDate < currentDate) return false;
  if ((!link.startDate || link.startDate <= currentDate) && startMinutes != null && startMinutes > currentMinutes) return false;
  if ((!link.endDate || link.endDate >= currentDate) && endMinutes != null && endMinutes < currentMinutes) return false;

  return true;
}
