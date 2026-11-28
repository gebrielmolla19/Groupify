import { Avatar, AvatarFallback, AvatarImage } from '../../ui/avatar';
import { cn } from '../../../lib/utils';
import { superlativeHeadline, superlativeValue, type SuperlativeKind } from '../../../lib/groupChartsCopy';

interface SuperlativeCardProps {
    kind: SuperlativeKind;
    title: string;
    user: {
        _id?: string;
        displayName: string;
        profileImage?: string;
    };
    value: number;
    /** The signed-in member holds this title: their number is in iris. */
    isViewer: boolean;
}

/** One Hall of Fame title: who holds it, said in a sentence, then the number. */
export default function SuperlativeCard({ kind, title, user, value, isViewer }: SuperlativeCardProps) {
    return (
        <div className="flex min-w-0 flex-col gap-3 rounded-2xl border border-hair bg-raised p-4 md:p-5">
            <p className="text-sm text-soft">{title}</p>
            <div className="flex min-w-0 items-center gap-3">
                <Avatar className={cn('size-11 shrink-0', isViewer && 'ring-2 ring-iris ring-offset-2 ring-offset-raised')}>
                    <AvatarImage src={user.profileImage} alt="" />
                    <AvatarFallback className="bg-selected text-sm font-semibold text-soft">
                        {user.displayName.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                </Avatar>
                <p className="min-w-0 text-base font-medium text-foreground">
                    {superlativeHeadline(kind, isViewer ? null : user.displayName)}
                </p>
            </div>
            <p className="mt-auto flex items-baseline gap-2">
                <span className={cn('font-display text-3xl font-semibold', isViewer ? 'text-iris' : 'text-foreground')}>
                    {value}
                </span>
                <span className="text-sm text-soft">{superlativeValue(kind, value)}</span>
            </p>
        </div>
    );
}
