package com.obsidian;

import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.gui.screens.multiplayer.JoinMultiplayerScreen;
import net.minecraft.client.gui.screens.options.controls.KeyBindsScreen;
import net.minecraft.client.gui.screens.options.LanguageSelectScreen;
import net.minecraft.client.gui.screens.options.SkinCustomizationScreen;
import net.minecraft.client.gui.screens.options.VideoSettingsScreen;
import net.minecraft.client.gui.screens.worldselection.SelectWorldScreen;
import net.minecraft.network.chat.Component;
import net.minecraftforge.client.gui.ModListScreen;

// Menu principal estilo CMClient: topo com logo + botoes, card central arredondado.
public class ObsidianMenuScreenForge extends Screen {
  public ObsidianMenuScreenForge() { super(Component.literal("Obsidian")); }

  private RoundedButton btn(String text, int x, int y, int w, int h, RoundedButton.Press p) {
    RoundedButton b = new RoundedButton(x, y, w, h, Component.literal(text), p);
    addRenderableWidget(b);
    return b;
  }

  @Override
  protected void init() {
    Minecraft mc = Minecraft.getInstance();
    int cx = width / 2;
    int y0 = height / 2 - 125;
    btn("SINGLEPLAYER", cx - 110, y0 + 78, 220, 24, b -> mc.setScreen(new SelectWorldScreen(this)));
    btn("MULTIPLAYER", cx - 110, y0 + 106, 220, 24, b -> mc.setScreen(new JoinMultiplayerScreen(this)));
    btn("Vídeo", cx - 110, y0 + 134, 107, 20, b -> mc.setScreen(new VideoSettingsScreen(this, mc, mc.options)));
    btn("Controles", cx + 3, y0 + 134, 107, 20, b -> mc.setScreen(new KeyBindsScreen(this, mc.options)));
    btn("Idioma", cx - 110, y0 + 158, 107, 20, b -> mc.setScreen(new LanguageSelectScreen(this, mc.options, mc.getLanguageManager())));
    btn("Skin", cx + 3, y0 + 158, 107, 20, b -> mc.setScreen(new SkinCustomizationScreen(this, mc.options)));
    btn("Mods", cx - 110, y0 + 182, 107, 20, b -> mc.setScreen(new ModListScreen(this)));
    btn("Opções", cx + 3, y0 + 182, 107, 20, b -> mc.setScreen(new net.minecraft.client.gui.screens.options.OptionsScreen(this, mc.options)));
    tog("FPS", 0, cx - 110, y0 + 206);
    tog("XYZ", 1, cx - 55, y0 + 206);
    tog("CPS", 2, cx + 1, y0 + 206);
    tog("AMIGOS", 3, cx + 56, y0 + 206);
    btn("⚙", width - 220, 10, 40, 24, b -> mc.setScreen(new OverlayScreenForge()));
    btn("🧩", width - 174, 10, 40, 24, b -> mc.setScreen(new ModListScreen(this)));
    btn("ⓘ", width - 128, 10, 40, 24, b -> mc.setScreen(new OverlayScreenForge()));
    btn("✕", width - 82, 10, 40, 24, b -> mc.stop());
  }

  private void tog(String name, int idx, int x, int y) {
    btn(label(name, idx), x, y, 51, 20, b -> {
      flip(idx);
      b.setMessage(Component.literal(label(name, idx)));
    });
  }

  private static String label(String name, int idx) {
    boolean on = idx == 0 ? OverlayModForge.showFps : idx == 1 ? OverlayModForge.showCoords
      : idx == 2 ? OverlayModForge.showCps : OverlayModForge.showFriends;
    return name + ": " + (on ? "ON" : "OFF");
  }

  private static void flip(int idx) {
    if (idx == 0) OverlayModForge.showFps = !OverlayModForge.showFps;
    else if (idx == 1) OverlayModForge.showCoords = !OverlayModForge.showCoords;
    else if (idx == 2) OverlayModForge.showCps = !OverlayModForge.showCps;
    else OverlayModForge.showFriends = !OverlayModForge.showFriends;
  }

  @Override
  public void render(GuiGraphics ctx, int mouseX, int mouseY, float delta) {
    renderPanorama(ctx, delta);
    ctx.fill(0, 0, width, height, 0x88000000);
    ctx.drawString(font, "⬢ Obsidian", 14, 16, 0xB44DFF, true);
    String room = FriendFileForge.room();
    if (OverlayModForge.showFriends && !room.isEmpty()) {
      int rw = font.width("👥 " + room) + 16;
      GuiDraw.rounded(ctx, width - rw - 14, 38, width - 14, 58, 9, 0xAA2A1650);
      ctx.drawString(font, "👥 " + room, width - rw - 6, 44, 0x55FFFF, true);
    }
    int cx = width / 2, cw = 260, ch = 270, x0 = cx - cw / 2, y0 = height / 2 - 125;
    GuiDraw.rounded(ctx, x0, y0, x0 + cw, y0 + ch, 16, 0xDD141926);
    GuiDraw.roundedOutline(ctx, x0, y0, x0 + cw, y0 + ch, 16, 0xFF7C3AED);
    ctx.drawCenteredString(font, "⬢", cx, y0 + 16, 0xB44DFF);
    ctx.drawCenteredString(font, "OBSIDIAN", cx, y0 + 38, 0xFFFFFF);
    if (OverlayModForge.showFriends && !FriendFileForge.members().isEmpty()) {
      ctx.drawCenteredString(font, FriendFileForge.members().size() + " amigo(s) online", cx, y0 + 56, 0x55FF55);
    }
    super.render(ctx, mouseX, mouseY, delta);
    Minecraft c = Minecraft.getInstance();
    ctx.drawString(font, c.getLaunchedVersion() + " (Obsidian Overlay)", 10, height - 20, 0x888888, false);
  }

  @Override
  public boolean shouldCloseOnEsc() { return false; }
}
