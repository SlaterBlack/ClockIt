import { strToU8, zipSync } from 'fflate';
import { PAY_TYPES, type PayType } from '../../core/models/pay-type.model';
import type { TimeEntry } from '../../core/models/time-entry.model';
import type { ToilReportTotals, ToilSettingsResponse } from '../../core/models/toil.model';
import { buildReportRows, entryDurationSeconds, entriesInDateRange } from './report-export';

const XLSX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const PAY_TYPE_SUMMARY_ORDER: PayType[] = [
  'hourly',
  'public-holiday',
  'annual-leave',
  'sick-leave',
  'unpaid',
];

export function buildTimeReportWorkbook(
  allEntries: TimeEntry[],
  now: number,
  startDate: string,
  endDate: string,
  toilSettings?: ToilSettingsResponse,
): Blob {
  const entries = entriesInDateRange(allEntries, startDate, endDate);
  const userTotals = new Map<
    string,
    { id: string; name: string; seconds: Record<PayType, number> }
  >();
  for (const entry of entries) {
    const user = userTotals.get(entry.userId) ?? {
      id: entry.userId,
      name: entry.user?.name ?? '',
      seconds: Object.fromEntries(PAY_TYPES.map((type) => [type.value, 0])) as Record<
        PayType,
        number
      >,
    };
    const payType = entry.task?.payType ?? 'hourly';
    user.seconds[payType] += entryDurationSeconds(entry, now);
    userTotals.set(entry.userId, user);
  }

  const reportStart =
    startDate ||
    earliestEntryDate(entries, toilSettings?.usages.map((usage) => usage.usageDate) ?? []);
  const reportEnd =
    endDate || latestEntryDate(entries, toilSettings?.usages.map((usage) => usage.usageDate) ?? []);
  if (toilSettings) {
    for (const usage of toilSettings.usages) {
      if (
        usage.usageDate < reportStart ||
        usage.usageDate > reportEnd ||
        userTotals.has(usage.userId)
      ) {
        continue;
      }
      const user = toilSettings.users.find((item) => item.id === usage.userId);
      if (user) {
        userTotals.set(user.id, {
          id: user.id,
          name: user.name,
          seconds: Object.fromEntries(PAY_TYPES.map((type) => [type.value, 0])) as Record<
            PayType,
            number
          >,
        });
      }
    }
  }
  const sortedUsers = [...userTotals.values()].sort((a, b) => a.name.localeCompare(b.name));
  const periodTotals = Object.fromEntries(PAY_TYPES.map((type) => [type.value, 0])) as Record<
    PayType,
    number
  >;
  for (const user of sortedUsers) {
    for (const type of PAY_TYPES) {
      periodTotals[type.value] += user.seconds[type.value];
    }
  }
  const toilTotals = toilSettings
    ? calculateToilTotals(entries, userTotals, toilSettings, reportStart, reportEnd, now)
    : null;
  const summaryPayTypes = [...PAY_TYPES].sort(
    (a, b) => PAY_TYPE_SUMMARY_ORDER.indexOf(a.value) - PAY_TYPE_SUMMARY_ORDER.indexOf(b.value),
  );
  const paidPayTypes = PAY_TYPES.filter((type) => type.value !== 'unpaid');
  const totalPaidHours = (seconds: Record<PayType, number>) =>
    paidPayTypes.reduce((total, type) => total + seconds[type.value], 0) / 3600;
  const summaryRows: (string | number)[][] = [
    ['Report period', startDate || 'All dates', endDate || 'All dates'],
    [],
    [
      'Name',
      'Total Paid Hours',
      'TOIL Accrued',
      'TOIL Used',
      ...summaryPayTypes.map((type) => (type.value === 'hourly' ? 'Hourly Wage' : type.label)),
    ],
    ...sortedUsers.map((user) => {
      const toilValues = toilTotals
        ? [toilTotals.accruedHours.get(user.id) ?? 0, toilTotals.usedHours.get(user.id) ?? 0]
        : ['', ''];
      return [
        user.name,
        totalPaidHours(user.seconds),
        ...toilValues,
        ...summaryPayTypes.map((type) => user.seconds[type.value] / 3600),
      ];
    }),
    [
      'Report total',
      totalPaidHours(periodTotals),
      ...(toilTotals
        ? [
            [...toilTotals.accruedHours.values()].reduce((sum, hours) => sum + hours, 0),
            [...toilTotals.usedHours.values()].reduce((sum, hours) => sum + hours, 0),
          ]
        : ['', '']),
      ...summaryPayTypes.map((type) => periodTotals[type.value] / 3600),
    ],
  ];
  const boldRows = [summaryRows.length - 1];
  const detailRows = buildReportRows(entries, now).map((row, rowIndex) => {
    if (rowIndex === 0) {
      return row;
    }
    const hoursColumn = row.length - 1;
    return row.map((value, columnIndex) => (columnIndex === hoursColumn ? Number(value) : value));
  });

  const workbook = zipSync({
    '[Content_Types].xml': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
        '<Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
        '</Types>',
    ),
    '_rels/.rels': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
        '</Relationships>',
    ),
    'xl/workbook.xml': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        '<sheets><sheet name="Page 1 - User Summary" sheetId="1" r:id="rId1"/>' +
        '<sheet name="Page 2 - Entry Details" sheetId="2" r:id="rId2"/></sheets></workbook>',
    ),
    'xl/_rels/workbook.xml.rels': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>' +
        '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
        '</Relationships>',
    ),
    'xl/styles.xml': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
        '<numFmts count="1"><numFmt numFmtId="164" formatCode="0.00"/></numFmts>' +
        '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font>' +
        '<font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
        '<fills count="2"><fill><patternFill patternType="none"/></fill>' +
        '<fill><patternFill patternType="gray125"/></fill></fills>' +
        '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
        '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
        '<cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
        '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
        '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0"/>' +
        '<xf numFmtId="164" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs>' +
        '</styleSheet>',
    ),
    'xl/worksheets/sheet1.xml': strToU8(worksheetXml(summaryRows, [1], boldRows, 2)),
    'xl/worksheets/sheet2.xml': strToU8(worksheetXml(detailRows)),
  });

  return new Blob([workbook], { type: XLSX_MIME_TYPE });
}

function worksheetXml(
  rows: (string | number)[][],
  boldColumns: number[] = [],
  boldRows: number[] = [],
  boldColumnsFromRow = 0,
): string {
  const rowXml = rows
    .map(
      (row, rowIndex) =>
        `<row r="${rowIndex + 1}">${row
          .map((value, columnIndex) =>
            cellXml(
              value,
              `${columnName(columnIndex + 1)}${rowIndex + 1}`,
              (rowIndex >= boldColumnsFromRow && boldColumns.includes(columnIndex)) ||
                boldRows.includes(rowIndex),
            ),
          )
          .join('')}</row>`,
    )
    .join('');
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    `<sheetData>${rowXml}</sheetData></worksheet>`
  );
}

function cellXml(value: string | number, reference: string, bold = false): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `<c r="${reference}" s="${bold ? 3 : 1}"><v>${value}</v></c>`;
  }
  const style = bold ? ' s="2"' : '';
  const text = escapeXml(String(value)).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
  return `<c r="${reference}"${style} t="inlineStr"><is><t xml:space="preserve">${text}</t></is></c>`;
}

function calculateToilTotals(
  entries: TimeEntry[],
  userTotals: Map<string, { id: string; name: string; seconds: Record<PayType, number> }>,
  settings: ToilSettingsResponse,
  startDate: string,
  endDate: string,
  now: number,
): ToilReportTotals {
  const anchor = settings.payCycle.startDate;
  const cycleDays = settings.payCycle.periodDays;
  if (!anchor || !Number.isInteger(cycleDays) || cycleDays < 1) {
    throw new Error(
      'Set the reporting cycle start date and period in Notifications before exporting TOIL.',
    );
  }
  if (!startDate || !endDate || startDate > endDate) {
    throw new Error('Choose a valid report date range before exporting TOIL.');
  }

  const contracts = new Map(settings.users.map((user) => [user.id, user.contractedHoursPerCycle]));
  const hourlyByUserDate = new Map<string, number>();
  const accruedHours = new Map<string, number>();
  const usedHours = new Map<string, number>();
  for (const [userId, user] of userTotals) {
    if (user.seconds.hourly > 0 && contracts.get(userId) == null) {
      throw new Error(
        `Set contracted hours for ${user.name} in Admin Settings before exporting TOIL.`,
      );
    }
  }
  for (const entry of entries) {
    if ((entry.task?.payType ?? 'hourly') !== 'hourly') {
      continue;
    }
    const date = localDateKey(new Date(entry.startTime));
    const key = `${entry.userId}:${date}`;
    hourlyByUserDate.set(
      key,
      (hourlyByUserDate.get(key) ?? 0) + entryDurationSeconds(entry, now) / 3600,
    );
  }
  for (const [userId, user] of userTotals) {
    const contractedHours = contracts.get(userId);
    let accrued = 0;
    if (contractedHours !== null && contractedHours !== undefined) {
      for (const segment of payCycleSegments(startDate, endDate, anchor, cycleDays)) {
        let workedHours = 0;
        for (const [key, hours] of hourlyByUserDate) {
          if (key.startsWith(`${userId}:`)) {
            const date = key.slice(userId.length + 1);
            if (date >= segment.start && date <= segment.end) {
              workedHours += hours;
            }
          }
        }
        const proratedContract = contractedHours * (segment.days / cycleDays);
        accrued += Math.max(0, workedHours - proratedContract) * settings.accrualMultiplier;
      }
    }
    accruedHours.set(userId, roundHours(accrued));
  }

  for (const usage of settings.usages) {
    if (usage.usageDate >= startDate && usage.usageDate <= endDate) {
      usedHours.set(usage.userId, (usedHours.get(usage.userId) ?? 0) + usage.hours);
    }
  }
  return { accruedHours, usedHours };
}

function payCycleSegments(
  startDate: string,
  endDate: string,
  anchor: string,
  cycleDays: number,
): { start: string; end: string; days: number }[] {
  const dayMs = 86_400_000;
  const dateValue = (date: string) => Date.parse(`${date}T00:00:00Z`);
  const startValue = dateValue(startDate);
  const endValue = dateValue(endDate);
  const anchorValue = dateValue(anchor);
  let cycleStart =
    anchorValue + Math.floor((startValue - anchorValue) / (cycleDays * dayMs)) * cycleDays * dayMs;
  const segments: { start: string; end: string; days: number }[] = [];
  while (cycleStart <= endValue) {
    const cycleEnd = cycleStart + (cycleDays - 1) * dayMs;
    const segmentStart = Math.max(startValue, cycleStart);
    const segmentEnd = Math.min(endValue, cycleEnd);
    if (segmentStart <= segmentEnd) {
      segments.push({
        start: new Date(segmentStart).toISOString().slice(0, 10),
        end: new Date(segmentEnd).toISOString().slice(0, 10),
        days: Math.floor((segmentEnd - segmentStart) / dayMs) + 1,
      });
    }
    cycleStart += cycleDays * dayMs;
  }
  return segments;
}

function earliestEntryDate(entries: TimeEntry[], extraDates: string[] = []): string {
  return (
    [
      ...entries.map((entry) => localDateKey(new Date(entry.startTime))).sort(),
      ...extraDates,
    ].sort()[0] ?? ''
  );
}

function latestEntryDate(entries: TimeEntry[], extraDates: string[] = []): string {
  return (
    [...entries.map((entry) => localDateKey(new Date(entry.startTime))).sort(), ...extraDates]
      .sort()
      .at(-1) ?? ''
  );
}

function roundHours(hours: number): number {
  return Math.round(hours * 100) / 100;
}

function localDateKey(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function columnName(index: number): string {
  let column = '';
  for (let value = index; value > 0; value = Math.floor((value - 1) / 26)) {
    column = String.fromCharCode(((value - 1) % 26) + 65) + column;
  }
  return column;
}
