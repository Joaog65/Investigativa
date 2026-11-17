import { useEffect } from 'react';

export default function Lightbox({ photos, index, onClose, onNavigate }) {
  useEffect(() => {
    if (index === null) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowLeft' && index > 0) onNavigate(index - 1);
      if (event.key === 'ArrowRight' && index < photos.length - 1) onNavigate(index + 1);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [index, photos.length, onClose, onNavigate]);

  if (index === null || !photos[index]) return null;

  const photo = photos[index];

  return (
    <div className="lightbox" onClick={onClose}>
      <img src={photo.file_path} alt={photo.caption || ''} onClick={(event) => event.stopPropagation()} />
      {photo.caption && <div className="lightbox__caption">{photo.caption}</div>}
      {photos.length > 1 && (
        <>
          <button
            className="lightbox__nav lightbox__nav--prev"
            onClick={(event) => { event.stopPropagation(); onNavigate(index - 1); }}
            disabled={index === 0}
          >
            ‹
          </button>
          <button
            className="lightbox__nav lightbox__nav--next"
            onClick={(event) => { event.stopPropagation(); onNavigate(index + 1); }}
            disabled={index === photos.length - 1}
          >
            ›
          </button>
        </>
      )}
    </div>
  );
}
