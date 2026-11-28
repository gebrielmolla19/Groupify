const AnalyticsService = require('../src/services/analyticsService');

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe('AnalyticsService.listenTiming', () => {
  it('counts nothing for no listens', () => {
    expect(AnalyticsService.listenTiming([])).toEqual({
      sameHour: 0,
      sameDay: 0,
      withinWeek: 0,
      later: 0
    });
  });

  it('puts each time to listen in exactly one bucket', () => {
    const times = [
      5 * MINUTE, 59 * MINUTE, // same hour
      HOUR, 23 * HOUR, // same day
      DAY, 6 * DAY, // within the week
      7 * DAY, 40 * DAY // later
    ];
    expect(AnalyticsService.listenTiming(times)).toEqual({
      sameHour: 2,
      sameDay: 2,
      withinWeek: 2,
      later: 2
    });
  });

  it('ignores missing or negative times', () => {
    expect(AnalyticsService.listenTiming([null, undefined, -1, 0, 2 * DAY])).toEqual({
      sameHour: 1,
      sameDay: 0,
      withinWeek: 1,
      later: 0
    });
  });
});
