package com.obsidian;

import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.keybinding.v1.KeyBindingHelper;
import net.fabricmc.fabric.api.client.rendering.v1.HudRenderCallback;
import net.minecraft.client.option.KeyBinding;
import net.minecraft.client.util.InputUtil;
import org.lwjgl.glfw.GLFW;

public class OverlayMod implements ClientModInitializer {
  public static KeyBinding openMenu;
  public static boolean showFps = true;
  public static boolean showCoords = true;
  public static boolean showCps = true;
  public static boolean showFriends = true;

  @Override
  public void onInitializeClient() {
    openMenu = KeyBindingHelper.registerKeyBinding(new KeyBinding(
      "key.obsidian.menu", InputUtil.Type.KEYSYM, GLFW.GLFW_KEY_O, "category.obsidian"));
    HudRenderCallback.EVENT.register(new OverlayHud());
    ClientTickEvents.END_CLIENT_TICK.register(client -> {
      OverlayHud.onTick();
      FriendFile.tick();
      while (openMenu.wasPressed()) {
        client.setScreen(new OverlayScreen());
      }
      // Troca TitleScreen vanilla pelo menu Obsidian estilo CMClient
      if (client.currentScreen != null
        && client.currentScreen.getClass().getName().equals("net.minecraft.client.gui.screen.TitleScreen")) {
        client.setScreen(new ObsidianMenuScreen());
      }
    });
  }
}
