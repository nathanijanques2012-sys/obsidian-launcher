package com.obsidian;

import java.util.ArrayDeque;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;

public class OverlayHudForge {
  private static final ArrayDeque<Long> clicks = new ArrayDeque<>();

  public static void onTick() {
    Minecraft c = Minecraft.getInstance();
    if (c.options != null && c.options.keyAttack.isDown()) {
      long now = System.currentTimeMillis();
      if (clicks.isEmpty() || now - clicks.peekLast() > 90) {
        clicks.addLast(now);
        while (!clicks.isEmpty() && now - clicks.peekFirst() > 1000) clicks.pollFirst();
      }
    }
  }

  public static int getCps() {
    long now = System.currentTimeMillis();
    while (!clicks.isEmpty() && now - clicks.peekFirst() > 1000) clicks.pollFirst();
    return clicks.size();
  }

  public static void render(GuiGraphics ctx) {
    Minecraft c = Minecraft.getInstance();
    if (c.player == null || c.options.hideGui) return;
    FriendFileForge.tick();
    int y = 8;
    ctx.drawString(c.font, "⬢ OBSIDIAN", 8, y, 0xB44DFF, true); y += 12;
    if (OverlayModForge.showFps) { ctx.drawString(c.font, "FPS: " + c.getFps(), 8, y, 0xFFFFFF, true); y += 10; }
    if (OverlayModForge.showCoords && c.player != null) {
      ctx.drawString(c.font, String.format("XYZ: %.0f / %.0f / %.0f", c.player.getX(), c.player.getY(), c.player.getZ()), 8, y, 0xAAAAAA, true); y += 10;
    }
    if (OverlayModForge.showCps) { ctx.drawString(c.font, "CPS: " + getCps(), 8, y, 0x55FF55, true); y += 10; }
    String room = FriendFileForge.room();
    if (OverlayModForge.showFriends && !room.isEmpty()) {
      ctx.drawString(c.font, "👥 " + room + " (" + FriendFileForge.members().size() + ")", 8, y, 0x55FFFF, true); y += 10;
      for (String n : FriendFileForge.members()) {
        ctx.drawString(c.font, "• " + n, 12, y, 0xDDDDDD, false); y += 9;
        if (y > 140) break;
      }
    }
    ctx.drawString(c.font, "[O] menu", 8, y, 0x666666, false);
  }
}
