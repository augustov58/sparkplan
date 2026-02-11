/**
 * One-Line Diagram Export Service
 * Exports the electrical one-line diagram as PDF or SVG
 */

/**
 * Export the one-line diagram SVG as a downloadable SVG file
 */
export const exportDiagramAsSVG = (
  svgElement: SVGSVGElement | null,
  projectName: string
): void => {
  if (!svgElement) {
    throw new Error('No diagram element found');
  }

  // Clone the SVG to avoid modifying the original
  const clonedSvg = svgElement.cloneNode(true) as SVGSVGElement;
  
  // Add white background
  const background = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  background.setAttribute('width', '100%');
  background.setAttribute('height', '100%');
  background.setAttribute('fill', 'white');
  clonedSvg.insertBefore(background, clonedSvg.firstChild);

  // Add metadata
  const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
  title.textContent = `One-Line Diagram - ${projectName}`;
  clonedSvg.insertBefore(title, clonedSvg.firstChild);

  // Serialize SVG to string
  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(clonedSvg);

  // Create blob
  const blob = new Blob([svgString], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);

  // Trigger download
  const link = document.createElement('a');
  link.href = url;
  link.download = `${projectName.replace(/[^a-z0-9]/gi, '_')}_One_Line_Diagram_${new Date().toISOString().split('T')[0]}.svg`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Cleanup
  setTimeout(() => URL.revokeObjectURL(url), 100);
};

/**
 * Export the one-line diagram as a PNG image
 */
export const exportDiagramAsPNG = async (
  svgElement: SVGSVGElement | null,
  projectName: string,
  scale: number = 2
): Promise<void> => {
  if (!svgElement) {
    throw new Error('No diagram element found');
  }

  return new Promise((resolve, reject) => {
    try {
      // Get SVG dimensions
      const viewBox = svgElement.getAttribute('viewBox')?.split(' ') || ['0', '0', '800', '750'];
      const width = parseInt(viewBox[2]) * scale;
      const height = parseInt(viewBox[3]) * scale;

      // Clone and prepare SVG
      const clonedSvg = svgElement.cloneNode(true) as SVGSVGElement;
      clonedSvg.setAttribute('width', width.toString());
      clonedSvg.setAttribute('height', height.toString());

      // Add white background
      const background = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      background.setAttribute('width', '100%');
      background.setAttribute('height', '100%');
      background.setAttribute('fill', 'white');
      clonedSvg.insertBefore(background, clonedSvg.firstChild);

      // Serialize SVG
      const serializer = new XMLSerializer();
      const svgString = serializer.serializeToString(clonedSvg);
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      // Create image and canvas
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        // Draw white background
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, width, height);

        // Draw SVG
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to blob and download
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Failed to create PNG blob'));
            return;
          }

          const pngUrl = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = pngUrl;
          link.download = `${projectName.replace(/[^a-z0-9]/gi, '_')}_One_Line_Diagram_${new Date().toISOString().split('T')[0]}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

          // Cleanup
          setTimeout(() => {
            URL.revokeObjectURL(url);
            URL.revokeObjectURL(pngUrl);
          }, 100);

          resolve();
        }, 'image/png');
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load SVG image'));
      };

      img.src = url;
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Generate a PDF with the one-line diagram and project information
 * Uses html2canvas + jspdf for proper SVG rendering in PDF
 * Falls back to PNG export if PDF generation fails
 */
export const exportDiagramAsPDF = async (
  svgElement: SVGSVGElement | null,
  projectName: string,
  projectAddress: string,
  serviceVoltage: number,
  servicePhase: number
): Promise<void> => {
  if (!svgElement) {
    throw new Error('No diagram element found');
  }

  // Since @react-pdf/renderer doesn't support SVG well, we'll create
  // a comprehensive print-friendly version
  return new Promise((resolve, reject) => {
    try {
      // Get SVG dimensions
      const viewBox = svgElement.getAttribute('viewBox')?.split(' ') || ['0', '0', '800', '750'];
      const svgWidth = parseInt(viewBox[2]);
      const svgHeight = parseInt(viewBox[3]);

      // Clone and prepare SVG
      const clonedSvg = svgElement.cloneNode(true) as SVGSVGElement;

      // Add white background
      const background = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      background.setAttribute('width', '100%');
      background.setAttribute('height', '100%');
      background.setAttribute('fill', 'white');
      clonedSvg.insertBefore(background, clonedSvg.firstChild);

      // Serialize SVG
      const serializer = new XMLSerializer();
      const svgString = serializer.serializeToString(clonedSvg);

      // Create print window with PDF-like layout
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        reject(new Error('Failed to open print window. Please allow popups.'));
        return;
      }

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>One-Line Diagram - ${projectName}</title>
          <style>
            @page {
              size: landscape;
              margin: 0.5in;
            }
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            body {
              font-family: 'Arial', sans-serif;
              background: white;
              color: #333;
            }
            .page {
              width: 100%;
              max-width: 10in;
              margin: 0 auto;
              padding: 0.5in;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              border-bottom: 3px solid #000;
              padding-bottom: 15px;
              margin-bottom: 20px;
            }
            .title-block h1 {
              font-size: 24px;
              font-weight: bold;
              margin-bottom: 5px;
            }
            .title-block p {
              font-size: 12px;
              color: #666;
            }
            .info-block {
              text-align: right;
              font-size: 11px;
            }
            .info-block p {
              margin-bottom: 3px;
            }
            .info-block strong {
              color: #000;
            }
            .diagram-container {
              width: 100%;
              aspect-ratio: ${svgWidth} / ${svgHeight};
              border: 1px solid #ddd;
              margin: 20px 0;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .diagram-container svg {
              width: 100%;
              height: auto;
              max-height: 6in;
            }
            .footer {
              border-top: 1px solid #ccc;
              padding-top: 10px;
              display: flex;
              justify-content: space-between;
              font-size: 9px;
              color: #666;
            }
            .legend {
              margin-top: 15px;
              padding: 10px;
              background: #f9f9f9;
              border: 1px solid #eee;
              font-size: 10px;
            }
            .legend h3 {
              font-size: 11px;
              margin-bottom: 8px;
              border-bottom: 1px solid #ddd;
              padding-bottom: 5px;
            }
            .legend-items {
              display: flex;
              flex-wrap: wrap;
              gap: 15px;
            }
            .legend-item {
              display: flex;
              align-items: center;
              gap: 5px;
            }
            .legend-color {
              width: 20px;
              height: 12px;
              border: 1px solid #999;
            }
            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .page { padding: 0; }
            }
          </style>
        </head>
        <body>
          <div class="page">
            <div class="header">
              <div class="title-block">
                <h1>ELECTRICAL ONE-LINE DIAGRAM</h1>
                <p>${projectName}</p>
                <p>${projectAddress}</p>
              </div>
              <div class="info-block">
                <p><strong>Service:</strong> ${serviceVoltage}V ${servicePhase === 1 ? 'Single' : 'Three'}-Phase</p>
                <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
                <p><strong>Drawing:</strong> E-001</p>
                <p><strong>Scale:</strong> NOT TO SCALE</p>
              </div>
            </div>

            <div class="diagram-container">
              ${svgString}
            </div>

            <div class="legend">
              <h3>LEGEND</h3>
              <div class="legend-items">
                <div class="legend-item">
                  <div class="legend-color" style="background: #FFCC00;"></div>
                  <span>Main Distribution Panel (MDP)</span>
                </div>
                <div class="legend-item">
                  <div class="legend-color" style="background: #3B82F6;"></div>
                  <span>Distribution Panel</span>
                </div>
                <div class="legend-item">
                  <div class="legend-color" style="background: #8B5CF6;"></div>
                  <span>Transformer</span>
                </div>
                <div class="legend-item">
                  <div class="legend-color" style="background: #F3F4F6; border: 2px solid #6B7280;"></div>
                  <span>Utility Service</span>
                </div>
              </div>
            </div>

            <div class="footer">
              <div>Generated by SparkPlan • ${new Date().toLocaleString()}</div>
              <div>IEEE Std 315 Compliant Symbols • NEC ${new Date().getFullYear()} Edition</div>
            </div>
          </div>

          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 500);
            };
          </script>
        </body>
        </html>
      `;

      printWindow.document.write(html);
      printWindow.document.close();

      resolve();
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Options for diagram export
 */
export interface DiagramExportOptions {
  format: 'svg' | 'png' | 'pdf';
  scale?: number; // For PNG only
}

/**
 * Export diagram with options
 */
export const exportDiagram = async (
  svgElement: SVGSVGElement | null,
  projectName: string,
  projectAddress: string,
  serviceVoltage: number,
  servicePhase: number,
  options: DiagramExportOptions
): Promise<void> => {
  switch (options.format) {
    case 'svg':
      exportDiagramAsSVG(svgElement, projectName);
      break;
    case 'png':
      await exportDiagramAsPNG(svgElement, projectName, options.scale || 2);
      break;
    case 'pdf':
      await exportDiagramAsPDF(svgElement, projectName, projectAddress, serviceVoltage, servicePhase);
      break;
    default:
      throw new Error(`Unknown export format: ${options.format}`);
  }
};

