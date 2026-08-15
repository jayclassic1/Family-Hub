// Single-image mode: pass `src` (backward compatible with all existing callers).
// Collection mode: also pass `images` (array of URLs) and `index` (current
// position) plus `onNavigate(newIndex)` to enable prev/next arrows.
export default function Lightbox({ src, alt, onClose, images, index, onNavigate }) {
  if (!src) return null;

  const hasCollection = Array.isArray(images) && images.length > 1 && typeof index === "number" && onNavigate;

  const goPrev = (e) => {
    e.stopPropagation();
    if (!hasCollection) return;
    const newIndex = (index - 1 + images.length) % images.length;
    onNavigate(newIndex);
  };

  const goNext = (e) => {
    e.stopPropagation();
    if (!hasCollection) return;
    const newIndex = (index + 1) % images.length;
    onNavigate(newIndex);
  };

  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <button className="lightbox-close" onClick={onClose}>Close</button>
      {hasCollection && (
        <button className="lightbox-arrow lightbox-arrow-left" onClick={goPrev} title="Previous photo">
          ‹
        </button>
      )}
      <img
        src={src}
        alt={alt || "Photo"}
        className="lightbox-image"
        onClick={(e) => e.stopPropagation()}
      />
      {hasCollection && (
        <button className="lightbox-arrow lightbox-arrow-right" onClick={goNext} title="Next photo">
          ›
        </button>
      )}
      {hasCollection && (
        <div className="lightbox-counter">{index + 1} / {images.length}</div>
      )}
    </div>
  );
}
