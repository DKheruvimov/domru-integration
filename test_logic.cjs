const fs = require('fs');

function getMskTime(now = new Date()) {
  const mskTime = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  return {
    day: mskTime.getUTCDay(),
    hours: mskTime.getUTCHours(),
    minutes: mskTime.getUTCMinutes()
  };
}

function isScheduleActive(person, now = new Date()) {
  if (!person.enabled) return false;

  if (person.role !== "resident") {
    if (person.opensRemaining !== undefined && person.opensRemaining !== null && person.opensRemaining <= 0) {
      return false;
    }
  }

  const { day, hours, minutes } = getMskTime(now);
  const currentMinutesSinceMidnight = hours * 60 + minutes;
  const prevDay = (day - 1 + 7) % 7;

  for (const rule of person.schedules) {
    const [startH, startM] = rule.startTime.split(":").map(Number);
    const [endH, endM] = rule.endTime.split(":").map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    const wrapsMidnight = startMinutes > endMinutes;

    if (rule.days.includes(day)) {
      if (!wrapsMidnight) {
        if (currentMinutesSinceMidnight >= startMinutes && currentMinutesSinceMidnight <= endMinutes) {
          return true;
        }
      } else {
        if (currentMinutesSinceMidnight >= startMinutes) {
          return true;
        }
      }
    }
    
    if (wrapsMidnight && rule.days.includes(prevDay)) {
      if (currentMinutesSinceMidnight <= endMinutes) {
        return true;
      }
    }
  }

  return false;
}

const now = new Date();
const duration = 60;
const startStr = "06:02"; // Let's say it's 6:02 right now in MSK
const endStr = "07:02";

const person = {
  id: "temp-1",
  role: "courier",
  enabled: true,
  opensRemaining: 1,
  schedules: [{
    id: "r1",
    days: [0,1,2,3,4,5,6],
    startTime: startStr,
    endTime: endStr
  }]
};

// Test active state
console.log("Current time:", getMskTime(now));
console.log("Is active:", isScheduleActive(person, now));
