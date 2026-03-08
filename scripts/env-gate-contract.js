const fs = require('fs');
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        Header, Footer, AlignmentType, LevelFormat,
        HeadingLevel, BorderStyle, WidthType, ShadingType,
        PageNumber, PageBreak, TabStopType, TabStopPosition } = require('docx');

// ── Helpers ──────────────────────────────────────────────────────────
const border = { style: BorderStyle.SINGLE, size: 1, color: "AAAAAA" };
const borders = { top: border, bottom: border, left: border, right: border };
const cellMargins = { top: 60, bottom: 60, left: 100, right: 100 };

function cell(text, width, opts = {}) {
  const runs = Array.isArray(text)
    ? text
    : [new TextRun({ text, bold: opts.bold || false, size: opts.size || 22, font: "Arial" })];
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    margins: cellMargins,
    shading: opts.shading ? { fill: opts.shading, type: ShadingType.CLEAR } : undefined,
    children: [new Paragraph({ children: runs, alignment: opts.align || AlignmentType.LEFT })],
  });
}

function headerCell(text, width) {
  return cell(text, width, { bold: true, shading: "2B5797", size: 22 });
}

function headerCellWhite(text, width) {
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    margins: cellMargins,
    shading: { fill: "2B5797", type: ShadingType.CLEAR },
    children: [new Paragraph({
      children: [new TextRun({ text, bold: true, size: 22, font: "Arial", color: "FFFFFF" })],
      alignment: AlignmentType.LEFT,
    })],
  });
}

function h1(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text, font: "Arial" })] });
}
function h2(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text, font: "Arial" })] });
}
function h3(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun({ text, font: "Arial" })] });
}
function p(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 120 },
    children: [new TextRun({ text, size: 22, font: "Arial", bold: opts.bold || false, italics: opts.italics || false })],
  });
}
function pRuns(runs) {
  return new Paragraph({ spacing: { after: 120 }, children: runs });
}
function bold(text) { return new TextRun({ text, bold: true, size: 22, font: "Arial" }); }
function normal(text) { return new TextRun({ text, size: 22, font: "Arial" }); }
function italic(text) { return new TextRun({ text, italics: true, size: 22, font: "Arial" }); }

// ── Document ─────────────────────────────────────────────────────────

const W = 9360; // content width (US Letter, 1" margins)

const doc = new Document({
  styles: {
    default: { document: { run: { font: "Arial", size: 22 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 32, bold: true, font: "Arial", color: "1F3864" },
        paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 26, bold: true, font: "Arial", color: "2B5797" },
        paragraph: { spacing: { before: 240, after: 160 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 24, bold: true, font: "Arial", color: "404040" },
        paragraph: { spacing: { before: 200, after: 120 }, outlineLevel: 2 } },
    ],
  },
  numbering: {
    config: [
      { reference: "bullets", levels: [
        { level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
        { level: 1, format: LevelFormat.BULLET, text: "\u25E6", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 1440, hanging: 360 } } } },
      ]},
      { reference: "numbers", levels: [
        { level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
      ]},
      { reference: "phases", levels: [
        { level: 0, format: LevelFormat.DECIMAL, text: "Phase %1:", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 720 } } } },
      ]},
    ],
  },
  sections: [
    // ══════════════════════ TITLE PAGE ══════════════════════
    {
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      children: [
        new Paragraph({ spacing: { before: 3600 } }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
          children: [new TextRun({ text: "ENVIRONMENT GATE CONTRACT", size: 48, bold: true, font: "Arial", color: "1F3864" })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 100 },
          children: [new TextRun({ text: "& Procedural Generation Roadmap", size: 36, font: "Arial", color: "2B5797" })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 600 },
          children: [new TextRun({ text: "Gone Rogue \u2014 Sandpoint ARG", size: 28, font: "Arial", color: "666666" })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 100 },
          children: [new TextRun({ text: "Version 1.0 \u2014 March 2026", size: 22, font: "Arial", color: "888888" })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 2400 },
          children: [new TextRun({ text: "Biome-Specific Gate Standards \u2022 Asset Scene Designer Pipeline \u2022 Floor State Tracking \u2022 Respawn Rules", size: 20, font: "Arial", color: "888888" })],
        }),
        new Paragraph({ children: [new PageBreak()] }),
      ],
    },

    // ══════════════════════ MAIN CONTENT ══════════════════════
    {
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            children: [
              new TextRun({ text: "Environment Gate Contract", size: 18, font: "Arial", color: "888888" }),
              new TextRun({ text: "\tGone Rogue", size: 18, font: "Arial", color: "888888" }),
            ],
            tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: "Page ", size: 18, font: "Arial", color: "888888" }),
                        new TextRun({ children: [PageNumber.CURRENT], size: 18, font: "Arial", color: "888888" })],
          })],
        }),
      },
      children: [

        // ─── 1. OVERVIEW ───────────────────────────────────────
        h1("1. Overview"),
        p("This document defines the canonical gate contract for Gone Rogue: how environmental gates are visually represented per biome, how they interact with the player, how they behave on floor revisits, and how the procedural generator should place them. It also specifies fixes for existing tutorial floor gate issues and outlines the asset scene designer pipeline for creating composite gate tiles."),

        pRuns([
          bold("Core Principle: "),
          normal("Every gate must cover the full span of the passage it guards. A gate that leaves walkable tiles around it is not a gate \u2014 it is decoration."),
        ]),

        // ─── 2. GATE TAXONOMY ──────────────────────────────────
        h1("2. Gate Taxonomy"),
        p("All gates in Gone Rogue fall into one of four categories, each with distinct interaction patterns and visual signaling."),

        h2("2.1 Breakable Gates (Tier 1)"),
        pRuns([
          normal("The default gate type. The player attacks the gate to break through. Each biome uses a standard breakable emoji. HP scales with floor difficulty. "),
          italic("Visual signal: single biome-standard emoji."),
        ]),

        h2("2.2 Locked Gates (Tier 2)"),
        pRuns([
          normal("Requires a specific key item to unlock. The gate is visually distinguished from breakable gates by a composite tile (base gate emoji + lock overlay). "),
          italic("Visual signal: asset scene composite of gate + lock emoji."),
        ]),

        h2("2.3 Mechanism Gates (Tier 3)"),
        pRuns([
          normal("Requires interaction with a remote mechanism (lever, button, pressure plate) to open. The gate itself cannot be attacked or unlocked directly. "),
          italic("Visual signal: asset scene composite of gate + mechanism emoji."),
        ]),

        h2("2.4 NPC Gates"),
        pRuns([
          normal("A friendly or hostile NPC blocks passage. Cleared through combat or dialogue. These are NOT environmental gates \u2014 they use the NPC gate system (npc-gate-system.js) and are outside the scope of this contract."),
        ]),

        // ─── 3. BIOME GATE EMOJI STANDARDS ─────────────────────
        h1("3. Biome Gate Emoji Standards"),
        p("Each biome defines a palette of gate emojis for Tier 1 (breakable), Tier 2 (locked), and Tier 3 (mechanism) gates. The base emoji is used standalone for breakable gates. Composite tiles are created in the Asset Scene Designer by layering the base + modifier emoji."),

        // FOREST
        h2("3.1 Cozy Forest (FOREST)"),

        new Table({
          width: { size: W, type: WidthType.DXA },
          columnWidths: [1800, 1200, 1800, 1200, 3360],
          rows: [
            new TableRow({ children: [
              headerCellWhite("Gate Type", 1800),
              headerCellWhite("Emoji", 1200),
              headerCellWhite("Composite", 1800),
              headerCellWhite("HP/Req", 1200),
              headerCellWhite("Description", 3360),
            ]}),
            new TableRow({ children: [
              cell("Breakable (wood)", 1800), cell("\uD83D\uDEA7", 1200), cell("\u2014", 1800),
              cell("2\u20134 HP", 1200), cell("Wooden barricade. Standard forest gate.", 3360),
            ]}),
            new TableRow({ children: [
              cell("Breakable (vine)", 1800), cell("\uD83C\uDF31", 1200), cell("\u2014", 1800),
              cell("1\u20132 HP", 1200), cell("Overgrown vine wall. Weaker alternative.", 3360),
            ]}),
            new TableRow({ children: [
              cell("Locked (wood)", 1800), cell("\u2014", 1200), cell("\uD83D\uDEA7+\uD83D\uDD12", 1800),
              cell("Rusty Key", 1200), cell("Barricade with padlock overlay. Requires key.", 3360),
            ]}),
            new TableRow({ children: [
              cell("Locked (vine)", 1800), cell("\u2014", 1200), cell("\uD83C\uDF31+\uD83C\uDF31", 1800),
              cell("Vine Key", 1200), cell("Dense double-vine. Requires vine cutter.", 3360),
            ]}),
            new TableRow({ children: [
              cell("Mechanism", 1800), cell("\u2014", 1200), cell("\uD83D\uDEA7+\u2699\uFE0F", 1800),
              cell("Lever", 1200), cell("Barricade with gear overlay. Needs lever pull.", 3360),
            ]}),
          ],
        }),

        new Paragraph({ spacing: { after: 200 } }),

        // GREY_CAVE
        h2("3.2 Grey Cave (GREY_CAVE)"),
        new Table({
          width: { size: W, type: WidthType.DXA },
          columnWidths: [1800, 1200, 1800, 1200, 3360],
          rows: [
            new TableRow({ children: [
              headerCellWhite("Gate Type", 1800), headerCellWhite("Emoji", 1200),
              headerCellWhite("Composite", 1800), headerCellWhite("HP/Req", 1200),
              headerCellWhite("Description", 3360),
            ]}),
            new TableRow({ children: [
              cell("Breakable (rocks)", 1800), cell("\uD83E\uDEA8", 1200), cell("\u2014", 1800),
              cell("3\u20135 HP", 1200), cell("Loose rock pile. Cave standard.", 3360),
            ]}),
            new TableRow({ children: [
              cell("Breakable (web)", 1800), cell("\uD83D\uDD78\uFE0F", 1200), cell("\u2014", 1800),
              cell("1\u20132 HP", 1200), cell("Thick spider web. Weaker alternative.", 3360),
            ]}),
            new TableRow({ children: [
              cell("Locked", 1800), cell("\u2014", 1200), cell("\uD83E\uDEA8+\uD83D\uDD12", 1800),
              cell("Cave Key", 1200), cell("Sealed rock wall with lock mechanism.", 3360),
            ]}),
            new TableRow({ children: [
              cell("Mechanism", 1800), cell("\u2014", 1200), cell("\uD83E\uDEA8+\uD83D\uDECE\uFE0F", 1800),
              cell("Button", 1200), cell("Rock slab with pressure plate.", 3360),
            ]}),
          ],
        }),

        new Paragraph({ spacing: { after: 200 } }),

        // OFFICE
        h2("3.3 Commercial Office (OFFICE)"),
        new Table({
          width: { size: W, type: WidthType.DXA },
          columnWidths: [1800, 1200, 1800, 1200, 3360],
          rows: [
            new TableRow({ children: [
              headerCellWhite("Gate Type", 1800), headerCellWhite("Emoji", 1200),
              headerCellWhite("Composite", 1800), headerCellWhite("HP/Req", 1200),
              headerCellWhite("Description", 3360),
            ]}),
            new TableRow({ children: [
              cell("Breakable (filing)", 1800), cell("\uD83D\uDDC4\uFE0F", 1200), cell("\u2014", 1800),
              cell("2\u20134 HP", 1200), cell("Toppled filing cabinets blocking the hall.", 3360),
            ]}),
            new TableRow({ children: [
              cell("Breakable (boxes)", 1800), cell("\uD83D\uDCE6", 1200), cell("\u2014", 1800),
              cell("1\u20133 HP", 1200), cell("Stacked cardboard boxes.", 3360),
            ]}),
            new TableRow({ children: [
              cell("Locked", 1800), cell("\u2014", 1200), cell("\uD83D\uDDC4\uFE0F+\uD83D\uDD10", 1800),
              cell("Keycard", 1200), cell("Locked filing blockade. Requires keycard.", 3360),
            ]}),
            new TableRow({ children: [
              cell("Mechanism", 1800), cell("\u2014", 1200), cell("\uD83D\uDDC4\uFE0F+\uD83D\uDDA5\uFE0F", 1800),
              cell("Terminal", 1200), cell("Security terminal override required.", 3360),
            ]}),
          ],
        }),

        new Paragraph({ spacing: { after: 200 } }),

        // MALL
        h2("3.4 Shopping Mall (MALL)"),
        new Table({
          width: { size: W, type: WidthType.DXA },
          columnWidths: [1800, 1200, 1800, 1200, 3360],
          rows: [
            new TableRow({ children: [
              headerCellWhite("Gate Type", 1800), headerCellWhite("Emoji", 1200),
              headerCellWhite("Composite", 1800), headerCellWhite("HP/Req", 1200),
              headerCellWhite("Description", 3360),
            ]}),
            new TableRow({ children: [
              cell("Breakable (cart)", 1800), cell("\uD83D\uDED2", 1200), cell("\u2014", 1800),
              cell("2\u20134 HP", 1200), cell("Overturned shopping carts.", 3360),
            ]}),
            new TableRow({ children: [
              cell("Breakable (shelf)", 1800), cell("\uD83D\uDDC3\uFE0F", 1200), cell("\u2014", 1800),
              cell("3\u20135 HP", 1200), cell("Collapsed store shelving.", 3360),
            ]}),
            new TableRow({ children: [
              cell("Locked", 1800), cell("\u2014", 1200), cell("\uD83D\uDED2+\uD83D\uDD12", 1800),
              cell("Store Key", 1200), cell("Chained carts with padlock.", 3360),
            ]}),
            new TableRow({ children: [
              cell("Mechanism", 1800), cell("\u2014", 1200), cell("\uD83D\uDED2+\uD83D\uDD14", 1800),
              cell("Bell/Alarm", 1200), cell("Alarm-rigged barricade. Disarm first.", 3360),
            ]}),
          ],
        }),

        new Paragraph({ spacing: { after: 200 } }),

        // INDUSTRIAL
        h2("3.5 Industrial Complex (INDUSTRIAL)"),
        new Table({
          width: { size: W, type: WidthType.DXA },
          columnWidths: [1800, 1200, 1800, 1200, 3360],
          rows: [
            new TableRow({ children: [
              headerCellWhite("Gate Type", 1800), headerCellWhite("Emoji", 1200),
              headerCellWhite("Composite", 1800), headerCellWhite("HP/Req", 1200),
              headerCellWhite("Description", 3360),
            ]}),
            new TableRow({ children: [
              cell("Breakable (barrel)", 1800), cell("\uD83D\uDEE2\uFE0F", 1200), cell("\u2014", 1800),
              cell("3\u20136 HP", 1200), cell("Stacked industrial drums.", 3360),
            ]}),
            new TableRow({ children: [
              cell("Breakable (crate)", 1800), cell("\uD83D\uDCE6", 1200), cell("\u2014", 1800),
              cell("2\u20134 HP", 1200), cell("Heavy shipping crates.", 3360),
            ]}),
            new TableRow({ children: [
              cell("Locked", 1800), cell("\u2014", 1200), cell("\uD83D\uDEE2\uFE0F+\u26D3\uFE0F", 1800),
              cell("Bolt Cutter", 1200), cell("Chained barrels. Requires bolt cutter.", 3360),
            ]}),
            new TableRow({ children: [
              cell("Mechanism", 1800), cell("\u2014", 1200), cell("\uD83D\uDEE2\uFE0F+\uD83D\uDD27", 1800),
              cell("Wrench", 1200), cell("Valve-locked pipe barricade.", 3360),
            ]}),
          ],
        }),

        new Paragraph({ spacing: { after: 200 } }),

        // AEROSPACE
        h2("3.6 Aerospace Museum (AEROSPACE)"),
        new Table({
          width: { size: W, type: WidthType.DXA },
          columnWidths: [1800, 1200, 1800, 1200, 3360],
          rows: [
            new TableRow({ children: [
              headerCellWhite("Gate Type", 1800), headerCellWhite("Emoji", 1200),
              headerCellWhite("Composite", 1800), headerCellWhite("HP/Req", 1200),
              headerCellWhite("Description", 3360),
            ]}),
            new TableRow({ children: [
              cell("Breakable (panel)", 1800), cell("\uD83D\uDEE1\uFE0F", 1200), cell("\u2014", 1800),
              cell("4\u20137 HP", 1200), cell("Dislodged hull panels. Toughest base gate.", 3360),
            ]}),
            new TableRow({ children: [
              cell("Breakable (glass)", 1800), cell("\uD83E\uDE9F", 1200), cell("\u2014", 1800),
              cell("1\u20132 HP", 1200), cell("Cracked display case glass.", 3360),
            ]}),
            new TableRow({ children: [
              cell("Locked", 1800), cell("\u2014", 1200), cell("\uD83D\uDEE1\uFE0F+\uD83D\uDD10", 1800),
              cell("Access Card", 1200), cell("Security-sealed bulkhead panel.", 3360),
            ]}),
            new TableRow({ children: [
              cell("Mechanism", 1800), cell("\u2014", 1200), cell("\uD83D\uDEE1\uFE0F+\uD83D\uDCDF", 1800),
              cell("Control Console", 1200), cell("Automated blast door. Console override.", 3360),
            ]}),
          ],
        }),

        new Paragraph({ spacing: { after: 200 } }),

        // ─── 4. FULL-SPAN GATE RULE ────────────────────────────
        h1("4. Full-Span Gate Rule"),
        pRuns([
          bold("Cardinal Rule: "),
          normal("A gate MUST occupy every walkable tile in the passage it guards. If a passage is 4 tiles wide, the gate must be 4 tiles wide. Any tile left open is a bypass and the gate serves no gameplay purpose."),
        ]),

        h2("4.1 Template Floor Gate Placement"),
        p("For template (contrived) floors, the gate span is determined by the passage geometry in the layout. The floor designer MUST count the walkable tiles in the narrowest cross-section of the passage and configure that many gate tiles."),

        pRuns([
          bold("Current Bug \u2014 L Marker Mismatch: "),
          normal("Floors 2 and 3 use 'L' template markers at 4 positions each (e.g., columns 18\u201321 on row 8), but the gate configs only instantiate 2-tile gates (columns 19\u201320). The 'L' markers become EMPTY tiles in the parser, creating 2-tile bypasses on each side. Fix: expand gate configs to cover all 4 positions, or narrow the passage to match the gate width."),
        ]),

        h2("4.2 Procedural Floor Gate Placement"),
        p("The procedural generator must measure the passage width at the chosen gate location and spawn gate tiles for every walkable column. The gate placement function should scan the cross-section perpendicular to the path, find every EMPTY tile bounded by WALL on both ends, and fill the entire span with gate tiles."),

        pRuns([
          bold("Algorithm: "),
          italic("For a horizontal passage at row Y, scan columns left-to-right. Find the first WALL after EMPTY tiles and the last WALL before EMPTY tiles. Fill everything between with gate tiles."),
        ]),

        // ─── 5. ASSET SCENE DESIGNER PIPELINE ──────────────────
        h1("5. Asset Scene Designer Pipeline"),
        p("Composite gate tiles (Tier 2 locked gates, Tier 3 mechanism gates) are created using the Asset Scene Designer tool. This pipeline produces layered emoji compositions where multiple emojis overlap on a single game tile, creating visually distinct gate variants that players can learn to recognize."),

        h2("5.1 Layer Structure"),
        p("The Asset Scene Designer uses three z-layers for composition:"),

        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          spacing: { after: 80 },
          children: [bold("Base Layer (z:0): "), normal("The biome-standard gate emoji (e.g., \uD83D\uDEA7 for Forest). This is the same emoji used for Tier 1 breakable gates, providing visual continuity.")],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          spacing: { after: 80 },
          children: [bold("Surface Layer (z:4): "), normal("The modifier emoji (e.g., \uD83D\uDD12 lock, \u2699\uFE0F gear). Positioned with slight offset to create an overlapping composite effect.")],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          spacing: { after: 80 },
          children: [bold("Floating Layer (z:8): "), normal("Optional sparkle, glow, or animation indicator for active mechanism gates.")],
        }),

        h2("5.2 Authoring Workflow"),
        pRuns([
          normal("1. Open the Asset Scene Designer (asset-designer.html). 2. Select the base gate emoji from the biome palette. 3. Add the modifier emoji on the surface layer with density 1 (single instance, centered). 4. Adjust scatter and position offset to achieve desired overlap. 5. Use the density tester to preview at game scale. 6. Export to the Asset Cluster Registry with a naming convention: "),
          bold("gate_{biome}_{tier}"),
          normal(" (e.g., gate_forest_locked, gate_cave_mechanism)."),
        ]),

        h2("5.3 Registry Integration"),
        p("Exported composite gate assets are stored in the Asset Cluster Registry (asset-cluster-registry.js) and referenced by the gate system modules. The biome-gate-system.js module queries the registry by biome ID and gate tier to retrieve the correct composite asset at floor generation time."),

        // ─── 6. TUTORIAL FLOOR FIXES ────────────────────────────
        h1("6. Tutorial Floor Fix Specifications"),

        h2("6.1 Floor 2 \u2014 Hourglass Gate"),
        pRuns([
          bold("Problem: "),
          normal("The hourglass passage at row 8 is approximately 20 tiles wide. The current tutorialGate config places a 2-tile gate at positions (19,8)\u2013(20,8), leaving 18 tiles of walkable bypass. The 'L' markers at positions 18\u201321 suggest a 4-tile gate, which is still insufficient."),
        ]),
        pRuns([
          bold("Fix: "),
          normal("Redesign the hourglass narrowing to create a proper 3\u20134 tile bottleneck. The passage walls must pinch inward at row 8 so that the gate tiles fully block the only path. Move the wall tiles at row 8 to columns ~18 and ~22, creating a 4-tile opening filled entirely by the gate. Update the tutorialGate config to cover positions (18,8) through (21,8)."),
        ]),

        h2("6.2 Floor 3 \u2014 Wall Funnel Gate"),
        pRuns([
          bold("Problem: "),
          normal("Floor 3 has a lockedGate at (20,9)\u2013(21,9), but the passage marked with 'L' at positions 18\u201321 is 4 tiles wide, leaving 2-tile bypasses. More critically, there is no player incentive to engage this gate \u2014 the key (Marked Crate at 10,9) is behind the same wall structure, requiring the player to break a breakable just to get the key to open the gate that guards nothing of clear value beyond it."),
        ]),
        pRuns([
          bold("Fix: "),
          normal("1. Expand the locked gate to cover all 4 positions (18\u201321, row 9). 2. Place a visible reward or story-critical item behind the gate to create incentive. 3. Ensure the keyBreakable (Marked Crate) is accessible without requiring the player to solve a separate puzzle first \u2014 move it to a position on the player's natural path. 4. Consider adding a visual teaser: the player can SEE the reward through the gate before finding the key."),
        ]),

        h2("6.3 Floor 1 \u2014 Wooden Gate (Reference)"),
        pRuns([
          normal("Floor 1's 3-tile wooden gate at (18\u201320, row 14) correctly covers its passage span and serves as the first breakable gate tutorial. No changes needed. This is the reference implementation for proper gate placement."),
        ]),

        // ─── 7. FLOOR STATE TRACKING ────────────────────────────
        h1("7. Floor State Tracking System"),
        p("A new module or extension to the existing DoorContractSystem must track per-floor state across visits. This prevents broken gates from reappearing when the player backtracks and enables differential respawn behavior."),

        h2("7.1 FloorStateTracker Module"),
        pRuns([
          normal("New IIFE module: "),
          bold("floor-state-tracker.js"),
          normal(". Maintains a map of floorId \u2192 state objects persisted for the duration of a run."),
        ]),

        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          spacing: { after: 80 },
          children: [bold("destroyedGates: "), normal("Array of { x, y, gateType } for gates the player has broken or unlocked. On floor revisit, these positions remain EMPTY \u2014 the gate is NOT respawned.")],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          spacing: { after: 80 },
          children: [bold("destroyedBreakables: "), normal("Array of { x, y, breakableType, originalLootTable } for breakables (crates, barrels, etc.) the player has smashed. On revisit, these respawn with a degraded loot table (see Section 8).")],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          spacing: { after: 80 },
          children: [bold("visitCount: "), normal("Number of times the player has entered this floor. Used to scale enemy respawn difficulty and breakable loot degradation.")],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          spacing: { after: 80 },
          children: [bold("unlockedDoors: "), normal("Array of { x, y } for building interior doors the player has already entered. Relevant for building interior access sensitivity (see Section 9).")],
        }),

        h2("7.2 Gate Respawn Rules"),

        new Table({
          width: { size: W, type: WidthType.DXA },
          columnWidths: [2400, 2400, 4560],
          rows: [
            new TableRow({ children: [
              headerCellWhite("Element", 2400),
              headerCellWhite("First Visit", 2400),
              headerCellWhite("Subsequent Visits", 4560),
            ]}),
            new TableRow({ children: [
              cell("Breakable Gate", 2400),
              cell("Full HP, standard loot", 2400),
              cell("NEVER respawns. Position remains EMPTY permanently.", 4560),
            ]}),
            new TableRow({ children: [
              cell("Locked Gate", 2400),
              cell("Requires key", 2400),
              cell("NEVER respawns. Position remains EMPTY permanently.", 4560),
            ]}),
            new TableRow({ children: [
              cell("Mechanism Gate", 2400),
              cell("Requires mechanism", 2400),
              cell("NEVER respawns. Position remains EMPTY permanently.", 4560),
            ]}),
            new TableRow({ children: [
              cell("Breakable Object", 2400),
              cell("Full HP, standard loot", 2400),
              cell("Respawns with reduced HP and degraded loot table.", 4560),
            ]}),
            new TableRow({ children: [
              cell("Enemies", 2400),
              cell("Full spawn table", 2400),
              cell("Dynamic respawn: fewer enemies, weaker variants.", 4560),
            ]}),
          ],
        }),

        new Paragraph({ spacing: { after: 200 } }),

        // ─── 8. BREAKABLE RESPAWN ───────────────────────────────
        h1("8. Breakable Respawn Rules"),
        p("When a player revisits a floor, previously destroyed breakable objects (crates, barrels, etc. \u2014 NOT gates) respawn in their original positions but in a degraded state. This provides some reason to revisit floors while preventing the player from farming high-value loot."),

        h2("8.1 Degradation Formula"),
        pRuns([
          bold("HP: "),
          normal("Respawned breakables have 1 HP regardless of original HP. They are trivially destroyed."),
        ]),
        pRuns([
          bold("Loot Table: "),
          normal("Each visit multiplies the loot table quality by a decay factor. Visit 2: 50% chance of any loot, quality tier reduced by 1. Visit 3+: 25% chance of any loot, quality tier reduced by 2. Common consumables only \u2014 no keys, no quest items, no equipment."),
        ]),
        pRuns([
          bold("Visual Signal: "),
          normal("Respawned breakables use a dimmed or \"worn\" visual variant. The Asset Scene Designer can produce these by adding a translucent grey overlay on the floating layer."),
        ]),

        h2("8.2 Quest Item Protection"),
        p("Breakables that originally contained quest items (keys, story items) are NEVER respawned. Their positions remain EMPTY after the first destruction. This prevents duplicate quest item generation and softlock conditions."),

        // ─── 9. ENEMY RESPAWN ───────────────────────────────────
        h1("9. Dynamic Enemy Respawn"),
        p("When the player revisits a previously cleared floor, enemies respawn at reduced density to maintain gameplay tension while not punishing backtracking."),

        h2("9.1 Respawn Density"),
        pRuns([
          bold("Visit 2: "),
          normal("50% of original enemy count. Selected randomly from original spawn positions."),
        ]),
        pRuns([
          bold("Visit 3: "),
          normal("30% of original enemy count."),
        ]),
        pRuns([
          bold("Visit 4+: "),
          normal("20% of original enemy count (floor minimum: 1 enemy if the floor originally had enemies)."),
        ]),

        h2("9.2 Respawn Quality"),
        p("Respawned enemies are drawn from the same biome enemy pool but shifted one tier lower than the floor's standard difficulty. This makes backtracking feel like returning to familiar, now-easier territory rather than a fresh challenge."),

        // ─── 10. BUILDING INTERIOR SENSITIVITY ──────────────────
        h1("10. Building Interior Access Sensitivity"),
        p("Players may need to backtrack through cleared floors to reach building interiors they previously skipped. The floor state system must ensure this experience is smooth and not punishing."),

        h2("10.1 Cleared Path Guarantee"),
        pRuns([
          normal("All gates on the player's path between the retreat door and any building entrance remain permanently cleared. The floor state tracker's "),
          bold("destroyedGates"),
          normal(" array ensures these positions stay EMPTY on revisit. The player walks through empty doorframes where gates once stood."),
        ]),

        h2("10.2 Building Door State"),
        p("Building interior doors are NEVER gated on revisit. Once a player has seen a building entrance, the building door emoji and interaction remain available regardless of floor revisit state. Building doors are tracked separately from environmental gates."),

        h2("10.3 Enemy Avoidance Path"),
        p("Respawned enemies should preferentially spawn AWAY from the direct path between the retreat door and building entrances. The respawn position selection algorithm should weight positions further from building door tiles to minimize forced combat during building access runs."),

        // ─── 11. PROC GEN ROADMAP ───────────────────────────────
        new Paragraph({ children: [new PageBreak()] }),
        h1("11. Procedural Generation Roadmap"),
        p("The following phases implement the gate contract into the existing module architecture. Each phase builds on the previous and can be verified independently."),

        h2("Phase 1: Floor State Tracker Module"),
        pRuns([
          bold("Create: "),
          normal("floor-state-tracker.js (~150 lines)"),
        ]),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          spacing: { after: 80 },
          children: [normal("IIFE module following established satellite pattern (stateless, ctx-driven)")],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          spacing: { after: 80 },
          children: [normal("Owns _floorStates map: floorId \u2192 { destroyedGates[], destroyedBreakables[], visitCount, unlockedDoors[] }")],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          spacing: { after: 80 },
          children: [normal("API: recordGateDestroyed(floorId, x, y, type), recordBreakableDestroyed(floorId, x, y, type, lootTable), incrementVisit(floorId), getFloorState(floorId), resetAll()")],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          spacing: { after: 80 },
          children: [normal("Wire into gone-rogue.js ctx factories: _playerInteractionCtx, _floorTransitionCtx")],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          spacing: { after: 80 },
          children: [bold("Verify: "), normal("Break a gate on Floor 1, advance to Floor 2, retreat to Floor 1 \u2014 gate position should be EMPTY.")],
        }),

        h2("Phase 2: Tutorial Floor Gate Fixes"),
        pRuns([
          bold("Edit: "),
          normal("tutorial-floors.js, tutorial-floor-gen.js"),
        ]),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          spacing: { after: 80 },
          children: [normal("Floor 2: Narrow the hourglass passage walls at row 8 to create a 4-tile bottleneck. Update tutorialGate config to cover all 4 positions.")],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          spacing: { after: 80 },
          children: [normal("Floor 3: Expand locked gate to 4 tiles. Relocate keyBreakable to player's natural path. Add visible reward behind gate.")],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          spacing: { after: 80 },
          children: [normal("Remove all 'L' template markers \u2014 replace with WALL tiles where passage should be blocked or EMPTY where gate tiles will be placed programmatically.")],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          spacing: { after: 80 },
          children: [bold("Verify: "), normal("Play through Floors 0\u20133 \u2014 all gates cover full span, no bypasses, key is on natural path.")],
        }),

        h2("Phase 3: Biome Gate Emoji Registry"),
        pRuns([
          bold("Create: "),
          normal("gate-emoji-registry.js (~100 lines)"),
        ]),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          spacing: { after: 80 },
          children: [normal("IIFE module: maps biomeId \u2192 { breakable: [emojis], locked: [compositeIds], mechanism: [compositeIds] }")],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          spacing: { after: 80 },
          children: [normal("Populated from the biome gate emoji standards defined in Section 3 of this document")],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          spacing: { after: 80 },
          children: [normal("Query API: getBreakableEmoji(biomeId), getLockedComposite(biomeId), getMechanismComposite(biomeId)")],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          spacing: { after: 80 },
          children: [normal("Wire into biome-gate-system.js to replace hardcoded emoji references")],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          spacing: { after: 80 },
          children: [bold("Verify: "), normal("Generate floors in each biome \u2014 gates use correct biome-specific emojis.")],
        }),

        h2("Phase 4: Asset Scene Designer Composite Gate Assets"),
        pRuns([
          bold("Author: "),
          normal("Composite gate assets for all 6 biomes using Asset Scene Designer"),
        ]),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          spacing: { after: 80 },
          children: [normal("Create locked gate composites (base + lock emoji) for each biome: 6 assets")],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          spacing: { after: 80 },
          children: [normal("Create mechanism gate composites (base + mechanism emoji) for each biome: 6 assets")],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          spacing: { after: 80 },
          children: [normal("Create degraded breakable overlays (dimmed variant) for each biome: 6 assets")],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          spacing: { after: 80 },
          children: [normal("Export all to Asset Cluster Registry with gate_{biome}_{tier} naming convention")],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          spacing: { after: 80 },
          children: [bold("Verify: "), normal("Visual inspection of all 18 composite assets at game scale in density tester.")],
        }),

        h2("Phase 5: Full-Span Procedural Gate Placement"),
        pRuns([
          bold("Edit: "),
          normal("biome-gate-system.js, floor-generator.js"),
        ]),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          spacing: { after: 80 },
          children: [normal("Implement passage-width scanning algorithm: given a gate position, scan perpendicular to path direction and fill the entire WALL-to-WALL span")],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          spacing: { after: 80 },
          children: [normal("Update placeTutorialGate() and placeBiomeGates() to use span-filling logic")],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          spacing: { after: 80 },
          children: [normal("Add gate type selection: floors 4\u20136 use breakable only, floors 7\u201310 introduce locked gates, floors 11+ introduce mechanism gates")],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          spacing: { after: 80 },
          children: [bold("Verify: "), normal("Generate 20 procedural floors \u2014 every gate covers its full passage span, no bypasses.")],
        }),

        h2("Phase 6: Respawn Integration"),
        pRuns([
          bold("Edit: "),
          normal("floor-gen-core.js, tutorial-floor-gen.js, gone-rogue.js"),
        ]),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          spacing: { after: 80 },
          children: [normal("After floor generation, check FloorStateTracker for existing state")],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          spacing: { after: 80 },
          children: [normal("Remove destroyed gates from the generated grid (set positions to EMPTY)")],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          spacing: { after: 80 },
          children: [normal("Respawn breakables with degraded HP and loot tables per visit count")],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          spacing: { after: 80 },
          children: [normal("Respawn enemies at reduced density, shifted away from building door positions")],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          spacing: { after: 80 },
          children: [bold("Verify: "), normal("Full backtracking playthrough: break gates, advance 3 floors, retreat back \u2014 gates gone, breakables degraded, enemies reduced, building access clear.")],
        }),

        // ─── 12. MODULE DEPENDENCY ──────────────────────────────
        h1("12. Module Dependency Graph"),
        p("The following shows the load order and dependency relationships for gate-related modules. All new modules follow the established IIFE satellite pattern."),

        new Table({
          width: { size: W, type: WidthType.DXA },
          columnWidths: [3000, 3000, 3360],
          rows: [
            new TableRow({ children: [
              headerCellWhite("Module", 3000),
              headerCellWhite("Depends On", 3000),
              headerCellWhite("Depended On By", 3360),
            ]}),
            new TableRow({ children: [
              cell("floor-state-tracker.js", 3000, { bold: true }),
              cell("(none \u2014 standalone)", 3000),
              cell("floor-gen-core.js, tutorial-floor-gen.js, gone-rogue.js (ctx)", 3360),
            ]}),
            new TableRow({ children: [
              cell("gate-emoji-registry.js", 3000, { bold: true }),
              cell("(none \u2014 standalone)", 3000),
              cell("biome-gate-system.js, tutorial-floor-gen.js", 3360),
            ]}),
            new TableRow({ children: [
              cell("asset-cluster-registry.js", 3000),
              cell("(none \u2014 standalone)", 3000),
              cell("gate-emoji-registry.js, biome-visual-facade.js", 3360),
            ]}),
            new TableRow({ children: [
              cell("biome-gate-system.js", 3000),
              cell("gate-emoji-registry.js, floor-state-tracker.js", 3000),
              cell("floor-gen-core.js", 3360),
            ]}),
            new TableRow({ children: [
              cell("door-contract-system.js", 3000),
              cell("(none \u2014 standalone)", 3000),
              cell("floor-gen-core.js, tutorial-floor-gen.js, gone-rogue.js (ctx)", 3360),
            ]}),
          ],
        }),

        new Paragraph({ spacing: { after: 200 } }),

        // ─── 13. PHASE DEPENDENCIES ─────────────────────────────
        h1("13. Phase Dependencies"),
        p("Phases 1 and 3 are independent and can be developed in parallel. Phase 2 depends on Phase 1 (floor state tracking needed for gate destruction recording). Phase 4 is independent (art authoring). Phase 5 depends on Phase 3 (needs emoji registry). Phase 6 depends on Phases 1, 3, 4, and 5."),

        new Table({
          width: { size: W, type: WidthType.DXA },
          columnWidths: [1560, 1560, 1560, 1560, 1560, 1560],
          rows: [
            new TableRow({ children: [
              headerCellWhite("Phase 1", 1560), headerCellWhite("Phase 2", 1560),
              headerCellWhite("Phase 3", 1560), headerCellWhite("Phase 4", 1560),
              headerCellWhite("Phase 5", 1560), headerCellWhite("Phase 6", 1560),
            ]}),
            new TableRow({ children: [
              cell("State Tracker", 1560), cell("Tutorial Fixes", 1560),
              cell("Emoji Registry", 1560), cell("Asset Authoring", 1560),
              cell("Full-Span Proc", 1560), cell("Respawn Integ.", 1560),
            ]}),
            new TableRow({ children: [
              cell("Independent", 1560, { shading: "D5E8D4" }),
              cell("Needs Phase 1", 1560, { shading: "FFF2CC" }),
              cell("Independent", 1560, { shading: "D5E8D4" }),
              cell("Independent", 1560, { shading: "D5E8D4" }),
              cell("Needs Phase 3", 1560, { shading: "FFF2CC" }),
              cell("Needs 1,3,4,5", 1560, { shading: "F4CCCC" }),
            ]}),
          ],
        }),

        new Paragraph({ spacing: { after: 400 } }),

        // ─── END ────────────────────────────────────────────────
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 400 },
          children: [new TextRun({ text: "\u2014 End of Document \u2014", size: 20, font: "Arial", color: "888888", italics: true })],
        }),
      ],
    },
  ],
});

// ── Generate ─────────────────────────────────────────────────────────
Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync("/sessions/peaceful-compassionate-pascal/mnt/EyesOnly/Environment_Gate_Contract.docx", buffer);
  console.log("Document created successfully.");
});
