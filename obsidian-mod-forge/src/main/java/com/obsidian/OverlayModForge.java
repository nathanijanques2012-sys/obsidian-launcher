package com.obsidian;

import com.mojang.blaze3d.platform.InputConstants;
import net.minecraft.client.KeyMapping;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.screens.TitleScreen;
import net.minecraftforge.api.distmarker.Dist;
import net.minecraftforge.client.event.CustomizeGuiOverlayEvent;
import net.minecraftforge.client.event.RegisterKeyMappingsEvent;
import net.minecraftforge.client.event.ScreenEvent;
import net.minecraftforge.event.TickEvent;
import net.minecraftforge.eventbus.api.SubscribeEvent;
import net.minecraftforge.fml.common.Mod;
import org.lwjgl.glfw.GLFW;

@Mod(OverlayModForge.MODID)
public class OverlayModForge {
  public static final String MODID = "obsidian_overlay";
  public static KeyMapping openMenu;
  public static boolean showFps = true;
  public static boolean showCoords = true;
  public static boolean showCps = true;
  public static boolean showFriends = true;

  public OverlayModForge() {}

  @Mod.EventBusSubscriber(modid = MODID, bus = Mod.EventBusSubscriber.Bus.MOD)
  public static class ModEvents {
    @SubscribeEvent
    public static void keys(RegisterKeyMappingsEvent e) {
      openMenu = new KeyMapping("key.obsidian.menu", InputConstants.Type.KEYSYM, GLFW.GLFW_KEY_O, "category.obsidian");
      e.register(openMenu);
    }
  }

  @Mod.EventBusSubscriber(modid = MODID, bus = Mod.EventBusSubscriber.Bus.FORGE, value = Dist.CLIENT)
  public static class ClientEvents {
    // Forge 52 removeu RenderGuiEvent/overlay system: HUD via camadas vanilla
    // (Chat e Boss disparam todo frame com contexto gráfico)
    @SubscribeEvent
    public static void hudChat(CustomizeGuiOverlayEvent.Chat e) {
      OverlayHudForge.render(e.getGuiGraphics());
    }

    @SubscribeEvent
    public static void hudBoss(CustomizeGuiOverlayEvent.BossEventProgress e) {
      OverlayHudForge.render(e.getGuiGraphics());
    }

    @SubscribeEvent
    public static void tick(TickEvent.ClientTickEvent e) {
      if (e.phase != TickEvent.Phase.END) return;
      OverlayHudForge.onTick();
      Minecraft mc = Minecraft.getInstance();
      while (openMenu != null && openMenu.consumeClick()) {
        mc.setScreen(new OverlayScreenForge());
      }
      // Troca a TitleScreen vanilla pelo menu Obsidian estilo CMClient
      if (mc.screen == null && false) { /* placeholder */ }
    }

    @SubscribeEvent
    public static void menu(ScreenEvent.Opening e) {
      if (e.getNewScreen() instanceof TitleScreen) {
        e.setNewScreen(new ObsidianMenuScreenForge());
      }
    }
  }
}
