export function ThumbsUpIcon({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M7 11v9H4a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h3Zm2 9h9.28a2 2 0 0 0 1.95-1.57l1.4-6.28A2 2 0 0 0 19.68 10H14V5a2 2 0 0 0-2-2h-.28L9 8.5V20Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function ThumbsDownIcon({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M17 13V4h3a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-3Zm-2-9H5.72a2 2 0 0 0-1.95 1.57l-1.4 6.28A2 2 0 0 0 4.32 14H10v5a2 2 0 0 0 2 2h.28L15 15.5V4Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function HeartIcon({ size = 15, filled = true }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M12 21s-7.5-4.6-10.2-9.3C.2 8.9 1.3 5.4 4.6 4.3c2.2-.7 4.4.1 5.9 2C11 5 12 5 12 5s1-.1 1.5 1.3c1.5-1.9 3.7-2.7 5.9-2 3.3 1.1 4.4 4.6 2.8 7.4C19.5 16.4 12 21 12 21Z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={filled ? 0 : 1.6}
      />
    </svg>
  );
}
