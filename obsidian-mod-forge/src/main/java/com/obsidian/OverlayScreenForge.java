package com.obsidian;

import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;

public class OverlayScreenForge extends Screen {
  public OverlayScreenForge() { super(Component.literal("Obsidian Menu")); }

  @Override
  protected void init() {
    addRenderableWidget(Button.builder(Component.literal("FPS: " + (OverlayModForge.showFps ? "ON" : "OFF")),
      b -> { OverlayModForge.showFps = !OverlayModForge.showFps; b.setMessage(Component.literal("FPS: " + (OverlayModForge.showFps ? "ON" : "OFF"))); })
      .bounds(width / 2 - 100, height / 2 - 30, 200, 20).build());
    addRenderableWidget(Button.builder(Component.literal("Coords: " + (OverlayModForge.showCoords ? "ON" : "OFF")),
      b -> { OverlayModForge.showCoords = !OverlayModForge.showCoords; b.setMessage(Component.literal("Coords: " + (OverlayModForge.showCoords ? "ON" : "OFF"))); })
      .bounds(width / 2 - 100, height / 2 - 5, 200, 20).build());
    addRenderableWidget(Button.builder(Component.literal("CPS: " + (OverlayModForge.showCps ? "ON" : "OFF")),
      b -> { OverlayModForge.showCps = !OverlayModForge.showCps; b.setMessage(Component.literal("CPS: " + (OverlayModForge.showCps ? "ON" : "OFF"))); })
      .bounds(width / 2 - 100, height / 2 + 20, 200, 20).build());
    addRenderableWidget(Button.builder(Component.literal("Fechar"),
      b -> onClose()).bounds(width / 2 - 100, height / 2 + 45, 200, 20).build());
  }

  @Override
  public void render(GuiGraphics ctx, int mouseX, int mouseY, float delta) {
    super.render(ctx, mouseX, mouseY, delta);
    ctx.drawCenteredString(font, "⬢ OBSIDIAN", width / 2, height / 2 - 60, 0xB44DFF);
  }
}
