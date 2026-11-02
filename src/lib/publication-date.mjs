// 小站统一使用北京时间，避免构建电脑和访客所在时区改变日期或排序。
const zone = '+08:00';
const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

export function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(`${value}T00:00:00Z`))
    && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

export function publicationValue(date, time = '') {
  if (!validDate(date) || (time !== '' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))) {
    throw new Error('请填写有效的发布日期和时间，时间格式为 HH:mm。');
  }
  return time ? `${date}T${time}${zone}` : date;
}

export function publicationInstant(value) {
  if (value instanceof Date && Number.isFinite(value.getTime())) return Math.floor(value.getTime() / 60000) * 60000;
  if (validDate(value)) return Date.parse(`${value}T00:00:00${zone}`);
  const match = typeof value === 'string' && value.match(/^(\d{4}-\d{2}-\d{2})[T ]([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d)(?:\.\d{1,3})?)?(Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)?$/);
  if (!match || !validDate(match[1])) throw new Error(`发布时间无效：${String(value)}`);
  const timestamp = Date.parse(`${match[1]}T${match[2]}:${match[3]}:00${match[5] || zone}`);
  if (!Number.isFinite(timestamp)) throw new Error(`发布时间无效：${String(value)}`);
  return timestamp;
}

export function validPublicationDate(value) {
  try { publicationInstant(value); return true; } catch { return false; }
}

export function dateParts(value) {
  if (validDate(value)) return { full: value, date: value, time: '', year: value.slice(0, 4), day: value.slice(5).replace('-', '.'), label: value };
  const parts = Object.fromEntries(formatter.formatToParts(new Date(publicationInstant(value))).map((part) => [part.type, part.value]));
  const date = `${parts.year.padStart(4, '0')}-${parts.month}-${parts.day}`;
  const time = `${parts.hour}:${parts.minute}`;
  return { full: publicationValue(date, time), date, time, year: parts.year, day: `${parts.month}.${parts.day} ${time}`, label: `${date} ${time}` };
}

export function comparePublicationDates(a, b) { return publicationInstant(a) - publicationInstant(b); }

// 缺少具体时间的旧内容，只能核对到日期，不能认定同一天的回复更早。
export function replyPredatesMessage(reply, message) {
  const a = dateParts(reply), b = dateParts(message);
  return a.time && b.time ? comparePublicationDates(reply, message) < 0 : a.date < b.date;
}
