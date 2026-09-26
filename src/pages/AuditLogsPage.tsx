import React, { useState } from 'react';
import {
  History,
  Search,
  ShieldCheck,
  UserCheck,
  FileCheck,
  Calendar,
} from 'lucide-react';
import { AuditLog } from '../types';
import { formatDateDisplay } from '../utils/calculations';

interface AuditLogsPageProps {
  auditLogs: AuditLog[];
}

export const AuditLogsPage: React.FC<AuditLogsPageProps> = ({ auditLogs }) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = auditLogs.filter((log) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const performedBy = (log.performedBy || log.user || '').toLowerCase();
    const targetId = (log.targetId || log.recordId || '').toLowerCase();
    const action = (log.action || '').toLowerCase();
    return action.includes(q) || performedBy.includes(q) || targetId.includes(q);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <History className="w-6 h-6 text-emerald-800" />
            <span>Immutable Audit Trail</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Tamper-resistant audit logs of every member creation, payment collection, and status modification.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Encrypted Log Store</span>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-x-auto">
        <table className="w-full text-xs text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
              <th className="py-3 px-4">Timestamp</th>
              <th className="py-3 px-4">Action</th>
              <th className="py-3 px-4">Target Entity</th>
              <th className="py-3 px-4">Entity ID</th>
              <th className="py-3 px-4">Performed By</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-400">
                  No audit logs recorded yet.
                </td>
              </tr>
            ) : (
              filtered.map((log) => {
                const timestampStr = log.timestamp || log.createdAt || `${log.date || ''} ${log.time || ''}`.trim();
                const targetEntityStr = log.targetEntity || log.recordType || 'Record';
                const targetIdStr = log.targetId || log.recordId || '-';
                const performedByStr = log.performedBy || log.user || 'Admin';

                return (
                  <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono text-slate-600">
                      {formatDateDisplay(timestampStr)}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-[11px]">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-700 font-semibold">
                      {targetEntityStr}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-500 text-[11px]">
                      {targetIdStr}
                    </td>
                    <td className="py-3 px-4 text-emerald-800 font-bold">
                      {performedByStr}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
