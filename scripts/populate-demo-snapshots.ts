import fs from "fs";
import path from "path";
import crypto from "crypto";

const DATA_DIR = path.join(process.cwd(), "data");
const SNAPSHOTS_DIR = path.join(DATA_DIR, "snapshots");
const INDEX_FILE = path.join(DATA_DIR, "snapshots.json");

async function downloadImage(): Promise<Buffer> {
  const res = await fetch(`https://picsum.photos/640/360?random=${Math.random()}`);
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function main() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(SNAPSHOTS_DIR)) fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });

  let entries: any[] = [];
  if (fs.existsSync(INDEX_FILE)) {
    entries = JSON.parse(fs.readFileSync(INDEX_FILE, "utf-8"));
  }

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  // Generate 12 mock snapshots distributed across time
  const timestamps = [
    now - 1000 * 60 * 5, // 5 mins ago (Today)
    now - 1000 * 60 * 60 * 2, // 2 hours ago (Today)
    now - dayMs - 1000 * 60 * 60, // Yesterday
    now - dayMs * 2, // This week
    now - dayMs * 4, // This week
    now - dayMs * 10, // This month
    now - dayMs * 15, // This month
    now - dayMs * 35, // Older
    now - dayMs * 40, // Older
  ];

  console.log("Generating mock snapshots...");

  for (let i = 0; i < timestamps.length; i++) {
    const ts = timestamps[i];
    const imgBuf = await downloadImage();
    
    const id = crypto.randomUUID();
    const placeId = 1001; // Mock place
    const deviceId = 2001; // Mock device
    const fileName = `${ts}_${deviceId}_${id.substring(0, 8)}.jpg`;
    
    fs.writeFileSync(path.join(SNAPSHOTS_DIR, fileName), imgBuf);
    
    entries.push({
      id,
      timestamp: ts,
      login: "demo_user",
      placeId,
      deviceId,
      fileName
    });
    
    console.log(`Generated ${fileName}`);
  }

  fs.writeFileSync(INDEX_FILE, JSON.stringify(entries, null, 2));
  console.log("Mock snapshots generated successfully!");
}

main().catch(console.error);
