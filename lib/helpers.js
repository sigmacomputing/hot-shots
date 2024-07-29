const fs = require('fs');

const SANITIZE_REGEXP = /:|\||@|,/g;
const TELEGRAF_SANITIZE_REGEXP = /:|\||,/g;
/**
 * Replace any characters that can't be sent on with an underscore
 */
function sanitizeTags(value, telegraf) {
  const blacklist = telegraf ? TELEGRAF_SANITIZE_REGEXP : SANITIZE_REGEXP;
  // Replace reserved chars with underscores.
  return String(value).replace(blacklist, '_');
}


// eslint-disable-next-line require-jsdoc
function formatTag(tagKey, tagVal, telegraf) {
  return `${sanitizeTags(tagKey, telegraf)}:${sanitizeTags(tagVal, telegraf)}`;
}
/**
 * Format tags properly before sending on
 */
function formatTags(tags, telegraf) {
  if (Array.isArray(tags)) {
    return tags;
  } else {
    return Object.keys(tags).map(key => {
      return formatTag(key, tags[key], telegraf);
    });
  }
}

/**
 * Overrides tags in parent with tags from child with the same name (case sensitive) and return the result as new
 * array. parent and child are not mutated.
 */
function overrideTags (parent, child, telegraf) {
  const seenKeys = {};
  const toAppend = [];

  const childTags = [];
  for (const tag of formatTags(child, telegraf)) {
    const idx = typeof tag === 'string' ? tag.indexOf(':') : -1;
    if (idx < 1) { // Not found or first character
      toAppend.push(tag);
    } else {
      const key = tag.substring(0, idx);
      seenKeys[key] = true;
      childTags.push(tag);
    }
  }

  const parentTags = [];
  for (const tag of parent) {
    const idx = typeof tag === 'string' ? tag.indexOf(':') : -1;
    if (idx < 1) { // Not found or first character
      parentTags.push(tag);
    } else {
      const key = tag.substring(0, idx);
      if (!seenKeys.hasOwnProperty(key)) {
        parentTags.push(tag);
      }
    }
  }

  const tags = parentTags.concat(childTags);
  return toAppend.length > 0 ? tags.concat(toAppend) : tags;
}

/**
 * Overrides tags in parent (globalTagsMemo) with tags from child with the same name.
 * Expects that the child is an object with key-value pairs.
 * Expects that the globalTag is an object with the key as the formatted name, and the value as the concatenated
 * key-value string pair (which is an optimization to avoid reformatting the key-value pair for unchanging global tags).
 */
function overrideTags2 (globalTagsMemo, child, telegraf) {
  const result = [];
  const usedGlobalKeys = new Set();
  for (const c of Object.keys(child)) {
    // there is a global tag with the same name as the child tag - use child
    const formattedChildKey = sanitizeTags(c);
    if (Object.hasOwn(globalTagsMemo, formattedChildKey)) {
      result.push(`${formattedChildKey}:${sanitizeTags(child[c], telegraf)}`);
      usedGlobalKeys.add(formattedChildKey);
    }
    else {
      result.push(`${formattedChildKey}:${sanitizeTags(child[c], telegraf)}`);
    }
  }
  for (const g of Object.keys(globalTagsMemo)) {
    if (!usedGlobalKeys.has(g)) {
      result.push(globalTagsMemo[g]);
    }
  }
  return result;
}


/**
 * Formats a date for use with DataDog
 */
function formatDate(date) {
  let timestamp;
  if (date instanceof Date) {
    // Datadog expects seconds.
    timestamp = Math.round(date.getTime() / 1000);
  } else if (date instanceof Number || typeof date === 'number') {
    // Make sure it is an integer, not a float.
    timestamp = Math.round(date);
  }
  return timestamp;
}

/**
 * Converts int to a string IP
 */
function intToIP(int) {
  const part1 = int & 255;
  const part2 = ((int >> 8) & 255);
  const part3 = ((int >> 16) & 255);
  const part4 = ((int >> 24) & 255);

  return `${part4}.${part3}.${part2}.${part1}`;
}

/**
 * Returns the system default interface on Linux
 */
function getDefaultRoute() {
  try {
    const fileContents = fs.readFileSync('/proc/net/route', 'utf8'); // eslint-disable-line no-sync
    const routes = fileContents.split('\n');
    for (const routeIdx in routes) {
      const fields = routes[routeIdx].trim().split('\t');
      if (fields[1] === '00000000') {
        const address = fields[2];
        // Convert to little endian by splitting every 2 digits and reversing that list
        const littleEndianAddress = address.match(/.{2}/g).reverse().join('');
        return intToIP(parseInt(littleEndianAddress, 16));
      }
    }
  } catch (e) {
    console.error('Could not get default route from /proc/net/route');
  }
  return null;
}

module.exports = {
  formatTags: formatTags,
  formatTag: formatTag,
  overrideTags: overrideTags,
  overrideTags2: overrideTags2,
  formatDate: formatDate,
  getDefaultRoute: getDefaultRoute,
  sanitizeTags: sanitizeTags
};
