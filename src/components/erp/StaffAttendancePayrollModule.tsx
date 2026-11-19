import React, { useState } from 'react';
import { CalendarCheck, Plus, Printer, ShieldCheck, UserPlus, Wallet } from 'lucide-react';
import { DEFAULT_PERMISSION_MATRIX, formatINR } from '../../config/businessConfig';
import { useMall } from '../../context/MallContext';
import {
  AttendanceRecord,
  PayrollRecord,
  PermissionKey,
  RolePermissionMatrix,
  StaffMember,
  StaffRole,
} from '../../types/erp';

const STAFF_ROLES: Array<Exclude<StaffRole, 'customer'>> = [
  'owner',
  'super_admin',
  'manager',
  'cashier',
  'inventory_manager',
  'accountant',
  'delivery_staff',
];

const PERMISSION_KEYS: PermissionKey[] = [
  'products',
  'billing',
  'discounts',
  'stock_adjustment',
  'refund_approval',
  'customers',
  'suppliers',
  'accounting',
  'reports',
  'staff',
  'settings',
];

export const StaffAttendancePayrollModule: React.FC = () => {
  const {
    staff,
    attendance,
    payroll,
    storeSettings,
    saveStoreSettings,
    upsertStaff,
    assignStaffAuthRole,
    recordAttendance,
    createPayroll,
    hasPermission,
    activeRoleView,
    showToast,
  } = useMall();

  const [subTab, setSubTab] = useState<'directory' | 'attendance' | 'payroll' | 'permissions'>('directory');
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [staffForm, setStaffForm] = useState<StaffMember>({
    id: '',
    fullName: '',
    mobile: '',
    email: '',
    address: '',
    joiningDate: new Date().toISOString().slice(0, 10),
    designation: 'POS Cashier',
    department: 'Billing',
    salary: 14000,
    status: 'active',
    emergencyContact: '',
    role: 'cashier',
  });

  // Attendance form
  const [attStaffId, setAttStaffId] = useState(staff[0]?.id || '');
  const [attDate, setAttDate] = useState(new Date().toISOString().slice(0, 10));
  const [attShift, setAttShift] = useState<AttendanceRecord['shift']>('Full Day');
  const [attStatus, setAttStatus] = useState<AttendanceRecord['status']>('full_day');
  const [attCheckIn, setAttCheckIn] = useState('08:30');
  const [attCheckOut, setAttCheckOut] = useState('20:30');
  const [attLate, setAttLate] = useState(false);
  const [attOt, setAttOt] = useState(0);

  // Payroll form
  const [payStaffId, setPayStaffId] = useState(staff[0]?.id || '');
  const [payMonth, setPayMonth] = useState(new Date().toISOString().slice(0, 7));
  const [payAllowances, setPayAllowances] = useState(500);
  const [payOtPay, setPayOtPay] = useState(0);
  const [payAdvDeduct, setPayAdvDeduct] = useState(0);
  const [payOtherDeduct, setPayOtherDeduct] = useState(0);
  const [payMode, setPayMode] = useState<'bank' | 'cash' | 'upi'>('bank');
  const [slipToPrint, setSlipToPrint] = useState<PayrollRecord | null>(null);

  // Firebase UID Role Binding
  const [bindUid, setBindUid] = useState('');
  const [bindEmail, setBindEmail] = useState('');
  const [bindRole, setBindRole] = useState<Exclude<StaffRole, 'customer'>>('cashier');
  const [bindStaffId, setBindStaffId] = useState(staff[0]?.id || '');

  const permissionMatrix: RolePermissionMatrix =
    storeSettings.permissionMatrix || DEFAULT_PERMISSION_MATRIX;

  const canManagePayroll = hasPermission('accounting') || activeRoleView === 'owner';
  const isOwnerView = activeRoleView === 'owner' || activeRoleView === 'super_admin';

  const openNewStaff = () => {
    setStaffForm({
      id: `stf_${Date.now()}`,
      fullName: '',
      mobile: '',
      email: '',
      address: '',
      joiningDate: new Date().toISOString().slice(0, 10),
      designation: 'POS Cashier',
      department: 'Billing',
      salary: 14000,
      status: 'active',
      emergencyContact: '',
      role: 'cashier',
    });
    setShowStaffModal(true);
  };

  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffForm.fullName.trim() || !staffForm.mobile.trim()) {
      showToast('Staff full name and mobile are required.', 'error');
      return;
    }
    await upsertStaff(staffForm);
    setShowStaffModal(false);
  };

  const handleMarkAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    const member = staff.find((s) => s.id === attStaffId);
    if (!member) return;
    await recordAttendance({
      id: `att_${member.id}_${attDate}`,
      staffId: member.id,
      staffName: member.fullName,
      date: attDate,
      shift: attShift,
      checkIn: attStatus === 'absent' || attStatus === 'leave' ? undefined : attCheckIn,
      checkOut: attStatus === 'absent' || attStatus === 'leave' ? undefined : attCheckOut,
      lateEntry: attLate,
      overtimeHours: attOt,
      status: attStatus,
    });
  };

  const handleGeneratePayroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManagePayroll) {
      showToast('Accountant or Owner permission required to generate payroll.', 'error');
      return;
    }
    const member = staff.find((s) => s.id === payStaffId);
    if (!member) return;
    const netPay = Math.max(
      0,
      member.salary + payAllowances + payOtPay - payAdvDeduct - payOtherDeduct
    );
    const rec: PayrollRecord = {
      id: `pay_${member.id}_${payMonth}`,
      staffId: member.id,
      staffName: member.fullName,
      month: payMonth,
      basicSalary: member.salary,
      allowances: payAllowances,
      overtimePay: payOtPay,
      advanceDeduction: payAdvDeduct,
      otherDeductions: payOtherDeduct,
      netPay,
      paymentDate: new Date().toISOString().slice(0, 10),
      paymentMode: payMode,
      status: 'paid',
    };
    await createPayroll(rec);
    setSlipToPrint(rec);
  };

  const togglePermissionCell = async (
    role: Exclude<StaffRole, 'customer'>,
    perm: PermissionKey
  ) => {
    if (!isOwnerView) {
      showToast('Only Owner can modify role permission matrix.', 'error');
      return;
    }
    if (role === 'owner' || role === 'super_admin') {
      showToast('Owner retains full system control.', 'info');
      return;
    }
    const updatedMatrix: RolePermissionMatrix = {
      ...permissionMatrix,
      [role]: {
        ...permissionMatrix[role],
        [perm]: !permissionMatrix[role]?.[perm],
      },
    };
    await saveStoreSettings({ permissionMatrix: updatedMatrix });
  };

  const handleBindFirebaseRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bindUid.trim() || !bindEmail.trim()) {
      showToast('Enter Firebase User UID and Google Email.', 'error');
      return;
    }
    await assignStaffAuthRole(bindUid.trim(), bindEmail.trim(), bindRole, bindStaffId);
    setBindUid('');
    setBindEmail('');
  };

  return (
    <div className="space-y-5">
      {/* Header & Sub-Tabs */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight">
            Staff Directory, Attendance, Payroll & Access Control
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Active Employees: <strong>{staff.filter((s) => s.status === 'active').length}</strong> · Attendance Records:{' '}
            <strong>{attendance.length}</strong>
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5 text-xs">
          {(
            [
              ['directory', 'Staff Directory'],
              ['attendance', 'Attendance & Shifts'],
              ...(canManagePayroll ? [['payroll', 'Payroll & Salary Slips']] : []),
              ...(isOwnerView ? [['permissions', 'Roles & Permissions']] : []),
            ] as Array<[typeof subTab, string]>
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setSubTab(id)}
              className={`px-3 py-1.5 rounded-lg border font-semibold ${
                subTab === id
                  ? 'bg-[#0F172A] text-white border-[#0F172A] dark:bg-amber-500 dark:text-slate-950'
                  : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {subTab === 'directory' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={openNewStaff}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0F172A] dark:bg-amber-500 px-3.5 py-2 text-xs font-bold text-white dark:text-slate-950"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Add Staff Member
            </button>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-500">
                <tr>
                  <th className="p-3">Staff Name</th>
                  <th className="p-3">Role / Designation</th>
                  <th className="p-3">Contact</th>
                  <th className="p-3">Joined</th>
                  <th className="p-3 text-right">Monthly Salary</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 tabular-nums">
                {staff.map((m) => (
                  <tr key={m.id}>
                    <td className="p-3 font-bold">{m.fullName}</td>
                    <td className="p-3">
                      <div>{m.designation}</div>
                      <div className="text-[11px] font-mono text-slate-500 uppercase">{m.role}</div>
                    </td>
                    <td className="p-3">
                      <div>{m.mobile}</div>
                      <div className="text-[11px] text-slate-500">{m.email}</div>
                    </td>
                    <td className="p-3">{m.joiningDate}</td>
                    <td className="p-3 text-right font-bold">{formatINR(m.salary)}</td>
                    <td className="p-3 uppercase font-semibold">{m.status}</td>
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setStaffForm(m);
                          setShowStaffModal(true);
                        }}
                        className="text-amber-600 font-semibold hover:underline"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subTab === 'attendance' && (
        <div className="grid lg:grid-cols-12 gap-5 items-start">
          <form
            onSubmit={handleMarkAttendance}
            className="lg:col-span-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3 text-xs"
          >
            <h3 className="text-sm font-bold flex items-center gap-1.5">
              <CalendarCheck className="w-4 h-4 text-emerald-600" />
              Mark Daily Attendance
            </h3>
            <div>
              <label className="block font-semibold mb-1">Employee</label>
              <select
                value={attStaffId}
                onChange={(e) => setAttStaffId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
              >
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.fullName} ({s.designation})
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-semibold mb-1">Date</label>
                <input
                  type="date"
                  value={attDate}
                  onChange={(e) => setAttDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Shift</label>
                <select
                  value={attShift}
                  onChange={(e) => setAttShift(e.target.value as AttendanceRecord['shift'])}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
                >
                  <option value="Full Day">Full Day</option>
                  <option value="Morning">Morning</option>
                  <option value="Evening">Evening</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">Check-In</label>
                <input
                  type="time"
                  value={attCheckIn}
                  onChange={(e) => setAttCheckIn(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Check-Out</label>
                <input
                  type="time"
                  value={attCheckOut}
                  onChange={(e) => setAttCheckOut(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Status</label>
                <select
                  value={attStatus}
                  onChange={(e) => setAttStatus(e.target.value as AttendanceRecord['status'])}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
                >
                  <option value="full_day">Full Day</option>
                  <option value="half_day">Half Day</option>
                  <option value="absent">Absent</option>
                  <option value="leave">Leave</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">Overtime (hrs)</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={attOt}
                  onChange={(e) => setAttOt(Number(e.target.value) || 0)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={attLate} onChange={(e) => setAttLate(e.target.checked)} />
              Late Entry
            </label>
            <button
              type="submit"
              className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
            >
              Save Attendance
            </button>
          </form>

          <div className="lg:col-span-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-500">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3">Staff Name</th>
                  <th className="p-3">Shift</th>
                  <th className="p-3">In / Out</th>
                  <th className="p-3">OT (hrs)</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 tabular-nums">
                {attendance.map((a) => (
                  <tr key={a.id}>
                    <td className="p-3 font-mono">{a.date}</td>
                    <td className="p-3 font-bold">{a.staffName}</td>
                    <td className="p-3">{a.shift}</td>
                    <td className="p-3">
                      {a.checkIn || '—'} / {a.checkOut || '—'}
                      {a.lateEntry && <span className="ml-1 text-amber-600 font-semibold">(Late)</span>}
                    </td>
                    <td className="p-3">{a.overtimeHours}</td>
                    <td className="p-3 uppercase font-bold">{a.status.replace('_', ' ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subTab === 'payroll' && canManagePayroll && (
        <div className="grid lg:grid-cols-12 gap-5 items-start">
          <form
            onSubmit={handleGeneratePayroll}
            className="lg:col-span-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3 text-xs"
          >
            <h3 className="text-sm font-bold flex items-center gap-1.5">
              <Wallet className="w-4 h-4 text-amber-600" />
              Generate Monthly Salary Slip
            </h3>
            <div>
              <label className="block font-semibold mb-1">Staff Member</label>
              <select
                value={payStaffId}
                onChange={(e) => setPayStaffId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
              >
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.fullName} — Basic {formatINR(s.salary)}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-semibold mb-1">Month</label>
                <input
                  type="month"
                  value={payMonth}
                  onChange={(e) => setPayMonth(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Payment Mode</label>
                <select
                  value={payMode}
                  onChange={(e) => setPayMode(e.target.value as 'bank' | 'cash' | 'upi')}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
                >
                  <option value="bank">Bank Transfer</option>
                  <option value="upi">UPI</option>
                  <option value="cash">Cash</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">Allowances (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={payAllowances}
                  onChange={(e) => setPayAllowances(Number(e.target.value) || 0)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 tabular-nums"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Overtime Pay (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={payOtPay}
                  onChange={(e) => setPayOtPay(Number(e.target.value) || 0)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 tabular-nums"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Advance Deduction (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={payAdvDeduct}
                  onChange={(e) => setPayAdvDeduct(Number(e.target.value) || 0)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 tabular-nums"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Other Deductions (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={payOtherDeduct}
                  onChange={(e) => setPayOtherDeduct(Number(e.target.value) || 0)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 tabular-nums"
                />
              </div>
            </div>
            <button
              type="submit"
              className="w-full py-2.5 rounded-lg bg-[#0F172A] dark:bg-amber-500 text-white dark:text-slate-950 font-bold"
            >
              Generate & Pay Salary Slip
            </button>
          </form>

          <div className="lg:col-span-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-500">
                <tr>
                  <th className="p-3">Month</th>
                  <th className="p-3">Staff</th>
                  <th className="p-3 text-right">Basic + Allow</th>
                  <th className="p-3 text-right">Deductions</th>
                  <th className="p-3 text-right">Net Pay</th>
                  <th className="p-3 text-right">Slip</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 tabular-nums">
                {payroll.map((p) => (
                  <tr key={p.id}>
                    <td className="p-3 font-mono">{p.month}</td>
                    <td className="p-3 font-bold">{p.staffName}</td>
                    <td className="p-3 text-right">{formatINR(p.basicSalary + p.allowances + p.overtimePay)}</td>
                    <td className="p-3 text-right text-red-600">{formatINR(p.advanceDeduction + p.otherDeductions)}</td>
                    <td className="p-3 text-right font-extrabold text-emerald-600">{formatINR(p.netPay)}</td>
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        onClick={() => setSlipToPrint(p)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 font-semibold"
                      >
                        <Printer className="w-3 h-3" />
                        Slip
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subTab === 'permissions' && isOwnerView && (
        <div className="space-y-5">
          {/* Owner Permission Matrix */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <h3 className="text-sm font-bold">Owner-Controlled Role Permission Matrix</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                    <th className="p-2">Permission</th>
                    {STAFF_ROLES.map((r) => (
                      <th key={r} className="p-2 text-center uppercase">
                        {r.replace('_', ' ')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {PERMISSION_KEYS.map((perm) => (
                    <tr key={perm}>
                      <td className="p-2 font-semibold capitalize">{perm.replace('_', ' ')}</td>
                      {STAFF_ROLES.map((role) => (
                        <td key={role} className="p-2 text-center">
                          <input
                            type="checkbox"
                            aria-label={`${role} ${perm}`}
                            checked={Boolean(permissionMatrix[role]?.[perm])}
                            onChange={() => togglePermissionCell(role, perm)}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Firebase UID Role Assignment */}
          <form
            onSubmit={handleBindFirebaseRole}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3 text-xs"
          >
            <h3 className="text-sm font-bold">Assign Firebase Auth Staff Role (Live Cloud Access)</h3>
            <div className="grid sm:grid-cols-4 gap-3">
              <input
                type="text"
                placeholder="Firebase User UID"
                value={bindUid}
                onChange={(e) => setBindUid(e.target.value)}
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 font-mono"
              />
              <input
                type="email"
                placeholder="Staff Google Email"
                value={bindEmail}
                onChange={(e) => setBindEmail(e.target.value)}
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
              />
              <select
                value={bindRole}
                onChange={(e) => setBindRole(e.target.value as Exclude<StaffRole, 'customer'>)}
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
              >
                {STAFF_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <select
                value={bindStaffId}
                onChange={(e) => setBindStaffId(e.target.value)}
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
              >
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.fullName}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[#0F172A] dark:bg-amber-500 text-white dark:text-slate-950 font-bold"
            >
              Grant Cloud Role Access
            </button>
          </form>
        </div>
      )}

      {/* Printable Salary Slip Modal */}
      {slipToPrint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white text-slate-900 p-6 space-y-4 shadow-2xl">
            <div className="border-b border-slate-200 pb-3 text-center">
              <h3 className="text-base font-extrabold">{storeSettings.nameHi}</h3>
              <p className="text-xs text-slate-500">{storeSettings.nameEn} · Salary Slip ({slipToPrint.month})</p>
            </div>
            <div className="text-xs space-y-1.5 tabular-nums">
              <div className="flex justify-between">
                <span>Employee Name:</span>
                <strong>{slipToPrint.staffName}</strong>
              </div>
              <div className="flex justify-between">
                <span>Basic Salary:</span>
                <span>{formatINR(slipToPrint.basicSalary)}</span>
              </div>
              <div className="flex justify-between">
                <span>Allowances & Overtime:</span>
                <span>{formatINR(slipToPrint.allowances + slipToPrint.overtimePay)}</span>
              </div>
              <div className="flex justify-between text-red-600">
                <span>Advance & Deductions:</span>
                <span>-{formatINR(slipToPrint.advanceDeduction + slipToPrint.otherDeductions)}</span>
              </div>
              <div className="flex justify-between text-sm font-extrabold border-t border-slate-200 pt-2">
                <span>Net Salary Paid ({slipToPrint.paymentMode.toUpperCase()}):</span>
                <span className="text-emerald-700">{formatINR(slipToPrint.netPay)}</span>
              </div>
            </div>
            <div className="flex justify-end gap-2 no-print">
              <button
                type="button"
                onClick={() => setSlipToPrint(null)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1 px-4 py-2 rounded-lg bg-[#0F172A] text-white text-xs font-bold"
              >
                <Printer className="w-3.5 h-3.5" />
                Print Salary Slip
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Staff Modal */}
      {showStaffModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <form
            onSubmit={handleSaveStaff}
            className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4 text-xs shadow-2xl"
          >
            <div className="flex justify-between items-center">
              <h3 className="text-base font-extrabold">Staff Profile</h3>
              <button type="button" onClick={() => setShowStaffModal(false)} className="text-slate-500">
                Close
              </button>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={staffForm.fullName}
                  onChange={(e) => setStaffForm({ ...staffForm, fullName: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Mobile *</label>
                <input
                  type="tel"
                  required
                  value={staffForm.mobile}
                  onChange={(e) => setStaffForm({ ...staffForm, mobile: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Email</label>
                <input
                  type="email"
                  value={staffForm.email}
                  onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Role</label>
                <select
                  value={staffForm.role}
                  onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value as Exclude<StaffRole, 'customer'> })}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
                >
                  {STAFF_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">Designation</label>
                <input
                  type="text"
                  value={staffForm.designation}
                  onChange={(e) => setStaffForm({ ...staffForm, designation: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Monthly Salary (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={staffForm.salary}
                  onChange={(e) => setStaffForm({ ...staffForm, salary: Number(e.target.value) || 0 })}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 tabular-nums"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowStaffModal(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-[#0F172A] dark:bg-amber-500 text-white dark:text-slate-950 font-bold"
              >
                Save Staff
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
