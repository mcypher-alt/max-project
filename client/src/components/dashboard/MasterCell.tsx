import { useState, useRef, useEffect, FC } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { dictApi, ticketsApi } from '../../api';
import { User, Ticket } from '../../types';

interface MasterCellProps {
  ticket: Ticket;
}

export const MasterCell: FC<MasterCellProps> = ({ ticket }) => {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, bottom: 0, left: 0, width: 0, isDropUp: false });

  const buttonRef = useRef<HTMLButtonElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        buttonRef.current &&
        !buttonRef.current.contains(target) &&
        portalRef.current &&
        !portalRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    const handleScroll = (event: Event) => {
      if (portalRef.current && portalRef.current.contains(event.target as Node)) {
        return;
      }
      setIsOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [isOpen]);

  const { data: masters = [], isLoading } = useQuery({
    queryKey: ['masters', ticket.companyId],
    queryFn: async () => {
      const res = await dictApi.getMasters(ticket.companyId);
      return Array.isArray(res) ? res : ((res as any)?.users || (res as any)?.data || []);
    },
  });

  const assignMutation = useMutation({
    mutationFn: (masterId: number) => ticketsApi.assignMaster({ ticketId: ticket.id, masterId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      setIsOpen(false);
    },
    onError: (err: any) => {
      const message =
        err.response?.data?.error || err.response?.data?.message || 'Не удалось назначить мастера';
      toast.error(message);
    },
  });

  const toggleDropdown = () => {
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const isDropUp = spaceBelow < 260 && rect.top > 260;

      setCoords({
        left: rect.left,
        width: rect.width,
        top: rect.top,
        bottom: rect.bottom,
        isDropUp,
      });
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  if (ticket.status === 'completed') {
    if (ticket.masterId) {
      const assignedMaster = masters.find((m: User) => m.id === ticket.masterId);
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm font-medium">
          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
          {assignedMaster ? assignedMaster.name : `Мастер #${ticket.masterId}`}
        </span>
      );
    }
    return <span className="text-gray-400 italic text-xs">Закрыта (без мастера)</span>;
  }

  const currentMaster = masters.find((m: User) => m.id === ticket.masterId);

  return (
    <div className="relative w-full max-w-55">
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleDropdown}
        disabled={assignMutation.isPending || isLoading}
        className={`flex items-center justify-between w-full px-3 py-2 text-sm transition-all duration-200 border rounded-xl shadow-sm outline-none focus:ring-2 focus:ring-blue-500/20 ${
          ticket.masterId
            ? 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white hover:border-gray-300 dark:hover:border-gray-600'
            : 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 animate-pulse hover:bg-red-100 dark:hover:bg-red-900/20'
        } ${isOpen ? 'ring-2 ring-blue-500/20 border-blue-400 dark:border-blue-500' : ''}`}
      >
        <div className="flex items-center gap-2 truncate">
          <svg
            className={`w-4 h-4 shrink-0 ${ticket.masterId ? 'text-gray-400' : 'text-red-400'}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
          <span className="font-medium truncate">
            {isLoading ? 'Загрузка...' : currentMaster ? currentMaster.name : 'Назначить...'}
          </span>
        </div>

        <svg
          className={`w-4 h-4 shrink-0 text-gray-400 transition-transform duration-200 ${
            isOpen ? (coords.isDropUp ? 'rotate-0' : 'rotate-180') : coords.isDropUp ? 'rotate-180' : ''
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={portalRef}
            style={{
              position: 'fixed',
              left: `${coords.left}px`,
              width: `${coords.width}px`,
              ...(coords.isDropUp
                ? { bottom: `${window.innerHeight - coords.top + 8}px` }
                : { top: `${coords.bottom + 8}px` }),
            }}
            className={`z-9999 bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl border border-gray-100 dark:border-gray-700 rounded-xl shadow-2xl overflow-hidden ${
              coords.isDropUp ? 'origin-bottom' : 'origin-top'
            }`}
          >
            <div className="p-1.5 max-h-60 overflow-y-auto">
              {masters.length === 0 && (
                <div className="px-3 py-4 text-sm text-center text-gray-500 dark:text-gray-400">
                  Мастера не найдены
                </div>
              )}

              {masters.map((m: User) => {
                const isSelected = ticket.masterId === m.id;

                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => assignMutation.mutate(Number(m.id))}
                    className={`flex items-center justify-between w-full px-3 py-2.5 text-sm transition-all rounded-lg group ${
                      isSelected
                        ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 font-medium'
                        : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}
                  >
                    <div className="flex flex-col items-start truncate">
                      <span className="truncate">{m.name}</span>
                      <span
                        className={`text-[10px] mt-0.5 ${
                          isSelected ? 'text-blue-500/70 dark:text-blue-400/70' : 'text-gray-400 dark:text-gray-500'
                        }`}
                      >
                        ID: {m.id}
                      </span>
                    </div>

                    {isSelected && (
                      <svg
                        className="w-4 h-4 shrink-0 text-blue-600 dark:text-blue-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2.5}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};