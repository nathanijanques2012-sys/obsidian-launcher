package com.obsidian;

import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;

public class OverlayScreenForge extends Screen {
  public OverlayScreenForge() { super(Component.literal("Obsidian Menu")); }

  private void tog(String text, java.util.function.BooleanSupplier get, Runnable flip, int y) {
    addRenderableWidget(new RoundedButton(width / 2 - 100, y, 200, 20,
      Component.literal(text + ": " + (get.getAsBoolean() ? "ON" : "OFF")),
      b -> { flip.run(); b.setMessage(Component.literal(text + ": " + (get.getAsBoolean() ? "ON" : "OFF"))); }));
  }

  @Override
  protected void init() {
    tog("FPS", () -> OverlayModForge.showFps, () -> OverlayModForge.showFps = !OverlayModForge.showFps, height / 2 - 50);
    tog("Coords", () -> OverlayModForge.showCoords, () -> OverlayModForge.showCoords = !OverlayModForge.showCoords, height / 2 - 25);
    tog("CPS", () -> OverlayModForge.showCps, () -> OverlayModForge.showCps = !OverlayModForge.showCps, height / 2);
    tog("Amigos", () -> OverlayModForge.showFriends, () -> OverlayModForge.showFriends = !OverlayModForge.showFriends, height / 2 + 25);
    addRenderableWidget(new RoundedButton(width / 2 - 100, height / 2 + 50, 200, 20,
      Component.literal("Fechar"), b -> onClose()));
  }

  @Override
  public void render(GuiGraphics ctx, int mouseX, int mouseY, float delta) {
    renderPanorama(ctx, delta);
    ctx.fill(0, 0, width, height, 0x88000000);
    int cx = width / 2, cw = 240, ch = 190, x0 = cx - cw / 2, y0 = height / 2 - 105;
    GuiDraw.rounded(ctx, x0, y0, x0 + cw, y0 + ch, 16, 0xDD141926);
    GuiDraw.roundedOutline(ctx, x0, y0, x0 + cw, y0 + ch, 16, 0xFF7C3AED);
    ctx.drawCenteredString(font, "⬢ OBSIDIAN", cx, y0 + 14, 0xB44DFF);
    String room = FriendFileForge.room();
    if (!room.isEmpty()) ctx.drawCenteredString(font, "👥 " + room, cx, y0 + 30, 0x55FFFF);
    super.render(ctx, mouseX, mouseY, delta);
  }
}
