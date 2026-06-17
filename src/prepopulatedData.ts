/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ScholarMetadata, LogEntry, Holiday } from './types';

export const TEMPLATE_SCHOLAR: ScholarMetadata = {
  name: "Harwin Popat",
  designation: "JRF (PhD Scholar)",
  department: "Department of English & CLS",
  university: "Saurashtra University, Rajkot",
  researchTopic: "Tracing Alternative Modernities in India: A Comparative Study of Critical Discourses in English, Hindi, and Gujarati",
  guide: "Prof. Sanjay Mukherjee",
  workingHours: "11:00 Noon – 5:00 PM",
  recess: "2:00 – 3:00 PM"
};

export const INITIAL_HOLIDAYS: Holiday[] = [
  { date: "2026-01-14", name: "Makar Sankranti" },
  { date: "2026-01-26", name: "Republic Day" },
  { date: "2026-03-06", name: "Holi (Dhulivandan)" },
  { date: "2026-03-17", name: "Maha Shivratri" },
  { date: "2026-04-02", name: "Mahavir Jayanti" },
  { date: "2026-04-15", name: "Good Friday" },
  { date: "2026-05-01", name: "Gujarat Day" },
  { date: "2026-08-15", name: "Independence Day" },
  { date: "2026-10-02", name: "Gandhi Jayanti" },
  { date: "2026-11-09", name: "Diwali" },
  { date: "2026-11-10", name: "New Year (Gujarat)" },
  { date: "2026-12-25", name: "Christmas" }
];

export const PRELOADED_LOG_ENTRIES: LogEntry[] = [
  // --- Jan 01, 2026 ---
  {
    id: "jan-01-s1",
    date: "2026-01-01",
    timeSlot: "12:00 to 2:00",
    activityType: "Reading",
    description: "Ramakrishnan, E. V. Making It New: Modernism in Malayalam, Marathi and Hindi Poetry. Indian Institute of Advanced Study, 1995.",
    remarks: "Preface"
  },
  {
    id: "jan-01-s2",
    date: "2026-01-01",
    timeSlot: "3:00 to 5:00",
    activityType: "Other Work",
    description: "Technical Assistance to NEP37 UGC-MMTTC Training Programme",
    remarks: "-"
  },
  // --- Jan 02, 2026 ---
  {
    id: "jan-02-s1",
    date: "2026-01-02",
    timeSlot: "12:00 to 2:00",
    activityType: "Reading",
    description: "Ramakrishnan, E. V. Making It New: Modernism in Malayalam, Marathi and Hindi Poetry. Indian Institute of Advanced Study, 1995.",
    remarks: "Pp. 1"
  },
  {
    id: "jan-02-s2",
    date: "2026-01-02",
    timeSlot: "3:00 to 5:00",
    activityType: "Other Work",
    description: "Technical Assistance to NEP37 UGC-MMTTC Training Programme",
    remarks: "-"
  },
  // --- Jan 03, 2026 (1st Saturday) ---
  {
    id: "jan-03-s1",
    date: "2026-01-03",
    timeSlot: "12:00 to 2:00",
    activityType: "Other Work",
    description: "Discussion with the guide regarding the course of actions.",
    remarks: "-"
  },
  {
    id: "jan-03-s2",
    date: "2026-01-03",
    timeSlot: "3:00 to 5:00",
    activityType: "Other Work",
    description: "Technical Assistance to NEP37 UGC-MMTTC Training Programme",
    remarks: "-"
  },
  // --- Jan 05, 2026 ---
  {
    id: "jan-05-s1",
    date: "2026-01-05",
    timeSlot: "12:00 to 2:00",
    activityType: "Other Work",
    description: "Attending Akeel Bilgrami's Lecture at BPC.",
    remarks: "-"
  },
  {
    id: "jan-05-s2",
    date: "2026-01-05",
    timeSlot: "3:00 to 5:00",
    activityType: "Other Work",
    description: "Technical Assistance to NEP37 UGC-MMTTC Training Programme",
    remarks: "-"
  },
  // --- Jan 06, 2026 ---
  {
    id: "jan-06-s1",
    date: "2026-01-06",
    timeSlot: "12:00 to 2:00",
    activityType: "Reading",
    description: "Ramakrishnan, E. V. Making It New: Modernism in Malayalam, Marathi and Hindi Poetry. Indian Institute of Advanced Study, 1995.",
    remarks: "Pp. 2-3"
  },
  {
    id: "jan-06-s2",
    date: "2026-01-06",
    timeSlot: "3:00 to 5:00",
    activityType: "Other Work",
    description: "Technical Assistance to NEP37 UGC-MMTTC Training Programme",
    remarks: "-"
  },
  // --- Jan 07, 2026 ---
  {
    id: "jan-07-s1",
    date: "2026-01-07",
    timeSlot: "12:00 to 2:00",
    activityType: "Reading",
    description: "Ramakrishnan, E. V. Making It New: Modernism in Malayalam, Marathi and Hindi Poetry. Indian Institute of Advanced Study, 1995.",
    remarks: "Pp. 2-4"
  },
  {
    id: "jan-07-s2",
    date: "2026-01-07",
    timeSlot: "3:00 to 5:00",
    activityType: "Other Work",
    description: "Technical Assistance to NEP37 UGC-MMTTC Training Programme",
    remarks: "-"
  },
  // --- Jan 08, 2026 ---
  {
    id: "jan-08-s1",
    date: "2026-01-08",
    timeSlot: "12:00 to 2:00",
    activityType: "Reading",
    description: "Ramakrishnan, E. V. Making It New: Modernism in Malayalam, Marathi and Hindi Poetry. Indian Institute of Advanced Study, 1995.",
    remarks: "Pp. 3-5"
  },
  {
    id: "jan-08-s2",
    date: "2026-01-08",
    timeSlot: "3:00 to 5:00",
    activityType: "Other Work",
    description: "Technical Assistance to NEP37 UGC-MMTTC Training Programme",
    remarks: "-"
  },
  // --- Jan 09, 2026 ---
  {
    id: "jan-09-s1",
    date: "2026-01-09",
    timeSlot: "12:00 to 2:00",
    activityType: "Mentoring",
    description: "Mentored a PG student.",
    remarks: "-"
  },
  {
    id: "jan-09-s2",
    date: "2026-01-09",
    timeSlot: "3:00 to 5:00",
    activityType: "Other Work",
    description: "Technical Assistance to NEP37 UGC-MMTTC Training Programme",
    remarks: "-"
  },
  // [Jan 10, 11 are even Saturday and Sunday, skipped in CSV]
  // --- Jan 12, 2026 ---
  {
    id: "jan-12-s1",
    date: "2026-01-12",
    timeSlot: "12:00 to 2:00",
    activityType: "Reading",
    description: "Albert. History of English Literature. 1979.",
    remarks: "Entries related to Modernism (Pp. 432-433, 456-460)"
  },
  {
    id: "jan-12-s2",
    date: "2026-01-12",
    timeSlot: "3:00 to 5:00",
    activityType: "Reading",
    description: "Ramakrishnan, E. V. Making It New: Modernism in Malayalam, Marathi and Hindi Poetry. Indian Institute of Advanced Study, 1995.",
    remarks: "Pp. 5-6"
  },
  // --- Jan 13, 2026 ---
  {
    id: "jan-13-s1",
    date: "2026-01-13",
    timeSlot: "12:00 to 2:00",
    activityType: "Reading",
    description: "Cuddon, J. A. A Dictionary of Literary Terms and Literary Theory. John Wiley and Sons, 2013.",
    remarks: "Pp. 441-443"
  },
  {
    id: "jan-13-s2",
    date: "2026-01-13",
    timeSlot: "3:00 to 5:00",
    activityType: "Reading",
    description: "Ramakrishnan, E. V. Making It New: Modernism in Malayalam, Marathi and Hindi Poetry. Indian Institute of Advanced Study, 1995.",
    remarks: "Pp. 6-7"
  },
  // [Jan 14 is Makar Sankranti holiday, skipped in sheet]
  // --- Jan 15, 2026 ---
  {
    id: "jan-15-s1",
    date: "2026-01-15",
    timeSlot: "12:00 to 2:00",
    activityType: "Department Work",
    description: "Segregation of Data for NIRF",
    remarks: "-"
  },
  {
    id: "jan-15-s2",
    date: "2026-01-15",
    timeSlot: "3:00 to 5:00",
    activityType: "Department Work",
    description: "Poster for a National Conference from 20-22 March",
    remarks: "-"
  },
  // --- Jan 16, 2026 ---
  {
    id: "jan-16-s1",
    date: "2026-01-16",
    timeSlot: "12:00 to 2:00",
    activityType: "Department Work",
    description: "Segregation of Data for NIRF",
    remarks: "-"
  },
  {
    id: "jan-16-s2",
    date: "2026-01-16",
    timeSlot: "3:00 to 5:00",
    activityType: "Other Work",
    description: "Prepared this sheet.",
    remarks: "-"
  },
  // --- Jan 17, 2026 (3rd Saturday) ---
  {
    id: "jan-17-s1",
    date: "2026-01-17",
    timeSlot: "12:00 to 2:00",
    activityType: "Department Work",
    description: "Poster for a National Conference from 20-22 March",
    remarks: "-"
  },
  {
    id: "jan-17-s2",
    date: "2026-01-17",
    timeSlot: "3:00 to 5:00",
    activityType: "Department Work",
    description: "Assisting for Departmental NIRF Data.",
    remarks: "-"
  },
  // [Jan 18 is Sunday, skipped]
  // --- Jan 19, 2026 ---
  {
    id: "jan-19-s1",
    date: "2026-01-19",
    timeSlot: "11:00 to 2:00",
    activityType: "Mentoring and Department Work",
    description: "PG Student Mentoring and Departmental Work for Poster Making",
    remarks: ""
  },
  {
    id: "jan-19-s2",
    date: "2026-01-19",
    timeSlot: "3:00 to 5:00",
    activityType: "Reading",
    description: "Ramakrishnan, E. V. Making It New: Modernism in Malayalam, Marathi and Hindi Poetry. Indian Institute of Advanced Study, 1995.",
    remarks: "Pp. 8, 13-14"
  },
  // --- Jan 20, 2026 ---
  {
    id: "jan-20-s1",
    date: "2026-01-20",
    timeSlot: "11:00 to 2:00",
    activityType: "Reading",
    description: "Ramakrishnan, E. V. Making It New: Modernism in Malayalam, Marathi and Hindi Poetry. Indian Institute of Advanced Study, 1995.",
    remarks: "Pp. 14-18"
  },
  {
    id: "jan-20-s2",
    date: "2026-01-20",
    timeSlot: "3:00 to 5:00",
    activityType: "Reading",
    description: "Ramakrishnan, E. V. Making It New: Modernism in Malayalam, Marathi and Hindi Poetry. Indian Institute of Advanced Study, 1995.",
    remarks: "Pp. 18-20"
  },
  // --- Jan 21, 2026 ---
  {
    id: "jan-21-s1",
    date: "2026-01-21",
    timeSlot: "11:00 to 2:00",
    activityType: "Reading",
    description: "Ramakrishnan, E. V. Making It New: Modernism in Malayalam, Marathi and Hindi Poetry. Indian Institute of Advanced Study, 1995.",
    remarks: "Pp. 21-25"
  },
  {
    id: "jan-21-s2",
    date: "2026-01-21",
    timeSlot: "3:00 to 5:00",
    activityType: "Reading",
    description: "Ramakrishnan, E. V. Making It New: Modernism in Malayalam, Marathi and Hindi Poetry. Indian Institute of Advanced Study, 1995.",
    remarks: "Pp. 24-27"
  },
  // --- Jan 22, 2026 ---
  {
    id: "jan-22-s1",
    date: "2026-01-22",
    timeSlot: "11:00 to 2:00",
    activityType: "Department Work",
    description: "Poster for a National Conference from 20-22 March",
    remarks: "Fixing the broken link to the Google form."
  },
  {
    id: "jan-22-s2",
    date: "2026-01-22",
    timeSlot: "3:00 to 5:00",
    activityType: "Mentoring",
    description: "Mentored a PG student.",
    remarks: "-"
  },
  // --- Jan 23, 2026 ---
  {
    id: "jan-23-s1",
    date: "2026-01-23",
    timeSlot: "11:00 to 2:00",
    activityType: "Reading",
    description: "Ramakrishnan, E. V. Making It New: Modernism in Malayalam, Marathi and Hindi Poetry. Indian Institute of Advanced Study, 1995.",
    remarks: "Pp. 27-30"
  },
  {
    id: "jan-23-s2",
    date: "2026-01-23",
    timeSlot: "3:00 to 5:00",
    activityType: "Reading",
    description: "Ramakrishnan, E. V. Making It New: Modernism in Malayalam, Marathi and Hindi Poetry. Indian Institute of Advanced Study, 1995.",
    remarks: "Pp. 30-32"
  },
  // [Jan 24, 25, 26 are 4th Saturday, Sunday, Republic Day: skipped]
  // --- Jan 27, 2026 ---
  {
    id: "jan-27-s1",
    date: "2026-01-27",
    timeSlot: "11:00 to 2:00",
    activityType: "Reading",
    description: "Ramakrishnan, E. V. Making It New: Modernism in Malayalam, Marathi and Hindi Poetry. Indian Institute of Advanced Study, 1995.",
    remarks: "Pp. 32-35"
  },
  {
    id: "jan-27-s2",
    date: "2026-01-27",
    timeSlot: "3:00 to 5:00",
    activityType: "Reading",
    description: "Ramakrishnan, E. V. Making It New: Modernism in Malayalam, Marathi and Hindi Poetry. Indian Institute of Advanced Study, 1995.",
    remarks: "Pp. 35-37"
  },
  // --- Jan 28, 2026 ---
  {
    id: "jan-28-s1",
    date: "2026-01-28",
    timeSlot: "11:00 to 2:00",
    activityType: "Reading",
    description: "Ramakrishnan, E. V. Making It New: Modernism in Malayalam, Marathi and Hindi Poetry. Indian Institute of Advanced Study, 1995.",
    remarks: "Pp. 37-40"
  },
  {
    id: "jan-28-s2",
    date: "2026-01-28",
    timeSlot: "3:00 to 5:00",
    activityType: "Reading",
    description: "Ramakrishnan, E. V. Making It New: Modernism in Malayalam, Marathi and Hindi Poetry. Indian Institute of Advanced Study, 1995.",
    remarks: "Pp. 40-42"
  },
  // --- Jan 29, 2026 ---
  {
    id: "jan-29-s1",
    date: "2026-01-29",
    timeSlot: "11:00 to 2:00",
    activityType: "Reading",
    description: "Ramakrishnan, E. V. Making It New: Modernism in Malayalam, Marathi and Hindi Poetry. Indian Institute of Advanced Study, 1995.",
    remarks: "Pp. 35-43"
  },
  {
    id: "jan-29-s2",
    date: "2026-01-29",
    timeSlot: "3:00 to 5:00",
    activityType: "Mentoring",
    description: "Mentored a PG student.",
    remarks: "-"
  },
  // --- Jan 30, 2026 ---
  {
    id: "jan-30-s1",
    date: "2026-01-30",
    timeSlot: "11:00 to 2:00",
    activityType: "Leave",
    description: "Attempting the exam for CBSE Assistant Professor at Ahmedabad",
    remarks: "-"
  },
  {
    id: "jan-30-s2",
    date: "2026-01-30",
    timeSlot: "3:00 to 5:00",
    activityType: "Leave",
    description: "Attempting the exam for CBSE Assistant Professor at Ahmedabad",
    remarks: "-"
  },
  // --- Jan 31, 2026 (5th Saturday) ---
  {
    id: "jan-31-s1",
    date: "2026-01-31",
    timeSlot: "11:00 to 2:00",
    activityType: "Leave",
    description: "Attempting the exam for CBSE Assistant Professor at Ahmedabad",
    remarks: "-"
  },
  {
    id: "jan-31-s2",
    date: "2026-01-31",
    timeSlot: "3:00 to 5:00",
    activityType: "Leave",
    description: "Attempting the exam for CBSE Assistant Professor at Ahmedabad",
    remarks: ""
  }
];
