import sanitizeHtml from "sanitize-html";

/**
 * Feed HTML is untrusted input — it is sanitized here, server-side, before it
 * is ever sent to the client. The client renders only this cleaned output.
 */

const ALLOWED_TAGS = [
  "a", "abbr", "b", "blockquote", "br", "caption", "cite", "code", "dd", "del",
  "dfn", "div", "dl", "dt", "em", "figcaption", "figure", "h1", "h2", "h3",
  "h4", "h5", "h6", "hr", "i", "img", "ins", "kbd", "li", "mark", "ol", "p",
  "picture", "pre", "q", "s", "small", "source", "span", "strong", "sub",
  "sup", "table", "tbody", "td", "tfoot", "th", "thead", "time", "tr", "u",
  "ul", "video", "audio",
];

// Strip common newsletter/analytics junk and layout chrome by class/element.
const JUNK_SELECTORS = ["form", "iframe", "script", "style", "nav", "footer", "aside", "button", "input"];

export function sanitizeFeedHtml(dirty: string): string {
  return sanitizeHtml(dirty, {
    allowedTags: ALLOWED_TAGS,
    // Chrome/junk elements vanish *with* their text content — merely
    // discarding the tag would leak nav labels etc. into the article text.
    nonTextTags: ["script", "style", "textarea", "option", "noscript", ...JUNK_SELECTORS],
    allowedAttributes: {
      // target/rel must be allowlisted or the transform below gets stripped
      a: ["href", "title", "target", "rel"],
      img: ["src", "srcset", "alt", "title", "width", "height", "loading"],
      source: ["src", "srcset", "type", "media"],
      video: ["src", "poster", "controls", "width", "height"],
      audio: ["src", "controls"],
      td: ["colspan", "rowspan"],
      th: ["colspan", "rowspan", "scope"],
      time: ["datetime"],
      "*": [],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: { img: ["http", "https", "data"] },
    disallowedTagsMode: "discard",
    exclusiveFilter(frame) {
      if (JUNK_SELECTORS.includes(frame.tag)) return true;
      // Drop tracking pixels (1x1 images) common in Medium/newsletter feeds
      if (frame.tag === "img") {
        const { width, height, src = "" } = frame.attribs;
        if ((width === "1" && height === "1") || /\/stat\?|pixel|tracking/i.test(src)) return true;
      }
      return false;
    },
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: { ...attribs, target: "_blank", rel: "noopener noreferrer" },
      }),
      img: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...attribs,
          // http images are blocked by CSP/mixed-content on an https page
          src: attribs.src?.replace(/^http:\/\//i, "https://") ?? attribs.src,
          srcset: attribs.srcset?.replace(/http:\/\//gi, "https://"),
          loading: "lazy",
        },
      }),
    },
  }).trim();
}

/** Reduce HTML to a plain-text excerpt for list views and search. */
export function htmlToExcerpt(html: string, maxLength = 320): string {
  const text = sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength);
  return cut.slice(0, Math.max(cut.lastIndexOf(" "), maxLength - 20)) + "…";
}
