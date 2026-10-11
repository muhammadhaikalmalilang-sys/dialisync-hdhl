import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  UserAccount, 
  ShiftSchedule, 
  HDMachine, 
  MachineAssignment, 
  SpecialTask,
  AppSettings
} from '../types';
import { 
  generateWhatsAppMessage, 
  buildWhatsAppUrl, 
  buildWhatsAppWebUrl,
  formatPhoneNumberForWhatsApp,
  copyTextToClipboard,
  safeOpenWhatsApp
} from '../utils/whatsappGenerator';
import { 
  MessageCircle, 
  Send, 
  Copy, 
  Check, 
  X, 
  Phone, 
  Stethoscope, 
  Calendar, 
  Edit3, 
  Eye, 
  ExternalLink,
  Save,
  Info,
  Globe,
  Share2,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

interface WhatsAppShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: string;
  onDateChange?: (date: string) => void;
  employees: UserAccount[];
  schedules: ShiftSchedule[];
  machines: HDMachine[];
  machineAssignments: MachineAssignment[];
  specialTasks: SpecialTask[];
  onUpdateEmployees?: (updatedEmployees: UserAccount[]) => void;
  settings?: AppSettings;
  onUpdateSettings?: (s: AppSettings) => void;
}

export const WhatsAppShareModal: React.FC<WhatsAppShareModalProps> = ({
  isOpen,
  onClose,
  selectedDate,
  onDateChange,
  employees,
  schedules,
  machines,
  machineAssignments,
  specialTasks,
  onUpdateEmployees,
  settings,
  onUpdateSettings,
}) => {
  // Find Kepala Ruangan from employees list
  const kepalaRuang = employees.find(
    (e) => e.role === 'kepala_ruangan' && e.status === 'aktif'
  ) || employees.find((e) => e.role === 'kepala_ruangan');

  // Operational Date State
  const [currentDate, setCurrentDate] = useState<string>(selectedDate);

  // Sync state if selectedDate prop updates from outside
  useEffect(() => {
    if (selectedDate) {
      setCurrentDate(selectedDate);
    }
  }, [selectedDate, isOpen]);

  // Date helper methods
  const getTodayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const getRelativeDateStr = (offsetDays: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const handleDateChange = (newDate: string) => {
    if (!newDate) return;
    setCurrentDate(newDate);
    setIsEditingManually(false);
    onDateChange?.(newDate);
  };

  const handleStepDay = (step: number) => {
    const cur = new Date(currentDate + 'T00:00:00');
    cur.setDate(cur.getDate() + step);
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, '0');
    const d = String(cur.getDate()).padStart(2, '0');
    handleDateChange(`${y}-${m}-${d}`);
  };

  // Find doctors from schedules based on the chosen currentDate
  const doctors = employees.filter((e) => e.role === 'dokter' && e.status === 'aktif');
  const scheduledDoctorPagi = doctors.find((d) => {
    const sch = schedules.find((s) => s.employeeId === d.id && s.date === currentDate);
    return sch?.shift === 'pagi' || sch?.shift === 'pagi_siang';
  });
  const scheduledDoctorSiang = doctors.find((d) => {
    const sch = schedules.find((s) => s.employeeId === d.id && s.date === currentDate);
    return sch?.shift === 'siang' || sch?.shift === 'pagi_siang';
  });

  // Recipient Phone state (priority: kepalaRuang.phone -> settings.headNursePhone -> default)
  const initialPhone = kepalaRuang?.phone || settings?.headNursePhone || '0812-1111-0003';
  const [phoneNumber, setPhoneNumber] = useState<string>(initialPhone);
  const [savedPhoneSuccess, setSavedPhoneSuccess] = useState(false);

  // Doctors on duty state
  const [doctorPagi, setDoctorPagi] = useState<string>(
    scheduledDoctorPagi?.name || 'dr. Reza Rizki Ramadhan'
  );
  const [doctorSiang, setDoctorSiang] = useState<string>(
    scheduledDoctorSiang?.name || 'dr. Paramitha Kusumadewi'
  );

  // Custom text mode
  const [isEditingManually, setIsEditingManually] = useState(false);
  const [customText, setCustomText] = useState('');
  const [copied, setCopied] = useState(false);

  // Feedback and Fallback URL state (if browser popup is blocked)
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'warning' | 'info';
    text: string;
    url?: string;
  } | null>(null);

  // Sync state with recipient phone when opened or updated
  useEffect(() => {
    const p = kepalaRuang?.phone || settings?.headNursePhone;
    if (p) {
      setPhoneNumber(p);
    }
  }, [kepalaRuang?.phone, settings?.headNursePhone]);

  // Sync doctor state when scheduled doctors change for the selected date
  useEffect(() => {
    if (scheduledDoctorPagi?.name) {
      setDoctorPagi(scheduledDoctorPagi.name);
    } else {
      setDoctorPagi('dr. Reza Rizki Ramadhan');
    }
  }, [scheduledDoctorPagi?.name, currentDate]);

  useEffect(() => {
    if (scheduledDoctorSiang?.name) {
      setDoctorSiang(scheduledDoctorSiang.name);
    } else {
      setDoctorSiang('dr. Paramitha Kusumadewi');
    }
  }, [scheduledDoctorSiang?.name, currentDate]);

  // Auto-generate text whenever dependencies change
  useEffect(() => {
    if (!isEditingManually) {
      const generated = generateWhatsAppMessage({
        dateStr: currentDate,
        employees,
        schedules,
        machines,
        machineAssignments,
        specialTasks,
        doctorOverridePagi: doctorPagi,
        doctorOverrideSiang: doctorSiang,
        kepalaRuangName: kepalaRuang?.name || settings?.headNurseName,
      });
      setCustomText(generated);
    }
  }, [
    currentDate,
    employees,
    schedules,
    machines,
    machineAssignments,
    specialTasks,
    doctorPagi,
    doctorSiang,
    isEditingManually,
    kepalaRuang?.name,
    settings?.headNurseName,
  ]);

  if (!isOpen) return null;

  // Date formatting for header and summary badge
  const dateObj = new Date(currentDate + 'T00:00:00');
  const formattedDate = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(dateObj);

  const isSunday = dateObj.getDay() === 0;

  // Stats for the active selected date
  const scheduledNursesCount = schedules.filter(
    (s) => s.date === currentDate && s.shift && !['libur', 'cuti', 'izin', 'sakit', 'LIBUR', 'CUTI', 'SAKIT'].includes(s.shift)
  ).length;

  const assignedMachinesCount = machineAssignments.filter(
    (a) => a.date === currentDate && a.nurseId && !a.isOff
  ).length;

  const specialTasksCount = specialTasks.filter(
    (t) => t.date === currentDate
  ).length;

  const cleanPhone = formatPhoneNumberForWhatsApp(phoneNumber);

  // Handle Save Phone to Kepala Ruang & Settings
  const handleSavePhoneToKaru = () => {
    if (kepalaRuang && onUpdateEmployees) {
      const updated = employees.map((e) =>
        e.id === kepalaRuang.id ? { ...e, phone: phoneNumber } : e
      );
      onUpdateEmployees(updated);
    }
    if (settings && onUpdateSettings) {
      onUpdateSettings({
        ...settings,
        headNursePhone: phoneNumber,
      });
    }
    setSavedPhoneSuccess(true);
    setTimeout(() => setSavedPhoneSuccess(false), 3000);
  };

  // Handle Copy text to clipboard
  const handleCopy = async () => {
    const ok = await copyTextToClipboard(customText);
    if (ok) {
      setCopied(true);
      setFeedback({
        type: 'success',
        text: 'Teks pesan berhasil disalin ke clipboard!',
      });
      setTimeout(() => setCopied(false), 2500);
    }
  };

  // Universal Send via WhatsApp (Android / iOS / PC Universal Link)
  const handleSendWhatsApp = async () => {
    // 1. Auto-copy text
    await copyTextToClipboard(customText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);

    // 2. Auto-save phone number if changed
    if (kepalaRuang && phoneNumber && phoneNumber !== kepalaRuang.phone) {
      handleSavePhoneToKaru();
    }

    // 3. Build target URL
    const url = buildWhatsAppUrl(phoneNumber, customText);

    // 4. Safe open with fallback
    const result = safeOpenWhatsApp(url, customText);

    setFeedback({
      type: 'success',
      text: 'Teks disalin ke clipboard! Membuka WhatsApp...',
      url: result.url,
    });
  };

  // Send specifically via WhatsApp Web (Desktop PC)
  const handleSendWhatsAppWeb = async () => {
    await copyTextToClipboard(customText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);

    const url = buildWhatsAppWebUrl(phoneNumber, customText);
    const result = safeOpenWhatsApp(url, customText);

    setFeedback({
      type: 'success',
      text: 'Teks disalin! Membuka WhatsApp Web di tab baru...',
      url: result.url,
    });
  };

  // Send without specific phone (Choose contact or group)
  const handleSendWhatsAppChooser = async () => {
    await copyTextToClipboard(customText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);

    const url = buildWhatsAppUrl('', customText);
    const result = safeOpenWhatsApp(url, customText);

    setFeedback({
      type: 'info',
      text: 'Teks disalin! Silakan pilih kontak atau grup di WhatsApp.',
      url: result.url,
    });
  };

  // Native Mobile Web Share API (if supported by device)
  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const handleNativeShare = async () => {
    try {
      await navigator.share({
        title: `Jadwal & Alokasi HD RS Happy Land - ${formattedDate}`,
        text: customText,
      });
      setFeedback({
        type: 'success',
        text: 'Pesan berhasil dibagikan!',
      });
    } catch {
      // If user cancelled, just copy to clipboard
      handleCopy();
    }
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
    >
      <div className="min-h-full w-full flex items-center justify-center py-2 sm:py-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] my-auto animate-in zoom-in-95 duration-200">
        {/* Header Bar */}
        <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-slate-900 p-4 sm:p-5 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-emerald-500 text-slate-950 shadow-md">
              <MessageCircle className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-extrabold text-base sm:text-lg tracking-tight">
                  Kirim Ringkasan Jadwal ke WhatsApp
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-400/20 text-emerald-300 border border-emerald-400/30">
                  Kepala Ruang
                </span>
              </div>
              <p className="text-xs text-emerald-100/90 mt-0.5 flex items-center space-x-1.5">
                <Calendar className="w-3.5 h-3.5" />
                <span>{formattedDate} • Ruang Dialisis Gedung Timur Lt.3</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/20 text-slate-200 hover:text-white transition cursor-pointer"
            title="Tutup Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notification / Feedback Banner */}
        {feedback && (
          <div
            className={`px-4 py-2.5 text-xs font-semibold flex flex-wrap items-center justify-between gap-2 border-b ${
              feedback.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : feedback.type === 'warning'
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-blue-50 border-blue-200 text-blue-900'
            }`}
          >
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{feedback.text}</span>
            </div>
            {feedback.url && (
              <a
                href={feedback.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center space-x-1 underline font-bold text-emerald-700 hover:text-emerald-800 bg-white px-2.5 py-1 rounded-lg border border-emerald-300 shadow-2xs"
                title="Buka langsung tautan WhatsApp"
              >
                <span>Buka WhatsApp Sekarang</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        )}

        {/* Modal Body */}
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto flex-1 text-xs">
          {/* Section: Pemilihan Tanggal Operasional */}
          <div className="bg-gradient-to-r from-emerald-50/80 via-teal-50/60 to-slate-50 p-3.5 sm:p-4 rounded-xl border border-emerald-200 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                <div className="p-2 rounded-lg bg-emerald-600 text-white shadow-xs">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <label htmlFor="wa-summary-date-picker" className="font-extrabold text-slate-800 text-xs sm:text-sm block">
                    Pilih Tanggal Jadwal &amp; Alokasi
                  </label>
                  <span className="text-[11px] text-slate-500 block">
                    Ubah tanggal untuk memuat rekap jadwal dinas, dokter jaga &amp; alokasi mesin perawat
                  </span>
                </div>
              </div>

              {/* Status Badge */}
              <div className="flex items-center gap-1.5 self-start sm:self-auto">
                {isSunday ? (
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                    Hari Minggu (Unit Libur)
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    {scheduledNursesCount > 0 ? `${scheduledNursesCount} Staf Bertugas` : 'Belum Ada Jadwal'}
                  </span>
                )}
              </div>
            </div>

            {/* Date Input Controls & Quick Shortcuts */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-emerald-100">
              <div className="flex items-center gap-1.5 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => handleStepDay(-1)}
                  title="Hari Sebelumnya"
                  className="p-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 transition cursor-pointer shadow-2xs"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <div className="relative flex-1 sm:flex-none">
                  <input
                    id="wa-summary-date-picker"
                    type="date"
                    value={currentDate}
                    onChange={(e) => handleDateChange(e.target.value)}
                    className="w-full sm:w-auto px-3 py-1.5 bg-white border border-slate-300 hover:border-emerald-500 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 rounded-lg text-xs font-bold text-slate-800 focus:outline-hidden shadow-2xs cursor-pointer"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => handleStepDay(1)}
                  title="Hari Berikutnya"
                  className="p-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 transition cursor-pointer shadow-2xs"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => handleDateChange(getRelativeDateStr(-1))}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer border ${
                    currentDate === getRelativeDateStr(-1)
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  Kemarin
                </button>
                <button
                  type="button"
                  onClick={() => handleDateChange(getTodayStr())}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer border ${
                    currentDate === getTodayStr()
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  Hari Ini
                </button>
                <button
                  type="button"
                  onClick={() => handleDateChange(getRelativeDateStr(1))}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer border ${
                    currentDate === getRelativeDateStr(1)
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  Besok
                </button>
              </div>
            </div>

            {/* Active Date Meta Label */}
            <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-600 bg-white/80 px-3 py-1.5 rounded-lg border border-emerald-100/80">
              <span className="font-semibold text-emerald-950 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Terpilih: <strong>{formattedDate}</strong></span>
              </span>
              <span className="text-slate-500 font-medium">
                {assignedMachinesCount} mesin terplot • {specialTasksCount} tugas khusus
              </span>
            </div>
          </div>

          {/* Section: Penerima & Dokter Jaga */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* WhatsApp Recipient Phone */}
            <div className="bg-slate-50 p-3.5 sm:p-4 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                  <Phone className="w-4 h-4 text-emerald-600" />
                  <span>Nomor WA Kepala Ruang HD</span>
                </label>
                {kepalaRuang && (
                  <span className="text-[11px] font-semibold text-slate-500">
                    {kepalaRuang.name}
                  </span>
                )}
              </div>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="0812-1111-0003"
                  className="w-full px-3 py-2 text-xs font-semibold bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
                <button
                  onClick={handleSavePhoneToKaru}
                  className="px-2.5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-lg transition flex items-center space-x-1 shrink-0 cursor-pointer"
                  title="Simpan nomor ini ke profil Kepala Ruang"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Simpan</span>
                </button>
              </div>
              {savedPhoneSuccess ? (
                <p className="text-[11px] text-emerald-600 font-bold flex items-center space-x-1">
                  <Check className="w-3 h-3" />
                  <span>Nomor tersimpan ke kontak Kepala Ruang.</span>
                </p>
              ) : (
                <p className="text-[11px] text-slate-500">
                  Format WA:{' '}
                  <strong className="text-slate-800 font-mono">
                    {cleanPhone ? `+${cleanPhone}` : '(nomor belum lengkap)'}
                  </strong>
                </p>
              )}
            </div>

            {/* Doctors on duty config */}
            <div className="bg-slate-50 p-3.5 sm:p-4 rounded-xl border border-slate-200 space-y-2">
              <label className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                <Stethoscope className="w-4 h-4 text-teal-600" />
                <span>Dokter Jaga Hemodialisa</span>
              </label>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] text-slate-500 font-bold block uppercase">
                    Dokter Sif Pagi
                  </span>
                  <input
                    type="text"
                    value={doctorPagi}
                    onChange={(e) => {
                      setDoctorPagi(e.target.value);
                      setIsEditingManually(false);
                    }}
                    placeholder="Nama dokter pagi"
                    className="w-full mt-1 px-2.5 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-bold block uppercase">
                    Dokter Sif Siang
                  </span>
                  <input
                    type="text"
                    value={doctorSiang}
                    onChange={(e) => {
                      setDoctorSiang(e.target.value);
                      setIsEditingManually(false);
                    }}
                    placeholder="Nama dokter siang"
                    className="w-full mt-1 px-2.5 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>
              </div>
              <p className="text-[10px] text-slate-400 italic">
                Ubah nama dokter di atas untuk memperbarui teks pesan secara otomatis.
              </p>
            </div>
          </div>

          {/* Section: Message Preview & Edit Toggle */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-slate-800">
                  Pratinjau Pesan WhatsApp
                </span>
                <span className="text-[11px] text-slate-500">
                  (Rangkuman Jadwal, Mesin &amp; Tugas Khusus)
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setIsEditingManually(!isEditingManually)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition cursor-pointer ${
                    isEditingManually
                      ? 'bg-amber-100 text-amber-900 border border-amber-300'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {isEditingManually ? (
                    <>
                      <Eye className="w-3.5 h-3.5" />
                      <span>Mode Otomatis</span>
                    </>
                  ) : (
                    <>
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit Teks Manual</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handleCopy}
                  className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold flex items-center space-x-1 transition cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700">Tersalin!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-600" />
                      <span>Salin Pesan</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* WhatsApp Chat Style Container */}
            <div className="rounded-xl border border-slate-300 bg-[#efeae2] p-3 sm:p-4 shadow-inner">
              <div className="bg-white rounded-xl p-3.5 sm:p-4 shadow-sm border border-emerald-950/10">
                {isEditingManually ? (
                  <div className="space-y-2">
                    <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs flex items-center space-x-2">
                      <Info className="w-4 h-4 shrink-0 text-amber-600" />
                      <span>
                        Anda dalam mode edit manual. Anda dapat menambahkan catatan khusus sebelum mengirim ke Kepala Ruang.
                      </span>
                    </div>
                    <textarea
                      value={customText}
                      onChange={(e) => setCustomText(e.target.value)}
                      rows={12}
                      className="w-full p-3 font-mono text-xs text-slate-900 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-hidden leading-relaxed"
                    />
                  </div>
                ) : (
                  <pre className="font-mono text-[11px] sm:text-xs text-slate-900 whitespace-pre-wrap leading-relaxed select-all overflow-x-auto max-h-[340px] overflow-y-auto">
                    {customText}
                  </pre>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handleCopy}
              className="flex-1 sm:flex-none px-3.5 py-2.5 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl border border-slate-300 flex items-center justify-center space-x-1.5 transition cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span className="text-emerald-700">Tersalin</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Salin Teks</span>
                </>
              )}
            </button>

            <button
              onClick={handleSendWhatsAppWeb}
              className="flex-1 sm:flex-none px-3.5 py-2.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl flex items-center justify-center space-x-1.5 transition cursor-pointer"
              title="Buka langsung di WhatsApp Web untuk pengguna Desktop / PC"
            >
              <Globe className="w-4 h-4 text-emerald-600" />
              <span>WA Web (PC)</span>
            </button>

            <button
              onClick={handleSendWhatsAppChooser}
              className="flex-1 sm:flex-none px-3 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-xl flex items-center justify-center space-x-1.5 transition cursor-pointer"
              title="Kirim ke kontak lain atau grup WA Unit HD"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Grup WA</span>
            </button>

            {canNativeShare && (
              <button
                onClick={handleNativeShare}
                className="flex-1 sm:flex-none px-3 py-2.5 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-800 font-bold text-xs rounded-xl flex items-center justify-center space-x-1.5 transition cursor-pointer"
                title="Bagikan via aplikasi ponsel / tablet"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Bagikan</span>
              </button>
            )}
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <button
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold text-xs rounded-xl transition cursor-pointer"
            >
              Tutup
            </button>
            <button
              onClick={handleSendWhatsApp}
              className="flex-1 sm:flex-none px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-extrabold text-xs rounded-xl shadow-md flex items-center justify-center space-x-2 transition cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>Kirim ke Kepala Ruang</span>
            </button>
          </div>
        </div>
      </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};
