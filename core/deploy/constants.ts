export const constants = {
  a: "https://proxy-server-blue-l6vsfbzhba-uw.a.run.app",
  // a: "https://server.dropstone.io",
  b: "1710787199603",
  c: "NfZFVegMpdyT3P5UmAggr7T7Hb6PlcbB",
};

export function getTimestamp() {
  const x = Date.now().toString();
  const l = new Date().getMinutes();
  let j = Math.floor(l / 2) + 10;
  return x.slice(0, -2) + j.toString();
}
