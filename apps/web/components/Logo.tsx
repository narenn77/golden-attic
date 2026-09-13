export default function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Attic roofline */}
      <path d="M4 26L24 8L44 26" stroke="#B45309" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M10 22V40C10 41.1046 10.8954 42 12 42H36C37.1046 42 38 41.1046 38 40V22" stroke="#B45309" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {/* Gold coin, sitting inside the attic like a found treasure */}
      <circle cx="24" cy="30" r="7" fill="#F59E0B" stroke="#B45309" strokeWidth="2" />
      <path d="M21.3 32.4C21.3 33.5 22.3 34.3 24 34.3C25.5 34.3 26.6 33.6 26.6 32.5C26.6 31.5 25.8 31 24.3 30.7C22.5 30.3 21.5 29.8 21.5 28.7C21.5 27.7 22.5 27 24 27C25.4 27 26.3 27.6 26.5 28.6" stroke="#B45309" strokeWidth="1.3" strokeLinecap="round" fill="none" />
      <path d="M24 25.8V27M24 34.3V35.5" stroke="#B45309" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}
