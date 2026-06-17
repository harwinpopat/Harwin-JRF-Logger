/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ScholarMetadata {
  name: string;
  designation: string;
  department: string;
  university: string;
  researchTopic: string;
  guide: string;
  workingHours: string;
  recess: string;
}

export interface LogEntry {
  id: string;         // Unique ID
  date: string;       // YYYY-MM-DD
  timeSlot: string;   // e.g., "11:00 to 2:00" or "3:00 to 5:00"
  activityType: string; // Reading, Mentoring, Department Work, Leave, Other Work, etc.
  description: string;
  remarks: string;
}

export interface Holiday {
  date: string;       // YYYY-MM-DD
  name: string;       // e.g., "Republic Day", "Makar Sankranti"
}

export interface MonthlyConfig {
  year: number;
  month: number;      // 0-11
  excludeEvenSaturdays: boolean;
  excludeSundays: boolean;
  holidays: Holiday[];
}
