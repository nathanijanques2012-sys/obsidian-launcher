package com.obsidian;

import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.screen.multiplayer.MultiplayerScreen;
import net.minecraft.client.gui.screen.world.SelectWorldScreen;
import net.minecraft.client.gui.widget.ButtonWidget;
import net.minecraft.text.Text;

// Menu principal estilo CMClient: topo com logo + botoes, card central, versao embaixo.
public class ObsidianMenuScreen extends Screen {
  private final Screen parent;

  public ObsidianMenuScreen() { this(null); }
  public ObsidianMenuScreen(Screen parent) { super(Text.literal("Obsidian")); this.parent = parent; }

  @Override
  protected void init() {
    int cx = width / 2;
    // Card central
    addDrawableChild(ButtonWidget.builder(Text.literal("SINGLEPLAYER"),
      b -> client.setScreen(new SelectWorldScreen(this)))
      .dimensions(cx - 110, height / 2 - 8, 220, 24).build());
    addDrawableChild(ButtonWidget.builder(Text.literal("MULTIPLAYER"),
      b -> client.setScreen(new MultiplayerScreen(this)))
      .dimensions(cx - 110, height / 2 + 22, 220, 24).build());
    // Topo direita: settings / mods(info) / fechar
    addDrawableChild(ButtonWidget.builder(Text.literal("⚙"),
      b -> client.setScreen(new OverlayScreen()))
      .dimensions(width - 220, 10, 40, 24).build());
    addDrawableChild(ButtonWidget.builder(Text.literal("🧩"),
      b -> client.setScreen(new OverlayScreen()))
      .dimensions(width - 174, 10, 40, 24).build());
    addDrawableChild(ButtonWidget.builder(Text.literal("ⓘ"),
      b -> client.setScreen(new OverlayScreen()))
      .dimensions(width - 128, 10, 40, 24).build());
    addDrawableChild(ButtonWidget.builder(Text.literal("✕"),
      b -> client.scheduleStop())
      .dimensions(width - 82, 10, 40, 24).build());
  }

  @Override
  public void render(DrawContext ctx, int mouseX, int mouseY, float delta) {
    renderPanoramaBackground(ctx, delta);
    ctx.fill(0, 0, width, height, 0x88000000);
    // Topo esquerda: logo
    ctx.drawText(textRenderer, "⬢ Obsidian", 14, 16, 0xB44DFF, true);
    // Card central translucido
    int cx = width / 2, cw = 260, ch = 170, x0 = cx - cw / 2, y0 = height / 2 - 90;
    ctx.fill(x0, y0, x0 + cw, y0 + ch, 0xAA141926);
    ctx.drawCenteredTextWithShadow(textRenderer, "⬢", cx, y0 + 22, 0xB44DFF);
    ctx.drawCenteredTextWithShadow(textRenderer, "OBSIDIAN", cx, y0 + 44, 0xFFFFFF);
    super.render(ctx, mouseX, mouseY, delta);
    // Versao canto inferior esquerdo
    MinecraftClient c = MinecraftClient.getInstance();
    String ver = c.getGameVersion() + " (Obsidian Overlay)";
    ctx.drawText(textRenderer, ver, 10, height - 20, 0x888888, false);
  }

  @Override
  public boolean shouldCloseOnEsc() { return false; }
}
