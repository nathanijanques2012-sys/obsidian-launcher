// UPnP IGD mínimo (sem dependências): descobre o roteador via SSDP e
// abre/fecha porta via SOAP. Serve p/ expor servidor MC na internet sem
// configurar roteador na mão. Timeouts curtos: sem UPnP, falha rápido.
const dgram = require('dgram');
const http = require('http');

function ssdpDiscover(timeoutMs = 5000) {
  return new Promise((resolve) => {
    const locations = new Set();
    let sock;
    try { sock = dgram.createSocket('udp4'); } catch { resolve([]); return; }
    const done = () => { try { sock.close(); } catch {} resolve([...locations]); };
    sock.on('error', done);
    sock.on('message', (buf) => {
      const m = buf.toString('latin1').match(/^location:\s*(.+?)\s*$/im);
      if (m) locations.add(m[1]);
    });
    try {
      sock.bind(() => {
        for (const st of [
          'urn:schemas-upnp-org:device:InternetGatewayDevice:1',
          'urn:schemas-upnp-org:service:WANIPConnection:1',
        ]) {
          const msg = Buffer.from(
            'M-SEARCH * HTTP/1.1\r\n' +
            'HOST: 239.255.255.250:1900\r\n' +
            'MAN: "ns=01; ns=01;"\r\n' +
            'MX: 2\r\n' +
            `ST: ${st}\r\n\r\n`);
          try { sock.send(msg, 1900, '239.255.255.250'); } catch {}
        }
      });
    } catch { done(); return; }
    setTimeout(done, timeoutMs).unref?.();
  });
}

function httpReq(url, { method = 'GET', headers = {}, body = null, timeoutMs = 8000 } = {}) {
  return new Promise((resolve, reject) => {
    let u;
    try { u = new URL(url); } catch (e) { reject(e); return; }
    if (u.protocol !== 'http:') return reject(new Error('só HTTP local'));
    const req = http.request(
      { host: u.hostname, port: u.port || 80, path: u.pathname + u.search, method, headers, timeout: timeoutMs },
      (res) => {
        let data = '';
        res.on('data', (c) => { data += c; if (data.length > 512 * 1024) req.destroy(); });
        res.on('end', () => resolve({ status: res.statusCode, body: data }));
      });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('timeout')));
    if (body) req.write(body);
    req.end();
  });
}

async function findWanService() {
  // retorna { controlUrl, serviceType } do WANIPConnection (ou PPP de fallback)
  const locs = await ssdpDiscover();
  for (const loc of locs) {
    let xml;
    try {
      const r = await httpReq(loc, { timeoutMs: 6000 });
      if (r.status !== 200) continue;
      xml = r.body;
    } catch { continue; }
    const services = [...xml.matchAll(/<service>([\s\S]*?)<\/service>/g)].map(m => m[1]);
    const blk = services.find(b => /WANIPConnection/.test(b)) || services.find(b => /WANPPPConnection/.test(b));
    if (!blk) continue;
    const type = (blk.match(/<serviceType>([^<]+)<\/serviceType>/) || [])[1];
    const ctrl = (blk.match(/<controlURL>([^<]+)<\/controlURL>/) || [])[1];
    if (!type || !ctrl) continue;
    return { controlUrl: new URL(ctrl.trim(), loc).toString(), serviceType: type.trim() };
  }
  throw new Error('roteador UPnP não encontrado (ative UPnP no roteador)');
}

async function soap(controlUrl, serviceType, action, params) {
  const body =
    `<?xml version="1.0" encoding="utf-8"?>` +
    `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">` +
    `<s:Body><u:${action} xmlns:u="${serviceType}">${params}</u:${action}></s:Body></s:Envelope>`;
  const r = await httpReq(controlUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset="utf-8"',
      'SOAPAction': `"${serviceType}#${action}"`,
      'Content-Length': Buffer.byteLength(body),
    },
    body,
    timeoutMs: 8000,
  });
  if (r.status !== 200) {
    const code = (r.body.match(/<errorCode>(\d+)<\/errorCode>/) || [])[1] || r.status;
    throw new Error(`UPnP ${action} falhou (${code})`);
  }
  return r.body;
}

const P = (k, v) => `<${k}>${v}</${k}>`;

async function mapPort({ publicPort, privatePort, lan, description }) {
  const svc = await findWanService();
  await soap(svc.controlUrl, svc.serviceType, 'AddPortMapping', [
    P('NewRemoteHost', ''),
    P('NewExternalPort', publicPort),
    P('NewProtocol', 'TCP'),
    P('NewInternalPort', privatePort),
    P('NewInternalClient', lan),
    P('NewEnabled', '1'),
    P('NewPortMappingDescription', String(description || 'Obsidian').slice(0, 40)),
    P('NewLeaseDuration', '0'),
  ].join(''));
  const extXml = await soap(svc.controlUrl, svc.serviceType, 'GetExternalIPAddress', '');
  const externalIp = (extXml.match(/<NewExternalIPAddress>([^<]+)<\/NewExternalIPAddress>/) || [])[1] || '';
  return { ...svc, externalIp };
}

async function unmapPort({ publicPort, controlUrl, serviceType }) {
  const svc = controlUrl ? { controlUrl, serviceType } : await findWanService();
  try {
    await soap(svc.controlUrl, svc.serviceType, 'DeletePortMapping', [
      P('NewRemoteHost', ''),
      P('NewExternalPort', publicPort),
      P('NewProtocol', 'TCP'),
    ].join(''));
  } catch (e) {
    if (!/\(714\)/.test(String(e.message))) throw e; // 714 = já não existe: ok
  }
}

module.exports = { mapPort, unmapPort, findWanService };
