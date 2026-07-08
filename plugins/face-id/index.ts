import type { PluginAPI } from "../../server/plugin-manager.js";

export default async function init(api: PluginAPI) {
  // Register capability so the frontend knows to show Face ID UI
  api.registerCapability("FACE_RECOGNITION");

  // Hook into person load to add `hasFacePhoto` flag to UI
  api.onPersonLoad(async (people) => {
    const photos = await api.storage.getAll();
    return people.map((p) => {
      if (photos[p.id]) {
        return { ...p, hasFacePhoto: true };
      }
      return p;
    });
  });

  // Upload photo endpoint
  api.router.post("/image/:personId", async (req, res) => {
    try {
      const { personId } = req.params;
      const { base64Data } = req.body;
      if (!base64Data) {
        return res.status(400).json({ error: "No base64Data provided" });
      }
      
      // Store photo in plugin storage
      await api.storage.set(personId, base64Data);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Delete photo endpoint
  api.router.delete("/image/:personId", async (req, res) => {
    try {
      const { personId } = req.params;
      await api.storage.delete(personId);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get photo endpoint
  api.router.get("/image/:personId", async (req, res) => {
    try {
      const { personId } = req.params;
      const data = await api.storage.get(personId);
      if (!data || typeof data !== "string") {
        return res.status(404).send("Photo not found");
      }
      
      // Parse data URL format: data:image/jpeg;base64,....
      const matches = data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        const buffer = Buffer.from(matches[2], "base64");
        res.type(matches[1]);
        res.send(buffer);
      } else {
        // Fallback
        res.send(data);
      }
    } catch (err: any) {
      res.status(500).send(err.message);
    }
  });
}
