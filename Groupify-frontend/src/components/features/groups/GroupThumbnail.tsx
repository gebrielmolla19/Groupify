import { useMemo } from "react";
import { cn } from "../../ui/utils";

interface GroupThumbnailProps {
    groupId: string;
    groupName: string;
    className?: string;
}

// Vibrant color palettes for the "inspo" look
const PALETTES = [
    ["#3B82F6", "#8B5CF6", "#EC4899"], // Blue, Purple, Pink
    ["#F59E0B", "#EF4444", "#EC4899"], // Amber, Red, Pink
    ["#10B981", "#3B82F6", "#6366F1"], // Emerald, Blue, Indigo
    ["#8B5CF6", "#EC4899", "#F43F5E"], // Purple, Pink, Rose
    ["#06B6D4", "#3B82F6", "#8B5CF6"], // Cyan, Blue, Purple
    ["#F97316", "#F59E0B", "#EAB308"], // Orange, Amber, Yellow
    ["#EC4899", "#8B5CF6", "#6366F1"], // Pink, Purple, Indigo
    ["#14B8A6", "#06B6D4", "#3B82F6"], // Teal, Cyan, Blue
];

// Simple seeded random number generator
const seededRandom = (seed: number) => {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
};

export default function GroupThumbnail({ groupId, groupName, className }: GroupThumbnailProps) {
    const art = useMemo(() => {
        // Convert groupId to a numeric seed
        let seed = 0;
        for (let i = 0; i < groupId.length; i++) {
            seed = groupId.charCodeAt(i) + ((seed << 5) - seed);
        }

        // Select palette
        const paletteIndex = Math.floor(Math.abs(seededRandom(seed)) * PALETTES.length);
        const palette = PALETTES[paletteIndex];

        // Generate shapes with DISTINCT colors
        // We shuffle the palette deterministically to ensure variety but avoid duplicates
        const shuffledPalette = [...palette].sort((a, _) => seededRandom(seed + a.length) - 0.5);

        const shapes = [0, 1, 2].map((i) => {
            const s = seed + i * 100; // Offset seed for each shape
            return {
                color: shuffledPalette[i % shuffledPalette.length], // Ensure distinct colors
                x: seededRandom(s + 1) * 100, // 0-100%
                y: seededRandom(s + 2) * 100, // 0-100%
                size: 50 + seededRandom(s + 3) * 100, // 50-150%
                opacity: 0.5 + seededRandom(s + 4) * 0.5, // 0.5-1.0
            };
        });

        // Background Gradient
        // Use the first and last colors of the original palette for a smooth base
        const bgGradient = `linear-gradient(135deg, ${palette[0]}, ${palette[palette.length - 1]})`;

        return { bgGradient, shapes };
    }, [groupId]);

    return (
        <div className={cn("relative w-full h-full overflow-hidden", className)} style={{ background: art.bgGradient }}>
            {/* Abstract Shapes */}
            {art.shapes.map((shape, i) => (
                <div
                    key={i}
                    className="absolute rounded-full mix-blend-overlay blur-3xl"
                    style={{
                        backgroundColor: shape.color,
                        left: `${shape.x}%`,
                        top: `${shape.y}%`,
                        width: `${shape.size}%`,
                        height: `${shape.size}%`, // Keep it circular-ish relative to container, or just use %
                        transform: 'translate(-50%, -50%)',
                        opacity: shape.opacity,
                    }}
                />
            ))}


        </div>
    );
}
