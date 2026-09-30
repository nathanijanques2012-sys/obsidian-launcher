package com.obsidian;

import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.narration.NarrationMessageBuilder;
import net.minecraft.client.gui.widget.ClickableWidget;
import net.minecraft.text.Text;

public class RoundedButton extends ClickableWidget {
  public interface Press { void onPress(RoundedButton b); }
  private final Press onPress;

  public RoundedButton(int x, int y, int w, int h, Text msg, Press onPress) {
    super(x, y, w, h, msg);
    this.onPress = onPress;
  }

  @Override
  protected void renderWidget(DrawContext ctx, int mouseX, int mouseY, float delta) {
    boolean hov = isHovered() && active;
    int bg = !active ? 0xFF33333F : hov ? 0xFF8B5CF6 : 0xFF5B21B6;
    GuiDraw.rounded(ctx, getX(), getY(), getX() + width, getY() + height, 9, bg);
    if (hov) GuiDraw.roundedOutline(ctx, getX(), getY(), getX() + width, getY() + height, 9, 0xFFE9D5FF);
    ctx.drawCenteredTextWithShadow(MinecraftClient.getInstance().textRenderer, getMessage(),
      getX() + width / 2, getY() + (height - 8) / 2, active ? 0xFFFFFF : 0xA0A0A0);
  }

  @Override
  public void onClick(double mouseX, double mouseY) {
    if (active && onPress != null) onPress.onPress(this);
  }

  @Override
  protected void appendClickableNarrations(NarrationMessageBuilder builder) {
    appendDefaultNarrations(builder);
  }
}
