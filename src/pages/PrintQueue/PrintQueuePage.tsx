import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw, RotateCcw, Printer, CheckCircle, XCircle, Clock, Loader, Download } from 'lucide-react';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { PrintJob, PrintJobStatus, PrintQueueStats } from '@/types';
import { printBridgeApi } from '@/services/printBridge';
import { PrintBridgeInstallerInfo, printBridgeInstallerApi } from '@/services/api';

const AUTO_REFRESH_MS = 5_000;

const statusLabel: Record<PrintJobStatus, string> = {
  pending: 'Pendiente',
  processing: 'Procesando',
  retrying: 'Reintentando',
  completed: 'Completado',
  failed: 'Fallido',
};

const statusBadge: Record<PrintJobStatus, 'secondary' | 'success' | 'warning' | 'danger' | 'info'> = {
  pending: 'secondary',
  processing: 'info',
  retrying: 'warning',
  completed: 'success',
  failed: 'danger',
};

const StatusIcon = ({ status }: { status: PrintJobStatus }) => {
  switch (status) {
    case 'completed':
      return <CheckCircle size={14} className="text-green-600" />;
    case 'failed':
      return <XCircle size={14} className="text-red-600" />;
    case 'processing':
      return <Loader size={14} className="animate-spin text-blue-600" />;
    case 'retrying':
      return <RotateCcw size={14} className="text-yellow-600" />;
    default:
      return <Clock size={14} className="text-slate-400" />;
  }
};

const formatDate = (iso: string) => {
  try {
    return new Intl.DateTimeFormat('es-NI', {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
};

export default function PrintQueuePage() {
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [stats, setStats] = useState<PrintQueueStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [bridgeError, setBridgeError] = useState('');
  const [installerInfo, setInstallerInfo] = useState<PrintBridgeInstallerInfo | null>(null);
  const [installerError, setInstallerError] = useState('');
  const [searchingInstaller, setSearchingInstaller] = useState(true);
  const [downloadingInstaller, setDownloadingInstaller] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<PrintJobStatus | 'all'>('all');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const installerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(1)} MB`;
  };

  const fetchJobs = useCallback(async () => {
    try {
      setBridgeError('');
      const [healthRes, jobsRes] = await Promise.all([
        printBridgeApi.health(),
        printBridgeApi.getJobs(100),
      ]);
      setStats(healthRes.queue);
      setJobs(jobsRes.jobs);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo conectar al bridge de impresión';
      setBridgeError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchInstallerInfo = useCallback(async () => {
    setSearchingInstaller(true);
    if (installerTimeoutRef.current) {
      clearTimeout(installerTimeoutRef.current);
    }

    try {
      // Create a race between the actual request and a 3-second timeout
      const installerPromise = printBridgeInstallerApi.getInfo();
      const timeoutPromise = new Promise<never>(
        (_, reject) => {
          installerTimeoutRef.current = setTimeout(
            () => reject(new Error('Timeout buscando instalador')),
            3000
          );
        }
      );

      const info = await Promise.race([installerPromise, timeoutPromise]);
      setInstallerInfo(info);
      setInstallerError('');
    } catch (err) {
      setInstallerInfo(null);
      const msg = err instanceof Error ? err.message : 'Instalador no disponible';
      setInstallerError(msg);
    } finally {
      setSearchingInstaller(false);
    }
  }, []);

  useEffect(() => {
    void fetchJobs();
    void fetchInstallerInfo();
    
    // Refetch jobs every 5 seconds
    timerRef.current = setInterval(() => { void fetchJobs(); }, AUTO_REFRESH_MS);
    
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (installerTimeoutRef.current) clearTimeout(installerTimeoutRef.current);
    };
  }, [fetchJobs, fetchInstallerInfo]);

  const handleRetry = async (id: string) => {
    setRetryingId(id);
    try {
      await printBridgeApi.retryJob(id);
      await fetchJobs();
    } catch {
      // silently handled; next auto-refresh will update
    } finally {
      setRetryingId(null);
    }
  };

  const handleDownloadInstaller = async () => {
    if (!installerInfo) return;
    
    setDownloadingInstaller(true);
    try {
      await printBridgeInstallerApi.download(installerInfo.downloadUrl, installerInfo.fileName);
    } finally {
      setDownloadingInstaller(false);
    }
  };

  const filteredJobs = filterStatus === 'all'
    ? jobs
    : jobs.filter((j) => j.status === filterStatus);

  const statuses: Array<PrintJobStatus | 'all'> = ['all', 'pending', 'processing', 'retrying', 'completed', 'failed'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Printer size={24} />
            Cola de impresión
          </h1>
          <p className="text-sm text-slate-500">Estado del bridge de impresión local</p>
        </div>
        <Button variant="secondary" onClick={() => void fetchJobs()} disabled={loading}>
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Actualizar
        </Button>
      </div>

      {/* Bridge error */}
      {bridgeError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          Bridge no disponible: {bridgeError}
        </div>
      )}

      {/* Installer download */}
      <Card>
        <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-800">Instalador de Print Bridge (Windows)</p>
            {installerInfo ? (
              <>
                <p className="text-xs text-slate-500 mt-1">
                  {installerInfo.fileName} · {formatSize(installerInfo.sizeBytes)} · actualizado {formatDate(installerInfo.updatedAt)}
                </p>
                {installerInfo.fileName.toLowerCase().endsWith('.zip') && (
                  <p className="text-xs text-slate-400 mt-0.5">
                    Extrae el ZIP y ejecuta <span className="font-mono">GameOver Print Bridge.exe</span>
                  </p>
                )}
              </>
            ) : searchingInstaller ? (
              <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                <Loader size={12} className="animate-spin" />
                Buscando instalador disponible...
              </p>
            ) : (
              <p className="text-xs text-red-600 mt-1">{installerError || 'Instalador no disponible'}</p>
            )}
          </div>

          <Button
            variant="secondary"
            onClick={() => void handleDownloadInstaller()}
            disabled={!installerInfo || downloadingInstaller}
            loading={downloadingInstaller}
          >
            <Download size={16} />
            {installerInfo?.fileName.toLowerCase().endsWith('.zip') ? 'Descargar ZIP' : 'Descargar instalador'}
          </Button>
        </CardBody>
      </Card>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {(['pending', 'processing', 'retrying', 'completed', 'failed'] as PrintJobStatus[]).map((s) => (
            <div
              key={s}
              role="button"
              tabIndex={0}
              onClick={() => setFilterStatus((prev) => prev === s ? 'all' : s)}
              onKeyDown={(e) => e.key === 'Enter' && setFilterStatus((prev) => prev === s ? 'all' : s)}
              className={`cursor-pointer rounded-xl shadow-sm border border-slate-200 bg-white transition-shadow hover:shadow-md ${filterStatus === s ? 'ring-2 ring-blue-500' : ''}`}
            >
              <div className="py-3 px-4 text-center">
                <div className="text-2xl font-bold text-slate-800">{stats[s]}</div>
                <div className="text-xs text-slate-500 mt-0.5">{statusLabel[s]}</div>
              </div>
            </div>
          ))}
          <div
            role="button"
            tabIndex={0}
            onClick={() => setFilterStatus('all')}
            onKeyDown={(e) => e.key === 'Enter' && setFilterStatus('all')}
            className={`cursor-pointer rounded-xl shadow-sm border border-slate-200 bg-white transition-shadow hover:shadow-md ${filterStatus === 'all' ? 'ring-2 ring-blue-500' : ''}`}
          >
            <div className="py-3 px-4 text-center">
              <div className="text-2xl font-bold text-slate-800">{stats.total}</div>
              <div className="text-xs text-slate-500 mt-0.5">Total</div>
            </div>
          </div>
        </div>
      )}

      {/* Filter pills */}
      <div className="flex flex-wrap gap-2">
        {statuses.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              filterStatus === s
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {s === 'all' ? 'Todos' : statusLabel[s]}
            {s !== 'all' && stats ? ` (${stats[s]})` : ''}
          </button>
        ))}
      </div>

      {/* Job list */}
      {loading && jobs.length === 0 ? (
        <div className="flex items-center justify-center py-16">
          <Loader size={32} className="animate-spin text-blue-600" />
        </div>
      ) : filteredJobs.length === 0 ? (
        <Card>
          <CardBody className="text-center py-12 text-slate-400">
            No hay trabajos{filterStatus !== 'all' ? ` con estado "${statusLabel[filterStatus as PrintJobStatus]}"` : ''}.
          </CardBody>
        </Card>
      ) : (
        <Card>
          <div className="divide-y divide-slate-100">
            {filteredJobs.map((job) => (
              <div key={job.id} className="flex items-start gap-3 px-5 py-4">
                <div className="mt-0.5">
                  <StatusIcon status={job.status} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs text-slate-500 truncate max-w-[180px]" title={job.id}>
                      {job.id.slice(0, 8)}…
                    </span>
                    <Badge variant={statusBadge[job.status]}>{statusLabel[job.status]}</Badge>
                    <span className="text-xs text-slate-400 capitalize">{job.type}</span>
                  </div>

                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-500">
                    <span>Creado: {formatDate(job.createdAt)}</span>
                    <span>Actualizado: {formatDate(job.updatedAt)}</span>
                    {job.finishedAt && <span>Finalizado: {formatDate(job.finishedAt)}</span>}
                    <span>Intentos: {job.attempts}/{job.maxAttempts}</span>
                  </div>

                  {job.lastError && (
                    <div className="mt-1.5 text-xs text-red-600 bg-red-50 border border-red-100 rounded px-2 py-1 truncate">
                      {job.lastError}
                    </div>
                  )}
                </div>

                {(job.status === 'failed' || job.status === 'retrying') && (
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={retryingId === job.id}
                    loading={retryingId === job.id}
                    onClick={() => void handleRetry(job.id)}
                  >
                    <RotateCcw size={13} />
                    Reintentar
                  </Button>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      <p className="text-xs text-slate-400 text-right">
        Actualización automática cada {AUTO_REFRESH_MS / 1000} s
      </p>
    </div>
  );
}
