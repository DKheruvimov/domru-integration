const { isScheduleActive } = require('./dist/server.cjs');
const fs = require('fs');
const people = JSON.parse(fs.readFileSync('/app/data/people.json', 'utf8'));
const activeGuest = people.find(p => p.role !== 'resident' && isScheduleActive(p));
console.log(activeGuest ? 'TRUE' : 'FALSE');
if (activeGuest) console.log(activeGuest.name);
