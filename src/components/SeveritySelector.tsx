/**
 * SeveritySelector — Guarded severity picker for SOS alerts.
 *
 * Confirmation rules:
 *   Standard → High:   fire immediately, no confirmation
 *   Any      → Critical: ConfirmDialog ("Escalate to Critical?")
 *   Critical → lower:  ConfirmDialog ("Downgrade severity?")
 *
 * Integer mapping (backend expects numeric enum in PUT body):
 *   Standard=0, High=1, Critical=2
 *   Caller receives the SOSSeverity string; integer conversion happens in the mutation.
 */
import { useState } from 'react';
import ConfirmDialog from './ConfirmDialog';
import type { SOSSeverity } from '../types';

interface Props {
  current: SOSSeverity;
  alertId: string;
  isPending: boolean;
  onConfirm: (newSeverity: SOSSeverity) => void;
}

const LEVELS: SOSSeverity[] = ['Standard', 'High', 'Critical'];

const LEVEL_STYLES: Record<SOSSeverity, { idle: string; active: string; dot: string }> = {
  Standard: {
    idle:   'border-yellow-600/40 text-yellow-500 hover:border-yellow-500 hover:bg-yellow-500/5',
    active: 'border-yellow-400 bg-yellow-500/15 text-yellow-300 font-bold shadow-[0_0_8px_rgba(234,179,8,0.25)]',
    dot:    'bg-yellow-400',
  },
  High: {
    idle:   'border-orange-600/40 text-orange-500 hover:border-orange-500 hover:bg-orange-500/5',
    active: 'border-orange-400 bg-orange-500/15 text-orange-300 font-bold shadow-[0_0_8px_rgba(249,115,22,0.25)]',
    dot:    'bg-orange-400',
  },
  Critical: {
    idle:   'border-red-600/40 text-red-500 hover:border-red-500 hover:bg-red-500/5',
    active: 'border-red-400 bg-red-500/15 text-red-300 font-bold shadow-[0_0_8px_rgba(239,68,68,0.3)]',
    dot:    'bg-red-400',
  },
};

type DialogMode = 'escalate-critical' | 'downgrade-from-critical' | null;

export default function SeveritySelector({ current, isPending, onConfirm }: Props) {
  const [pendingLevel, setPendingLevel] = useState<SOSSeverity | null>(null);
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);

  const handleSelect = (level: SOSSeverity) => {
    if (level === current || isPending) return;

    if (level === 'Critical') {
      // Escalating to Critical — always confirm
      setPendingLevel(level);
      setDialogMode('escalate-critical');
    } else if (current === 'Critical') {
      // Downgrading from Critical — always confirm
      setPendingLevel(level);
      setDialogMode('downgrade-from-critical');
    } else {
      // Standard ↔ High — fire immediately
      onConfirm(level);
    }
  };

  const handleConfirm = () => {
    if (pendingLevel) onConfirm(pendingLevel);
    setPendingLevel(null);
    setDialogMode(null);
  };

  const handleCancel = () => {
    setPendingLevel(null);
    setDialogMode(null);
  };

  return (
    <>
      <div className="flex gap-1.5 items-center">
        <span className="text-[10px] text-gray-600 uppercase tracking-wide mr-0.5">Severity</span>
        {LEVELS.map((level) => {
          const isActive = level === current;
          const styles = LEVEL_STYLES[level];
          return (
            <button
              key={level}
              onClick={() => handleSelect(level)}
              disabled={isPending}
              className={`
                flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border transition-all
                disabled:opacity-50 disabled:cursor-not-allowed
                ${isActive ? styles.active : styles.idle}
              `}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${styles.dot} ${isActive && level === 'Critical' ? 'animate-pulse' : ''}`} />
              {level}
            </button>
          );
        })}
      </div>

      {/* Escalate to Critical */}
      <ConfirmDialog
        open={dialogMode === 'escalate-critical'}
        title="Escalate to Critical?"
        message={
          <div className="space-y-2">
            <p>All community members will be <strong>re-alerted immediately</strong>.</p>
            <p className="text-red-400 font-medium text-xs">This overrides quiet hours on their devices. Use only for life-threatening emergencies.</p>
          </div>
        }
        confirmText="Escalate to Critical"
        danger
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />

      {/* Downgrade from Critical */}
      <ConfirmDialog
        open={dialogMode === 'downgrade-from-critical'}
        title={`Downgrade to ${pendingLevel}?`}
        message={
          <p>Downgrading severity will update all member screens and change alert priority.</p>
        }
        confirmText={`Set to ${pendingLevel}`}
        danger={false}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </>
  );
}
