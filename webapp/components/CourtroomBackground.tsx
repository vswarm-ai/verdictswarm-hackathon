'use client';

export default function CourtroomBackground() {
  return (
    <>
      {/* Base dark background */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundColor: '#0d0d0d',
          zIndex: -20,
        }}
      />

      {/* Courtroom-themed ambient overlay (no image assets) */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(800px 420px at 18% 0%, rgba(139, 92, 246, 0.18), transparent 60%),' +
            'radial-gradient(800px 420px at 82% 10%, rgba(6, 182, 212, 0.14), transparent 60%),' +
            'radial-gradient(900px 520px at 50% 100%, rgba(245, 158, 11, 0.08), transparent 62%)',
          opacity: 1,
          zIndex: -10,
        }}
      />
    </>
  );
}
