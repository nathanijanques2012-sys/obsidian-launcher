package com.obsidian;

import net.fabricmc.fabric.api.client.rendering.v1.HudRenderCallback;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.render.RenderTickCounter;
import java.util.ArrayDeque;

public class OverlayHud implements HudRenderCallback {
  private static final ArrayDeque<Long> clicks = new ArrayDeque<>();

  public static void onTick() {
    // Conta clique esquerdo para CPS
    MinecraftClient c = MinecraftClient.getInstance();
    if (c.options != null && c.options.attackKey.isPressed()) {
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

  @Override
  public void onHudRender(DrawContext ctx, RenderTickCounter tickCounter) {
    MinecraftClient c = MinecraftClient.getInstance();
    if (c.player == null || c.options.hudHidden) return;
    int y = 8;
    ctx.drawText(c.textRenderer, "⬢ OBSIDIAN", 8, y, 0xB44DFF, true); y += 12;
    if (OverlayMod.showFps) { ctx.drawText(c.textRenderer, "FPS: " + c.getCurrentFps(), 8, y, 0xFFFFFF, true); y += 10; }
    if (OverlayMod.showCoords && c.player != null) {
      ctx.drawText(c.textRenderer, String.format("XYZ: %.0f / %.0f / %.0f", c.player.getX(), c.player.getY(), c.player.getZ()), 8, y, 0xAAAAAA, true); y += 10;
    }
    if (OverlayMod.showCps) { ctx.drawText(c.textRenderer, "CPS: " + getCps(), 8, y, 0x55FF55, true); y += 10; }
    // Amigos da sala (launcher espelha em obsidian/friends.json)
    String room = FriendFile.room();
    if (OverlayMod.showFriends && !room.isEmpty()) {
      ctx.drawText(c.textRenderer, "👥 " + room + " (" + FriendFile.members().size() + ")", 8, y, 0x55FFFF, true); y += 10;
      for (String n : FriendFile.members()) {
        ctx.drawText(c.textRenderer, "• " + n, 12, y, 0xDDDDDD, false); y += 9;
        if (y > 140) break;
      }
    }
    ctx.drawText(c.textRenderer, "[O] menu", 8, y, 0x666666, false);
  }
}
