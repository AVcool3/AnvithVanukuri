/* ==========================================================================
   script.js
   --------------------------------------------------------------------------
   Everything on the page that isn't static copy is rendered from the
   `profile` object at the top of this file. If you've used React, think of
   `profile` as props and each render*() function below as a component that
   returns DOM instead of JSX.

   Sections of this file (search for the heading to jump):
     1. DATA        -> `profile` : edit your content here
     2. HELPERS     -> tiny utilities (el(), byId(), escape, date parsing)
     3. RENDERERS   -> one function per section, called once at the bottom
     4. BEHAVIORS   -> scroll effects, nav, horizontal track, starfield
     5. BOOT        -> runs everything
   ========================================================================== */

/* ==========================================================================
   1. DATA
   ========================================================================== */
const profile = {
  name: "Anvith Vanukuri",

  // Shown as the small line above the name in the hero.
  location: "Evanston, Illinois",
  program: "MMSS + Computer Science, Northwestern",

  // The one-sentence statement under the name. Keep it short; it's set large.
  statement:
    "A student of markets and measurement. I like finding the right number for a thing, then building something simple around it.",

  // "01 · Notes". Each string becomes a paragraph.
  about: [
    "I study Mathematical Methods in the Social Sciences and Computer Science at Northwestern. The through-line in what I do is measurement: I started out fitting orbits to double stars with Monte Carlo methods in a community-college physics lab, and I now spend most of my time sizing positions for a student fund, doing diligence on private companies, and building a tool that turns an investor's opinion into a number.",
    "I like markets because they're a continuous, slightly adversarial measurement problem. I like software because it lets you ship the measurement to someone else. Outside of that: volleyball, pencil sketches of animals, the Chicago Bears, hula-hooping, and a long-running interest in Eastern philosophy.",
  ],

  // The italic note that sits in the margin beside the paragraphs above.
  marginNote:
    "A rough rule I keep coming back to: the interesting part is rarely the model. It's deciding what to measure and how much to trust it.",

  // Links. `hero: true` shows the link under the hero statement.
  // Everything here also appears in the "08 · Hello" contact list.
  socials: [
    { label: "Email", handle: "AnvithV@u.northwestern.edu", url: "mailto:AnvithV@u.northwestern.edu", hero: true },
    { label: "LinkedIn", handle: "anvith-vanukuri", url: "https://www.linkedin.com/in/anvith-vanukuri/", hero: true },
    { label: "GitHub", handle: "AVcool3", url: "https://github.com/AVcool3", hero: true },
    { label: "Instagram", handle: "anvithv31", url: "https://www.instagram.com/anvithv31/", hero: false },
  ],

  // "05 · Transcript". Listed most recent first. `note` is the one-line description,
  // `tags` is the small mono line beneath it.
  courses: [
    { title: "Data Structures and Algorithms", note: "Core data structures, algorithm design and analysis, and asymptotic complexity.", tags: ["algorithms", "complexity", "implementation"] },
    { title: "AI Algorithms", note: "Search, planning, probabilistic reasoning, and learning algorithms behind modern AI systems.", tags: ["search", "probability", "learning"] },
    { title: "Game Theory", note: "Strategic decision-making, incentives, competition, and applied economic reasoning.", tags: ["strategy", "markets", "incentives"] },
    { title: "Decision-Making", note: "Frameworks for analyzing choices, uncertainty, and tradeoffs in social science contexts.", tags: ["analysis", "uncertainty", "judgment"] },
    { title: "Microeconomics", note: "Consumer behavior, firm decisions, market structures, and economic modeling.", tags: ["economics", "modeling", "markets"] },
    { title: "Linear Algebra", note: "Vector spaces, matrices, transformations, and foundations for quantitative modeling.", tags: ["matrices", "models", "computation"] },
    { title: "Multivariable Calculus", note: "Optimization, derivatives, integrals, and mathematical tools for higher-dimensional systems.", tags: ["optimization", "calculus", "quantitative"] },
    { title: "Spanish", note: "Conversational Spanish coursework supporting communication across cultures and teams.", tags: ["spanish", "communication", "culture"] },
  ],

  // "03 · Ledger". Order here doesn't matter — the renderer sorts by `period`
  // (newest first) by reading the first "Month YYYY" in the string.
  // Set `upcoming: true` to show a small "upcoming" badge.
  experiences: [
    {
      // Kept deliberately short: just the one line about what the work is.
      role: "Product & GTM Intern",
      organization: "InPlay Global",
      location: "Chicago, IL",
      period: "August 2026 – September 2026",
      notes: ["Working on a performance-backed securities exchange."],
    },
    {
      role: "M&A Product Intern",
      organization: "AJ Gallagher & Co.",
      location: "Rolling Meadows, IL",
      period: "May 2026 – July 2026",
      notes: [
        "Built internal M&A tools for 5,000+ employees using Python, SharePoint, Power BI, and Azure Data Lake, including a CLI-based CIM review workflow for transaction-document analysis.",
        "Built a Python/Azure document-scanning and claims-adjudication workflow supporting a product projected to save $8M across enterprise and personal reinsurance teams.",
      ],
    },
    {
      role: "GTM Lead",
      organization: "Spyke Automation",
      location: "Evanston, IL",
      period: "May 2026 – Present",
      notes: [
        "Lead go-to-market work for a Northwestern Garage-backed manufacturing SaaS company.",
        "Helped bring a ladder-logic debugging tool to its first signed client.",
      ],
    },
    {
      role: "Materials Captain, Long/Short Equity Student Fund",
      organization: "Balyasny Asset Management",
      location: "Chicago, IL",
      period: "March 2026 – Present",
      notes: [
        "Lead 12 students valuing, pitching, and sizing materials positions for a $100k student portfolio.",
        "Trained by BAM employees on portfolio management and long/short equity strategy.",
        "Tracked and presented structural and tactical theses on Texas Pacific Land and Martin Marietta.",
      ],
    },
    {
      role: "Analyst & Pitch Group Member",
      organization: "Northwestern Investment Management Group",
      location: "Evanston, IL",
      period: "January 2026 – Present",
      notes: [
        "Excel-based valuation training: industry tailwinds, DCFs, comparable company analysis, accounting.",
        "Built terminal value projections for Credo AI and supported a long pitch centered on data-center expansion.",
      ],
    },
    {
      role: "Winter Private Equity Analyst",
      organization: "TEO Capital Partners",
      location: "Miami, FL",
      period: "November 2025 – February 2026",
      notes: [
        "Diligenced a SaaS energy CIM: recurring revenue quality, EBITDA adjustments, margins, concentration, working capital.",
        "Built a basic LBO to assess leverage and IRR sensitivity.",
        "Researched 300+ bootstrapped NDT companies through Grata, narrowing to 10 potential LBO targets.",
      ],
    },
    {
      role: "President & Project Lead",
      organization: "ISBE Arch Startup Club",
      location: "Evanston, IL",
      period: "October 2025 – Present",
      notes: [
        "Run entrepreneurship training, speaker events, and applications for a selective 30-member organization.",
        "Founded and led a three-person NewsTech startup; MVP tested by three schools and 50+ potential clients.",
        "Presented market sizing, competitive analysis, and long-term growth projections to the club.",
      ],
    },
    {
      role: "Sales/Marketing & Data Analyst",
      organization: "SkyZone Trampoline Park",
      location: "Schaumburg, IL",
      period: "November 2024 – September 2025",
      notes: [
        "Built Tableau market visualizations to find high-opportunity segments, supporting five events with 2,000+ attendees.",
        "Sold 300+ memberships and held retention above 50%.",
      ],
    },
    {
      role: "Head Author",
      organization: "Harper College Astronomy & Physics Lab",
      location: "Palatine, IL",
      period: "October 2023 – November 2024",
      notes: [
        "Published and presented work using Bayesian optimization and Monte Carlo methods in R to model double-star orbits.",
      ],
    },
  ],

  // "04 · Papers". Sorted newest first by `period`. `glyph` picks the small drawing
  // on the right: "stars" or "frontier".
  publications: [
    {
      title: "Estimating Orbital Parameters for Visual Double Stars",
      venue: "Open European Journal on Variable Stars",
      period: "January 2025",
      description:
        "Hamiltonian Monte Carlo and Bayesian optimization applied to nine visual double-star systems, with results validated against the Washington Double Star catalog.",
      url: "assets/publications/estimating-orbital-parameters-visual-double-stars.pdf",
      linkLabel: "read the paper (pdf)",
      tags: ["bayesian optimization", "hamiltonian monte carlo", "stan", "astronomy"],
      glyph: "stars",
    },
    {
      title: "Speckle Interferometry of WDS 21555+1053, WDS 19594+3206, and WDS 20213+0250",
      venue: "Boyce Astro Research Observatory",
      period: "2024",
      description:
        "Measured separation angles and distances of three binary systems with speckle interferometry, then compared the observations against published orbital catalogs to evaluate orbit fit.",
      url: "assets/publications/speckle-interferometry-binary-stars.pdf",
      linkLabel: "read the paper (pdf)",
      tags: ["speckle interferometry", "astrometry", "data analysis"],
      glyph: "stars",
    },
    {
      title: "Modern Portfolio Theory as a Vector Calculus Framework",
      venue: "MATH 285-3 project, Northwestern University",
      period: "May 2026",
      description:
        "Mean-variance optimization built from first principles, portfolio utility connected to vector calculus, and risk aversion reverse-optimized from the Northwestern Investment Management Group's actual portfolio.",
      url: "assets/publications/modern-portfolio-theory-vector-calculus.pdf",
      linkLabel: "read the project (pdf)",
      tags: ["modern portfolio theory", "vector calculus", "mean-variance", "python"],
      glyph: "frontier",
    },
  ],

  // "06 · Margins". Three lines of slowly drifting text.
  skills: ["Financial valuation", "Market research", "Data visualization", "FactSet", "Grata", "Tableau", "Figma", "Attio", "R", "STAN", "Python", "Microsoft Office", "Telugu", "Spanish (conversational)"],
  activities: ["NUIBC Early Insights Program", "Data Science & Analytics", "LEND Evanston", "Intramural volleyball", "Phi Kappa Psi"],
  interests: ["FinTech", "Prediction markets", "AI", "Financial services", "Volleyball", "Animal pencil sketching", "Chicago Bears", "Hula-hooping", "ORod", "Eastern philosophy"],

  // "07 · Builds".
  projects: [
    {
      title: "StudioHone",
      description: "Personalized portfolio optimization: a risk tier, a set of views, and exact position weights with reasoning. Paper trading only.",
      repo: "https://studiohone.com",
      linkLabel: "visit site",
      tags: ["black-litterman", "python", "alpaca paper api"],
    },
    {
      title: "NewsTech startup MVP",
      description: "An MVP built through ISBE Arch Startup Club and tested with three schools and 50+ potential clients.",
      repo: "https://github.com/AVcool3",
      linkLabel: "github",
      tags: ["startup", "mvp", "market research"],
    },
    {
      title: "This website",
      description: "Hand-built with plain HTML, CSS, and JavaScript. The stars are a canvas; the orbit and frontier are SVG.",
      repo: "https://github.com/AVcool3/AnvithVanukuri",
      linkLabel: "source",
      tags: ["html", "css", "javascript"],
    },
  ],
};

/* ==========================================================================
   2. HELPERS
   ========================================================================== */
const byId = (id) => document.getElementById(id);

/**
 * el(tag, props, ...children)
 * A tiny createElement wrapper so the renderers read a bit like JSX.
 *   el("p", { className: "foo" }, "text", el("b", {}, "bold"))
 * Children can be strings, nodes, arrays, or null/false (ignored).
 * Props map straight onto the element; `dataset` and `attrs` are special-cased.
 */
function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  Object.entries(props).forEach(([key, value]) => {
    if (value == null || value === false) return;
    if (key === "attrs") Object.entries(value).forEach(([k, v]) => node.setAttribute(k, v));
    else if (key === "dataset") Object.assign(node.dataset, value);
    else if (key in node) node[key] = value;
    else node.setAttribute(key, value);
  });
  children.flat(Infinity).forEach((child) => {
    if (child == null || child === false) return;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  });
  return node;
}

/** Links to other sites open in a new tab; mailto: and same-page links don't. */
function externalAttrs(url) {
  return url.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {};
}

/** Two-digit index ("01", "02", ...). */
const pad2 = (n) => String(n).padStart(2, "0");

/**
 * Turn the first date in a period string into a sortable number.
 * "November 2025 – Present" -> 2025 * 12 + 10. A bare year like "2024" counts
 * as January of that year. Used to order the ledger and the papers list.
 */
function periodStart(period) {
  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const withMonth = period.match(/([A-Za-z]+)\s+(\d{4})/);
  if (withMonth) {
    const month = months.indexOf(withMonth[1].slice(0, 3).toLowerCase());
    return Number(withMonth[2]) * 12 + Math.max(month, 0);
  }
  const yearOnly = period.match(/(\d{4})/);
  return yearOnly ? Number(yearOnly[1]) * 12 : 0;
}

/** Only run motion when the visitor hasn't asked for less of it. */
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ==========================================================================
   3. RENDERERS
   Each one reads from `profile` and writes into a container in index.html.
   ========================================================================== */

/** Hero: name, kicker line, statement, short links. */
function renderHero() {
  byId("profile-name").textContent = profile.name;
  byId("hero-location").textContent = profile.location;
  byId("hero-program").textContent = profile.program;
  byId("profile-statement").textContent = profile.statement;

  const links = byId("hero-links");
  profile.socials
    .filter((s) => s.hero)
    .forEach((s) => links.append(el("a", { href: s.url, ...externalAttrs(s.url) }, s.label)));
}

/** 01 · Notes: paragraphs + margin note. */
function renderNotes() {
  const container = byId("about-text");
  profile.about.forEach((paragraph) => container.append(el("p", {}, paragraph)));
  byId("margin-note-text").textContent = profile.marginNote;
}

/** 03 · Ledger: horizontal experience track, newest -> oldest. */
function renderLedger() {
  const track = byId("experience-track");
  const sorted = [...profile.experiences].sort((a, b) => periodStart(b.period) - periodStart(a.period));

  sorted.forEach((exp, i) => {
    track.append(
      el(
        "li",
        { className: "ledger-item reveal", style: `transition-delay:${Math.min(i, 4) * 60}ms` },
        // vertical date rail
        el("div", { className: "ledger-rail" }, el("span", {}, exp.period)),
        // main column
        el(
          "div",
          { className: "ledger-body" },
          el("span", { className: "mono ledger-index" }, pad2(i + 1)),
          el("h3", {}, exp.role),
          el("p", { className: "ledger-org" }, `${exp.organization} · ${exp.location}`),
          exp.upcoming && el("span", { className: "mono ledger-badge" }, "upcoming"),
          el("ul", { className: "ledger-notes" }, exp.notes.map((n) => el("li", {}, n))),
        ),
      ),
    );
  });
}

/**
 * Small decorative SVGs for the papers list.
 * "stars": a tiny star chart with a dashed orbit; "frontier": a mini efficient frontier.
 * They're inline strings because they never change; feel free to redraw them.
 */
const glyphs = {
  stars: `
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <ellipse class="glyph-faint" cx="50" cy="50" rx="38" ry="22" transform="rotate(-25 50 50)" stroke-dasharray="2 3"/>
      <line class="glyph-faint" x1="18" y1="72" x2="46" y2="52"/>
      <line class="glyph-faint" x1="46" y1="52" x2="70" y2="30"/>
      <line class="glyph-faint" x1="70" y1="30" x2="84" y2="40"/>
      <circle cx="18" cy="72" r="1.6"/>
      <circle cx="46" cy="52" r="2.6"/>
      <circle class="glyph-ember" cx="70" cy="30" r="1.8"/>
      <circle cx="84" cy="40" r="1.2"/>
      <circle cx="30" cy="22" r="1"/>
      <circle cx="78" cy="78" r="1"/>
    </svg>`,
  frontier: `
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <line class="glyph-faint" x1="14" y1="10" x2="14" y2="86"/>
      <line class="glyph-faint" x1="14" y1="86" x2="92" y2="86"/>
      <path d="M 34 78 C 34 56, 42 40, 56 30 S 82 16, 90 14"/>
      <circle cx="42" cy="60" r="1.2"/>
      <circle cx="60" cy="50" r="1.2"/>
      <circle cx="74" cy="60" r="1.2"/>
      <circle class="glyph-ember" cx="58" cy="29" r="2.6"/>
    </svg>`,
};

/** 04 · Papers, newest first. */
function renderPapers() {
  const list = byId("publication-list");
  const sorted = [...profile.publications].sort((a, b) => periodStart(b.period) - periodStart(a.period));

  sorted.forEach((pub, i) => {
    const glyph = el("div", { className: "paper-glyph" });
    glyph.innerHTML = glyphs[pub.glyph] || glyphs.stars;

    list.append(
      el(
        "li",
        { className: "paper reveal" },
        el("span", { className: "mono paper-num" }, pad2(i + 1)),
        el(
          "div",
          {},
          el("h3", {}, el("a", { href: pub.url, ...externalAttrs(pub.url) }, pub.title)),
          el("span", { className: "mono paper-meta" }, `${pub.venue} · ${pub.period}`),
          el("p", {}, pub.description),
          el("ul", { className: "paper-tags" }, pub.tags.map((t) => el("li", {}, t))),
          pub.url && el("a", { className: "paper-link", href: pub.url, ...externalAttrs(pub.url) }, pub.linkLabel || "read"),
        ),
        glyph,
      ),
    );
  });
}

/**
 * 05 · Transcript. Each course = one row in a <dl>.
 * Note: rows use `display: contents` in CSS so they can't carry the .reveal
 * class themselves (an element with no box never "enters the viewport").
 * The whole <dl> reveals at once instead — see #course-list in index.html.
 */
function renderTranscript() {
  const list = byId("course-list");

  profile.courses.forEach((course, i) => {
    list.append(
      el(
        "div",
        { className: "transcript-row" },
        el("span", { className: "mono transcript-num" }, pad2(i + 1)),
        el("dt", {}, course.title),
        el("dd", {}, course.note, el("small", {}, course.tags.join(" · "))),
      ),
    );
  });
}

/**
 * 06 · Margins: three marquee lines.
 * Each line duplicates its list so the CSS translateX(-50%) loop is seamless.
 * Speed is proportional to the number of items so all three drift at a similar pace.
 */
function renderMargins() {
  const container = byId("marquee-list");
  const groups = [
    { label: "tools", items: profile.skills },
    { label: "involvement", items: profile.activities },
    { label: "otherwise", items: profile.interests },
  ];

  groups.forEach((group) => {
    const row = () => el("ul", { className: "marquee-row" }, group.items.map((t) => el("li", {}, t)));
    container.append(
      el(
        "div",
        { className: "marquee", style: `--marquee-duration:${Math.max(40, group.items.length * 6)}s` },
        el("span", { className: "mono marquee-label" }, group.label),
        el("div", { className: "marquee-track" }, row(), row()),
      ),
    );
  });
}

/** 07 · Builds. */
function renderBuilds() {
  const list = byId("project-list");

  profile.projects.forEach((project, i) => {
    list.append(
      el(
        "li",
        { className: "build reveal" },
        el("span", { className: "mono build-num" }, pad2(i + 1)),
        el(
          "div",
          {},
          el("h3", {}, project.title),
          el("p", {}, project.description),
          el("ul", { className: "build-tags" }, project.tags.map((t) => el("li", {}, t))),
        ),
        el("a", { className: "build-link", href: project.repo, ...externalAttrs(project.repo) }, `${project.linkLabel || "view"} →`),
      ),
    );
  });
}

/** 08 · Hello: every social as "label — handle". */
function renderHello() {
  const list = byId("contact-links");
  profile.socials.forEach((s) => {
    list.append(
      el(
        "li",
        {},
        el("span", { className: "mono" }, s.label),
        el("a", { href: s.url, ...externalAttrs(s.url) }, s.handle),
      ),
    );
  });
  byId("current-year").textContent = new Date().getFullYear();
}

/* ==========================================================================
   4. BEHAVIORS
   ========================================================================== */

/** Mobile menu open/close. */
function setupMenu() {
  const toggle = document.querySelector(".menu-toggle");
  const links = byId("nav-links");

  toggle.addEventListener("click", () => {
    const open = links.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(open));
  });
  // Close the menu after picking a link.
  links.addEventListener("click", (e) => {
    if (e.target.closest("a")) {
      links.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
    }
  });
}

/**
 * Highlights the nav link for whichever section is currently in view.
 * IntersectionObserver fires when a section crosses the band in the middle of
 * the viewport (defined by rootMargin), and we set aria-current on its link.
 */
function setupActiveNav() {
  const links = [...document.querySelectorAll(".nav-links a")];
  const sections = links
    .map((a) => document.querySelector(a.getAttribute("href")))
    .filter(Boolean);

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        links.forEach((a) => a.removeAttribute("aria-current"));
        const active = links.find((a) => a.getAttribute("href") === `#${entry.target.id}`);
        if (active) active.setAttribute("aria-current", "true");
      });
    },
    { rootMargin: "-40% 0px -55% 0px" },
  );
  sections.forEach((s) => observer.observe(s));
}

/** Thin progress line at the top of the page: width = how far you've scrolled. */
function setupScrollProgress() {
  const bar = byId("scroll-progress");
  const update = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.width = `${max > 0 ? (window.scrollY / max) * 100 : 0}%`;
  };
  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);
  update();
}

/** Adds .is-visible to each .reveal element the first time it scrolls into view. */
function setupReveal() {
  const targets = document.querySelectorAll(".reveal");
  if (prefersReducedMotion) {
    targets.forEach((t) => t.classList.add("is-visible"));
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target); // reveal once, then stop watching
        }
      });
    },
    { threshold: 0.15, rootMargin: "0px 0px -8% 0px" },
  );
  targets.forEach((t) => observer.observe(t));
}

/**
 * Draws SVG paths marked with [data-draw] as they scroll into view.
 * The trick: set stroke-dasharray to the path's total length, then move
 * stroke-dashoffset from "length" (invisible) to 0 (fully drawn) as the
 * element travels from the bottom of the viewport to ~40% of the way up.
 * Siblings marked [data-draw-reveal] fade in once the path is ~90% drawn.
 */
function setupDrawOnScroll() {
  const paths = [...document.querySelectorAll("[data-draw]")];
  if (!paths.length) return;

  paths.forEach((path) => {
    const length = path.getTotalLength();
    path.style.strokeDasharray = `${length}`;
    path.style.strokeDashoffset = prefersReducedMotion ? "0" : `${length}`;
  });
  if (prefersReducedMotion) {
    document.querySelectorAll("[data-draw-reveal]").forEach((n) => n.classList.add("is-drawn"));
    return;
  }

  let ticking = false;
  const update = () => {
    ticking = false;
    paths.forEach((path) => {
      const rect = path.closest("svg").getBoundingClientRect();
      const vh = window.innerHeight;
      // 0 when the svg's top enters at the bottom; 1 when it reaches 40% from the top.
      const progress = Math.min(1, Math.max(0, (vh - rect.top) / (vh * 0.6)));
      const length = path.getTotalLength();
      path.style.strokeDashoffset = `${length * (1 - progress)}`;

      const reveal = path.parentElement.querySelector("[data-draw-reveal]");
      if (reveal) reveal.classList.toggle("is-drawn", progress > 0.9);
    });
  };
  const onScroll = () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  update();
}

/**
 * The horizontal experience track:
 *  - arrow buttons scroll one card at a time
 *  - click-and-drag with the mouse (touch already scrolls natively)
 *  - left/right arrow keys when the track is focused
 *  - the thin bar underneath mirrors scroll position
 */
function setupTrack() {
  const track = byId("experience-track");
  const thumb = byId("track-thumb");
  const prev = document.querySelector("[data-track-prev]");
  const next = document.querySelector("[data-track-next]");
  if (!track) return;

  const cardWidth = () => {
    const first = track.querySelector(".ledger-item");
    return first ? first.getBoundingClientRect().width + 20 : 320; // 20 = gap
  };
  const scrollByCards = (n) => track.scrollBy({ left: n * cardWidth(), behavior: "smooth" });

  prev.addEventListener("click", () => scrollByCards(-1));
  next.addEventListener("click", () => scrollByCards(1));

  track.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") { e.preventDefault(); scrollByCards(1); }
    if (e.key === "ArrowLeft")  { e.preventDefault(); scrollByCards(-1); }
  });

  // Mouse drag-to-scroll.
  let dragging = false;
  let startX = 0;
  let startScroll = 0;
  track.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "mouse") return;
    dragging = true;
    startX = e.clientX;
    startScroll = track.scrollLeft;
    track.classList.add("is-dragging");
    track.setPointerCapture(e.pointerId);
  });
  track.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    track.scrollLeft = startScroll - (e.clientX - startX);
  });
  const endDrag = () => {
    if (!dragging) return;
    dragging = false;
    track.classList.remove("is-dragging");
  };
  track.addEventListener("pointerup", endDrag);
  track.addEventListener("pointercancel", endDrag);
  track.addEventListener("pointerleave", endDrag);

  // Custom scrollbar thumb.
  const updateThumb = () => {
    const visible = track.clientWidth / track.scrollWidth;
    const max = track.scrollWidth - track.clientWidth;
    const pos = max > 0 ? track.scrollLeft / max : 0;
    thumb.style.width = `${visible * 100}%`;
    thumb.style.left = `${pos * (1 - visible) * 100}%`;
  };
  track.addEventListener("scroll", updateThumb, { passive: true });
  window.addEventListener("resize", updateThumb);
  updateThumb();
}

/**
 * Background starfield on a <canvas>.
 * A few hundred faint specks; each has a "depth" that controls how much it
 * drifts when you scroll (parallax) and how slowly it breathes in brightness.
 * Colors come from the --star-color / --star-alpha CSS variables so it
 * automatically matches light and dark mode.
 */
function setupStarfield() {
  const canvas = byId("starfield");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  let stars = [];
  let width = 0;
  let height = 0;
  let dpr = 1;

  const readColor = () => {
    const css = getComputedStyle(document.documentElement);
    return {
      rgb: css.getPropertyValue("--star-color").trim() || "31, 29, 26",
      alpha: parseFloat(css.getPropertyValue("--star-alpha")) || 0.3,
    };
  };
  let color = readColor();

  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Density scales with area; ~1 star per 9000px² is sparse and calm.
    const count = Math.round((width * height) / 9000);
    stars = Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      depth: 0.2 + Math.random() * 0.8,           // 0.2 = far (barely moves), 1 = near
      r: 0.4 + Math.random() * 1.1,               // radius in px
      phase: Math.random() * Math.PI * 2,         // for the slow breathing
      speed: 0.3 + Math.random() * 0.5,
    }));
  };

  const draw = (time) => {
    ctx.clearRect(0, 0, width, height);
    const scroll = window.scrollY;
    const t = time / 1000;
    stars.forEach((s) => {
      // Parallax: nearer stars drift up faster as you scroll. Wrap around vertically.
      const y = (((s.y - scroll * s.depth * 0.25) % height) + height) % height;
      const breathe = prefersReducedMotion ? 1 : 0.7 + 0.3 * Math.sin(t * s.speed + s.phase);
      ctx.beginPath();
      ctx.arc(s.x, y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${color.rgb}, ${color.alpha * s.depth * breathe})`;
      ctx.fill();
    });
    if (!prefersReducedMotion) requestAnimationFrame(draw);
  };

  // Re-read the palette if the OS theme flips while the page is open.
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    color = readColor();
  });
  window.addEventListener("resize", resize);
  if (prefersReducedMotion) window.addEventListener("scroll", () => draw(0), { passive: true });

  resize();
  requestAnimationFrame(draw);
}

/* ==========================================================================
   5. BOOT
   Order matters a little: render content first, then wire up behaviors that
   look for the rendered elements.
   ========================================================================== */
renderHero();
renderNotes();
renderLedger();
renderPapers();
renderTranscript();
renderMargins();
renderBuilds();
renderHello();

setupMenu();
setupActiveNav();
setupScrollProgress();
setupReveal();
setupDrawOnScroll();
setupTrack();
setupStarfield();
