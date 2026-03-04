// ========== TYPES ==========

export interface ComponentDefinition {
  type: string;
  displayName: string;
  category: "content" | "media" | "decoration" | "interactive";
  defaultProps: Record<string, unknown>;
  renderStatic: (
    props: Record<string, unknown>,
    tokens: Record<string, string>,
  ) => string;
  /**
   * Returns an HTML string for direct DOM rendering (via dangerouslySetInnerHTML).
   * Semantically scoped to interactive editor use; equivalent to renderStatic.
   */
  renderDOM: (
    props: Record<string, unknown>,
    tokens: Record<string, string>,
  ) => string;
}

// ========== HELPERS ==========

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function sanitizeHref(url: string): string {
  // Block dangerous protocols (javascript:, data:, vbscript:, etc.)
  const cleaned = url.trim().toLowerCase();
  if (
    cleaned.startsWith("javascript:") ||
    cleaned.startsWith("data:") ||
    cleaned.startsWith("vbscript:")
  ) {
    return "#";
  }
  return escapeHtml(url);
}

// Allow only safe CSS values: colors, sizes, basic strings
// Reject anything with parentheses (url(), expression()) or semicolons
function sanitizeCss(value: string): string {
  const unsafe = /[(){};<>'"]/;
  return unsafe.test(value) ? "" : value;
}

// ========== REGISTRY ==========

export const ComponentRegistry = new Map<string, ComponentDefinition>();

// TEXT
function renderText(
  props: Record<string, unknown>,
  tokens: Record<string, string>,
): string {
  const { content = "", variant = "body" } = props as {
    content: string;
    variant: string;
  };
  const tag =
    variant === "heading" ? "h2" : variant === "caption" ? "small" : "p";
  const color = tokens["--color-text"] ?? "inherit";
  return `<${tag} class="elove-text elove-text--${variant}" style="color:${sanitizeCss(color)}">${escapeHtml(String(content))}</${tag}>`;
}

ComponentRegistry.set("text", {
  type: "text",
  displayName: "Text",
  category: "content",
  defaultProps: { content: "Nhập nội dung...", variant: "body" },
  renderStatic: renderText,
  renderDOM: renderText,
});

// IMAGE
function renderImage(
  props: Record<string, unknown>,
  _tokens: Record<string, string>,
): string {
  const {
    mediaId = "",
    alt = "",
    fit = "cover",
  } = props as {
    mediaId: string;
    alt: string;
    fit: string;
  };
  if (!mediaId) {
    return `<div class="elove-image elove-image--placeholder" aria-hidden="true"></div>`;
  }
  return `<img class="elove-image" src="/__media/${escapeHtml(mediaId)}/original" alt="${escapeHtml(alt)}" style="object-fit:${sanitizeCss(fit)}" loading="lazy" />`;
}

ComponentRegistry.set("image", {
  type: "image",
  displayName: "Image",
  category: "media",
  defaultProps: { mediaId: "", alt: "", fit: "cover" },
  renderStatic: renderImage,
  renderDOM: renderImage,
});

// VIDEO
function renderVideo(
  props: Record<string, unknown>,
  _tokens: Record<string, string>,
): string {
  const {
    url = "",
    autoplay = false,
    loop = false,
  } = props as {
    url: string;
    autoplay: boolean;
    loop: boolean;
  };
  const attrs = [
    autoplay ? "autoplay muted" : "",
    loop ? "loop" : "",
    "playsinline",
  ]
    .filter(Boolean)
    .join(" ");
  return `<video class="elove-video" src="${escapeHtml(url)}" ${attrs}></video>`;
}

ComponentRegistry.set("video", {
  type: "video",
  displayName: "Video",
  category: "media",
  defaultProps: { url: "", autoplay: false, loop: false },
  renderStatic: renderVideo,
  renderDOM: renderVideo,
});

// SHAPE
function renderShape(
  props: Record<string, unknown>,
  _tokens: Record<string, string>,
): string {
  const {
    shape = "rect",
    fill = "#f0f0f0",
    stroke = "transparent",
  } = props as { shape: string; fill: string; stroke: string };
  const borderRadius = shape === "circle" ? "border-radius:50%" : "";
  return `<div class="elove-shape elove-shape--${shape}" style="background:${sanitizeCss(fill)};border:2px solid ${sanitizeCss(stroke)};${borderRadius}"></div>`;
}

ComponentRegistry.set("shape", {
  type: "shape",
  displayName: "Shape",
  category: "decoration",
  defaultProps: { shape: "rect", fill: "#f0f0f0", stroke: "transparent" },
  renderStatic: renderShape,
  renderDOM: renderShape,
});

// BUTTON
function renderButton(
  props: Record<string, unknown>,
  tokens: Record<string, string>,
): string {
  const {
    label = "",
    action = "url",
    target = "",
  } = props as {
    label: string;
    action: string;
    target: string;
  };
  const href =
    action === "scroll"
      ? `#${escapeHtml(String(target))}`
      : action === "rsvp"
        ? "#rsvp"
        : sanitizeHref(String(target));
  const bg = tokens["--color-primary"] ?? "#333";
  return `<a class="elove-button" href="${href}" style="background:${sanitizeCss(bg)}">${escapeHtml(String(label))}</a>`;
}

ComponentRegistry.set("button", {
  type: "button",
  displayName: "Button",
  category: "interactive",
  defaultProps: { label: "Nhấn vào đây", action: "url", target: "" },
  renderStatic: renderButton,
  renderDOM: renderButton,
});

// ICON
function renderIcon(
  props: Record<string, unknown>,
  _tokens: Record<string, string>,
): string {
  const {
    name = "heart",
    size = 24,
    color = "#333",
  } = props as {
    name: string;
    size: number;
    color: string;
  };
  return `<span class="elove-icon elove-icon--${escapeHtml(String(name))}" style="font-size:${Number(size)}px;color:${sanitizeCss(color)}" aria-hidden="true"></span>`;
}

ComponentRegistry.set("icon", {
  type: "icon",
  displayName: "Icon",
  category: "decoration",
  defaultProps: { name: "heart", size: 24, color: "#333" },
  renderStatic: renderIcon,
  renderDOM: renderIcon,
});

// DIVIDER
function renderDivider(
  props: Record<string, unknown>,
  tokens: Record<string, string>,
): string {
  const { style = "solid", thickness = 1 } = props as {
    style: string;
    thickness: number;
  };
  const color = tokens["--color-accent"] ?? "#ccc";
  return `<hr class="elove-divider" style="border-style:${sanitizeCss(style)};border-width:${Number(thickness)}px;border-color:${sanitizeCss(color)}" />`;
}

ComponentRegistry.set("divider", {
  type: "divider",
  displayName: "Divider",
  category: "decoration",
  defaultProps: { style: "solid", thickness: 1 },
  renderStatic: renderDivider,
  renderDOM: renderDivider,
});
