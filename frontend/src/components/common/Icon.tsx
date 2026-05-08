import React from "react";

export type IconName =
  | "dashboard"
  | "upload"
  | "chat"
  | "cards"
  | "quiz"
  | "moon"
  | "sun"
  | "monitor"
  | "logout"
  | "refresh"
  | "file"
  | "spark"
  | "plus"
  | "chevron"
  | "mic"
  | "send"
  | "user"
  | "settings"
  | "trend";

export function Icon({ name, style, className }: { name: IconName; style?: React.CSSProperties; className?: string }) {
  const stroke = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  return (
    <svg 
      aria-hidden="true" 
      style={style} 
      className={className} 
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
    >
      {name === "dashboard" ? (
        <>
          <rect x="3" y="3" width="7" height="7" rx="1" {...stroke} />
          <rect x="14" y="3" width="7" height="7" rx="1" {...stroke} />
          <rect x="14" y="14" width="7" height="7" rx="1" {...stroke} />
          <rect x="3" y="14" width="7" height="7" rx="1" {...stroke} />
        </>
      ) : null}
      {name === "upload" ? (
        <>
          <path d="M12 15V4.5" {...stroke} />
          <path d="M8 8.5L12 4.5L16 8.5" {...stroke} />
          <path d="M4 16.5V18.5C4 19.6 4.9 20.5 6 20.5H18C19.1 20.5 20 19.6 20 18.5V16.5" {...stroke} />
        </>
      ) : null}
      {name === "chat" ? (
        <>
          <path d="M12 3.5C7.3 3.5 3.5 6.9 3.5 11.1C3.5 13.2 4.5 15 6.1 16.2L5.2 20.5L9.3 18.3C10.2 18.5 11.1 18.6 12 18.6C16.7 18.6 20.5 15.2 20.5 11.1C20.5 7 16.7 3.5 12 3.5Z" {...stroke} />
          <path d="M8.5 10.5H15.5" {...stroke} />
          <path d="M8.5 13.5H13.5" {...stroke} />
        </>
      ) : null}
      {name === "cards" ? (
        <>
          <rect x="5" y="6" width="12" height="10" rx="2" {...stroke} />
          <path d="M8 3.5H18.5C19.6 3.5 20.5 4.4 20.5 5.5V14" {...stroke} />
          <path d="M8 10.5H14" {...stroke} />
        </>
      ) : null}
      {name === "quiz" ? (
        <>
          <path d="M8.5 7.5H18.5" {...stroke} />
          <path d="M8.5 12H18.5" {...stroke} />
          <path d="M8.5 16.5H13.5" {...stroke} />
          <circle cx="5.5" cy="7.5" r="1.25" {...stroke} />
          <circle cx="5.5" cy="12" r="1.25" {...stroke} />
          <circle cx="5.5" cy="16.5" r="1.25" {...stroke} />
        </>
      ) : null}
      {name === "moon" ? (
        <path d="M16.5 4.2C15.8 4 15.1 3.9 14.3 3.9C9.8 3.9 6.1 7.6 6.1 12.1C6.1 16.6 9.8 20.3 14.3 20.3C17.9 20.3 21 18 22 14.8C21.2 15 20.5 15.1 19.7 15.1C15.2 15.1 11.5 11.4 11.5 6.9C11.5 5.9 11.7 5 12 4.2" {...stroke} />
      ) : null}
      {name === "sun" ? (
        <>
          <circle cx="12" cy="12" r="4" {...stroke} />
          <path d="M12 2.75V5" {...stroke} />
          <path d="M12 19V21.25" {...stroke} />
          <path d="M4.4 4.4L6 6" {...stroke} />
          <path d="M18 18L19.6 19.6" {...stroke} />
          <path d="M2.75 12H5" {...stroke} />
          <path d="M19 12H21.25" {...stroke} />
          <path d="M4.4 19.6L6 18" {...stroke} />
          <path d="M18 6L19.6 4.4" {...stroke} />
        </>
      ) : null}
      {name === "monitor" ? (
        <>
          <rect x="3.5" y="4.5" width="17" height="12" rx="2" {...stroke} />
          <path d="M9 20H15" {...stroke} />
          <path d="M12 16.5V20" {...stroke} />
        </>
      ) : null}
      {name === "logout" ? (
        <>
          <path d="M10 4.5H6C4.9 4.5 4 5.4 4 6.5V17.5C4 18.6 4.9 19.5 6 19.5H10" {...stroke} />
          <path d="M14.5 8.5L19 12L14.5 15.5" {...stroke} />
          <path d="M9 12H19" {...stroke} />
        </>
      ) : null}
      {name === "refresh" ? (
        <>
          <path d="M19.5 8.5C18 5.8 15.2 4 12 4C7.3 4 3.5 7.8 3.5 12.5C3.5 17.2 7.3 21 12 21C15.8 21 19 18.5 20.1 15" {...stroke} />
          <path d="M19.5 4.5V8.8H15.2" {...stroke} />
        </>
      ) : null}
      {name === "file" ? (
        <>
          <path d="M8 3.5H14.5L19 8V18.5C19 19.6 18.1 20.5 17 20.5H8C6.9 20.5 6 19.6 6 18.5V5.5C6 4.4 6.9 3.5 8 3.5Z" {...stroke} />
          <path d="M14 3.5V8.5H19" {...stroke} />
        </>
      ) : null}
      {name === "spark" ? (
        <>
          <path d="M12 3.5L13.8 8.2L18.5 10L13.8 11.8L12 16.5L10.2 11.8L5.5 10L10.2 8.2L12 3.5Z" {...stroke} />
          <path d="M18 16L18.8 18.2L21 19L18.8 19.8L18 22L17.2 19.8L15 19L17.2 18.2L18 16Z" {...stroke} />
        </>
      ) : null}
      {name === "plus" ? (
        <>
          <path d="M12 5V19" {...stroke} />
          <path d="M5 12H19" {...stroke} />
        </>
      ) : null}
      {name === "chevron" ? <path d="M7.5 10L12 14.5L16.5 10" {...stroke} /> : null}
      {name === "mic" ? (
        <>
          <path d="M12 15.5C10.3 15.5 9 14.2 9 12.5V8.5C9 6.8 10.3 5.5 12 5.5C13.7 5.5 15 6.8 15 8.5V12.5C15 14.2 13.7 15.5 12 15.5Z" {...stroke} />
          <path d="M6.5 11.5V12C6.5 15 8.9 17.5 12 17.5C15.1 17.5 17.5 15 17.5 12V11.5" {...stroke} />
          <path d="M12 17.5V20" {...stroke} />
        </>
      ) : null}
      {name === "send" ? (
        <>
          <path d="M20 4L10.5 13.5" {...stroke} />
          <path d="M20 4L14 20L10.5 13.5L4 10L20 4Z" {...stroke} />
        </>
      ) : null}
      {name === "user" ? (
        <>
          <path d="M19 21V19C19 17.9 18.1 17 17 17H7C5.9 17 5 17.9 5 19V21" {...stroke} />
          <circle cx="12" cy="7" r="4" {...stroke} />
        </>
      ) : null}
      {name === "trend" ? (
        <>
          <path d="M22 12H18L15 21L9 3L6 12H2" {...stroke} />
        </>
      ) : null}
      {name === "settings" ? (
        <>
          <circle cx="12" cy="12" r="3" {...stroke} />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" {...stroke} />
        </>
      ) : null}
    </svg>
  );
}
