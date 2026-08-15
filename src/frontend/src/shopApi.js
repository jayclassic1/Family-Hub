import { Actor } from "@icp-sdk/core/agent";
import { idlFactory as shopIdlFactory } from "./idl/shop.idl.js";
import { createAgent, resolveCanisterId } from "./agent.js";

const FALLBACK_SHOP_CANISTER_ID = "";

export async function createShopActor(identity) {
  const agent = await createAgent(identity);
  return Actor.createActor(shopIdlFactory, {
    agent,
    canisterId: resolveCanisterId("shop", FALLBACK_SHOP_CANISTER_ID),
  });
}

export const NAME_COLORS = [
  { key: "#e8702e", label: "Orange" },
  { key: "#c62828", label: "Red" },
  { key: "#8b0000", label: "Crimson" },
  { key: "#ff6f61", label: "Coral" },
  { key: "#1c6b3d", label: "Green" },
  { key: "#2e8b57", label: "Sea Green" },
  { key: "#7cb342", label: "Lime" },
  { key: "#1e5fae", label: "Blue" },
  { key: "#0d47a1", label: "Navy" },
  { key: "#00acc1", label: "Cyan" },
  { key: "#7b1fa2", label: "Purple" },
  { key: "#4a148c", label: "Deep Violet" },
  { key: "#e0a530", label: "Gold" },
  { key: "#ffb300", label: "Amber" },
  { key: "#d63384", label: "Pink" },
  { key: "#ad1457", label: "Magenta" },
  { key: "#5d4037", label: "Brown" },
  { key: "#455a64", label: "Slate" },
  { key: "#212121", label: "Black" },
  { key: "#9e9e9e", label: "Silver" },
];

export const NAME_FONTS = [
  { key: "default", label: "Default", css: "inherit" },
  { key: "serif", label: "Serif", css: "Georgia, serif" },
  { key: "times", label: "Times", css: "'Times New Roman', Times, serif" },
  { key: "mono", label: "Monospace", css: "'Courier New', monospace" },
  { key: "cursive", label: "Cursive", css: "'Brush Script MT', cursive" },
  { key: "elegant-script", label: "Elegant Script", css: "'Snell Roundhand', 'Apple Chancery', cursive" },
  { key: "condensed", label: "Condensed", css: "'Arial Narrow', sans-serif" },
  { key: "rounded", label: "Rounded", css: "'Arial Rounded MT Bold', 'Helvetica Rounded', sans-serif" },
  { key: "impact", label: "Bold Impact", css: "Impact, Haettenschweiler, sans-serif" },
  { key: "fantasy", label: "Fantasy", css: "Papyrus, fantasy" },
  { key: "system", label: "Clean Sans", css: "-apple-system, 'Segoe UI', Helvetica, Arial, sans-serif" },
];

export const LOVED_EFFECTS = [
  { key: "confetti", label: "Confetti Burst", price: 25, description: "Confetti bursts outward from the loved message." },
  { key: "heartPulse", label: "Heart Pulse", price: 38, description: "A ring of hearts blooms outward from the message." },
  { key: "sparkleTrail", label: "Sparkle Trail", price: 50, description: "Sparkles twinkle around the message border." },
  { key: "glowRipple", label: "Glow Ripple", price: 63, description: "A soft glowing ripple pulses from the message." },
  { key: "goldenShimmer", label: "Golden Shimmer", price: 75, description: "A gilded light sweep passes across the message." },
];

export const SEND_EFFECTS = [
  { key: "fireworks", label: "Fireworks", price: 25, description: "Fireworks burst across the chat when you send love." },
  { key: "shootingStars", label: "Shooting Stars", price: 38, description: "Streaks of light cross the screen when you send love." },
  { key: "fallingPetals", label: "Falling Petals", price: 50, description: "Hearts and petals drift down the screen." },
  { key: "screenFlash", label: "Screen Flash + Ring", price: 63, description: "A quick flash and expanding ring hits the screen." },
  { key: "balloonRise", label: "Balloon Rise", price: 75, description: "Balloons rise from the bottom and pop at the top." },
];

export const CHAT_BUBBLE_SKINS = [
  { key: "default", label: "Default" },
  { key: "sunset", label: "Sunset" },
  { key: "ocean", label: "Ocean" },
  { key: "forest", label: "Forest" },
];

export const PROFILE_THEMES = [
  { key: "default", label: "Default" },
  { key: "midnight", label: "Midnight" },
  { key: "meadow", label: "Meadow" },
  { key: "sunrise", label: "Sunrise" },
];

export const SHOP_ITEMS = [
  { key: "nameColor", label: "Name Color", price: 10, description: "Pick a custom color for your username in chat." },
  { key: "nameFont", label: "Name Font", price: 10, description: "Pick a custom font for your username." },
  { key: "pfp", label: "Custom PFP", price: 15, description: "Unlock a dedicated profile avatar." },
  { key: "banner", label: "Custom Banner", price: 15, description: "Unlock a profile banner image." },
  { key: "chatBubble", label: "Chat Bubble Skin", price: 15, description: "A custom color skin for your own chat bubbles." },
  { key: "badge", label: "Badge / Title", price: 15, description: "A custom text badge shown next to your name." },
  { key: "profileTheme", label: "Profile Theme", price: 15, description: "A background theme for your profile page." },
];
