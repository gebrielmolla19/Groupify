const mongoose = require('mongoose');
const AnalyticsService = require('../src/services/analyticsService');
const User = require('../src/models/User');
const Group = require('../src/models/Group');
const Share = require('../src/models/Share');

describe('AnalyticsService', () => {
    let user1, user2, user3;
    let group;

    beforeEach(async () => {
        // Create Users (Mock Spotify IDs)
        user1 = await User.create({
            spotifyId: 'user1', displayName: 'Alice',
            spotifyAccessToken: 'token', spotifyRefreshToken: 'refresh', tokenExpiresAt: new Date()
        });
        user2 = await User.create({
            spotifyId: 'user2', displayName: 'Bob',
            spotifyAccessToken: 'token', spotifyRefreshToken: 'refresh', tokenExpiresAt: new Date()
        });
        user3 = await User.create({
            spotifyId: 'user3', displayName: 'Charlie',
            spotifyAccessToken: 'token', spotifyRefreshToken: 'refresh', tokenExpiresAt: new Date()
        });

        // Create Group
        group = await Group.create({
            name: 'Test Group',
            createdBy: user1._id,
            members: [user1._id, user2._id, user3._id], // Charlie is inactive (no shares)
            inviteCode: 'TESTCODE'
        });

        // Create Shares
        const now = new Date();
        const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);

        // Alice shares 2 songs, gets likes
        await Share.create({
            group: group._id, sharedBy: user1._id,
            spotifyTrackId: 't1', trackName: 'Song 1', artistName: 'Artist A',
            likeCount: 5, createdAt: now,
            likes: [{ user: user2._id, likedAt: now }, { user: user3._id, likedAt: now }]
        });
        await Share.create({
            group: group._id, sharedBy: user1._id,
            spotifyTrackId: 't2', trackName: 'Song 2', artistName: 'Artist A',
            likeCount: 1, createdAt: yesterday
        });

        // Bob shares 1 song, gets lots of likes (Trendsetter potential if Alice didn't have 6 total)
        // Check Trendsetter logic: Most Likes Received.
        // Alice: 5 + 1 = 6.
        // Bob needs 7 to beat Alice.
        await Share.create({
            group: group._id, sharedBy: user2._id,
            spotifyTrackId: 't3', trackName: 'Song 3', artistName: 'Artist B',
            likeCount: 7, createdAt: now
        });

        // Alice listens to Bob's song (Diehard potential)
        // Wait, listeners is an array in Share
        // Let's make user1 listen to user2's song
        await Share.updateOne(
            { spotifyTrackId: 't3' },
            { $push: { listeners: { user: user1._id, listenedAt: now } } }
        );
        // Alice gives a like to Bob's song (Hype Man potential)
        await Share.updateOne(
            { spotifyTrackId: 't3' },
            { $push: { likes: { user: user1._id, likedAt: now } } }
        );
    });

    it('should calculate group activity correctly', async () => {
        const activity = await AnalyticsService.getGroupActivity(group._id, '7d');
        expect(activity).toBeDefined();
        expect(Array.isArray(activity)).toBe(true);
        // Expect at least 1 or 2 buckets depending on time differences
        expect(activity.length).toBeGreaterThan(0);

        const totalShares = activity.reduce((sum, item) => sum + item.shares, 0);
        expect(totalShares).toBe(3); // 2 from Alice + 1 from Bob
    });

    it('should calculate member vibes correctly (Radar Chart)', async () => {
        const vibes = await AnalyticsService.getMemberVibes(group._id);
        expect(vibes).toHaveLength(3);

        const alice = vibes.find(s => s.userId.equals(user1._id));
        const bob = vibes.find(s => s.userId.equals(user2._id));
        const charlie = vibes.find(s => s.userId.equals(user3._id));

        // 1. Activity (Shares)
        // Alice: 2 shares (Max), Score 100
        // Bob: 1 share, Score 50
        expect(alice.stats.activity).toBe(100);
        expect(bob.stats.activity).toBe(50);
        expect(charlie.stats.activity).toBe(0);

        // 2. Popularity (Avg Likes Received)
        // Alice: (5 + 1) / 2 = 3.0 avg
        // Bob: 7 / 1 = 7.0 avg (Max)
        // Alice Score: (3/7)*100 = 43
        expect(bob.stats.popularity).toBe(100);
        expect(alice.stats.popularity).toBe(43);

        // 3. Support (Likes Given)
        // Alice gave 1 like to Bob.
        // Bob gave 1 like to Alice (Song 2).
        // Max Support = ? Setup says:
        // Alice shares: Song 1 (Likes: User2, User3), Song 2 (Like: User?) - wait setup said "likeCount: 1". 
        // Need to check specific likes setup.
        // Setup:
        // Song 1 (Alice): Likes [User2, User3]
        // Song 2 (Alice): Likes [] (Wait, I didn't push to array in setup, just set count?)
        // Song 3 (Bob): Likes [User1] (Added via updateOne)

        // Use Share.create for Song 2 didn't add array items, so aggregations on 'likes' array might miss it if logic relies on array.
        // My Service logic relies on unwinding `$likes`.
        // Song 1: User2 liked, User3 liked.
        // Song 3: User1 liked.
        // User1 gave 1 like (to Song 3).
        // User2 gave 1 like (to Song 1).
        // User3 gave 1 like (to Song 1).
        // All gave 1 like. Max is 1. All should score 100.
        expect(alice.stats.support).toBe(100);
        expect(bob.stats.support).toBe(100);

        // 4. Variety (Unique Artists)
        // Alice: Artist A (x2) -> 1 unique
        // Bob: Artist B -> 1 unique
        // Max 1. Both 100.
        expect(alice.stats.variety).toBe(100);
        expect(bob.stats.variety).toBe(100);

        // 5. Freshness
        // Both shared "now" or "yesterday". 
        // Alice: Today (Song 1), Yesterday (Song 2). Max is Today. 
        // Bob: Today (Song 3).
        // Diff is 0 days. Score 100.
        expect(alice.stats.freshness).toBe(100);
        expect(bob.stats.freshness).toBe(100);
        expect(charlie.stats.freshness).toBe(0);
    });

    it('should calculate superlatives correctly', async () => {
        const hallOfFame = await AnalyticsService.getSuperlatives(group._id);

        // 1. The Trendsetter (Most likes Received)
        // Alice: 6, Bob: 7. Winner: Bob.
        expect(hallOfFame.trendsetter).toBeDefined();
        expect(hallOfFame.trendsetter.user._id.toString()).toBe(user2._id.toString());

        // 2. The DJ (Most Shares)
        // Alice: 2, Bob: 1. Winner: Alice.
        expect(hallOfFame.dj).toBeDefined();
        expect(hallOfFame.dj.user._id.toString()).toBe(user1._id.toString());

        // 3. The Hype Man (Most Likes Given)
        // Alice liked Bob's song. Bob didn't like anything (in setup above, only Alice's song has likes from user2/user3).
        // Wait, Alice's song 1 has likes from user2 and user3.
        // Alice gave 1 like to Bob's song.
        // Bob gave 1 like to Alice's song 1.
        // user3 gave 1 like to Alice's song 1.
        // It's a tie? Or depends on sort.
        // Let's make user3 give another like to break tie if needed, but user3 has 0 shares.
        // Let's assume defined behavior or just check it exists.
        expect(hallOfFame.hypeMan).toBeDefined();

        // 4. Diehard (Most Listens)
        // Alice listened to Bob's song.
        expect(hallOfFame.diehard).toBeDefined();
        expect(hallOfFame.diehard.user._id.toString()).toBe(user1._id.toString());
    });
});
