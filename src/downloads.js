// Document export helpers — DOCX (via docx library) and PDF (via pdfmake)
// Shared between the legacy desktop site (src/) and the Vite app (app/) — loaded as plain JS

(function () {
  const triggerDownload = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const safeName = (s) => (s || 'document').replace(/[\\/:*?"<>|]/g, '_').slice(0, 60);

  window.getUserName = () => {
    try { return JSON.parse(localStorage.getItem('admitica.name')) || ''; }
    catch { return ''; }
  };

  // ===== ESSAY =====
  window.downloadEssayDocx = (title, text) => {
    if (!window.docx) return alert('Библиотека загружается, попробуйте через секунду');
    const { Document, Packer, Paragraph, TextRun, HeadingLevel } = window.docx;
    const paragraphs = [
      new Paragraph({
        children: [new TextRun({ text: title, bold: true, size: 36 })],
        spacing: { after: 300 },
      }),
    ];
    (text || '').split(/\n\n+/).forEach((p) => {
      paragraphs.push(
        new Paragraph({
          children: [new TextRun({ text: p, size: 24 })], // 12pt
          spacing: { after: 200, line: 360 },
        })
      );
    });
    const doc = new Document({ sections: [{ children: paragraphs }] });
    Packer.toBlob(doc).then((blob) => triggerDownload(blob, safeName(title) + '.docx'));
  };

  window.downloadEssayPdf = (title, text) => {
    if (!window.pdfMake) return alert('Библиотека загружается, попробуйте через секунду');
    const docDef = {
      pageMargins: [50, 50, 50, 50],
      content: [
        { text: title, fontSize: 18, bold: true, margin: [0, 0, 0, 16] },
        ...(text || '').split(/\n\n+/).map((p) => ({
          text: p,
          fontSize: 11,
          lineHeight: 1.45,
          margin: [0, 0, 0, 10],
          alignment: 'justify',
        })),
      ],
      defaultStyle: { font: 'Roboto' },
    };
    window.pdfMake.createPdf(docDef).download(safeName(title) + '.pdf');
  };

  // ===== RESUME =====
  window.downloadResumeDocx = (userName, achievements) => {
    if (!window.docx) return alert('Библиотека загружается, попробуйте через секунду');
    const { Document, Packer, Paragraph, TextRun, HeadingLevel } = window.docx;
    const children = [
      new Paragraph({
        children: [new TextRun({ text: userName || 'Резюме', bold: true, size: 44 })],
        spacing: { after: 200 },
      }),
      new Paragraph({
        children: [new TextRun({ text: 'Curriculum Vitae', italics: true, color: '666666', size: 22 })],
        spacing: { after: 400 },
      }),
      new Paragraph({
        children: [new TextRun({ text: 'Достижения', bold: true, size: 30 })],
        spacing: { before: 200, after: 200 },
      }),
    ];
    (achievements || []).forEach((a) => {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: a.title || '', bold: true, size: 26 })],
          spacing: { before: 200, after: 60 },
        })
      );
      if (a.org) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: a.org, italics: true, color: '666666', size: 22 })],
            spacing: { after: 80 },
          })
        );
      }
      if (a.desc) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: a.desc, size: 22 })],
            spacing: { after: 100, line: 320 },
          })
        );
      }
      if (a.skills && a.skills.length) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: a.skills.map((s) => '#' + s).join('  '), color: '888888', size: 20 })],
            spacing: { after: 200 },
          })
        );
      }
    });
    const doc = new Document({ sections: [{ children }] });
    Packer.toBlob(doc).then((blob) => triggerDownload(blob, safeName('CV_' + (userName || 'admitica')) + '.docx'));
  };

  window.downloadResumePdf = (userName, achievements) => {
    if (!window.pdfMake) return alert('Библиотека загружается, попробуйте через секунду');
    const content = [
      { text: userName || 'Резюме', fontSize: 24, bold: true, margin: [0, 0, 0, 4] },
      { text: 'Curriculum Vitae', italics: true, color: '#666', fontSize: 11, margin: [0, 0, 0, 20] },
      {
        canvas: [{ type: 'line', x1: 0, y1: 0, x2: 495, y2: 0, lineWidth: 0.5, lineColor: '#cccccc' }],
        margin: [0, 0, 0, 14],
      },
      { text: 'Достижения', fontSize: 14, bold: true, margin: [0, 4, 0, 10] },
    ];
    (achievements || []).forEach((a) => {
      content.push({ text: a.title || '', bold: true, fontSize: 12, margin: [0, 10, 0, 2] });
      if (a.org) content.push({ text: a.org, italics: true, color: '#666', fontSize: 10, margin: [0, 0, 0, 4] });
      if (a.desc) content.push({ text: a.desc, fontSize: 11, lineHeight: 1.4, margin: [0, 0, 0, 4] });
      if (a.skills && a.skills.length) {
        content.push({ text: a.skills.map((s) => '#' + s).join('  '), color: '#999', fontSize: 9, margin: [0, 2, 0, 6] });
      }
    });
    const docDef = {
      pageMargins: [50, 50, 50, 50],
      content,
      defaultStyle: { font: 'Roboto' },
    };
    window.pdfMake.createPdf(docDef).download(safeName('CV_' + (userName || 'admitica')) + '.pdf');
  };
})();
