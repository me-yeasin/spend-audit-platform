type IconProps = { className?: string };

const base = {
  "aria-hidden": true,
  focusable: "false",
} as const;

export function ChevronIcon({
  className = "",
  direction = "right",
}: IconProps & { direction?: "right" | "down" }) {
  return (
    <svg
      className={`${className} ${direction === "down" ? "rotate-90" : ""}`.trim()}
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      {...base}
    >
      <path
        d="M4.5 2.75 7.75 6l-3.25 3.25"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function LockIcon({ className = "" }: IconProps) {
  return (
    <svg
      className={className}
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      {...base}
    >
      <rect
        x="2.1"
        y="5.1"
        width="7.8"
        height="6.2"
        rx="1.6"
        stroke="currentColor"
        strokeWidth="1.1"
      />
      <path
        d="M4 5.1V3.9a2 2 0 1 1 4 0v1.2"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function UploadIcon({ className = "" }: IconProps) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      {...base}
    >
      <path
        d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 15.5v2A2.5 2.5 0 0 0 6.5 20h11a2.5 2.5 0 0 0 2.5-2.5v-2"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function FileIcon({ className = "" }: IconProps) {
  return (
    <svg
      className={className}
      width="16"
      height="20"
      viewBox="0 0 16 20"
      fill="none"
      {...base}
    >
      <path
        d="M2 3.5A1.5 1.5 0 0 1 3.5 2h5.9L14 6.6v9.9A1.5 1.5 0 0 1 12.5 18h-9A1.5 1.5 0 0 1 2 16.5v-13Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path
        d="M9.4 2v3.4a1 1 0 0 0 1 1H14"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CheckIcon({ className = "" }: IconProps) {
  return (
    <svg
      className={className}
      width="11"
      height="9"
      viewBox="0 0 12 10"
      fill="none"
      {...base}
    >
      <path
        d="M1.5 5.2 4.4 8 10.5 1.8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function AlertIcon({ className = "" }: IconProps) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 20 20"
      fill="none"
      {...base}
    >
      <path
        d="M10 6v4.4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="10" cy="13.9" r="1.05" fill="currentColor" />
    </svg>
  );
}

export function SettingsIcon({ className = "" }: IconProps) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      {...base}
    >
      <path
        d="M3.5 8h7M15.5 8h5M3.5 16h3M11.5 16h9"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="13" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="9" cy="16" r="2.2" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export function SparkIcon({ className = "" }: IconProps) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      {...base}
    >
      <path
        d="M11.4 3.4c.46 4 2.26 5.8 6.26 6.26-4 .46-5.8 2.26-6.26 6.26-.46-4-2.26-5.8-6.26-6.26 4-.46 5.8-2.26 6.26-6.26Z"
        fill="currentColor"
      />
      <path
        d="M18.4 14.6c.22 1.95 1.1 2.83 3.05 3.05-1.95.22-2.83 1.1-3.05 3.05-.22-1.95-1.1-2.83-3.05-3.05 1.95-.22 2.83-1.1 3.05-3.05Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function CopyIcon({ className = "" }: IconProps) {
  return (
    <svg
      className={className}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      {...base}
    >
      <rect
        x="9"
        y="9"
        width="11"
        height="11"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function CopyIconActive({ className = "" }: IconProps) {
  return (
    <svg
      className={className}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      {...base}
    >
      <rect
        x="9"
        y="9"
        width="11"
        height="11"
        rx="2"
        fill="currentColor"
        stroke="none"
      />
      <path
        d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
