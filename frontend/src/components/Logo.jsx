export default function Logo({ size = 48 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Shield */}
      <path
        d="M24 4L6 11V24C6 33.4 14 41.6 24 44C34 41.6 42 33.4 42 24V11L24 4Z"
        fill="#312e81"
        stroke="#6366f1"
        strokeWidth="1.5"
      />
      {/* Hashgraph network nodes */}
      <circle cx="24" cy="18" r="2.5" fill="#a5b4fc" />
      <circle cx="15" cy="26" r="2.5" fill="#a5b4fc" />
      <circle cx="33" cy="26" r="2.5" fill="#a5b4fc" />
      <circle cx="19" cy="33" r="2.5" fill="#a5b4fc" />
      <circle cx="29" cy="33" r="2.5" fill="#a5b4fc" />
      {/* Edges */}
      <line x1="24" y1="18" x2="15" y2="26" stroke="#6366f1" strokeWidth="1" />
      <line x1="24" y1="18" x2="33" y2="26" stroke="#6366f1" strokeWidth="1" />
      <line x1="15" y1="26" x2="19" y2="33" stroke="#6366f1" strokeWidth="1" />
      <line x1="15" y1="26" x2="29" y2="33" stroke="#6366f1" strokeWidth="1" />
      <line x1="33" y1="26" x2="19" y2="33" stroke="#6366f1" strokeWidth="1" />
      <line x1="33" y1="26" x2="29" y2="33" stroke="#6366f1" strokeWidth="1" />
      <line x1="19" y1="33" x2="29" y2="33" stroke="#6366f1" strokeWidth="1" />
    </svg>
  );
}
