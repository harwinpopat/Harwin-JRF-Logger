/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ScholarMetadata, LogEntry } from './types';

/**
 * Standard CSV Parser supporting quoted fields with commas.
 */
export function parseCSV(text: string): { scholar: Partial<ScholarMetadata>; entries: Omit<LogEntry, 'id'>[] } {
  const lines: string[] = [];
  let currentLine = "";
  let insideQuote = false;

  // Split lines by newline, taking care of quoted newlines if they exist
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      insideQuote = !insideQuote;
      currentLine += char;
    } else if ((char === '\n' || char === '\r') && !insideQuote) {
      if (char === '\r' && text[i + 1] === '\n') {
        i++; // skip LF
      }
      lines.push(currentLine);
      currentLine = "";
    } else {
      currentLine += char;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }

  const scholar: Partial<ScholarMetadata> = {};
  const entries: Omit<LogEntry, 'id'>[] = [];
  let isTableSection = false;
  let lastDate = "";

  for (let line of lines) {
    // Remove BOM character and trim
    line = line.replace(/^\uFEFF/, '').trim();
    if (!line) continue;

    const row = parseCSVLine(line);
    if (!row || row.length === 0) continue;

    const colA = row[0]?.trim();

    if (!isTableSection) {
      // Check for metadata
      if (colA === "Name") scholar.name = row[2] || row[1] || "";
      else if (colA === "Designation") scholar.designation = row[2] || row[1] || "";
      else if (colA === "Department") scholar.department = row[2] || row[1] || "";
      else if (colA === "University") scholar.university = row[2] || row[1] || "";
      else if (colA === "Research Topic") scholar.researchTopic = row[2] || row[1] || "";
      else if (colA === "Guide") scholar.guide = row[2] || row[1] || "";
      else if (colA === "Working Hours") {
        const fullHrs = row[2] || row[1] || "";
        const recessMatch = fullHrs.match(/\(Recess:\s*([^)]+)\)/i);
        scholar.workingHours = fullHrs.replace(/\s*\(Recess:[^)]+\)/i, "").trim();
        scholar.recess = recessMatch ? recessMatch[1].trim() : "2:00 – 3:00 PM";
      }

      // Check if we hit the table headers (more flexible)
      const colALower = colA.toLowerCase().replace(/[^a-z0-9,]/g, '');
      if (colALower === "date" || colALower === "date,timeslot") {
        isTableSection = true;
      } else if (isDateStr(colA)) {
        isTableSection = true;
        // Re-process this row as a table row immediately
        lastDate = processLogRow(row, entries, lastDate);
        continue;
      }
    } else {
      lastDate = processLogRow(row, entries, lastDate);
    }
  }

  return { scholar, entries };
}

export function parseDateRobust(dateStr: string): string {
  if (!dateStr) return "";
  let s = dateStr.trim();
  
  // 1. Remove weekday name prefix if present (e.g. "Wednesday, April 01, 2026", "Wed, April 01, 2026")
  s = s.replace(/^[a-zA-Z]+\s*,\s*/, "");
  s = s.replace(/^(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\.?\s+/i, "");
  
  // Try parsing the cleaned string with Date.parse
  const t = Date.parse(s);
  if (!isNaN(t)) {
    const d = new Date(t);
    return d.toISOString().split('T')[0];
  }
  
  // 2. Try matching YYYY-MM-DD
  const matchYYYYMMDD = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (matchYYYYMMDD) {
    return matchYYYYMMDD[0];
  }
  
  // 3. Try matching DD/MM/YYYY or DD-MM-YYYY
  const matchDDMMYYYY = s.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (matchDDMMYYYY) {
    const part1 = parseInt(matchDDMMYYYY[1]);
    const part2 = parseInt(matchDDMMYYYY[2]);
    const year = matchDDMMYYYY[3];
    if (part2 > 12) {
      return `${year}-${part1.toString().padStart(2, '0')}-${part2.toString().padStart(2, '0')}`;
    } else {
      return `${year}-${part2.toString().padStart(2, '0')}-${part1.toString().padStart(2, '0')}`;
    }
  }
  
  // 4. Try manual parse of month name, e.g. "April 01, 2026" or "01 April 2026" in case Date.parse failed
  const months = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december", "jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const lowerS = s.toLowerCase();
  for (let mIdx = 0; mIdx < months.length; mIdx++) {
    const mName = months[mIdx];
    if (lowerS.includes(mName)) {
      const monthNum = (mIdx % 12) + 1;
      const monthPad = monthNum.toString().padStart(2, '0');
      const yearMatch = s.match(/\b(20\d{2})\b/);
      const dayMatch = s.match(/\b([0-2]?\d|3[01])\b/);
      if (yearMatch) {
         const year = yearMatch[1];
         let day = "01";
         if (dayMatch) {
           const matches = s.match(/\b\d+\b/g);
           if (matches) {
             const dayCandidate = matches.find(m => m !== year);
             if (dayCandidate) {
               day = parseInt(dayCandidate).toString().padStart(2, '0');
             }
           }
         }
         return `${year}-${monthPad}-${day}`;
      }
    }
  }

  return "";
}

function processLogRow(row: string[], entries: Omit<LogEntry, 'id'>[], lastDate: string): string {
  const colA = row[0]?.trim();
  
  // If date column is empty, use the last known date
  let isoDate = "";
  if (colA) {
    isoDate = parseDateRobust(colA);
  } else {
    // Date is empty, inherit
    isoDate = lastDate;
  }

  // If still no date or header row skip
  const colALower = colA ? colA.toLowerCase().replace(/[^a-z0-9]/g, '') : "";
  if (!isoDate || colALower === "date" || (colA && (colA.startsWith("_____") || colA.startsWith("Signature")))) {
    return lastDate; // skip
  }

  entries.push({
    date: isoDate,
    timeSlot: (row[1] || "").trim(),
    activityType: (row[2] || "").trim(),
    description: (row[3] || "").trim(),
    remarks: (row[4] || "").trim()
  });
  
  return isoDate; // return new lastDate
}

function isDateStr(dateStr: string): boolean {
  if (!dateStr) return false;
  return parseDateRobust(dateStr) !== "";
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let currentVal = "";
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (insideQuotes && line[i + 1] === '"') {
        // Escaped quote
        currentVal += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      result.push(currentVal);
      currentVal = "";
    } else {
      currentVal += char;
    }
  }
  result.push(currentVal);
  return result;
}

/**
 * Format entries and scholar details to output standard CSV text.
 */
export function unparseCSV(metadata: ScholarMetadata, entries: LogEntry[]): string {
  const escape = (val: string) => {
    const stringified = String(val || "").replace(/"/g, '""');
    if (stringified.includes(',') || stringified.includes('"') || stringified.includes('\n') || stringified.includes('\r')) {
      return `"${stringified}"`;
    }
    return stringified;
  };

  const lines: string[] = [
    `Name,,${escape(metadata.name)},,`,
    `Designation,,${escape(metadata.designation)},,`,
    `Department,,${escape(metadata.department)},,`,
    `University,,${escape(metadata.university)},,`,
    `Research Topic,,${escape(metadata.researchTopic)},,`,
    `Guide,,${escape(metadata.guide)},,`,
    `Working Hours,,${escape(metadata.workingHours + " (Recess: " + metadata.recess + ")")},,`,
    "" // blank spacer
  ];

  // Table header
  lines.push("Date,Time Slot,Activity Type,Detailed Description of Work,Remarks");

  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  sorted.forEach(entry => {
    const d = new Date(entry.date);
    const dayOfWeek = d.toLocaleDateString('en-US', { weekday: 'long' });
    const monthStr = d.toLocaleDateString('en-US', { month: 'long' });
    const formattedDate = `${dayOfWeek}, ${monthStr} ${String(d.getDate()).padStart(2, '0')}, ${d.getFullYear()}`;

    lines.push([
      escape(formattedDate),
      escape(entry.timeSlot),
      escape(entry.activityType),
      escape(entry.description),
      escape(entry.remarks || "-")
    ].join(","));
  });

  return lines.join("\n");
}
