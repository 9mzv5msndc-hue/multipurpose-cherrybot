const TelegramBot = require(“node-telegram-bot-api”);
const express = require(“express”);
const os = require(“os”);

// ─── SETUP ────────────────────────────────────────────────

const TOKEN = process.env.TELEGRAM_TOKEN;
if (!TOKEN) { console.error(“❌ TELEGRAM_TOKEN no está configurado.”); process.exit(1); }

const bot = new TelegramBot(TOKEN, { polling: true });
const startTime = new Date();
const DIVIDER = “━━━━━━━━━━━━━━━━━━”;

console.log(“✅ Bot iniciado correctamente.”);

// ─── COMMAND MATCHING ─────────────────────────────────────
// Supports both /command and !command (with optional @BotUsername suffix)
function cmd(command) {
return new RegExp(”^[!/]” + command + “(?:@\S+)?(?:\s+(.+))?$”, “i”);
}
function cmdExact(command) {
return new RegExp(”^[!/]” + command + “(?:@\S+)?$”, “i”);
}

// ─── HELPERS ──────────────────────────────────────────────

async function isAdmin(chatId, userId) {
try {
const member = await bot.getChatMember(chatId, userId);
return [“administrator”, “creator”].includes(member.status);
} catch { return false; }
}

async function botIsAdmin(chatId) {
try {
const me = await bot.getMe();
const member = await bot.getChatMember(chatId, me.id);
return [“administrator”, “creator”].includes(member.status);
} catch { return false; }
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
return d + “d “ + h + “h “ + m + “m “ + s + “s”;
}

function parseDuration(str) {
const match = str.match(/^(\d+)(s|m|h|d)$/);
if (!match) return null;
const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
return parseInt(match[1]) * multipliers[match[2]];
}

async function getTarget(msg, args) {
if (msg.reply_to_message && msg.reply_to_message.from) return msg.reply_to_message.from;
if (args && args[0] && args[0].startsWith(”@”)) {
try {
const member = await bot.getChatMember(msg.chat.id, args[0]);
return member.user;
} catch { return null; }
}
return msg.from || null;
}

function isGroup(msg) {
return msg.chat.type === “group” || msg.chat.type === “supergroup”;
}

// ─── MESSAGE LOG ──────────────────────────────────────────

const messageLog = new Map();

function logMessage(msg) {
if (!msg || !msg.from) return;
const log = messageLog.get(msg.chat.id) || [];
log.push({
messageId: msg.message_id,
userId: msg.from.id,
username: msg.from.username ? msg.from.username.toLowerCase() : null
});
if (log.length > 500) log.shift();
messageLog.set(msg.chat.id, log);
}

bot.on(“message”, function(msg) { logMessage(msg); });

// ─── INFO COMMANDS ────────────────────────────────────────

bot.onText(cmdExact(“id”), async function(msg) {
const target = (msg.reply_to_message && msg.reply_to_message.from) || msg.from;
if (!target) return;
await bot.sendMessage(msg.chat.id,
“🪪 *ID de usuario*\n” + DIVIDER + “\n👤 “ + target.first_name + “\n🔢 `" + target.id + "`”,
{ parse_mode: “Markdown” });
});

bot.onText(cmd(“userinfo”), async function(msg, match) {
try {
const args = match && match[1] ? match[1].trim().split(” “) : [];
const target = await getTarget(msg, args);
if (!target) { await bot.sendMessage(msg.chat.id, “❌ No se pudo encontrar al usuario.”); return; }
const member = isGroup(msg) ? await bot.getChatMember(msg.chat.id, target.id) : null;
const statusMap = { creator: “👑 Creador”, administrator: “🛡 Admin”, member: “👤 Miembro”, restricted: “🚫 Restringido”, left: “🚪 Se fue”, kicked: “❌ Expulsado” };
await bot.sendMessage(msg.chat.id,
“👤 *Info de Usuario*\n” + DIVIDER + “\n” +
“📛 Nombre: “ + target.first_name + (target.last_name ? “ “ + target.last_name : “”) + “\n” +
“🔖 Username: “ + (target.username ? “@” + target.username : “Sin username”) + “\n” +
“🔢 ID: `" + target.id + "`\n” +
“🤖 Es bot: “ + (target.is_bot ? “Sí” : “No”) + “\n” +
(member ? “📊 Estado: “ + (statusMap[member.status] || member.status) + “\n” : “”) +
DIVIDER,
{ parse_mode: “Markdown” });
} catch { await bot.sendMessage(msg.chat.id, “❌ Error al obtener info del usuario.”); }
});

bot.onText(cmd(“whois”), async function(msg, match) {
try {
const args = match && match[1] ? match[1].trim().split(” “) : [];
const target = await getTarget(msg, args);
if (!target) { await bot.sendMessage(msg.chat.id, “❌ No se pudo encontrar al usuario.”); return; }
const member = isGroup(msg) ? await bot.getChatMember(msg.chat.id, target.id) : null;
const statusMap = { creator: “👑 Creador”, administrator: “🛡 Admin”, member: “👤 Miembro”, restricted: “🚫 Restringido”, left: “🚪 Se fue”, kicked: “❌ Expulsado” };
let adminInfo = “”;
if (member && member.status === “administrator”) {
adminInfo = “\n🔧 *Permisos:*\n” +
“ • Borrar mensajes: “ + (member.can_delete_messages ? “✅” : “❌”) + “\n” +
“ • Banear: “ + (member.can_restrict_members ? “✅” : “❌”) + “\n” +
“ • Título: “ + (member.custom_title || “Ninguno”);
}
await bot.sendMessage(msg.chat.id,
“🔍 *Info Extendida*\n” + DIVIDER + “\n” +
“📛 Nombre: “ + target.first_name + (target.last_name ? “ “ + target.last_name : “”) + “\n” +
“🔖 Username: “ + (target.username ? “@” + target.username : “Sin username”) + “\n” +
“🔢 ID: `" + target.id + "`\n” +
“🌐 Idioma: “ + (target.language_code || “Desconocido”) + “\n” +
“🤖 Es bot: “ + (target.is_bot ? “Sí” : “No”) + “\n” +
“✅ Premium: “ + (target.is_premium ? “Sí” : “No”) + “\n” +
(member ? “📊 Estado: “ + (statusMap[member.status] || member.status) + adminInfo + “\n” : “”) +
DIVIDER,
{ parse_mode: “Markdown” });
} catch { await bot.sendMessage(msg.chat.id, “❌ Error al obtener info del usuario.”); }
});

bot.onText(cmd(“pfp”), async function(msg, match) {
try {
const args = match && match[1] ? match[1].trim().split(” “) : [];
const target = await getTarget(msg, args);
if (!target) { await bot.sendMessage(msg.chat.id, “❌ No se pudo encontrar al usuario.”); return; }
const photos = await bot.getUserProfilePhotos(target.id);
if (photos.total_count === 0) { await bot.sendMessage(msg.chat.id, “❌ Este usuario no tiene fotos de perfil.”); return; }
for (const photoSizes of photos.photos) {
await bot.sendPhoto(msg.chat.id, photoSizes[photoSizes.length - 1].file_id, { caption: “📸 Foto de perfil de “ + target.first_name });
}
} catch { await bot.sendMessage(msg.chat.id, “❌ No se pudo obtener la foto de perfil.”); }
});

bot.onText(cmd(“avatar”), async function(msg, match) {
try {
const args = match && match[1] ? match[1].trim().split(” “) : [];
const target = await getTarget(msg, args);
if (!target) { await bot.sendMessage(msg.chat.id, “❌ No se pudo encontrar al usuario.”); return; }
const photos = await bot.getUserProfilePhotos(target.id);
if (photos.total_count === 0) { await bot.sendMessage(msg.chat.id, “❌ Este usuario no tiene fotos de perfil.”); return; }
for (const photoSizes of photos.photos) {
await bot.sendPhoto(msg.chat.id, photoSizes[photoSizes.length - 1].file_id, { caption: “🖼 Avatar de “ + target.first_name });
}
} catch { await bot.sendMessage(msg.chat.id, “❌ No se pudo obtener el avatar.”); }
});

// ─── GROUP INFO COMMANDS ──────────────────────────────────

bot.onText(/^[!/](serverinfo|chatstats)(?:@\S+)?$/i, async function(msg) {
if (!isGroup(msg)) { await bot.sendMessage(msg.chat.id, “❌ Este comando solo funciona en grupos.”); return; }
try {
const chat = await bot.getChat(msg.chat.id);
const memberCount = await bot.getChatMemberCount(msg.chat.id);
const admins = await bot.getChatAdministrators(msg.chat.id);
await bot.sendMessage(msg.chat.id,
“🏠 *Info del Grupo*\n” + DIVIDER + “\n” +
“📛 Nombre: “ + (chat.title || “Sin nombre”) + “\n” +
“🔢 ID: `" + chat.id + "`\n” +
“🔗 Username: “ + (chat.username ? “@” + chat.username : “Sin username”) + “\n” +
“👥 Miembros: “ + memberCount + “\n” +
“🛡 Admins: “ + admins.length + “\n” +
“📝 Tipo: “ + chat.type + “\n” + DIVIDER,
{ parse_mode: “Markdown” });
} catch { await bot.sendMessage(msg.chat.id, “❌ Error al obtener info del grupo.”); }
});

bot.onText(cmdExact(“members”), async function(msg) {
if (!isGroup(msg)) { await bot.sendMessage(msg.chat.id, “❌ Este comando solo funciona en grupos.”); return; }
try {
const count = await bot.getChatMemberCount(msg.chat.id);
await bot.sendMessage(msg.chat.id, “👥 *Miembros*\n” + DIVIDER + “\nTotal: *” + count + “* miembros”, { parse_mode: “Markdown” });
} catch { await bot.sendMessage(msg.chat.id, “❌ Error al obtener miembros.”); }
});

bot.onText(cmdExact(“admins”), async function(msg) {
if (!isGroup(msg)) { await bot.sendMessage(msg.chat.id, “❌ Este comando solo funciona en grupos.”); return; }
try {
const admins = await bot.getChatAdministrators(msg.chat.id);
let text = “🛡 *Administradores*\n” + DIVIDER + “\n”;
for (const admin of admins) {
const title = admin.custom_title || (admin.status === “creator” ? “👑 Creador” : “🛡 Admin”);
text += “• “ + admin.user.first_name + (admin.user.username ? “ (@” + admin.user.username + “)” : “”) + “ — “ + title + “\n”;
}
await bot.sendMessage(msg.chat.id, text + DIVIDER, { parse_mode: “Markdown” });
} catch { await bot.sendMessage(msg.chat.id, “❌ Error al obtener admins.”); }
});

bot.onText(cmd(“roleinfo”), async function(msg, match) {
if (!isGroup(msg)) { await bot.sendMessage(msg.chat.id, “❌ Este comando solo funciona en grupos.”); return; }
try {
const args = match && match[1] ? match[1].trim().split(” “) : [];
const target = await getTarget(msg, args);
if (!target) { await bot.sendMessage(msg.chat.id, “❌ No se pudo encontrar al usuario.”); return; }
const member = await bot.getChatMember(msg.chat.id, target.id);
await bot.sendMessage(msg.chat.id,
“🏷 *Info de Rol*\n” + DIVIDER + “\n” +
“👤 Usuario: “ + target.first_name + “\n” +
“📊 Estado: “ + member.status + “\n” +
“🏷 Título: “ + (member.custom_title || “Sin título”) + “\n” + DIVIDER,
{ parse_mode: “Markdown” });
} catch { await bot.sendMessage(msg.chat.id, “❌ Error al obtener info de rol.”); }
});

// ─── MODERATION COMMANDS ──────────────────────────────────

bot.onText(/^[!/]purge(?:@\S+)?(?:\s+(\d+))?(?:\s+@(\S+))?$/i, async function(msg, match) {
if (!isGroup(msg)) { await bot.sendMessage(msg.chat.id, “❌ Este comando solo funciona en grupos.”); return; }
const chatId = msg.chat.id;
const userId = msg.from && msg.from.id;
if (!userId) return;
if (!await isAdmin(chatId, userId)) { await sendTemp(chatId, “❌ Solo los administradores pueden usar este comando.”); return; }
if (!await botIsAdmin(chatId)) { await sendTemp(chatId, “❌ Necesito ser administrador para borrar mensajes.”); return; }

const count = parseInt(match && match[1] ? match[1] : “10”);
const targetUsername = match && match[2] ? match[2].toLowerCase() : null;
if (isNaN(count) || count < 1 || count > 100) {
await sendTemp(chatId, “❌ El número debe ser entre 1 y 100.\nUso: /purge 10 o /purge 10 @usuario”);
return;
}

await bot.deleteMessage(chatId, msg.message_id).catch(() => {});
const log = messageLog.get(chatId) || [];
let deleted = 0;

const targets = targetUsername
? log.filter(function(m) { return m.username === targetUsername; }).slice(-count)
: log.slice(-count);

for (let i = targets.length - 1; i >= 0; i–) {
try { await bot.deleteMessage(chatId, targets[i].messageId); deleted++; } catch {}
}

const deletedIds = new Set(targets.map(function(m) { return m.messageId; }));
messageLog.set(chatId, log.filter(function(m) { return !deletedIds.has(m.messageId); }));

const confirm = await bot.sendMessage(chatId,
“🗑 *” + deleted + “ mensajes eliminados” + (targetUsername ? “ de @” + targetUsername : “”) + “.*”,
{ parse_mode: “Markdown” });
setTimeout(function() { bot.deleteMessage(chatId, confirm.message_id).catch(() => {}); }, 3000);
});

bot.onText(cmdExact(“clear”), async function(msg) {
if (!isGroup(msg)) { await bot.sendMessage(msg.chat.id, “❌ Este comando solo funciona en grupos.”); return; }
const chatId = msg.chat.id;
const userId = msg.from && msg.from.id;
if (!userId) return;
if (!await isAdmin(chatId, userId)) { await sendTemp(chatId, “❌ Solo los administradores pueden usar este comando.”); return; }
if (!await botIsAdmin(chatId)) { await sendTemp(chatId, “❌ Necesito ser administrador para borrar mensajes.”); return; }

await bot.deleteMessage(chatId, msg.message_id).catch(() => {});
const log = messageLog.get(chatId) || [];
let deleted = 0;
for (let i = log.length - 1; i >= 0; i–) {
try { await bot.deleteMessage(chatId, log[i].messageId); deleted++; } catch {}
}
messageLog.set(chatId, []);

const confirm = await bot.sendMessage(chatId, “🗑 *Chat limpiado. “ + deleted + “ mensajes eliminados.*”, { parse_mode: “Markdown” });
setTimeout(function() { bot.deleteMessage(chatId, confirm.message_id).catch(() => {}); }, 3000);
});

// ─── CHAT CONTROL COMMANDS ────────────────────────────────

bot.onText(cmd(“lock”), async function(msg, match) {
if (!isGroup(msg)) { await bot.sendMessage(msg.chat.id, “❌ Este comando solo funciona en grupos.”); return; }
const chatId = msg.chat.id;
const userId = msg.from && msg.from.id;
if (!userId) return;
if (!await isAdmin(chatId, userId)) { await sendTemp(chatId, “❌ Solo los administradores pueden bloquear el chat.”); return; }
if (!await botIsAdmin(chatId)) { await sendTemp(chatId, “❌ Necesito ser administrador para bloquear el chat.”); return; }
const durationStr = match && match[1] ? match[1].trim() : null;
let durationMs = null;
if (durationStr) {
durationMs = parseDuration(durationStr);
if (!durationMs) { await sendTemp(chatId, “❌ Formato inválido. Usa: 30s, 5m, 1h, 2d”); return; }
}
try {
await bot.setChatPermissions(chatId, { can_send_messages: false, can_send_polls: false, can_send_other_messages: false, can_add_web_page_previews: false, can_change_info: false, can_invite_users: false, can_pin_messages: false });
const durationText = durationMs ? “ por *” + durationStr + “*” : “”;
await bot.sendMessage(chatId, “🔒 *Chat bloqueado” + durationText + “*\n” + DIVIDER + “\nSolo los administradores pueden escribir.”, { parse_mode: “Markdown” });
if (durationMs) {
setTimeout(async function() {
try {
await bot.setChatPermissions(chatId, { can_send_messages: true, can_send_polls: true, can_send_other_messages: true, can_add_web_page_previews: true, can_invite_users: true });
await bot.sendMessage(chatId, “🔓 *Chat desbloqueado automáticamente.*”, { parse_mode: “Markdown” });
} catch {}
}, durationMs);
}
} catch { await bot.sendMessage(chatId, “❌ No se pudo bloquear el chat.”); }
});

bot.onText(cmdExact(“unlock”), async function(msg) {
if (!isGroup(msg)) { await bot.sendMessage(msg.chat.id, “❌ Este comando solo funciona en grupos.”); return; }
const chatId = msg.chat.id;
const userId = msg.from && msg.from.id;
if (!userId) return;
if (!await isAdmin(chatId, userId)) { await sendTemp(chatId, “❌ Solo los administradores pueden desbloquear el chat.”); return; }
if (!await botIsAdmin(chatId)) { await sendTemp(chatId, “❌ Necesito ser administrador para desbloquear el chat.”); return; }
try {
await bot.setChatPermissions(chatId, { can_send_messages: true, can_send_polls: true, can_send_other_messages: true, can_add_web_page_previews: true, can_invite_users: true });
await bot.sendMessage(chatId, “🔓 *Chat desbloqueado.*\nTodos pueden volver a escribir.”, { parse_mode: “Markdown” });
} catch { await bot.sendMessage(chatId, “❌ No se pudo desbloquear el chat.”); }
});

bot.onText(cmdExact(“pic”), async function(msg) {
if (!isGroup(msg)) { await bot.sendMessage(msg.chat.id, “❌ Este comando solo funciona en grupos.”); return; }
const chatId = msg.chat.id;
const userId = msg.from && msg.from.id;
if (!userId) return;
if (!await isAdmin(chatId, userId)) { await sendTemp(chatId, “❌ Solo los administradores pueden usar este comando.”); return; }
if (!await botIsAdmin(chatId)) { await sendTemp(chatId, “❌ Necesito ser administrador para cambiar permisos.”); return; }
try {
await bot.setChatPermissions(chatId, { can_send_messages: true, can_send_other_messages: false });
await bot.sendMessage(chatId, “🖼 *Envío de fotos desactivado.*”, { parse_mode: “Markdown” });
} catch { await bot.sendMessage(chatId, “❌ No se pudo desactivar el envío de fotos.”); }
});

bot.onText(cmdExact(“picremove”), async function(msg) {
if (!isGroup(msg)) { await bot.sendMessage(msg.chat.id, “❌ Este comando solo funciona en grupos.”); return; }
const chatId = msg.chat.id;
const userId = msg.from && msg.from.id;
if (!userId) return;
if (!await isAdmin(chatId, userId)) { await sendTemp(chatId, “❌ Solo los administradores pueden usar este comando.”); return; }
if (!await botIsAdmin(chatId)) { await sendTemp(chatId, “❌ Necesito ser administrador para cambiar permisos.”); return; }
try {
await bot.setChatPermissions(chatId, { can_send_messages: true, can_send_other_messages: true });
await bot.sendMessage(chatId, “🖼 *Envío de fotos reactivado.*”, { parse_mode: “Markdown” });
} catch { await bot.sendMessage(chatId, “❌ No se pudo reactivar el envío de fotos.”); }
});

// ─── GENERAL COMMANDS ─────────────────────────────────────

bot.onText(cmdExact(“ping”), async function(msg) {
const start = Date.now();
const sent = await bot.sendMessage(msg.chat.id, “🏓 Calculando…”);
const latency = Date.now() - start;
await bot.editMessageText(“🏓 *Pong!*\n” + DIVIDER + “\n⚡ Latencia: `" + latency + "ms`”,
{ chat_id: msg.chat.id, message_id: sent.message_id, parse_mode: “Markdown” });
});

bot.onText(cmdExact(“uptime”), async function(msg) {
await bot.sendMessage(msg.chat.id,
“⏱ *Uptime del Bot*\n” + DIVIDER + “\n🟢 Activo por: `" + formatUptime() + "`”,
{ parse_mode: “Markdown” });
});

bot.onText(cmdExact(“botstats”), async function(msg) {
const mem = process.memoryUsage();
await bot.sendMessage(msg.chat.id,
“📊 *Estadísticas del Bot*\n” + DIVIDER + “\n” +
“⏱ Uptime: `" + formatUptime() + "`\n” +
“💾 Memoria: `" + (mem.heapUsed / 1024 / 1024).toFixed(2) + " MB / " + (mem.heapTotal / 1024 / 1024).toFixed(2) + " MB`\n” +
“🖥 Plataforma: `" + os.platform() + "`\n” +
“🟢 Node.js: `" + process.version + "`\n” + DIVIDER,
{ parse_mode: “Markdown” });
});

bot.onText(cmdExact(“about”), async function(msg) {
const me = await bot.getMe();
await bot.sendMessage(msg.chat.id,
“🤖 *Sobre el Bot*\n” + DIVIDER + “\n” +
“📛 Nombre: “ + me.first_name + “\n” +
“🔖 Username: @” + me.username + “\n” +
“🔢 ID: `" + me.id + "`\n” +
“💻 Lenguaje: JavaScript\n” + DIVIDER,
{ parse_mode: “Markdown” });
});

bot.onText(cmdExact(“help”), async function(msg) {
await bot.sendMessage(msg.chat.id,
“🤖 *Comandos Disponibles*\n” + DIVIDER + “\n” +
“*Usa `/comando` o `!comando`*\n\n” +
“👤 *Info de Usuario*\n” +
“ /id — ID del usuario\n” +
“ /userinfo — Info del usuario\n” +
“ /whois — Info extendida\n” +
“ /pfp — Foto de perfil\n” +
“ /avatar — Avatar\n” +
“ /roleinfo — Info de rol\n\n” +
“🏠 *Info del Grupo*\n” +
“ /serverinfo — Info del grupo\n” +
“ /members — Número de miembros\n” +
“ /admins — Lista de admins\n\n” +
“🛡 *Moderación* *(solo admins)*\n” +
“ /purge [n] — Borrar últimos N mensajes\n” +
“ /purge [n] @usuario — Borrar mensajes de usuario\n” +
“ /clear — Limpiar el chat\n\n” +
“🔒 *Control del Chat* *(solo admins)*\n” +
“ /lock [tiempo] — Bloquear chat (ej: 10m, 1h)\n” +
“ /unlock — Desbloquear chat\n” +
“ /pic — Desactivar fotos\n” +
“ /picremove — Activar fotos\n\n” +
“⚙️ *General*\n” +
“ /ping — Latencia\n” +
“ /uptime — Tiempo activo\n” +
“ /botstats — Estadísticas\n” +
“ /about — Sobre el bot\n” +
“ /help — Esta lista\n” + DIVIDER,
{ parse_mode: “Markdown” });
});

// ─── @ALL MENTION ─────────────────────────────────────────

bot.on(“message”, async function(msg) {
if (!msg.text || !msg.text.includes(”@all”)) return;
if (!isGroup(msg)) return;
const chatId = msg.chat.id;
const userId = msg.from && msg.from.id;
if (!userId) return;
if (!await isAdmin(chatId, userId)) { await sendTemp(chatId, “❌ Solo los administradores pueden usar @all.”); return; }
try {
const count = await bot.getChatMemberCount(chatId);
await bot.sendMessage(chatId,
“📢 *Mención masiva* — “ + count + “ miembros\n” + DIVIDER + “\n” +
“👤 Por: “ + (msg.from && msg.from.first_name) + “\n” +
“⚠️ Todos han sido notificados.”,
{ parse_mode: “Markdown”, reply_to_message_id: msg.message_id });
} catch { await sendTemp(chatId, “❌ No se pudo mencionar a todos.”); }
});

// ─── AUTO REMOVE DELETED ACCOUNTS ────────────────────────

bot.on(“message”, async function(msg) {
if (!msg.from || msg.from.first_name !== “Deleted Account”) return;
if (!isGroup(msg)) return;
const chatId = msg.chat.id;
if (!await botIsAdmin(chatId)) return;
try {
await bot.banChatMember(chatId, msg.from.id);
await bot.unbanChatMember(chatId, msg.from.id);
await bot.sendMessage(chatId,
“🗑 *Cuenta eliminada removida*\n” + DIVIDER + “\n🔢 ID: `" + msg.from.id + "`\n✅ Removido automáticamente.”,
{ parse_mode: “Markdown” });
} catch {}
});

bot.on(“chat_member”, async function(update) {
const chatId = update.chat.id;
const user = update.new_chat_member.user;
if (user.first_name !== “Deleted Account”) return;
if (!await botIsAdmin(chatId)) return;
try {
await bot.banChatMember(chatId, user.id);
await bot.unbanChatMember(chatId, user.id);
await bot.sendMessage(chatId,
“🗑 *Cuenta eliminada removida*\n” + DIVIDER + “\n🔢 ID: `" + user.id + "`\n✅ Removido automáticamente.”,
{ parse_mode: “Markdown” });
} catch {}
});

// ─── CHAT & USER UPDATE TRACKER ──────────────────────────

bot.on(“message”, async function(msg) {
const chatId = msg.chat.id;

if (msg.left_chat_member) {
const user = msg.left_chat_member;
const removedBy = msg.from;
const wasKicked = removedBy && removedBy.id !== user.id;
await bot.sendMessage(chatId,
wasKicked
? “🚫 *Miembro eliminado*\n” + DIVIDER + “\n👤 “ + user.first_name + (user.last_name ? “ “ + user.last_name : “”) + “\n🔖 “ + (user.username ? “@” + user.username : “Sin username”) + “\n🔢 ID: `" + user.id + "`\n👮 Por: “ + removedBy.first_name + (removedBy.username ? “ (@” + removedBy.username + “)” : “”)
: “👋 *Miembro salió*\n” + DIVIDER + “\n👤 “ + user.first_name + (user.last_name ? “ “ + user.last_name : “”) + “\n🔖 “ + (user.username ? “@” + user.username : “Sin username”) + “\n🔢 ID: `" + user.id + "`”,
{ parse_mode: “Markdown” });
}

if (msg.new_chat_title) {
await bot.sendMessage(chatId,
“✏️ *Nombre del grupo cambiado*\n” + DIVIDER + “\n📛 Nuevo nombre: *” + msg.new_chat_title + “*\n👤 Por: “ + ((msg.from && msg.from.first_name) || “Desconocido”),
{ parse_mode: “Markdown” });
}

if (msg.new_chat_photo) {
await bot.sendMessage(chatId,
“🖼 *Foto del grupo cambiada*\n” + DIVIDER + “\n👤 Por: “ + ((msg.from && msg.from.first_name) || “Desconocido”),
{ parse_mode: “Markdown” });
}

if (msg.delete_chat_photo) {
await bot.sendMessage(chatId,
“🗑 *Foto del grupo eliminada*\n” + DIVIDER + “\n👤 Por: “ + ((msg.from && msg.from.first_name) || “Desconocido”),
{ parse_mode: “Markdown” });
}

if (msg.pinned_message) {
await bot.sendMessage(chatId,
“📌 *Mensaje anclado*\n” + DIVIDER + “\n👤 Por: “ + ((msg.from && msg.from.first_name) || “Desconocido”),
{ parse_mode: “Markdown” });
}
});

bot.on(“chat_member”, async function(update) {
const chatId = update.chat.id;
const oldUser = update.old_chat_member.user;
const newUser = update.new_chat_member.user;
const changes = [];

if (oldUser.username !== newUser.username) {
changes.push(“🔖 *Username cambiado*\n Antes: “ + (oldUser.username ? “@” + oldUser.username : “Sin username”) + “\n Ahora: “ + (newUser.username ? “@” + newUser.username : “Sin username”));
}
if (oldUser.first_name !== newUser.first_name || oldUser.last_name !== newUser.last_name) {
changes.push(“📛 *Nombre cambiado*\n Antes: “ + oldUser.first_name + (oldUser.last_name ? “ “ + oldUser.last_name : “”) + “\n Ahora: “ + newUser.first_name + (newUser.last_name ? “ “ + newUser.last_name : “”));
}

if (changes.length > 0) {
await bot.sendMessage(chatId,
“🔔 *Actualización de Usuario*\n” + DIVIDER + “\n👤 “ + newUser.first_name + “ (`" + newUser.id + "`)\n” +
changes.join(”\n”) + “\n” + DIVIDER,
{ parse_mode: “Markdown” });
}
});

// ─── /iniciar COMMAND ─────────────────────────────────────

bot.onText(cmdExact(“iniciar”), async function(msg) {
await bot.sendMessage(msg.chat.id,
“👋 *Bienvenido a El Cartel De Las Mamacitas*\n” + DIVIDER + “\n🤖 Bot multipropósito activo y listo.\nSelecciona una opción:”,
{
parse_mode: “Markdown”,
reply_markup: {
inline_keyboard: [
[{ text: “📋 Help”, callback_data: “help” }],
[{ text: “🏓 Ping”, callback_data: “ping” }, { text: “🏠 Server Info”, callback_data: “serverinfo” }]
]
}
});
});

// ─── BUTTON HANDLERS ──────────────────────────────────────

bot.on(“callback_query”, async function(query) {
const msg = query.message;
const chatId = msg.chat.id;

if (query.data === “help”) {
await bot.answerCallbackQuery(query.id);
await bot.sendMessage(chatId,
“🤖 *Comandos Disponibles*\n” + DIVIDER + “\n” +
“*Usa `/comando` o `!comando`*\n\n” +
“👤 *Info de Usuario*\n /id /userinfo /whois /pfp /avatar /roleinfo\n\n” +
“🏠 *Info del Grupo*\n /serverinfo /members /admins\n\n” +
“🛡 *Moderación* *(admins)*\n /purge [n] /purge [n] @user /clear\n\n” +
“🔒 *Chat* *(admins)*\n /lock [tiempo] /unlock /pic /picremove\n\n” +
“⚙️ *General*\n /ping /uptime /botstats /about /help\n” + DIVIDER,
{ parse_mode: “Markdown” });
}

if (query.data === “ping”) {
await bot.answerCallbackQuery(query.id);
const start = Date.now();
const sent = await bot.sendMessage(chatId, “🏓 Calculando…”);
const latency = Date.now() - start;
await bot.editMessageText(“🏓 *Pong!*\n” + DIVIDER + “\n⚡ Latencia: `" + latency + "ms`”,
{ chat_id: chatId, message_id: sent.message_id, parse_mode: “Markdown” });
}

if (query.data === “serverinfo”) {
await bot.answerCallbackQuery(query.id);
if (msg.chat.type !== “group” && msg.chat.type !== “supergroup”) {
await bot.sendMessage(chatId, “❌ Este comando solo funciona en grupos.”); return;
}
try {
const chat = await bot.getChat(chatId);
const memberCount = await bot.getChatMemberCount(chatId);
const admins = await bot.getChatAdministrators(chatId);
await bot.sendMessage(chatId,
“🏠 *Info del Grupo*\n” + DIVIDER + “\n” +
“📛 Nombre: “ + (chat.title || “Sin nombre”) + “\n” +
“🔢 ID: `" + chat.id + "`\n” +
“🔗 Username: “ + (chat.username ? “@” + chat.username : “Sin username”) + “\n” +
“👥 Miembros: “ + memberCount + “\n” +
“🛡 Admins: “ + admins.length + “\n” +
“📝 Tipo: “ + chat.type + “\n” + DIVIDER,
{ parse_mode: “Markdown” });
} catch { await bot.sendMessage(chatId, “❌ Error al obtener info del grupo.”); }
}
});

// ─── WELCOME MESSAGE ──────────────────────────────────────

bot.on(“message”, async function(msg) {
if (!msg.new_chat_members) return;
const chatId = msg.chat.id;
for (const user of msg.new_chat_members) {
if (user.is_bot) continue;
const username = user.username ? “@” + user.username : user.first_name;
const memberCount = await bot.getChatMemberCount(chatId).catch(function() { return “?”; });
await bot.sendMessage(chatId,
“✨ *Bienvenida al Cartel* ✨\n” + DIVIDER + “\n” +
“👋 Hola “ + username + “, nos alegra tenerte aquí.\n\n” +
“🏠 *El Cartel De Las Mamacitas*\n” +
“👥 Ahora somos *” + memberCount + “* miembros.\n\n” +
“📌 Usa /help para ver todo lo que puedes hacer.\n” + DIVIDER,
{ parse_mode: “Markdown” });
}
});

// ─── DELETE TELEGRAM SYSTEM MESSAGES ─────────────────────

bot.on(“message”, async function(msg) {
if (msg.new_chat_members || msg.left_chat_member || msg.new_chat_title || msg.new_chat_photo || msg.delete_chat_photo || msg.pinned_message) {
try { await bot.deleteMessage(msg.chat.id, msg.message_id); } catch {}
}
});

// ─── ERROR HANDLER ────────────────────────────────────────

bot.on(“polling_error”, function(error) { console.error(“❌ Error de polling:”, error.message); });
process.on(“unhandledRejection”, function(reason) { console.error(“❌ Promesa rechazada:”, reason); });

// ─── EXPRESS SERVER ───────────────────────────────────────

const app = express();
const PORT = process.env.PORT || 4000;
app.get(”/”, function(_req, res) { res.send(“🤖 Bot activo ✅”); });
app.listen(PORT, function() { console.log(“🚀 Servidor activo en el puerto “ + PORT); });
