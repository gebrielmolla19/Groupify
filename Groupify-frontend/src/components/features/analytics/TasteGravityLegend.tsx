export default function TasteGravityLegend() {
  return (
    <div className="pointer-events-none">
      <div className="flex flex-col gap-2 bg-raised/90 backdrop-blur-sm rounded-lg border border-hair px-3 py-2.5">
        {/* Node Size Section */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            {/* Small circle */}
            <div
              className="rounded-full border"
              style={{
                width: '12px',
                height: '12px',
                borderColor: 'var(--line)',
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
                borderColor: 'var(--line)',
                borderWidth: '1px',
                backgroundColor: 'transparent',
              }}
            />
          </div>
          <span className="text-[10px] text-quiet ml-1">Listening mass</span>
        </div>

        {/* Link Strength Section */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            {/* Thin line */}
            <div
              style={{
                width: '16px',
                height: '1px',
                backgroundColor: 'var(--text-quiet)',
              }}
            />
            {/* Thick bright line */}
            <div
              style={{
                width: '16px',
                height: '3px',
                backgroundColor: 'var(--text-soft)',
              }}
            />
          </div>
          <span className="text-[10px] text-quiet ml-1">Taste gravity</span>
        </div>

        {/* Selection Section */}
        <div className="flex items-center gap-2">
          <div className="relative flex items-center justify-center">
            {/* Circle with the selected ring */}
            <div
              className="rounded-full relative border"
              style={{
                width: '18px',
                height: '18px',
                borderColor: 'var(--text)',
                borderWidth: '2px',
                backgroundColor: 'transparent',
              }}
            >
            </div>
          </div>
          <span className="text-[10px] text-quiet ml-1">Selected member</span>
        </div>
      </div>
    </div>
  );
}

