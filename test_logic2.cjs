const fs = require('fs');

function getMskTime(now = new Date()) {
  const mskTime = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  return {
    day: mskTime.getUTCDay(),
    hours: mskTime.getUTCHours(),
    minutes: mskTime.getUTCMinutes()
  };
}

function formatTimeHHMM_MSK(date) {
  const { hours, minutes } = getMskTime(date);
  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  return `${hh}:${mm}`;
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

const now = Date.now();
const duration = 60;
const startStr = formatTimeHHMM_MSK(new Date(now));
const endStr = formatTimeHHMM_MSK(new Date(now + duration * 60 * 1000));

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

console.log("Current time:", getMskTime(new Date(now)));
console.log("Start:", startStr, "End:", endStr);
console.log("Is active:", isScheduleActive(person, new Date(now)));

