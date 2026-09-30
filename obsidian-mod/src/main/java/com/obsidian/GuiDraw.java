package com.obsidian;

import net.minecraft.client.gui.DrawContext;

public class GuiDraw {
  public static void rounded(DrawContext ctx, int x0, int y0, int x1, int y1, int r, int color) {
    ctx.fill(x0 + r, y0, x1 - r, y1, color);
    ctx.fill(x0, y0 + r, x0 + r, y1 - r, color);
    ctx.fill(x1 - r, y0 + r, x1, y1 - r, color);
    circle(ctx, x0 + r, y0 + r, r, color);
    circle(ctx, x1 - r - 1, y0 + r, r, color);
    circle(ctx, x0 + r, y1 - r - 1, r, color);
    circle(ctx, x1 - r - 1, y1 - r - 1, r, color);
  }

  private static void circle(DrawContext ctx, int cx, int cy, int r, int color) {
    for (int dy = -r; dy <= r; dy++) {
      int dx = (int) Math.sqrt((long) r * r - (long) dy * dy);
      ctx.fill(cx - dx, cy + dy, cx + dx + 1, cy + dy + 1, color);
    }
  }

  public static void roundedOutline(DrawContext ctx, int x0, int y0, int x1, int y1, int r, int color) {
    ctx.fill(x0 + r, y0, x1 - r, y0 + 1, color);
    ctx.fill(x0 + r, y1 - 1, x1 - r, y1, color);
    ctx.fill(x0, y0 + r, x0 + 1, y1 - r, color);
    ctx.fill(x1 - 1, y0 + r, x1, y1 - r, color);
  }
}
