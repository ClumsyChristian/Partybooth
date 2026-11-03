/* PartyBooth desktop — small dependency-free SMTP client (SSL/TLS on 465, STARTTLS on 587, AUTH PLAIN/LOGIN, attachments) */
'use strict';
const net = require('net');
const tls = require('tls');
const crypto = require('crypto');

function encodeHeader(s) {
  s = String(s || '');
  return /[^\x20-\x7e]/.test(s) ? `=?UTF-8?B?${Buffer.from(s, 'utf8').toString('base64')}?=` : s;
}
function wrap76(b64) { return b64.replace(/.{1,76}/g, '$&\r\n'); }
function cleanAddr(a) { return String(a || '').trim().replace(/[<>\r\n]/g, ''); }

function buildMessage(o, recipients) {
  const mixed = 'pbm-' + crypto.randomBytes(12).toString('hex');
  const alt = 'pba-' + crypto.randomBytes(12).toString('hex');
  const fromName = o.fromName ? `"${encodeHeader(o.fromName).replace(/"/g, "'")}" ` : '';
  const domain = (cleanAddr(o.from).split('@')[1] || 'partybooth.local');
  const head = [
    `From: ${fromName}<${cleanAddr(o.from)}>`,
    `To: ${recipients.join(', ')}`,
    `Subject: ${encodeHeader(o.subject).replace(/[\r\n]+/g, ' ')}`,
    `Date: ${new Date().toUTCString().replace('GMT', '+0000')}`,
    `Message-ID: <${crypto.randomBytes(16).toString('hex')}@${domain}>`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${mixed}"`,
  ];
  const parts = [];
  parts.push(`--${mixed}\r\nContent-Type: multipart/alternative; boundary="${alt}"\r\n\r\n` +
    `--${alt}\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${wrap76(Buffer.from(o.text || '', 'utf8').toString('base64'))}` +
    (o.html ? `--${alt}\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${wrap76(Buffer.from(o.html, 'utf8').toString('base64'))}` : '') +
    `--${alt}--\r\n`);
  for (const a of o.attachments || []) {
    const fn = String(a.filename || 'photo.jpg').replace(/["\r\n]/g, '');
    parts.push(`--${mixed}\r\nContent-Type: ${a.contentType || 'application/octet-stream'}; name="${fn}"\r\nContent-Transfer-Encoding: base64\r\nContent-Disposition: attachment; filename="${fn}"\r\n\r\n${wrap76(String(a.data).replace(/\s+/g, ''))}`);
  }
  const msg = head.join('\r\n') + '\r\n\r\n' + parts.join('') + `--${mixed}--\r\n`;
  return msg.replace(/\r\n\./g, '\r\n..'); // dot-stuffing
}

/**
 * sendMail({smtp:{host,port,secure,user,pass}, from, fromName, to, subject, text, html, attachments:[{filename, contentType, data(base64)}]})
 * Resolves {ok:true} or {ok:false, error}
 */
function sendMail(o) {
  return new Promise(resolve => {
    const { host, user, pass } = o.smtp || {};
    const port = Number((o.smtp || {}).port) || 465;
    const secure = (o.smtp || {}).secure !== undefined ? !!o.smtp.secure : port === 465;
    const recipients = String(o.to || '').split(/[,;\s]+/).map(cleanAddr).filter(Boolean);
    if (!host) return resolve({ ok: false, error: 'No mail server set.' });
    if (!recipients.length) return resolve({ ok: false, error: 'No recipient.' });
    if (!o.from) return resolve({ ok: false, error: 'No sender address.' });

    let sock = null, buf = '', waiter = null, done = false;
    const timer = setTimeout(() => finish({ ok: false, error: 'The mail server did not answer in time.' }), 60000);
    function finish(res) { if (done) return; done = true; clearTimeout(timer); try { sock && sock.end(); } catch (e) { /* ignore */ } resolve(res); }
    function onData(d) { buf += d.toString('utf8'); check(); }
    function check() {
      if (!waiter) return;
      const lines = buf.split('\r\n');
      for (let i = 0; i < lines.length - 1; i++) {
        if (/^\d{3}(?: |$)/.test(lines[i])) {
          const reply = lines.slice(0, i + 1); buf = lines.slice(i + 1).join('\r\n');
          const w = waiter; waiter = null; w({ code: parseInt(lines[i].slice(0, 3), 10), text: reply.join('\n') });
          return;
        }
      }
    }
    const read = () => new Promise(r => { waiter = r; check(); });
    async function cmd(line, expect, label) {
      sock.write(line + '\r\n');
      const r = await read();
      if (expect && !expect.includes(r.code)) throw new Error(`${label || line.split(' ')[0]} was refused: ${r.text.replace(/\s+/g, ' ').slice(0, 200)}`);
      return r;
    }
    function attach(s) {
      sock = s; s.on('data', onData);
      s.on('error', e => finish({ ok: false, error: friendly(e) }));
      s.on('close', () => { if (!done) finish({ ok: false, error: 'The mail server closed the connection.' }); });
    }
    function friendly(e) {
      if (e.code === 'ENOTFOUND') return `Cannot find the mail server "${host}". Check the server name and the internet connection.`;
      if (e.code === 'ECONNREFUSED') return `The mail server refused the connection on port ${port}.`;
      if (e.code === 'ETIMEDOUT') return 'Connecting to the mail server timed out.';
      if (/wrong version number|ssl3_get_record/i.test(e.message)) return 'SSL setting does not match the port. Use SSL with 465, or turn SSL off for 587.';
      return e.message;
    }
    async function run() {
      const ehloName = 'partybooth.local';
      let r = await read(); if (r.code !== 220) throw new Error('Unexpected greeting: ' + r.text);
      r = await cmd('EHLO ' + ehloName, [250]);
      if (!secure && /STARTTLS/i.test(r.text)) {
        await cmd('STARTTLS', [220]);
        sock.removeListener('data', onData); sock.removeAllListeners('close'); sock.removeAllListeners('error');
        const plain = sock;
        const t = tls.connect({ socket: plain, servername: host });
        await new Promise((res, rej) => { t.once('secureConnect', res); t.once('error', rej); });
        buf = ''; attach(t);
        r = await cmd('EHLO ' + ehloName, [250]);
      }
      if (user) {
        if (/AUTH[ =][^\n]*\bPLAIN\b/i.test(r.text)) await cmd('AUTH PLAIN ' + Buffer.from(`\u0000${user}\u0000${pass || ''}`, 'utf8').toString('base64'), [235], 'Login');
        else {
          await cmd('AUTH LOGIN', [334], 'Login');
          await cmd(Buffer.from(user, 'utf8').toString('base64'), [334], 'Login');
          await cmd(Buffer.from(pass || '', 'utf8').toString('base64'), [235], 'Login (check the password / app password)');
        }
      }
      await cmd(`MAIL FROM:<${cleanAddr(o.from)}>`, [250], 'Sender');
      for (const rc of recipients) await cmd(`RCPT TO:<${rc}>`, [250, 251], 'Recipient ' + rc);
      await cmd('DATA', [354]);
      sock.write(buildMessage(o, recipients) + '\r\n.\r\n');
      r = await read(); if (r.code !== 250) throw new Error('Message was refused: ' + r.text);
      try { sock.write('QUIT\r\n'); } catch (e) { /* ignore */ }
      finish({ ok: true });
    }
    try {
      if (secure) {
        const s = tls.connect({ host, port, servername: host });
        attach(s);
        s.once('secureConnect', () => run().catch(e => finish({ ok: false, error: e.message })));
      } else {
        const s = net.connect({ host, port });
        attach(s);
        s.once('connect', () => run().catch(e => finish({ ok: false, error: e.message })));
      }
    } catch (e) { finish({ ok: false, error: e.message }); }
  });
}

module.exports = { sendMail, buildMessage };
