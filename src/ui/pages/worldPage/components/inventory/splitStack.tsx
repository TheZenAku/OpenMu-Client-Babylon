import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Item } from '../../../../../ecs/world';
import { MUIdle } from '../../../../../muidle/state';
import { mt } from '../../../../../muidle/text';
import { itemDisplayName } from '../../../../../common/itemTooltip';
import { stackCount } from '../../../../../common/itemStacks';

export type SplitRequest = { slot: number; item: Item };

/**
 * Split pieces off a stack (Shift + click on it in the inventory, D28): how many to take, half by
 * default; the server moves them to a free square as a stack of their own.
 */
export const SplitStackDialog = ({ request, onClose }: { request: SplitRequest; onClose: () => void }) => {
  const pieces = stackCount(request.item);
  const max = pieces - 1;
  const [amount, setAmount] = useState(Math.max(1, Math.floor(pieces / 2)));
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    input.current?.select();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const valid = amount >= 1 && amount <= max;
  const confirm = () => {
    if (!valid) return;
    MUIdle.splitStack(request.slot, amount);
    onClose();
  };

  return createPortal(
    <div className="muidle-backdrop split-stack-backdrop" onPointerDown={e => e.target === e.currentTarget && onClose()}>
      <form
        className="muidle-panel split-stack"
        role="dialog"
        aria-label={mt('split.title')}
        onSubmit={e => {
          e.preventDefault();
          confirm();
        }}
      >
        <h2>{mt('split.title')}</h2>
        <p className="split-stack-item">
          {itemDisplayName(request.item)} · <strong>{pieces}</strong>
        </p>
        <label className="split-stack-amount">
          <span>{mt('split.amount', { max })}</span>
          <input
            ref={input}
            type="number"
            min={1}
            max={max}
            value={amount}
            onChange={e => setAmount(Math.floor(Number(e.target.value)))}
          />
        </label>
        <input
          type="range"
          min={1}
          max={max}
          value={Math.min(Math.max(amount, 1), max)}
          onChange={e => setAmount(Number(e.target.value))}
        />
        <div className="muidle-actions">
          <button type="submit" className="muidle-primary" disabled={!valid}>
            {mt('split.confirm')}
          </button>
          <button type="button" onClick={onClose}>
            {mt('close')}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
};
