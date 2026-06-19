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
  ChevronDown,
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
  const [showAdvancedSetup, setShowAdvancedSetup] = useState<boolean>(false);
  const [activeSetupTab, setActiveSetupTab] = useState<'profile' | 'cloud' | 'holidays' | 'imports'>('profile');
  
  // --- Rich Custom Entry Builder State ---
  const [showEntryBuilder, setShowEntryBuilder] = useState<boolean>(false);
  const [builderDay, setBuilderDay] = useState<number>(() => new Date().getDate());
  const [builderTimeSlot, setBuilderTimeSlot] = useState<string>("11:00 to 2:00");
  const [builderActivityType, setBuilderActivityType] = useState<string>("Reading");
  const [builderDescription, setBuilderDescription] = useState<string>("");
  const [builderRemarks, setBuilderRemarks] = useState<string>("-");
  const [builderMultiDaySelect, setBuilderMultiDaySelect] = useState<boolean>(false);
  const [builderSelectedDays, setBuilderSelectedDays] = useState<number[]>([]);
  
  // --- Smart Book Reading Planner States ---
  const [isReadingPlanner, setIsReadingPlanner] = useState<boolean>(false);
  const [plannerBookTitle, setPlannerBookTitle] = useState<string>("");
  const [plannerStartPage, setPlannerStartPage] = useState<number>(1);
  const [plannerEndPage, setPlannerEndPage] = useState<number>(150);
  const [plannerExcludePages, setPlannerExcludePages] = useState<string>("");
  const [plannerRandomize, setPlannerRandomize] = useState<boolean>(true);
  const [plannerDescriptionStyle, setPlannerDescriptionStyle] = useState<string>("standard");
  const [plannerCollisionResolution, setPlannerCollisionResolution] = useState<'skip' | 'overwrite' | 'parallel'>('parallel');
  const [plannerPreviewPlan, setPlannerPreviewPlan] = useState<any[] | null>(null);
  
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

  // --- Smart Reading Planner Helpers & Handlers ---
  const parseExclusions = (excludeStr: string): Set<number> => {
    const excluded = new Set<number>();
    if (!excludeStr.trim()) return excluded;
    
    const parts = excludeStr.split(',');
    for (let part of parts) {
      part = part.trim();
      if (part.includes('-')) {
        const [startStr, endStr] = part.split('-');
        const start = parseInt(startStr, 10);
        const end = parseInt(endStr, 10);
        if (!isNaN(start) && !isNaN(end)) {
          const first = Math.min(start, end);
          const last = Math.max(start, end);
          for (let i = first; i <= last; i++) {
            excluded.add(i);
          }
        }
      } else {
        const val = parseInt(part, 10);
        if (!isNaN(val)) {
          excluded.add(val);
        }
      }
    }
    return excluded;
  };

  const formatPageRanges = (pages: number[]): string => {
    if (pages.length === 0) return "None";
    const ranges: string[] = [];
    let start = pages[0];
    let prev = pages[0];
    
    for (let i = 1; i <= pages.length; i++) {
      const current = pages[i];
      if (current === prev + 1) {
        prev = current;
      } else {
        if (start === prev) {
          ranges.push(`${start}`);
        } else {
          ranges.push(`${start}-${prev}`);
        }
        if (i < pages.length) {
          start = current;
          prev = current;
        }
      }
    }
    return `pp. ${ranges.join(', ')}`;
  };

  const generatePlannerDescription = (book: string, rangesText: string, style: string, isSlot2: boolean): string => {
    const bookName = book.trim() || 'assigned text';
    if (style === 'standard') {
      return bookName;
    }
    if (rangesText === "None") {
      return `Conducted general literature search and reviews of academic papers related to "${bookName}".`;
    }
    if (isSlot2) {
      switch (style) {
        case 'academic':
          return `Continued extensive critical text-analysis & conceptual review of "${bookName}" (${rangesText}), formulating annotations.`;
        case 'analytical':
          return `Drafted thematic analytical summaries and theoretical notes from "${bookName}" (${rangesText}) for chapter integration.`;
        case 'detailed':
          return `Advanced reading and bibliographical indexing of "${bookName}" (${rangesText}) focusing on key arguments.`;
        default:
          return bookName;
      }
    } else {
      switch (style) {
        case 'academic':
          return `Conducted comprehensive primary literature reading and textual synthesis of "${bookName}" (${rangesText}).`;
        case 'analytical':
          return `Close logical mapping, chapter-by-chapter annotation, and methodology study of "${bookName}" (${rangesText}).`;
        case 'detailed':
          return `Initiated structured reading session for research thesis references in "${bookName}" (${rangesText}).`;
        default:
          return bookName;
      }
    }
  };

  const handleGenerateReadingPlanPreview = () => {
    const sortedDays = [...builderSelectedDays].sort((a, b) => a - b);
    const daysCount = sortedDays.length;
    if (daysCount === 0) {
      triggerAlert("Selection Error", "Please select targeted calendar days from the multi-day grid first!");
      return;
    }
    if (!plannerBookTitle.trim()) {
      triggerAlert("Validation Notice", "Please enter the book/resource title first!");
      return;
    }
    if (plannerStartPage <= 0 || plannerEndPage <= 0) {
      triggerAlert("Value Error", "Page numbers must be positive integers!");
      return;
    }
    if (plannerEndPage < plannerStartPage) {
      triggerAlert("Value Error", "End Page cannot be less than Start Page!");
      return;
    }

    const allPages: number[] = [];
    for (let p = plannerStartPage; p <= plannerEndPage; p++) {
      allPages.push(p);
    }
    const excluded = parseExclusions(plannerExcludePages);
    const validPages = allPages.filter(p => !excluded.has(p));
    const N = validPages.length;
    
    if (N === 0) {
      triggerAlert("Calculation Error", "No pages to read! Exclusions filtered out your entire page range.");
      return;
    }

    const monthStr = String(selectedMonth + 1).padStart(2, '0');
    const previewItems: any[] = [];

    if (!plannerRandomize) {
      // Even distribution over 2 * daysCount slots
      const totalSlots = daysCount * 2;
      let curr = 0;
      for (let dayIdx = 0; dayIdx < daysCount; dayIdx++) {
        const dayNum = sortedDays[dayIdx];
        const dateStr = `${selectedYear}-${monthStr}-${String(dayNum).padStart(2, '0')}`;
        
        // Slot 1
        const size1 = Math.floor(N / totalSlots) + ((dayIdx * 2) < (N % totalSlots) ? 1 : 0);
        const s1Pages = validPages.slice(curr, curr + size1);
        curr += size1;
        
        // Slot 2
        const size2 = Math.floor(N / totalSlots) + ((dayIdx * 2 + 1) < (N % totalSlots) ? 1 : 0);
        const s2Pages = validPages.slice(curr, curr + size2);
        curr += size2;

        const r1Text = formatPageRanges(s1Pages);
        const r2Text = formatPageRanges(s2Pages);

        previewItems.push({
          day: dayNum,
          dateStr,
          slot: slot1Hours,
          pages: s1Pages,
          pagesText: r1Text,
          description: generatePlannerDescription(plannerBookTitle, r1Text, plannerDescriptionStyle, false),
          remarks: s1Pages.length > 0 ? r1Text : "-"
        });

        previewItems.push({
          day: dayNum,
          dateStr,
          slot: slot2Hours,
          pages: s2Pages,
          pagesText: r2Text,
          description: generatePlannerDescription(plannerBookTitle, r2Text, plannerDescriptionStyle, true),
          remarks: s2Pages.length > 0 ? r2Text : "-"
        });
      }
    } else {
      // Randomized pages per day distribution
      const daysChunks: number[][] = Array.from({ length: daysCount }, () => []);
      if (N <= daysCount) {
        for (let i = 0; i < N; i++) {
          daysChunks[i] = [validPages[i]];
        }
      } else {
        const availableIndices = Array.from({ length: N - 1 }, (_, i) => i + 1);
        // Shuffle available indices
        for (let i = availableIndices.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [availableIndices[i], availableIndices[j]] = [availableIndices[j], availableIndices[i]];
        }
        const cuts = availableIndices.slice(0, daysCount - 1).sort((a, b) => a - b);
        const bounds = [0, ...cuts, N];
        for (let i = 0; i < daysCount; i++) {
          daysChunks[i] = validPages.slice(bounds[i], bounds[i + 1]);
        }
      }

      for (let dayIdx = 0; dayIdx < daysCount; dayIdx++) {
        const dayNum = sortedDays[dayIdx];
        const dateStr = `${selectedYear}-${monthStr}-${String(dayNum).padStart(2, '0')}`;
        const dayPages = daysChunks[dayIdx] || [];
        const M = dayPages.length;

        let s1Pages: number[] = [];
        let s2Pages: number[] = [];

        if (M === 0) {
          // No pages assigned to this day — both slots get a general literature review entry
          s1Pages = [];
          s2Pages = [];
        } else if (M === 1) {
          // Single page — assign to slot 1, slot 2 gets a complementary entry
          s1Pages = [dayPages[0]];
          s2Pages = [];
        } else if (M >= 2) {
          const cut = Math.floor(Math.random() * (M - 1)) + 1;
          s1Pages = dayPages.slice(0, cut);
          s2Pages = dayPages.slice(cut);
        }

        const r1Text = formatPageRanges(s1Pages);
        const r2Text = formatPageRanges(s2Pages);

        previewItems.push({
          day: dayNum,
          dateStr,
          slot: slot1Hours,
          pages: s1Pages,
          pagesText: r1Text,
          description: generatePlannerDescription(plannerBookTitle, r1Text, plannerDescriptionStyle, false),
          remarks: s1Pages.length > 0 ? r1Text : "-"
        });

        previewItems.push({
          day: dayNum,
          dateStr,
          slot: slot2Hours,
          pages: s2Pages,
          pagesText: r2Text,
          description: generatePlannerDescription(plannerBookTitle, r2Text, plannerDescriptionStyle, true),
          remarks: s2Pages.length > 0 ? r2Text : "-"
        });
      }
    }

    setPlannerPreviewPlan(previewItems);
  };

  const handleExecuteReadingPlan = () => {
    if (!plannerPreviewPlan || plannerPreviewPlan.length === 0) {
      triggerAlert("Empty Plan", "Please click 'Generate Preview Plan' first to build your logistics!");
      return;
    }

    let finalEntries = [...entries];
    let overwriteCount = 0;
    let skipCount = 0;
    let addedCount = 0;

    const newLogs: LogEntry[] = [];

    plannerPreviewPlan.forEach((item) => {
      const hasCollision = finalEntries.some(e => e.date === item.dateStr && e.timeSlot === item.slot);
      
      if (hasCollision) {
        if (plannerCollisionResolution === 'skip') {
          skipCount++;
          return;
        } else if (plannerCollisionResolution === 'overwrite') {
          finalEntries = finalEntries.filter(e => !(e.date === item.dateStr && e.timeSlot === item.slot));
          overwriteCount++;
        }
      }

      newLogs.push({
        id: `reading-${Date.now()}-${item.day}-${item.slot.replace(/[^0-9]/g, '')}-${Math.random().toString(36).substring(2, 5)}`,
        date: item.dateStr,
        timeSlot: item.slot,
        activityType: "Reading",
        description: item.description,
        remarks: item.remarks
      });
      addedCount++;
    });

    setEntries([...newLogs, ...finalEntries]);
    setPlannerPreviewPlan(null); // Clear preview plan
    setPlannerBookTitle(""); // Clear book title
    setPlannerExcludePages(""); // Clear exclusions
    setBuilderSelectedDays([]); // Clear selected days
    setIsReadingPlanner(false);
    setShowEntryBuilder(false); // Close entry builder

    let message = `Successfully populated ${addedCount} JRF reading logs for ${builderSelectedDays.length} days.`;
    if (overwriteCount > 0) message += ` Overwrote ${overwriteCount} colliding entries.`;
    if (skipCount > 0) message += ` Skipped ${skipCount} colliding entries.`;
    
    triggerAlert("Logbook Populated", message);
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
        <div className={`printable-content w-full max-w-4xl mx-auto px-6 py-6 bg-white min-h-[95vh] text-black leading-relaxed ${showPrintView ? 'shadow-2xl rounded-sm border border-gray-300 print:shadow-none print:border-none print:rounded-none' : ''}`}>
          <style>{`
            @media print {
              @page { size: auto; margin: 15mm 10mm; }
              body { background-color: #ffffff !important; -webkit-print-color-adjust: exact; }
              .printable-content { background-color: #ffffff !important; min-height: 100vh; }
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
              <p className="text-xs text-gray-400 font-mono flex items-center gap-3">
                <span>Saurashtra University, Rajkot</span>
                <span className="text-[11px] font-bold text-blue-400 uppercase tracking-wider bg-blue-500/10 px-2 py-0.5 rounded">By Harwin Popat</span>
              </p>
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

          {/* --- Standard Active Period & Template Builder --- */}
          <section id="calendar-settings-panel" className="bg-[#15171C] border border-[#2A2D35] rounded-2xl shadow-sm p-4 md:p-5">
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-5">
              {/* Year/Month selectors and Month stats */}
              <div className="flex-1 flex flex-col md:flex-row items-stretch md:items-center gap-4">
                <div className="flex items-center gap-2 shrink-0">
                  <div className="p-2 bg-blue-500/10 text-blue-400 rounded-xl">
                    <CalendarIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold tracking-tight text-white uppercase font-display">Target Month Selector</h2>
                    <p className="text-[10px] text-gray-500 font-mono uppercase">Setup current target period</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 w-full md:w-auto md:min-w-[280px]">
                  <div>
                    <label className="sr-only">Select Year</label>
                    <select 
                      value={selectedYear} 
                      onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                      className="w-full text-xs font-semibold bg-[#1C1F26] text-white border border-[#2A2D35] rounded-xl p-2.5 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value={2025}>2025</option>
                      <option value={2026}>2026</option>
                      <option value={2027}>2027</option>
                      <option value={2028}>2028</option>
                    </select>
                  </div>
                  <div>
                    <label className="sr-only">Select Month</label>
                    <select 
                      value={selectedMonth} 
                      onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                      className="w-full text-xs font-semibold bg-[#1C1F26] text-white border border-[#2A2D35] rounded-xl p-2.5 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {Array.from({ length: 12 }, (_, i) => (
                         <option key={i} value={i}>
                           {new Date(2026, i, 1).toLocaleDateString('en-US', { month: 'long' })}
                         </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Vertical Separator for wide screens */}
                <span className="hidden md:block h-8 w-px bg-[#2A2D35]" />

                {/* Smart filters summary row to save space */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-gray-400">
                  <div className="flex items-center gap-1.5 font-sans" title="Sundays are automatically skipped for JRF sheets">
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Sundays Excluded (<strong className="text-gray-200 font-mono font-semibold">{monthInfo.totalSundays}</strong>)</span>
                  </div>
                  <div className="flex items-center gap-1.5 font-sans" title="Even Saturdays are excluded automatically">
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Even Saturdays Excluded (<strong className="text-gray-200 font-mono font-semibold">{monthInfo.totalEvenSaturdays}</strong>)</span>
                  </div>
                  <div className="flex items-center gap-1.5 font-sans" title="Designated festival/national holidays are omitted">
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Holidays Excluded (<strong className="text-gray-200 font-mono font-semibold">{monthInfo.activeHolidays.length}</strong>)</span>
                  </div>
                </div>
              </div>

              {/* Template generator & action box */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 shrink-0 lg:border-l lg:border-[#2A2D35] lg:pl-5">
                <div className="text-center sm:text-right shrink-0">
                  <span className="text-[10px] text-gray-500 uppercase tracking-widest block font-bold font-mono">Targets Generated</span>
                  <strong className="text-blue-400 text-sm font-semibold">{monthInfo.totalWorkingDays} Working Logs</strong>
                </div>
                
                <button 
                  onClick={handleGenerateTemplate}
                  className="bg-blue-600 hover:bg-blue-700 hover:scale-[1.01] text-white py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-blue-600/10 transition-all active:scale-[0.99]"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Generate Clean Month</span>
                </button>
              </div>
            </div>
          </section>

          {/* --- Collapsible Workspace Setup Hub & Cloud Sync Drawer --- */}
          <section id="workspace-setup-hub-container" className="flex flex-col gap-4">
            {/* 1. Header Bar with stats badges */}
            <div className="bg-[#f1efea] border border-[#2A2D35]/80 rounded-2xl p-3 px-4 md:px-5 flex flex-wrap items-center justify-between gap-4 transition-all duration-200">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-300 mr-2">
                  <Settings className="w-4 h-4 text-gray-400" />
                  <span>Workspace Configuration:</span>
                </div>
                
                {/* Profile setup status */}
                <div className="flex items-center gap-1.5 text-[11px] text-gray-400 bg-[#1C1F26]/40 px-2.5 py-1 rounded-full border border-[#2A2D35]">
                  <GraduationCap className="w-3.5 h-3.5 text-blue-400" />
                  <span>Scholar: <strong className="text-gray-200">{scholar.name || 'Set Profile Name'}</strong></span>
                </div>

                {/* Cloud Sync Status info */}
                <div className="flex items-center gap-1.5 text-[11px] text-gray-400 bg-[#1C1F26]/40 px-2.5 py-1 rounded-full border border-[#2A2D35]">
                  <Cloud className={`w-3.5 h-3.5 ${user ? 'text-emerald-400' : 'text-gray-500'}`} />
                  <span>Cloud: <strong className="text-gray-200">{user ? user.email : 'Local Only'}</strong></span>
                </div>

                {/* Active Holidays status */}
                <div className="flex items-center gap-1.5 text-[11px] text-gray-400 bg-[#1C1F26]/40 px-2.5 py-1 rounded-full border border-[#2A2D35]">
                  <CalendarIcon className="w-3.5 h-3.5 text-blue-400" />
                  <span>Muted Holidays: <strong className="text-gray-200">{holidays.length} active</strong></span>
                </div>
              </div>

              {/* Toggle Button */}
              <button
                onClick={() => setShowAdvancedSetup(!showAdvancedSetup)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border cursor-pointer ${
                  showAdvancedSetup 
                    ? 'bg-blue-600/10 text-blue-400 border-blue-500/20' 
                    : 'bg-[#2A2D35] text-gray-300 border-[#343842] hover:bg-[#343842] hover:text-white'
                }`}
              >
                <span>{showAdvancedSetup ? 'Hide Setup Console' : 'Open Setup Console'}</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showAdvancedSetup ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {/* 2. Expanded Setup Workbench Drawer */}
            {showAdvancedSetup && (
              <div className="bg-[#15171C] border border-[#2A2D35] rounded-2xl shadow-md p-5 md:p-6 space-y-5 animate-fadeIn">
                {/* Tab select strip */}
                <div className="flex flex-wrap items-center gap-2 border-b border-[#2A2D35] pb-2">
                  <button 
                    onClick={() => setActiveSetupTab('profile')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                      activeSetupTab === 'profile' 
                        ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20' 
                        : 'text-gray-400 hover:text-white bg-transparent border border-transparent'
                    }`}
                  >
                    <GraduationCap className="w-4 h-4" />
                    <span>🎓 Scholar Profile Details</span>
                  </button>

                  <button 
                    onClick={() => setActiveSetupTab('cloud')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                      activeSetupTab === 'cloud' 
                        ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20' 
                        : 'text-gray-400 hover:text-white bg-transparent border border-transparent'
                    }`}
                  >
                    <Cloud className="w-4 h-4" />
                    <span>☁️ Cloud Multi-Device Sync</span>
                  </button>

                  <button 
                    onClick={() => setActiveSetupTab('holidays')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                      activeSetupTab === 'holidays' 
                        ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20' 
                        : 'text-gray-400 hover:text-white bg-transparent border border-transparent'
                    }`}
                  >
                    <CalendarIcon className="w-4 h-4" />
                    <span>📅 Configure Holidays</span>
                  </button>

                  <button 
                    onClick={() => setActiveSetupTab('imports')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                      activeSetupTab === 'imports' 
                        ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20' 
                        : 'text-gray-400 hover:text-white bg-transparent border border-transparent'
                    }`}
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>📊 Spreadsheet Sync & CSV Imports</span>
                  </button>
                </div>

                {/* Tab content bodies */}
                <div className="pt-2">
                  {/* Active Tab A: Scholar Profile Details */}
                  {activeSetupTab === 'profile' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between border-b border-[#2A2D35] pb-3">
                        <div>
                          <h3 className="text-xs uppercase font-bold tracking-wider text-white">Academic Placement Details</h3>
                          <p className="text-[11px] text-gray-500 leading-normal">Configure JRF supervisor names, affiliated university, timing requirements and thesis topics printed in university templates.</p>
                        </div>
                        <button 
                          onClick={() => setEditingScholar(!editingScholar)}
                          className={`text-xs font-semibold px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 border transition-all cursor-pointer ${
                            editingScholar 
                              ? 'bg-blue-600/25 text-blue-400 border-blue-600/40' 
                              : 'bg-[#2A2D35] text-gray-300 border-[#343842] hover:bg-[#343842] hover:text-white'
                          }`}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>{editingScholar ? 'Lock Profile Data' : 'Modify Scholar Fields'}</span>
                        </button>
                      </div>

                      {editingScholar ? (
                        /* Editable Meta Form */
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                          <div>
                            <label className="block text-gray-400 font-semibold mb-1 uppercase tracking-wider text-[10px]">Scholar Full Name</label>
                            <input 
                              type="text" 
                              value={scholar.name} 
                              onChange={(e) => setScholar({ ...scholar, name: e.target.value })}
                              className="w-full bg-[#1C1F26] text-white border border-[#2A2D35] rounded-xl p-2.5 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-gray-400 font-semibold mb-1 uppercase tracking-wider text-[10px]">Designation / Role</label>
                            <input 
                              type="text" 
                              value={scholar.designation} 
                              onChange={(e) => setScholar({ ...scholar, designation: e.target.value })}
                              className="w-full bg-[#1C1F26] text-white border border-[#2A2D35] rounded-xl p-2.5 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-gray-400 font-semibold mb-1 uppercase tracking-wider text-[10px]">Department</label>
                            <input 
                              type="text" 
                              value={scholar.department} 
                              onChange={(e) => setScholar({ ...scholar, department: e.target.value })}
                              className="w-full bg-[#1C1F26] text-white border border-[#2A2D35] rounded-xl p-2.5 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-gray-400 font-semibold mb-1 uppercase tracking-wider text-[10px]">Research Guide supervisor</label>
                            <input 
                              type="text" 
                              value={scholar.guide} 
                              onChange={(e) => setScholar({ ...scholar, guide: e.target.value })}
                              className="w-full bg-[#1C1F26] text-white border border-[#2A2D35] rounded-xl p-2.5 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-gray-400 font-semibold mb-1 uppercase tracking-wider text-[10px]">Affiliated University</label>
                            <input 
                              type="text" 
                              value={scholar.university} 
                              onChange={(e) => setScholar({ ...scholar, university: e.target.value })}
                              className="w-full bg-[#1C1F26] text-white border border-[#2A2D35] rounded-xl p-2.5 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-gray-400 font-semibold mb-1 uppercase tracking-wider text-[10px]">Research Dissertation / Thesis Topic</label>
                            <textarea 
                              rows={2}
                              value={scholar.researchTopic} 
                              onChange={(e) => setScholar({ ...scholar, researchTopic: e.target.value })}
                              className="w-full bg-[#1C1F26] text-white border border-[#2A2D35] rounded-xl p-2.5 focus:ring-1 focus:ring-blue-500 focus:outline-none font-serif"
                            />
                          </div>
                          <div>
                            <label className="block text-gray-400 font-semibold mb-1 uppercase tracking-wider text-[10px]">Daily Working Hours</label>
                            <input 
                              type="text" 
                              value={scholar.workingHours} 
                              onChange={(e) => setScholar({ ...scholar, workingHours: e.target.value })}
                              className="w-full bg-[#1C1F26] text-white border border-[#2A2D35] rounded-xl p-2.5 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-gray-400 font-semibold mb-1 uppercase tracking-wider text-[10px]">Recess Break Slot</label>
                            <input 
                              type="text" 
                              value={scholar.recess} 
                              onChange={(e) => setScholar({ ...scholar, recess: e.target.value })}
                              className="w-full bg-[#1C1F26] text-white border border-[#2A2D35] rounded-xl p-2.5 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                            />
                          </div>
                        </div>
                      ) : (
                        /* Display Profile details card */
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs bg-[#1C1F26]/30 border border-[#2A2D35] p-5 rounded-2xl">
                          <div className="space-y-1">
                            <p className="text-gray-500 font-bold uppercase tracking-wider text-[10px]">JRF Scholar Name</p>
                            <p className="text-sm font-bold text-white leading-normal">{scholar.name || 'Not configured yet'}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-gray-500 font-bold uppercase tracking-wider text-[10px]">Academic Placement Details</p>
                            <p className="text-sm font-semibold text-gray-200">{scholar.designation}</p>
                            <p className="text-xs text-gray-400">{scholar.department}</p>
                            <p className="text-xs text-gray-500 leading-normal">{scholar.university}</p>
                          </div>
                          <div className="space-y-1 md:col-span-2 bg-[#1C1F26]/70 p-4 border border-[#2A2D35]/60 rounded-xl">
                            <p className="text-gray-500 font-semibold uppercase tracking-widest text-[9px]">Research Dissertation Scope</p>
                            <p className="text-xs font-serif font-medium text-gray-200 italic leading-relaxed">
                              "{scholar.researchTopic}"
                            </p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-gray-500 font-bold uppercase tracking-wider text-[10px]">Research supervisor (guide)</p>
                            <p className="text-xs font-semibold text-gray-300">{scholar.guide}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-gray-500 font-bold uppercase tracking-wider text-[10px]">Prescribed Timings</p>
                            <p className="text-xs text-blue-400 font-mono">
                              ⏱️ {scholar.workingHours} (Break: {scholar.recess})
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Active Tab B: Cloud Multi-Device Sync */}
                  {activeSetupTab === 'cloud' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      <div className="lg:col-span-2 space-y-4">
                        <div className="flex items-center gap-2">
                          <div className={`p-1.5 rounded-lg ${user ? 'bg-emerald-500/10 text-emerald-400' : 'bg-blue-500/10 text-blue-400'}`}>
                            <Cloud className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="text-xs uppercase font-bold tracking-wider text-white">Cloud Multi-Device Backup</h3>
                            <p className="text-[11px] text-gray-500 leading-normal">Sync your scholar file profiles, and custom schedules automatically in the cloud.</p>
                          </div>
                        </div>

                        <p className="text-xs text-gray-400 leading-relaxed">
                          {user 
                            ? "Your scholar profile, logs, custom holidays, and configurations are connected automatically in real-time. Any adjustments made here reflect instantly on all registered browser sessions."
                            : "Registering connects your database with Firebase Auth, enabling immediate save-states. Your work log spreadsheets won't clear even if you reset or change devices."
                          }
                        </p>

                        {user ? (
                          <div className="flex flex-wrap items-center gap-y-2 gap-x-6 text-xs text-gray-300 bg-[#1C1F26]/30 border border-[#2A2D35] p-4 rounded-xl">
                            <div>
                              <span className="text-gray-500 uppercase tracking-wider text-[10px] block font-bold">Logged In Account</span>
                              <strong className="text-blue-400">{user.email}</strong>
                            </div>
                            <div>
                              <span className="text-gray-500 uppercase tracking-wider text-[10px] block font-bold">Synchronization Status</span>
                              <span className="flex items-center gap-1.5 mt-0.5">
                                {cloudSyncStatus === 'saving' ? (
                                  <>
                                    <RefreshCw className="w-3.5 h-3.5 text-blue-400 animate-spin" />
                                    <span className="text-blue-400 font-semibold font-mono animate-pulse">Syncing...</span>
                                  </>
                                ) : cloudSyncStatus === 'error' ? (
                                  <>
                                    <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                                    <span className="text-red-400 font-bold font-mono">Sync stalled</span>
                                  </>
                                ) : (
                                  <>
                                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                                    <span className="text-emerald-400 font-bold font-mono">Connected & Secured</span>
                                  </>
                                )}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-500 uppercase tracking-wider text-[10px] block font-bold">Last Cloud Backup</span>
                              <span className="font-mono text-gray-200 mt-0.5 block">{cloudLastSaved ? cloudLastSaved : 'Synced just now'}</span>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-xs text-gray-500 italic">
                            <Info className="w-4 h-4 text-blue-500 shrink-0" />
                            <span>Authentication values are verified and encrypted using Firebase security architecture rules.</span>
                          </div>
                        )}
                      </div>

                      {/* Right Control Pane */}
                      <div className="bg-[#1C1F26]/40 border border-[#2A2D35] rounded-2xl p-4 flex flex-col justify-center gap-3">
                        {authLoading ? (
                          <div className="flex flex-col items-center justify-center p-6 gap-2 text-xs text-gray-400">
                            <RefreshCw className="w-6 h-6 text-blue-500 animate-spin" />
                            <span>Syncing database credentials...</span>
                          </div>
                        ) : user ? (
                          <div className="space-y-2">
                            <p className="text-[10px] uppercase font-bold tracking-wider text-gray-500 text-center">Cloud Management</p>
                            <button
                              type="button"
                              onClick={handleCloudSignOut}
                              className="w-full py-2.5 px-3 bg-[#2A2D35] hover:bg-red-950/25 hover:text-red-400 hover:border-red-900/30 border border-[#343842] text-gray-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
                            >
                              <LogOut className="w-3.5 h-3.5" />
                              <span>Sign Out Account</span>
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <p className="text-[10px] uppercase font-bold tracking-wider text-emerald-400 text-center">Quick Access Setup</p>
                            <button
                              type="button"
                              onClick={handleGoogleSignIn}
                              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm shadow-emerald-950/20"
                            >
                              <Cloud className="w-4 h-4" />
                              <span>One-Click Google Sync</span>
                            </button>

                            <div className="flex items-center gap-2 my-1 text-gray-500">
                              <span className="h-px bg-[#2A2D35] flex-1"></span>
                              <span className="text-[9px] uppercase font-bold text-gray-655 font-mono">or email credentials</span>
                              <span className="h-px bg-[#2A2D35] flex-1"></span>
                            </div>

                            <form onSubmit={handleCloudSignIn} className="space-y-2">
                              <div className="text-[10px] uppercase font-bold tracking-wider text-gray-400 flex items-center gap-1 justify-between">
                                <span>{isSignUp ? "Register Backup" : "Sign In & Sync"}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsSignUp(!isSignUp);
                                    setAuthErrorAlert('');
                                  }}
                                  className="text-blue-550 hover:underline text-[9px] lowercase font-semibold"
                                >
                                  {isSignUp ? "switch to login" : "switch to register"}
                                </button>
                              </div>

                              <input
                                type="email"
                                placeholder="your.email@example.com"
                                value={authEmail}
                                onChange={(e) => setAuthEmail(e.target.value)}
                                className="w-full bg-[#15171C] text-white border border-[#2A2D35] rounded-xl pl-3 pr-2.5 py-1.5 text-xs focus:outline-none"
                              />

                              <input
                                type="password"
                                placeholder="six-character password"
                                value={authPassword}
                                onChange={(e) => setAuthPassword(e.target.value)}
                                className="w-full bg-[#15171C] text-white border border-[#2A2D35] rounded-xl pl-3 pr-2.5 py-1.5 text-xs focus:outline-none"
                              />

                              {authErrorAlert && (
                                <p className="text-[10px] text-red-500 bg-red-500/5 p-2 rounded-lg leading-snug border border-red-500/15">
                                  {authErrorAlert}
                                </p>
                              )}

                              <button
                                type="submit"
                                className="w-full py-2 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                              >
                                {isSignUp ? "Register Sync State" : "Load Sync State"}
                              </button>
                            </form>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Active Tab C: Configure Holidays */}
                  {activeSetupTab === 'holidays' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-3 text-xs leading-relaxed text-gray-400">
                        <div className="flex items-center gap-1.5 border-b border-[#2A2D35] pb-2">
                          <h3 className="font-bold text-xs uppercase tracking-wider text-white">Holiday Calendar Configurations</h3>
                        </div>
                        <p>
                          JRF work log guidelines exclude Indian national and state festival holidays. System presets automatically mute days like Makar Sankranti, Republic Day, Holi or Independence Day matching your month framework parameters.
                        </p>
                        
                        <div className="bg-[#1C1F26]/30 border border-[#2A2D35] p-3 rounded-xl space-y-2 mt-2">
                          <p className="font-bold text-[10px] uppercase text-gray-500 tracking-wider">Holidays in {selectedMonthName}:</p>
                          {monthInfo.activeHolidays.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                              {monthInfo.activeHolidays.map(h => (
                                <span key={h.date} className="px-2.5 py-1 rounded bg-blue-500/10 text-blue-500 border border-blue-500/20 text-[10px] font-semibold font-mono">
                                  {h.name} ({h.date})
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[11px] italic text-gray-500">No scheduled calendar holidays in {selectedMonthName} selection.</p>
                          )}
                        </div>

                        <div className="text-[11px] text-gray-400 bg-blue-500/5 border border-blue-500/10 p-3 rounded-lg leading-relaxed mt-2">
                          💡 Adding customized holidays in the right manager column guarantees they are automatically omitted if you run <b>"Generate Clean Month"</b>.
                        </div>
                      </div>

                      {/* Holidays Custom List Manager Form */}
                      <div className="space-y-3 bg-[#1C1F26]/30 border border-[#2A2D35] p-4 rounded-2xl">
                        <div className="flex items-center justify-between">
                          <h4 className="text-[11px] uppercase font-bold tracking-wider text-white">Master holiday calendar list</h4>
                          <span className="text-[10px] font-mono font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full">
                            {holidays.length} active
                          </span>
                        </div>

                        <form onSubmit={(e) => {
                          e.preventDefault();
                          const fd = new FormData(e.currentTarget);
                          const dt = fd.get('h_date') as string;
                          const nm = fd.get('h_name') as string;
                          if (dt && nm) {
                            handleAddHoliday(dt, nm);
                            e.currentTarget.reset();
                          }
                        }} className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-2 bg-[#1C1F26]/60 rounded-xl border border-[#2A2D35]">
                          <input type="date" name="h_date" className="p-2 text-xs border border-[#2A2D35] bg-[#0F1115] text-white rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500" required />
                          <input type="text" name="h_name" placeholder="Makar Sankranti" className="p-2 text-xs border border-[#2A2D35] bg-[#0F1115] text-white rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500" required />
                          <button type="submit" className="sm:col-span-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-1.5 text-xs font-bold cursor-pointer transition-all">Add Custom Holiday</button>
                        </form>

                        <div className="max-h-48 overflow-y-auto divide-y divide-[#2A2D35] border border-[#2A2D35] rounded-xl bg-[#0F1115]">
                          {holidays.length === 0 ? (
                            <div className="p-4 text-center text-xs text-gray-500 italic">No custom holidays configured.</div>
                          ) : (
                            holidays.map(h => (
                              <div key={h.date} className="p-2 px-3 flex justify-between items-center hover:bg-[#1C1F26]/35 group text-xs">
                                <span className="font-mono text-gray-400">{h.date}</span>
                                <strong className="font-medium text-gray-200">{h.name}</strong>
                                <button type="button" onClick={() => handleRemoveHoliday(h.date)} className="text-red-400 hover:text-red-600 text-sm pl-2 font-bold select-none cursor-pointer">×</button>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Active Tab D: Spreadsheet Sync & CSV Imports */}
                  {activeSetupTab === 'imports' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Left: CSV Loader */}
                      <div className="space-y-3 bg-[#1C1F26]/30 border border-[#2A2D35] p-5 rounded-2xl flex flex-col justify-between">
                        <div className="space-y-2">
                          <h3 className="font-display font-semibold text-xs uppercase tracking-wider text-white flex items-center gap-1.5">
                            <Upload className="w-4 h-4 text-emerald-400" />
                            <span>Ingest prepared CSV Sheet</span>
                          </h3>
                          <p className="text-xs text-gray-400 leading-relaxed font-sans">
                            Log history spreadsheet recorded elsewhere? Drag & drop or select an existing monthly log CSV file to populate all days at once.
                          </p>

                          <div className="flex flex-col gap-2 pt-1">
                            <div className="relative">
                              <input 
                                type="file" 
                                accept=".csv" 
                                onChange={handleFileUpload}
                                className="absolute inset-0 opacity-0 cursor-pointer w-full"
                                id="csv-file-picker"
                              />
                              <div className="border border-dashed border-[#2A2D35] hover:border-blue-500 rounded-xl p-3.5 text-center transition-all bg-blue-500/5 cursor-pointer">
                                <span className="text-xs font-semibold text-blue-400 flex items-center justify-center gap-1.5">
                                  <FileSpreadsheet className="w-4 h-4" />
                                  <span>Drag or Choose CSV File</span>
                                </span>
                              </div>
                            </div>
                            
                            <button 
                              onClick={() => setShowCsvBox(!showCsvBox)}
                              className="text-center text-[10px] text-gray-500 font-semibold hover:text-blue-400 cursor-pointer"
                            >
                              {showCsvBox ? "Collapse raw text field" : "Or paste manual CSV lines..."}
                            </button>
                          </div>

                          {showCsvBox && (
                            <div className="space-y-2 mt-2 animate-fadeIn">
                              <textarea 
                                rows={4} 
                                placeholder='Date,Time Slot,Activity Type,Detailed Description of Work,Remarks&#10;"Thursday, January 01, 2026",12:00 to 2:00,Reading,"Ramakrishnan, E. V. Preface"'
                                value={csvInput}
                                onChange={(e) => setCsvInput(e.target.value)}
                                className="w-full font-mono text-[10px] p-2 bg-[#1C2028] text-white border border-[#2A2D35] rounded-xl focus:outline-none"
                              />
                              <button 
                                onClick={handleImportCSV}
                                className="w-full bg-[#107C41] hover:bg-[#0E6C38] text-white rounded-xl py-1.5 text-xs font-bold transition-all cursor-pointer"
                              >
                                Parse Paste Code
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right: Google Sheets Integration */}
                      <div className="space-y-3 bg-[#1C1F26]/30 border border-[#2A2D35] p-5 rounded-2xl flex flex-col justify-between">
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between border-b border-[#2A2D35] pb-2">
                            <h3 className="font-display font-semibold text-xs uppercase tracking-wider text-white flex items-center gap-1.5">
                              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                              <span>Live Google Sheets Sync</span>
                            </h3>
                            <button 
                              onClick={() => setShowGoogleSyncCard(!showGoogleSyncCard)}
                              className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                                showGoogleSyncCard ? 'bg-blue-600/20 text-blue-400 border-blue-500/30' : 'bg-[#2A2D35] text-gray-400 hover:text-white border-transparent'
                              }`}
                              title="Sync preferences"
                            >
                              <Settings className="w-4 h-4" />
                            </button>
                          </div>

                          <p className="text-xs text-gray-400 leading-relaxed font-sans">
                            Export your currently loaded JRF work log table straight into an active sheet file with your signature block prefilled.
                          </p>

                          <div className="space-y-2 pt-1 text-xs">
                            <button 
                              onClick={handleSheetsSync}
                              className="w-full bg-[#107C41] hover:bg-[#0E6C38] active:scale-[0.98] text-white py-2.5 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
                            >
                              <span>Sync Logs directly to Google Drive</span>
                            </button>

                            {syncingStatus && (
                              <p className="text-[10px] font-semibold text-gray-300 italic border-l-2 border-blue-500 pl-2 mt-2 leading-relaxed animate-pulse">
                                status: {syncingStatus}
                              </p>
                            )}

                            {syncedSheetUrl && (
                              <a 
                                href={syncedSheetUrl} 
                                target="_blank" 
                                rel="noreferrer"
                                className="text-[11px] font-bold text-emerald-400 hover:underline flex items-center gap-1 mt-2.5 bg-emerald-500/5 p-2 rounded-lg border border-emerald-500/10"
                              >
                                <Maximize2 className="w-3.5 h-3.5" />
                                <span>Open spreadsheet document link</span>
                              </a>
                            )}
                          </div>

                          {showGoogleSyncCard && (
                            <div className="bg-[#1D212A] p-3 rounded-xl border border-[#2A2D35] space-y-2 mt-3 animate-fadeIn">
                              <p className="font-bold text-[10px] uppercase text-gray-400">OAuth verification token</p>
                              <p className="text-[10px] text-gray-500 leading-normal">
                                Connect workspace sheets via temporary access bearer credentials:
                              </p>
                              <input 
                                type="password"
                                placeholder="ya29.a0AfH..."
                                value={googleAccessToken}
                                onChange={(e) => setGoogleAccessToken(e.target.value)}
                                className="w-full text-xs p-2 bg-[#1C1F26] border border-[#2A2D35] text-white rounded-lg focus:outline-none"
                              />
                              <div className="text-[10px] text-gray-500 italic leading-snug">
                                Keeps security constraints secure under preview constraints.
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>

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
                    {/* Option to select single entry, bulk entry, or reading planner - Elegant Segmented Tabs */}
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                        Log Entry Mode:
                      </label>
                      <div className="grid grid-cols-3 p-1 bg-[#101216] border border-[#2A2D35] rounded-xl w-full mb-2 select-none">
                        <button
                          type="button"
                          onClick={() => {
                            setBuilderMultiDaySelect(false);
                            setIsReadingPlanner(false);
                          }}
                          className={`py-2 text-[10px] sm:text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer border-[#2A2D35] ${
                            !builderMultiDaySelect && !isReadingPlanner
                              ? 'bg-blue-600 text-white shadow-md shadow-blue-950/40' 
                              : 'bg-transparent text-gray-300 hover:text-white'
                          }`}
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Single</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setBuilderMultiDaySelect(true);
                            setIsReadingPlanner(false);
                          }}
                          className={`py-2 text-[10px] sm:text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer border-[#2A2D35] ${
                            builderMultiDaySelect && !isReadingPlanner
                              ? 'bg-amber-600 text-white shadow-md shadow-amber-950/40' 
                              : 'bg-transparent text-gray-300 hover:text-white'
                          }`}
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Bulk</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setBuilderMultiDaySelect(true);
                            setIsReadingPlanner(true);
                          }}
                          className={`py-2 text-[10px] sm:text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer border-[#2A2D35] ${
                            builderMultiDaySelect && isReadingPlanner
                              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/40' 
                              : 'bg-transparent text-gray-300 hover:text-white'
                          }`}
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                          <span>Reading</span>
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
                            <span className="font-mono">Date: {selectedYear}-{String(selectedMonth + 1).padStart(2, '0')}-{String(builderDay).padStart(2, '0')}</span>
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

                    {!isReadingPlanner ? (
                      <>
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
                      </>
                    ) : (
                      /* Reading Planner Notice */
                      <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-xl p-3 space-y-2 text-[11px] text-emerald-400">
                        <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-[10px]">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Automated Schedules Active</span>
                        </div>
                        <p className="text-gray-300 leading-normal">
                          For each day selected, the planner automatically generates work logs for both mandatory daily reading slots:
                        </p>
                        <div className="grid grid-cols-2 gap-2 text-center font-mono font-bold pt-1">
                          <div className="bg-[#101216] p-1.5 rounded border border-[#2A2D35]">
                            🌅 {slot1Hours}
                          </div>
                          <div className="bg-[#101216] p-1.5 rounded border border-[#2A2D35]">
                            🌇 {slot2Hours}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Dynamic Form depending on mode */}
                  <div className="lg:col-span-7 flex flex-col justify-between space-y-4">
                    {!isReadingPlanner ? (
                      /* Standard Builder View */
                      <>
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
                              className="w-full py-2 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 shadow-md shadow-blue-900/30 transition-all cursor-pointer border-none"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Insert into Logbook</span>
                            </button>
                          </div>
                        </div>
                      </>
                    ) : (
                      /* Smart Book Reading Planner View */
                      <div className="space-y-4 animate-in fade-in duration-300">
                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                          <div className="sm:col-span-6 space-y-1.5">
                            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                              📚 Book / Research Resource Title:
                            </label>
                            <input 
                              type="text"
                              value={plannerBookTitle}
                              onChange={(e) => {
                                setPlannerBookTitle(e.target.value);
                                setPlannerPreviewPlan(null); // Clear preview to force regenerate
                              }}
                              placeholder="e.g. Foucault's Archeology of Knowledge..."
                              className="w-full bg-[#101216] text-xs text-white border border-[#2A2D35] rounded-lg p-2 focus:ring-1 focus:ring-blue-500 focus:outline-none placeholder-gray-600 font-sans"
                            />
                          </div>

                          <div className="sm:col-span-3 space-y-1.5">
                            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                              🏁 Start Page:
                            </label>
                            <input 
                              type="number"
                              min={1}
                              value={plannerStartPage}
                              onChange={(e) => {
                                setPlannerStartPage(Math.max(1, Number(e.target.value)));
                                setPlannerPreviewPlan(null);
                              }}
                              className="w-full bg-[#101216] text-xs text-white border border-[#2A2D35] rounded-lg p-2 font-mono focus:ring-1 focus:ring-blue-500 focus:outline-none"
                            />
                          </div>

                          <div className="sm:col-span-3 space-y-1.5">
                            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                              🏁 End Page:
                            </label>
                            <input 
                              type="number"
                              min={1}
                              value={plannerEndPage}
                              onChange={(e) => {
                                setPlannerEndPage(Math.max(1, Number(e.target.value)));
                                setPlannerPreviewPlan(null);
                              }}
                              className="w-full bg-[#101216] text-xs text-white border border-[#2A2D35] rounded-lg p-2 font-mono focus:ring-1 focus:ring-blue-500 focus:outline-none"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                          <div className="sm:col-span-6 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                                🚫 Page Exclusions (indices, indexes, etc):
                              </label>
                              <span className="text-[9px] text-amber-500 font-mono">e.g. 1-12, 110, 145-150</span>
                            </div>
                            <input 
                              type="text"
                              value={plannerExcludePages}
                              onChange={(e) => {
                                setPlannerExcludePages(e.target.value);
                                setPlannerPreviewPlan(null);
                              }}
                              placeholder="Comma-separated pages/ranges to skip..."
                              className="w-full bg-[#101216] text-xs text-white border border-[#2A2D35] rounded-lg p-2 font-mono focus:ring-1 focus:ring-blue-500 focus:outline-none placeholder-gray-600"
                            />
                          </div>

                          <div className="sm:col-span-6 space-y-1.5">
                            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                              ✍️ Log Writing Style Vocabulary:
                            </label>
                            <select
                              value={plannerDescriptionStyle}
                              onChange={(e) => {
                                setPlannerDescriptionStyle(e.target.value);
                                setPlannerPreviewPlan(null);
                              }}
                              className="w-full bg-[#101216] text-xs text-white border border-[#2A2D35] rounded-lg p-2 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                            >
                              <option value="standard">📖 Simple/Standard Book Reading Log</option>
                              <option value="academic">🎓 Comprehensive Intellectual Lit Synthesis</option>
                              <option value="analytical">📊 Critical Summary & Thematic Notes</option>
                              <option value="detailed">✍️ Reference Reading & Resource Bibliographies</option>
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                          {/* Randomization distribution select */}
                          <div className="sm:col-span-7 space-y-1.5">
                            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                              📦 Page Allocation Distribution Algorithm:
                            </label>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setPlannerRandomize(true);
                                  setPlannerPreviewPlan(null);
                                }}
                                className={`flex-1 py-1.5 px-2 rounded-lg text-center font-semibold text-[10px] sm:text-xs border cursor-pointer transition-all ${
                                  plannerRandomize 
                                    ? 'bg-blue-600/10 border-blue-500 text-blue-400' 
                                    : 'bg-[#101216] border-[#2A2D35] text-gray-400 hover:text-gray-200'
                                }`}
                              >
                                🎲 Random Pages per Day
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setPlannerRandomize(false);
                                  setPlannerPreviewPlan(null);
                                }}
                                className={`flex-1 py-1.5 px-2 rounded-lg text-center font-semibold text-[10px] sm:text-xs border cursor-pointer transition-all ${
                                  !plannerRandomize 
                                    ? 'bg-blue-600/10 border-blue-500 text-blue-400' 
                                    : 'bg-[#101216] border-[#2A2D35] text-gray-400 hover:text-gray-200'
                                }`}
                              >
                                ⚖️ Even Pages per Slot
                              </button>
                            </div>
                          </div>

                          {/* Collision action */}
                          <div className="sm:col-span-12 md:col-span-5 space-y-1.5">
                            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                              🛡️ Duplicate Calendar Collision Rules:
                            </label>
                            <select
                              value={plannerCollisionResolution}
                              onChange={(e) => setPlannerCollisionResolution(e.target.value as any)}
                              className="w-full bg-[#101216] text-xs text-white border border-[#2A2D35] rounded-lg p-2 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                            >
                              <option value="parallel">➕ Keep concurrent parallel entries</option>
                              <option value="overwrite">💥 destructive overwrite existing logs</option>
                              <option value="skip">🚯 skip days with existing logs</option>
                            </select>
                          </div>
                        </div>

                        {/* Actions to Preview vs Submit */}
                        <div className="flex flex-wrap gap-2.5 pt-1.5">
                          <button
                            type="button"
                            onClick={handleGenerateReadingPlanPreview}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 border-none rounded-lg text-xs flex items-center gap-1.5 shadow-md shadow-emerald-900/30 transition-all cursor-pointer"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
                            <span>Generate Preview Plan</span>
                          </button>

                          {plannerPreviewPlan && plannerPreviewPlan.length > 0 && (
                            <button
                              type="button"
                              onClick={handleExecuteReadingPlan}
                              className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 border-none rounded-lg text-xs flex items-center gap-1.5 shadow-md shadow-blue-900/30 transition-all cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Confirm & Insert {plannerPreviewPlan.filter(p => p.pages.length > 0).length} Entries Into Logbook</span>
                            </button>
                          )}
                        </div>

                        {/* Interactive Preview Block */}
                        {plannerPreviewPlan && (
                          <div className="border border-emerald-500/20 rounded-xl p-3 bg-[#101216] text-xs space-y-2 max-h-[190px] overflow-y-auto animate-in fade-in duration-200">
                            <div className="flex items-center justify-between pb-1.5 border-b border-[#2A2D35] mb-2">
                              <span className="font-bold text-[10px] text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                                <Sparkles className="w-3 h-3 text-yellow-300" /> Calculated Smart Reading Distribution
                              </span>
                              <span className="text-[10px] text-gray-500 font-mono">
                                Total active entries: {plannerPreviewPlan.filter(p => p.pages.length > 0).length} slots
                              </span>
                            </div>
                            <div className="space-y-1.5">
                              {plannerPreviewPlan.map((pPlan, pIdx) => {
                                const isEmpty = pPlan.pages.length === 0;
                                return (
                                  <div 
                                    key={pIdx} 
                                    className={`p-2 rounded-lg border text-[11px] transition-all ${
                                      isEmpty 
                                        ? 'bg-[#1C1F26]/30 border-dashed border-[#2A2D35]/50 opacity-40'
                                        : 'bg-emerald-950/10 border-emerald-500/20'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between font-mono font-bold text-gray-300 mb-0.5">
                                      <span>📅 Day {String(pPlan.day).padStart(2, '0')} ({pPlan.slot})</span>
                                      <span className={`${isEmpty ? 'text-gray-600 text-[10px]' : 'text-emerald-400 bg-emerald-500/10 px-1 rounded text-[10px]'}`}>
                                        {isEmpty ? 'No assignment' : pPlan.pagesText}
                                      </span>
                                    </div>
                                    <p className="text-gray-400 font-serif italic line-clamp-1">{pPlan.description}</p>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
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
                              style={{ colorScheme: 'light' }}
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
