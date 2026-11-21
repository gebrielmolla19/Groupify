import { useState } from "react";
import { Plus, UserPlus } from "lucide-react";
import { Button } from "../../ui/button";
import { Skeleton } from "../../ui/skeleton";
import CreateGroupDialog from "../groups/CreateGroupDialog";
import JoinGroupDialog from "../groups/JoinGroupDialog";
import WaitingList from "./WaitingList";
import HomeGroupCard from "./HomeGroupCard";
import { useGroups } from "../../../hooks/useGroups";
import { useUnheardShares } from "../../../hooks/useUnheardShares";
import { waitingHeadline, waitingSummary } from "../../../lib/waiting";
import { useNavigate } from "react-router-dom";

/** Shown on Home before the user is in any group. */
const HOW_IT_WORKS = [
  { title: "Share a song", text: "Search Spotify and drop a track into the group feed." },
  { title: "See who listened", text: "Every song shows who in the group has heard it." },
  { title: "Compare habits", text: "Group Dynamics shows who shares the most and who listens." },
];

export default function DashboardScreen() {
  const navigate = useNavigate();
  const { groups, isLoading, error, refetch, createGroup, joinGroupByCode } = useGroups();
  // A few of the newest on Home; the rest are a tap away in each group's Unheard filter.
  const unheard = useUnheardShares(5);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isJoinDialogOpen, setIsJoinDialogOpen] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  const handleCreateGroup = async (data: { name: string; description?: string }) => {
    const created = await createGroup(data);
    navigate(`/groups/${created._id}`);
    return created;
  };

  const handleJoinGroup = async (inviteCode: string) => {
    try {
      setIsJoining(true);
      const joinedGroup = await joinGroupByCode(inviteCode);
      navigate(`/groups/${joinedGroup._id}`);
    } finally {
      setIsJoining(false);
    }
  };

  const noGroups = !isLoading && groups.length === 0 && !error;
  const waiting = unheard.data;
  const headlineLoading = isLoading || (unheard.isLoading && !waiting);
  // Say it, then show it: the headline is about what's waiting, unless there's nowhere for it to wait.
  // Without the unheard data there's no count to claim, so stay neutral rather than say "caught up".
  // Without the groups there's nothing to vouch for either, so no count while they failed to load.
  const counts = waiting && !error && {
    total: waiting.total,
    newThisWeek: waiting.newThisWeek,
    groupCount: Object.keys(waiting.byGroup).length,
    oldestAt: waiting.oldestAt,
  };
  const headline = noGroups ? "Start your first group" : counts ? waitingHeadline(counts) : "Welcome back";
  const summary = noGroups
    ? "Groupify works in small groups. Start one and invite people, or join with a code a friend sent you."
    : counts ? waitingSummary(counts) : "";

  return (
    <>
      <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-6 md:space-y-10 md:px-8 md:py-10">
        <header>
          <div className="flex items-center gap-3">
            <p className="flex-1 font-mono text-xs uppercase tracking-[0.2em] text-quiet">Home</p>
            <Button
              variant="outline"
              className="min-h-11 shrink-0 px-2 sm:px-4"
              aria-label="Join a group"
              onClick={() => setIsJoinDialogOpen(true)}
              data-tour="join-group"
            >
              <UserPlus className="size-4" aria-hidden="true" />
              <span className="ml-2 hidden lg:block">Join Group</span>
            </Button>
            <Button
              variant={noGroups ? "outline" : "default"}
              className="min-h-11 shrink-0 px-2 sm:px-4"
              aria-label="Create new group"
              onClick={() => setIsCreateDialogOpen(true)}
              data-tour="create-group"
            >
              <Plus className="size-4" aria-hidden="true" />
              <span className="ml-2 hidden lg:block">Create New Group</span>
            </Button>
          </div>
          {headlineLoading ? (
            <>
              <Skeleton className="mt-3 h-9 w-3/4 md:h-12" />
              <Skeleton className="mt-3 h-4 w-1/2" />
            </>
          ) : (
            <>
              <h1 className="mt-2 font-display text-3xl font-extrabold leading-tight tracking-tight md:text-5xl">{headline}</h1>
              {!unheard.error && <p className="mt-2 max-w-2xl text-soft md:text-lg">{summary}</p>}
              {noGroups && (
                <div className="mt-6 flex flex-wrap gap-2">
                  <Button onClick={() => setIsCreateDialogOpen(true)}>Start a group</Button>
                  <Button variant="outline" onClick={() => setIsJoinDialogOpen(true)}>Join with a code</Button>
                </div>
              )}
            </>
          )}
        </header>

        {/* Waiting for you */}
        {unheard.error && !noGroups && (
          <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-line px-4 py-3 text-sm text-soft">
            <span className="flex-1">Couldn't load the tracks waiting for you.</span>
            <Button variant="outline" size="sm" className="min-h-11" onClick={unheard.refetch}>Try again</Button>
          </div>
        )}
        {unheard.isLoading && !waiting && !noGroups && (
          <div className="space-y-3" aria-hidden="true">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 pl-5">
                <Skeleton className="size-12 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        )}
        {waiting && waiting.shares.length > 0 && <WaitingList shares={waiting.shares} total={waiting.total} byGroup={waiting.byGroup} groups={groups} />}

        {/* Your groups */}
        {error && (
          <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-line px-4 py-3 text-sm text-soft">
            <span className="flex-1">Couldn't load your groups.</span>
            <Button variant="outline" size="sm" className="min-h-11" onClick={() => void refetch()}>Try again</Button>
          </div>
        )}

        {isLoading && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="aspect-[4/5] rounded-2xl" />
            ))}
          </div>
        )}

        {!isLoading && groups.length > 0 && (
          <section aria-labelledby="your-groups-heading">
            <h2 id="your-groups-heading" className="mb-4 text-xl font-bold md:text-2xl">Your groups</h2>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4">
              {groups.map((group) => (
                <HomeGroupCard key={group._id} group={group} unheard={waiting?.byGroup[group._id] ?? 0} />
              ))}
            </ul>
          </section>
        )}

        {noGroups && (
          <section aria-labelledby="how-it-works-heading">
            <h2 id="how-it-works-heading" className="sr-only">How Groupify works</h2>
            <ol className="grid gap-4 sm:grid-cols-3">
              {HOW_IT_WORKS.map((step, i) => (
                <li key={step.title} className="flex flex-col gap-2 rounded-2xl border border-hair bg-raised p-5">
                  <span className="font-mono text-xs text-iris" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
                  <h3 className="font-display text-xl font-extrabold tracking-tight">{step.title}</h3>
                  <p className="text-sm leading-relaxed text-soft">{step.text}</p>
                </li>
              ))}
            </ol>
          </section>
        )}
      </main>

      <CreateGroupDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onCreateGroup={handleCreateGroup}
        onJoinInstead={() => {
          setIsCreateDialogOpen(false);
          setIsJoinDialogOpen(true);
        }}
      />

      <JoinGroupDialog
        open={isJoinDialogOpen}
        onOpenChange={setIsJoinDialogOpen}
        onJoinGroup={handleJoinGroup}
        isSubmitting={isJoining}
        onCreateInstead={() => {
          setIsJoinDialogOpen(false);
          setIsCreateDialogOpen(true);
        }}
      />
    </>
  );
}
