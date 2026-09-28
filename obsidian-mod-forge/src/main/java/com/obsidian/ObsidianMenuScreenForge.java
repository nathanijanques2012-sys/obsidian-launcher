package com.obsidian;

import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.gui.screens.multiplayer.JoinMultiplayerScreen;
import net.minecraft.client.gui.screens.worldselection.SelectWorldScreen;
import net.minecraft.network.chat.Component;

// Menu principal estilo CMClient: topo com logo + botoes, card central.
public class ObsidianMenuScreenForge extends Screen {
  public ObsidianMenuScreenForge() { super(Component.literal("Obsidian")); }

  @Override
  protected void init() {
    int cx = width / 2;
    addRenderableWidget(Button.builder(Component.literal("SINGLEPLAYER"),
      b -> minecraft.setScreen(new SelectWorldScreen(this)))
      .bounds(cx - 110, height / 2 - 8, 220, 24).build());
    addRenderableWidget(Button.builder(Component.literal("MULTIPLAYER"),
      b -> minecraft.setScreen(new JoinMultiplayerScreen(this)))
      .bounds(cx - 110, height / 2 + 22, 220, 24).build());
    addRenderableWidget(Button.builder(Component.literal("⚙"),
      b -> minecraft.setScreen(new OverlayScreenForge()))
      .bounds(width - 220, 10, 40, 24).build());
    addRenderableWidget(Button.builder(Component.literal("🧩"),
      b -> minecraft.setScreen(new OverlayScreenForge()))
      .bounds(width - 174, 10, 40, 24).build());
    addRenderableWidget(Button.builder(Component.literal("ⓘ"),
      b -> minecraft.setScreen(new OverlayScreenForge()))
      .bounds(width - 128, 10, 40, 24).build());
    addRenderableWidget(Button.builder(Component.literal("✕"),
      b -> minecraft.stop())
      .bounds(width - 82, 10, 40, 24).build());
  }

  @Override
  public void render(GuiGraphics ctx, int mouseX, int mouseY, float delta) {
    super.render(ctx, mouseX, mouseY, delta);
    ctx.drawString(font, "⬢ Obsidian", 14, 16, 0xB44DFF, true);
    int cx = width / 2, cw = 260, ch = 170, x0 = cx - cw / 2, y0 = height / 2 - 90;
    ctx.fill(x0, y0, x0 + cw, y0 + ch, 0xAA141926);
    ctx.drawCenteredString(font, "⬢", cx, y0 + 22, 0xB44DFF);
    ctx.drawCenteredString(font, "OBSIDIAN", cx, y0 + 44, 0xFFFFFF);
    String ver = minecraft.getLaunchedVersion() + " (Obsidian Overlay)";
    ctx.drawString(font, ver, 10, height - 20, 0x888888, false);
  }

  @Override
  public boolean shouldCloseOnEsc() { return false; }
}
