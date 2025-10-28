// ANSI color codes for terminal styling

const colors = {
  // Reset
  reset: '\x1b[0m',

  // Text colors
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',

  // Bright colors
  brightRed: '\x1b[91m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightBlue: '\x1b[94m',
  brightMagenta: '\x1b[95m',
  brightCyan: '\x1b[96m',
  brightWhite: '\x1b[97m',

  // Styles
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',
  blink: '\x1b[5m',
  inverse: '\x1b[7m',
  hidden: '\x1b[8m',
  strikethrough: '\x1b[9m',
};

// Helper functions
function success(text) {
  return `${colors.brightGreen}✓ ${text}${colors.reset}`;
}

function error(text) {
  return `${colors.brightRed}✗ ${text}${colors.reset}`;
}

function warning(text) {
  return `${colors.brightYellow}⚠ ${text}${colors.reset}`;
}

function info(text) {
  return `${colors.brightBlue}ℹ ${text}${colors.reset}`;
}

function bold(text) {
  return `${colors.bold}${text}${colors.reset}`;
}

function dim(text) {
  return `${colors.dim}${text}${colors.reset}`;
}

function green(text) {
  return `${colors.green}${text}${colors.reset}`;
}

function red(text) {
  return `${colors.red}${text}${colors.reset}`;
}

function yellow(text) {
  return `${colors.yellow}${text}${colors.reset}`;
}

function blue(text) {
  return `${colors.blue}${text}${colors.reset}`;
}

function cyan(text) {
  return `${colors.cyan}${text}${colors.reset}`;
}

function magenta(text) {
  return `${colors.magenta}${text}${colors.reset}`;
}

function gray(text) {
  return `${colors.gray}${text}${colors.reset}`;
}

// Box drawing characters
const box = {
  topLeft: '┌',
  topRight: '┐',
  bottomLeft: '└',
  bottomRight: '┘',
  horizontal: '─',
  vertical: '│',
  cross: '┼',
  teeDown: '┬',
  teeUp: '┴',
  teeRight: '├',
  teeLeft: '┤',

  // Double line
  doubleTopLeft: '╔',
  doubleTopRight: '╗',
  doubleBottomLeft: '╚',
  doubleBottomRight: '╝',
  doubleHorizontal: '═',
  doubleVertical: '║',
  doubleCross: '╬',
  doubleTeeDown: '╦',
  doubleTeeUp: '╩',
  doubleTeeRight: '╠',
  doubleTeeLeft: '╣',
};

// Create a box title
function boxTitle(title, width = 60) {
  const titleLen = title.length;
  const padding = Math.floor((width - titleLen - 2) / 2);
  const extraSpace = (width - titleLen - 2) % 2;

  return bold(
    `${box.topLeft}${box.horizontal.repeat(padding)}` +
    ` ${title} ` +
    `${box.horizontal.repeat(padding + extraSpace)}${box.topRight}`
  );
}

// Create a double-line box title
function doubleBoxTitle(title, width = 60) {
  const titleLen = title.length;
  const padding = Math.floor((width - titleLen - 2) / 2);
  const extraSpace = (width - titleLen - 2) % 2;

  return bold(
    `${box.doubleTopLeft}${box.doubleHorizontal.repeat(padding)}` +
    ` ${title} ` +
    `${box.doubleHorizontal.repeat(padding + extraSpace)}${box.doubleTopRight}`
  );
}

// Create a box line (left border, content, right border)
function boxLine(content, width = 60) {
  const contentLen = stripAnsi(content).length;
  const padding = Math.max(0, width - contentLen - 2);
  return `${box.vertical} ${content}${' '.repeat(padding)}${box.vertical}`;
}

// Create a double-line box line
function doubleBoxLine(content, width = 60) {
  const contentLen = stripAnsi(content).length;
  const padding = Math.max(0, width - contentLen - 2);
  return `${box.doubleVertical} ${content}${' '.repeat(padding)}${box.doubleVertical}`;
}

// Create a box separator
function boxSeparator(width = 60) {
  return `${box.teeRight}${box.horizontal.repeat(width - 2)}${box.teeLeft}`;
}

// Create a double-line box separator
function doubleBoxSeparator(width = 60) {
  return `${box.doubleTeeRight}${box.doubleHorizontal.repeat(width - 2)}${box.doubleTeeLeft}`;
}

// Create a box bottom
function boxBottom(width = 60) {
  return `${box.bottomLeft}${box.horizontal.repeat(width - 2)}${box.bottomRight}`;
}

// Create a double-line box bottom
function doubleBoxBottom(width = 60) {
  return `${box.doubleBottomLeft}${box.doubleHorizontal.repeat(width - 2)}${box.doubleBottomRight}`;
}

// Strip ANSI codes to get actual string length
function stripAnsi(str) {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

// Emojis for visual cues
const emoji = {
  driver: '🚗',
  rider: '👤',
  location: '📍',
  money: '💰',
  phone: '📱',
  checkmark: '✓',
  cross: '✗',
  warning: '⚠',
  info: 'ℹ',
  arrow: '→',
  pin: '📌',
  target: '🎯',
  id: '🆔',
  server: '🌐',
  connection: '🔌',
  trip: '🧳',
  map: '🗺️',
  time: '⏱️',
  distance: '📏',
  alert: '🚨',
  pickup: '📍',
  destination: '🎯',
};

module.exports = {
  colors,
  success,
  error,
  warning,
  info,
  bold,
  dim,
  green,
  red,
  yellow,
  blue,
  cyan,
  magenta,
  gray,
  box,
  boxTitle,
  doubleBoxTitle,
  boxLine,
  doubleBoxLine,
  boxSeparator,
  doubleBoxSeparator,
  boxBottom,
  doubleBoxBottom,
  stripAnsi,
  emoji,
};
