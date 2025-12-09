import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '../../ui/avatar';
import { cn } from '../../ui/utils';
import { Badge } from '../../ui/badge';

interface SuperlativeCardProps {
    title: string;
    description: string;
    icon: string;
    user: {
        displayName: string;
        profileImage?: string;
    };
    value: string | number;
    label?: string;
    gradient?: string;
    delay?: number;
}

export default function SuperlativeCard({
    title,
    description,
    icon,
    user,
    value,
    label,
    gradient = "from-primary/20 to-primary/5",
    delay = 0
}: SuperlativeCardProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay }}
            whileHover={{ y: -5, scale: 1.02 }}
        >
            <Card className={cn(
                "overflow-hidden border-white/10 backdrop-blur-sm relative group",
                "bg-gradient-to-br", gradient
            )}>
                {/* Holographic Shine Effect */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 bg-gradient-to-tr from-transparent via-white/5 to-transparent skew-x-12 translate-x-[-100%] group-hover:translate-x-[100%]" />

                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                        <span className="text-2xl">{icon}</span>
                        {title}
                    </CardTitle>
                    <Badge variant="secondary" className="bg-black/30 text-xs">
                        {label || 'Top Member'}
                    </Badge>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-4 mt-2">
                        <div className="relative">
                            <Avatar className="w-16 h-16 border-2 border-white/20 shadow-lg group-hover:border-primary/50 transition-colors">
                                <AvatarImage src={user.profileImage} />
                                <AvatarFallback className="bg-primary/20 text-primary text-xl font-bold">
                                    {user.displayName.substring(0, 2).toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                            <div className="absolute -bottom-2 -right-2 bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5 rounded-full shadow-lg">
                                #1
                            </div>
                        </div>

                        <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-lg truncate text-foreground/90">
                                {user.displayName}
                            </h3>
                            <p className="text-sm text-muted-foreground line-clamp-1 mb-1">
                                {description}
                            </p>
                            <div className="inline-flex items-center px-2 py-1 rounded bg-white/5 border border-white/5">
                                <span className="font-mono font-bold text-primary mr-2">{value}</span>
                                <span className="text-xs text-muted-foreground uppercase tracking-wider">Total</span>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    );
}
