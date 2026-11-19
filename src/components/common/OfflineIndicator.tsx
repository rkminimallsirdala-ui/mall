import React from 'react';
import { WifiOff } from 'lucide-react';

interface OfflineIndicatorProps {
  offline: boolean;
  pendingCount: number;
  label: string;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({
  offline,
  pendingCount,
  label,
}) => {
  if (!offline && pendingCount === 0) return null;

  return (
    <div
      role="status"
      className="fixed bottom-4 left-4 z-40 flex items-center gap-2 rounded-lg border border-amber-600/30 bg-amber-500 px-3.5 py-2 text-xs font-semibold text-slate-950 shadow-lg"
    >
      <WifiOff className="w-4 h-4 shrink-0" />
      <span>
        {offline ? label : `${pendingCount} Offline POS bill(s) Pending Sync`}
      </span>
    </div>
  );
};
