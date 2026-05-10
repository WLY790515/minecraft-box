"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const net = require("net");
function _interopNamespaceDefault(e) {
  const n = Object.create(null, { [Symbol.toStringTag]: { value: "Module" } });
  if (e) {
    for (const k in e) {
      if (k !== "default") {
        const d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: () => e[k]
        });
      }
    }
  }
  n.default = e;
  return Object.freeze(n);
}
const net__namespace = /* @__PURE__ */ _interopNamespaceDefault(net);
function writeVarInt(value) {
  const bytes = [];
  let v = value >>> 0;
  do {
    let byte = v & 127;
    v >>>= 7;
    if (v !== 0)
      byte |= 128;
    bytes.push(byte);
  } while (v !== 0);
  return Buffer.from(bytes);
}
function readVarInt(buf, offset = 0) {
  let value = 0;
  let shift = 0;
  let bytesRead = 0;
  while (true) {
    if (offset + bytesRead >= buf.length) {
      throw new Error("Buffer too short to read VarInt");
    }
    const byte = buf[offset + bytesRead];
    bytesRead++;
    value |= (byte & 127) << shift;
    shift += 7;
    if ((byte & 128) === 0)
      break;
    if (shift >= 35)
      throw new Error("VarInt too large");
  }
  return { value, bytesRead };
}
function writeString(str) {
  const encoded = Buffer.from(str, "utf8");
  return Buffer.concat([writeVarInt(encoded.length), encoded]);
}
function buildHandshakePacket(host, port, protocolVersion = 47) {
  const packetId = writeVarInt(0);
  const protocol = writeVarInt(protocolVersion);
  const hostBuf = writeString(host);
  const portBuf = Buffer.allocUnsafe(2);
  portBuf.writeUInt16BE(port, 0);
  const nextState = writeVarInt(1);
  const payload = Buffer.concat([packetId, protocol, hostBuf, portBuf, nextState]);
  return Buffer.concat([writeVarInt(payload.length), payload]);
}
function buildStatusRequestPacket() {
  const payload = writeVarInt(0);
  return Buffer.concat([writeVarInt(payload.length), payload]);
}
function buildPingPacket() {
  const packetId = writeVarInt(1);
  const payload = Buffer.alloc(8);
  payload.writeBigInt64BE(BigInt(Date.now()), 0);
  const data = Buffer.concat([packetId, payload]);
  return Buffer.concat([writeVarInt(data.length), data]);
}
function pingJava(host, port = 25565, timeout = 5e3) {
  return new Promise((resolve) => {
    const socket = net__namespace.createConnection({ host, port });
    let buffer = Buffer.alloc(0);
    let pingStart = 0;
    let settled = false;
    const done = (result) => {
      if (settled)
        return;
      settled = true;
      socket.destroy();
      resolve(result);
    };
    const timer = setTimeout(() => {
      done({ online: false, error: `Connection timed out after ${timeout}ms` });
    }, timeout);
    socket.once("connect", () => {
      socket.write(buildHandshakePacket(host, port));
      socket.write(buildStatusRequestPacket());
    });
    socket.on("data", (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      try {
        const { value: packetLength, bytesRead: lenBytes } = readVarInt(buffer);
        if (buffer.length < lenBytes + packetLength)
          return;
        const packet = buffer.slice(lenBytes, lenBytes + packetLength);
        const { value: packetId, bytesRead: idBytes } = readVarInt(packet);
        if (packetId === 0) {
          const { value: jsonLen, bytesRead: jlBytes } = readVarInt(packet, idBytes);
          const json = packet.slice(idBytes + jlBytes, idBytes + jlBytes + jsonLen).toString("utf8");
          const data = JSON.parse(json);
          pingStart = Date.now();
          socket.write(buildPingPacket());
          buffer = Buffer.alloc(0);
          socket.once("data", () => {
            var _a, _b, _c, _d, _e, _f;
            clearTimeout(timer);
            done({
              online: true,
              version: {
                name: ((_a = data.version) == null ? void 0 : _a.name) ?? "Unknown",
                protocol: ((_b = data.version) == null ? void 0 : _b.protocol) ?? 0
              },
              players: {
                online: ((_c = data.players) == null ? void 0 : _c.online) ?? 0,
                max: ((_d = data.players) == null ? void 0 : _d.max) ?? 0,
                sample: ((_e = data.players) == null ? void 0 : _e.sample) ?? []
              },
              motd: typeof data.description === "string" ? data.description : ((_f = data.description) == null ? void 0 : _f.text) ?? "",
              favicon: data.favicon,
              ping: Date.now() - pingStart
            });
          });
        }
      } catch {
      }
    });
    socket.on("error", (err) => {
      clearTimeout(timer);
      done({ online: false, error: err.message });
    });
    socket.on("close", () => {
      clearTimeout(timer);
      if (!settled) {
        done({ online: false, error: "Connection closed unexpectedly" });
      }
    });
  });
}
exports.pingJava = pingJava;
