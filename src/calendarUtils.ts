/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Holiday, LogEntry } from './types';

/**
 * Checks if a specific date is a weekend or holiday based on config,
 * and if a Saturday is an even Saturday (the 2nd or 4th Saturday of the month).
 */
export function getDayStatus(
  date: Date,
  holidays: Holiday[],
  excludeSundays: boolean = true,
  excludeEvenSaturdays: boolean = true
): {
  isWorkingDay: boolean;
  reason: string | null;
  saturdayIndex?: number;
} {
  const dayOfWeek = date.getDay(); // 0: Sunday, 6: Saturday
  const dateStr = date.toISOString().split('T')[0];

  // 1. Check Sundays
  if (dayOfWeek === 0) {
    return {
      isWorkingDay: !excludeSundays,
      reason: excludeSundays ? "Sunday Off-Day" : null
    };
  }

  // 2. Check public holidays
  const holiday = holidays.find(h => h.date === dateStr);
  if (holiday) {
    return {
      isWorkingDay: false,
      reason: `Public Holiday: ${holiday.name}`
    };
  }

  // 3. Check Saturdays (even-numbered: 2nd and 4th of the month)
  if (dayOfWeek === 6) {
    const dayOfMonth = date.getDate();
    // Calculate which Saturday it is (1st, 2nd, 3rd, 4th, 5th)
    const saturdayIndex = Math.ceil(dayOfMonth / 7);
    
    if (excludeEvenSaturdays && (saturdayIndex === 2 || saturdayIndex === 4)) {
      return {
        isWorkingDay: false,
        reason: `${saturdayIndex === 2 ? "2nd" : "4th"} Saturday Off-Day`,
        saturdayIndex
      };
    }
    
    return {
      isWorkingDay: true,
      reason: `${saturdayIndex === 1 ? "1st" : saturdayIndex === 3 ? "3rd" : "5th"} Saturday (Working)`,
      saturdayIndex
    };
  }

  return {
    isWorkingDay: true,
    reason: null
  };
}

/**
 * Generates empty template logs for a whole month, excluding off-days automatically.
 */
export function generateMonthTemplate(
  year: number,
  month: number, // 0-11
  holidays: Holiday[],
  excludeSundays: boolean = true,
  excludeEvenSaturdays: boolean = true,
  slot1Hours: string = "11:00 to 2:00",
  slot2Hours: string = "3:00 to 5:00"
): LogEntry[] {
  const entries: LogEntry[] = [];
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let day = 1; day <= daysInMonth; day++) {
    const curDate = new Date(year, month, day);
    const dateStr = curDate.toISOString().split('T')[0];
    
    const status = getDayStatus(curDate, holidays, excludeSundays, excludeEvenSaturdays);
    
    if (status.isWorkingDay) {
      // Create slot 1
      entries.push({
        id: `${dateStr}-s1`,
        date: dateStr,
        timeSlot: slot1Hours,
        activityType: "",
        description: "",
        remarks: ""
      });
      // Create slot 2
      entries.push({
        id: `${dateStr}-s2`,
        date: dateStr,
        timeSlot: slot2Hours,
        activityType: "",
        description: "",
        remarks: ""
      });
    }
  }

  return entries;
}

/**
 * Helper to get holiday for selected month
 */
export function getHolidaysForMonth(year: number, month: number, holidays: Holiday[]): Holiday[] {
  const monthStr = String(month + 1).padStart(2, '0');
  const prefix = `${year}-${monthStr}`;
  return holidays.filter(h => h.date.startsWith(prefix));
}
