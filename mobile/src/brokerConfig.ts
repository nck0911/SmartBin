export function mqttBrokerUrl(value: string | undefined): string {
  const address = value?.trim();
  if (!address) throw new Error('Chưa cấu hình kết nối dữ liệu thùng.');
  try {
    const url = new URL(address);
    if (url.protocol !== 'wss:' || !url.hostname || url.username || url.password || url.hash) throw Error();
  } catch { throw new Error('Cấu hình kết nối dữ liệu thùng không hợp lệ.'); }
  return address;
}
