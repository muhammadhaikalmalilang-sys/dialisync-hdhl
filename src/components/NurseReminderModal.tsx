import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  UserAccount, 
  ShiftSchedule, 
  HDMachine, 
  MachineAssignment, 
  SpecialTask,
  ShiftType 
} from '../types';
import { 
  MessageCircle, 
  Search, 
  Send, 
  X, 
  Calendar, 
  Phone, 
  Clock, 
  Layers, 
  UserCheck, 
  ChevronRight, 
  ExternalLink,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { EmployeeWhatsAppModal } from './EmployeeWhatsAppModal';
import { formatIndonesianDateWithDay } from '../utils/whatsappGenerator';

interface NurseReminderModalProps {
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
}

export const NurseReminderModal: React.FC<NurseReminderModalProps> = ({
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
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterShift, setFilterShift] = useState<'all' | 'pagi' | 'siang' | 'libur'>('all');
  const [selectedNurseForDetail, setSelectedNurseForDetail] = useState<{
    nurse: UserAccount;
    shift?: ShiftType;
  } | null>(null);

  // Filter only perawat / nurses (and optionally all staff excluding purely non-clinical)
  const nursesList = useMemo(() => {
    return employees.filter(
      (e) => e.status === 'aktif' && (e.role === 'perawat' || e.role === 'pj_shift' || e.role === 'kepala_ruangan')
    );
  }, [employees]);

  // Map each nurse with their shift and machine count on selectedDate
  const nurseDutyRows = useMemo(() => {
    return nursesList.map((nurse) => {
      const schedule = schedules.find(
        (s) => s.employeeId === nurse.id && s.date === selectedDate
      );
      const shift: ShiftType = schedule?.shift || 'libur';

      // Machine assignments
      const nurseAssignments = machineAssignments.filter(
        (a) => a.nurseId === nurse.id && a.date === selectedDate
      );

      // Special tasks
      const nurseTasks = specialTasks.filter(
        (t) => t.employeeId === nurse.id && t.date === selectedDate
      );

      const assignedMachineCodes = nurseAssignments
        .map((a) => {
          const m = machines.find((mac) => mac.id === a.machineId);
          return m ? m.code : a.machineId;
        })
        .sort();

      return {
        nurse,
        shift,
        scheduleNote: schedule?.note || '',
        assignedMachineCodes,
        machineCount: assignedMachineCodes.length,
        specialTasks: nurseTasks,
        hasPhone: Boolean(nurse.phone && nurse.phone.trim().length >= 9),
      };
    });
  }, [nursesList, schedules, machines, machineAssignments, specialTasks, selectedDate]);

  // Filter by search & shift
  const filteredRows = useMemo(() => {
    return nurseDutyRows.filter((row) => {
      // Shift filter
      if (filterShift === 'pagi' && row.shift !== 'pagi' && row.shift !== 'pagi_siang') return false;
      if (filterShift === 'siang' && row.shift !== 'siang' && row.shift !== 'pagi_siang') return false;
      if (filterShift === 'libur' && row.shift !== 'libur' && row.shift !== 'cuti' && row.shift !== 'izin' && row.shift !== 'sakit') return false;

      // Search term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchName = row.nurse.name.toLowerCase().includes(term);
        const matchPhone = (row.nurse.phone || '').includes(term);
        const matchRole = row.nurse.role.toLowerCase().includes(term);
        const matchMachine = row.assignedMachineCodes.some((code) => code.toLowerCase().includes(term));
        return matchName || matchPhone || matchRole || matchMachine;
      }
      return true;
    });
  }, [nurseDutyRows, filterShift, searchTerm]);

  // Counts summary
  const pagiCount = nurseDutyRows.filter((r) => r.shift === 'pagi' || r.shift === 'pagi_siang').length;
  const siangCount = nurseDutyRows.filter((r) => r.shift === 'siang' || r.shift === 'pagi_siang').length;
  const liburCount = nurseDutyRows.filter((r) => r.shift === 'libur' || r.shift === 'cuti' || r.shift === 'izin' || r.shift === 'sakit').length;

  if (!isOpen) return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
    >
      <div className="min-h-full w-full flex items-center justify-center py-2 sm:py-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] my-auto animate-in zoom-in-95 duration-200">
        
        {/* Header Bar */}
        <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-slate-900 p-4 sm:p-5 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-emerald-500 text-slate-950 shadow-md">
              <MessageCircle className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-extrabold text-base sm:text-lg tracking-tight">
                  Pengingat Jadwal via WhatsApp
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-400/20 text-emerald-300 border border-emerald-400/30">
                  Masing-Masing Perawat
                </span>
              </div>
              <p className="text-xs text-emerald-100/90 mt-0.5 flex items-center space-x-1.5">
                <Calendar className="w-3.5 h-3.5" />
                <span>Pilih perawat untuk mengirimkan pesan WhatsApp personalisasi jadwal &amp; alokasi mesin HD</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/10 text-slate-300 hover:text-white transition cursor-pointer"
            title="Tutup Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Date Selector & Search Filter Bar */}
        <div className="bg-slate-50 border-b border-slate-200 p-3 sm:p-4 shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Tanggal */}
          <div className="flex items-center space-x-2 bg-white px-3 py-1.5 rounded-xl border border-slate-300 shadow-2xs">
            <Calendar className="w-4 h-4 text-teal-600 shrink-0" />
            <span className="text-xs font-semibold text-slate-500">Tanggal Operasional:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => onDateChange && onDateChange(e.target.value)}
              disabled={!onDateChange}
              className="text-xs font-bold text-slate-900 bg-transparent border-none outline-hidden cursor-pointer"
              title="Pilih tanggal pengingat jadwal"
            />
          </div>

          {/* Quick Filter Shift Tabs */}
          <div className="flex items-center space-x-1.5 overflow-x-auto">
            <button
              onClick={() => setFilterShift('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                filterShift === 'all'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              Semua ({nurseDutyRows.length})
            </button>
            <button
              onClick={() => setFilterShift('pagi')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                filterShift === 'pagi'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
              }`}
            >
              Pagi ({pagiCount})
            </button>
            <button
              onClick={() => setFilterShift('siang')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                filterShift === 'siang'
                  ? 'bg-pink-600 text-white shadow-2xs'
                  : 'bg-pink-50 text-pink-800 hover:bg-pink-100 border border-pink-200'
              }`}
            >
              Siang ({siangCount})
            </button>
            <button
              onClick={() => setFilterShift('libur')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                filterShift === 'libur'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
              }`}
            >
              Libur ({liburCount})
            </button>
          </div>
        </div>

        {/* Search Input Box */}
        <div className="p-3 sm:px-4 sm:py-2.5 bg-white border-b border-slate-200 shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari nama perawat, no WhatsApp, peran, atau kode mesin (contoh: A01, Twis)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 hover:bg-slate-100/80 focus:bg-white text-xs font-medium rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-hidden transition"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Nurse Cards List */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5">
          {filteredRows.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300">
              <AlertCircle className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-700">Tidak ada perawat ditemukan</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Coba ubah kata kunci pencarian atau filter shif yang dipilih.
              </p>
            </div>
          ) : (
            filteredRows.map((row) => {
              const { nurse, shift, assignedMachineCodes, specialTasks, hasPhone } = row;
              
              // Shift badge style
              let shiftBadgeBg = 'bg-slate-100 text-slate-700 border-slate-300';
              let shiftLabel = 'Libur / Off';
              if (shift === 'pagi') {
                shiftBadgeBg = 'bg-emerald-100 text-emerald-800 border-emerald-300';
                shiftLabel = 'Shif Pagi (07.00 - 14.00)';
              } else if (shift === 'siang') {
                shiftBadgeBg = 'bg-pink-100 text-pink-800 border-pink-300';
                shiftLabel = 'Shif Siang (12.00 - 19.00)';
              } else if (shift === 'pagi_siang') {
                shiftBadgeBg = 'bg-purple-100 text-purple-800 border-purple-300';
                shiftLabel = 'Pagi & Siang (Double Shif)';
              } else if (shift === 'cuti') {
                shiftBadgeBg = 'bg-blue-100 text-blue-800 border-blue-300';
                shiftLabel = 'Cuti Tahunan';
              } else if (shift === 'sakit') {
                shiftBadgeBg = 'bg-rose-100 text-rose-800 border-rose-300';
                shiftLabel = 'Sakit';
              } else if (shift === 'izin') {
                shiftBadgeBg = 'bg-amber-100 text-amber-800 border-amber-300';
                shiftLabel = 'Izin Khusus';
              }

              return (
                <div
                  key={nurse.id}
                  className="bg-white hover:bg-teal-50/20 border border-slate-200 hover:border-teal-300 rounded-xl p-3 sm:p-3.5 transition-all shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3 group"
                >
                  {/* Nurse Info */}
                  <div className="flex items-start sm:items-center space-x-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 text-teal-800 font-extrabold flex items-center justify-center text-sm shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                      {nurse.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center space-x-2 flex-wrap">
                        <span className="font-bold text-slate-900 text-sm truncate">
                          {nurse.name}
                        </span>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold border ${shiftBadgeBg}`}>
                          {shiftLabel}
                        </span>
                        {nurse.role === 'kepala_ruangan' && (
                          <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-teal-100 text-teal-800 border border-teal-300">
                            Karu
                          </span>
                        )}
                        {nurse.role === 'pj_shift' && (
                          <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-cyan-100 text-cyan-800 border border-cyan-300">
                            PJ Sif
                          </span>
                        )}
                      </div>

                      <div className="flex items-center space-x-3 text-xs text-slate-500 mt-1 flex-wrap">
                        <span className="flex items-center space-x-1">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span className={hasPhone ? 'text-slate-700 font-medium' : 'text-amber-600 italic'}>
                            {nurse.phone || 'Nomor belum diinput'}
                          </span>
                        </span>

                        {assignedMachineCodes.length > 0 && (
                          <span className="flex items-center space-x-1 text-teal-700 font-semibold">
                            <Layers className="w-3 h-3 text-teal-600" />
                            <span>
                              {assignedMachineCodes.length} Mesin ({assignedMachineCodes.join(', ')})
                            </span>
                          </span>
                        )}

                        {specialTasks.length > 0 && (
                          <span className="text-purple-700 font-medium">
                            • Tugas: {specialTasks.map((t) => t.category).join(', ')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action Button */}
                  <div className="shrink-0 flex items-center space-x-2 self-end md:self-center">
                    <button
                      onClick={() =>
                        setSelectedNurseForDetail({
                          nurse,
                          shift,
                        })
                      }
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-2xs cursor-pointer active:scale-95 group-hover:shadow-md"
                      title={`Buka & Kirim Pengingat WhatsApp ke ${nurse.name}`}
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>Kirim WA Jadwal</span>
                      <ChevronRight className="w-3.5 h-3.5 text-emerald-200" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Info */}
        <div className="bg-slate-50 p-3 sm:px-5 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2 shrink-0">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Pesan akan diformat otomatis mencakup nama, shif, daftar mesin HD, dan nomor telepon perawat.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl transition cursor-pointer text-xs"
          >
            Tutup
          </button>
        </div>
      </div>
      </div>

      {/* Detail Modal for Selected Nurse */}
      {selectedNurseForDetail && (
        <EmployeeWhatsAppModal
          isOpen={Boolean(selectedNurseForDetail)}
          onClose={() => setSelectedNurseForDetail(null)}
          employee={selectedNurseForDetail.nurse}
          selectedDate={selectedDate}
          initialShift={selectedNurseForDetail.shift}
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

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};
