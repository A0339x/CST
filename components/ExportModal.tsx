import React, { useState } from 'react';
import { X, Download, Loader2, FileText, Users } from 'lucide-react';
import { exportApi } from '../lib/api';

interface ExportModalProps {
  onClose: () => void;
  coaches?: Array<{ id: string; name: string }>;
}

type Dataset = 'clients' | 'notes';
type Format = 'csv' | 'json';

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'ONBOARDING', label: 'Onboarding' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'AT_RISK', label: 'At Risk' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'PAUSED', label: 'Paused' },
];

const ExportModal: React.FC<ExportModalProps> = ({ onClose, coaches = [] }) => {
  const [dataset, setDataset] = useState<Dataset>('clients');
  const [format, setFormat] = useState<Format>('csv');
  const [status, setStatus] = useState('');
  const [coachId, setCoachId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleExport = async () => {
    setLoading(true);
    setError('');
    try {
      const dateStamp = new Date().toISOString().slice(0, 10);
      if (dataset === 'clients') {
        const result = await exportApi.exportClients({ format, status: status || undefined, coachId: coachId || undefined });
        const blob = format === 'json'
          ? new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' })
          : result as Blob;
        exportApi.downloadFile(blob, `clients-${dateStamp}.${format}`);
      } else {
        const result = await exportApi.exportNotes({
          format,
          coachId: coachId || undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
        });
        const blob = format === 'json'
          ? new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' })
          : result as Blob;
        exportApi.downloadFile(blob, `notes-${dateStamp}.${format}`);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Export failed');
    } finally {
      setLoading(false);
    }
  };

  const selectClass = 'w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500';
  const inputClass = 'w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <Download className="w-5 h-5 text-blue-400" />
            <h2 className="text-white font-semibold text-lg">Export Data</h2>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5">

          {/* Dataset picker */}
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-2 font-medium">What to export</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setDataset('clients')}
                className={`flex items-center gap-2 px-4 py-3 rounded-lg border text-sm font-medium transition-all ${
                  dataset === 'clients'
                    ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                    : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300'
                }`}
              >
                <Users className="w-4 h-4" />
                Clients
              </button>
              <button
                onClick={() => setDataset('notes')}
                className={`flex items-center gap-2 px-4 py-3 rounded-lg border text-sm font-medium transition-all ${
                  dataset === 'notes'
                    ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                    : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300'
                }`}
              >
                <FileText className="w-4 h-4" />
                Notes
              </button>
            </div>
          </div>

          {/* Filters */}
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-2 font-medium">Filters</p>
            <div className="space-y-2">
              {/* Status — clients only */}
              {dataset === 'clients' && (
                <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectClass}>
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              )}

              {/* Coach filter */}
              {coaches.length > 0 && (
                <select value={coachId} onChange={(e) => setCoachId(e.target.value)} className={selectClass}>
                  <option value="">All coaches</option>
                  {coaches.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              )}

              {/* Date range — notes only */}
              {dataset === 'notes' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">From</label>
                    <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">To</label>
                    <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={inputClass} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Format */}
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-2 font-medium">Format</p>
            <div className="grid grid-cols-2 gap-2">
              {(['csv', 'json'] as Format[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all uppercase tracking-wider ${
                    format === f
                      ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                      : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-rose-400 text-sm bg-rose-900/20 border border-rose-800 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-700">
          <button
            onClick={handleExport}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white font-medium py-2.5 rounded-lg transition-colors"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Download {format.toUpperCase()}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportModal;
