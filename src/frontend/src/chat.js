import { Actor } from "@icp-sdk/core/agent";
import { idlFactory as chatIdlFactory } from "./idl/chat.idl.js";
import { createAgent, resolveCanisterId } from "./agent.js";

const FALLBACK_CHAT_CANISTER_ID = "";

// Local network enforces a hard 4,194,304 byte (4MB) ingress limit.
// We cap well under that to leave room for the rest of the message payload.
export const MAX_UPLOAD_BYTES = 1800000;

export async function createChatActor(identity) {
  const agent = await createAgent(identity);
  return Actor.createActor(chatIdlFactory, {
    agent,
    canisterId: resolveCanisterId("chat", FALLBACK_CHAT_CANISTER_ID),
  });
}

const MAX_IMAGE_DIMENSION = 1600;
const JPEG_QUALITY = 0.8;

// Resizes and re-encodes large images client-side before upload to keep
// on-chain storage costs down. Skips non-images, GIFs (would flatten
// animation to one frame), and images already within the size cap.
async function compressImageFile(file) {
  if (!file.type.startsWith("image/") || file.type === "image/gif") {
    return file;
  }

  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch (e) {
    return file;
  }

  const { width, height } = bitmap;
  if (width <= MAX_IMAGE_DIMENSION && height <= MAX_IMAGE_DIMENSION) {
    bitmap.close?.();
    return file;
  }

  const scale = Math.min(MAX_IMAGE_DIMENSION / width, MAX_IMAGE_DIMENSION / height);
  const targetWidth = Math.round(width * scale);
  const targetHeight = Math.round(height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
  bitmap.close?.();

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
  if (!blob) return file;

  const newName = file.name.replace(/\.[^/.]+$/, "") + ".jpg";
  return new File([blob], newName, { type: "image/jpeg" });
}

export async function fileToAttachment(file) {
  const compressed = await compressImageFile(file);
  const buffer = await compressed.arrayBuffer();
  return {
    filename: compressed.name,
    contentType: compressed.type || "application/octet-stream",
    data: new Uint8Array(buffer),
  };
}

export function attachmentToUrl(attachment) {
  const bytes = new Uint8Array(attachment.data);
  const blob = new Blob([bytes], { type: attachment.contentType });
  return URL.createObjectURL(blob);
}

export function isImageAttachment(attachment) {
  return attachment.contentType.startsWith("image/");
}
