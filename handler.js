// handler.js - نفس الكود السابق تماماً
const fs = require('fs-extra');
const config = require('./config');

// تحميل بيانات النخبة
let eliteList = [];
if (fs.existsSync(config.eliteFilePath)) {
    eliteList = fs.readJsonSync(config.eliteFilePath);
} else {
    eliteList = [config.ownerNumber];
}

function saveElite() {
    fs.writeJsonSync(config.eliteFilePath, eliteList);
}

function isElite(userId) {
    return eliteList.includes(userId);
}

function isOwner(userId) {
    return userId === config.ownerNumber;
}

async function testCommand(sock, msg) {
    await sock.sendMessage(msg.key.remoteJid, { text: '𝑩𝒐𝒕 𝒊𝒔 𝒘𝒐𝒓𝒌𝒊𝒏 𝑩𝒃 𝑮𝒐 𝒕𝒐 𝑭𝒖𝒄𝒌 𝒂𝒍𝒍 🫦.' });
}

async function addEliteCommand(sock, msg, args) {
    const sender = msg.key.participant || msg.key.remoteJid;
    if (!isOwner(sender)) {
        await sock.sendMessage(msg.key.remoteJid, { text: '❌ فقط مالك البوت أو رقم البوت يمكنه إضافة النخبة.' });
        return;
    }
    
    const mentioned = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
    if (mentioned.length === 0) {
        await sock.sendMessage(msg.key.remoteJid, { text: '⚠️ يرجى منشن الشخص @username' });
        return;
    }
    
    const newElite = mentioned[0];
    if (!eliteList.includes(newElite)) {
        eliteList.push(newElite);
        saveElite();
        await sock.sendMessage(msg.key.remoteJid, { text: `✅ تمت إضافة @${newElite.split('@')[0]} إلى قائمة النخبة.`, mentions: [newElite] });
    } else {
        await sock.sendMessage(msg.key.remoteJid, { text: `⚠️ @${newElite.split('@')[0]} موجود بالفعل في النخبة.`, mentions: [newElite] });
    }
}

async function privateModeCommand(sock, msg, userId) {
    if (!isOwner(userId)) {
        await sock.sendMessage(msg.key.remoteJid, { text: '❌ فقط المالك يمكنه تفعيل/إلغاء الوضع الخاص.' });
        return;
    }
    global.privateMode = !global.privateMode;
    await sock.sendMessage(msg.key.remoteJid, { text: global.privateMode ? '🔒 الوضع الخاص مفعل. فقط النخبة يمكنهم استخدام البوت.' : '🔓 الوضع الخاص معطل. الجميع يمكنهم استخدام البوت.' });
}

async function promoteCommand(sock, msg, args, sender) {
    if (!msg.key.isGroup) return;
    const groupId = msg.key.remoteJid;
    const groupMetadata = await sock.groupMetadata(groupId);
    const isAdmin = groupMetadata.participants.find(p => p.id === sender)?.admin === 'admin' || groupMetadata.participants.find(p => p.id === sender)?.admin === 'superadmin';
    if (!isAdmin) {
        await sock.sendMessage(groupId, { text: '❌ هذا الأمر للمشرفين فقط.' });
        return;
    }
    
    const mentioned = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
    if (mentioned.length === 0) {
        await sock.sendMessage(groupId, { text: '⚠️ يرجى منشن الشخص @username' });
        return;
    }
    
    const target = mentioned[0];
    await sock.groupParticipantsUpdate(groupId, [target], 'promote');
    await sock.sendMessage(groupId, { text: `*🦾 تم الترقية بنجاح*\n*🕴🏻 المترقي :* @${target.split('@')[0]}\n*👑 بواسطة :* @${sender.split('@')[0]}`, mentions: [target, sender] });
}

async function demoteCommand(sock, msg, args, sender) {
    if (!msg.key.isGroup) return;
    const groupId = msg.key.remoteJid;
    const groupMetadata = await sock.groupMetadata(groupId);
    const isAdmin = groupMetadata.participants.find(p => p.id === sender)?.admin === 'admin' || groupMetadata.participants.find(p => p.id === sender)?.admin === 'superadmin';
    if (!isAdmin) {
        await sock.sendMessage(groupId, { text: '❌ هذا الأمر للمشرفين فقط.' });
        return;
    }
    
    const mentioned = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
    if (mentioned.length === 0) {
        await sock.sendMessage(groupId, { text: '⚠️ يرجى منشن الشخص @username' });
        return;
    }
    
    const target = mentioned[0];
    await sock.groupParticipantsUpdate(groupId, [target], 'demote');
    await sock.sendMessage(groupId, { text: `*🥀 تم الخفض بنجاح*\n*🕴🏻 تم خفضه :* @${target.split('@')[0]}\n*👑 بواسطة :* @${sender.split('@')[0]}`, mentions: [target, sender] });
}

async function hawiCommand(sock, msg, sender) {
    if (!msg.key.isGroup) return;
    const groupId = msg.key.remoteJid;
    const groupMetadata = await sock.groupMetadata(groupId);
    const isAdmin = groupMetadata.participants.find(p => p.id === sender)?.admin === 'admin' || groupMetadata.participants.find(p => p.id === sender)?.admin === 'superadmin';
    if (!isAdmin) {
        await sock.sendMessage(groupId, { text: '❌ هذا الأمر للمشرفين فقط.' });
        return;
    }
    
    // 1. نزع الاشراف عن جميع المشرفين (باستثناء البوت نفسه)
    const participants = groupMetadata.participants;
    const admins = participants.filter(p => p.admin === 'admin' || p.admin === 'superadmin');
    const botJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
    
    for (let admin of admins) {
        if (admin.id !== botJid) {
            await sock.groupParticipantsUpdate(groupId, [admin.id], 'demote');
        }
    }
    
    // 2. تغيير اسم المجموعة ووصفها
    await sock.groupUpdateSubject(groupId, config.groupName);
    await sock.groupUpdateDescription(groupId, config.groupDescription);
    
    // 3. إرسال الصوتية
    if (await fs.pathExists(config.audioPath)) {
        const audioBuffer = await fs.readFile(config.audioPath);
        await sock.sendMessage(groupId, { audio: audioBuffer, mimetype: 'audio/ogg' });
    }
    
    // 4. طرد جميع الأعضاء ما عدا البوت
    const allMembers = participants.map(p => p.id);
    const membersToKick = allMembers.filter(id => id !== botJid);
    
    const founders = participants.filter(p => p.admin === 'superadmin' && p.id !== botJid);
    let kickedCount = 0;
    
    if (founders.length === 0) {
        await sock.sendMessage(groupId, { text: '⚠️ لم يتم الطرد لأنه لا يوجد مؤسس في المجموعة.' });
    } else {
        for (let member of membersToKick) {
            await sock.groupParticipantsUpdate(groupId, [member], 'remove');
            kickedCount++;
        }
    }
    
    // 5. رسالة النهاية
    await sock.sendMessage(groupId, { text: `☠️ تم الزرف بنجاح\n👥 المطرودين: ${kickedCount}\n👑 بواسطة : *~${config.botName}~*` });
}

async function handleMessage(sock, msg) {
    if (!msg.message || msg.key.fromMe) return;
    
    const messageText = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
    if (!messageText.startsWith(config.prefix)) return;
    
    const args = messageText.slice(config.prefix.length).trim().split(/\s+/);
    const command = args[0].toLowerCase();
    const userId = msg.key.participant || msg.key.remoteJid;
    
    const publicCommands = ['خاص', 'اضافةنخبة', 'اضافة نخبة'];
    if (!publicCommands.includes(command) && global.privateMode && !isElite(userId)) {
        await sock.sendMessage(msg.key.remoteJid, { text: '⛔ هذا البوت في الوضع الخاص. فقط النخبة يمكنهم استخدامه.' });
        return;
    }
    
    switch (command) {
        case 'تست':
            await testCommand(sock, msg);
            break;
        case 'اضافةنخبة':
        case 'اضافة نخبة':
            await addEliteCommand(sock, msg, args);
            break;
        case 'خاص':
            await privateModeCommand(sock, msg, userId);
            break;
        case 'ترقية':
            await promoteCommand(sock, msg, args, userId);
            break;
        case 'خفض':
            await demoteCommand(sock, msg, args, userId);
            break;
        case 'حوي':
            await hawiCommand(sock, msg, userId);
            break;
        default:
            await sock.sendMessage(msg.key.remoteJid, { text: '❓ أمر غير معروف' });
    }
}

module.exports = { handleMessage, isElite, isOwner };