import React from 'react';
import { UserAccount, UserRole, ShiftSchedule, HDMachine, MachineAssignment, AppSettings, SpecialTask } from '../types';
import { SyncStatus } from '../services/cloudSync';
import { 
  Activity, 
  User, 
  LogOut, 
  Shield, 
  UserCheck, 
  Stethoscope, 
  Clock, 
  Calendar,
  Layers,
  ChevronDown,
  CloudCheck,
  Cloud,
  FileSpreadsheet
} from 'lucide-react';
import { HeaderGoogleSheetSync } from './HeaderGoogleSheetSync';

interface NavbarProps {
  currentUser: UserAccount;
  allEmployees: UserAccount[];
  activeTab: 'dashboard' | 'jadwal' | 'mesin' | 'tugas' | 'karyawan';
  setActiveTab: (tab: 'dashboard' | 'jadwal' | 'mesin' | 'tugas' | 'karyawan') => void;
  onLogout: () => void;
  onSwitchUser: (user: UserAccount) => void;
  syncStatus?: SyncStatus;
  settings?: AppSettings;
  onUpdateSettings?: (newSettings: AppSettings) => void;
  schedules?: ShiftSchedule[];
  machines?: HDMachine[];
  machineAssignments?: MachineAssignment[];
  specialTasks?: SpecialTask[];
  onUpdateSchedule?: (newSchedules: ShiftSchedule[]) => void;
  onUpdateMachineAssignments?: (newAssignments: MachineAssignment[]) => void;
  onUpdateEmployees?: (newEmployees: UserAccount[]) => void;
  onUpdateMachines?: (newMachines: HDMachine[]) => void;
  onUpdateSpecialTasks?: (newTasks: SpecialTask[]) => void;
  operationalDate?: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  allEmployees,
  activeTab,
  setActiveTab,
  onLogout,
  onSwitchUser,
  syncStatus = 'connected',
  settings,
  onUpdateSettings,
  schedules = [],
  machines = [],
  machineAssignments = [],
  specialTasks = [],
  onUpdateSchedule,
  onUpdateMachineAssignments,
  onUpdateEmployees,
  onUpdateMachines,
  onUpdateSpecialTasks,
  operationalDate,
}) => {
  const [showSwitchMenu, setShowSwitchMenu] = React.useState(false);
  const [currentTime, setCurrentTime] = React.useState(new Date());

  React.useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return {
          label: 'Administrator',
          bg: 'bg-purple-100 text-purple-800 border-purple-200',
          icon: Shield,
        };
      case 'kepala_ruangan':
      case 'karu':
        return {
          label: 'Kepala Ruangan HD',
          bg: 'bg-amber-100 text-amber-800 border-amber-200',
          icon: UserCheck,
        };
      case 'pj_shift':
      case 'katim':
        return {
          label: 'KATIM HD',
          bg: 'bg-emerald-100 text-emerald-800 border-emerald-200',
          icon: UserCheck,
        };
      case 'dokter':
        return {
          label: 'Dokter Hemodialisa',
          bg: 'bg-blue-100 text-blue-800 border-blue-200',
          icon: Stethoscope,
        };
      case 'perawat':
      case 'nurse':
      default:
        return {
          label: 'Perawat Mahir HD',
          bg: 'bg-teal-100 text-teal-800 border-teal-200',
          icon: Activity,
        };
    }
  };

  const badgeInfo = getRoleBadge(currentUser.role);
  const RoleIcon = badgeInfo.icon;

  const timeString = currentTime.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const dateString = currentTime.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <header className="bg-slate-900/98 text-white border-b border-slate-800 sticky top-0 z-40 shadow-lg backdrop-blur-md">
      {/* Main Navigation Bar */}
      <div className="max-w-[1680px] mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex justify-between h-15 sm:h-16 items-center gap-2 sm:gap-4">
          {/* Logo & Title */}
          <div className="flex items-center space-x-2.5 sm:space-x-3.5 shrink-0">
            <div className="h-9 sm:h-10 px-2 py-1 bg-white rounded-xl shadow-xs flex items-center justify-center border border-slate-200/20 shrink-0">
              <img
                src="/logo_rshl.png"
                onError={(e) => {
                  e.currentTarget.src = 'https://rshappyland.com/dist/img/logo/logo_happyland.png';
                }}
                alt="Logo RSHL Rumah Sakit Happy Land"
                className="h-full w-auto max-h-6 sm:max-h-7 object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h1 id="app-header-title" className="text-base sm:text-lg md:text-xl font-black tracking-wider text-white leading-none">
                  DIALISYNC
                </h1>
                <span className="hidden xl:inline text-[10px] font-semibold text-teal-300 bg-teal-950/80 border border-teal-800/60 px-2 py-0.5 rounded-md">
                  Unit Hemodialisa
                </span>
              </div>
              <span className="text-[10px] sm:text-[11px] text-slate-400 font-medium tracking-wide mt-0.5">
                RS Happy Land Medical Centre
              </span>
            </div>
          </div>

          {/* Centered Segmented Nav Tabs */}
          <nav className="hidden lg:flex items-center bg-slate-950/70 p-1 rounded-xl border border-slate-800/80 shadow-inner space-x-1">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`h-9 px-3.5 rounded-lg text-xs sm:text-[13px] font-semibold transition-all flex items-center space-x-2 shrink-0 cursor-pointer ${
                activeTab === 'dashboard'
                  ? 'bg-teal-500/25 text-teal-300 border border-teal-400/50 shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>Dashboard HD</span>
            </button>

            <button
              onClick={() => setActiveTab('jadwal')}
              className={`h-9 px-3.5 rounded-lg text-xs sm:text-[13px] font-semibold transition-all flex items-center space-x-2 shrink-0 cursor-pointer ${
                activeTab === 'jadwal'
                  ? 'bg-teal-500/25 text-teal-300 border border-teal-400/50 shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>Jadwal Shift</span>
            </button>

            <button
              onClick={() => setActiveTab('mesin')}
              className={`h-9 px-3.5 rounded-lg text-xs sm:text-[13px] font-semibold transition-all flex items-center space-x-2 shrink-0 cursor-pointer ${
                activeTab === 'mesin'
                  ? 'bg-teal-500/25 text-teal-300 border border-teal-400/50 shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Pembagian Mesin</span>
            </button>

            <button
              onClick={() => setActiveTab('tugas')}
              className={`h-9 px-3.5 rounded-lg text-xs sm:text-[13px] font-semibold transition-all flex items-center space-x-2 shrink-0 cursor-pointer ${
                activeTab === 'tugas'
                  ? 'bg-teal-500/25 text-teal-300 border border-teal-400/50 shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>Tugas Khusus</span>
            </button>

            {currentUser.role === 'admin' && (
              <button
                onClick={() => setActiveTab('karyawan')}
                className={`h-9 px-3.5 rounded-lg text-xs sm:text-[13px] font-semibold transition-all flex items-center space-x-2 shrink-0 cursor-pointer ${
                  activeTab === 'karyawan'
                    ? 'bg-purple-500/25 text-purple-300 border border-purple-400/50 shadow-xs'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                }`}
              >
                <Shield className="w-4 h-4" />
                <span>Akun Karyawan</span>
              </button>
            )}
          </nav>

          {/* User Profile, Clock & Actions */}
          <div className="flex items-center space-x-2 sm:space-x-2.5">
            {/* Real-time Clock & Date Display */}
            <div className="hidden xl:flex items-center space-x-2 text-xs text-slate-300 bg-slate-950/60 px-3 py-1.5 rounded-xl border border-slate-800/80 shrink-0">
              <Calendar className="w-3.5 h-3.5 text-teal-400" />
              <span>{dateString}</span>
              <span className="text-slate-600">·</span>
              <Clock className="w-3.5 h-3.5 text-teal-400" />
              <span className="font-mono text-teal-300 font-bold">{timeString} WIB</span>
            </div>

            {/* Quick Switch Dropdown for interactive demo testing */}
            <div className="relative">
              <button
                onClick={() => setShowSwitchMenu(!showSwitchMenu)}
                className="flex items-center space-x-2 px-2.5 sm:px-3 rounded-xl border border-slate-700/80 hover:border-teal-600/70 bg-slate-800/90 hover:bg-slate-800 text-left transition h-9.5 cursor-pointer shrink-0 shadow-xs active:scale-98"
                title="Ganti sudut pandang / peran akun staf"
              >
                <div className="w-7 h-7 rounded-lg bg-teal-500 text-slate-950 font-bold flex items-center justify-center text-xs shrink-0 shadow-xs">
                  {currentUser.name.substring(0, 2).toUpperCase()}
                </div>
                <div className="hidden sm:block">
                  <div className="text-xs font-bold text-slate-100 leading-tight truncate max-w-[110px] md:max-w-[140px]">
                    {currentUser.name}
                  </div>
                  <div className="flex items-center space-x-1 mt-0.5">
                    <span className={`text-[9px] md:text-[10px] px-1.5 py-0.2 rounded font-semibold border ${badgeInfo.bg}`}>
                      {badgeInfo.label}
                    </span>
                  </div>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${showSwitchMenu ? 'rotate-180' : ''}`} />
              </button>

              {showSwitchMenu && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setShowSwitchMenu(false)} 
                    aria-hidden="true"
                  />
                  <div className="absolute right-0 mt-2 w-72 max-w-[90vw] bg-slate-900 rounded-2xl shadow-2xl border border-teal-800/80 py-2 z-50 text-white animate-in fade-in zoom-in-95 duration-100">
                    <div className="px-3.5 py-2 border-b border-slate-800">
                      <p className="text-xs font-bold text-teal-300 uppercase tracking-wider">
                        Login Sebagai (Demo Switcher)
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Pilih staf untuk menguji tampilan staf vs administrator
                      </p>
                    </div>

                    <div className="max-h-60 overflow-y-auto py-1 divide-y divide-slate-800/50">
                      {Array.from(new Map((allEmployees || []).map((e) => [e.id, e])).values()).map((emp) => {
                        const isCurrent = emp.id === currentUser.id;
                        return (
                          <button
                            key={emp.id}
                            onClick={() => {
                              onSwitchUser(emp);
                              setShowSwitchMenu(false);
                            }}
                            className={`w-full px-3.5 py-2 text-left text-xs flex items-center justify-between hover:bg-slate-800 transition min-h-[40px] cursor-pointer ${
                              isCurrent ? 'bg-teal-950/80 font-bold text-teal-300' : 'text-slate-200'
                            }`}
                          >
                            <div className="truncate pr-2">
                              <div className="font-semibold text-slate-100 truncate">{emp.name}</div>
                              <div className="text-slate-400 text-[10px] capitalize truncate">
                                {emp.role.replace('_', ' ')} • @{emp.username}
                              </div>
                            </div>
                            {isCurrent && (
                              <span className="text-[10px] px-2 py-0.5 bg-teal-500/20 border border-teal-400/40 text-teal-300 rounded-md font-bold shrink-0">
                                Aktif
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    <div className="border-t border-slate-800 px-3 pt-2 mt-1">
                      <button
                        onClick={() => {
                          setShowSwitchMenu(false);
                          onLogout();
                        }}
                        className="w-full text-left text-xs text-rose-400 font-bold flex items-center space-x-2 py-1.5 px-2 hover:bg-rose-950/40 rounded-xl transition min-h-[38px] cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5 text-rose-400" />
                        <span>Keluar (Logout dari Akun)</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            <button
              onClick={onLogout}
              className="w-9.5 h-9.5 rounded-xl bg-slate-800/90 hover:bg-rose-950/60 border border-slate-700/80 hover:border-rose-700/60 text-slate-300 hover:text-rose-300 transition-all flex items-center justify-center shrink-0 cursor-pointer shadow-xs active:scale-95"
              title="Keluar dari akun (Logout)"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mobile Tab Navigation (Horizontal Scroll with Touch-Friendly Items) */}
        <div className="lg:hidden flex items-center space-x-1.5 py-2 overflow-x-auto border-t border-slate-800/80 scrollbar-none px-1">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`h-9 px-3.5 rounded-xl text-xs font-bold whitespace-nowrap flex items-center gap-1.5 transition active:scale-95 cursor-pointer shrink-0 border ${
              activeTab === 'dashboard'
                ? 'bg-teal-500 text-slate-950 border-teal-400 shadow-xs'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 border-slate-700/60'
            }`}
          >
            <Activity className="w-3.5 h-3.5 shrink-0" />
            <span>Dashboard</span>
          </button>
          <button
            onClick={() => setActiveTab('jadwal')}
            className={`h-9 px-3.5 rounded-xl text-xs font-bold whitespace-nowrap flex items-center gap-1.5 transition active:scale-95 cursor-pointer shrink-0 border ${
              activeTab === 'jadwal'
                ? 'bg-teal-500 text-slate-950 border-teal-400 shadow-xs'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 border-slate-700/60'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 shrink-0" />
            <span>Jadwal Shift</span>
          </button>
          <button
            onClick={() => setActiveTab('mesin')}
            className={`h-9 px-3.5 rounded-xl text-xs font-bold whitespace-nowrap flex items-center gap-1.5 transition active:scale-95 cursor-pointer shrink-0 border ${
              activeTab === 'mesin'
                ? 'bg-teal-500 text-slate-950 border-teal-400 shadow-xs'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 border-slate-700/60'
            }`}
          >
            <Layers className="w-3.5 h-3.5 shrink-0" />
            <span>Mesin HD</span>
          </button>
          <button
            onClick={() => setActiveTab('tugas')}
            className={`h-9 px-3.5 rounded-xl text-xs font-bold whitespace-nowrap flex items-center gap-1.5 transition active:scale-95 cursor-pointer shrink-0 border ${
              activeTab === 'tugas'
                ? 'bg-teal-500 text-slate-950 border-teal-400 shadow-xs'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 border-slate-700/60'
            }`}
          >
            <Activity className="w-3.5 h-3.5 shrink-0" />
            <span>Tugas Khusus</span>
          </button>
          {currentUser.role === 'admin' && (
            <button
              onClick={() => setActiveTab('karyawan')}
              className={`h-9 px-3.5 rounded-xl text-xs font-bold whitespace-nowrap flex items-center gap-1.5 transition active:scale-95 cursor-pointer shrink-0 border ${
                activeTab === 'karyawan'
                  ? 'bg-purple-500 text-white border-purple-400 shadow-xs'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 border-slate-700/60'
              }`}
            >
              <Shield className="w-3.5 h-3.5 shrink-0" />
              <span>Karyawan</span>
            </button>
          )}
        </div>
      </div>

      {/* Header Sync Google Sheets (Tarik & Kirim Data) */}
      {settings && onUpdateSettings && onUpdateSchedule && onUpdateMachineAssignments && onUpdateEmployees && (
        <HeaderGoogleSheetSync
          schedules={schedules}
          employees={allEmployees}
          machines={machines}
          machineAssignments={machineAssignments}
          specialTasks={specialTasks}
          settings={settings}
          onUpdateSettings={onUpdateSettings}
          onUpdateSchedule={onUpdateSchedule}
          onUpdateMachineAssignments={onUpdateMachineAssignments}
          onUpdateEmployees={onUpdateEmployees}
          onUpdateMachines={onUpdateMachines}
          onUpdateSpecialTasks={onUpdateSpecialTasks}
          operationalDate={operationalDate}
          canEdit={currentUser.role === 'admin' || currentUser.role === 'kepala_ruangan' || currentUser.role === 'karu' || currentUser.role === 'pj_shift'}
          syncStatus={syncStatus}
        />
      )}
    </header>
  );
};
