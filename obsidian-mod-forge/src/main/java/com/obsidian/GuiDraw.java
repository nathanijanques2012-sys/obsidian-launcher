package com.obsidian;

import net.minecraft.client.gui.GuiGraphics;

// Desenho de painéis arredondados (o vanilla só tem retângulos quadrados)
public class GuiDraw {
  public static void rounded(GuiGraphics g, int x0, int y0, int x1, int y1, int r, int color) {
    g.fill(x0 + r, y0, x1 - r, y1, color);
    g.fill(x0, y0 + r, x0 + r, y1 - r, color);
    g.fill(x1 - r, y0 + r, x1, y1 - r, color);
    circle(g, x0 + r, y0 + r, r, color);
    circle(g, x1 - r - 1, y0 + r, r, color);
    circle(g, x0 + r, y1 - r - 1, r, color);
    circle(g, x1 - r - 1, y1 - r - 1, r, color);
  }

  private static void circle(GuiGraphics g, int cx, int cy, int r, int color) {
    for (int dy = -r; dy <= r; dy++) {
      int dx = (int) Math.sqrt((long) r * r - (long) dy * dy);
      g.fill(cx - dx, cy + dy, cx + dx + 1, cy + dy + 1, color);
    }
  }

  public static void roundedOutline(GuiGraphics g, int x0, int y0, int x1, int y1, int r, int color) {
    g.fill(x0 + r, y0, x1 - r, y0 + 1, color);
    g.fill(x0 + r, y1 - 1, x1 - r, y1, color);
    g.fill(x0, y0 + r, x0 + 1, y1 - r, color);
    g.fill(x1 - 1, y0 + r, x1, y1 - r, color);
  }
}
