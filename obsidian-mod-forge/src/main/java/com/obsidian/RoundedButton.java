package com.obsidian;

import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.AbstractWidget;
import net.minecraft.client.gui.narration.NarrationElementOutput;
import net.minecraft.network.chat.Component;

// Botão redondo no tema Obsidian
public class RoundedButton extends AbstractWidget {
  public interface Press { void onPress(RoundedButton b); }
  private final Press onPress;

  public RoundedButton(int x, int y, int w, int h, Component msg, Press onPress) {
    super(x, y, w, h, msg);
    this.onPress = onPress;
  }

  @Override
  public void renderWidget(GuiGraphics g, int mouseX, int mouseY, float delta) {
    boolean hov = isHoveredOrFocused() && active;
    int bg = !active ? 0xFF33333F : hov ? 0xFF8B5CF6 : 0xFF5B21B6;
    GuiDraw.rounded(g, getX(), getY(), getX() + width, getY() + height, 9, bg);
    if (hov) GuiDraw.roundedOutline(g, getX(), getY(), getX() + width, getY() + height, 9, 0xFFE9D5FF);
    g.drawCenteredString(Minecraft.getInstance().font, getMessage(),
      getX() + width / 2, getY() + (height - 8) / 2, active ? 0xFFFFFF : 0xA0A0A0);
  }

  @Override
  public void onClick(double mouseX, double mouseY) {
    if (active && onPress != null) onPress.onPress(this);
  }

  @Override
  protected void updateWidgetNarration(NarrationElementOutput out) {
    defaultButtonNarrationText(out);
  }
}
