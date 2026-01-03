export default function TasteGravityLegend() {
  return (
    <div className="absolute top-4 right-4 z-20 pointer-events-none">
      <div className="flex flex-col gap-3 bg-black/60 backdrop-blur-sm rounded-lg border border-white/5 px-3 py-2.5">
        {/* Node Size Section */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            {/* Small circle - neutral outline */}
            <div
              className="rounded-full border"
              style={{
                width: '8px',
                height: '8px',
                borderColor: 'rgba(255,255,255,0.14)',
                borderWidth: '1px',
                backgroundColor: 'transparent',
              }}
            />
            {/* Medium circle - neutral outline */}
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
            {/* Large circle - neutral outline */}
            <div
              className="rounded-full border"
              style={{
                width: '16px',
                height: '16px',
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
            {/* Thin line - electric cyan (base) */}
            <div
              style={{
                width: '20px',
                height: '2px',
                backgroundColor: 'rgba(56,189,248,0.35)',
                opacity: 0.25,
              }}
            />
            {/* Medium line - electric cyan (medium gravity) */}
            <div
              style={{
                width: '20px',
                height: '3px',
                backgroundColor: 'rgba(56,189,248,0.35)',
                opacity: 0.45,
              }}
            />
            {/* Thick bright line - violet for strong connections */}
            <div
              style={{
                width: '20px',
                height: '4px',
                backgroundColor: 'rgba(167,139,250,0.55)',
                opacity: 0.6,
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
                width: '16px',
                height: '16px',
                borderColor: '#38BDF8',
                borderWidth: '3px',
                backgroundColor: 'transparent',
                boxShadow: '0 0 16px rgba(56, 189, 248, 0.45)',
              }}
            >
              {/* Inner ring for polish */}
              <div
                className="absolute rounded-full"
                style={{
                  width: '12px',
                  height: '12px',
                  border: '1px solid rgba(255,255,255,0.25)',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                }}
              />
            </div>
          </div>
          <span className="text-[10px] text-[#9CA3AF] ml-1">Selected member</span>
        </div>
      </div>
    </div>
  );
}

