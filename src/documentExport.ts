export type DocumentSection = {
  heading: string;
  paragraphs: string[];
  link?: { label: string; url: string };
};

type DocumentOptions = {
  filename: string;
  title: string;
  subtitle: string;
  sections: DocumentSection[];
  footnote: string;
};

/** Loaded only on demand; no interests or itinerary data leave the browser. */
export async function downloadWordDocument(options: DocumentOptions) {
  const { Document, Packer, Paragraph, TextRun, ExternalHyperlink, HeadingLevel } = await import("docx");
  const children = [
    new Paragraph({ text: "OPEN DOOR", spacing: { after: 140 } }),
    new Paragraph({ text: options.title, heading: HeadingLevel.TITLE }),
    new Paragraph({ text: options.subtitle, spacing: { after: 260 } }),
    ...options.sections.flatMap(section => {
      const blocks = [
        new Paragraph({ text: section.heading, heading: HeadingLevel.HEADING_1, keepNext: true }),
        ...section.paragraphs.map(text => new Paragraph({ text, spacing: { after: 140 } })),
      ];
      if (section.link) {
        const url = new URL(section.link.url);
        if (url.protocol !== "https:") throw new Error("Document links must use HTTPS.");
        blocks.push(new Paragraph({
          children: [new ExternalHyperlink({
            link: url.href,
            children: [new TextRun({ text: section.link.label, style: "Hyperlink" })],
          })],
          spacing: { after: 240 },
        }));
      }
      return blocks;
    }),
    new Paragraph({ text: "Before you go", heading: HeadingLevel.HEADING_1 }),
    new Paragraph({ text: options.footnote }),
  ];
  const document = new Document({
    creator: "Open Door",
    title: options.title,
    description: "Your Open Door recommendations and practical planning notes.",
    styles: {
      default: { document: { run: { font: "Calibri", size: 24, color: "263B35" }, paragraph: { spacing: { line: 320 } } } },
    },
    sections: [{ properties: {}, children }],
  });
  const blob = await Packer.toBlob(document);
  const url = URL.createObjectURL(blob);
  const anchor = window.document.createElement("a");
  anchor.href = url;
  anchor.download = options.filename;
  window.document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
