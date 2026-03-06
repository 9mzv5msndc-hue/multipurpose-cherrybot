import TelegramBot from “node-telegram-bot-api”;
import express from “express”;
import os from “os”;

// ─── SETUP ────────────────────────────────────────────────

const TOKEN = process.env.TELEGRAM_TOKEN;

if (!TOKEN) {
console.error(“❌ TELEGRAM_TOKEN no está configurado.”);
process.exit(1);
}

const bot = new TelegramBot(TOKEN, { polling: true });
const startTime = new Date();
const DIVIDER = “━━━━━━━━━━━━━━━━━━”;

console.log(“✅ Bot iniciado correctamente.”);

// ─── HELPERS ──────────────────────────────────────────────

async function isAdmin(chatId, userId) {
try {
const member = await bot.getChatMember(chatId, userId);
return [“administrator”, “creator”].includes(member.status);
} catch {
return false;
}
}

async function botIsAdmin(chatId) {
try {
const me = await bot.getMe();
const member = await bot.getChatMember(chatId, me.id);
return [“administrator”, “creator”].includes(member.status);
} catch {
return false;
}
}

async function sendTemp(chatId, text) {
try {
const msg = await bot.sendMessage(chatId, text, { parse_mode: “Markdown” });
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
if (args?.[0]?.startsWith(”@”)) {
try {
const member = await bot.getChatMember(msg.chat.id, args[0]);
return member.user;
} catch { return null; }
}
return msg.from || null;
}

// ─── INFO COMMANDS ────────────────────────────────────────

bot.onText(//id/, async (msg) => {
const target = msg.reply_to_message?.from || msg.from;
if (!target) return;
await bot.sendMessage(msg.chat.id,
`🪪 *ID de usuario*\n${DIVIDER}\n👤 ${target.first_name}\n🔢 \`${target.id}``,
{ parse_mode: “Markdown” });
});

bot.onText(//userinfo(?:\s+(.+))?/, async (msg, match) => {
try {
const args = match?.[1]?.trim().split(” “) || [];
const target = await getTarget(msg, args);
if (!target) { await bot.sendMessage(msg.chat.id, “❌ No se pudo encontrar al usuario.”); return; }
const member = await bot.getChatMember(msg.chat.id, target.id);
const statusMap = { creator: “👑 Creador”, administrator: “🛡 Admin”, member: “👤 Miembro”, restricted: “🚫 Restringido”, left: “🚪 Se fue”, kicked: “❌ Expulsado” };
await bot.sendMessage(msg.chat.id,
`👤 *Info de Usuario*\n${DIVIDER}\n` +
`📛 Nombre: ${target.first_name}${target.last_name ? " " + target.last_name : ""}\n` +
`🔖 Username: ${target.username ? "@" + target.username : "Sin username"}\n` +
`🔢 ID: \`${target.id}`\n`+`🤖 Es bot: ${target.is_bot ? “Sí” : “No”}\n`+`📊 Estado: ${statusMap[member.status] || member.status}\n${DIVIDER}`,
{ parse_mode: “Markdown” });
} catch { await bot.sendMessage(msg.chat.id, “❌ Error al obtener info del usuario.”); }
});

bot.onText(//whois(?:\s+(.+))?/, async (msg, match) => {
try {
const args = match?.[1]?.trim().split(” “) || [];
const target = await getTarget(msg, args);
if (!target) { await bot.sendMessage(msg.chat.id, “❌ No se pudo encontrar al usuario.”); return; }
const member = await bot.getChatMember(msg.chat.id, target.id);
const statusMap = { creator: “👑 Creador”, administrator: “🛡 Admin”, member: “👤 Miembro”, restricted: “🚫 Restringido”, left: “🚪 Se fue”, kicked: “❌ Expulsado” };
let adminInfo = “”;
if (member.status === “administrator”) {
adminInfo = `\n🔧 *Permisos:*\n` +
` • Borrar mensajes: ${member.can_delete_messages ? "✅" : "❌"}\n` +
` • Banear: ${member.can_restrict_members ? "✅" : "❌"}\n` +
` • Título: ${member.custom_title || "Ninguno"}`;
}
await bot.sendMessage(msg.chat.id,
`🔍 *Info Extendida*\n${DIVIDER}\n` +
`📛 Nombre: ${target.first_name}${target.last_name ? " " + target.last_name : ""}\n` +
`🔖 Username: ${target.username ? "@" + target.username : "Sin username"}\n` +
`🔢 ID: \`${target.id}`\n`+`🌐 Idioma: ${target.language_code || “Desconocido”}\n`+`🤖 Es bot: ${target.is_bot ? “Sí” : “No”}\n`+`✅ Premium: ${target.is_premium ? “Sí” : “No”}\n`+`📊 Estado: ${statusMap[member.status] || member.status}${adminInfo}\n${DIVIDER}`,
{ parse_mode: “Markdown” });
} catch { await bot.sendMessage(msg.chat.id, “❌ Error al obtener info del usuario.”); }
});

bot.onText(//pfp(?:\s+(.+))?/, async (msg, match) => {
try {
const args = match?.[1]?.trim().split(” “) || [];
const target = await getTarget(msg, args);
if (!target) { await bot.sendMessage(msg.chat.id, “❌ No se pudo encontrar al usuario.”); return; }
const photos = await bot.getUserProfilePhotos(target.id);
if (photos.total_count === 0) { await bot.sendMessage(msg.chat.id, “❌ Este usuario no tiene fotos de perfil.”); return; }
for (const photoSizes of photos.photos) {
const largest = photoSizes[photoSizes.length - 1];
await bot.sendPhoto(msg.chat.id, largest.file_id, { caption: `📸 Foto de perfil de ${target.first_name}` });
}
} catch { await bot.sendMessage(msg.chat.id, “❌ No se pudo obtener la foto de perfil.”); }
});

bot.onText(//avatar(?:\s+(.+))?/, async (msg, match) => {
try {
const args = match?.[1]?.trim().split(” “) || [];
const target = await getTarget(msg, args);
if (!target) { await bot.sendMessage(msg.chat.id, “❌ No se pudo encontrar al usuario.”); return; }
const photos = await bot.getUserProfilePhotos(target.id);
if (photos.total_count === 0) { await bot.sendMessage(msg.chat.id, “❌ Este usuario no tiene fotos de perfil.”); return; }
for (const photoSizes of photos.photos) {
const largest = photoSizes[photoSizes.length - 1];
await bot.sendPhoto(msg.chat.id, largest.file_id, { caption: `🖼 Avatar de ${target.first_name}` });
}
} catch { await bot.sendMessage(msg.chat.id, “❌ No se pudo obtener el avatar.”); }
});

// ─── GROUP INFO COMMANDS ──────────────────────────────────

bot.onText(//(serverinfo|chatstats)/, async (msg) => {
try {
const chat = await bot.getChat(msg.chat.id);
const memberCount = await bot.getChatMemberCount(msg.chat.id);
const admins = await bot.getChatAdministrators(msg.chat.id);
await bot.sendMessage(msg.chat.id,
`🏠 *Info del Grupo*\n${DIVIDER}\n` +
`📛 Nombre: ${chat.title || "Sin nombre"}\n` +
`🔢 ID: \`${chat.id}`\n`+`🔗 Username: ${chat.username ? “@” + chat.username : “Sin username”}\n`+`👥 Miembros: ${memberCount}\n`+`🛡 Admins: ${admins.length}\n`+`📝 Tipo: ${chat.type}\n${DIVIDER}`,
{ parse_mode: “Markdown” });
} catch { await bot.sendMessage(msg.chat.id, “❌ Error al obtener info del grupo.”); }
});

bot.onText(//members/, async (msg) => {
try {
const count = await bot.getChatMemberCount(msg.chat.id);
await bot.sendMessage(msg.chat.id, `👥 *Miembros*\n${DIVIDER}\nTotal: *${count}* miembros`, { parse_mode: “Markdown” });
} catch { await bot.sendMessage(msg.chat.id, “❌ Error al obtener miembros.”); }
});

bot.onText(//admins/, async (msg) => {
try {
const admins = await bot.getChatAdministrators(msg.chat.id);
let text = `🛡 *Administradores*\n${DIVIDER}\n`;
for (const admin of admins) {
const title = admin.custom_title || (admin.status === “creator” ? “👑 Creador” : “🛡 Admin”);
text += `• ${admin.user.first_name}${admin.user.username ? " (@" + admin.user.username + ")" : ""} — ${title}\n`;
}
await bot.sendMessage(msg.chat.id, text + DIVIDER, { parse_mode: “Markdown” });
} catch { await bot.sendMessage(msg.chat.id, “❌ Error al obtener admins.”); }
});

bot.onText(//roleinfo(?:\s+(.+))?/, async (msg, match) => {
try {
const args = match?.[1]?.trim().split(” “) || [];
const target = await getTarget(msg, args);
if (!target) { await bot.sendMessage(msg.chat.id, “❌ No se pudo encontrar al usuario.”); return; }
const member = await bot.getChatMember(msg.chat.id, target.id);
await bot.sendMessage(msg.chat.id,
`🏷 *Info de Rol*\n${DIVIDER}\n` +
`👤 Usuario: ${target.first_name}\n` +
`📊 Estado: ${member.status}\n` +
`🏷 Título: ${member.custom_title || "Sin título"}\n${DIVIDER}`,
{ parse_mode: “Markdown” });
} catch { await bot.sendMessage(msg.chat.id, “❌ Error al obtener info de rol.”); }
});

// ─── MESSAGE LOG (stores last 500 messages per chat) ──────

const messageLog = new Map();

// FIX: logMessage is called in a single top-level message handler, not scattered
bot.on(“message”, async (msg) => {
logMessage(msg);
});

function logMessage(msg) {
if (!msg || !msg.from) return;
const chatId = msg.chat.id;
const userId = msg.from.id;
const username = msg.from.username?.toLowerCase();
const messageId = msg.message_id;
if (!messageLog.has(chatId)) {
messageLog.set(chatId, []);
}
const log = messageLog.get(chatId);
log.push({ messageId, userId, username });
if (log.length > 500) log.shift();
}

// ─── MODERATION COMMANDS ──────────────────────────────────

// FIX: /purge is now a top-level handler, NOT nested inside bot.on(“message”)
bot.onText(//purge(?:\s+(\d+))?(?:\s+@(\S+))?/, async (msg, match) => {
const chatId = msg.chat.id;
const userId = msg.from?.id;
if (!userId) return;

if (!await isAdmin(chatId, userId)) {
await sendTemp(chatId, “❌ Solo los administradores pueden usar /purge.”);
return;
}

if (!await botIsAdmin(chatId)) {
await sendTemp(chatId, “❌ Necesito ser administrador para borrar mensajes.”);
return;
}

const count = parseInt(match?.[1] || “10”);
const targetUsername = match?.[2]?.toLowerCase();

if (isNaN(count) || count < 1 || count > 100) {
await sendTemp(chatId, “❌ El número debe ser entre 1 y 100.\nUso: /purge 10 o /purge 10 @usuario”);
return;
}

await bot.deleteMessage(chatId, msg.message_id).catch(() => {});

const log = messageLog.get(chatId) || [];
let deleted = 0;

if (targetUsername) {
const userMessages = log
.filter(m => m.username === targetUsername)
.slice(-count)
.reverse();
for (const m of userMessages) {
try {
await bot.deleteMessage(chatId, m.messageId);
deleted++;
} catch {}
}
const deletedIds = new Set(userMessages.map(m => m.messageId));
messageLog.set(chatId, log.filter(m => !deletedIds.has(m.messageId)));
} else {
const recent = log.slice(-count).reverse();
for (const m of recent) {
try {
await bot.deleteMessage(chatId, m.messageId);
deleted++;
} catch {}
}
const deletedIds = new Set(recent.map(m => m.messageId));
messageLog.set(chatId, log.filter(m => !deletedIds.has(m.messageId)));
}

const userText = targetUsername ? ` de @${targetUsername}` : “”;
const confirm = await bot.sendMessage(
chatId,
`🗑 *${deleted} mensajes eliminados${userText}.*`,
{ parse_mode: “Markdown” }
);
setTimeout(() => bot.deleteMessage(chatId, confirm.message_id).catch(() => {}), 3000);
});

// FIX: Added /clear command that was advertised in /help but never implemented
bot.onText(//clear/, async (msg) => {
const chatId = msg.chat.id;
const userId = msg.from?.id;
if (!userId) return;

if (!await isAdmin(chatId, userId)) {
await sendTemp(chatId, “❌ Solo los administradores pueden usar /clear.”);
return;
}
if (!await botIsAdmin(chatId)) {
await sendTemp(chatId, “❌ Necesito ser administrador para borrar mensajes.”);
return;
}

await bot.deleteMessage(chatId, msg.message_id).catch(() => {});

const log = messageLog.get(chatId) || [];
let deleted = 0;
for (const m of […log].reverse()) {
try {
await bot.deleteMessage(chatId, m.messageId);
deleted++;
} catch {}
}
messageLog.set(chatId, []);

const confirm = await bot.sendMessage(chatId, `🗑 *Chat limpiado. ${deleted} mensajes eliminados.*`, { parse_mode: “Markdown” });
setTimeout(() => bot.deleteMessage(chatId, confirm.message_id).catch(() => {}), 3000);
});

// ─── CHAT CONTROL COMMANDS ────────────────────────────────

bot.onText(//lock(?:\s+(\S+))?/, async (msg, match) => {
const chatId = msg.chat.id;
const userId = msg.from?.id;
if (!userId) return;
if (!await isAdmin(chatId, userId)) { await sendTemp(chatId, “❌ Solo los administradores pueden bloquear el chat.”); return; }
if (!await botIsAdmin(chatId)) { await sendTemp(chatId, “❌ Necesito ser administrador para bloquear el chat.”); return; }
const durationStr = match?.[1];
let durationMs = null;
if (durationStr) {
durationMs = parseDuration(durationStr);
if (!durationMs) { await sendTemp(chatId, “❌ Formato inválido. Usa: 30s, 5m, 1h”); return; }
}
try {
await bot.setChatPermissions(chatId, { can_send_messages: false, can_send_polls: false, can_send_other_messages: false, can_add_web_page_previews: false, can_change_info: false, can_invite_users: false, can_pin_messages: false });
const durationText = durationMs ? ` por *${durationStr}*` : “”;
await bot.sendMessage(chatId, `🔒 *Chat bloqueado${durationText}*\n${DIVIDER}\nSolo los administradores pueden escribir.`, { parse_mode: “Markdown” });
if (durationMs) {
setTimeout(async () => {
try {
await bot.setChatPermissions(chatId, { can_send_messages: true, can_send_polls: true, can_send_other_messages: true, can_add_web_page_previews: true, can_invite_users: true });
await bot.sendMessage(chatId, `🔓 *Chat desbloqueado automáticamente.*`, { parse_mode: “Markdown” });
} catch {}
}, durationMs);
}
} catch { await bot.sendMessage(chatId, “❌ No se pudo bloquear el chat.”); }
});

bot.onText(//unlock/, async (msg) => {
const chatId = msg.chat.id;
const userId = msg.from?.id;
if (!userId) return;
if (!await isAdmin(chatId, userId)) { await sendTemp(chatId, “❌ Solo los administradores pueden desbloquear el chat.”); return; }
if (!await botIsAdmin(chatId)) { await sendTemp(chatId, “❌ Necesito ser administrador para desbloquear el chat.”); return; }
try {
await bot.setChatPermissions(chatId, { can_send_messages: true, can_send_polls: true, can_send_other_messages: true, can_add_web_page_previews: true, can_invite_users: true });
await bot.sendMessage(chatId, `🔓 *Chat desbloqueado.*\nTodos pueden volver a escribir.`, { parse_mode: “Markdown” });
} catch { await bot.sendMessage(chatId, “❌ No se pudo desbloquear el chat.”); }
});

bot.onText(//pic/, async (msg) => {
const chatId = msg.chat.id;
const userId = msg.from?.id;
if (!userId) return;
if (!await isAdmin(chatId, userId)) { await sendTemp(chatId, “❌ Solo los administradores pueden usar este comando.”); return; }
if (!await botIsAdmin(chatId)) { await sendTemp(chatId, “❌ Necesito ser administrador para cambiar permisos.”); return; }
try {
await bot.setChatPermissions(chatId, { can_send_messages: true, can_send_other_messages: false });
await bot.sendMessage(chatId, `🖼 *Envío de fotos desactivado.*`, { parse_mode: “Markdown” });
} catch { await bot.sendMessage(chatId, “❌ No se pudo desactivar el envío de fotos.”); }
});

bot.onText(//picremove/, async (msg) => {
const chatId = msg.chat.id;
const userId = msg.from?.id;
if (!userId) return;
if (!await isAdmin(chatId, userId)) { await sendTemp(chatId, “❌ Solo los administradores pueden usar este comando.”); return; }
if (!await botIsAdmin(chatId)) { await sendTemp(chatId, “❌ Necesito ser administrador para cambiar permisos.”); return; }
try {
await bot.setChatPermissions(chatId, { can_send_messages: true, can_send_other_messages: true });
await bot.sendMessage(chatId, `🖼 *Envío de fotos reactivado.*`, { parse_mode: “Markdown” });
} catch { await bot.sendMessage(chatId, “❌ No se pudo reactivar el envío de fotos.”); }
});

// ─── GENERAL COMMANDS ─────────────────────────────────────

bot.onText(//ping/, async (msg) => {
const start = Date.now();
const sent = await bot.sendMessage(msg.chat.id, “🏓 Calculando…”);
const latency = Date.now() - start;
await bot.editMessageText(`🏓 *Pong!*\n${DIVIDER}\n⚡ Latencia: \`${latency}ms``, { chat_id: msg.chat.id, message_id: sent.message_id, parse_mode: “Markdown” });
});

bot.onText(//uptime/, async (msg) => {
await bot.sendMessage(msg.chat.id, `⏱ *Uptime del Bot*\n${DIVIDER}\n🟢 Activo por: \`${formatUptime()}``, { parse_mode: “Markdown” });
});

bot.onText(//botstats/, async (msg) => {
const mem = process.memoryUsage();
const mbUsed = (mem.heapUsed / 1024 / 1024).toFixed(2);
const mbTotal = (mem.heapTotal / 1024 / 1024).toFixed(2);
await bot.sendMessage(msg.chat.id,
`📊 *Estadísticas del Bot*\n${DIVIDER}\n` +
`⏱ Uptime: \`${formatUptime()}`\n`+`💾 Memoria: `${mbUsed} MB / ${mbTotal} MB`\n`+`🖥 Plataforma: `${os.platform()}`\n`+`🟢 Node.js: `${process.version}`\n${DIVIDER}`,
{ parse_mode: “Markdown” });
});

bot.onText(//about/, async (msg) => {
const me = await bot.getMe();
await bot.sendMessage(msg.chat.id,
`🤖 *Sobre el Bot*\n${DIVIDER}\n` +
`📛 Nombre: ${me.first_name}\n` +
`🔖 Username: @${me.username}\n` +
`🔢 ID: \`${me.id}`\n`+`💻 Lenguaje: JavaScript\n${DIVIDER}`,
{ parse_mode: “Markdown” });
});

bot.onText(//help/, async (msg) => {
await bot.sendMessage(msg.chat.id,
`🤖 *Comandos Disponibles*\n${DIVIDER}\n` +
`\n👤 *Info de Usuario*\n` +
` /id — ID del usuario\n` +
` /userinfo — Info del usuario\n` +
` /whois — Info extendida\n` +
` /pfp — Foto de perfil\n` +
` /avatar — Avatar\n` +
` /roleinfo — Info de rol\n` +
`\n🏠 *Info del Grupo*\n` +
` /serverinfo — Info del grupo\n` +
` /chatstats — Estadísticas\n` +
` /members — Número de miembros\n` +
` /admins — Lista de admins\n` +
`\n🛡 *Moderación* _(solo admins)_\n` +
` /purge [n] — Borrar últimos N mensajes\n` +
` /purge [n] @usuario — Borrar N mensajes de un usuario\n` +
` /clear — Limpiar el chat\n` +
`\n🔒 *Control del Chat* _(solo admins)_\n` +
` /lock [tiempo] — Bloquear chat\n` +
` /unlock — Desbloquear chat\n` +
` /pic — Desactivar fotos\n` +
` /picremove — Activar fotos\n` +
`\n⚙️ *General*\n` +
` /ping — Latencia\n` +
` /uptime — Tiempo activo\n` +
` /botstats — Estadísticas\n` +
` /about — Sobre el bot\n` +
` /help — Esta lista\n${DIVIDER}`,
{ parse_mode: “Markdown” });
});

// ─── @ALL MENTION ─────────────────────────────────────────

// FIX: Separated from the logMessage handler - now its own clean handler
bot.on(“message”, async (msg) => {
if (!msg.text?.includes(”@all”)) return;
const chatId = msg.chat.id;
const userId = msg.from?.id;
if (!userId) return;
if (!await isAdmin(chatId, userId)) {
await sendTemp(chatId, “❌ Solo los administradores pueden usar @all.”);
return;
}
try {
const count = await bot.getChatMemberCount(chatId);
await bot.sendMessage(chatId,
`📢 *Mención masiva* — ${count} miembros\n${DIVIDER}\n` +
`👤 Por: ${msg.from?.first_name}\n` +
`⚠️ Todos han sido notificados.`,
{ parse_mode: “Markdown”, reply_to_message_id: msg.message_id }
);
} catch {
await sendTemp(chatId, “❌ No se pudo mencionar a todos.”);
}
});

// ─── AUTO REMOVE DELETED ACCOUNTS ────────────────────────

bot.on(“message”, async (msg) => {
const chatId = msg.chat.id;
if (msg.from && msg.from.first_name === “Deleted Account”) {
if (!await botIsAdmin(chatId)) return;
try {
await bot.banChatMember(chatId, msg.from.id);
await bot.unbanChatMember(chatId, msg.from.id);
await bot.sendMessage(chatId,
`🗑 *Cuenta eliminada removida*\n${DIVIDER}\n` +
`🔢 ID: \`${msg.from.id}`\n`+`✅ Removido automáticamente.`,
{ parse_mode: “Markdown” }
);
} catch {}
}
});

bot.on(“chat_member”, async (update) => {
const chatId = update.chat.id;
const user = update.new_chat_member.user;
if (user.first_name === “Deleted Account”) {
if (!await botIsAdmin(chatId)) return;
try {
await bot.banChatMember(chatId, user.id);
await bot.unbanChatMember(chatId, user.id);
await bot.sendMessage(chatId,
`🗑 *Cuenta eliminada removida*\n${DIVIDER}\n` +
`🔢 ID: \`${user.id}`\n`+`✅ Removido automáticamente.`,
{ parse_mode: “Markdown” }
);
} catch {}
}
});

// ─── CHAT & USER UPDATE TRACKER ──────────────────────────

bot.on(“message”, async (msg) => {
const chatId = msg.chat.id;

// FIX: Removed duplicate new_chat_member handler here.
// Welcome messages are handled by the dedicated welcome handler below.
// This handler only tracks title/photo/pin changes and member leaves.

if (msg.left_chat_member) {
const user = msg.left_chat_member;
const removedBy = msg.from;
const wasKicked = removedBy && removedBy.id !== user.id;
const action = wasKicked
? `🚫 *Miembro eliminado*\n${DIVIDER}\n` +
`👤 ${user.first_name}${user.last_name ? " " + user.last_name : ""}\n` +
`🔖 ${user.username ? "@" + user.username : "Sin username"}\n` +
`🔢 ID: \`${user.id}`\n`+`👮 Eliminado por: ${removedBy.first_name}${removedBy.username ? “ (@” + removedBy.username + “)” : “”}`:`👋 *Miembro salió*\n${DIVIDER}\n`+`👤 ${user.first_name}${user.last_name ? “ “ + user.last_name : “”}\n`+`🔖 ${user.username ? “@” + user.username : “Sin username”}\n`+`🔢 ID: `${user.id}``;

```
await bot.sendMessage(chatId, action, { parse_mode: "Markdown" });
```

}

if (msg.new_chat_title) {
await bot.sendMessage(chatId,
`✏️ *Nombre del grupo cambiado*\n${DIVIDER}\n` +
`📛 Nuevo nombre: *${msg.new_chat_title}*\n` +
`👤 Cambiado por: ${msg.from?.first_name || "Desconocido"}`,
{ parse_mode: “Markdown” });
}

if (msg.new_chat_photo) {
await bot.sendMessage(chatId,
`🖼 *Foto del grupo cambiada*\n${DIVIDER}\n` +
`👤 Cambiado por: ${msg.from?.first_name || "Desconocido"}`,
{ parse_mode: “Markdown” });
}

if (msg.delete_chat_photo) {
await bot.sendMessage(chatId,
`🗑 *Foto del grupo eliminada*\n${DIVIDER}\n` +
`👤 Eliminado por: ${msg.from?.first_name || "Desconocido"}`,
{ parse_mode: “Markdown” });
}

if (msg.pinned_message) {
await bot.sendMessage(chatId,
`📌 *Mensaje anclado*\n${DIVIDER}\n` +
`👤 Anclado por: ${msg.from?.first_name || "Desconocido"}`,
{ parse_mode: “Markdown” });
}
});

bot.on(“chat_member”, async (update) => {
const chatId = update.chat.id;
const oldUser = update.old_chat_member.user;
const newUser = update.new_chat_member.user;
const changes = [];

if (oldUser.username !== newUser.username) {
changes.push(
`🔖 *Username cambiado*\n` +
` Antes: ${oldUser.username ? "@" + oldUser.username : "Sin username"}\n` +
` Ahora: ${newUser.username ? "@" + newUser.username : "Sin username"}`
);
}

if (oldUser.first_name !== newUser.first_name || oldUser.last_name !== newUser.last_name) {
changes.push(
`📛 *Nombre cambiado*\n` +
` Antes: ${oldUser.first_name}${oldUser.last_name ? " " + oldUser.last_name : ""}\n` +
` Ahora: ${newUser.first_name}${newUser.last_name ? " " + newUser.last_name : ""}`
);
}

if (changes.length > 0) {
await bot.sendMessage(chatId,
`🔔 *Actualización de Usuario*\n${DIVIDER}\n` +
`👤 Usuario: ${newUser.first_name} (\`${newUser.id}`)\n`+ changes.join("\n") +`\n${DIVIDER}`,
{ parse_mode: “Markdown” });
}
});

// ─── /iniciar COMMAND ─────────────────────────────────────

bot.onText(//iniciar/, async (msg) => {
await bot.sendMessage(msg.chat.id,
`👋 *Bienvenido a El Cartel De Las Mamacitas*\n${DIVIDER}\n` +
`🤖 Bot multipropósito activo y listo.\n` +
`Selecciona una opción del menú:`,
{
parse_mode: “Markdown”,
reply_markup: {
inline_keyboard: [
[
{ text: “📋 Help”, callback_data: “help” },
],
[
{ text: “🏓 Ping”, callback_data: “ping” },
{ text: “🏠 Server Info”, callback_data: “serverinfo” },
]
]
}
}
);
});

// ─── BUTTON HANDLERS ──────────────────────────────────────

bot.on(“callback_query”, async (query) => {
const msg = query.message;
const chatId = msg.chat.id;

if (query.data === “help”) {
await bot.answerCallbackQuery(query.id);
await bot.sendMessage(chatId,
`🤖 *Comandos Disponibles*\n${DIVIDER}\n` +
`\n👤 *Info de Usuario*\n` +
` /id — ID del usuario\n` +
` /userinfo — Info del usuario\n` +
` /whois — Info extendida\n` +
` /pfp — Foto de perfil\n` +
` /avatar — Avatar\n` +
` /roleinfo — Info de rol\n` +
`\n🏠 *Info del Grupo*\n` +
` /serverinfo — Info del grupo\n` +
` /chatstats — Estadísticas\n` +
` /members — Número de miembros\n` +
` /admins — Lista de admins\n` +
`\n🛡 *Moderación* _(solo admins)_\n` +
` /purge [n] — Borrar últimos N mensajes\n` +
` /clear — Limpiar el chat\n` +
`\n🔒 *Control del Chat* _(solo admins)_\n` +
` /lock [tiempo] — Bloquear chat\n` +
` /unlock — Desbloquear chat\n` +
` /pic — Desactivar fotos\n` +
` /picremove — Activar fotos\n` +
`\n⚙️ *General*\n` +
` /ping — Latencia\n` +
` /uptime — Tiempo activo\n` +
` /botstats — Estadísticas\n` +
` /about — Sobre el bot\n` +
` /help — Esta lista\n${DIVIDER}`,
{ parse_mode: “Markdown” }
);
}

if (query.data === “ping”) {
await bot.answerCallbackQuery(query.id);
const start = Date.now();
const sent = await bot.sendMessage(chatId, “🏓 Calculando…”);
const latency = Date.now() - start;
await bot.editMessageText(
`🏓 *Pong!*\n${DIVIDER}\n⚡ Latencia: \`${latency}ms``,
{ chat_id: chatId, message_id: sent.message_id, parse_mode: “Markdown” }
);
}

if (query.data === “serverinfo”) {
await bot.answerCallbackQuery(query.id);
try {
const chat = await bot.getChat(chatId);
const memberCount = await bot.getChatMemberCount(chatId);
const admins = await bot.getChatAdministrators(chatId);
await bot.sendMessage(chatId,
`🏠 *Info del Grupo*\n${DIVIDER}\n` +
`📛 Nombre: ${chat.title || "Sin nombre"}\n` +
`🔢 ID: \`${chat.id}`\n`+`🔗 Username: ${chat.username ? “@” + chat.username : “Sin username”}\n`+`👥 Miembros: ${memberCount}\n`+`🛡 Admins: ${admins.length}\n`+`📝 Tipo: ${chat.type}\n${DIVIDER}`,
{ parse_mode: “Markdown” }
);
} catch {
await bot.sendMessage(chatId, “❌ Error al obtener info del grupo.”);
}
}
});

// ─── WELCOME MESSAGE ──────────────────────────────────────

bot.on(“message”, async (msg) => {
if (!msg.new_chat_members) return;
const chatId = msg.chat.id;
for (const user of msg.new_chat_members) {
if (user.is_bot) continue;
const name = user.first_name;
const username = user.username ? `@${user.username}` : name;
const memberCount = await bot.getChatMemberCount(chatId).catch(() => “?”);
await bot.sendMessage(chatId,
`✨ *Bienvenida al Cartel* ✨\n${DIVIDER}\n` +
`👋 Hola ${username}, nos alegra tenerte aquí.\n\n` +
`🏠 *El Cartel De Las Mamacitas*\n` +
`👥 Ahora somos *${memberCount}* miembros.\n\n` +
`📌 Usa /help para ver todo lo que puedes hacer.\n` +
`${DIVIDER}`,
{ parse_mode: “Markdown” }
);
}
});

// ─── DELETE DEFAULT TELEGRAM SYSTEM MESSAGES ─────────────

bot.on(“message”, async (msg) => {
const chatId = msg.chat.id;
if (
msg.new_chat_members ||
msg.left_chat_member ||
msg.new_chat_title ||
msg.new_chat_photo ||
msg.delete_chat_photo ||
msg.pinned_message
) {
try {
await bot.deleteMessage(chatId, msg.message_id);
} catch {}
}
});

// ─── ERROR HANDLER ────────────────────────────────────────

bot.on(“polling_error”, (error) => {
console.error(“❌ Error de polling:”, error.message);
});

process.on(“unhandledRejection”, (reason) => {
console.error(“❌ Promesa rechazada:”, reason);
});

// ─── EXPRESS SERVER ───────────────────────────────────────

const app = express();
const PORT = process.env.PORT || 4000;
app.get(”/”, (_req, res) => res.send(“🤖 Bot activo ✅”));
app.listen(PORT, () => console.log(`🚀 Servidor activo en el puerto ${PORT}`));
