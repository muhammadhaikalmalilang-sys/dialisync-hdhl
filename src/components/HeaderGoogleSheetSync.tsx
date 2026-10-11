import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  FileSpreadsheet, 
  ArrowDownToLine, 
  ArrowUpFromLine, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink, 
  Settings2, 
  Check, 
  Copy, 
  HelpCircle,
  X,
  Radio,
  Calendar,
  Layers,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Send,
  CalendarDays,
  CheckSquare,
  Square,
  Download,
  SlidersHorizontal,
  ListChecks,
  Users,
  Cpu,
  Stethoscope,
  Activity,
  CheckCheck,
  MessageCircle
} from 'lucide-react';
import { 
  ShiftSchedule, 
  HDMachine, 
  MachineAssignment, 
  UserAccount, 
  AppSettings,
  DoctorShiftDuty,
  SpecialTask,
  DEFAULT_SPECIAL_DUTY_OPTIONS
} from '../types';
import { 
  GoogleSheetsService, 
  PartialSyncTargets, 
  DEFAULT_PARTIAL_SYNC_TARGETS 
} from '../domain/GoogleSheetsService';
import { 
  prepareSyncPayload, 
  pushToGoogleSheets, 
  pullFromGoogleSheets, 
  applyPulledDataToApp 
} from '../utils/googleSheetsSyncHelper';
import { exportMonthToExcel, exportMultipleMonthsToExcel } from '../utils/excelExport';
import { GoogleScriptGuideModal } from './GoogleScriptGuideModal';
import { WhatsAppShareModal } from './WhatsAppShareModal';
import { NurseReminderModal } from './NurseReminderModal';

interface HeaderGoogleSheetSyncProps {
  schedules: ShiftSchedule[];
  employees: UserAccount[];
  machines: HDMachine[];
  machineAssignments: MachineAssignment[];
  specialTasks?: SpecialTask[];
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
  onUpdateSchedule: (newSchedules: ShiftSchedule[]) => void;
  onUpdateMachineAssignments: (newAssignments: MachineAssignment[]) => void;
  onUpdateEmployees: (newEmployees: UserAccount[]) => void;
  onUpdateMachines?: (newMachines: HDMachine[]) => void;
  onUpdateSpecialTasks?: (newTasks: SpecialTask[]) => void;
  operationalDate?: string;
  canEdit?: boolean;
}

export const HeaderGoogleSheetSync: React.FC<HeaderGoogleSheetSyncProps> = ({
  schedules,
  employees,
  machines,
  machineAssignments,
  specialTasks = [],
  settings,
  onUpdateSettings,
  onUpdateSchedule,
  onUpdateMachineAssignments,
  onUpdateEmployees,
  onUpdateSpecialTasks,
  operationalDate,
  canEdit = true,
}) => {
  // Determine active month (e.g. "2026-09")
  const defaultMonth = operationalDate
    ? operationalDate.substring(0, 7)
    : `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

  const [selectedMonth, setSelectedMonth] = useState<string>(defaultMonth);
  const [isPulling, setIsPulling] = useState<boolean>(false);
  const [isPushing, setIsPushing] = useState<boolean>(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [showConfigModal, setShowConfigModal] = useState<boolean>(false);
  const [showSheetMenu, setShowSheetMenu] = useState<boolean>(false);
  const [showWhatsAppMenu, setShowWhatsAppMenu] = useState<boolean>(false);
  const [showHeadNurseModal, setShowHeadNurseModal] = useState<boolean>(false);
  const [showNurseReminderModal, setShowNurseReminderModal] = useState<boolean>(false);
  const [selectedWhatsAppDate, setSelectedWhatsAppDate] = useState<string>(
    operationalDate || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`
  );
  const [showPullConfirmModal, setShowPullConfirmModal] = useState<boolean>(false);
  const [showGuideModal, setShowGuideModal] = useState<boolean>(false);
  const [showBatchModal, setShowBatchModal] = useState<boolean>(false);
  const [showPartialModal, setShowPartialModal] = useState<boolean>(false);
  const [selectedBatchMonths, setSelectedBatchMonths] = useState<string[]>([]);
  const [isBatchSending, setIsBatchSending] = useState<boolean>(false);
  const [isPartialSending, setIsPartialSending] = useState<boolean>(false);
  const [batchProgressText, setBatchProgressText] = useState<string>('');
  const [pulledDataPreview, setPulledDataPreview] = useState<any>(null);

  // Targeted partial sync targets (defaults to active schedule modules selected)
  const [partialTargets, setPartialTargets] = useState<Required<PartialSyncTargets>>({
    matrixSchedule: true,
    doctorDuties: true,
    machineAssignments: true,
    specialTasks: true,
    nursesMaster: false,
    machinesMaster: false,
    doctorsMaster: false,
    specialDutiesMaster: false,
  });

  // Form states for config
  const [editWebhookUrl, setEditWebhookUrl] = useState<string>(settings?.googleSheetWebhookUrl || '');
  const [editSpreadsheetUrl, setEditSpreadsheetUrl] = useState<string>(settings?.googleSpreadsheetIdOrUrl || '');
  const [isTestingConnection, setIsTestingConnection] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ isSuccess: boolean; message: string } | null>(null);

  useEffect(() => {
    if (settings?.googleSheetWebhookUrl) {
      setEditWebhookUrl(settings.googleSheetWebhookUrl);
    }
    if (settings?.googleSpreadsheetIdOrUrl) {
      setEditSpreadsheetUrl(settings.googleSpreadsheetIdOrUrl);
    }
  }, [settings?.googleSheetWebhookUrl, settings?.googleSpreadsheetIdOrUrl]);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification((prev) => (prev?.message === message ? null : prev));
    }, 4500);
  };

  const hasWebhook = Boolean(settings?.googleSheetWebhookUrl?.trim());
  const hasSpreadsheet = Boolean(settings?.googleSpreadsheetIdOrUrl?.trim());
  const isConfigured = hasWebhook || hasSpreadsheet;

  // Format month for display (e.g. "September 2026")
  const [yearStr, monthStr] = selectedMonth.split('-');
  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  const monthIdx = parseInt(monthStr, 10) - 1;
  const displayMonthName = `${monthNames[monthIdx] || 'Bulan'} ${yearStr}`;

  // Sync selectedMonth with operationalDate changes
  useEffect(() => {
    if (operationalDate && operationalDate.length >= 7) {
      const opPrefix = operationalDate.substring(0, 7);
      if (opPrefix !== selectedMonth) {
        setSelectedMonth(opPrefix);
      }
    }
  }, [operationalDate]);

  // Sync selectedMonth with hd_month_changed events from ScheduleView
  useEffect(() => {
    const handleMonthEvt = (e: any) => {
      const pfx = e.detail?.monthPrefix;
      if (pfx && typeof pfx === 'string' && pfx.includes('-')) {
        setSelectedMonth(pfx);
      }
    };
    window.addEventListener('hd_month_changed', handleMonthEvt);
    return () => {
      window.removeEventListener('hd_month_changed', handleMonthEvt);
    };
  }, []);

  const changeSelectedMonth = (newMonth: string) => {
    setSelectedMonth(newMonth);
    window.dispatchEvent(new CustomEvent('hd_month_changed', { detail: { monthPrefix: newMonth } }));
  };

  const handlePrevMonth = () => {
    const [y, m] = selectedMonth.split('-');
    let yNum = parseInt(y, 10);
    let mNum = parseInt(m, 10) - 1;
    if (mNum < 1) {
      mNum = 12;
      yNum -= 1;
    }
    changeSelectedMonth(`${yNum}-${String(mNum).padStart(2, '0')}`);
  };

  const handleNextMonth = () => {
    const [y, m] = selectedMonth.split('-');
    let yNum = parseInt(y, 10);
    let mNum = parseInt(m, 10) + 1;
    if (mNum > 12) {
      mNum = 1;
      yNum += 1;
    }
    changeSelectedMonth(`${yNum}-${String(mNum).padStart(2, '0')}`);
  };

  const handleCurrentMonth = () => {
    const now = new Date();
    changeSelectedMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  };

  // Batch Year State for multi-month selection (defaults to current year of selectedMonth)
  const [batchYear, setBatchYear] = useState<number>(() => {
    const [y] = selectedMonth.split('-');
    return parseInt(y, 10) || new Date().getFullYear();
  });

  // Keep batchYear synchronized if selectedMonth year changes
  useEffect(() => {
    const [y] = selectedMonth.split('-');
    const parsedY = parseInt(y, 10);
    if (parsedY && parsedY !== batchYear) {
      setBatchYear(parsedY);
    }
  }, [selectedMonth]);

  // Detected months with active data (schedules, special tasks, assignments) across all years
  const detectedMonths = useMemo(() => {
    const map = new Map<string, { schedules: number; specialTasks: number }>();
    schedules.forEach((s) => {
      if (s.date && s.date.length >= 7) {
        const pfx = s.date.substring(0, 7);
        const cur = map.get(pfx) || { schedules: 0, specialTasks: 0 };
        cur.schedules += 1;
        map.set(pfx, cur);
      }
    });
    specialTasks.forEach((t) => {
      if (t.date && t.date.length >= 7) {
        const pfx = t.date.substring(0, 7);
        const cur = map.get(pfx) || { schedules: 0, specialTasks: 0 };
        cur.specialTasks += 1;
        map.set(pfx, cur);
      }
    });
    machineAssignments.forEach((m) => {
      if (m.date && m.date.length >= 7) {
        const pfx = m.date.substring(0, 7);
        if (!map.has(pfx)) {
          map.set(pfx, { schedules: 0, specialTasks: 0 });
        }
      }
    });
    if (!map.has(selectedMonth)) {
      map.set(selectedMonth, { schedules: 0, specialTasks: 0 });
    }
    return Array.from(map.entries())
      .map(([mPfx, stats]) => {
        const [y, m] = mPfx.split('-');
        const idx = parseInt(m, 10) - 1;
        const name = `${monthNames[idx] || 'Bulan'} ${y}`;
        return {
          prefix: mPfx,
          name,
          count: stats.schedules,
          specialTasksCount: stats.specialTasks,
          totalCount: stats.schedules + stats.specialTasks,
        };
      })
      .sort((a, b) => a.prefix.localeCompare(b.prefix));
  }, [schedules, specialTasks, machineAssignments, selectedMonth]);

  // All 12 months for the currently chosen batchYear
  const availableBatchMonths = useMemo(() => {
    const list = [];
    for (let m = 1; m <= 12; m++) {
      const pfx = `${batchYear}-${String(m).padStart(2, '0')}`;
      const count = schedules.filter((s) => s.date && s.date.startsWith(pfx)).length;
      const name = `${monthNames[m - 1]} ${batchYear}`;
      list.push({ prefix: pfx, name, count, monthNum: m, monthName: monthNames[m - 1] });
    }
    return list;
  }, [batchYear, schedules]);

  // Count active schedules for this month
  const currentMonthSchedulesCount = schedules.filter((s) => s.date.startsWith(selectedMonth)).length;

  // Handler: Kirim Data ke Google Sheets (Push Single Month)
  const handlePushData = async () => {
    if (!settings?.googleSheetWebhookUrl?.trim()) {
      setShowConfigModal(true);
      showToast('Konfigurasikan Webhook URL Google Apps Script terlebih dahulu.', 'info');
      return;
    }

    setIsPushing(true);
    try {
      const payloadData = prepareSyncPayload(
        schedules,
        employees,
        machines,
        machineAssignments,
        selectedMonth,
        specialTasks
      );

      const result = await pushToGoogleSheets(settings, payloadData);
      if (result.isSuccess) {
        if (payloadData.autoGeneratedSchedules && payloadData.autoGeneratedSchedules.length > 0) {
          const merged = [
            ...schedules.filter((s) => !s.date.startsWith(selectedMonth)),
            ...payloadData.autoGeneratedSchedules,
          ];
          onUpdateSchedule(merged);
          if (payloadData.autoGeneratedMachineAssignments) {
            const mergedMA = [
              ...machineAssignments.filter((m) => !m.date.startsWith(selectedMonth)),
              ...payloadData.autoGeneratedMachineAssignments,
            ];
            onUpdateMachineAssignments(mergedMA);
          }
        }

        const updatedSettings: AppSettings = {
          ...settings,
          lastSyncTimestamp: Date.now(),
          lastSyncStatus: `Terkirim: ${displayMonthName} (${payloadData.domainMonthlyAssignments.length} jadwal, ${specialTasks.length} tugas)`,
        };
        onUpdateSettings(updatedSettings);
        showToast(`Berhasil mengirim ${payloadData.domainMonthlyAssignments.length} jadwal shift bulan ${displayMonthName} ke tab "Matriks HD - ${displayMonthName}" di Google Sheets!`, 'success');
      } else {
        showToast(result.message, 'error');
      }
    } catch (err: any) {
      showToast('Terjadi kesalahan saat mengirim: ' + (err?.message || err), 'error');
    } finally {
      setIsPushing(false);
    }
  };

  // Handler: Kirim Parsial / Terarah (Hanya modul-modul spesifik yang dipilih)
  const handlePushPartialData = async () => {
    if (!settings?.googleSheetWebhookUrl?.trim()) {
      setShowConfigModal(true);
      showToast('Konfigurasikan Webhook URL Google Apps Script terlebih dahulu.', 'info');
      return;
    }

    const selectedKeys = Object.entries(partialTargets).filter(([_, v]) => v).map(([k]) => k);
    if (selectedKeys.length === 0) {
      showToast('Pilih minimal 1 modul untuk disinkronkan.', 'info');
      return;
    }

    setIsPartialSending(true);
    try {
      const payloadData = prepareSyncPayload(
        schedules,
        employees,
        machines,
        machineAssignments,
        selectedMonth,
        specialTasks
      );

      const result = await pushToGoogleSheets(settings, payloadData, undefined, partialTargets);
      if (result.isSuccess) {
        if (payloadData.autoGeneratedSchedules && payloadData.autoGeneratedSchedules.length > 0 && partialTargets.matrixSchedule) {
          const merged = [
            ...schedules.filter((s) => !s.date.startsWith(selectedMonth)),
            ...payloadData.autoGeneratedSchedules,
          ];
          onUpdateSchedule(merged);
          if (payloadData.autoGeneratedMachineAssignments && partialTargets.machineAssignments) {
            const mergedMA = [
              ...machineAssignments.filter((m) => !m.date.startsWith(selectedMonth)),
              ...payloadData.autoGeneratedMachineAssignments,
            ];
            onUpdateMachineAssignments(mergedMA);
          }
        }

        const updatedSettings: AppSettings = {
          ...settings,
          lastSyncTimestamp: Date.now(),
          lastSyncStatus: `Sinkron Terarah (${selectedKeys.length} modul) - ${displayMonthName}`,
        };
        onUpdateSettings(updatedSettings);
        showToast(result.message, 'success');
        setShowPartialModal(false);
      } else {
        showToast(result.message, 'error');
      }
    } catch (err: any) {
      showToast('Terjadi kesalahan saat sinkronisasi terarah: ' + (err?.message || err), 'error');
    } finally {
      setIsPartialSending(false);
    }
  };

  // Handler: Kirim Single Month langsung dari modal multi-bulan
  const handlePushSingleMonth = async (targetMonthPrefix: string) => {
    if (!settings?.googleSheetWebhookUrl?.trim()) {
      setShowConfigModal(true);
      showToast('Konfigurasikan Webhook URL Google Apps Script terlebih dahulu.', 'info');
      return;
    }

    const [y, m] = targetMonthPrefix.split('-');
    const mName = `${monthNames[parseInt(m, 10) - 1] || 'Bulan'} ${y}`;
    setIsBatchSending(true);
    setBatchProgressText(`Mengirim ${mName} ke Google Sheets...`);

    try {
      const payloadData = prepareSyncPayload(
        schedules,
        employees,
        machines,
        machineAssignments,
        targetMonthPrefix,
        specialTasks
      );

      const result = await pushToGoogleSheets(settings, payloadData);
      if (result.isSuccess) {
        if (payloadData.autoGeneratedSchedules && payloadData.autoGeneratedSchedules.length > 0) {
          const merged = [
            ...schedules.filter((s) => !s.date.startsWith(targetMonthPrefix)),
            ...payloadData.autoGeneratedSchedules,
          ];
          onUpdateSchedule(merged);
          if (payloadData.autoGeneratedMachineAssignments) {
            const mergedMA = [
              ...(machineAssignments || []).filter((item) => !item.date.startsWith(targetMonthPrefix)),
              ...payloadData.autoGeneratedMachineAssignments,
            ];
            onUpdateMachineAssignments(mergedMA);
          }
        }

        const updatedSettings: AppSettings = {
          ...settings,
          lastSyncTimestamp: Date.now(),
          lastSyncStatus: `Terkirim: ${mName} (${payloadData.domainMonthlyAssignments.length} jadwal)`,
        };
        onUpdateSettings(updatedSettings);
        showToast(`Sukses! Data bulan ${mName} (${payloadData.domainMonthlyAssignments.length} jadwal) berhasil dikirim ke tab "Matriks HD - ${mName}" di Google Sheets.`, 'success');
      } else {
        showToast(result.message, 'error');
      }
    } catch (err: any) {
      showToast('Terjadi kesalahan: ' + (err?.message || err), 'error');
    } finally {
      setIsBatchSending(false);
      setBatchProgressText('');
    }
  };

  // Handler: Ekspor Excel (.xlsx) untuk satu bulan
  const handleExportMonthExcel = (targetMonthPrefix: string) => {
    try {
      exportMonthToExcel(
        targetMonthPrefix,
        schedules,
        employees,
        machines,
        machineAssignments,
        settings?.hospitalName || 'RS Happy Land Medical Centre'
      );
      const [y, m] = targetMonthPrefix.split('-');
      const mName = `${monthNames[parseInt(m, 10) - 1] || 'Bulan'} ${y}`;
      showToast(`File Excel (.xlsx) untuk ${mName} berhasil didownload!`, 'success');
    } catch (err: any) {
      showToast('Gagal ekspor Excel: ' + (err?.message || err), 'error');
    }
  };

  // Handler: Ekspor Excel (.xlsx) untuk beberapa atau semua 12 bulan
  const handleExportMultipleMonthsExcel = () => {
    try {
      const monthsToExport = selectedBatchMonths.length > 0 ? selectedBatchMonths : availableBatchMonths.map((m) => m.prefix);
      exportMultipleMonthsToExcel(
        monthsToExport,
        schedules,
        employees,
        machines,
        machineAssignments
      );
      showToast(`File Excel (.xlsx) untuk ${monthsToExport.length} bulan berhasil didownload!`, 'success');
    } catch (err: any) {
      showToast('Gagal ekspor Excel: ' + (err?.message || err), 'error');
    }
  };

  // Handler: Kirim Semua Bulan Terpilih (Batch Push)
  const handleBatchPushData = async () => {
    if (!settings?.googleSheetWebhookUrl?.trim()) {
      setShowConfigModal(true);
      showToast('Konfigurasikan Webhook URL Google Apps Script terlebih dahulu.', 'info');
      return;
    }

    const monthsToPush = selectedBatchMonths.length > 0 ? selectedBatchMonths : [selectedMonth];
    setIsBatchSending(true);

    let successCount = 0;
    let totalAssignmentsSent = 0;
    let accumulatedSchedules = [...schedules];
    let accumulatedMachineAssignments = [...(machineAssignments || [])];

    try {
      for (let i = 0; i < monthsToPush.length; i++) {
        const mPfx = monthsToPush[i];
        const [y, m] = mPfx.split('-');
        const mName = `${monthNames[parseInt(m, 10) - 1] || 'Bulan'} ${y}`;
        setBatchProgressText(`Mengirim ${mName} (${i + 1}/${monthsToPush.length})...`);

        const payloadData = prepareSyncPayload(
          accumulatedSchedules,
          employees,
          machines,
          accumulatedMachineAssignments,
          mPfx,
          specialTasks
        );

        const res = await pushToGoogleSheets(settings, payloadData);
        if (res.isSuccess) {
          successCount++;
          totalAssignmentsSent += payloadData.domainMonthlyAssignments.length;

          if (payloadData.autoGeneratedSchedules && payloadData.autoGeneratedSchedules.length > 0) {
            accumulatedSchedules = [
              ...accumulatedSchedules.filter((s) => !s.date.startsWith(mPfx)),
              ...payloadData.autoGeneratedSchedules,
            ];
            if (payloadData.autoGeneratedMachineAssignments) {
              accumulatedMachineAssignments = [
                ...accumulatedMachineAssignments.filter((m) => !m.date.startsWith(mPfx)),
                ...payloadData.autoGeneratedMachineAssignments,
              ];
            }
          }
        } else {
          showToast(`Gagal mengirim ${mName}: ${res.message}`, 'error');
        }
      }

      onUpdateSchedule(accumulatedSchedules);
      onUpdateMachineAssignments(accumulatedMachineAssignments);

      const updatedSettings: AppSettings = {
        ...settings,
        lastSyncTimestamp: Date.now(),
        lastSyncStatus: `Terkirim: ${successCount} bulan (${totalAssignmentsSent} total jadwal)`,
      };
      onUpdateSettings(updatedSettings);

      showToast(`Sukses! ${successCount} bulan (${totalAssignmentsSent} jadwal) berhasil dikirim ke Google Sheets (arsip tersimpan terpisah).`, 'success');
      setShowBatchModal(false);
    } catch (err: any) {
      showToast('Error pengiriman massal: ' + (err?.message || err), 'error');
    } finally {
      setIsBatchSending(false);
      setBatchProgressText('');
    }
  };

  // Handler: Tarik Data dari Google Sheets (Pull)
  const handleInitiatePull = async () => {
    if (!isConfigured) {
      setShowConfigModal(true);
      showToast('Masukkan Webhook URL atau Link Google Spreadsheet terlebih dahulu.', 'info');
      return;
    }

    setIsPulling(true);
    try {
      const result = await pullFromGoogleSheets(settings, selectedMonth, employees, machines);
      if (result.isSuccess && (result.assignments.length > 0 || (result.doctors && result.doctors.length > 0))) {
        setPulledDataPreview({
          assignments: result.assignments,
          nurses: result.nurses,
          machines: result.machines,
          doctors: result.doctors,
          doctorDuties: result.doctorDuties,
          month: selectedMonth,
          message: result.message,
        });
        setShowPullConfirmModal(true);
      } else if (result.isSuccess) {
        showToast(result.message || 'Tidak ada jadwal ditemukan untuk bulan yang dipilih.', 'info');
      } else {
        showToast(result.message, 'error');
      }
    } catch (err: any) {
      showToast('Gagal menarik data dari Google Sheets: ' + (err?.message || err), 'error');
    } finally {
      setIsPulling(false);
    }
  };

  // Apply pulled data after confirmation
  const handleConfirmApplyPulledData = () => {
    if (!pulledDataPreview) return;

    const { updatedSchedules, updatedMachineAssignments, updatedEmployees, updatedSpecialTasks } = applyPulledDataToApp(
      pulledDataPreview.assignments || [],
      pulledDataPreview.month,
      schedules,
      employees,
      machines,
      machineAssignments,
      specialTasks,
      pulledDataPreview.doctors,
      pulledDataPreview.doctorDuties,
      pulledDataPreview.nurses
    );

    onUpdateSchedule(updatedSchedules);
    onUpdateMachineAssignments(updatedMachineAssignments);
    onUpdateEmployees(updatedEmployees);
    if (onUpdateSpecialTasks && updatedSpecialTasks) {
      onUpdateSpecialTasks(updatedSpecialTasks);
    }

    const docCountMsg = pulledDataPreview.doctors?.length ? ` & ${pulledDataPreview.doctors.length} dokter` : '';
    const nurseCountMsg = pulledDataPreview.nurses?.length ? ` & ${pulledDataPreview.nurses.length} perawat` : '';
    const taskCountMsg = (updatedSpecialTasks || []).length > 0 ? `, ${(updatedSpecialTasks || []).length} tugas khusus` : '';
    const updatedSettings: AppSettings = {
      ...settings,
      lastSyncTimestamp: Date.now(),
      lastSyncStatus: `Ditarik: ${displayMonthName} (${(pulledDataPreview.assignments || []).length} jadwal${docCountMsg}${nurseCountMsg})`,
    };
    onUpdateSettings(updatedSettings);

    showToast(`Berhasil menerapkan ${(pulledDataPreview.assignments || []).length} jadwal shift, alokasi mesin${taskCountMsg}${docCountMsg}${nurseCountMsg} dari Google Sheets!`, 'success');
    setShowPullConfirmModal(false);
    setPulledDataPreview(null);
  };

  // Test connection
  const handleTestConnection = async () => {
    if (!editWebhookUrl.trim()) {
      setTestResult({ isSuccess: false, message: 'Silakan isi Webhook URL terlebih dahulu.' });
      return;
    }
    setIsTestingConnection(true);
    setTestResult(null);
    try {
      const result = await GoogleSheetsService.testConnection(editWebhookUrl.trim());
      setTestResult({
        isSuccess: result.isSuccess,
        message: result.message + (result.latencyMs ? ` (${result.latencyMs}ms)` : ''),
      });
    } catch (err: any) {
      setTestResult({
        isSuccess: false,
        message: 'Gagal terhubung: ' + (err?.message || err),
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  // Save config
  const handleSaveConfig = () => {
    const updated: AppSettings = {
      ...settings,
      googleSheetWebhookUrl: editWebhookUrl.trim(),
      googleSpreadsheetIdOrUrl: editSpreadsheetUrl.trim(),
    };
    onUpdateSettings(updated);
    setShowConfigModal(false);
    showToast('Pengaturan Google Sheets berhasil disimpan.', 'success');
  };

  return (
    <div id="header-google-sheet-sync-bar" className="w-full bg-slate-900/95 text-white border-b border-teal-800/40 backdrop-blur-md px-3 sm:px-6 lg:px-8 py-2 sm:py-2.5 transition-all">
      <div className="max-w-[1680px] mx-auto flex flex-wrap items-center justify-between gap-2.5 sm:gap-3">
        {/* Left: Periode Jadwal & Month Selector */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          <div className="flex items-center space-x-1 bg-slate-800/90 border border-slate-700/80 px-2 sm:px-2.5 rounded-xl shrink-0 h-9">
            <button
              onClick={handlePrevMonth}
              className="p-1 text-slate-400 hover:text-white hover:bg-slate-700/80 rounded-lg transition-colors cursor-pointer"
              title="Pindah ke Bulan Sebelumnya"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center space-x-1.5 px-1">
              <Calendar className="w-4 h-4 text-teal-400 shrink-0" />
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => changeSelectedMonth(e.target.value)}
                className="bg-transparent text-teal-200 text-xs sm:text-[13px] font-bold border-none outline-hidden cursor-pointer p-0 w-[118px]"
                title="Pilih bulan jadwal"
              />
            </div>

            <button
              onClick={handleNextMonth}
              className="p-1 text-slate-400 hover:text-white hover:bg-slate-700/80 rounded-lg transition-colors cursor-pointer"
              title="Pindah ke Bulan Berikutnya"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <button
              onClick={handleCurrentMonth}
              className="px-2 py-0.5 text-[11px] font-bold bg-teal-950/90 text-teal-300 hover:bg-teal-900 rounded-lg border border-teal-800/60 transition-colors cursor-pointer ml-1 hidden sm:inline"
              title="Lompat ke Bulan Ini"
            >
              Hari Ini
            </button>
          </div>
        </div>

        {/* Right: Unified "WhatsApp" & "SHEET" Buttons */}
        <div className="flex items-center space-x-2">
          {/* Unified WhatsApp Button & Dropdown */}
          <div className="relative">
            <button
              id="btn-header-whatsapp-menu"
              onClick={() => {
                setShowWhatsAppMenu(!showWhatsAppMenu);
                if (showSheetMenu) setShowSheetMenu(false);
              }}
              className={`h-9 px-3 sm:px-3.5 rounded-xl font-bold text-xs sm:text-[13px] shadow-sm flex items-center space-x-2 transition-all active:scale-95 cursor-pointer border shrink-0 ${
                showWhatsAppMenu
                  ? 'bg-emerald-500 text-slate-950 border-emerald-300 ring-2 ring-emerald-400/40'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400/50'
              }`}
              title="Kirim Pesan & Ringkasan WhatsApp: Kepala Ruang atau Masing-Masing Perawat"
            >
              <MessageCircle className="w-4 h-4 text-emerald-100 shrink-0" />
              <span className="tracking-wide">WhatsApp</span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-emerald-100 transition-transform duration-150 shrink-0 ${
                  showWhatsAppMenu ? 'rotate-180' : ''
                }`}
              />
            </button>

            {/* WhatsApp Dropdown Menu */}
            {showWhatsAppMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowWhatsAppMenu(false)}
                  aria-hidden="true"
                />
                <div
                  id="header-whatsapp-menu-dropdown"
                  className="absolute right-0 mt-2 w-80 sm:w-96 bg-slate-900 border border-emerald-600/50 rounded-2xl shadow-2xl z-50 text-white py-2.5 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-xl"
                >
                  <div className="px-3.5 py-1.5 border-b border-slate-800 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-6 h-6 rounded-lg bg-emerald-500 text-slate-950 flex items-center justify-center font-bold text-xs">
                        <MessageCircle className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider">
                        Menu WhatsApp
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400">Unit Hemodialisa</span>
                  </div>

                  <div className="px-2 py-2 space-y-1">
                    {/* Item 1: Kirim Ringkasan Jadwal ke WhatsApp Kepala Ruang */}
                    <button
                      id="btn-wa-menu-head-nurse"
                      onClick={() => {
                        setShowWhatsAppMenu(false);
                        setShowHeadNurseModal(true);
                      }}
                      className="w-full px-3 py-2.5 text-left rounded-xl hover:bg-slate-800 flex items-start gap-3 transition cursor-pointer group"
                    >
                      <div className="w-9 h-9 rounded-xl bg-emerald-950 border border-emerald-600/50 flex items-center justify-center shrink-0 group-hover:border-emerald-400 group-hover:bg-emerald-900 transition mt-0.5">
                        <Users className="w-4 h-4 text-emerald-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-slate-200 group-hover:text-emerald-300">
                          Kirim Ringkasan Jadwal ke WhatsApp Kepala Ruang
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">
                          Rekap resmi jadwal dinas, daftar dokter jaga & alokasi mesin perawat harian ke Karu.
                        </div>
                      </div>
                    </button>

                    {/* Item 2: Kirim Pengingat Jadwal via WhatsApp (untuk masing-masing perawat) */}
                    <button
                      id="btn-wa-menu-nurse-reminders"
                      onClick={() => {
                        setShowWhatsAppMenu(false);
                        setShowNurseReminderModal(true);
                      }}
                      className="w-full px-3 py-2.5 text-left rounded-xl hover:bg-slate-800 flex items-start gap-3 transition cursor-pointer group"
                    >
                      <div className="w-9 h-9 rounded-xl bg-teal-950 border border-teal-600/50 flex items-center justify-center shrink-0 group-hover:border-teal-400 group-hover:bg-teal-900 transition mt-0.5">
                        <Stethoscope className="w-4 h-4 text-teal-300" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-slate-200 group-hover:text-teal-300">
                          Kirim Pengingat Jadwal via WhatsApp
                        </div>
                        <div className="text-[11px] text-teal-400 font-semibold mt-0.5">
                          (Untuk masing-masing perawat)
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">
                          Pilih staf perawat untuk mengirimkan pesan WhatsApp personalisasi shif &amp; alokasi mesin HD.
                        </div>
                      </div>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Unified Single "SHEET" Button with Popover / Dropdown Menu */}
          <div className="relative">
            <button
              id="btn-header-sheet-menu"
              onClick={() => {
                setShowSheetMenu(!showSheetMenu);
                if (showWhatsAppMenu) setShowWhatsAppMenu(false);
              }}
              disabled={isPulling || isPushing || isBatchSending || isPartialSending}
              className={`h-9 px-3 sm:px-4 rounded-xl font-bold text-xs sm:text-[13px] shadow-sm flex items-center space-x-2 transition-all active:scale-95 cursor-pointer border shrink-0 ${
                showSheetMenu
                  ? 'bg-emerald-600 text-white border-emerald-400 ring-2 ring-emerald-500/30'
                  : isConfigured
                  ? 'bg-gradient-to-r from-emerald-700 to-teal-700 hover:from-emerald-600 hover:to-teal-600 text-white border-emerald-500/40'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
              }`}
              title="Menu Sinkronisasi Google Sheets: Tarik, Kirim, Sinkronisasi Terarah, Buka Sheet, dan Konfigurasi"
            >
              {isPulling || isPushing || isBatchSending || isPartialSending ? (
                <RefreshCw className="w-4 h-4 animate-spin text-cyan-200 shrink-0" />
              ) : (
                <FileSpreadsheet className="w-4 h-4 text-emerald-200 shrink-0" />
              )}
              <span className="tracking-wide">
                {isPulling
                  ? 'Menarik Data...'
                  : isPushing
                  ? 'Mengirim Data...'
                  : isPartialSending
                  ? 'Sinkron Terarah...'
                  : isBatchSending
                  ? 'Kirim Batch...'
                  : 'SHEET'}
              </span>

              {/* Connection status indicator dot */}
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  isConfigured ? 'bg-emerald-300 animate-pulse' : 'bg-amber-400'
                }`}
                title={isConfigured ? 'Google Sheets Siap' : 'Belum Dikonfigurasi'}
              />

              <ChevronDown
                className={`w-3.5 h-3.5 text-emerald-200 transition-transform duration-150 shrink-0 ${
                  showSheetMenu ? 'rotate-180' : ''
                }`}
              />
            </button>

          {/* Unified SHEET Dropdown Menu */}
          {showSheetMenu && (
            <>
              {/* Click-outside backdrop */}
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowSheetMenu(false)}
                aria-hidden="true"
              />

              <div className="absolute right-0 mt-2 w-80 sm:w-96 max-w-[95vw] bg-slate-900/98 backdrop-blur-xl rounded-2xl shadow-2xl border border-teal-700/60 py-2.5 z-50 text-white animate-in fade-in zoom-in-95 duration-150">
                {/* 1. Status Google Sheets Sync & Buka Sheet */}
                <div className="px-3.5 py-2.5 mx-2 bg-slate-800/80 rounded-xl border border-slate-700/60 mb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center shrink-0">
                        <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white flex items-center gap-1.5">
                          Google Sheets Sync
                          <span
                            className={`w-2 h-2 rounded-full ${
                              isConfigured ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                            }`}
                          />
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {isConfigured ? 'Integrasi 2-Arah Terhubung' : 'Konfigurasi Webhook Belum Diisi'}
                        </div>
                      </div>
                    </div>

                    {/* Buka Spreadsheet */}
                    {settings?.googleSpreadsheetIdOrUrl && (
                      <a
                        href={settings.googleSpreadsheetIdOrUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setShowSheetMenu(false)}
                        className="px-2 py-1 bg-teal-950 hover:bg-teal-900 border border-teal-700/60 text-teal-300 hover:text-white rounded-lg text-[11px] font-bold flex items-center gap-1 transition"
                        title="Buka Dokumen Google Sheets di Tab Baru"
                      >
                        <span>Buka Sheet</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                  <div className="mt-2 pt-2 border-t border-slate-700/50 flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Bulan Target:</span>
                    <span className="font-bold text-teal-300">{displayMonthName}</span>
                  </div>
                </div>

                {/* Section Title */}
                <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Aksi Sinkronisasi Data
                </div>

                {/* Actions List */}
                <div className="px-2 space-y-1">
                  {/* TARIK DATA */}
                  <button
                    id="btn-sync-pull-google-sheets"
                    onClick={() => {
                      setShowSheetMenu(false);
                      handleInitiatePull();
                    }}
                    disabled={isPulling || isPushing || isBatchSending || isPartialSending}
                    className="w-full px-2.5 py-2 text-left rounded-xl hover:bg-slate-800 flex items-center gap-3 transition cursor-pointer disabled:opacity-50 group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-cyan-950 border border-cyan-700/50 flex items-center justify-center shrink-0 group-hover:border-cyan-400 group-hover:bg-cyan-900 transition">
                      {isPulling ? (
                        <RefreshCw className="w-4 h-4 text-cyan-300 animate-spin" />
                      ) : (
                        <ArrowDownToLine className="w-4 h-4 text-cyan-400" />
                      )}
                    </div>
                    <div className="flex-1 truncate">
                      <div className="text-xs font-bold text-slate-200 group-hover:text-cyan-300 flex items-center justify-between">
                        <span>Tarik Data</span>
                        {isPulling && <span className="text-[10px] text-cyan-300 font-semibold animate-pulse">Menarik...</span>}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">
                        Ambil jadwal shift, perawat & mesin terbaru dari Google Sheet
                      </div>
                    </div>
                  </button>

                  {/* KIRIM DATA BULAN INI */}
                  {canEdit && (
                    <button
                      id="btn-sync-push-google-sheets"
                      onClick={() => {
                        setShowSheetMenu(false);
                        handlePushData();
                      }}
                      disabled={isPulling || isPushing || isBatchSending || isPartialSending}
                      className="w-full px-2.5 py-2 text-left rounded-xl hover:bg-slate-800 flex items-center gap-3 transition cursor-pointer disabled:opacity-50 group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-emerald-950 border border-emerald-700/50 flex items-center justify-center shrink-0 group-hover:border-emerald-400 group-hover:bg-emerald-900 transition">
                        {isPushing ? (
                          <RefreshCw className="w-4 h-4 text-emerald-300 animate-spin" />
                        ) : (
                          <ArrowUpFromLine className="w-4 h-4 text-emerald-400" />
                        )}
                      </div>
                      <div className="flex-1 truncate">
                        <div className="text-xs font-bold text-slate-200 group-hover:text-emerald-300 flex items-center justify-between">
                          <span>Kirim Data ({displayMonthName})</span>
                          {isPushing && <span className="text-[10px] text-emerald-300 font-semibold animate-pulse">Mengirim...</span>}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">
                          Sinkron lengkap jadwal dan alokasi ke Google Sheet
                        </div>
                      </div>
                    </button>
                  )}

                  {/* SINKRONISASI TERARAH (PARSIAL) */}
                  {canEdit && (
                    <button
                      id="btn-sync-partial-google-sheets"
                      onClick={() => {
                        setShowSheetMenu(false);
                        setShowPartialModal(true);
                      }}
                      disabled={isPulling || isPushing || isBatchSending || isPartialSending}
                      className="w-full px-2.5 py-2 text-left rounded-xl hover:bg-slate-800 flex items-center gap-3 transition cursor-pointer disabled:opacity-50 group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-indigo-950 border border-indigo-700/50 flex items-center justify-center shrink-0 group-hover:border-indigo-400 group-hover:bg-indigo-900 transition">
                        <SlidersHorizontal className="w-4 h-4 text-indigo-400" />
                      </div>
                      <div className="flex-1 truncate">
                        <div className="text-xs font-bold text-slate-200 group-hover:text-indigo-300">
                          Sinkronisasi Terarah (Parsial)
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">
                          Pilih modul spesifik (jadwal, dokter, tugas, mesin)
                        </div>
                      </div>
                    </button>
                  )}

                  {/* KIRIM TIAP BULAN (BATCH) */}
                  {canEdit && (
                    <button
                      id="btn-sync-batch-push-google-sheets"
                      onClick={() => {
                        setShowSheetMenu(false);
                        setSelectedBatchMonths(availableBatchMonths.map((m) => m.prefix));
                        setShowBatchModal(true);
                      }}
                      disabled={isPulling || isPushing || isBatchSending || isPartialSending}
                      className="w-full px-2.5 py-2 text-left rounded-xl hover:bg-slate-800 flex items-center gap-3 transition cursor-pointer disabled:opacity-50 group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 group-hover:border-emerald-500 group-hover:bg-slate-700 transition">
                        <CalendarDays className="w-4 h-4 text-emerald-400" />
                      </div>
                      <div className="flex-1 truncate">
                        <div className="text-xs font-bold text-slate-200 group-hover:text-emerald-300">
                          Kirim Tiap Bulan (Batch)
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">
                          Kirim multi-bulan ke tab terpisah di Google Sheets
                        </div>
                      </div>
                    </button>
                  )}

                  {/* UNDUH EXCEL (.XLSX) */}
                  <button
                    onClick={() => {
                      setShowSheetMenu(false);
                      handleExportMonthExcel(selectedMonth);
                    }}
                    className="w-full px-2.5 py-2 text-left rounded-xl hover:bg-slate-800 flex items-center gap-3 transition cursor-pointer group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 group-hover:border-teal-500 group-hover:bg-slate-700 transition">
                      <Download className="w-4 h-4 text-teal-400" />
                    </div>
                    <div className="flex-1 truncate">
                      <div className="text-xs font-bold text-slate-200 group-hover:text-teal-300">
                        Unduh Format Excel (.xlsx)
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">
                        Ekspor file spreadsheet offline ({displayMonthName})
                      </div>
                    </div>
                  </button>
                </div>

                {/* Section: Konfigurasi Webhook & Spreadsheet */}
                <div className="mt-1.5 pt-1.5 border-t border-slate-800/80 px-2">
                  <button
                    onClick={() => {
                      setShowSheetMenu(false);
                      setShowConfigModal(true);
                    }}
                    className="w-full px-2.5 py-2 text-left rounded-xl hover:bg-slate-800 flex items-center gap-3 transition cursor-pointer group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 group-hover:border-cyan-500 group-hover:bg-slate-700 transition">
                      <Settings2 className="w-4 h-4 text-cyan-400" />
                    </div>
                    <div className="flex-1 truncate">
                      <div className="text-xs font-bold text-slate-200 group-hover:text-cyan-300">
                        Konfigurasi Webhook & Spreadsheet
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">
                        Atur URL Apps Script Webhook dan Spreadsheet Google
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>

      {/* Floating Notification Toast */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-3 duration-200 max-w-md">
          <div
            className={`px-4 py-3 rounded-2xl shadow-2xl border flex items-center space-x-3 text-xs font-semibold ${
              notification.type === 'success'
                ? 'bg-emerald-950 text-emerald-100 border-emerald-500/50 shadow-emerald-950/50'
                : notification.type === 'error'
                ? 'bg-rose-950 text-rose-100 border-rose-500/50 shadow-rose-950/50'
                : 'bg-slate-900 text-cyan-100 border-cyan-500/50 shadow-slate-950/50'
            }`}
          >
            {notification.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
            {notification.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
            {notification.type === 'info' && <RefreshCw className="w-4 h-4 text-cyan-400 animate-spin shrink-0" />}
            <p className="flex-1 leading-snug">{notification.message}</p>
            <button
              onClick={() => setNotification(null)}
              className="text-slate-400 hover:text-white text-xs font-bold p-1 cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* MODAL: KONFIRMASI PENERAPAN DATA SETELAH TARIK DARI GOOGLE SHEETS */}
      {showPullConfirmModal && pulledDataPreview && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowPullConfirmModal(false);
          }}
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh] my-auto">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-teal-50/70 dark:bg-teal-950/40">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-teal-100 dark:bg-teal-900/60 text-teal-700 dark:text-teal-300 rounded-xl">
                  <ArrowDownToLine className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">
                    Terapkan Data dari Google Sheets
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Bulan Target: <span className="font-bold text-teal-600 dark:text-teal-400">{displayMonthName}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowPullConfirmModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs overflow-y-auto">
              <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-2">
                <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>Ringkasan Data yang Ditemukan:</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-slate-700 dark:text-slate-300">
                  <div className="bg-white dark:bg-slate-850 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="text-slate-400 block text-[10px]">Total Jadwal Shift:</span>
                    <span className="text-sm font-black text-teal-600 dark:text-teal-400">
                      {pulledDataPreview.assignments.length} Sif
                    </span>
                  </div>
                  <div className="bg-white dark:bg-slate-850 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="text-slate-400 block text-[10px]">Alokasi Mesin:</span>
                    <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">
                      {pulledDataPreview.assignments.filter((a: any) => a.assignedMachineIds?.length > 0).length} Terisi
                    </span>
                  </div>
                  <div className="bg-white dark:bg-slate-850 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="text-slate-400 block text-[10px]">Tugas Khusus:</span>
                    <span className="text-sm font-black text-amber-600 dark:text-amber-400">
                      {pulledDataPreview.assignments.filter((a: any) => a.specialDuty).length} Terisi
                    </span>
                  </div>
                  <div className="bg-white dark:bg-slate-850 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="text-slate-400 block text-[10px]">Dokter HD:</span>
                    <span className="text-sm font-black text-blue-600 dark:text-blue-400">
                      {pulledDataPreview.doctors?.length || 0} Dokter
                    </span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 italic">
                  Catatan: Jadwal shift, alokasi mesin, dan tugas khusus untuk bulan {displayMonthName} di aplikasi akan diperbarui sesuai data terbaru dari Google Sheets.
                </p>
              </div>

              {/* Sample list of first 5 items */}
              <div>
                <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                  Sampel Cuplikan Jadwal:
                </span>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {pulledDataPreview.assignments.slice(0, 6).map((a: any, i: number) => (
                    <div
                      key={i}
                      className="p-2 bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between text-[11px] gap-2"
                    >
                      <div className="truncate pr-1">
                        <span className="font-bold text-slate-800 dark:text-slate-200">{a.nurseName}</span>
                        <span className="text-slate-400 text-[10px] ml-2 font-mono">{a.date}</span>
                        {a.specialDuty && (
                          <span className="ml-2 text-[10px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.2 rounded border border-amber-200 dark:border-amber-800">
                            {a.specialDuty}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-1.5 shrink-0">
                        <span className="px-2 py-0.5 rounded-md font-bold text-[10px] bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-300">
                          {a.shiftType}
                        </span>
                        {a.assignedMachineIds?.length > 0 && (
                          <span className="px-1.5 py-0.5 rounded-md font-semibold text-[10px] bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-300">
                            {a.assignedMachineIds.length} Mesin
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  {pulledDataPreview.assignments.length > 6 && (
                    <p className="text-center text-[10px] text-slate-400 pt-1">
                      ...dan {pulledDataPreview.assignments.length - 6} baris jadwal lainnya.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end space-x-2 bg-slate-50/70 dark:bg-slate-850">
              <button
                onClick={() => setShowPullConfirmModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmApplyPulledData}
                className="px-4 py-2 text-xs font-bold bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white rounded-xl shadow-md transition flex items-center space-x-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Terapkan Sekarang</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL: PENGATURAN GOOGLE SHEETS & TES KONEKSI */}
      {showConfigModal && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowConfigModal(false);
          }}
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh] my-auto">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-850">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 rounded-xl">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">
                    Pengaturan Sinkronisasi Google Sheets
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Konfigurasi integrasi 2-arah untuk menarik dan mengirim jadwal
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowConfigModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs overflow-y-auto">
              {/* Webhook Apps Script URL */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                  Google Apps Script Webhook URL (2-Arah Kirim & Tarik):
                </label>
                <input
                  type="url"
                  value={editWebhookUrl}
                  onChange={(e) => setEditWebhookUrl(e.target.value)}
                  placeholder="https://script.google.com/macros/s/.../exec"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                />
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Webhook memungkinkan pengiriman matriks kalender, format warna sif, dan penarikan data jadwal otomatis tanpa kuota.
                </p>
              </div>

              {/* Test Connection Button */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleTestConnection}
                  disabled={isTestingConnection || !editWebhookUrl.trim()}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl border border-slate-300 dark:border-slate-700 transition flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isTestingConnection ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-teal-500" />
                  ) : (
                    <Radio className="w-3.5 h-3.5 text-teal-500" />
                  )}
                  <span>{isTestingConnection ? 'Menguji...' : 'Uji Koneksi Webhook'}</span>
                </button>

                <button
                  onClick={() => setShowGuideModal(true)}
                  className="px-3 py-1.5 bg-teal-50 dark:bg-teal-950/60 hover:bg-teal-100 dark:hover:bg-teal-900/60 text-teal-700 dark:text-teal-300 font-bold rounded-xl border border-teal-200 dark:border-teal-800 transition flex items-center space-x-1.5 cursor-pointer"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>Lihat Kode Apps Script</span>
                </button>
              </div>

              {/* Test Result Message */}
              {testResult && (
                <div
                  className={`p-3 rounded-xl border text-xs font-semibold flex items-center space-x-2 ${
                    testResult.isSuccess
                      ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700'
                      : 'bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-200 border-rose-300 dark:border-rose-700'
                  }`}
                >
                  {testResult.isSuccess ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                  )}
                  <span>{testResult.message}</span>
                </div>
              )}

              {/* Spreadsheet URL */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                  URL Google Spreadsheet (Tautan Akses Cepat):
                </label>
                <input
                  type="url"
                  value={editSpreadsheetUrl}
                  onChange={(e) => setEditSpreadsheetUrl(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/.../edit"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                />
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Digunakan untuk membuka langsung lembar kerja Google Sheets via tombol header dan sebagai sumber cadangan penarikan jadwal.
                </p>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end space-x-2 bg-slate-50/70 dark:bg-slate-850">
              <button
                onClick={() => setShowConfigModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleSaveConfig}
                className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md transition flex items-center space-x-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Simpan Pengaturan</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL: KIRIM SETIAP BULAN / BATCH MULTI-BULAN KE GOOGLE SHEETS & EXCEL */}
      {showBatchModal && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={(e) => {
            if (!isBatchSending && e.target === e.currentTarget) setShowBatchModal(false);
          }}
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh] my-auto">
            {/* Header Modal */}
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-emerald-50/70 dark:bg-emerald-950/40">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 rounded-xl">
                  <CalendarDays className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">
                    Kirim Data Jadwal per Bulan
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Kirim setiap bulan ke tab terpisah di Google Sheets atau unduh rekap Excel (.xlsx)
                  </p>
                </div>
              </div>
              <button
                onClick={() => !isBatchSending && setShowBatchModal(false)}
                disabled={isBatchSending}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer disabled:opacity-30"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs flex-1">
              {/* Info Box */}
              <div className="bg-emerald-50 dark:bg-emerald-950/30 p-3.5 rounded-2xl border border-emerald-200 dark:border-emerald-800/40 text-emerald-900 dark:text-emerald-200">
                <p className="font-semibold mb-1">
                  Keunggulan Pengiriman Tiap Bulan:
                </p>
                <ul className="list-disc list-inside space-y-1 text-[11px] text-emerald-800 dark:text-emerald-300">
                  <li>Setiap bulan dibuatkan tab matriks terpisah di Google Sheets (misal: <code>Matriks HD - Oktober 2026</code>) sehingga riwayat bulan lain tetap aman.</li>
                  <li>Bisa mengirim 1 bulan tertentu saja lewat tombol <b>Kirim</b> di samping bulan terkait, atau pilih banyak bulan sekaligus.</li>
                  <li>Jika bulan belum memiliki jadwal tersimpan, sistem otomatis menyusun jadwal berkeadilan (fair).</li>
                </ul>
              </div>

              {/* Year Switcher and Quick Presets */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200 dark:border-slate-700/60">
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setBatchYear((prev) => prev - 1)}
                    disabled={isBatchSending}
                    className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 cursor-pointer disabled:opacity-40"
                    title="Tahun Sebelumnya"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="font-extrabold text-sm text-slate-800 dark:text-white px-2 py-0.5 bg-white dark:bg-slate-700 rounded-md border border-slate-200 dark:border-slate-600">
                    Tahun {batchYear}
                  </span>
                  <button
                    type="button"
                    onClick={() => setBatchYear((prev) => prev + 1)}
                    disabled={isBatchSending}
                    className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 cursor-pointer disabled:opacity-40"
                    title="Tahun Berikutnya"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setSelectedBatchMonths(availableBatchMonths.map((m) => m.prefix))}
                    disabled={isBatchSending}
                    className="px-2 py-1 text-[11px] font-bold bg-teal-50 hover:bg-teal-100 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 rounded-lg transition cursor-pointer disabled:opacity-40 border border-teal-200 dark:border-teal-800"
                  >
                    Pilih 12 Bulan
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedBatchMonths([selectedMonth])}
                    disabled={isBatchSending}
                    className="px-2 py-1 text-[11px] font-bold bg-slate-200 hover:bg-slate-300 text-slate-700 dark:bg-slate-700 dark:text-slate-200 rounded-lg transition cursor-pointer disabled:opacity-40"
                  >
                    Bulan Ini Saja
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const withData = availableBatchMonths.filter((m) => m.count > 0).map((m) => m.prefix);
                      setSelectedBatchMonths(withData.length > 0 ? withData : [selectedMonth]);
                    }}
                    disabled={isBatchSending}
                    className="px-2 py-1 text-[11px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 rounded-lg transition cursor-pointer disabled:opacity-40 border border-emerald-200 dark:border-emerald-800"
                  >
                    Tersimpan Saja
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedBatchMonths([])}
                    disabled={isBatchSending}
                    className="px-2 py-1 text-[11px] font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 rounded-lg transition cursor-pointer disabled:opacity-40"
                  >
                    Reset
                  </button>
                </div>
              </div>

              {/* 12 Months Grid */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="font-bold text-slate-800 dark:text-slate-200">
                    Daftar Bulan ({availableBatchMonths.length} Bulan {batchYear}):
                  </label>
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                    {selectedBatchMonths.length} bulan terpilih
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto p-1">
                  {availableBatchMonths.map((m) => {
                    const isChecked = selectedBatchMonths.includes(m.prefix);
                    const isCurrent = m.prefix === selectedMonth;
                    return (
                      <div
                        key={m.prefix}
                        className={`p-2.5 rounded-2xl border transition flex flex-col justify-between ${
                          isChecked
                            ? 'bg-teal-50/80 dark:bg-teal-950/40 border-teal-300 dark:border-teal-700/60 shadow-xs'
                            : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-750'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div
                            onClick={() => {
                              if (isBatchSending) return;
                              if (isChecked) {
                                setSelectedBatchMonths(selectedBatchMonths.filter((p) => p !== m.prefix));
                              } else {
                                setSelectedBatchMonths([...selectedBatchMonths, m.prefix]);
                              }
                            }}
                            className="flex items-center space-x-2 cursor-pointer flex-1 mr-2"
                          >
                            {isChecked ? (
                              <CheckSquare className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-400 shrink-0" />
                            )}
                            <div>
                              <div className="flex items-center space-x-1.5">
                                <span className="font-bold text-slate-900 dark:text-white">
                                  {m.name}
                                </span>
                                {isCurrent && (
                                  <span className="text-[9px] bg-teal-500/20 text-teal-700 dark:text-teal-300 px-1.5 py-0.2 rounded-md font-bold">
                                    Aktif
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {m.prefix}
                              </span>
                            </div>
                          </div>

                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0 ${
                            m.count > 0 
                              ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300'
                              : 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300'
                          }`}>
                            {m.count > 0 ? `${m.count} jadwal` : 'Auto-Gen'}
                          </span>
                        </div>

                        {/* Individual Month Action Buttons */}
                        <div className="flex items-center justify-end space-x-1.5 mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-700/60">
                          <button
                            type="button"
                            onClick={() => handleExportMonthExcel(m.prefix)}
                            disabled={isBatchSending}
                            className="px-2 py-1 text-[10px] font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition flex items-center space-x-1 cursor-pointer disabled:opacity-40"
                            title={`Unduh Excel .xlsx untuk ${m.name}`}
                          >
                            <Download className="w-3 h-3 text-slate-500" />
                            <span>Excel</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePushSingleMonth(m.prefix)}
                            disabled={isBatchSending}
                            className="px-2 py-1 text-[10px] font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition flex items-center space-x-1 shadow-xs cursor-pointer disabled:opacity-40"
                            title={`Kirim data ${m.name} langsung ke Google Sheets`}
                          >
                            <Send className="w-3 h-3" />
                            <span>Kirim Bulan Ini</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Progress Box during batch sending */}
              {isBatchSending && (
                <div className="bg-teal-50 dark:bg-teal-950/40 p-3.5 rounded-2xl border border-teal-300 dark:border-teal-700 flex items-center space-x-3">
                  <RefreshCw className="w-5 h-5 text-teal-600 dark:text-teal-400 animate-spin shrink-0" />
                  <div className="flex-1">
                    <p className="font-bold text-teal-900 dark:text-teal-200 text-xs">
                      {batchProgressText || 'Sedang mengirim data ke Google Sheets...'}
                    </p>
                    <p className="text-[11px] text-teal-700 dark:text-teal-300 mt-0.5">
                      Setiap bulan sedang ditulis ke lembar tab terpisah. Mohon tunggu sejenak.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2.5 bg-slate-50/70 dark:bg-slate-850">
              <div className="flex items-center space-x-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleExportMultipleMonthsExcel}
                  disabled={isBatchSending || selectedBatchMonths.length === 0}
                  className="px-3 py-2 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-300 dark:border-emerald-800 rounded-xl transition flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-40 w-full sm:w-auto"
                  title="Unduh seluruh bulan terpilih dalam satu file Excel multi-sheet"
                >
                  <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Download Excel ({selectedBatchMonths.length} Bulan)</span>
                </button>
              </div>

              <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
                <button
                  onClick={() => setShowBatchModal(false)}
                  disabled={isBatchSending}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer disabled:opacity-50"
                >
                  Tutup
                </button>
                <button
                  onClick={handleBatchPushData}
                  disabled={isBatchSending || selectedBatchMonths.length === 0}
                  className="px-4 py-2 text-xs font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl shadow-md transition flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50 flex-1 sm:flex-none"
                >
                  {isBatchSending ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  <span>
                    {isBatchSending ? 'Sedang Mengirim...' : `Kirim ${selectedBatchMonths.length} Bulan ke Google Sheets`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL: SINKRONISASI PARSIAL / TERARAH KE GOOGLE SHEETS */}
      {showPartialModal && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={(e) => {
            if (!isPartialSending && e.target === e.currentTarget) setShowPartialModal(false);
          }}
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh] my-auto">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-indigo-50/90 via-sky-50/70 to-teal-50/80 dark:from-indigo-950/40 dark:via-slate-850 dark:to-teal-950/30">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-cyan-600 text-white rounded-2xl shadow-xs">
                  <SlidersHorizontal className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 dark:text-white text-base sm:text-lg flex items-center gap-2">
                    Sinkronisasi Parsial / Terarah
                    <span className="text-[10px] bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold px-2 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800">
                      Fleksibel
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Kirim lembar kerja spesifik sesuai kebutuhan tanpa harus mengirim semua data sekaligus
                  </p>
                </div>
              </div>
              <button
                onClick={() => !isPartialSending && setShowPartialModal(false)}
                disabled={isPartialSending}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer disabled:opacity-40"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs flex-1">
              {/* Target Month Bar */}
              <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200 dark:border-slate-700/60">
                <div className="flex items-center space-x-2">
                  <Calendar className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
                  <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">Bulan Target:</span>
                  <div className="flex items-center space-x-1 bg-white dark:bg-slate-700 px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-600">
                    <button
                      type="button"
                      onClick={handlePrevMonth}
                      disabled={isPartialSending}
                      className="p-0.5 hover:text-teal-600 dark:hover:text-teal-400 cursor-pointer disabled:opacity-40"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <span className="font-bold text-slate-900 dark:text-white px-1">
                      {displayMonthName}
                    </span>
                    <button
                      type="button"
                      onClick={handleNextMonth}
                      disabled={isPartialSending}
                      className="p-0.5 hover:text-teal-600 dark:hover:text-teal-400 cursor-pointer disabled:opacity-40"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                  {selectedMonth} ({new Date(parseInt(selectedMonth.split('-')[0], 10), parseInt(selectedMonth.split('-')[1], 10), 0).getDate()} Hari)
                </div>
              </div>

              {/* Quick Preset Buttons */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 dark:text-slate-300 text-xs flex items-center justify-between">
                  <span>Pilihan Cepat (Preset Terarah):</span>
                  <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                    {Object.values(partialTargets).filter(Boolean).length} dari 8 bagian terpilih
                  </span>
                </label>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    disabled={isPartialSending}
                    onClick={() =>
                      setPartialTargets({
                        matrixSchedule: true,
                        doctorDuties: true,
                        machineAssignments: true,
                        specialTasks: true,
                        nursesMaster: true,
                        machinesMaster: true,
                        doctorsMaster: true,
                        specialDutiesMaster: false,
                      })
                    }
                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg transition border bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 cursor-pointer disabled:opacity-40"
                  >
                    🌟 Pilih Semua
                  </button>
                  <button
                    type="button"
                    disabled={isPartialSending}
                    onClick={() =>
                      setPartialTargets({
                        matrixSchedule: true,
                        doctorDuties: true,
                        machineAssignments: true,
                        specialTasks: true,
                        nursesMaster: false,
                        machinesMaster: false,
                        doctorsMaster: false,
                        specialDutiesMaster: false,
                      })
                    }
                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg transition border bg-teal-50 hover:bg-teal-100 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 border-teal-200 dark:border-teal-800 cursor-pointer disabled:opacity-40"
                  >
                    📅 Jadwal Bulan Ini Saja
                  </button>
                  <button
                    type="button"
                    disabled={isPartialSending}
                    onClick={() =>
                      setPartialTargets({
                        matrixSchedule: true,
                        doctorDuties: false,
                        machineAssignments: false,
                        specialTasks: false,
                        nursesMaster: false,
                        machinesMaster: false,
                        doctorsMaster: false,
                        specialDutiesMaster: false,
                      })
                    }
                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg transition border bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800 cursor-pointer disabled:opacity-40"
                  >
                    👩‍⚕️ Hanya Jadwal Perawat
                  </button>
                  <button
                    type="button"
                    disabled={isPartialSending}
                    onClick={() =>
                      setPartialTargets({
                        matrixSchedule: false,
                        doctorDuties: true,
                        machineAssignments: false,
                        specialTasks: false,
                        nursesMaster: false,
                        machinesMaster: false,
                        doctorsMaster: false,
                        specialDutiesMaster: false,
                      })
                    }
                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg transition border bg-purple-50 hover:bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800 cursor-pointer disabled:opacity-40"
                  >
                    👨‍⚕️ Hanya Jadwal Dokter
                  </button>
                  <button
                    type="button"
                    disabled={isPartialSending}
                    onClick={() =>
                      setPartialTargets({
                        matrixSchedule: false,
                        doctorDuties: false,
                        machineAssignments: true,
                        specialTasks: false,
                        nursesMaster: false,
                        machinesMaster: false,
                        doctorsMaster: false,
                        specialDutiesMaster: false,
                      })
                    }
                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg transition border bg-sky-50 hover:bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border-sky-200 dark:border-sky-800 cursor-pointer disabled:opacity-40"
                  >
                    ⚙️ Hanya Alokasi Mesin
                  </button>
                  <button
                    type="button"
                    disabled={isPartialSending}
                    onClick={() =>
                      setPartialTargets({
                        matrixSchedule: false,
                        doctorDuties: false,
                        machineAssignments: false,
                        specialTasks: true,
                        nursesMaster: false,
                        machinesMaster: false,
                        doctorsMaster: false,
                        specialDutiesMaster: false,
                      })
                    }
                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg transition border bg-amber-50 hover:bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800 cursor-pointer disabled:opacity-40"
                  >
                    📋 Hanya Tugas Khusus
                  </button>
                  <button
                    type="button"
                    disabled={isPartialSending}
                    onClick={() =>
                      setPartialTargets({
                        matrixSchedule: false,
                        doctorDuties: false,
                        machineAssignments: false,
                        specialTasks: false,
                        nursesMaster: true,
                        machinesMaster: true,
                        doctorsMaster: true,
                        specialDutiesMaster: false,
                      })
                    }
                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg transition border bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 cursor-pointer disabled:opacity-40"
                  >
                    👥 Hanya Master Data
                  </button>
                  <button
                    type="button"
                    disabled={isPartialSending}
                    onClick={() =>
                      setPartialTargets({
                        matrixSchedule: false,
                        doctorDuties: false,
                        machineAssignments: false,
                        specialTasks: false,
                        nursesMaster: false,
                        machinesMaster: false,
                        doctorsMaster: false,
                        specialDutiesMaster: false,
                      })
                    }
                    className="px-2 py-1 text-[11px] font-bold rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 cursor-pointer disabled:opacity-40"
                  >
                    ✕ Kosongkan
                  </button>
                </div>
              </div>

              {/* Module Checkbox Cards */}
              <div className="space-y-3">
                {/* GROUP 1: JADWAL AKTIF BULANAN */}
                <div>
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-teal-500" />
                    <span>Jadwal Operasional Bulanan ({displayMonthName})</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {/* Item 1: Matrik Jadwal Perawat */}
                    <div
                      onClick={() =>
                        !isPartialSending &&
                        setPartialTargets((p) => ({ ...p, matrixSchedule: !p.matrixSchedule }))
                      }
                      className={`p-3 rounded-2xl border transition cursor-pointer flex flex-col justify-between ${
                        partialTargets.matrixSchedule
                          ? 'bg-blue-50/90 dark:bg-blue-950/40 border-blue-300 dark:border-blue-700 shadow-xs'
                          : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-750'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="mt-0.5">
                          {partialTargets.matrixSchedule ? (
                            <CheckSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-extrabold text-slate-900 dark:text-white text-xs">
                              Matrik Jadwal Perawat
                            </span>
                            <span className="text-[9px] bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold px-1.5 py-0.2 rounded font-mono">
                              Matrik Jadwal Perawat
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                            Matriks kalender dinas harian (P, S, 2S, L, C, SK, I) per perawat lengkap dengan baris rekap harian & pewarnaan otomatis.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 dark:border-slate-700/60 text-[10px] text-slate-500 dark:text-slate-400">
                        <span>{employees.filter((e) => e.role === 'perawat' || e.role === 'pj_shift' || e.role === 'kepala_ruangan').length} Perawat</span>
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">⚡ Format Warna Otomatis</span>
                      </div>
                    </div>

                    {/* Item 2: Matrik Jadwal Dokter */}
                    <div
                      onClick={() =>
                        !isPartialSending &&
                        setPartialTargets((p) => ({ ...p, doctorDuties: !p.doctorDuties }))
                      }
                      className={`p-3 rounded-2xl border transition cursor-pointer flex flex-col justify-between ${
                        partialTargets.doctorDuties
                          ? 'bg-purple-50/90 dark:bg-purple-950/40 border-purple-300 dark:border-purple-700 shadow-xs'
                          : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-750'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="mt-0.5">
                          {partialTargets.doctorDuties ? (
                            <CheckSquare className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-extrabold text-slate-900 dark:text-white text-xs">
                              Matrik Jadwal Dokter
                            </span>
                            <span className="text-[9px] bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 font-bold px-1.5 py-0.2 rounded font-mono">
                              Matrik Jadwal Dokter
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                            Jadwal dokter jaga Sif Pagi & Sif Siang urut tanggal 1..31, status dinas & tabel ringkasan beban jaga bulanan.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 dark:border-slate-700/60 text-[10px] text-slate-500 dark:text-slate-400">
                        <span>{new Date(parseInt(selectedMonth.split('-')[0], 10), parseInt(selectedMonth.split('-')[1], 10), 0).getDate()} Hari Dinas</span>
                        <span className="font-semibold text-purple-600 dark:text-purple-400">Persis Tampilan Web</span>
                      </div>
                    </div>

                    {/* Item 3: Data alokasi mesin */}
                    <div
                      onClick={() =>
                        !isPartialSending &&
                        setPartialTargets((p) => ({ ...p, machineAssignments: !p.machineAssignments }))
                      }
                      className={`p-3 rounded-2xl border transition cursor-pointer flex flex-col justify-between ${
                        partialTargets.machineAssignments
                          ? 'bg-sky-50/90 dark:bg-sky-950/40 border-sky-300 dark:border-sky-700 shadow-xs'
                          : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-750'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="mt-0.5">
                          {partialTargets.machineAssignments ? (
                            <CheckSquare className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-extrabold text-slate-900 dark:text-white text-xs">
                              Data Alokasi Mesin
                            </span>
                            <span className="text-[9px] bg-sky-100 dark:bg-sky-900/60 text-sky-700 dark:text-sky-300 font-bold px-1.5 py-0.2 rounded font-mono">
                              Data alokasi mesin
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                            Catatan log alokasi mesin shif pagi & siang urut tanggal (No, Tanggal, Hari, Sif, Kode Sif, ID Perawat, Nama Perawat, Alokasi Mesin HD, Jumlah Mesin).
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 dark:border-slate-700/60 text-[10px] text-slate-500 dark:text-slate-400">
                        <span>{machines.length} Unit Mesin Aktif</span>
                        <span className="font-semibold text-sky-600 dark:text-sky-400">Urut Tanggal & Shift</span>
                      </div>
                    </div>

                    {/* Item 4: Tugas khusus */}
                    <div
                      onClick={() =>
                        !isPartialSending &&
                        setPartialTargets((p) => ({ ...p, specialTasks: !p.specialTasks }))
                      }
                      className={`p-3 rounded-2xl border transition cursor-pointer flex flex-col justify-between ${
                        partialTargets.specialTasks
                          ? 'bg-amber-50/90 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 shadow-xs'
                          : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-750'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="mt-0.5">
                          {partialTargets.specialTasks ? (
                            <CheckSquare className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-extrabold text-slate-900 dark:text-white text-xs">
                              Tugas Khusus
                            </span>
                            <span className="text-[9px] bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 font-bold px-1.5 py-0.2 rounded font-mono">
                              Tugas Khusus
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                            Penugasan tugas khusus (No, Tanggal, Hari, Sif, Kode Sif, Nama Perawat, Tugas Khusus) urut sesuai tanggal dan prioritas tugas khusus.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 dark:border-slate-700/60 text-[10px] text-slate-500 dark:text-slate-400">
                        <span>{specialTasks.length} Tugas Tercatat</span>
                        <span className="font-semibold text-amber-600 dark:text-amber-400">Urut Tanggal & Prioritas</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* GROUP 2: MASTER DATA & REFERENSI */}
                <div className="pt-1">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-teal-500" />
                    <span>Master Data & Referensi Rumah Sakit</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {/* Item 5: Master Perawat */}
                    <div
                      onClick={() =>
                        !isPartialSending &&
                        setPartialTargets((p) => ({ ...p, nursesMaster: !p.nursesMaster }))
                      }
                      className={`p-3 rounded-2xl border transition cursor-pointer flex flex-col justify-between ${
                        partialTargets.nursesMaster
                          ? 'bg-teal-50/90 dark:bg-teal-950/40 border-teal-300 dark:border-teal-700 shadow-xs'
                          : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-750'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="mt-0.5">
                          {partialTargets.nursesMaster ? (
                            <CheckSquare className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-extrabold text-slate-900 dark:text-white text-xs">
                              Master Perawat
                            </span>
                            <span className="text-[9px] bg-teal-100 dark:bg-teal-900/60 text-teal-700 dark:text-teal-300 font-bold px-1.5 py-0.2 rounded font-mono">
                              Master Perawat
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                            Nomor ID perawat, Nama Perawat, NIP, Nomor WhatsApp, Peran/Jabatan, dan Status Aktif.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 dark:border-slate-700/60 text-[10px] text-slate-500 dark:text-slate-400">
                        <span>{employees.filter((e) => e.role !== 'admin' && e.role !== 'dokter').length} Staf Perawat</span>
                        <span className="font-semibold text-teal-600 dark:text-teal-400">Master Staf</span>
                      </div>
                    </div>

                    {/* Item 6: Master Mesin (Urut Denah Ruangan) */}
                    <div
                      onClick={() =>
                        !isPartialSending &&
                        setPartialTargets((p) => ({ ...p, machinesMaster: !p.machinesMaster }))
                      }
                      className={`p-3 rounded-2xl border transition cursor-pointer flex flex-col justify-between ${
                        partialTargets.machinesMaster
                          ? 'bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 shadow-xs'
                          : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-750'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="mt-0.5">
                          {partialTargets.machinesMaster ? (
                            <CheckSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-extrabold text-slate-900 dark:text-white text-xs">
                              Master Mesin
                            </span>
                            <span className="text-[9px] bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 font-bold px-1.5 py-0.2 rounded font-mono">
                              Master Mesin
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                            Daftar nama dan data area urut sesuai dengan urutan pada denah ruangan (Area A s.d. F & Isolasi).
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 dark:border-slate-700/60 text-[10px] text-slate-500 dark:text-slate-400">
                        <span>{machines.length} Mesin Dialisis</span>
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">Urut Denah Ruangan</span>
                      </div>
                    </div>

                    {/* Item 7: Master Dokter */}
                    <div
                      onClick={() =>
                        !isPartialSending &&
                        setPartialTargets((p) => ({ ...p, doctorsMaster: !p.doctorsMaster }))
                      }
                      className={`p-3 rounded-2xl border transition cursor-pointer flex flex-col justify-between ${
                        partialTargets.doctorsMaster
                          ? 'bg-indigo-50/90 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-700 shadow-xs'
                          : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-750'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="mt-0.5">
                          {partialTargets.doctorsMaster ? (
                            <CheckSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-extrabold text-slate-900 dark:text-white text-xs">
                              Master Dokter
                            </span>
                            <span className="text-[9px] bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-bold px-1.5 py-0.2 rounded font-mono">
                              Master Dokter
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                            Nomor ID Dokter, Nama Dokter, NIP, Nomor WhatsApp, Peran/Jabatan (DPJP / Dokter Ruangan), Status Aktif.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 dark:border-slate-700/60 text-[10px] text-slate-500 dark:text-slate-400">
                        <span>{employees.filter((e) => e.role === 'dokter').length} Dokter Jaga</span>
                        <span className="font-semibold text-indigo-600 dark:text-indigo-400">DPJP & Dokter HD</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sending status info */}
              {isPartialSending && (
                <div className="bg-indigo-50 dark:bg-indigo-950/40 p-3.5 rounded-2xl border border-indigo-300 dark:border-indigo-700 flex items-center space-x-3 animate-pulse">
                  <RefreshCw className="w-5 h-5 text-indigo-600 dark:text-indigo-400 animate-spin shrink-0" />
                  <div className="flex-1">
                    <p className="font-bold text-indigo-950 dark:text-indigo-200 text-xs">
                      Sedang mengirim modul terpilih ke Google Sheets...
                    </p>
                    <p className="text-[11px] text-indigo-700 dark:text-indigo-300 mt-0.5">
                      Hanya lembar kerja yang dicentang yang sedang diperbarui. Lembar kerja lain tetap aman tanpa perubahan.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-850">
              <div className="flex items-center space-x-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                <span>
                  {Object.values(partialTargets).filter(Boolean).length} dari 8 modul dipilih untuk disinkronkan
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setShowPartialModal(false)}
                  disabled={isPartialSending}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handlePushPartialData}
                  disabled={isPartialSending || Object.values(partialTargets).filter(Boolean).length === 0}
                  className="px-4 py-2 text-xs font-bold bg-gradient-to-r from-indigo-600 via-indigo-700 to-cyan-700 hover:from-indigo-700 hover:to-cyan-800 text-white rounded-xl shadow-md transition flex items-center space-x-1.5 cursor-pointer disabled:opacity-40"
                >
                  {isPartialSending ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  <span>
                    {isPartialSending
                      ? 'Mengirim Modul...'
                      : `Kirim ${Object.values(partialTargets).filter(Boolean).length} Modul ke Sheets`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* APPS SCRIPT GUIDE MODAL */}
      <GoogleScriptGuideModal
        isOpen={showGuideModal}
        onClose={() => setShowGuideModal(false)}
      />

      {/* WHATSAPP MODAL: KIRIM RINGKASAN JADWAL KE KEPALA RUANG */}
      {showHeadNurseModal && (
        <WhatsAppShareModal
          isOpen={showHeadNurseModal}
          onClose={() => setShowHeadNurseModal(false)}
          selectedDate={selectedWhatsAppDate}
          onDateChange={setSelectedWhatsAppDate}
          employees={employees}
          schedules={schedules}
          machines={machines}
          machineAssignments={machineAssignments}
          specialTasks={specialTasks}
          onUpdateEmployees={onUpdateEmployees}
          settings={settings}
          onUpdateSettings={onUpdateSettings}
        />
      )}

      {/* WHATSAPP MODAL: PENGINGAT JADWAL UNTUK MASING-MASING PERAWAT */}
      {showNurseReminderModal && (
        <NurseReminderModal
          isOpen={showNurseReminderModal}
          onClose={() => setShowNurseReminderModal(false)}
          selectedDate={selectedWhatsAppDate}
          onDateChange={setSelectedWhatsAppDate}
          employees={employees}
          schedules={schedules}
          machines={machines}
          machineAssignments={machineAssignments}
          specialTasks={specialTasks}
          onUpdateEmployees={onUpdateEmployees}
        />
      )}
    </div>
  );
};
