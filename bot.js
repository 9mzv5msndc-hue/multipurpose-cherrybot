import TelegramBot from "node-telegram-bot-api";
import express from "express";
import os from "os";

// ─── SETUP ────────────────────────────────────────────────

const TOKEN = process.env.TELEGRAM_TOKEN;

if (!TOKEN) {
  console.error("❌ TELEGRAM_TOKEN no está configurado.");
  process.exit(1);
}

const bot = new TelegramBot(TOKEN, { polling: true });
const startTime = new Date();
const DIVIDER = "━━━━━━━━━━━━━━━━━━";

console.log("✅ Bot iniciado correctamente.");

// ─── HELPERS ──────────────────────────────────────────────

async function isAdmin(chatId, userId) {
  try {
    const member = await bot.getChatMember(chatId, userId);
    return ["administrator", "creator"].includes(member.status);
  } catch {
    return false;
  }
}

async function botIsAdmin(chatId) {
  try {
    const me = await bot.getMe();
    const member = await bot.getChatMember(chatId, me.id);
    return ["administrator", "creator"].includes(member.status);
  } catch {
    return false;
  }
}

async function sendTemp(chatId, text) {
  try {
    const msg = await bot.sendMessage(chatId, text, { parse_mode: "Markdown" });
    setTimeout(() => bot.deleteMessage(chatId, msg.message_id).catch(() => {}), 5000);
  } catch {}
}

function formatUptime() {
  const ms = Date.now() - startTime.getTime();
  const s = Math.floor(ms / 1000) % 60;
  const m = Math.floor(ms / 60000) % 60;
  const h = Math.floor(ms / 3600000) % 24;
  const d = Math.floor(ms / 86400000);
  return `${d}d ${h}h ${m}m ${s}s`;
}

function parseDuration(str) {
  const match = str.match(/^(\d+)(s|m|h|d)$/);
  if (!match) return null;
  const value = parseInt(match[1]);
  const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return value * multipliers[match[2]];
}

async function getTarget(msg, args) {
  if (msg.reply_to_message?.from) return msg.reply_to_message.from;
  if (args?.[0]?.startsWith("@")) {
    try {
      const member = await bot.getChatMember(msg.chat.id, args[0]);
      return member.user;
    } catch { return null; }
  }
  return msg.from || null;
}

// ─── INFO COMMANDS ────────────────────────────────────────

bot.onText(/\/id/, async (msg) => {
  const target = msg.reply_to_message?.from || msg.from;
  if (!target) return;
  await bot.sendMessage(msg.chat.id,
    `🪪 *ID de usuario*\n${DIVIDER}\n👤 ${target.first_name}\n🔢 \`${target.id}\``,
    { parse_mode: "Markdown" });
});

bot.onText(/\/userinfo(?:\s+(.+))?/, async (msg, match) => {
  try {
    const args = match?.[1]?.trim().split(" ") || [];
    const target = await getTarget(msg, args);
    if (!target) { await bot.sendMessage(msg.chat.id, "❌ No se pudo encontrar al usuario."); return; }
    const member = await bot.getChatMember(msg.chat.id, target.id);
    const statusMap = { creator: "👑 Creador", administrator: "🛡 Admin", member: "👤 Miembro", restricted: "🚫 Restringido", left: "🚪 Se fue", kicked: "❌ Expulsado" };
    await bot.sendMessage(msg.chat.id,
      `👤 *Info de Usuario*\n${DIVIDER}\n` +
      `📛 Nombre: ${target.first_name}${target.last_name ? " " + target.last_name : ""}\n` +
      `🔖 Username: ${target.username ? "@" + target.username : "Sin username"}\n` +
      `🔢 ID: \`${target.id}\`\n` +
      `🤖 Es bot: ${target.is_bot ? "Sí" : "No"}\n` +
      `📊 Estado: ${statusMap[member.status] || member.status}\n${DIVIDER}`,
      { parse_mode: "Markdown" });
  } catch { await bot.sendMessage(msg.chat.id, "❌ Error al obtener info del usuario."); }
});

bot.onText(/\/whois(?:\s+(.+))?/, async (msg, match) => {
  try {
    const args = match?.[1]?.trim().split(" ") || [];
    const target = await getTarget(msg, args);
    if (!target) { await bot.sendMessage(msg.chat.id, "❌ No se pudo encontrar al usuario."); return; }
    const member = await bot.getChatMember(msg.chat.id, target.id);
    const statusMap = { creator: "👑 Creador", administrator: "🛡 Admin", member: "👤 Miembro", restricted: "🚫 Restringido", left: "🚪 Se fue", kicked: "❌ Expulsado" };
    let adminInfo = "";
    if (member.status === "administrator") {
      adminInfo = `\n🔧 *Permisos:*\n` +
        `  • Borrar mensajes: ${member.can_delete_messages ? "✅" : "❌"}\n` +
        `  • Banear: ${member.can_restrict_members ? "✅" : "❌"}\n` +
        `  • Título: ${member.custom_title || "Ninguno"}`;
    }
    await bot.sendMessage(msg.chat.id,
      `🔍 *Info Extendida*\n${DIVIDER}\n` +
      `📛 Nombre: ${target.first_name}${target.last_name ? " " + target.last_name : ""}\n` +
      `🔖 Username: ${target.username ? "@" + target.username : "Sin username"}\n` +
      `🔢 ID: \`${target.id}\`\n` +
      `🌐 Idioma: ${target.language_code || "Desconocido"}\n` +
      `🤖 Es bot: ${target.is_bot ? "Sí" : "No"}\n` +
      `✅ Premium: ${target.is_premium ? "Sí" : "No"}\n` +
      `📊 Estado: ${statusMap[member.status] || member.status}${adminInfo}\n${DIVIDER}`,
      { parse_mode: "Markdown" });
  } catch { await bot.sendMessage(msg.chat.id, "❌ Error al obtener info del usuario."); }
});

bot.onText(/\/pfp(?:\s+(.+))?/, async (msg, match) => {
  try {
    const args = match?.[1]?.trim().split(" ") || [];
    const target = await getTarget(msg, args);
    if (!target) { await bot.sendMessage(msg.chat.id, "❌ No se pudo encontrar al usuario."); return; }
    const photos = await bot.getUserProfilePhotos(target.id);
    if (photos.total_count === 0) { await bot.sendMessage(msg.chat.id, "❌ Este usuario no tiene fotos de perfil."); return; }
    for (const photoSizes of photos.photos) {
      const largest = photoSizes[photoSizes.length - 1];
      await bot.sendPhoto(msg.chat.id, largest.file_id, { caption: `📸 Foto de perfil de ${target.first_name}` });
    }
  } catch { await bot.sendMessage(msg.chat.id, "❌ No se pudo obtener la foto de perfil."); }
});

bot.onText(/\/avatar(?:\s+(.+))?/, async (msg, match) => {
  try {
    const args = match?.[1]?.trim().split(" ") || [];
    const target = await getTarget(msg, args);
    if (!target) { await bot.sendMessage(msg.chat.id, "❌ No se pudo encontrar al usuario."); return; }
    const photos = await bot.getUserProfilePhotos(target.id);
    if (photos.total_count === 0) { await bot.sendMessage(msg.chat.id, "❌ Este usuario no tiene fotos de perfil."); return; }
    for (const photoSizes of photos.photos) {
      const largest = photoSizes[photoSizes.length - 1];
      await bot.sendPhoto(msg.chat.id, largest.file_id, { caption: `🖼 Avatar de ${target.first_name}` });
    }
  } catch { await bot.sendMessage(msg.chat.id, "❌ No se pudo obtener el avatar."); }
});

// ─── GROUP INFO COMMANDS ──────────────────────────────────

bot.onText(/\/(serverinfo|chatstats)/, async (msg) => {
  try {
    const chat = await bot.getChat(msg.chat.id);
    const memberCount = await bot.getChatMemberCount(msg.chat.id);
    const admins = await bot.getChatAdministrators(msg.chat.id);
    await bot.sendMessage(msg.chat.id,
      `🏠 *Info del Grupo*\n${DIVIDER}\n` +
      `📛 Nombre: ${chat.title || "Sin nombre"}\n` +
      `🔢 ID: \`${chat.id}\`\n` +
      `🔗 Username: ${chat.username ? "@" + chat.username : "Sin username"}\n` +
      `👥 Miembros: ${memberCount}\n` +
      `🛡 Admins: ${admins.length}\n` +
      `📝 Tipo: ${chat.type}\n${DIVIDER}`,
      { parse_mode: "Markdown" });
  } catch { await bot.sendMessage(msg.chat.id, "❌ Error al obtener info del grupo."); }
});

bot.onText(/\/members/, async (msg) => {
  try {
    const count = await bot.getChatMemberCount(msg.chat.id);
    await bot.sendMessage(msg.chat.id, `👥 *Miembros*\n${DIVIDER}\nTotal: *${count}* miembros`, { parse_mode: "Markdown" });
  } catch { await bot.sendMessage(msg.chat.id, "❌ Error al obtener miembros."); }
});

bot.onText(/\/admins/, async (msg) => {
  try {
    const admins = await bot.getChatAdministrators(msg.chat.id);
    let text = `🛡 *Administradores*\n${DIVIDER}\n`;
    for (const admin of admins) {
      const title = admin.custom_title || (admin.status === "creator" ? "👑 Creador" : "🛡 Admin");
      text += `• ${admin.user.first_name}${admin.user.username ? " (@" + admin.user.username + ")" : ""} — ${title}\n`;
    }
    await bot.sendMessage(msg.chat.id, text + DIVIDER, { parse_mode: "Markdown" });
  } catch { await bot.sendMessage(msg.chat.id, "❌ Error al obtener admins."); }
});

bot.onText(/\/roleinfo(?:\s+(.+))?/, async (msg, match) => {
  try {
    const args = match?.[1]?.trim().split(" ") || [];
    const target = await getTarget(msg, args);
    if (!target) { await bot.sendMessage(msg.chat.id, "❌ No se pudo encontrar al usuario."); return; }
    const member = await bot.getChatMember(msg.chat.id, target.id);
    await bot.sendMessage(msg.chat.id,
      `🏷 *Info de Rol*\n${DIVIDER}\n` +
      `👤 Usuario: ${target.first_name}\n` +
      `📊 Estado: ${member.status}\n` +
      `🏷 Título: ${member.custom_title || "Sin título"}\n${DIVIDER}`,
      { parse_mode: "Markdown" });
  } catch { await bot.sendMessage(msg.chat.id, "❌ Error al obtener info de rol."); }
});

// ─── MODERATION COMMANDS ──────────────────────────────────

bot.onText(/\/purge(?:\s+(\d+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from?.id;
  if (!userId) return;
  if (!await isAdmin(chatId, userId)) { await sendTemp(chatId, "❌ Solo los administradores pueden usar /purge."); return; }
  if (!await botIsAdmin(chatId)) { await sendTemp(chatId, "❌ Necesito ser administrador para borrar mensajes."); return; }
  const count = parseInt(match?.[1] || "10");
  if (isNaN(count) || count < 1 || count > 100) { await sendTemp(chatId, "❌ El número debe ser entre 1 y 100."); return; }
  await bot.deleteMessage(chatId, msg.message_id).catch(() => {});
  let deleted = 0;
  let messageId = msg.message_id - 1;
  while (deleted < count && messageId > 0) {
    try { await bot.deleteMessage(chatId, messageId); deleted++; } catch {}
    messageId--;
  }
  const confirm = await bot.sendMessage(chatId, `🗑 *${deleted} mensajes eliminados.*`, { parse_mode: "Markdown" });
  setTimeout(() => bot.deleteMessage(chatId, confirm.message_id).catch(() => {}), 3000);
});

const pendingClear = new Set();
bot.onText(/\/clear/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from?.id;
  if (!userId) return;
  if (!await isAdmin(chatId, userId)) { await sendTemp(chatId, "❌ Solo los administradores pueden usar /clear."); return; }
  if (!await botIsAdmin(chatId)) { await sendTemp(chatId, "❌ Necesito ser administrador para borrar mensajes."); return; }
  if (pendingClear.has(chatId)) {
    pendingClear.delete(chatId);
    await bot.deleteMessage(chatId, msg.message_id).catch(() => {});
    let messageId = msg.message_id - 1;
    let deleted = 0;
    while (messageId > 0 && deleted < 100) {
      try { await bot.deleteMessage(chatId, messageId); deleted++; } catch {}
      messageId--;
    }
    const confirm = await bot.sendMessage(chatId, `🗑 *Chat limpiado. ${deleted} mensajes eliminados.*`, { parse_mode: "Markdown" });
    setTimeout(() => bot.deleteMessage(chatId, confirm.message_id).catch(() => {}), 3000);
  } else {
    pendingClear.add(chatId);
    const warn = await bot.sendMessage(chatId, `⚠️ *¿Confirmas limpiar el chat?*\nEscribe /clear de nuevo para confirmar.`, { parse_mode: "Markdown" });
    setTimeout(() => { pendingClear.delete(chatId); bot.deleteMessage(chatId, warn.message_id).catch(() => {}); }, 15000);
  }
});

// ─── CHAT CONTROL COMMANDS ────────────────────────────────

bot.onText(/\/lock(?:\s+(\S+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from?.id;
  if (!userId) return;
  if (!await isAdmin(chatId, userId)) { await sendTemp(chatId, "❌ Solo los administradores pueden bloquear el chat."); return; }
  if (!await botIsAdmin(chatId)) { await sendTemp(chatId, "❌ Necesito ser administrador para bloquear el chat."); return; }
  const durationStr = match?.[1];
  let durationMs = null;
  if (durationStr) {
    durationMs = parseDuration(durationStr);
    if (!durationMs) { await sendTemp(chatId, "❌ Formato inválido. Usa: 30s, 5m, 1h"); return; }
  }
  try {
    await bot.setChatPermissions(chatId, { can_send_messages: false, can_send_polls: false, can_send_other_messages: false, can_add_web_page_previews: false, can_change_info: false, can_invite_users: false, can_pin_messages: false });
    const durationText = durationMs ? ` por *${durationStr}*` : "";
    await bot.sendMessage(chatId, `🔒 *Chat bloqueado${durationText}*\n${DIVIDER}\nSolo los administradores pueden escribir.`, { parse_mode: "Markdown" });
    if (durationMs) {
      setTimeout(async () => {
        try {
          await bot.setChatPermissions(chatId, { can_send_messages: true, can_send_polls: true, can_send_other_messages: true, can_add_web_page_previews: true, can_invite_users: true });
          await bot.sendMessage(chatId, `🔓 *Chat desbloqueado automáticamente.*`, { parse_mode: "Markdown" });
        } catch {}
      }, durationMs);
    }
  } catch { await bot.sendMessage(chatId, "❌ No se pudo bloquear el chat."); }
});

bot.onText(/\/unlock/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from?.id;
  if (!userId) return;
  if (!await isAdmin(chatId, userId)) { await sendTemp(chatId, "❌ Solo los administradores pueden desbloquear el chat."); return; }
  if (!await botIsAdmin(chatId)) { await sendTemp(chatId, "❌ Necesito ser administrador para desbloquear el chat."); return; }
  try {
    await bot.setChatPermissions(chatId, { can_send_messages: true, can_send_polls: true, can_send_other_messages: true, can_add_web_page_previews: true, can_invite_users: true });
    await bot.sendMessage(chatId, `🔓 *Chat desbloqueado.*\nTodos pueden volver a escribir.`, { parse_mode: "Markdown" });
  } catch { await bot.sendMessage(chatId, "❌ No se pudo desbloquear el chat."); }
});

bot.onText(/\/pic/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from?.id;
  if (!userId) return;
  if (!await isAdmin(chatId, userId)) { await sendTemp(chatId, "❌ Solo los administradores pueden usar este comando."); return; }
  if (!await botIsAdmin(chatId)) { await sendTemp(chatId, "❌ Necesito ser administrador para cambiar permisos."); return; }
  try {
    await bot.setChatPermissions(chatId, { can_send_messages: true, can_send_other_messages: false });
    await bot.sendMessage(chatId, `🖼 *Envío de fotos desactivado.*`, { parse_mode: "Markdown" });
  } catch { await bot.sendMessage(chatId, "❌ No se pudo desactivar el envío de fotos."); }
});

bot.onText(/\/picremove/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from?.id;
  if (!userId) return;
  if (!await isAdmin(chatId, userId)) { await sendTemp(chatId, "❌ Solo los administradores pueden usar este comando."); return; }
  if (!await botIsAdmin(chatId)) { await sendTemp(chatId, "❌ Necesito ser administrador para cambiar permisos."); return; }
  try {
    await bot.setChatPermissions(chatId, { can_send_messages: true, can_send_other_messages: true });
    await bot.sendMessage(chatId, `🖼 *Envío de fotos reactivado.*`, { parse_mode: "Markdown" });
  } catch { await bot.sendMessage(chatId, "❌ No se pudo reactivar el envío de fotos."); }
});

// ─── GENERAL COMMANDS ─────────────────────────────────────

bot.onText(/\/ping/, async (msg) => {
  const start = Date.now();
  const sent = await bot.sendMessage(msg.chat.id, "🏓 Calculando...");
  const latency = Date.now() - start;
  await bot.editMessageText(`🏓 *Pong!*\n${DIVIDER}\n⚡ Latencia: \`${latency}ms\``, { chat_id: msg.chat.id, message_id: sent.message_id, parse_mode: "Markdown" });
});

bot.onText(/\/uptime/, async (msg) => {
  await bot.sendMessage(msg.chat.id, `⏱ *Uptime del Bot*\n${DIVIDER}\n🟢 Activo por: \`${formatUptime()}\``, { parse_mode: "Markdown" });
});

bot.onText(/\/botstats/, async (msg) => {
  const mem = process.memoryUsage();
  const mbUsed = (mem.heapUsed / 1024 / 1024).toFixed(2);
  const mbTotal = (mem.heapTotal / 1024 / 1024).toFixed(2);
  await bot.sendMessage(msg.chat.id,
    `📊 *Estadísticas del Bot*\n${DIVIDER}\n` +
    `⏱ Uptime: \`${formatUptime()}\`\n` +
    `💾 Memoria: \`${mbUsed} MB / ${mbTotal} MB\`\n` +
    `🖥 Plataforma: \`${os.platform()}\`\n` +
    `🟢 Node.js: \`${process.version}\`\n${DIVIDER}`,
    { parse_mode: "Markdown" });
});

bot.onText(/\/about/, async (msg) => {
  const me = await bot.getMe();
  await bot.sendMessage(msg.chat.id,
    `🤖 *Sobre el Bot*\n${DIVIDER}\n` +
    `📛 Nombre: ${me.first_name}\n` +
    `🔖 Username: @${me.username}\n` +
    `🔢 ID: \`${me.id}\`\n` +
    `💻 Lenguaje: JavaScript\n${DIVIDER}`,
    { parse_mode: "Markdown" });
});

bot.onText(/\/help/, async (msg) => {
  await bot.sendMessage(msg.chat.id,
    `🤖 *Comandos Disponibles*\n${DIVIDER}\n` +
    `\n👤 *Info de Usuario*\n` +
    `  /id — ID del usuario\n` +
    `  /userinfo — Info del usuario\n` +
    `  /whois — Info extendida\n` +
    `  /pfp — Foto de perfil\n` +
    `  /avatar — Avatar\n` +
    `  /roleinfo — Info de rol\n` +
    `\n🏠 *Info del Grupo*\n` +
    `  /serverinfo — Info del grupo\n` +
    `  /chatstats — Estadísticas\n` +
    `  /members — Número de miembros\n` +
    `  /admins — Lista de admins\n` +
    `\n🛡 *Moderación* _(solo admins)_\n` +
    `  /purge [n] — Borrar últimos N mensajes\n` +
    `  /clear — Limpiar el chat\n` +
    `\n🔒 *Control del Chat* _(solo admins)_\n` +
    `  /lock [tiempo] — Bloquear chat\n` +
    `  /unlock — Desbloquear chat\n` +
    `  /pic — Desactivar fotos\n` +
    `  /picremove — Activar fotos\n` +
    `\n⚙️ *General*\n` +
    `  /ping — Latencia\n` +
    `  /uptime — Tiempo activo\n` +
    `  /botstats — Estadísticas\n` +
    `  /about — Sobre el bot\n` +
    `  /help — Esta lista\n${DIVIDER}`,
    { parse_mode: "Markdown" });
});

// ─── ERROR HANDLER ────────────────────────────────────────

bot.on("polling_error", (error) => {
  console.error("❌ Error de polling:", error.message);
});

process.on("unhandledRejection", (reason) => {
  console.error("❌ Promesa rechazada:", reason);
});

// ─── EXPRESS SERVER ───────────────────────────────────────

const app = express();
const PORT = process.env.PORT || 4000;
app.get("/", (_req, res) => res.send("🤖 Bot activo ✅"));
app.listen(PORT, () => console.log(`🚀 Servidor activo en el puerto ${PORT}`));
