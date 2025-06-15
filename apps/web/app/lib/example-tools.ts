import type { Tool } from "~/types/tools";

export const exampleTools: Tool[] = [
  {
    id: "tool-calculator",
    type: "function",
    function: {
      name: "calculate",
      description: "Performs mathematical calculations safely",
      parameters: {
        type: "object",
        properties: {
          expression: {
            type: "string",
            description: "Mathematical expression to evaluate (e.g., '2 + 2', 'Math.sqrt(16)')",
          },
        },
        required: ["expression"],
      },
    },
    code: `// Use Function constructor for safer eval
try {
  // Basic validation - only allow numbers, operators, Math functions, and parentheses
  const allowedChars = /^[0-9+\\-*/().\\s]|Math\\.[a-zA-Z]+/;
  if (!allowedChars.test(expression.replace(/Math\.[a-zA-Z]+/g, ''))) {
    return { error: "Invalid characters in expression" };
  }
  
  const result = new Function('return ' + expression)();
  return { result };
} catch (e) {
  return { error: e.message };
}`,
    enabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "tool-date-formatter",
    type: "function",
    function: {
      name: "format_date",
      description: "Formats dates in various formats",
      parameters: {
        type: "object",
        properties: {
          date: {
            type: "string",
            description: "Date string to format (e.g., '2024-01-01', 'now', 'tomorrow')",
          },
          format: {
            type: "string",
            description: "Output format: 'iso', 'local', 'date', 'time', 'relative'",
            enum: ["iso", "local", "date", "time", "relative"],
          },
        },
        required: ["date", "format"],
      },
    },
    code: `// Parse the date
let d;
if (date === 'now') {
  d = new Date();
} else if (date === 'tomorrow') {
  d = new Date();
  d.setDate(d.getDate() + 1);
} else if (date === 'yesterday') {
  d = new Date();
  d.setDate(d.getDate() - 1);
} else {
  d = new Date(date);
}

// Check if date is valid
if (isNaN(d.getTime())) {
  return { error: "Invalid date" };
}

// Format based on the requested format
switch(format) {
  case 'iso':
    return { formatted: d.toISOString() };
  case 'local':
    return { formatted: d.toLocaleString() };
  case 'date':
    return { formatted: d.toLocaleDateString() };
  case 'time':
    return { formatted: d.toLocaleTimeString() };
  case 'relative':
    const now = new Date();
    const diffMs = d - now;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return { formatted: "today" };
    if (diffDays === 1) return { formatted: "tomorrow" };
    if (diffDays === -1) return { formatted: "yesterday" };
    if (diffDays > 0) return { formatted: \`in \${diffDays} days\` };
    return { formatted: \`\${Math.abs(diffDays)} days ago\` };
  default:
    return { formatted: d.toString() };
}`,
    enabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "tool-json-formatter",
    type: "function",
    function: {
      name: "format_json",
      description: "Formats and validates JSON strings",
      parameters: {
        type: "object",
        properties: {
          json_string: {
            type: "string",
            description: "JSON string to format",
          },
          indent: {
            type: "number",
            description: "Number of spaces for indentation (default: 2)",
          },
        },
        required: ["json_string"],
      },
    },
    code: `try {
  const parsed = JSON.parse(json_string);
  const indentLevel = indent || 2;
  const formatted = JSON.stringify(parsed, null, indentLevel);
  
  return {
    formatted,
    type: Array.isArray(parsed) ? 'array' : typeof parsed,
    size: Array.isArray(parsed) ? parsed.length : Object.keys(parsed).length
  };
} catch (e) {
  // Try to provide helpful error info
  const match = e.message.match(/position (\\d+)/);
  if (match) {
    const position = parseInt(match[1]);
    const preview = json_string.substring(Math.max(0, position - 20), position + 20);
    return { 
      error: e.message,
      near: preview,
      position 
    };
  }
  return { error: e.message };
}`,
    enabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "tool-url-parser",
    type: "function",
    function: {
      name: "parse_url",
      description: "Parses URL components and query parameters",
      parameters: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "URL to parse",
          },
        },
        required: ["url"],
      },
    },
    code: `try {
  const u = new URL(url);
  
  // Parse query parameters into an object
  const params = {};
  u.searchParams.forEach((value, key) => {
    if (params[key]) {
      // Handle multiple values for same key
      if (Array.isArray(params[key])) {
        params[key].push(value);
      } else {
        params[key] = [params[key], value];
      }
    } else {
      params[key] = value;
    }
  });
  
  return {
    protocol: u.protocol.replace(':', ''),
    hostname: u.hostname,
    port: u.port || (u.protocol === 'https:' ? '443' : '80'),
    pathname: u.pathname,
    search: u.search,
    hash: u.hash,
    params,
    origin: u.origin,
    host: u.host
  };
} catch (e) {
  return { error: "Invalid URL: " + e.message };
}`,
    enabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "tool-random-generator",
    type: "function",
    function: {
      name: "generate_random",
      description: "Generates random values of various types",
      parameters: {
        type: "object",
        properties: {
          type: {
            type: "string",
            description: "Type of random value to generate",
            enum: ["number", "integer", "uuid", "hex", "password", "words"],
          },
          min: {
            type: "number",
            description: "Minimum value (for number/integer types)",
          },
          max: {
            type: "number",
            description: "Maximum value (for number/integer types)",
          },
          length: {
            type: "number",
            description: "Length of the output (for hex/password/words)",
          },
        },
        required: ["type"],
      },
    },
    code: `switch(type) {
  case 'number':
    const minNum = min || 0;
    const maxNum = max || 1;
    return { value: Math.random() * (maxNum - minNum) + minNum };
    
  case 'integer':
    const minInt = Math.floor(min || 0);
    const maxInt = Math.floor(max || 100);
    return { value: Math.floor(Math.random() * (maxInt - minInt + 1)) + minInt };
    
  case 'uuid':
    // Simple UUID v4 generator
    const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
    return { value: uuid };
    
  case 'hex':
    const hexLength = length || 16;
    let hex = '';
    for (let i = 0; i < hexLength; i++) {
      hex += Math.floor(Math.random() * 16).toString(16);
    }
    return { value: hex };
    
  case 'password':
    const pwLength = length || 16;
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
    let password = '';
    for (let i = 0; i < pwLength; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return { value: password };
    
  case 'words':
    const wordCount = length || 3;
    const words = ['apple', 'banana', 'cherry', 'dragon', 'eagle', 'forest', 
                   'galaxy', 'harbor', 'island', 'jungle', 'knight', 'lighthouse',
                   'mountain', 'nebula', 'ocean', 'phoenix', 'quantum', 'rainbow',
                   'sunset', 'thunder', 'unicorn', 'volcano', 'waterfall', 'xylophone',
                   'yellow', 'zebra'];
    const selected = [];
    for (let i = 0; i < wordCount; i++) {
      selected.push(words[Math.floor(Math.random() * words.length)]);
    }
    return { value: selected.join('-') };
    
  default:
    return { error: "Unknown type: " + type };
}`,
    enabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];