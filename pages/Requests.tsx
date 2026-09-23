import React, { useMemo, useState } from 'react';
import { CheckCircle2, Clock3, PackageCheck, XCircle } from 'lucide-react';
import { InventoryRequest, User } from '../types';

interface RequestsProps {
  requests: InventoryRequest[];
  currentUser: User;
  onApprove: (requestId: string) => Promise<string | null>;
  onReject: (requestId: string) => Promise<string | null>;
}

const statusStyles: Record<InventoryRequest['status'], string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-rose-50 text-rose-700 border-rose-200'
};

const statusLabels: Record<InventoryRequest['status'], string> = {
  pending: 'Pendiente de recepción',
  approved: 'Recibida en almacén',
  rejected: 'Rechazada'
};

const Requests: React.FC<RequestsProps> = ({ requests, currentUser, onApprove, onReject }) => {
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const canReview = currentUser.role === 'Admin' || currentUser.role === 'Operario';

  const orderedRequests = useMemo(
    () => [...requests].sort((a, b) => {
      if (a.status === 'pending' && b.status !== 'pending') return -1;
      if (a.status !== 'pending' && b.status === 'pending') return 1;
      return b.requestedAt - a.requestedAt;
    }),
    [requests]
  );

  const review = async (requestId: string, action: 'approve' | 'reject') => {
    setProcessingId(requestId);
    setMessage(null);
    const error = action === 'approve'
      ? await onApprove(requestId)
      : await onReject(requestId);
    setMessage(error ?? (action === 'approve'
      ? 'Material aprobado y añadido al inventario.'
      : 'Solicitud rechazada.'));
    setProcessingId(null);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <PackageCheck size={26} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-800">
              {canReview ? 'Solicitudes de entrada de AXIS' : 'Mis solicitudes de entrada'}
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              {canReview
                ? 'Comprueba físicamente el material antes de marcarlo como recibido en almacén.'
                : 'El material aparecerá en el inventario cuando IGNASER confirme su recepción.'}
            </p>
          </div>
        </div>
        {message && (
          <p className="mt-4 px-4 py-3 rounded-xl bg-slate-50 text-sm font-medium text-slate-700 border border-slate-200">
            {message}
          </p>
        )}
      </div>

      {orderedRequests.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
          <Clock3 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="font-bold text-slate-700">No hay solicitudes</h3>
          <p className="text-sm text-slate-500 mt-1">Las nuevas entradas enviadas por AXIS aparecerán aquí.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {orderedRequests.map((request) => (
            <article key={request.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold text-lg text-slate-800">{request.concept}</h3>
                  <p className="text-sm text-slate-500">{request.description}</p>
                </div>
                <span className={`shrink-0 px-3 py-1 rounded-full border text-xs font-semibold ${statusStyles[request.status]}`}>
                  {statusLabels[request.status]}
                </span>
              </div>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 mt-5 text-sm">
                <div><dt className="text-slate-400">Cantidad</dt><dd className="font-semibold text-slate-700">{request.quantity} uds.</dd></div>
                <div><dt className="text-slate-400">Ubicación propuesta</dt><dd className="font-semibold text-slate-700">{request.location}</dd></div>
                <div><dt className="text-slate-400">Obra de procedencia</dt><dd className="font-semibold text-slate-700">{request.obra}</dd></div>
                <div><dt className="text-slate-400">Solicitado por</dt><dd className="font-semibold text-slate-700">{request.requestedByName}</dd></div>
                <div className="col-span-2"><dt className="text-slate-400">Fecha</dt><dd className="font-semibold text-slate-700">{new Date(request.requestedAt).toLocaleString()}</dd></div>
              </dl>

              {request.imageUrl && (
                <img src={request.imageUrl} alt={request.concept} className="mt-5 w-full h-44 rounded-xl object-cover border border-slate-200" />
              )}

              {canReview && request.status === 'pending' && (
                <div className="grid grid-cols-2 gap-3 mt-5 pt-5 border-t border-slate-100">
                  <button
                    type="button"
                    disabled={processingId === request.id}
                    onClick={() => void review(request.id, 'reject')}
                    className="px-4 py-3 rounded-xl bg-rose-50 text-rose-700 font-semibold hover:bg-rose-100 disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    <XCircle size={18} /> Rechazar
                  </button>
                  <button
                    type="button"
                    disabled={processingId === request.id}
                    onClick={() => void review(request.id, 'approve')}
                    className="px-4 py-3 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 size={18} /> Recibido
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
};

export default Requests;
