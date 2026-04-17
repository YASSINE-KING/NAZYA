/**
 * Naziya Bot - WhatsApp Bot
 * Specialized Group Management Bot
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 * 
 * Credits:
 * - Baileys Library by @adiwajshing
 * - Pair Code implementation inspired by various sources
 */

require('./config');
const { Boom } = require('@hapi/boom');
const fs = require('fs');
const chalk = require('chalk');
const path = require('path');
const { handleMessage } = require('./handler');
const PhoneNumber = require('awesome-phonenumber');
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    jidDecode,
    jidNormalizedUser,
    makeCacheableSignalKeyStore,
    delay
} = require("@whiskeysockets/baileys");
const NodeCache = require("node-cache");
const pino = require("pino");
const readline = require("readline");
const { rmSync } = require('fs');

// ============================
// CONFIGURATION
// ============================
const config = require('./config');

// متغيرات البوت
global.botname = config.botName;
global.themeemoji = "卐";
global.privateMode = false;
global.ownerNumber = config.ownerNumber;

// رقم الهاتف للاقتران (ضع رقم البوت هنا)
let phoneNumber = config.ownerNumber.split('@')[0];
let pairingCode = !!phoneNumber || process.argv.includes("--pairing-code");
const useMobile = process.argv.includes("--mobile");

// إنشاء واجهة readline فقط إذا كنا في بيئة تفاعلية
const rl = process.stdin.isTTY ? readline.createInterface({ input: process.stdin, output: process.stdout }) : null;
const question = (text) => {
    if (rl) {
        return new Promise((resolve) => rl.question(text, resolve));
    } else {
        return Promise.resolve(phoneNumber);
    }
};

// ============================
// MAIN BOT FUNCTION
// ============================
async function startNaziyaBot() {
    let { version, isLatest } = await fetchLatestBaileysVersion();
    const { state, saveCreds } = await useMultiFileAuthState(`./session`);
    const msgRetryCounterCache = new NodeCache();

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: !pairingCode,
        browser: ["NaziyaBot", "Chrome", "1.0.0"],
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
        },
        markOnlineOnConnect: true,
        generateHighQualityLinkPreview: true,
        syncFullHistory: true,
        getMessage: async (key) => {
            return null;
        },
        msgRetryCounterCache,
        defaultQueryTimeoutMs: undefined,
    });

    // دالة فك تشفير JID
    sock.decodeJid = (jid) => {
        if (!jid) return jid;
        if (/:\d+@/gi.test(jid)) {
            let decode = jidDecode(jid) || {};
            return decode.user && decode.server && decode.user + '@' + decode.server || jid;
        } else return jid;
    };

    // ============================
    // PAIRING CODE HANDLER
    // ============================
    if (pairingCode && !sock.authState.creds.registered) {
        if (useMobile) throw new Error('Cannot use pairing code with mobile api');
        
        let inputPhoneNumber;
        if (!!phoneNumber) {
            inputPhoneNumber = phoneNumber;
        } else {
            inputPhoneNumber = await question(chalk.bgBlack(chalk.greenBright(`📱 Please type your WhatsApp number:\nFormat: 212675832769 (without + or spaces): `)));
        }
        
        // تنظيف رقم الهاتف
        inputPhoneNumber = inputPhoneNumber.replace(/[^0-9]/g, '');
        
        // التحقق من صحة الرقم
        const pn = require('awesome-phonenumber');
        if (!pn('+' + inputPhoneNumber).isValid()) {
            console.log(chalk.red('❌ Invalid phone number. Please enter your full international number without + or spaces.'));
            process.exit(1);
        }
        
        setTimeout(async () => {
            try {
                let code = await sock.requestPairingCode(inputPhoneNumber);
                code = code?.match(/.{1,4}/g)?.join("-") || code;
                console.log(chalk.black(chalk.bgGreen(`🔐 Your Pairing Code: `)), chalk.black(chalk.white(code)));
                console.log(chalk.yellow(`\n📱 Please enter this code in your WhatsApp app:\n1. Open WhatsApp\n2. Go to Settings > Linked Devices\n3. Tap "Link a Device"\n4. Enter the code shown above`));
            } catch (error) {
                console.error('❌ Error requesting pairing code:', error);
                console.log(chalk.red('Failed to get pairing code. Please check your phone number and try again.'));
            }
        }, 3000);
    }

    // ============================
    // MESSAGE HANDLER
    // ============================
    sock.ev.on('messages.upsert', async (chatUpdate) => {
        try {
            const msg = chatUpdate.messages[0];
            if (!msg.message) return;
            
            // تجاهل رسائل الحالة
            if (msg.key && msg.key.remoteJid === 'status@broadcast') return;
            
            // تجاهل رسائل النظام
            if (msg.key.id.startsWith('BAE5') && msg.key.id.length === 16) return;
            
            // معالجة الرسالة
            await handleMessage(sock, msg);
            
            // تنظيف الذاكرة
            if (sock?.msgRetryCounterCache) {
                sock.msgRetryCounterCache.clear();
            }
        } catch (err) {
            console.error("Error in messages.upsert:", err);
        }
    });

    // ============================
    // CONNECTION HANDLER
    // ============================
    sock.ev.on('connection.update', async (s) => {
        const { connection, lastDisconnect } = s;
        
        if (connection == "open") {
            console.log(chalk.magenta(`\n`));
            console.log(chalk.yellow(`✅ Connected to: ${JSON.stringify(sock.user, null, 2)}`));
            console.log(chalk.cyan(`\n< ================================================== >`));
            console.log(chalk.magenta(`\n${global.themeemoji} Bot Name: ${global.botname}`));
            console.log(chalk.magenta(`${global.themeemoji} Status: Online & Ready`));
            console.log(chalk.magenta(`${global.themeemoji} Owner: ${config.ownerNumber.split('@')[0]}`));
            console.log(chalk.green(`\n✅ Bot Connected Successfully!`));
            console.log(chalk.cyan(`< ================================================== >\n`));
            
            // إرسال رسالة تأكيد للمالك
            try {
                await sock.sendMessage(config.ownerNumber, {
                    text: `🤖 *${global.botname}* is Online!\n\n⏰ Time: ${new Date().toLocaleString()}\n✅ Status: Ready to serve!\n\n*Commands:*\n.تست - Check bot status\n.حوي - Group nuke\n.ترقية @user - Promote\n.خفض @user - Demote\n.خاص - Private mode\n.اضافة نخبة @user - Add elite`
                });
            } catch (e) {}
        }
        
        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            console.log(chalk.red(`⚠️ Connection closed! Status code: ${statusCode}`));
            
            if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
                try {
                    rmSync('./session', { recursive: true, force: true });
                } catch (e) {}
                console.log(chalk.red('Session logged out. Please re-authenticate.'));
                startNaziyaBot();
            } else {
                console.log(chalk.yellow('Reconnecting...'));
                startNaziyaBot();
            }
        }
    });

    // ============================
    // CREDENTIALS HANDLER
    // ============================
    sock.ev.on('creds.update', saveCreds);

    return sock;
}

// ============================
// START BOT WITH ERROR HANDLING
// ============================
startNaziyaBot().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});

// ============================
// PROCESS HANDLERS
// ============================
process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception:', err);
});

process.on('unhandledRejection', (err) => {
    console.error('❌ Unhandled Rejection:', err);
});

// ============================
// AUTO RESTART ON FILE CHANGE
// ============================
let file = require.resolve(__filename);
fs.watchFile(file, () => {
    fs.unwatchFile(file);
    console.log(chalk.redBright(`🔄 Updating ${__filename}`));
    delete require.cache[file];
    require(file);
});