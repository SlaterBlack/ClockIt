import { strToU8, zipSync } from 'fflate';
import { PAY_TYPES, type PayType } from '../../core/models/pay-type.model';
import type { TimeEntry } from '../../core/models/time-entry.model';
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
): Blob {
  const entries = entriesInDateRange(allEntries, startDate, endDate);
  const userTotals = new Map<string, { name: string; seconds: Record<PayType, number> }>();
  for (const entry of entries) {
    const user = userTotals.get(entry.userId) ?? {
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
  const activePayTypes = PAY_TYPES.filter((type) => periodTotals[type.value] > 0).sort(
    (a, b) =>
      PAY_TYPE_SUMMARY_ORDER.indexOf(a.value) - PAY_TYPE_SUMMARY_ORDER.indexOf(b.value),
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
      ...activePayTypes.map((type) =>
        type.value === 'hourly' ? 'Hourly Wage' : type.label,
      ),
    ],
    ...sortedUsers.map((user) => [
      user.name,
      totalPaidHours(user.seconds),
      ...activePayTypes.map((type) => user.seconds[type.value] / 3600),
    ]),
    [
      'All users',
      totalPaidHours(periodTotals),
      ...activePayTypes.map((type) => periodTotals[type.value] / 3600),
    ],
  ];
  const detailRows = buildReportRows(entries, now).map((row, rowIndex) => {
    if (rowIndex === 0) {
      return row;
    }
    const hoursColumn = row.length - 1;
    return row.map((value, columnIndex) =>
      columnIndex === hoursColumn ? Number(value) : value,
    );
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
        '<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>' +
        '<fills count="2"><fill><patternFill patternType="none"/></fill>' +
        '<fill><patternFill patternType="gray125"/></fill></fills>' +
        '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
        '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
        '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
        '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs>' +
        '</styleSheet>',
    ),
    'xl/worksheets/sheet1.xml': strToU8(worksheetXml(summaryRows)),
    'xl/worksheets/sheet2.xml': strToU8(worksheetXml(detailRows)),
  });

  return new Blob([workbook], { type: XLSX_MIME_TYPE });
}

function worksheetXml(rows: (string | number)[][]): string {
  const rowXml = rows
    .map(
      (row, rowIndex) =>
        `<row r="${rowIndex + 1}">${row
          .map((value, columnIndex) => cellXml(value, `${columnName(columnIndex + 1)}${rowIndex + 1}`))
          .join('')}</row>`,
    )
    .join('');
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    `<sheetData>${rowXml}</sheetData></worksheet>`
  );
}

function cellXml(value: string | number, reference: string): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `<c r="${reference}" s="1"><v>${value}</v></c>`;
  }
  const text = escapeXml(String(value)).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
  return `<c r="${reference}" t="inlineStr"><is><t xml:space="preserve">${text}</t></is></c>`;
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
