export interface LegalDeadline {
  title: string;
  date: string; // YYYY-MM-DD
  description: string;
}

export function generateICS(events: LegalDeadline[]): string {
  // RFC 5545 iCalendar standard
  let icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//LegalEase//Calendar Integration//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH'
  ].join('\r\n') + '\r\n';

  const now = new Date();
  const dtstamp = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  events.forEach((event, index) => {
    // Basic date parsing (YYYY-MM-DD)
    const [year, month, day] = event.date.split('-');
    
    // If the date is invalid or missing, we skip it
    if (!year || !month || !day) return;

    // Start date (all day event)
    const dtstart = `${year}${month}${day}`;
    
    // End date is start date + 1 day for all-day events in ICS standard
    const startDateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    startDateObj.setDate(startDateObj.getDate() + 1);
    const endYear = startDateObj.getFullYear();
    const endMonth = String(startDateObj.getMonth() + 1).padStart(2, '0');
    const endDay = String(startDateObj.getDate()).padStart(2, '0');
    const dtend = `${endYear}${endMonth}${endDay}`;

    // Unique ID for the event
    const uid = `legalease-${dtstamp}-${index}@legalease.app`;

    // Escape special characters in description and title
    const description = event.description.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
    const summary = event.title.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

    icsContent += [
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;VALUE=DATE:${dtstart}`,
      `DTEND;VALUE=DATE:${dtend}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${description}`,
      'STATUS:CONFIRMED',
      'END:VEVENT'
    ].join('\r\n') + '\r\n';
  });

  icsContent += 'END:VCALENDAR';
  return icsContent;
}
