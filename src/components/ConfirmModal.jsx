import { useEffect } from 'react';

export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  confirmTone = 'danger',
  danger,
  extraField,
  onConfirm,
  onCancel,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="modal-overlay" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}>
      <div className="modal">
        <div className="modal__header"><h3>{title}</h3></div>
        <div className="modal__body">
          {message}
          {extraField}
        </div>
        <div className="modal__actions">
          <button className="button" onClick={onCancel}>Cancelar</button>
          <button
            className={`button ${danger || confirmTone === 'danger' ? 'button--danger' : 'button--primary'}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
