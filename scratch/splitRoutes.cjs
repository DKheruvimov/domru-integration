const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../server/routes/domruRoutes.ts');
const lines = fs.readFileSync(filePath, 'utf-8').split('\n');

const imports = lines.slice(0, 29).join('\n'); // 1-29

const sections = [
  { name: 'authRoutes.ts', start: 29, end: 153 },
  { name: 'devicesRoutes.ts', start: 153, end: 200 },
  { name: 'streamRoutes.ts', start: 200, end: 951 },
  { name: 'doorRoutes.ts', start: 951, end: 1114 },
  { name: 'eventsRoutes.ts', start: 1114, end: 1224 },
  { name: 'peopleRoutes.ts', start: 1224, end: 1286 },
];

for (const sec of sections) {
  const content = imports + '\n' + lines.slice(sec.start, sec.end).join('\n') + '\nexport default router;\n';
  fs.writeFileSync(path.join(__dirname, '../server/routes', sec.name), content);
  console.log(`Created ${sec.name} with ${sec.end - sec.start} lines of logic.`);
}

const indexContent = `import express from "express";
import authRoutes from "./authRoutes.js";
import devicesRoutes from "./devicesRoutes.js";
import streamRoutes from "./streamRoutes.js";
import doorRoutes from "./doorRoutes.js";
import eventsRoutes from "./eventsRoutes.js";
import peopleRoutes from "./peopleRoutes.js";

const router = express.Router();

router.use("/", authRoutes);
router.use("/", devicesRoutes);
router.use("/", streamRoutes);
router.use("/", doorRoutes);
router.use("/", eventsRoutes);
router.use("/", peopleRoutes);

export default router;
`;

fs.writeFileSync(path.join(__dirname, '../server/routes/domruRoutes.ts'), indexContent);
console.log('Replaced domruRoutes.ts with composed router.');
