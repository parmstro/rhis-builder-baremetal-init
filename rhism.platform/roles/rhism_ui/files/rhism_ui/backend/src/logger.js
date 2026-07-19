const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const active = LEVELS[process.env.LOG_LEVEL ?? 'info'] ?? 2;

function log(level, obj, msg) {
  if (LEVELS[level] > active) return;
  const line = msg
    ? `[${level.toUpperCase()}] ${msg} ${JSON.stringify(obj)}`
    : `[${level.toUpperCase()}] ${JSON.stringify(obj)}`;
  (level === 'error' || level === 'warn' ? console.error : console.log)(line);
}

export default {
  error: (obj, msg) => log('error', obj, msg),
  warn:  (obj, msg) => log('warn',  obj, msg),
  info:  (obj, msg) => log('info',  obj, msg),
  debug: (obj, msg) => log('debug', obj, msg),
};
