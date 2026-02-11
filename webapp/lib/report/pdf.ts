// Re-export from the React-PDF implementation
// This file exists because TypeScript doesn't allow importing .tsx directly in some configs
export {
  renderPdfReport,
  verdictForScore,
  safeFilename,
  type PdfReportData,
  type PdfVitals,
  type PdfRisk,
  type PdfBot,
} from "./pdf-react";
