/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calendar as CalendarIcon, 
  User, 
  GraduationCap, 
  BookOpen, 
  UserCheck, 
  Clock, 
  Search, 
  Download, 
  Upload, 
  Printer, 
  Plus, 
  Trash2, 
  Copy, 
  Sparkles, 
  Settings, 
  ChevronRight, 
  Check, 
  FileSpreadsheet, 
  Maximize2, 
  Info,
  CalendarDays,
  FileText,
  AlertCircle,
  HelpCircle,
  RotateCcw,
  Edit2,
  Cloud,
  Lock,
  Mail,
  RefreshCw,
  LogOut,
  UserPlus,
  X,
  ExternalLink
} from 'lucide-react';
import { ScholarMetadata, LogEntry, Holiday } from './types';
import { TEMPLATE_SCHOLAR, PRELOADED_LOG_ENTRIES, INITIAL_HOLIDAYS } from './prepopulatedData';
import { parseCSV, unparseCSV } from './csvHelper';
import { getDayStatus, generateMonthTemplate, getHolidaysForMonth } from './calendarUtils';
import { syncToGoogleSheets } from './googleSheetsService';
import { 
  auth, 
  saveScholarToCloud, 
  loadScholarFromCloud, 
  saveHolidaysToCloud, 
  loadHolidaysFromCloud, 
  saveEntriesToCloud, 
  loadEntriesFromCloud 
} from './firebase';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';

export default function App() {
  // --- Core State ---
  const [scholar, setScholar] = useState<ScholarMetadata>(() => {
    const saved = localStorage.getItem('jrf_scholar_meta');
    return saved ? JSON.parse(saved) : TEMPLATE_SCHOLAR;
  });

  const [entries, setEntries] = useState<LogEntry[]>(() => {
    const saved = localStorage.getItem('jrf_logs_entries');
    return saved ? JSON.parse(saved) : PRELOADED_LOG_ENTRIES;
  });

  const [holidays, setHolidays] = useState<Holiday[]>(() => {
    const saved = localStorage.getItem('jrf_holidays');
    return saved ? JSON.parse(saved) : INITIAL_HOLIDAYS;
  });

  // --- Cloud Sync & Authentication State ---
  const [user, setUser] = useState<any>(null);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [cloudLastSaved, setCloudLastSaved] = useState<string>('');
  const [authLoading, setAuthLoading] = useState(true);
  const [authErrorAlert, setAuthErrorAlert] = useState<string>('');


  // --- UI Controls State ---
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(() => new Date().getMonth());
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [editingScholar, setEditingScholar] = useState<boolean>(false);
  const [csvInput, setCsvInput] = useState<string>('');
  const [showCsvBox, setShowCsvBox] = useState<boolean>(false);
  const [showPrintView, setShowPrintView] = useState<boolean>(false);
  const [showHolidaysEditor, setShowHolidaysEditor] = useState<boolean>(false);
  
  // --- Rich Custom Entry Builder State ---
  const [showEntryBuilder, setShowEntryBuilder] = useState<boolean>(false);
  const [builderDay, setBuilderDay] = useState<number>(() => new Date().getDate());
  const [builderTimeSlot, setBuilderTimeSlot] = useState<string>("11:00 to 2:00");
  const [builderActivityType, setBuilderActivityType] = useState<string>("Reading");
  const [builderDescription, setBuilderDescription] = useState<string>("");
  const [builderRemarks, setBuilderRemarks] = useState<string>("-");
  const [builderMultiDaySelect, setBuilderMultiDaySelect] = useState<boolean>(false);
  const [builderSelectedDays, setBuilderSelectedDays] = useState<number[]>([]);
  
  // Bulk Selection State
  const [selectedEntryIds, setSelectedEntryIds] = useState<string[]>([]);

  // Default builderDay to today's date if it fits in selected month, otherwise default to 1
  useEffect(() => {
    const today = new Date();
    if (today.getFullYear() === selectedYear && today.getMonth() === selectedMonth) {
      const maxDays = new Date(selectedYear, selectedMonth + 1, 0).getDate();
      setBuilderDay(today.getDate() <= maxDays ? today.getDate() : 1);
    } else {
      setBuilderDay(1);
    }
  }, [selectedYear, selectedMonth, showEntryBuilder]);
  
  // Custom slots config
  const [slot1Hours, setSlot1Hours] = useState<string>("11:00 to 2:00");
  const [slot2Hours, setSlot2Hours] = useState<string>("3:00 to 5:00");

  // Google Sheets Access Token (for manual copy-paste OAuth sync fallback)
  const [googleAccessToken, setGoogleAccessToken] = useState<string>(() => {
    return localStorage.getItem('gapi_access_token') || '';
  });
  const [showGoogleSyncCard, setShowGoogleSyncCard] = useState<boolean>(false);
  const [syncingStatus, setSyncingStatus] = useState<string>('');
  const [syncedSheetUrl, setSyncedSheetUrl] = useState<string>('');

  // --- IFrame-Safe Custom Alert & Confirm Modals State ---
  const [modalConfig, setModalConfig] = useState<{
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void;
  } | null>(null);

  const [alertConfig, setAlertConfig] = useState<{
    title: string;
    message: string;
  } | null>(null);

  const triggerConfirm = (title: string, message: string, onConfirm: () => void, confirmLabel = "Confirm", cancelLabel = "Cancel") => {
    setModalConfig({ title, message, onConfirm, confirmLabel, cancelLabel });
  };

  const triggerAlert = (title: string, message: string) => {
    setAlertConfig({ title, message });
  };

  // Bulk Edit helper state
  const [bulkActivityType, setBulkActivityType] = useState<string>('Reading');
  const [bulkDesc, setBulkDesc] = useState<string>('');

  // Save to LocalStorage on changes
  useEffect(() => {
    localStorage.setItem('jrf_scholar_meta', JSON.stringify(scholar));
  }, [scholar]);

  useEffect(() => {
    localStorage.setItem('jrf_logs_entries', JSON.stringify(entries));
  }, [entries]);

  useEffect(() => {
    localStorage.setItem('jrf_holidays', JSON.stringify(holidays));
  }, [holidays]);

  useEffect(() => {
    localStorage.setItem('gapi_access_token', googleAccessToken);
  }, [googleAccessToken]);

  // --- Firebase Cloud Sync Realtime Engine ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
      
      if (currentUser) {
        // Automatically check and pull cloud data
        try {
          setCloudSyncStatus('saving');
          const cloudScholar = await loadScholarFromCloud(currentUser.uid);
          const cloudHolidays = await loadHolidaysFromCloud(currentUser.uid);
          const cloudEntries = await loadEntriesFromCloud(currentUser.uid);
          
          if (cloudScholar || (cloudEntries && cloudEntries.length > 0) || cloudHolidays) {
            // Found existing cloud backup, overwrite the local state
            if (cloudScholar) setScholar(cloudScholar);
            if (cloudHolidays) setHolidays(cloudHolidays);
            if (cloudEntries) setEntries(cloudEntries);
          } else {
            // First time auth: Back up local state to the cloud
            await saveScholarToCloud(currentUser.uid, scholar);
            await saveHolidaysToCloud(currentUser.uid, holidays);
            await saveEntriesToCloud(currentUser.uid, entries);
          }
          setCloudSyncStatus('saved');
          setCloudLastSaved(new Date().toLocaleTimeString());
        } catch (err: any) {
          console.error("Cloud initialize error:", err);
          setCloudSyncStatus('error');
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Auto-backup to Cloud when scholar metadata modifies
  useEffect(() => {
    if (!user) return;
    const delayDebounce = setTimeout(async () => {
      try {
        setCloudSyncStatus('saving');
        await saveScholarToCloud(user.uid, scholar);
        setCloudSyncStatus('saved');
        setCloudLastSaved(new Date().toLocaleTimeString());
      } catch (err: any) {
        console.error("Scholar cloud save err:", err);
        setCloudSyncStatus('error');
      }
    }, 1500);
    return () => clearTimeout(delayDebounce);
  }, [scholar, user]);

  // Auto-backup to Cloud when holidays modify
  useEffect(() => {
    if (!user) return;
    const delayDebounce = setTimeout(async () => {
      try {
        setCloudSyncStatus('saving');
        await saveHolidaysToCloud(user.uid, holidays);
        setCloudSyncStatus('saved');
        setCloudLastSaved(new Date().toLocaleTimeString());
      } catch (err: any) {
        console.error("Holidays cloud save err:", err);
        setCloudSyncStatus('error');
      }
    }, 1500);
    return () => clearTimeout(delayDebounce);
  }, [holidays, user]);

  // Auto-backup to Cloud when entries modify
  // 2 second debounce to prevent excessive writes while typing
  useEffect(() => {
    if (!user) return;
    const delayDebounce = setTimeout(async () => {
      try {
        setCloudSyncStatus('saving');
        await saveEntriesToCloud(user.uid, entries);
        setCloudSyncStatus('saved');
        setCloudLastSaved(new Date().toLocaleTimeString());
      } catch (err: any) {
        console.error("Entries cloud save err:", err);
        setCloudSyncStatus('error');
      }
    }, 2000);
    return () => clearTimeout(delayDebounce);
  }, [entries, user]);

  const handleGoogleSignIn = async () => {
    setAuthErrorAlert('');
    setCloudSyncStatus('saving');
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      console.error(err);
      let errMsg = err.message || String(err);
      if (err.code === 'auth/popup-blocked') {
        errMsg = "The sign-in popup was blocked by your browser. Please allow popups for this site or open the app in a new tab.";
      } else if (err.code === 'auth/cancelled-popup-request') {
        errMsg = "Sign-in popup was closed before completion.";
      }
      setAuthErrorAlert(errMsg);
      setCloudSyncStatus('error');
    }
  };

  const handleCloudSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail.trim() || !authPassword.trim()) {
      setAuthErrorAlert("Please enter both email and password.");
      return;
    }
    setAuthErrorAlert('');
    setCloudSyncStatus('saving');
    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, authEmail.trim(), authPassword.trim());
        triggerAlert("Account Created", "Your new Cloud sync account has been created and your current JRF data has been uploaded!");
      } else {
        await signInWithEmailAndPassword(auth, authEmail.trim(), authPassword.trim());
      }
    } catch (err: any) {
      console.error(err);
      let errMsg = err.message || String(err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        errMsg = "Invalid email or password. Please try again.";
      } else if (err.code === 'auth/weak-password') {
        errMsg = "Password should be at least 6 characters long.";
      } else if (err.code === 'auth/email-already-in-use') {
        errMsg = "This email is already registered. Please sign in instead.";
      } else if (err.code === 'auth/invalid-email') {
        errMsg = "Please enter a valid email address.";
      }
      setAuthErrorAlert(errMsg);
      setCloudSyncStatus('error');
    }
  };

  const handleCloudSignOut = async () => {
    triggerConfirm(
      "Sign Out?",
      "Are you sure you want to sign out from your Cloud Sync account on this device? Your changes will remain stored locally.",
      async () => {
        try {
          await signOut(auth);
          setUser(null);
          setAuthEmail('');
          setAuthPassword('');
          setCloudSyncStatus('idle');
          triggerAlert("Signed Out", "Successfully signed out. Your updates will be stored offline on this device.");
        } catch (err: any) {
          triggerAlert("Error", "Failed to sign out cleanly.");
        }
      }
    );
  };

  const handleManualForceSyncLocalToCloud = async () => {
    if (!user) return;
    try {
      setCloudSyncStatus('saving');
      await saveScholarToCloud(user.uid, scholar);
      await saveHolidaysToCloud(user.uid, holidays);
      await saveEntriesToCloud(user.uid, entries);
      setCloudSyncStatus('saved');
      setCloudLastSaved(new Date().toLocaleTimeString());
    } catch (err: any) {
      triggerAlert("Sync Failed", "Could not backup to the Cloud: " + (err.message || err));
      setCloudSyncStatus('error');
    }
  };

  const handleManualFetchCloudToLocal = async () => {
    if (!user) return;
    triggerConfirm(
      "Overwrite with Cloud version?",
      "Warning: This will completely replace your current local entries on this device with what's stored on your Cloud backup account. Do you want to continue?",
      async () => {
        try {
          setCloudSyncStatus('saving');
          const cloudScholar = await loadScholarFromCloud(user.uid);
          const cloudHolidays = await loadHolidaysFromCloud(user.uid);
          const cloudEntries = await loadEntriesFromCloud(user.uid);
          
          if (cloudScholar) setScholar(cloudScholar);
          if (cloudHolidays) setHolidays(cloudHolidays);
          if (cloudEntries) setEntries(cloudEntries);
          
          setCloudSyncStatus('saved');
          setCloudLastSaved(new Date().toLocaleTimeString());
          triggerAlert("Sync Restoration", "Successfully restored scholar profile, custom holidays, and entries from the cloud!");
        } catch (err: any) {
          triggerAlert("Fetch Failed", "Failed to retrieve from Cloud: " + (err.message || err));
          setCloudSyncStatus('error');
        }
      }
    );
  };


  // --- Calendar Info & Statistics for Selected Month ---
  const monthInfo = useMemo(() => {
    const year = selectedYear;
    const month = selectedMonth;

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let totalSundays = 0;
    let totalEvenSaturdays = 0;
    let totalWorkingDays = 0;
    let activeHolidays: Holiday[] = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const curDate = new Date(year, month, day);
      const status = getDayStatus(curDate, holidays, true, true);
      
      const dayOfWeek = curDate.getDay();
      if (dayOfWeek === 0) totalSundays++;
      else if (dayOfWeek === 6 && status.saturdayIndex && (status.saturdayIndex === 2 || status.saturdayIndex === 4)) {
        totalEvenSaturdays++;
      }

      const dateStr = curDate.toISOString().split('T')[0];
      const hol = holidays.find(h => h.date === dateStr);
      if (hol) {
        activeHolidays.push(hol);
      }

      if (status.isWorkingDay) {
        totalWorkingDays++;
      }
    }

    return {
      daysInMonth,
      totalSundays,
      totalEvenSaturdays,
      totalWorkingDays,
      activeHolidays
    };
  }, [selectedYear, selectedMonth, holidays]);

  // --- Filter and Sort Entries ---
  const currentMonthEntries = useMemo(() => {
    const monthPrefix = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
    
    // Filter matching month
    let filtered = entries.filter((e) => e.date.startsWith(monthPrefix));
    
    // Sort chronologically then by slot
    filtered.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.timeSlot.localeCompare(b.timeSlot);
    });

    // Apply keyword search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((e) => 
        e.activityType.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        e.remarks.toLowerCase().includes(q) ||
        e.date.includes(q)
      );
    }

    return filtered;
  }, [entries, selectedYear, selectedMonth, searchQuery]);

  // --- Handler Functions ---

  // Generate blank working calendar for the select month
  const handleGenerateTemplate = () => {
    const runGeneration = () => {
      const templateEntries = generateMonthTemplate(
        selectedYear,
        selectedMonth,
        holidays,
        true, // Exclude Sundays
        true, // Exclude 2nd & 4th Saturdays
        slot1Hours,
        slot2Hours
      );

      // Filter out existing and merge
      const monthPrefix = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
      const clearedOtherMonths = entries.filter(e => !e.date.startsWith(monthPrefix));
      
      setEntries([...clearedOtherMonths, ...templateEntries]);
    };

    const hasExisting = entries.some(e => e.date.startsWith(`${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`));
    if (hasExisting) {
      triggerConfirm(
        "Generate Template?",
        "Warning: This will overwrite or reset logged entries for the selected month. Do you want to continue?",
        runGeneration
      );
    } else {
      runGeneration();
    }
  };

  // Pre-seeded Reset
  const handleResetToPreseeded = () => {
    triggerConfirm(
      "Restore Original Data?",
      "Restore original preloaded January 2026 data from Harwin's JRF work record?",
      () => {
        setScholar(TEMPLATE_SCHOLAR);
        setEntries(PRELOADED_LOG_ENTRIES);
        setHolidays(INITIAL_HOLIDAYS);
        setSelectedYear(2026);
        setSelectedMonth(0);
      }
    );
  };

  // Add a manual entry (for cases where they worked on weekends etc)
  const handleAddCustomEntry = () => {
    const defaultDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`;
    const newEntry: LogEntry = {
      id: `custom-${Date.now()}`,
      date: defaultDate,
      timeSlot: "11:00 to 2:00",
      activityType: "Reading",
      description: "",
      remarks: "-"
    };
    setEntries([newEntry, ...entries]);
  };

  // Feature-rich customized log entry creator supporting multiple days & collision awareness
  const handleAddRichEntries = () => {
    const monthStr = String(selectedMonth + 1).padStart(2, '0');
    
    const daysToCreate: number[] = builderMultiDaySelect
      ? [...builderSelectedDays].sort((a, b) => a - b)
      : [builderDay];

    if (daysToCreate.length === 0) {
      triggerAlert("Selection Error", "Please select at least one day of the month!");
      return;
    }

    if (!builderDescription.trim()) {
      triggerAlert("Validation Notice", "Please write a detailed work description first. High-quality descriptions are required for university logs.");
      return;
    }

    const newLogs: LogEntry[] = [];
    const duplicatesList: string[] = [];

    daysToCreate.forEach((dayNum) => {
      const fullDateStr = `${selectedYear}-${monthStr}-${String(dayNum).padStart(2, '0')}`;
      
      const hasCollision = entries.some(e => e.date === fullDateStr && e.timeSlot === builderTimeSlot);
      if (hasCollision) {
        duplicatesList.push(String(dayNum));
      }

      newLogs.push({
        id: `rich-${Date.now()}-${dayNum}-${Math.random().toString(36).substring(2, 5)}`,
        date: fullDateStr,
        timeSlot: builderTimeSlot,
        activityType: builderActivityType,
        description: builderDescription.trim(),
        remarks: builderRemarks.trim() || "-"
      });
    });

    setEntries(prev => [...newLogs, ...prev]);

    // Keep state clean but useful
    setBuilderDescription("");
    setBuilderRemarks("-");
    setBuilderSelectedDays([]);
    
    let message = `Successfully added ${newLogs.length} JRF log entries.`;
    if (duplicatesList.length > 0) {
      message += ` (Note: Log lines already existed on days: ${duplicatesList.join(', ')} for slot "${builderTimeSlot}")`;
    }
    
    triggerAlert("Entries Added", message);
    setShowEntryBuilder(false);
  };

  // Bulk Selection Handlers
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const newIds = new Set(selectedEntryIds);
      currentMonthEntries.forEach(entry => newIds.add(entry.id));
      setSelectedEntryIds(Array.from(newIds));
    } else {
      const currentIds = new Set(currentMonthEntries.map(e => e.id));
      setSelectedEntryIds(prev => prev.filter(id => !currentIds.has(id)));
    }
  };

  const handleSelectRow = (e: React.ChangeEvent<HTMLInputElement>, id: string) => {
    if (e.target.checked) {
      setSelectedEntryIds(prev => [...prev, id]);
    } else {
      setSelectedEntryIds(prev => prev.filter(eid => eid !== id));
    }
  };

  const handleBulkDelete = () => {
    if (selectedEntryIds.length === 0) return;
    triggerConfirm(
      "Delete Selected Rows?",
      `Are you sure you want to delete ${selectedEntryIds.length} log ${selectedEntryIds.length === 1 ? 'entry' : 'entries'} permanently?`,
      () => {
        setEntries(prev => prev.filter(e => !selectedEntryIds.includes(e.id)));
        setSelectedEntryIds([]);
      }
    );
  };

  const handleBulkUpdateActivity = (activityType: string) => {
    if (selectedEntryIds.length === 0) return;
    setEntries(prev => prev.map(e => 
      selectedEntryIds.includes(e.id) ? { ...e, activityType } : e
    ));
    triggerAlert("Bulk Update", `Activity type updated for ${selectedEntryIds.length} entries.`);
  };

  // Delete a specific entry
  const handleDeleteEntry = (id: string) => {
    triggerConfirm(
      "Remove Row?",
      "Remove this work log row permanently?",
      () => {
        setEntries(entries.filter(e => e.id !== id));
      }
    );
  };

  // Update a single field in the entry cell
  const handleCellChange = (id: string, field: keyof LogEntry, value: string) => {
    setEntries(prev => prev.map(e => e.id === id ? { ...e, [field]: value } : e));
  };

  // Quick Duplicate of Description from Row Above
  const handleCopyPrevRow = (currentIndex: number) => {
    if (currentIndex <= 0) return;
    const prevEntry = currentMonthEntries[currentIndex - 1];
    const currentEntry = currentMonthEntries[currentIndex];
    
    handleCellChange(currentEntry.id, 'description', prevEntry.description);
    handleCellChange(currentEntry.id, 'activityType', prevEntry.activityType);
    handleCellChange(currentEntry.id, 'remarks', prevEntry.remarks);
  };

  // Bulk fill entries of selection with text
  const handleBulkFill = () => {
    if (!bulkDesc.trim()) {
      triggerAlert("Information Needed", "Please enter a description for the bulk fill.");
      return;
    }
    if (currentMonthEntries.length === 0) {
      triggerAlert("No Logs Found", "No logs available to fill for this month. Generate a template first!");
      return;
    }

    triggerConfirm(
      "Bulk Fill Logs?",
      `Populate ALL EMPTY descriptions in ${selectedMonthName} with "${bulkDesc.trim()}"?`,
      () => {
        setEntries(prev => prev.map(e => {
          const isCurrentMonth = e.date.startsWith(`${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`);
          if (isCurrentMonth && !e.description.trim()) {
            return {
              ...e,
              activityType: bulkActivityType,
              description: bulkDesc.trim(),
              remarks: "-"
            };
          }
          return e;
        }));
        setBulkDesc('');
      }
    );
  };

  // Sync to Google Sheets
  const handleSheetsSync = async () => {
    if (!googleAccessToken) {
      triggerAlert(
        "OAuth Token Required",
        "Please paste your Google OAuth Access Token first (available after consenting above) into the Settings card below."
      );
      setShowGoogleSyncCard(true);
      return;
    }

    setSyncingStatus('Initiating sync process...');
    setSyncedSheetUrl('');

    try {
      const monthLabel = `${selectedMonthName} ${selectedYear}`;
      const res = await syncToGoogleSheets(googleAccessToken, scholar, currentMonthEntries, monthLabel);
      setSyncingStatus('Success!');
      setSyncedSheetUrl(res.spreadsheetUrl);
    } catch (err: any) {
      console.error(err);
      setSyncingStatus(`Failed: ${err.message || 'Unknown error occurred. Double-check your access token.'}`);
    }
  };

  // Export metadata & logs as standard CSV download
  const handleExportCSV = () => {
    const csvContent = unparseCSV(scholar, currentMonthEntries);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `JRF_Work_Log_${selectedMonthName}_${selectedYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Parse and Ingest typed/uploaded CSV text
  const handleImportCSV = () => {
    if (!csvInput.trim()) {
      triggerAlert("Empty Input", "Please paste some valid JRF CSV text or upload a CSV file into the text-area first.");
      return;
    }

    try {
      const { scholar: parsedScholar, entries: parsedEntries } = parseCSV(csvInput);
      
      if (parsedScholar.name) {
        setScholar(prev => ({
          ...prev,
          ...parsedScholar
        }));
      }

      if (parsedEntries.length > 0) {
        // Map parsed entries into complete LogEntries with temp IDs
        const newLogEntries: LogEntry[] = parsedEntries.map((e, idx) => ({
          id: `imported-${Date.now()}-${idx}`,
          date: e.date,
          timeSlot: e.timeSlot,
          activityType: e.activityType,
          description: e.description,
          remarks: e.remarks
        }));

        // Merge with current entries (avoiding total loss if importing other months)
        // Or if it overwrites the same month:
        const firstParsedDate = parsedEntries[0].date;
        const targetMonthPrefix = firstParsedDate.substring(0, 7); // YYYY-MM
        
        // Remove existing items with same month prefix and merge new ones
        const keptEntries = entries.filter((e) => !e.date.startsWith(targetMonthPrefix));
        setEntries([...keptEntries, ...newLogEntries]);

        // Attempt to auto-adjust dropdowns to imported month
        const [yearStr, monthStr] = targetMonthPrefix.split('-');
        setSelectedYear(parseInt(yearStr));
        setSelectedMonth(parseInt(monthStr) - 1);

        triggerAlert("Import Successful", `Successfully imported ${parsedEntries.length} log rows for month ${targetMonthPrefix}!`);
        setShowCsvBox(false);
        setCsvInput('');
      } else {
        triggerAlert("Empty Content", "Failed to find any valid log rows inside the CSV data. Please check headers 'Date,Time Slot,Activity Type,Detailed Description of Work,Remarks'.");
      }
    } catch (err: any) {
      triggerAlert("Import Error", `Invalid JRF work-log CSV: ${err.message || err}`);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvInput(text);
      setShowCsvBox(true);
    };
    reader.readAsText(file);
  };

  // Holiday Editor Helpers
  const handleAddHoliday = (date: string, name: string) => {
    if (!date || !name) return;
    if (holidays.some(h => h.date === date)) {
      triggerAlert("ConflictError", "A holiday already exists for this date.");
      return;
    }
    setHolidays([...holidays, { date, name }]);
  };

  const handleRemoveHoliday = (date: string) => {
    setHolidays(holidays.filter(h => h.date !== date));
  };

  // Selected Month name
  const selectedMonthName = useMemo(() => {
    return new Date(selectedYear, selectedMonth, 1).toLocaleDateString('en-US', { month: 'long' });
  }, [selectedYear, selectedMonth]);

  return (
    <div id="jrf-app-container" className="min-h-screen bg-[#0F1115] text-[#E0E0E0] font-sans antialiased">
      
      {/* ⚠️ Print-only Layout containing pristine official formatting */}
      <div className={`${showPrintView ? 'block bg-gray-100 min-h-screen py-10 px-4 print:bg-transparent print:py-0 print:px-0' : 'hidden print:block'} w-full`}>
        {showPrintView && (
          <div className="print:hidden max-w-4xl mx-auto mb-8 bg-blue-50 border border-blue-200 text-blue-900 p-6 rounded-xl flex flex-col gap-4 shadow-md leading-relaxed">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <Printer className="w-5 h-5 text-blue-600"/> 
              Ready to Print Logbook
            </h3>
            <p className="text-sm border-b border-blue-200/50 pb-3">
              To print this report cleanly <strong>without any AI Studio menus or headers</strong> included, please follow these steps:
            </p>
            <ol className="list-decimal list-inside text-sm space-y-2 ml-2 font-medium">
              <li>Open this app in a <strong>standalone tab</strong> (you can <a href={window.location.href} target="_blank" rel="noopener noreferrer" className="text-blue-600 font-bold underline hover:text-blue-800">click here to open instantly</a> or use the "Open in new tab" key in AI Studio).</li>
              <li>Once in the new tab, click the <strong>Print Monthly Report</strong> button again.</li>
              <li>Or simply press <strong>Cmd+P</strong> (Mac) or <strong>Ctrl+P</strong> (Windows) in the new tab.</li>
            </ol>
            <div className="flex flex-wrap items-center gap-3 mt-4 pt-4 border-t border-blue-200/50">
              <button 
                onClick={() => {try { window.print(); } catch(e) {}}}
                className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-semibold text-sm transition-colors flex items-center gap-2 shadow-sm"
              >
                <Printer className="w-4 h-4" /> Try Printing Now
              </button>
              <a 
                href={window.location.href} 
                target="_blank" 
                rel="noopener noreferrer"
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-lg font-semibold text-sm transition-colors flex items-center gap-2 shadow-sm"
              >
                <ExternalLink className="w-4 h-4" /> Open Standalone Tab
              </a>
              <button 
                onClick={() => setShowPrintView(false)}
                className="bg-white hover:bg-gray-50 border border-blue-200 text-blue-800 px-5 py-2.5 rounded-lg font-semibold text-sm transition-colors shadow-sm"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        )}
        
        {/* Actual Printable Document Container */}
        <div className={`w-full max-w-4xl mx-auto px-6 py-6 bg-white text-black leading-relaxed ${showPrintView ? 'shadow-2xl rounded-sm border border-gray-300 print:shadow-none print:border-none print:rounded-none' : ''}`}>
          <style>{`
            @media print {
              @page { size: auto; margin: 15mm 10mm; }
              body { -webkit-print-color-adjust: exact; }
            }
          `}</style>
          <div className="text-center border-b-2 border-gray-800 pb-1.5 mb-2.5">
          <h1 className="text-base font-serif font-extrabold uppercase tracking-wide">
            {scholar.university}
          </h1>
          <p className="text-[10px] font-semibold tracking-wide text-gray-700 uppercase mt-0.5">
            {scholar.department}
          </p>
          <div className="border-t border-gray-300 my-0.5"></div>
          <h2 className="text-xs font-bold font-serif uppercase tracking-widest text-[#111827]">
            Monthly Progress & Attendance Log of JRF Scholar
          </h2>
          <p className="text-[10px] italic text-gray-600 mt-0.5">
            For the Month of <span className="font-bold border-b border-black px-2">{selectedMonthName}, {selectedYear}</span>
          </p>
        </div>

        {/* Scholar Meta Info Panel for printing */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 text-[10px] border border-gray-300 p-2 rounded-md mb-2.5 bg-slate-50/50">
          <div><p><strong className="uppercase tracking-wider text-gray-500">Name of Scholar:</strong> <span className="font-medium text-black">{scholar.name}</span></p></div>
          <div><p><strong className="uppercase tracking-wider text-gray-500">Designation:</strong> <span className="font-medium text-black">{scholar.designation}</span></p></div>
          <div><p><strong className="uppercase tracking-wider text-gray-500">Department:</strong> <span className="font-medium text-black">{scholar.department}</span></p></div>
          <div><p><strong className="uppercase tracking-wider text-gray-500">Guide Supervisor:</strong> <span className="font-medium text-black">{scholar.guide}</span></p></div>
          <div className="col-span-2"><p><strong className="uppercase tracking-wider text-gray-500">Research Topic:</strong> <span className="font-medium text-black">{scholar.researchTopic}</span></p></div>
          <div><p><strong className="uppercase tracking-wider text-gray-500">Official Hours:</strong> <span className="font-medium text-black">{scholar.workingHours}</span></p></div>
          <div><p><strong className="uppercase tracking-wider text-gray-500">Recess Interval:</strong> <span className="font-medium text-black">{scholar.recess}</span></p></div>
        </div>

        {/* Print table */}
        <table className="w-full border-collapse border border-gray-400 text-[10px] text-left mb-6">
          <thead>
            <tr className="bg-gray-100 uppercase text-[8px] tracking-wider text-gray-800">
              <th className="border border-gray-400 p-1 w-[150px]">Date & Working Day</th>
              <th className="border border-gray-400 p-1 w-[90px]">Time Slot</th>
              <th className="border border-gray-400 p-1 w-[110px]">Activity Type</th>
              <th className="border border-gray-400 p-1">Detailed Description of Work Done</th>
              <th className="border border-gray-400 p-1 w-[110px]">Remarks</th>
            </tr>
          </thead>
          <tbody>
            {currentMonthEntries.map((e, idx) => {
              const d = new Date(e.date);
              const dayOfWeek = d.toLocaleDateString('en-US', { weekday: 'long' });
              const monthNameStr = d.toLocaleDateString('en-US', { month: 'short' });
              const formattedDateString = `${dayOfWeek}, ${monthNameStr} ${String(d.getDate()).padStart(2, '0')}`;

              return (
                <tr key={e.id} className="hover:bg-slate-50/50">
                  <td className="border border-gray-400 p-1 font-medium bg-slate-50/20">{formattedDateString}, {d.getFullYear()}</td>
                  <td className="border border-gray-400 p-1 text-gray-800 tabular-nums">{e.timeSlot}</td>
                  <td className="border border-gray-400 p-1 font-semibold text-slate-800">{e.activityType || "-"}</td>
                  <td className="border border-gray-400 p-1 whitespace-pre-line text-black font-serif leading-tight">{e.description || "— No Work Performed / Leave —"}</td>
                  <td className="border border-gray-400 p-1 text-gray-700 italic leading-tight">{e.remarks || "-"}</td>
                </tr>
              );
            })}
            {currentMonthEntries.length === 0 && (
              <tr>
                <td colSpan={5} className="border border-gray-400 p-8 text-center text-gray-400 italic">
                  No active logs recorded or generated for this month period. Ensure that weekends and holidays were processed.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Signatures block */}
        <div className="grid grid-cols-3 gap-8 mt-16 pt-8 border-t border-dashed border-gray-300 text-center text-xs">
          <div>
            <p className="font-bold text-gray-800 mb-14">Harwin Popat</p>
            <p className="border-t border-gray-400 pt-2 font-semibold uppercase text-gray-600 text-[10px] tracking-widest">
              Signature of JRF Scholar
            </p>
          </div>
          <div>
            <p className="font-bold text-gray-800 mb-14">{scholar.guide}</p>
            <p className="border-t border-gray-400 pt-2 font-semibold uppercase text-gray-600 text-[10px] tracking-widest">
              Signature of Research Guide
            </p>
          </div>
          <div>
            <p className="font-bold text-gray-800 mb-14">Coordinator / HoD</p>
            <p className="border-t border-gray-400 pt-2 font-semibold uppercase text-gray-600 text-[10px] tracking-widest">
              Signature of Department Chair
            </p>
          </div>
        </div>
      </div>
      </div>

      {/* 💻 Standard Application UI */}
      <div className={`${showPrintView ? 'hidden' : 'block'} print:hidden`}>
        
        {/* Navigation / Top-rail Bar */}
        <header id="app-header-nav" className="sticky top-0 z-40 bg-[#15171C]/90 backdrop-blur-md border-b border-[#2A2D35] px-4 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-blue-600/20">
              <CalendarDays className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-display font-bold text-lg text-white tracking-tight flex items-center gap-1.5">
                PhD Work-Log Planner <span className="text-xs bg-blue-500/10 text-blue-400 font-normal px-2.5 py-0.5 rounded-full border border-blue-600/20">JRF Scholar Edition</span>
              </h1>
              <p className="text-xs text-gray-400 font-mono">Saurashtra University, Rajkot</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={handleResetToPreseeded} 
              title="Reset configuration and restore Harwin's January 2026 data"
              className="text-gray-400 hover:text-white hover:bg-[#1C1F26] px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all duration-200"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Full Reset</span>
            </button>
            <a 
              href={window.location.href} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-[#38BDF8] hover:text-white hover:bg-[#1C1F26] px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all duration-200 border border-sky-400/20"
              title="Open the app in a new clean window for direct printing and full-screen JRF editing"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open Clean Tab</span>
            </a>
            <a 
              href="https://docs.google.com/spreadsheets" 
              target="_blank" 
              rel="noreferrer" 
              className="text-gray-400 hover:text-blue-400 hover:bg-[#1C1F26] px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all duration-200"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
              <span>Drive Sheets</span>
            </a>
            <button 
              onClick={() => {
                setShowPrintView(true);
                setTimeout(() => {
                  try { window.print(); } catch(e) {}
                }, 300);
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/10 px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all duration-200"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Monthly Report</span>
            </button>
          </div>
        </header>

        {/* Main Content Dashboard */}
        <main id="app-main-content" className="w-full max-w-7xl mx-auto px-4 lg:px-8 py-6 flex flex-col gap-6">

          {/* --- Multi-Device Cloud Backup & Synchronization Panel --- */}
          <section id="multi-device-backup-panel" className="bg-[#15171C] rounded-2xl border border-[#2A2D35] p-5 md:p-6 shadow-sm flex flex-col md:flex-row items-stretch justify-between gap-6 relative overflow-hidden">
            {/* Subtle background glow when syncing or active */}
            {user && (
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
            )}
            
            {/* Left side info */}
            <div className="flex-1 flex flex-col justify-between space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg ${user ? 'bg-emerald-500/10 text-emerald-400' : 'bg-blue-500/10 text-blue-400'}`}>
                    <Cloud className="w-5 h-5" />
                  </div>
                  <h2 className="text-sm font-bold tracking-tight text-white font-display uppercase flex items-center gap-2">
                    <span>Cloud Multi-Device Synchronization</span>
                    {user && (
                      <span className="text-[10px] lowercase font-normal bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-mono">
                        active
                      </span>
                    )}
                  </h2>
                </div>
                <p className="text-xs text-gray-400 leading-relaxed font-sans max-w-2xl">
                  {user 
                    ? "Your scholar profile, monthly log entries, custom holidays, and calendar settings are automatically backed up in real-time. Any changes made here sync instantly, allowing you to seamlessly fill and view your logs on another device."
                    : "Want to fill and view your monthly JRF work log entries across multiple devices without losing data? Simply register a free account to instantly back up, store, and synchronize your spreadsheet in the cloud."
                  }
                </p>
              </div>

              {user ? (
                /* Authenticated Status Indicators */
                <div className="flex flex-wrap items-center gap-y-2 gap-x-6 text-xs text-gray-300 font-sans">
                  <div>
                    <span className="text-gray-500 uppercase tracking-wider text-[10px] block font-semibold">Logged In Account</span>
                    <strong className="text-[#3b82f6]">{user.email}</strong>
                  </div>
                  <div>
                    <span className="text-gray-500 uppercase tracking-wider text-[10px] block font-semibold">Synchronization</span>
                    <span className="flex items-center gap-1.5">
                      {cloudSyncStatus === 'saving' ? (
                        <>
                          <RefreshCw className="w-3 h-3 text-blue-400 animate-spin" />
                          <span className="text-blue-400 font-semibold font-mono animate-pulse">Syncing modifications...</span>
                        </>
                      ) : cloudSyncStatus === 'error' ? (
                        <>
                          <AlertCircle className="w-3 h-3 text-red-400" />
                          <span className="text-red-400 font-bold font-mono">Sync stalled / Offline</span>
                        </>
                      ) : (
                        <>
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping shrink-0" />
                          <span className="text-emerald-400 font-bold font-mono font-semibold">Synced & secured</span>
                        </>
                      )}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 uppercase tracking-wider text-[10px] block font-semibold">Last Cloud Update</span>
                    <span className="font-mono">{cloudLastSaved ? `${cloudLastSaved}` : 'Just now'}</span>
                  </div>
                </div>
              ) : (
                /* Unauthenticated instructions block */
                <div className="flex items-center gap-2 text-xs text-gray-500 italic">
                  <Info className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span>Securely handled using Firebase authenticated database endpoints. No browser cache cleared can wipe your entries after sync.</span>
                </div>
              )}
            </div>

            {/* Right side form if unauthenticated, or action buttons if authenticated */}
            <div className="md:w-[320px] bg-[#1C1F26] border border-[#2A2D35] rounded-xl p-4 flex flex-col justify-center gap-3 shrink-0">
              {authLoading ? (
                /* Authentication Loading State */
                <div className="flex flex-col items-center justify-center py-6 gap-2 text-xs text-gray-400">
                  <RefreshCw className="w-6 h-6 text-blue-500 animate-spin" />
                  <span>Configuring Cloud connection...</span>
                </div>
              ) : user ? (
                /* Authenticated Action Controls */
                <div className="space-y-2.5">
                  <p className="text-[10px] uppercase font-bold tracking-wider text-gray-500 text-center">Cloud Synchronization Actions</p>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={handleManualForceSyncLocalToCloud}
                      title="Force upload local copy to cloud"
                      className="px-3 py-2 bg-blue-600/10 border border-blue-500/20 hover:bg-blue-600/20 text-blue-400 rounded-lg text-xs font-semibold flex flex-col items-center justify-center gap-1 transition-all"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload Force</span>
                    </button>
                    <button
                      onClick={handleManualFetchCloudToLocal}
                      title="Overwrite local data with cloud data"
                      className="px-3 py-2 bg-emerald-600/10 border border-emerald-500/20 hover:bg-emerald-600/20 text-emerald-400 rounded-lg text-xs font-semibold flex flex-col items-center justify-center gap-1 transition-all"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Cloud Fetch</span>
                    </button>
                  </div>

                  <hr className="border-[#2A2D35] my-1" />

                  <button
                    onClick={handleCloudSignOut}
                    className="w-full py-1.5 px-3 bg-[#2A2D35] hover:bg-[#343842] hover:text-white text-gray-300 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all"
                  >
                    <LogOut className="w-3.5 h-3.5 text-gray-400" />
                    <span>Sign Out Device</span>
                  </button>
                </div>
              ) : (
                /* Authentication Sign In Options */
                <div className="space-y-3.5">
                  {/* Google Login (Highly recommended & configured out of the box) */}
                  <div className="space-y-1.5 font-sans">
                    <p className="text-[9px] uppercase font-bold tracking-wider text-emerald-400">Recommended (One-Click)</p>
                    <button
                      type="button"
                      onClick={handleGoogleSignIn}
                      className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm shadow-emerald-950/20"
                    >
                      <Cloud className="w-4 h-4" />
                      <span>One-Click Google Sync</span>
                    </button>
                    <p className="text-[9px] text-gray-500 text-center leading-normal">Uses Google Identity (No manual registration steps needed)</p>
                  </div>

                  <div className="flex items-center gap-2 my-1 text-gray-500 font-sans">
                    <span className="h-px bg-[#2A2D35] flex-1"></span>
                    <span className="text-[9px] uppercase font-bold text-gray-600 font-mono">or register / log in</span>
                    <span className="h-px bg-[#2A2D35] flex-1"></span>
                  </div>

                  {/* Authentication SignUp/SignIn Form */}
                  <form onSubmit={handleCloudSignIn} className="space-y-2.5 font-sans">
                    <div className="text-[10px] uppercase font-bold tracking-wider text-gray-400 flex items-center gap-1 justify-between">
                      <span>{isSignUp ? "Create Cloud Sync Account" : "Access Cloud Logs"}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setIsSignUp(!isSignUp);
                          setAuthErrorAlert('');
                        }}
                        className="text-[#3b82f6] hover:underline text-[9px] lowercase font-semibold"
                      >
                        {isSignUp ? "switch to login" : "switch to sign up"}
                      </button>
                    </div>

                    <div className="space-y-1.5 text-xs text-white">
                      <div className="relative">
                        <Mail className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-2.5" />
                        <input
                          type="email"
                          placeholder="your.email@example.com"
                          value={authEmail}
                          onChange={(e) => setAuthEmail(e.target.value)}
                          className="w-full bg-[#15171C] text-white border border-[#2A2D35] rounded-lg pl-8 pr-2.5 py-1.5 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>
                      <div className="relative">
                        <Lock className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-2.5" />
                        <input
                          type="password"
                          placeholder="six-character password"
                          value={authPassword}
                          onChange={(e) => setAuthPassword(e.target.value)}
                          className="w-full bg-[#15171C] text-white border border-[#2A2D35] rounded-lg pl-8 pr-2.5 py-1.5 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    {authErrorAlert && (
                      <div className="text-[10px] text-red-400 font-semibold bg-red-400/5 border border-red-500/10 p-2 rounded-md leading-normal italic whitespace-pre-line space-y-1">
                        <p className="font-bold uppercase text-[9px] tracking-wider">⚠️ Sync Stalled / Intercepted:</p>
                        <p className="font-normal text-gray-300 leading-normal not-italic">{authErrorAlert}</p>
                        {authErrorAlert.includes('operation-not-allowed') && (
                          <div className="mt-1.5 p-1.5 bg-black/40 rounded border border-red-500/10 font-normal normal-case not-italic text-gray-400 leading-relaxed space-y-1 text-[9px]">
                            <p className="font-semibold text-gray-300 uppercase tracking-widest text-[8px] text-red-400">How to authorize Email/Password:</p>
                            <ol className="list-decimal pl-3.5 space-y-0.5 text-gray-300">
                              <li>Go to your Firebase Project Console.</li>
                              <li>Navigate to <b>Authentication</b> inside the sidebar.</li>
                              <li>Go to the <b>Sign-in method</b> tab.</li>
                              <li>Add & Enable <b>Email/Password</b> provider.</li>
                            </ol>
                            <p className="text-[8px] text-gray-500 italic mt-1 leading-normal">Alternatively, use the green One-Click Google Sync button above which works out-of-the-box!</p>
                          </div>
                        )}
                      </div>
                    )}

                    <button
                      type="submit"
                      className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      {isSignUp ? (
                        <>
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>Create & Sync Account</span>
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Sign In & Sync Device</span>
                        </>
                      )}
                    </button>
                  </form>
                </div>
              )}
            </div>
          </section>

          {/* Dual Scholar Profile Meta & Month Setup Panel */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Column 1 & 2: Scholar Academic Profile Metadata */}
            <section id="scholar-metadata-profile" className="lg:col-span-2 bg-[#15171C] rounded-2xl border border-[#2A2D35] shadow-sm overflow-hidden flex flex-col">
              <div className="bg-[#1C1F26] px-6 py-4 border-b border-[#2A2D35] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-blue-500" />
                  <h2 className="text-sm font-bold tracking-tight text-white font-display uppercase">Scholar Profile details</h2>
                </div>
                <button 
                  onClick={() => setEditingScholar(!editingScholar)}
                  className={`text-xs font-semibold px-3 py-1 rounded-md flex items-center gap-1 border transition-all ${
                    editingScholar ? 'bg-blue-600/20 text-blue-400 border-blue-600/30' : 'bg-[#2A2D35] text-gray-300 border-[#343842] hover:bg-[#343842] hover:text-white'
                  }`}
                >
                  <Edit2 className="w-3 h-3" />
                  <span>{editingScholar ? 'Lock Details' : 'Modify Profile'}</span>
                </button>
              </div>

              <div className="p-6 flex-1 flex flex-col justify-between gap-4">
                {editingScholar ? (
                  /* Editable Meta Form */
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div>
                      <label className="block text-gray-500 font-semibold mb-1 uppercase tracking-wider">Scholar Full Name</label>
                      <input 
                        type="text" 
                        value={scholar.name} 
                        onChange={(e) => setScholar({ ...scholar, name: e.target.value })}
                        className="w-full bg-[#1C1F26] text-white border border-[#2A2D35] rounded-lg p-2 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-500 font-semibold mb-1 uppercase tracking-wider">Designation / Role</label>
                      <input 
                        type="text" 
                        value={scholar.designation} 
                        onChange={(e) => setScholar({ ...scholar, designation: e.target.value })}
                        className="w-full bg-[#1C1F26] text-white border border-[#2A2D35] rounded-lg p-2 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-500 font-semibold mb-1 uppercase tracking-wider">Department</label>
                      <input 
                        type="text" 
                        value={scholar.department} 
                        onChange={(e) => setScholar({ ...scholar, department: e.target.value })}
                        className="w-full bg-[#1C1F26] text-white border border-[#2A2D35] rounded-lg p-2 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-500 font-semibold mb-1 uppercase tracking-wider">Research Guide supervisor</label>
                      <input 
                        type="text" 
                        value={scholar.guide} 
                        onChange={(e) => setScholar({ ...scholar, guide: e.target.value })}
                        className="w-full bg-[#1C1F26] text-white border border-[#2A2D35] rounded-lg p-2 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-gray-500 font-semibold mb-1 uppercase tracking-wider">Affiliated University</label>
                      <input 
                        type="text" 
                        value={scholar.university} 
                        onChange={(e) => setScholar({ ...scholar, university: e.target.value })}
                        className="w-full bg-[#1C1F26] text-white border border-[#2A2D35] rounded-lg p-2 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-gray-500 font-semibold mb-1 uppercase tracking-wider">Research Dissertation / Thesis Topic</label>
                      <textarea 
                        rows={2}
                        value={scholar.researchTopic} 
                        onChange={(e) => setScholar({ ...scholar, researchTopic: e.target.value })}
                        className="w-full bg-[#1C1F26] text-white border border-[#2A2D35] rounded-lg p-2 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none font-serif"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-500 font-semibold mb-1 uppercase tracking-wider">Daily Working Hours</label>
                      <input 
                        type="text" 
                        value={scholar.workingHours} 
                        onChange={(e) => setScholar({ ...scholar, workingHours: e.target.value })}
                        className="w-full bg-[#1C1F26] text-white border border-[#2A2D35] rounded-lg p-2 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-500 font-semibold mb-1 uppercase tracking-wider">Recess Break Slot</label>
                      <input 
                        type="text" 
                        value={scholar.recess} 
                        onChange={(e) => setScholar({ ...scholar, recess: e.target.value })}
                        className="w-full bg-[#1C1F26] text-white border border-[#2A2D35] rounded-lg p-2 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>
                ) : (
                  /* Display Profile details card */
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="space-y-1">
                      <p className="text-gray-500 font-semibold uppercase tracking-wider">JRF Scholar Name</p>
                      <p className="text-sm font-bold text-white">{scholar.name}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-gray-500 font-semibold uppercase tracking-wider">Academic Placement Details</p>
                      <p className="text-sm font-semibold text-gray-200">{scholar.designation}</p>
                      <p className="text-xs text-gray-400">{scholar.department}</p>
                      <p className="text-xs text-gray-500 leading-normal">{scholar.university}</p>
                    </div>
                    <div className="space-y-1 md:col-span-2 bg-[#1C1F26]/50 p-3 rounded-lg border border-[#2A2D35]">
                      <p className="text-gray-500 font-semibold uppercase tracking-widest text-[9px]">Research Dissertation Scope</p>
                      <p className="text-xs font-serif font-medium text-gray-200 italic leading-relaxed">
                        "{scholar.researchTopic}"
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-gray-500 font-semibold uppercase tracking-wider">Research supervisor (guide)</p>
                      <p className="text-xs font-bold text-gray-300">{scholar.guide}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-gray-500 font-semibold uppercase tracking-wider">Prescribed Timings</p>
                      <p className="text-xs text-blue-400 font-mono">
                        ⏱️ {scholar.workingHours} (Break: {scholar.recess})
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Column 3: Calendar Settings & Automatic Generator */}
            <section id="calendar-settings-panel" className="bg-[#15171C] border border-[#2A2D35] rounded-2xl shadow-sm p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <CalendarIcon className="w-5 h-5 text-blue-500" />
                  <h2 className="text-sm font-bold tracking-tight text-white font-display uppercase">Month Generator</h2>
                </div>

                <div className="space-y-4">
                  {/* Select month/year */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] uppercase font-bold tracking-wider text-gray-500 mb-1">Select Year</label>
                      <select 
                        value={selectedYear} 
                        onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                        className="w-full text-xs font-semibold bg-[#1C1F26] text-white border border-[#2A2D35] rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      >
                        <option value={2025}>2025</option>
                        <option value={2026}>2026</option>
                        <option value={2027}>2027</option>
                        <option value={2028}>2028</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-bold tracking-wider text-gray-400 mb-1">Select Month</label>
                      <select 
                        value={selectedMonth} 
                        onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                        className="w-full text-xs font-semibold bg-[#1C1F26] text-white border border-[#2A2D35] rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      >
                        {Array.from({ length: 12 }, (_, i) => (
                           <option key={i} value={i}>
                             {new Date(2026, i, 1).toLocaleDateString('en-US', { month: 'long' })}
                           </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Smart Filters Checklist / Rules */}
                  <div className="bg-[#1C1F26]/40 border border-[#2A2D35] rounded-lg p-3 space-y-2 text-xs">
                    <p className="font-bold text-[10px] uppercase text-gray-500 tracking-wider mb-1">Automatic Omission Rules</p>
                    <div className="flex items-center gap-2 text-gray-300">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Exclude all <strong>Sundays</strong> ({monthInfo.totalSundays} days matching)</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-300">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Exclude <strong>Even Saturdays</strong> (2nd & 4th: {monthInfo.totalEvenSaturdays} days matching)</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-300">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Exclude <strong>Designated Holidays</strong> ({monthInfo.activeHolidays.length} active in period)</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="mt-4 pt-4 border-t border-[#2A2D35] space-y-2">
                <button 
                  onClick={handleGenerateTemplate}
                  className="w-full bg-blue-600 hover:bg-blue-700 hover:scale-[1.01] text-white py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-blue-600/10 transition-all active:scale-[0.99]"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Generate Clean Month Template</span>
                </button>
                <div className="flex items-center gap-2 justify-center text-[10px] text-gray-400 font-mono">
                  <Info className="w-3 h-3 text-blue-500" />
                  <span>Leaves <strong className="text-blue-400">{monthInfo.totalWorkingDays}</strong> working log blocks</span>
                </div>
              </div>
            </section>

             {/* Special Control: Holidays Editor & CSV imports */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Left box: Holiday and Holiday List Manager */}
            <div className="bg-[#15171C] rounded-2xl border border-[#2A2D35] p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-bold text-xs uppercase tracking-wider text-white flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-gray-400" />
                  <span>Configure Holidays</span>
                </h3>
                <button 
                  onClick={() => setShowHolidaysEditor(!showHolidaysEditor)}
                  className="text-[11px] text-gray-400 hover:text-blue-400 font-semibold"
                >
                  {showHolidaysEditor ? 'Hide Editor' : 'Manage List'}
                </button>
              </div>

              {showHolidaysEditor ? (
                /* Holidays database custom editor */
                <div className="space-y-3">
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    const dt = fd.get('h_date') as string;
                    const nm = fd.get('h_name') as string;
                    if (dt && nm) {
                      handleAddHoliday(dt, nm);
                      e.currentTarget.reset();
                    }
                  }} className="grid grid-cols-1 gap-2 bg-[#1C1F26] p-2 text-xs rounded-lg border border-[#2A2D35]">
                    <input type="date" name="h_date" className="p-1 text-xs border border-[#2A2D35] bg-[#0F1115] text-white rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500" required />
                    <input type="text" name="h_name" placeholder="e.g. Maker Sankranti" className="p-1 text-xs border border-[#2A2D35] bg-[#0F1115] text-white rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500" required />
                    <button type="submit" className="bg-blue-600 text-white rounded p-1 text-xs font-bold hover:bg-blue-700">Add Holiday</button>
                  </form>
                  <div className="max-h-40 overflow-y-auto divide-y divide-[#2A2D35] border border-[#2A2D35] rounded-lg text-[11px] bg-[#0F1115]">
                    {holidays.map(h => (
                      <div key={h.date} className="p-1 px-2 flex justify-between items-center group">
                        <span className="font-mono text-gray-400">{h.date}</span>
                        <span className="font-semibold text-gray-200">{h.name}</span>
                        <button type="button" onClick={() => handleRemoveHoliday(h.date)} className="text-red-400 hover:text-red-600 pl-2">×</button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                /* Static mini summary */
                <div className="text-xs space-y-2">
                  <p className="text-gray-400 leading-normal">
                    The app excludes state-level days like Makar Sankranti and Republic Day automatically. Currently <strong>{holidays.length} holidays</strong> are saved in your master schedule block.
                  </p>
                  {monthInfo.activeHolidays.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {monthInfo.activeHolidays.map(h => (
                        <span key={h.date} className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-600/20 text-[10px] font-medium font-mono">
                          {h.name} ({h.date.substring(5)})
                        </span>
                      ))}
                    </div>
                  ) : <p className="text-[11px] italic text-gray-500">No scheduled holidays in {selectedMonthName}.</p>}
                </div>
              )}
            </div>

            {/* Middle Box: CSV file Ingestor & Raw Data Handler */}
            <div className="bg-[#15171C] rounded-2xl border border-[#2A2D35] p-5 shadow-sm space-y-3">
              <h3 className="font-display font-bold text-xs uppercase tracking-wider text-white flex items-center gap-1.5">
                <Upload className="w-4 h-4 text-emerald-400" />
                <span>Ingest prepared CSV Sheet</span>
              </h3>
              <p className="text-xs text-gray-400 leading-normal">
                Already prepared a monthly report in Excel/Sheets? Upload the spreadsheet as a CSV file to load all records instantly.
              </p>

              <div className="flex flex-col gap-2 pt-1">
                {/* File picker */}
                <div className="relative">
                  <input 
                    type="file" 
                    accept=".csv" 
                    onChange={handleFileUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full"
                    id="csv-file-picker"
                  />
                  <div className="border border-dashed border-[#2A2D35] hover:border-blue-500 rounded-xl p-2.5 text-center transition-all bg-blue-500/5">
                    <span className="text-[11px] font-semibold text-blue-400 flex items-center justify-center gap-1.5">
                      <FileSpreadsheet className="w-4 h-4" />
                      Choose CSV file
                    </span>
                  </div>
                </div>
                
                <button 
                  onClick={() => setShowCsvBox(!showCsvBox)}
                  className="text-center text-[10px] text-gray-500 font-semibold hover:text-blue-400"
                >
                  {showCsvBox ? "Collapse Paste Area" : "Or Paste raw CSV text..."}
                </button>
              </div>

              {showCsvBox && (
                <div className="space-y-2 mt-2">
                  <textarea 
                    rows={4} 
                    placeholder='Date,Time Slot,Activity Type,Detailed Description of Work,Remarks&#10;"Thursday, January 01, 2026",12:00 to 2:00,Reading,"Ramakrishnan, E. V. Preface"'
                    value={csvInput}
                    onChange={(e) => setCsvInput(e.target.value)}
                    className="w-full font-mono text-[10px] p-2 bg-[#1C1F26] text-white border border-[#2A2D35] rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <button 
                    onClick={handleImportCSV}
                    className="w-full bg-[#107C41] hover:bg-[#0E6C38] text-white rounded-lg p-1.5 text-xs font-bold"
                  >
                    Parse Paste Content
                  </button>
                </div>
              )}
            </div>

            {/* Right Box: Sync directly to live Google Sheet */}
            <div className="bg-[#15171C] rounded-2xl border border-[#2A2D35] p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-bold text-xs uppercase tracking-wider text-white flex items-center gap-1.5">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                  <span>Google Sheets Sync</span>
                </h3>
                <button 
                  onClick={() => setShowGoogleSyncCard(!showGoogleSyncCard)}
                  className="p-1 hover:bg-[#1C1F26] rounded text-gray-400 hover:text-white"
                  title="Config settings"
                >
                  <Settings className="w-3.5 h-3.5" />
                </button>
              </div>

              <p className="text-xs text-gray-400 leading-normal">
                Save logs directly into an organized online spreadsheet with university signature lines placed automatically.
              </p>

              <div className="space-y-2">
                <button 
                  onClick={handleSheetsSync}
                  className="w-full bg-[#107C41] hover:bg-[#0E6C38] active:scale-[0.98] text-white py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-emerald-700/5 transition-all"
                >
                  <span>Sync to Google Sheets</span>
                </button>

                {syncingStatus && (
                  <p className="text-[10px] font-semibold text-gray-300 italic border-l-2 border-blue-500 pl-2">
                    {syncingStatus}
                  </p>
                )}

                {syncedSheetUrl && (
                  <a 
                    href={syncedSheetUrl} 
                    target="_blank" 
                    rel="noreferrer"
                    className="text-[11px] font-bold text-emerald-400 hover:underline flex items-center gap-1"
                  >
                    <Maximize2 className="w-3 h-3" />
                    Open newly created Sheet
                  </a>
                )}
              </div>

              {/* Collapsible settings drawer for OAuth */}
              {showGoogleSyncCard && (
                <div className="bg-[#1D212A] p-3 rounded-lg border border-[#2A2D35] space-y-2 text-xs">
                  <p className="font-bold text-[10px] uppercase text-gray-500">OAuth Access Token</p>
                  <p className="text-[10px] text-gray-400 leading-normal">
                    If permissions are configured, paste the temporary access token below to connect spreadsheet flows:
                  </p>
                  <input 
                    type="password"
                    placeholder="ya29.a0AfH..."
                    value={googleAccessToken}
                    onChange={(e) => setGoogleAccessToken(e.target.value)}
                    className="w-full text-xs p-1.5 bg-[#1C1F26] border border-[#2A2D35] text-white rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <div className="text-[10px] text-gray-500 italic">
                    Token is kept completely in-memory and local storage securely.
                  </div>
                </div>
              )}
            </div>

          </div>          </div>

          {/* Interactive Log Entry Toolbar & Search Filter */}
          <section id="interactive-log-workbench" className="bg-[#15171C] rounded-2xl border border-[#2A2D35] shadow-sm overflow-hidden">
            
            {/* Header, Search & Filter Bar */}
            <div className="px-6 py-4 bg-[#1C1F26] border-b border-[#2A2D35] flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-blue-500" />
                <div>
                  <h2 className="text-sm font-bold tracking-tight text-white uppercase font-display">
                    Journal Work Logs: {selectedMonthName} {selectedYear}
                  </h2>
                  <p className="text-xs text-gray-400">
                    Showing {currentMonthEntries.length} log intervals
                  </p>
                </div>
              </div>

              {/* Search filter input */}
              <div className="flex items-center gap-2 max-w-md w-full sm:w-auto">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
                  <input 
                    type="text" 
                    placeholder="Search logs (e.g. Reading, NIRF)..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full sm:w-64 text-xs pl-9 pr-4 py-2 bg-[#15171C] border border-[#2A2D35] text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-medium placeholder-gray-500"
                  />
                </div>
                <button 
                  onClick={handleExportCSV}
                  title="Download selected month logs as standard CSV file"
                  className="bg-[#2A2D35] mx-1 text-gray-300 hover:bg-[#343842] hover:text-white p-2 rounded-lg text-xs font-semibold flex items-center justify-center transition-all shrink-0 border border-[#343842]"
                >
                  <Download className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => {
                    setShowEntryBuilder(!showEntryBuilder);
                    setBuilderDay(1);
                  }}
                  className={`text-white p-2 rounded-lg text-xs font-semibold flex items-center justify-center transition-all shrink-0 ${
                    showEntryBuilder ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                  title="Toggle JRF Rich Entry Builder Form"
                >
                  {showEntryBuilder ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4 text-white" />}
                </button>
              </div>
            </div>

            {/* Quick Bulk-Fill Wizard */}
            <div className="px-6 py-3 border-b border-dashed border-[#2A2D35] flex flex-wrap items-center gap-3 text-xs bg-[#1C1F26]/30">
              <span className="font-bold text-[10px] uppercase text-gray-400 tracking-wider">⚡ Bulk-Fill Empty Descriptions:</span>
              
              <select
                value={bulkActivityType}
                onChange={(e) => setBulkActivityType(e.target.value)}
                className="p-1 text-xs border border-[#2A2D35] rounded-md bg-[#1C1F26] text-white font-medium focus:outline-none focus:border-blue-500"
              >
                <option className="bg-[#15171C]" value="Reading">Reading</option>
                <option className="bg-[#15171C]" value="Mentoring">Mentoring</option>
                <option className="bg-[#15171C]" value="Department Work">Department Work</option>
                <option className="bg-[#15171C]" value="Leave">Leave</option>
                <option className="bg-[#15171C]" value="Other Work">Other Work</option>
              </select>

              <input 
                type="text"
                placeholder="e.g. Conducted literature review of alternative modernities disk..."
                value={bulkDesc}
                onChange={(e) => setBulkDesc(e.target.value)}
                className="flex-1 min-w-[200px] max-w-sm p-1 px-2 text-xs border border-[#2A2D35] bg-[#1C1F26] text-white rounded-md placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />

              <button 
                onClick={handleBulkFill}
                className="bg-blue-600/10 text-blue-400 border border-blue-600/20 hover:bg-blue-600/20 px-3 py-1 rounded-md text-xs font-semibold transition-all"
              >
                Populate Empty Slots
              </button>
            </div>

            {/* Rich Advanced Custom JRF Log Builder (NEW COMPREHENSIVE COMPONENT) */}
            {showEntryBuilder && (
              <div className="p-6 bg-[#161920] border-b border-[#2A2D35] transition-all animate-in fade-in slide-in-from-top-4 duration-200">
                <div className="flex items-center justify-between gap-3 pb-3 border-b border-[#2A2D35]/60 mb-5">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider font-sans">
                      Rich JRF Log Entry Builder & Scheduler
                    </h3>
                  </div>
                  <button 
                    onClick={() => setShowEntryBuilder(false)}
                    className="text-gray-400 hover:text-white p-1 hover:bg-[#2A2D35] rounded-full transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-xs text-white">
                  {/* Left Controls */}
                  <div className="lg:col-span-5 space-y-4">
                    {/* Option to select single entry or bulk entry - Elegant Segmented Tabs */}
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                        Log entry mode:
                      </label>
                      <div className="grid grid-cols-2 p-1 bg-[#101216] border border-[#2A2D35] rounded-xl w-full mb-2 select-none">
                        <button
                          type="button"
                          onClick={() => setBuilderMultiDaySelect(false)}
                          className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer border-none ${
                            !builderMultiDaySelect 
                              ? 'bg-blue-600 text-white shadow-md shadow-blue-950/40' 
                              : 'bg-transparent text-gray-400 hover:text-gray-200'
                          }`}
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Single Entry</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setBuilderMultiDaySelect(true)}
                          className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer border-none ${
                            builderMultiDaySelect 
                              ? 'bg-amber-600 text-white shadow-md shadow-amber-950/40' 
                              : 'bg-transparent text-gray-400 hover:text-gray-200'
                          }`}
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Bulk Entry (Multi-Day)</span>
                        </button>
                      </div>
                    </div>

                    {!builderMultiDaySelect ? (
                      /* Single Day Picker */
                      <div className="space-y-1.5">
                        <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                          Select Day of the Month:
                        </label>
                        <div className="flex items-center gap-2">
                          <select
                            value={builderDay}
                            onChange={(e) => setBuilderDay(Number(e.target.value))}
                            className="p-2 text-xs font-mono font-bold bg-[#101216] text-white border border-[#2A2D35] rounded-lg focus:outline-none focus:border-blue-500 w-24"
                          >
                            {Array.from({ length: new Date(selectedYear, selectedMonth + 1, 0).getDate() }, (_, i) => i + 1).map((day) => {
                              const d = new Date(selectedYear, selectedMonth, day);
                              const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
                              return (
                                <option key={day} value={day} className="font-mono bg-[#15171C]">
                                  Day {String(day).padStart(2, '0')} ({dayName})
                                </option>
                              );
                            })}
                          </select>
                          <div className="text-xs text-gray-400 bg-[#101216] border border-[#2A2D35] rounded-lg py-2 px-3 flex-1 flex items-center justify-between">
                            <span className="font-mono">Date: {`${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(builderDay).padStart(2, '0')}`}</span>
                            {(() => {
                              const examDate = new Date(selectedYear, selectedMonth, builderDay);
                              const stat = getDayStatus(examDate, holidays, true, true);
                              return !stat.isWorkingDay ? (
                                <span className="text-[10px] text-amber-400 bg-amber-400/5 px-1.5 py-0.5 rounded border border-amber-400/10 font-sans">
                                  ⚠️ Off-day
                                </span>
                              ) : (
                                <span className="text-[10px] text-emerald-400 bg-emerald-400/5 px-1.5 py-0.5 rounded border border-emerald-400/10 font-sans">
                                  ✓ Work Day
                                </span>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* Multi-day selectors */
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                            Choose Target Calendar Days:
                          </label>
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                const endDay = new Date(selectedYear, selectedMonth + 1, 0).getDate();
                                const workingDays: number[] = [];
                                for (let d = 1; d <= endDay; d++) {
                                  const date = new Date(selectedYear, selectedMonth, d);
                                  if (getDayStatus(date, holidays, true, true).isWorkingDay) {
                                    workingDays.push(d);
                                  }
                                }
                                setBuilderSelectedDays(workingDays);
                              }}
                              className="text-[9px] bg-blue-600/10 border border-blue-500/10 hover:bg-blue-600/20 text-blue-400 rounded px-1.5 py-0.5 font-semibold transition-all"
                            >
                              All Workdays
                            </button>
                            <button
                              type="button"
                              onClick={() => setBuilderSelectedDays([])}
                              className="text-[9px] bg-red-600/10 border border-red-500/10 hover:bg-red-600/20 text-red-500 rounded px-1.5 py-0.5 font-semibold transition-all"
                            >
                              Clear Selection
                            </button>
                          </div>
                        </div>
                        <div className="grid grid-cols-7 gap-1 p-2 bg-[#101216] rounded-xl border border-[#2A2D35] max-h-[145px] overflow-y-auto">
                          {Array.from({ length: new Date(selectedYear, selectedMonth + 1, 0).getDate() }, (_, i) => i + 1).map((day) => {
                            const date = new Date(selectedYear, selectedMonth, day);
                            const isSelected = builderSelectedDays.includes(day);
                            const stat = getDayStatus(date, holidays, true, true);
                            return (
                              <button
                                key={day}
                                type="button"
                                onClick={() => {
                                  setBuilderSelectedDays(prev => 
                                    prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
                                  );
                                }}
                                className={`h-8 font-mono rounded text-[10px] transition-all flex flex-col items-center justify-center relative ${
                                  isSelected 
                                    ? 'bg-blue-600 text-white font-bold border border-blue-550' 
                                    : !stat.isWorkingDay
                                    ? 'bg-[#101216]/50 text-gray-700 opacity-50 line-through border border-red-950/20'
                                    : 'bg-[#1C1F26] text-gray-400 hover:bg-[#2A2D35] border border-[#2A2D35]'
                                }`}
                                title={`${date.toLocaleDateString()} - ${stat.reason || 'Working Day'}`}
                              >
                                <span>{day}</span>
                                <span className="text-[7px] text-gray-500 leading-none">{date.toLocaleDateString('en-US', { weekday: 'narrow' })}</span>
                              </button>
                            );
                          })}
                        </div>
                        <p className="text-[10px] text-gray-400 italic">
                          Selected {builderSelectedDays.length} days. Overwrites are protected; collisions notified.
                        </p>
                      </div>
                    )}

                    {/* Time Slot Selector */}
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">Time Slot Segment:</label>
                      <input 
                        type="text"
                        value={builderTimeSlot}
                        onChange={(e) => setBuilderTimeSlot(e.target.value)}
                        placeholder="e.g. 11:00 to 2:00"
                        className="w-full bg-[#101216] text-xs text-white border border-[#2A2D35] rounded-lg p-2 font-mono focus:ring-1 focus:ring-blue-500 focus:outline-none"
                      />
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        <button
                          type="button"
                          onClick={() => setBuilderTimeSlot(slot1Hours)}
                          className="bg-[#2A2D35] hover:bg-[#343842] text-[10px] text-gray-300 rounded px-2 py-0.5 font-semibold transition-all"
                        >
                          🌅 Slot 1 ({slot1Hours})
                        </button>
                        <button
                          type="button"
                          onClick={() => setBuilderTimeSlot(slot2Hours)}
                          className="bg-[#2A2D35] hover:bg-[#343842] text-[10px] text-gray-300 rounded px-2 py-0.5 font-semibold transition-all"
                        >
                          🌇 Slot 2 ({slot2Hours})
                        </button>
                        <button
                          type="button"
                          onClick={() => setBuilderTimeSlot("11:00 to 5:00")}
                          className="bg-[#2A2D35] hover:bg-[#343842] text-[10px] text-gray-300 rounded px-2 py-0.5 font-semibold transition-all"
                        >
                          🏢 Full Day (11:00 to 5:00)
                        </button>
                        <button
                          type="button"
                          onClick={() => setBuilderTimeSlot("10:00 to 5:00")}
                          className="bg-[#2A2D35] hover:bg-[#343842] text-[10px] text-gray-300 rounded px-2 py-0.5 font-semibold transition-all"
                        >
                          🏢 Full Day (10:00 to 5:00)
                        </button>
                      </div>
                    </div>

                    {/* Activity Type Dropdown badge selector */}
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">Activity Classification:</label>
                      <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-5 lg:grid-cols-3 gap-1 px-1">
                        {["Reading", "Mentoring", "Department Work", "Leave", "Other Work"].map((activity) => {
                          const isSelected = builderActivityType === activity;
                          return (
                            <button
                              key={activity}
                              type="button"
                              onClick={() => setBuilderActivityType(activity)}
                              className={`py-1 px-1.5 text-[10px] font-semibold rounded-md text-left transition-all border ${
                                isSelected 
                                  ? activity === "Reading" ? 'bg-blue-950/40 border-blue-500 text-blue-400' :
                                    activity === "Mentoring" ? 'bg-emerald-950/40 border-emerald-500 text-emerald-400' :
                                    activity === "Department Work" ? 'bg-purple-950/40 border-purple-500 text-purple-400' :
                                    activity === "Leave" ? 'bg-rose-950/40 border-rose-500 text-rose-400' :
                                    'bg-gray-800 border-gray-600 text-gray-150'
                                  : 'bg-[#101216] border-[#2A2D35] text-gray-450 hover:text-gray-200 hover:border-gray-750'
                              }`}
                            >
                              <span className="inline-block w-1.5 h-1.5 rounded-full mr-1.5" style={{
                                backgroundColor: 
                                  activity === "Reading" ? "#3b82f6" :
                                  activity === "Mentoring" ? "#10b981" :
                                  activity === "Department Work" ? "#a855f7" :
                                  activity === "Leave" ? "#f43f5e" : "#9ca3af"
                              }} />
                              {activity}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Right Description & Presets */}
                  <div className="lg:col-span-7 flex flex-col justify-between space-y-4">
                    {/* Free-text input */}
                    <div className="space-y-1.5 flex-1 flex flex-col">
                      <div className="flex items-center justify-between">
                        <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                          Detailed JRF Work Description:
                        </label>
                        <span className="text-[10px] text-gray-500">Length: {builderDescription.length} chars</span>
                      </div>
                      <textarea
                        rows={3}
                        value={builderDescription}
                        onChange={(e) => setBuilderDescription(e.target.value)}
                        placeholder="Write dynamic academic details or select presets below to instantly prefill..."
                        className="w-full flex-1 min-h-[90px] bg-[#101216] text-xs text-white border border-[#2A2D35] rounded-xl p-3 focus:ring-1 focus:ring-blue-500 focus:outline-none placeholder-gray-600 font-serif italic leading-relaxed"
                      />
                    </div>

                    {/* JRF Scholar Prepopulated Fast Templates! */}
                    <div className="space-y-1.5">
                      <span className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">✨ Quick Scholar Description Presets:</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {[
                          { title: "📖 Lit Review", desc: "Conducted extensive primary textual reading, synthesizing relevant historical secondary studies." },
                          { title: "📝 Thesis Writing", desc: "Formulated chapter outlines, annotated bibliography indexes, and compiled textual citations." },
                          { title: "🎓 Student Mentorship", desc: "Guided undergraduate dissertation scholars and reviewed draft assignments." },
                          { title: "🏛️ Academic Assistance", desc: "Assisted JRF coordinator with exam duty rosters and departmental documentation." },
                          { title: "📊 Library Archiving", desc: "Retrieved rare manuscripts from the main college repository to catalogue references." },
                          { title: "✍️ Article Proofreading", desc: "Reviewed proof copies of upcoming reviews and verified bibliographic indexes." }
                        ].map((preset, index) => (
                          <button
                            key={index}
                            type="button"
                            onClick={() => {
                              setBuilderDescription(preset.desc);
                              if (preset.title.includes("Lit") || preset.title.includes("Library") || preset.title.includes("Thesis") || preset.title.includes("Article")) {
                                setBuilderActivityType("Reading");
                              } else if (preset.title.includes("Student")) {
                                setBuilderActivityType("Mentoring");
                              } else {
                                setBuilderActivityType("Department Work");
                              }
                            }}
                            className="p-2 text-left bg-[#101216] hover:bg-[#1E212A] border border-[#2A2D35] hover:border-gray-700 rounded-lg text-[10px] text-gray-300 hover:text-white transition-all space-y-0.5 leading-tight"
                          >
                            <span className="font-bold text-blue-400 block">{preset.title}</span>
                            <span className="text-gray-500 text-[9px] line-clamp-1 italic">{preset.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Remarks and Save */}
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end pt-2">
                      <div className="sm:col-span-8 space-y-1.5">
                        <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">Remarks / PP. Range / Notes:</label>
                        <input 
                          type="text"
                          value={builderRemarks}
                          onChange={(e) => setBuilderRemarks(e.target.value)}
                          placeholder="e.g. PP. 100-112, Draft Approved"
                          className="w-full bg-[#101216] text-xs text-white border border-[#2A2D35] rounded-lg p-2 font-mono focus:ring-1 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>
                      
                      <div className="sm:col-span-4">
                        <button
                          type="button"
                          onClick={handleAddRichEntries}
                          className="w-full py-2 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 shadow-md shadow-blue-900/30 transition-all cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Insert into Logbook</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Bulk Actions Toolbar */}
            {selectedEntryIds.length > 0 && (
              <div className="bg-blue-600/10 border-b border-blue-500/20 p-3 flex items-center justify-between animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">{selectedEntryIds.length} Selected</span>
                  <div className="h-4 w-px bg-blue-500/30"></div>
                  <button 
                    onClick={handleBulkDelete}
                    className="text-[10px] bg-red-600/10 hover:bg-red-600/20 text-red-400 px-2.5 py-1.5 rounded-md font-semibold transition-colors flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete Selected
                  </button>
                  <div className="relative group">
                    <button className="text-[10px] bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 px-2.5 py-1.5 rounded-md font-semibold transition-colors flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      Set Activity
                    </button>
                    <div className="absolute left-0 top-full mt-1 hidden group-hover:flex flex-col bg-[#1C1F26] border border-[#2A2D35] rounded-md shadow-xl overflow-hidden z-20 w-40">
                      {["Reading", "Mentoring", "Department Work", "Leave", "Other Work"].map(act => (
                        <button 
                          key={act}
                          onClick={() => handleBulkUpdateActivity(act)}
                          className="text-[10px] text-left px-3 py-2 text-gray-300 hover:bg-[#2A2D35] hover:text-white transition-colors"
                        >
                          {act}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedEntryIds([])}
                  className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors uppercase tracking-wider font-semibold"
                >
                  Clear Selection
                </button>
              </div>
            )}

            {/* Main Interactive Table Grid */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-[#1C1F26] border-b border-[#2A2D35] text-gray-450 uppercase text-[10px] tracking-wider font-bold">
                    <th className="p-4 w-[40px] text-center">
                      <input 
                        type="checkbox" 
                        className="rounded border-gray-600 bg-[#15171C] text-blue-500 focus:ring-blue-500 focus:ring-offset-gray-900 cursor-pointer"
                        checked={currentMonthEntries.length > 0 && selectedEntryIds.length === currentMonthEntries.length}
                        onChange={handleSelectAll}
                      />
                    </th>
                    <th className="p-4 w-[160px]">Day & Date</th>
                    <th className="p-4 w-[120px]">Time Slot</th>
                    <th className="p-4 w-[140px]">Activity Type</th>
                    <th className="p-4">Detailed Work Description</th>
                    <th className="p-4 w-[160px]">Remarks</th>
                    <th className="p-4 w-[90px] text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2A2D35] text-xs">
                  {currentMonthEntries.map((e, idx) => {
                    const d = new Date(e.date);
                    const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
                    const isSaturday = d.getDay() === 6;
                    const dateFormatted = `${dayName}, ${String(d.getDate()).padStart(2, '0')}`;
                    const isSelected = selectedEntryIds.includes(e.id);

                    return (
                      <tr key={e.id} className={`group transition-all duration-150 ${isSelected ? 'bg-blue-900/10' : 'hover:bg-[#1C1F26]/30'}`}>
                        <td className="p-3 text-center align-top pt-5">
                          <input 
                            type="checkbox"
                            checked={isSelected}
                            onChange={(ev) => handleSelectRow(ev, e.id)}
                            className="rounded border-gray-600 bg-[#15171C] text-blue-500 focus:ring-blue-500 focus:ring-offset-gray-900 cursor-pointer"
                          />
                        </td>
                        
                        {/* Day & Date editable inline */}
                        <td className="p-3 align-top font-mono font-bold text-gray-300 w-[170px]">
                          <div className="flex flex-col gap-1.5">
                            <input 
                              type="date"
                              value={e.date}
                              onChange={(ev) => {
                                if (ev.target.value) {
                                  handleCellChange(e.id, 'date', ev.target.value);
                                }
                              }}
                              className="w-full bg-[#15171C] text-xs font-semibold text-white border border-[#2A2D35] rounded-md px-2 py-1 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-colors"
                              style={{ colorScheme: 'dark' }}
                              title="Click to choose a custom date for this entry"
                            />
                            <div className="flex items-center justify-between px-1">
                              <span className={`text-[10px] uppercase tracking-wider font-bold ${
                                isSaturday ? "text-amber-500" : d.getDay() === 0 ? "text-rose-500" : "text-gray-400"
                              }`}>
                                {dayName}
                              </span>
                              
                              {/* Holiday or Weekend Indicator */}
                              {(() => {
                                const status = getDayStatus(d, holidays, true, true);
                                if (!status.isWorkingDay) {
                                  return (
                                    <span 
                                      className="text-[9px] font-semibold text-amber-500 cursor-help flex items-center gap-0.5"
                                      title={status.reason || "Off-Day"}
                                    >
                                      ⚠️ Off-Day
                                    </span>
                                  );
                                }
                                return (
                                  <span className="text-[9px] font-normal text-emerald-500/80">
                                    ✓ Work Day
                                  </span>
                                );
                              })()}
                            </div>
                          </div>
                        </td>

                        {/* Editable time slot string */}
                        <td className="p-3 align-top">
                          <input 
                            type="text" 
                            value={e.timeSlot}
                            onChange={(eVal) => handleCellChange(e.id, 'timeSlot', eVal.target.value)}
                            className="w-full p-1 bg-transparent hover:bg-[#1C1F26] focus:bg-[#15171C] text-white focus:ring-1 focus:ring-blue-500 rounded border-0 transition-colors font-mono tracking-tight"
                          />
                        </td>

                        {/* Colored Dropdown selecting activity tag */}
                        <td className="p-3 align-top">
                          <select
                            value={e.activityType}
                            onChange={(eVal) => handleCellChange(e.id, 'activityType', eVal.target.value)}
                            className={`w-full p-1 text-xs font-semibold rounded-md border-0 focus:ring-1 cursor-pointer bg-[#1C1F26] ${
                              e.activityType === "Reading" ? 'text-blue-400 bg-blue-950/40 hover:bg-blue-950/70' :
                              e.activityType === "Mentoring" ? 'text-emerald-400 bg-emerald-950/40 hover:bg-emerald-950/70' :
                              e.activityType === "Department Work" ? 'text-purple-400 bg-purple-950/40 hover:bg-purple-950/70' :
                              e.activityType === "Leave" ? 'text-rose-400 bg-rose-950/40 hover:bg-rose-950/70' :
                              e.activityType === "Other Work" ? 'text-gray-400 bg-gray-900 hover:bg-gray-800' :
                              'text-gray-300 bg-gray-900 hover:bg-gray-800'
                            }`}
                          >
                            <option className="bg-[#15171C]" value="">- Select -</option>
                            <option className="bg-[#15171C] text-blue-400" value="Reading">Reading</option>
                            <option className="bg-[#15171C] text-emerald-400" value="Mentoring">Mentoring</option>
                            <option className="bg-[#15171C] text-purple-400" value="Department Work">Department Work</option>
                            <option className="bg-[#15171C] text-rose-400" value="Leave">Leave</option>
                            <option className="bg-[#15171C] text-gray-400" value="Other Work">Other Work</option>
                          </select>
                        </td>

                        {/* Bulk Work Description area */}
                        <td className="p-3 align-top">
                          <textarea
                            rows={2}
                            placeholder="Describe literature reviewed, guiding sessions, or administrative assignments..."
                            value={e.description}
                            onChange={(eVal) => handleCellChange(e.id, 'description', eVal.target.value)}
                            className="w-full p-1 bg-transparent hover:bg-[#1C1F26] focus:bg-[#15171C] text-gray-200 focus:ring-1 focus:ring-blue-500 rounded border-0 transition-all font-serif italic leading-normal placeholder-gray-600"
                          />
                        </td>

                        {/* Remarks Cell */}
                        <td className="p-3 align-top">
                          <input 
                            type="text" 
                            placeholder="e.g. Preface, Pp. 5-10"
                            value={e.remarks}
                            onChange={(eVal) => handleCellChange(e.id, 'remarks', eVal.target.value)}
                            className="w-full p-1 bg-transparent hover:bg-[#1C1F26] focus:bg-[#15171C] text-gray-300 focus:ring-1 focus:ring-blue-500 rounded border-0 transition-colors h-9 placeholder-gray-650"
                          />
                        </td>

                        {/* Quick Action buttons */}
                        <td className="p-3 align-top">
                          <div className="flex items-center justify-center gap-1 opacity-40 group-hover:opacity-100 transition-all">
                            {idx > 0 && (
                              <button
                                onClick={() => handleCopyPrevRow(idx)}
                                title="Duplicate work metadata of previous log line"
                                className="text-gray-400 hover:text-blue-400 p-1 hover:bg-[#2A2D35] rounded"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteEntry(e.id)}
                              title="Delete log line"
                              className="text-gray-400 hover:text-red-400 p-1 hover:bg-[#2A2D35] rounded"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>

                      </tr>
                    );
                  })}
                  {currentMonthEntries.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-12 text-center text-gray-500 font-medium italic">
                        No logs returned. Try generating a calendar template above, clear keywords, or upload previous backups.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Table bottom summary counts */}
            <div className="px-6 py-4 bg-[#1C1F26] border-t border-[#2A2D35] flex flex-wrap items-center justify-between gap-2 text-xs text-gray-400">
              <span className="font-mono">Page size: {currentMonthEntries.length} records active</span>
              <div className="flex items-center gap-4">
                <span>Reading hours: <strong className="text-white font-semibold">{currentMonthEntries.filter(e => e.activityType === 'Reading').length * 2} hrs</strong></span>
                <span>Department/Other Work hours: <strong className="text-white font-semibold">{currentMonthEntries.filter(e => e.activityType && e.activityType !== 'Reading' && e.activityType !== 'Leave').length * 2} hrs</strong></span>
              </div>
            </div>

          </section>

          {/* Quick Informational Guide Cards - Bottom segment */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-12">
            <div className="bg-[#15171C] rounded-2xl border border-[#2A2D35] p-5 shadow-sm space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-300 flex items-center gap-1.5 font-display">
                <Info className="w-4 h-4 text-blue-500" />
                <span>Tips for PhD/JRF Scholars</span>
              </h4>
              <ul className="list-disc pl-5 text-xs text-gray-400 space-y-1.5 leading-normal">
                <li>Under general rules, JRF scholarship claims require logs omitting national public holidays and <strong>all Sundays</strong>.</li>
                <li>The <strong>2nd and 4th Saturdays</strong> of the month must always be excluded (deleted) as official university non-working days.</li>
                <li>The "Print Monthly Report" fits perfectly on premium A4 sheets (Portrait). It hides the controls, buttons, sidebars and headers, and structures signature blocks beautifully.</li>
              </ul>
            </div>

            <div className="bg-[#15171C] rounded-2xl border border-[#2A2D35] p-5 shadow-sm space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-300 flex items-center gap-1.5 font-display">
                <HelpCircle className="w-4 h-4 text-emerald-400" />
                <span>Google Spreadsheet Structure</span>
              </h4>
              <p className="text-xs text-gray-400 leading-normal">
                The synchronization creates a standalone, fully-styled workbook on Google Drive. Rows 1-7 host details about your Guide, University, hours, and Topic, while Row 9 holds the clean, structured data headers that automatically mapped to your scholar metrics.
              </p>
            </div>
          </div>

        </main>
      </div>

      {/* --- Custom Stateful Confirm Dialog Modal (IFrame Friendly) --- */}
      {modalConfig && (
        <div id="custom-confirm-modal" className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#1C1F26] border border-[#2A2D35] rounded-xl max-w-sm w-full shadow-2xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-display">
              {modalConfig.title}
            </h3>
            <p className="text-xs text-gray-300 leading-relaxed font-sans">
              {modalConfig.message}
            </p>
            <div className="flex items-center justify-end gap-3 text-xs pt-1">
              <button
                onClick={() => setModalConfig(null)}
                className="px-3.5 py-1.5 rounded-lg bg-[#2A2D35] text-gray-300 hover:bg-[#343842] hover:text-white transition-all font-semibold"
              >
                {modalConfig.cancelLabel || "Cancel"}
              </button>
              <button
                onClick={() => {
                  modalConfig.onConfirm();
                  setModalConfig(null);
                }}
                className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-all font-semibold"
              >
                {modalConfig.confirmLabel || "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- Custom Stateful Alert Dialog Modal (IFrame Friendly) --- */}
      {alertConfig && (
        <div id="custom-alert-modal" className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#1C1F26] border border-[#2A2D35] rounded-xl max-w-sm w-full shadow-2xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-display text-blue-400">
              {alertConfig.title}
            </h3>
            <p className="text-xs text-gray-300 leading-relaxed font-sans">
              {alertConfig.message}
            </p>
            <div className="flex items-center justify-end text-xs pt-1">
              <button
                onClick={() => setAlertConfig(null)}
                className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-all font-semibold"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
