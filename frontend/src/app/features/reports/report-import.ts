import type { TimeEntryImport } from '../../core/models/time-entry-import.model';

export type { TimeEntryImport } from '../../core/models/time-entry-import.model';

export const MAX_IMPORT_ROWS = 5000;
export const MAX_IMPORT_FILE_BYTES = 5 * 1024 * 1024;

export function parseTimeEntryCsv(csv: string): TimeEntryImport[] {
  const rows = parseCsvRows(csv);
  if (rows.length < 2) {
    throw new Error('The CSV must include a header row and at least one time entry.');
  }
  if (rows.length - 1 > MAX_IMPORT_ROWS) {
    throw new Error(`A CSV can contain at most ${MAX_IMPORT_ROWS} entries.`);
  }

  const headers = rows[0].map((header) =>
    header
      .trim()
      .replace(/^\uFEFF/, '')
      .toLowerCase(),
  );
  const indexes = new Map<string, number>();
  headers.forEach((header, index) => {
    if (header && indexes.has(header)) {
      throw new Error(`The CSV contains a duplicate "${header}" column.`);
    }
    if (header) {
      indexes.set(header, index);
    }
  });

  const getIndex = (header: string) => indexes.get(header.toLowerCase());
  const dateIndex = getIndex('date');
  const startIndex = getIndex('start time');
  const endIndex = getIndex('end time');
  const startIsoIndex = getIndex('start timestamp (iso)');
  const endIsoIndex = getIndex('end timestamp (iso)');
  const projectIndex = getIndex('project');
  const taskIndex = getIndex('task');
  const projectNumberIndex = getIndex('project number');
  const descriptionIndex = getIndex('description');
  const billableIndex = getIndex('billable');

  if (projectIndex === undefined || taskIndex === undefined) {
    throw new Error('The CSV must include the Project and Task columns.');
  }
  const hasIsoTimestamps = startIsoIndex !== undefined && endIsoIndex !== undefined;
  if (
    !hasIsoTimestamps &&
    (dateIndex === undefined || startIndex === undefined || endIndex === undefined)
  ) {
    throw new Error(
      'The CSV must include Date, Start time and End time columns, or both ISO timestamp columns.',
    );
  }
  if ((startIsoIndex === undefined) !== (endIsoIndex === undefined)) {
    throw new Error('The CSV must include both ISO timestamp columns.');
  }

  const entries: TimeEntryImport[] = [];
  for (const [index, row] of rows.slice(1).entries()) {
    if (row.every((cell) => !cell.trim())) {
      continue;
    }
    const rowNumber = index + 2;
    const projectName = cellAt(row, projectIndex).trim();
    const taskName = cellAt(row, taskIndex).trim();
    if (!projectName || !taskName) {
      throw new Error(`CSV row ${rowNumber} must include a Project and Task.`);
    }

    const startTime = hasIsoTimestamps
      ? parseIsoTimestamp(cellAt(row, startIsoIndex!), rowNumber, 'start')
      : parseLocalTimestamp(cellAt(row, dateIndex!), cellAt(row, startIndex!), rowNumber, 'start');
    const endTime = hasIsoTimestamps
      ? parseIsoTimestamp(cellAt(row, endIsoIndex!), rowNumber, 'end')
      : parseLocalTimestamp(cellAt(row, dateIndex!), cellAt(row, endIndex!), rowNumber, 'end');
    if (new Date(endTime) <= new Date(startTime)) {
      throw new Error(`CSV row ${rowNumber} must have an end time after its start time.`);
    }

    entries.push({
      startTime,
      endTime,
      projectNumber:
        projectNumberIndex === undefined ? null : cellAt(row, projectNumberIndex).trim() || null,
      projectName,
      taskName,
      description: descriptionIndex === undefined ? '' : cellAt(row, descriptionIndex),
      isBillable:
        billableIndex === undefined ? true : parseBillable(cellAt(row, billableIndex), rowNumber),
    });
  }

  if (entries.length === 0) {
    throw new Error('The CSV does not contain any time entries.');
  }
  return entries;
}

function parseCsvRows(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  let quoteClosed = false;

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    if (inQuotes) {
      if (character === '"') {
        if (csv[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          inQuotes = false;
          quoteClosed = true;
        }
      } else {
        cell += character;
      }
      continue;
    }

    if (quoteClosed && character !== ',' && character !== '\r' && character !== '\n') {
      throw new Error('The CSV contains invalid characters after a quoted field.');
    }
    if (character === '"') {
      if (cell) {
        throw new Error('The CSV contains an unexpected quote.');
      }
      inQuotes = true;
    } else if (character === ',') {
      row.push(cell);
      cell = '';
      quoteClosed = false;
    } else if (character === '\r' || character === '\n') {
      row.push(cell);
      if (row.some((value) => value.trim())) {
        rows.push(row);
      }
      row = [];
      cell = '';
      quoteClosed = false;
      if (character === '\r' && csv[index + 1] === '\n') {
        index += 1;
      }
    } else {
      cell += character;
    }
  }

  if (inQuotes) {
    throw new Error('The CSV contains an unclosed quoted field.');
  }
  if (cell || row.length) {
    row.push(cell);
    if (row.some((value) => value.trim())) {
      rows.push(row);
    }
  }
  return rows;
}

function cellAt(row: string[], index: number): string {
  return row[index] ?? '';
}

function parseIsoTimestamp(value: string, rowNumber: number, field: string): string {
  const timestamp = value.trim();
  const parts =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/i.exec(
      timestamp,
    );
  if (!parts || !isValidCalendarDate(parts)) {
    throw new Error(`CSV row ${rowNumber} has an invalid ISO ${field} timestamp.`);
  }
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`CSV row ${rowNumber} has an invalid ISO ${field} timestamp.`);
  }
  return date.toISOString();
}

function isValidCalendarDate(parts: RegExpExecArray): boolean {
  const [, yearText, monthText, dayText, hourText, minuteText, secondText] = parts;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(hour, minute, second, 0);
  return (
    year > 0 &&
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day &&
    date.getUTCHours() === hour &&
    date.getUTCMinutes() === minute &&
    date.getUTCSeconds() === second
  );
}

function parseLocalTimestamp(
  dateValue: string,
  timeValue: string,
  rowNumber: number,
  field: string,
): string {
  const dateParts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue.trim());
  const timeParts = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(timeValue.trim());
  if (!dateParts || !timeParts) {
    throw new Error(`CSV row ${rowNumber} has an invalid local ${field} date or time.`);
  }

  const [, yearText, monthText, dayText] = dateParts;
  const [, hourText, minuteText, secondText = '0'] = timeParts;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const date = new Date(0);
  date.setFullYear(year, month - 1, day);
  date.setHours(hour, minute, second, 0);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute ||
    date.getSeconds() !== second
  ) {
    throw new Error(`CSV row ${rowNumber} has an invalid local ${field} date or time.`);
  }
  return date.toISOString();
}

function parseBillable(value: string, rowNumber: number): boolean {
  switch (value.trim().toLowerCase()) {
    case 'yes':
    case 'true':
    case '1':
      return true;
    case 'no':
    case 'false':
    case '0':
      return false;
    default:
      throw new Error(`CSV row ${rowNumber} must have Yes or No in the Billable column.`);
  }
}
