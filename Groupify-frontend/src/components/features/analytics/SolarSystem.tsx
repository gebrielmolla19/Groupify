import { motion } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '../../ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../ui/tooltip';
import { useMemo } from 'react';

interface MemberStat {
    userId: string;
    displayName: string;
    profileImage: string | null;
    planetSize: number; // calculated from total shares/likes
    orbitDistance: number; // calculated from recency
    lastActive: string | null;
}

interface SolarSystemProps {
    members: MemberStat[];
    isLoading?: boolean;
}

export default function SolarSystem({ members, isLoading }: SolarSystemProps) {
    // Process members to assign optimized orbit tracks
    // We want to distribute them so they don't overlap too much
    const planets = useMemo(() => {
        if (!members) return [];

        // Sort by orbit distance (recency)
        // Closer (smaller distance) = inner orbits
        // -1 distance means inactive/far
        return [...members]
            .sort((a, b) => {
                if (a.orbitDistance === -1) return 1;
                if (b.orbitDistance === -1) return -1;
                return a.orbitDistance - b.orbitDistance;
            })
            .map((m, i) => {
                // Map raw data to visual properties
                // Base size 30px, max +30px based on activity
                const size = 30 + Math.min(m.planetSize * 2, 40);

                // Duration: faster if active recently? Or just varied for visual interest.
                // Let's make inner planets orbit faster.
                // Base 10s, add 5s per 'layer'
                const duration = 10 + (i * 2.5);

                // Track radius: Start at 60px, expand outwards
                const radius = 60 + (i * 45);

                // Random starting angle
                const startAngle = Math.random() * 360;

                return {
                    ...m,
                    visual: { size, duration, radius, startAngle }
                };
            });
    }, [members]);

    if (isLoading) {
        return (
            <div className="w-full aspect-square flex items-center justify-center bg-black/20 rounded-full animate-pulse border border-white/5">
                <div className="w-16 h-16 bg-primary/20 rounded-full blur-xl" />
            </div>
        );
    }

    return (
        <div className="relative w-full aspect-square max-w-[500px] mx-auto flex items-center justify-center overflow-hidden rounded-full bg-black/40 border border-white/5 shadow-2xl backdrop-blur-sm">
            {/* Background Stars - specific static implementation for simplicity */}
            <div className="absolute inset-0 opacity-30">
                {[...Array(20)].map((_, i) => (
                    <div
                        key={i}
                        className="absolute rounded-full bg-white"
                        style={{
                            width: Math.random() * 2 + 1 + 'px',
                            height: Math.random() * 2 + 1 + 'px',
                            top: Math.random() * 100 + '%',
                            left: Math.random() * 100 + '%',
                            opacity: Math.random()
                        }}
                    />
                ))}
            </div>

            {/* The Sun (Group) */}
            <div className="absolute z-10 w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center shadow-[0_0_50px_color-mix(in_oklab,var(--primary),transparent_50%)] animate-pulse">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-primary-foreground flex items-center justify-center shadow-lg">
                    <span className="text-2xl">☀️</span>
                </div>
            </div>

            {/* Planetary Orbits and Planets */}
            <TooltipProvider>
                {planets.map((planet) => (
                    <div
                        key={planet.userId}
                        className="absolute rounded-full border border-white/5"
                        style={{
                            width: planet.visual.radius * 2,
                            height: planet.visual.radius * 2,
                        }}
                    >
                        {/* The Planet Container implementing the rotation */}
                        <motion.div
                            className="absolute w-full h-full"
                            initial={{ rotate: planet.visual.startAngle }}
                            animate={{ rotate: planet.visual.startAngle + 360 }}
                            transition={{
                                duration: planet.visual.duration,
                                repeat: Infinity,
                                ease: "linear"
                            }}
                        >
                            {/* The Planet itself - counter-rotate to keep avatar upright if desired, 
                  but for spherical avatars rotation is fine/cool */}
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div
                                        className="absolute -top-[50%] left-1/2 -ml-[var(--half-size)] transform translate-y-[-50%]"
                                        style={{
                                            width: planet.visual.size,
                                            height: planet.visual.size,
                                            top: 0,
                                            // Custom property for half-size to center
                                            ['--half-size' as any]: `${planet.visual.size / 2}px`
                                        }}
                                    >
                                        <motion.div
                                            // Counter-rotate if we want faces upright
                                            animate={{ rotate: -(planet.visual.startAngle + 360) }}
                                            transition={{ duration: planet.visual.duration, repeat: Infinity, ease: "linear" }}
                                            className="w-full h-full"
                                        >
                                            <Avatar className="w-full h-full border-2 border-primary/50 shadow-[0_0_15px_rgba(0,0,0,0.5)]">
                                                <AvatarImage src={planet.profileImage || undefined} />
                                                <AvatarFallback className="text-[10px] bg-primary/20 text-primary">
                                                    {planet.displayName.substring(0, 2).toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>
                                        </motion.div>

                                    </div>
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                    <div className="text-center">
                                        <p className="font-bold text-primary">{planet.displayName}</p>
                                        <p className="text-xs text-muted-foreground">Influence: {Math.floor(planet.planetSize)}</p>
                                    </div>
                                </TooltipContent>
                            </Tooltip>
                        </motion.div>
                    </div>
                ))}
            </TooltipProvider>
        </div>
    );
}
