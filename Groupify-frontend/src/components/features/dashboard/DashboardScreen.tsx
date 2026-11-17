import { useState } from "react";
import { Plus, UserPlus } from "lucide-react";
import { Card, CardContent } from "../../ui/card";
import { Button } from "../../ui/button";
import { Skeleton } from "../../ui/skeleton";
import CreateGroupDialog from "../groups/CreateGroupDialog";
import JoinGroupDialog from "../groups/JoinGroupDialog";
import NotificationsDropdown from "../notifications/NotificationsDropdown";
import WaitingList from "./WaitingList";
import HomeGroupCard from "./HomeGroupCard";
import { useGroups } from "../../../hooks/useGroups";
import { useUnheardShares } from "../../../hooks/useUnheardShares";
import { waitingHeadline, waitingSummary } from "../../../lib/waiting";
import { useNavigate } from "react-router-dom";

export default function DashboardScreen() {
  const navigate = useNavigate();
  const { groups, isLoading, error, createGroup, joinGroupByCode } = useGroups();
  const unheard = useUnheardShares();
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
  const headline = noGroups ? "Start a group" : waitingHeadline(waiting?.total ?? 0);
  const summary = noGroups
    ? "Groups are where friends share tracks. Create one, or join with a code."
    : waiting
      ? waitingSummary({ total: waiting.total, groupCount: Object.keys(waiting.byGroup).length, oldestAt: waiting.oldestAt })
      : "";

  return (
    <>
      <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-6 md:space-y-10 md:px-8 md:py-10">
        <header>
          <div className="flex items-center gap-3">
            <p className="flex-1 font-mono text-xs uppercase tracking-[0.2em] text-quiet">Home</p>
            <NotificationsDropdown />
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
              {/* An unheard-shares error leaves the headline at zero; the section below says what went wrong. */}
              {!unheard.error && <p className="mt-2 text-soft md:text-lg">{summary}</p>}
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
        {waiting && waiting.shares.length > 0 && <WaitingList shares={waiting.shares} total={waiting.total} />}

        {/* Your groups */}
        {error && (
          <Card className="border-destructive">
            <CardContent className="p-6">
              <p className="text-destructive">{error}</p>
            </CardContent>
          </Card>
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
          <Card
            className="cursor-pointer border-2 border-dashed border-border transition-colors hover:border-primary/50"
            onClick={() => setIsCreateDialogOpen(true)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setIsCreateDialogOpen(true);
              }
            }}
            aria-label="Create your first group"
          >
            <CardContent className="flex flex-col items-center justify-center px-4 py-8 text-center md:py-12">
              <div className="mb-3 rounded-full border border-primary/30 bg-primary/10 p-3 md:mb-4 md:p-4" aria-hidden="true">
                <Plus className="size-6 text-primary md:size-8" />
              </div>
              <h3 className="mb-2 text-base md:text-lg">Create Your First Group</h3>
              <p className="mb-4 max-w-md text-sm text-muted-foreground md:text-base">
                Start sharing music with friends, discover new tracks together,
                and compete on the leaderboard
              </p>
              <Button
                variant="outline"
                className="min-h-11"
                aria-label="Get started creating a group"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsCreateDialogOpen(true);
                }}
              >
                Get Started
              </Button>
            </CardContent>
          </Card>
        )}
      </main>

      <CreateGroupDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onCreateGroup={handleCreateGroup}
      />

      <JoinGroupDialog
        open={isJoinDialogOpen}
        onOpenChange={setIsJoinDialogOpen}
        onJoinGroup={handleJoinGroup}
        isSubmitting={isJoining}
      />
    </>
  );
}
