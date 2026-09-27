package com.obsidian;

import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.widget.ButtonWidget;
import net.minecraft.text.Text;

public class OverlayScreen extends Screen {
  public OverlayScreen() { super(Text.literal("Obsidian Menu")); }

  @Override
  protected void init() {
    addDrawableChild(ButtonWidget.builder(Text.literal("FPS: " + (OverlayMod.showFps ? "ON" : "OFF")),
      b -> { OverlayMod.showFps = !OverlayMod.showFps; b.setMessage(Text.literal("FPS: " + (OverlayMod.showFps ? "ON" : "OFF"))); })
      .dimensions(width / 2 - 100, height / 2 - 30, 200, 20).build());
    addDrawableChild(ButtonWidget.builder(Text.literal("Coords: " + (OverlayMod.showCoords ? "ON" : "OFF")),
      b -> { OverlayMod.showCoords = !OverlayMod.showCoords; b.setMessage(Text.literal("Coords: " + (OverlayMod.showCoords ? "ON" : "OFF"))); })
      .dimensions(width / 2 - 100, height / 2 - 5, 200, 20).build());
    addDrawableChild(ButtonWidget.builder(Text.literal("CPS: " + (OverlayMod.showCps ? "ON" : "OFF")),
      b -> { OverlayMod.showCps = !OverlayMod.showCps; b.setMessage(Text.literal("CPS: " + (OverlayMod.showCps ? "ON" : "OFF"))); })
      .dimensions(width / 2 - 100, height / 2 + 20, 200, 20).build());
    addDrawableChild(ButtonWidget.builder(Text.literal("Fechar"),
      b -> close()).dimensions(width / 2 - 100, height / 2 + 45, 200, 20).build());
  }

  @Override
  public void render(DrawContext ctx, int mouseX, int mouseY, float delta) {
    renderBackground(ctx, mouseX, mouseY, delta);
    ctx.drawCenteredTextWithShadow(textRenderer, "⬢ OBSIDIAN", width / 2, height / 2 - 60, 0xB44DFF);
    super.render(ctx, mouseX, mouseY, delta);
  }
}
