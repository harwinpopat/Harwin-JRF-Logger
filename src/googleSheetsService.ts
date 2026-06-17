/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ScholarMetadata, LogEntry } from './types';

/**
 * Creates a beautiful, university-standard JRF Monthly Work Report in Google Sheets.
 * Writing values and formatting them directly so it matches the user's shared structure exactly.
 */
export async function syncToGoogleSheets(
  accessToken: string,
  metadata: ScholarMetadata,
  entries: LogEntry[],
  monthLabel: string
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  // Step 1: Create a new spreadsheet
  const createResponse = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      properties: {
        title: `JRF Work Log - ${monthLabel} (${metadata.name})`
      }
    })
  });

  if (!createResponse.ok) {
    const errText = await createResponse.text();
    throw new Error(`Failed to create Google Sheet: ${errText}`);
  }

  const spreadsheet = await createResponse.json();
  const spreadsheetId = spreadsheet.spreadsheetId;
  const spreadsheetUrl = spreadsheet.spreadsheetUrl;

  // Step 2: Prepare values in the exact layout shared by the user
  const values: any[][] = [];

  // Metadata headers
  values.push(["Name", "", metadata.name, "", ""]);
  values.push(["Designation", "", metadata.designation, "", ""]);
  values.push(["Department", "", metadata.department, "", ""]);
  values.push(["University", "", metadata.university, "", ""]);
  values.push(["Research Topic", "", metadata.researchTopic, "", ""]);
  values.push(["Guide", "", metadata.guide, "", ""]);
  values.push(["Working Hours", "", `${metadata.workingHours} (Recess: ${metadata.recess})`, "", ""]);
  values.push([]); // blank spacer line

  // Column Headers
  values.push(["Date", "Time Slot", "Activity Type", "Detailed Description of Work", "Remarks"]);

  // Fill in entries sorted chronologically
  const sortedEntries = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  
  // Track previous date to avoid duplicating visually if requested, but cell entries are cleaner if populated
  sortedEntries.forEach((entry) => {
    // Format Date beautifully like "Friday, January 02, 2026"
    const d = new Date(entry.date);
    const dayOfWeek = d.toLocaleDateString('en-US', { weekday: 'long' });
    const month = d.toLocaleDateString('en-US', { month: 'long' });
    const formattedDate = `${dayOfWeek}, ${month} ${String(d.getDate()).padStart(2, '0')}, ${d.getFullYear()}`;
    
    values.push([
      formattedDate,
      entry.timeSlot,
      entry.activityType,
      entry.description,
      entry.remarks || "-"
    ]);
  });

  // Footer / Signatures
  values.push([]);
  values.push([]);
  values.push(["__________________________", "", "", "__________________________", "__________________________"]);
  values.push(["Signature of JRF Scholar", "", "", "Signature of Research Guide", "Signature of department Coordinator / HoD"]);

  // Step 3: Write metadata & Log records to the spreadsheet
  const range = `Sheet1!A1:E${values.length}`;
  const writeResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        values: values
      })
    }
  );

  if (!writeResponse.ok) {
    const errText = await writeResponse.text();
    throw new Error(`Failed to write values to sheet: ${errText}`);
  }

  // Step 4: Add beautiful formatting using Google Sheets Batch Update (font selections, colors, widths)
  const batchUpdateRequest = {
    requests: [
      // Format 1: Bold Labels (Column A for metadata)
      {
        repeatCell: {
          range: { sheetId: 0, startRowIndex: 0, endRowIndex: 7, startColumnIndex: 0, endColumnIndex: 1 },
          cell: {
            userEnteredFormat: {
              textFormat: { bold: true, fontSize: 11, fontFamily: 'Arial' }
            }
          },
          fields: 'userEnteredFormat.textFormat'
        }
      },
      // Format 2: Bold Table Headings & background-color (navy-gray tint)
      {
        repeatCell: {
          range: { sheetId: 0, startRowIndex: 8, endRowIndex: 9, startColumnIndex: 0, endColumnIndex: 5 },
          cell: {
            userEnteredFormat: {
              textFormat: { bold: true, fontSize: 11, color: { red: 1, green: 1, blue: 1 } },
              backgroundColor: { red: 0.18, green: 0.24, blue: 0.35 }, // Indigo-slate background
              horizontalAlignment: 'CENTER'
            }
          },
          fields: 'userEnteredFormat(textFormat,backgroundColor,horizontalAlignment)'
        }
      },
      // Format 3: Grid column widths to prevent text clipping
      {
        updateDimensionProperties: {
          range: { sheetId: 0, dimension: 'COLUMNS', startIndex: 0, endIndex: 1 },
          properties: { pixelSize: 220 }, // Date column
          fields: 'pixelSize'
        }
      },
      {
        updateDimensionProperties: {
          range: { sheetId: 0, dimension: 'COLUMNS', startIndex: 1, endIndex: 2 },
          properties: { pixelSize: 130 }, // Time slot
          fields: 'pixelSize'
        }
      },
      {
        updateDimensionProperties: {
          range: { sheetId: 0, dimension: 'COLUMNS', startIndex: 2, endIndex: 3 },
          properties: { pixelSize: 160 }, // Activity Type
          fields: 'pixelSize'
        }
      },
      {
        updateDimensionProperties: {
          range: { sheetId: 0, dimension: 'COLUMNS', startIndex: 3, endIndex: 4 },
          properties: { pixelSize: 450 }, // Work Description
          fields: 'pixelSize'
        }
      },
      {
        updateDimensionProperties: {
          range: { sheetId: 0, dimension: 'COLUMNS', startIndex: 4, endIndex: 5 },
          properties: { pixelSize: 180 }, // Remarks
          fields: 'pixelSize'
        }
      },
      // Format 4: Bold Signatures row
      {
        repeatCell: {
          range: { sheetId: 0, startRowIndex: values.length - 1, endRowIndex: values.length, startColumnIndex: 0, endColumnIndex: 5 },
          cell: {
            userEnteredFormat: {
              textFormat: { bold: true, fontSize: 10, italic: true },
              horizontalAlignment: 'CENTER'
            }
          },
          fields: 'userEnteredFormat(textFormat,horizontalAlignment)'
        }
      }
    ]
  };

  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(batchUpdateRequest)
  });

  return { spreadsheetId, spreadsheetUrl };
}

/**
 * Searches and fetches sheets of JRF logs from the user's Google Drive.
 */
export async function listUserSpreadsheets(accessToken: string): Promise<{ id: string; name: string }[]> {
  const query = encodeURIComponent("mimeType='application/vnd.google-apps.spreadsheet' and name contains 'JRF Work Log'");
  const response = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&orderBy=name_desc`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    console.error("Failed to list spreadsheets from Google Drive");
    return [];
  }

  const result = await response.json();
  return (result.files || []).map((f: any) => ({
    id: f.id,
    name: f.name
  }));
}

/**
 * Ingest / load entries from an existing JRF Spreadsheet.
 */
export async function fetchEntriesFromSpreadsheet(
  accessToken: string,
  spreadsheetId: string
): Promise<{ scholar: Partial<ScholarMetadata>; entries: Omit<LogEntry, 'id'>[] }> {
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A1:E200`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to read range from selected Google Sheet: ${errText}`);
  }

  const data = await response.json();
  const rows: string[][] = data.values || [];

  const scholar: Partial<ScholarMetadata> = {};
  const entries: Omit<LogEntry, 'id'>[] = [];

  let isTableSection = false;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const colA = row[0]?.trim();

    // Parse scholar info
    if (!isTableSection) {
      if (colA === "Name") scholar.name = row[2] || "";
      else if (colA === "Designation") scholar.designation = row[2] || "";
      else if (colA === "Department") scholar.department = row[2] || "";
      else if (colA === "University") scholar.university = row[2] || "";
      else if (colA === "Research Topic") scholar.researchTopic = row[2] || "";
      else if (colA === "Guide") scholar.guide = row[2] || "";
      else if (colA === "Working Hours") {
        const fullHrs = row[2] || "";
        const recessMatch = fullHrs.match(/\(Recess:\s*([^)]+)\)/i);
        scholar.workingHours = fullHrs.replace(/\s*\(Recess:[^)]+\)/i, "").trim();
        scholar.recess = recessMatch ? recessMatch[1].trim() : "2:00 – 3:00 PM";
      }

      // Check if this row is the header row
      if (colA === "Date" && row[1]?.trim() === "Time Slot") {
        isTableSection = true;
        continue;
      }
    } else {
      // In table section, parse row if it has date
      if (!colA || colA.startsWith("____") || colA.startsWith("Signature")) {
        // End of table/signatures reached
        continue;
      }

      // Safe date parsing from string like "Thursday, January 01, 2026" or "2026-01-01"
      const dateStr = colA;
      let isoDate = "";

      try {
        const parsedTimestamp = Date.parse(dateStr);
        if (!isNaN(parsedTimestamp)) {
          const d = new Date(parsedTimestamp);
          isoDate = d.toISOString().split('T')[0];
        }
      } catch (err) {
        console.warn("Date parsing skipped for raw cell:", dateStr);
      }

      if (!isoDate) {
        // Fallback to searching YYYY-MM-DD
        const match = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
        if (match) {
          isoDate = match[0];
        } else {
          continue; // skip if cannot parse date
        }
      }

      entries.push({
        date: isoDate,
        timeSlot: row[1] || "",
        activityType: row[2] || "",
        description: row[3] || "",
        remarks: row[4] || "-"
      });
    }
  }

  return { scholar, entries };
}
