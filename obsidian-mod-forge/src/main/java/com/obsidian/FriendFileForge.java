package com.obsidian;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import net.minecraft.client.Minecraft;

// Mesmo contrato do Fabric: o launcher escreve <gameDir>/obsidian/friends.json
// {"room":"ABC123","members":["Nath","Pai"],"at":123456789}
public class FriendFileForge {
  private static long lastRead = 0;
  private static String room = "";
  private static final List<String> members = new ArrayList<>();

  public static synchronized void tick() {
    long now = System.currentTimeMillis();
    if (now - lastRead < 2000) return;
    lastRead = now;
    try {
      Path p = Minecraft.getInstance().gameDirectory.toPath().resolve("obsidian/friends.json");
      if (!Files.exists(p)) { room = ""; members.clear(); return; }
      JsonObject j = JsonParser.parseString(Files.readString(p)).getAsJsonObject();
      room = j.has("room") ? j.get("room").getAsString() : "";
      members.clear();
      if (j.has("members")) {
        JsonArray a = j.getAsJsonArray("members");
        for (int i = 0; i < a.size() && i < 8; i++) members.add(a.get(i).getAsString());
      }
    } catch (Exception e) {}
  }

  public static String room() { return room; }
  public static List<String> members() { return new ArrayList<>(members); }
}
