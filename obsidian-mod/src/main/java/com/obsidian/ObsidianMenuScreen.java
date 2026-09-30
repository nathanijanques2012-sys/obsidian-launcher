package com.obsidian;

import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.screen.multiplayer.MultiplayerScreen;
import net.minecraft.client.gui.screen.option.OptionsScreen;
import net.minecraft.client.gui.screen.world.SelectWorldScreen;
import net.minecraft.text.Text;
import net.minecraft.util.Identifier;

// Menu principal estilo CMClient: topo com logo + botoes, card central arredondado.
public class ObsidianMenuScreen extends Screen {
  private static final Identifier LOGO = Identifier.of("obsidian-overlay", "textures/gui/logo.png");

  public ObsidianMenuScreen() { super(Text.literal("Obsidian")); }

  private void btn(String text, int x, int y, int w, int h, RoundedButton.Press p) {
    addDrawableChild(new RoundedButton(x, y, w, h, Text.literal(text), p));
  }

  @Override
  protected void init() {
    MinecraftClient mc = MinecraftClient.getInstance();
    int cx = width / 2;
    int y0 = height / 2 - 105;
    btn("SINGLEPLAYER", cx - 110, y0 + 82, 220, 24, b -> mc.setScreen(new SelectWorldScreen(this)));
    btn("MULTIPLAYER", cx - 110, y0 + 112, 220, 24, b -> mc.setScreen(new MultiplayerScreen(this)));
    btn("Opções", cx - 110, y0 + 142, 107, 20, b -> mc.setScreen(new OptionsScreen(this, mc.options)));
    btn("Amigos", cx + 3, y0 + 142, 107, 20, b -> mc.setScreen(new OverlayScreen()));
    tog("FPS", 0, cx - 110, y0 + 166);
    tog("XYZ", 1, cx - 55, y0 + 166);
    tog("CPS", 2, cx + 1, y0 + 166);
    tog("AMIGOS", 3, cx + 56, y0 + 166);
    btn("⚙", width - 220, 10, 40, 24, b -> mc.setScreen(new OverlayScreen()));
    btn("👥", width - 174, 10, 40, 24, b -> mc.setScreen(new OverlayScreen()));
    btn("ⓘ", width - 128, 10, 40, 24, b -> mc.setScreen(new OverlayScreen()));
    btn("✕", width - 82, 10, 40, 24, b -> mc.scheduleStop());
  }

  private void tog(String name, int idx, int x, int y) {
    btn(label(name, idx), x, y, 51, 20, b -> {
      flip(idx);
      b.setMessage(Text.literal(label(name, idx)));
    });
  }

  private static String label(String name, int idx) {
    boolean on = idx == 0 ? OverlayMod.showFps : idx == 1 ? OverlayMod.showCoords
      : idx == 2 ? OverlayMod.showCps : OverlayMod.showFriends;
    return name + ": " + (on ? "ON" : "OFF");
  }

  private static void flip(int idx) {
    if (idx == 0) OverlayMod.showFps = !OverlayMod.showFps;
    else if (idx == 1) OverlayMod.showCoords = !OverlayMod.showCoords;
    else if (idx == 2) OverlayMod.showCps = !OverlayMod.showCps;
    else OverlayMod.showFriends = !OverlayMod.showFriends;
  }

  @Override
  public void render(DrawContext ctx, int mouseX, int mouseY, float delta) {
    renderPanoramaBackground(ctx, delta);
    ctx.fill(0, 0, width, height, 0x88000000);
    ctx.drawText(textRenderer, "⬢ Obsidian", 14, 16, 0xB44DFF, true);
    String room = FriendFile.room();
    if (OverlayMod.showFriends && !room.isEmpty()) {
      int rw = textRenderer.getWidth("👥 " + room) + 16;
      GuiDraw.rounded(ctx, width - rw - 14, 38, width - 14, 58, 9, 0xAA2A1650);
      ctx.drawText(textRenderer, "👥 " + room, width - rw - 6, 44, 0x55FFFF, true);
    }
    int cx = width / 2, cw = 260, ch = 240, x0 = cx - cw / 2, y0 = height / 2 - 105;
    GuiDraw.rounded(ctx, x0, y0, x0 + cw, y0 + ch, 16, 0xDD141926);
    GuiDraw.roundedOutline(ctx, x0, y0, x0 + cw, y0 + ch, 16, 0xFF7C3AED);
    GuiDraw.roundedOutline(ctx, x0 + 2, y0 + 2, x0 + cw - 2, y0 + ch - 2, 14, 0x447C3AED);
    ctx.drawTexture(LOGO, cx - 18, y0 + 8, 0, 0, 36, 36, 36, 36);
    ctx.drawCenteredTextWithShadow(textRenderer, "OBSIDIAN", cx, y0 + 48, 0xFFFFFF);
    ctx.drawCenteredTextWithShadow(textRenderer, "launcher edition", cx, y0 + 60, 0xA855F7);
    if (OverlayMod.showFriends && !FriendFile.members().isEmpty()) {
      ctx.drawCenteredTextWithShadow(textRenderer, FriendFile.members().size() + " amigo(s) online", cx, y0 + 58, 0x55FF55);
    }
    super.render(ctx, mouseX, mouseY, delta);
    MinecraftClient c = MinecraftClient.getInstance();
    ctx.drawText(textRenderer, c.getGameVersion() + " (Obsidian Overlay)", 10, height - 20, 0x888888, false);
  }

  @Override
  public boolean shouldCloseOnEsc() { return false; }
}
