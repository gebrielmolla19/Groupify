export default function TasteGravityLegend() {
  return (
    <div className="pointer-events-none">
      <div className="flex flex-col gap-2 bg-black/60 backdrop-blur-sm rounded-lg border border-white/5 px-3 py-2.5">
        {/* Node Size Section */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            {/* Small circle */}
            <div
              className="rounded-full border"
              style={{
                width: '12px',
                height: '12px',
                borderColor: 'rgba(255,255,255,0.14)',
                borderWidth: '1px',
                backgroundColor: 'transparent',
              }}
            />
            {/* Large circle */}
            <div
              className="rounded-full border"
              style={{
                width: '20px',
                height: '20px',
                borderColor: 'rgba(255,255,255,0.14)',
                borderWidth: '1px',
                backgroundColor: 'transparent',
              }}
            />
          </div>
          <span className="text-[10px] text-[#9CA3AF] ml-1">Listening mass</span>
        </div>

        {/* Link Strength Section */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            {/* Thin line */}
            <div
              style={{
                width: '16px',
                height: '1px',
                backgroundColor: 'rgba(56,189,248,0.35)',
                opacity: 0.3,
              }}
            />
            {/* Thick bright line */}
            <div
              style={{
                width: '16px',
                height: '3px',
                backgroundColor: 'rgba(167,139,250,0.55)',
                opacity: 0.8,
              }}
            />
          </div>
          <span className="text-[10px] text-[#9CA3AF] ml-1">Taste gravity</span>
        </div>

        {/* Selection Section */}
        <div className="flex items-center gap-2">
          <div className="relative flex items-center justify-center">
            {/* Circle with electric cyan glow ring */}
            <div
              className="rounded-full relative border"
              style={{
                width: '18px',
                height: '18px',
                borderColor: '#38BDF8',
                borderWidth: '2px',
                backgroundColor: 'transparent',
                boxShadow: '0 0 12px rgba(56, 189, 248, 0.45)',
              }}
            >
            </div>
          </div>
          <span className="text-[10px] text-[#9CA3AF] ml-1">Selected member</span>
        </div>
      </div>
    </div>
  );
}

