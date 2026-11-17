import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../../ui/button";
import GroupCover from "../groups/GroupCover";
import type { Group } from "../../../types";
import { formatAge } from "../../../lib/formatTime";
import { logger } from "../../../utils/logger";

interface HomeGroupCardProps {
  group: Group;
  /** Shares in this group the viewer hasn't heard. */
  unheard: number;
}

/** A group on Home: its cover opens the feed; the join code copies from here. */
export default function HomeGroupCard({ group, unheard }: HomeGroupCardProps) {
  const [shownCode, setShownCode] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyCode = async () => {
    setShownCode(true);
    try {
      await navigator.clipboard.writeText(group.inviteCode);
      setCopied(true);
      toast.success("Join code copied");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      logger.error("Failed to copy join code:", err);
      toast.error("Couldn't copy the join code");
    }
  };

  const members = group.members.length;
  const age = formatAge(Date.now() - new Date(group.updatedAt).getTime());
  return (
    <li className="flex flex-col rounded-2xl border border-line bg-pane p-3">
      <Link to={`/groups/${group._id}`} className="group/card rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span className="relative block aspect-square overflow-hidden rounded-lg">
          <GroupCover groupId={group._id} />
          {unheard > 0 && (
            <span className="absolute right-2 top-2 grid min-w-7 place-items-center rounded-full bg-iris px-2 py-0.5 font-mono text-xs font-bold text-on-iris">
              {unheard}
              <span className="sr-only"> unheard</span>
            </span>
          )}
        </span>
        <span className="mt-3 block truncate font-semibold text-foreground group-hover/card:underline">{group.name}</span>
        <span className="block truncate text-sm text-soft">
          {members} {members === 1 ? "member" : "members"} · {age === "now" ? "just now" : `${age} ago`}
        </span>
      </Link>
      <Button
        variant="ghost"
        size="sm"
        className="mt-1 min-h-11 justify-start gap-2 px-0 font-mono text-xs text-soft hover:bg-transparent hover:text-foreground"
        onClick={copyCode}
        aria-label={`Copy join code for ${group.name}`}
      >
        {copied ? <Check className="size-3.5 text-iris" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
        {shownCode ? group.inviteCode : "Join code"}
      </Button>
    </li>
  );
}
