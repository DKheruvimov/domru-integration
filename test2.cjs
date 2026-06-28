const { getMskTime, isScheduleActive } = require('./dist/server.cjs');

const mockPerson = {
    "id": "courier",
    "name": "Курьер",
    "role": "courier",
    "enabled": true,
    "schedules": [
      {
        "id": "courier-s1",
        "days": [
          1,
          2,
          3,
          4,
          5,
          6,
          0
        ],
        "startTime": "04:00",
        "endTime": "23:00"
      }
    ],
    "maxOpens": 1,
    "opensRemaining": 1
};

const nowStr = "2026-06-28T02:54:07Z"; // 05:54 MSK, Sunday (0)
const now = new Date(nowStr);

console.log("Mock person active:", isScheduleActive(mockPerson, now));
