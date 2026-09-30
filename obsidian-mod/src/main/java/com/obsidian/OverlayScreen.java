package com.obsidian;

import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.text.Text;

public class OverlayScreen extends Screen {
  public OverlayScreen() { super(Text.literal("Obsidian Menu")); }

  private void tog(String text, java.util.function.BooleanSupplier get, Runnable flip, int y) {
    addDrawableChild(new RoundedButton(width / 2 - 100, y, 200, 20,
      Text.literal(text + ": " + (get.getAsBoolean() ? "ON" : "OFF")),
      b -> { flip.run(); b.setMessage(Text.literal(text + ": " + (get.getAsBoolean() ? "ON" : "OFF"))); }));
  }

  @Override
  protected void init() {
    tog("FPS", () -> OverlayMod.showFps, () -> OverlayMod.showFps = !OverlayMod.showFps, height / 2 - 50);
    tog("Coords", () -> OverlayMod.showCoords, () -> OverlayMod.showCoords = !OverlayMod.showCoords, height / 2 - 25);
    tog("CPS", () -> OverlayMod.showCps, () -> OverlayMod.showCps = !OverlayMod.showCps, height / 2);
    tog("Amigos", () -> OverlayMod.showFriends, () -> OverlayMod.showFriends = !OverlayMod.showFriends, height / 2 + 25);
    addDrawableChild(new RoundedButton(width / 2 - 100, height / 2 + 50, 200, 20,
      Text.literal("Fechar"), b -> close()));
  }

  @Override
  public void render(DrawContext ctx, int mouseX, int mouseY, float delta) {
    renderBackground(ctx, mouseX, mouseY, delta);
    int cx = width / 2, cw = 240, ch = 190, x0 = cx - cw / 2, y0 = height / 2 - 105;
    GuiDraw.rounded(ctx, x0, y0, x0 + cw, y0 + ch, 16, 0xDD141926);
    GuiDraw.roundedOutline(ctx, x0, y0, x0 + cw, y0 + ch, 16, 0xFF7C3AED);
    ctx.drawCenteredTextWithShadow(textRenderer, "⬢ OBSIDIAN", cx, y0 + 14, 0xB44DFF);
    String room = FriendFile.room();
    if (!room.isEmpty()) ctx.drawCenteredTextWithShadow(textRenderer, "👥 " + room, cx, y0 + 30, 0x55FFFF);
    super.render(ctx, mouseX, mouseY, delta);
  }
}
