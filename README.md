# Text Extractor Browser Extension

A browser extension that extracts text from PDF files and images on websites.

## Features

- Select and extract text from specific areas of a webpage
- Capture screenshots with preview before extracting text
- Extract text from screenshots using OCR API
- Select and extract text from specific areas of PDF files
- Extract text from PDF files embedded in web pages
- Extract text directly from PDF files opened in the browser
- Extract text from images using OCR (Optical Character Recognition)
- Automatically copy extracted text to clipboard
- Download extracted text as a file

## Installation

### Chrome/Edge/Brave

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" by toggling the switch in the top right corner
4. Click "Load unpacked" and select the extension directory
5. The extension should now be installed and visible in your toolbar

### Firefox

1. Download or clone this repository
2. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`
3. Click "Load Temporary Add-on..."
4. Select any file in the extension directory (e.g., manifest.json)
5. The extension should now be installed and visible in your toolbar

## Usage

1. Navigate to a webpage containing text, PDFs, or images with text
2. Click on the Text Extractor icon in your browser toolbar
3. Choose one of the extraction options:
   - "Select Text on Page" to select a specific area of the page and extract text
   - "Capture Screenshot" to capture the current screen and preview before extracting text
   - "Extract from PDF" to extract text from PDF files on the page
   - "Extract from Images" to extract text from images using OCR
   - "Extract All Text" to extract text from both PDFs and images
4. Wait for the extraction process to complete
5. The extracted text will be displayed in the popup and automatically copied to your clipboard
6. Use the buttons to download the text or clear the result

### Text Selection Mode

When you click "Select Text on Page":

1. The popup will close and a selection overlay will appear on the page
2. Click and drag to create a selection box around the text you want to extract
3. Release the mouse button to extract text from the selected area
4. The extension popup will reopen with the extracted text
5. The extracted text will be automatically copied to your clipboard

### Screenshot Capture with Preview

When you click "Capture Screenshot" on a regular webpage:

1. The extension will capture the current visible area of the browser
2. A preview of the screenshot will be displayed in the popup
3. You can choose to:
   - Click "Extract Text" to send the screenshot to the OCR API for text extraction
   - Click "Cancel" to discard the screenshot and return to the main interface
4. If you choose to extract text, the screenshot will be sent to the OCR API
5. The extracted text will be displayed in the popup and automatically copied to your clipboard

### PDF Selection Mode

When you click "Capture Screenshot" while viewing a PDF:

1. The popup will close and a selection overlay will appear on the PDF
2. Click and drag to create a selection box around the text you want to extract
3. Release the mouse button to capture that area of the PDF
4. The selected area will be sent to the OCR API for text extraction
5. The extension popup will reopen with the extracted text
6. The extracted text will be automatically copied to your clipboard

### API Integration

The extension integrates with a custom OCR API that returns text in the following JSON format:

```json
{
  "extracted_text": "The text extracted from the image..."
}
```

The extension is designed to handle this specific response format, extracting the text from the "extracted_text" field. If this field is not present, it will fall back to looking for a "text" field for backward compatibility.

When text is successfully extracted from the API, it will be:

1. Displayed in the result box in the popup
2. Automatically copied to your clipboard for immediate use

### PDF Extraction

The extension can extract text from PDFs in several ways:

1. From PDF files embedded in web pages (using object, embed, or iframe tags)
2. From PDF files opened directly in the browser (when viewing a PDF file)
3. From PDF links on web pages
4. From PDF viewers that use canvas elements (like PDF.js)
5. By selecting specific areas of a PDF for targeted extraction

If you're having trouble extracting text from a PDF:

- Try opening the PDF directly in a new tab and then use the extension
- Use the "Capture Screenshot" option to select a specific area of the PDF
- Make sure the PDF is not secured or encrypted
- For scanned PDFs, the extension will attempt to use OCR to extract text

## Dependencies

- [PDF.js](https://mozilla.github.io/pdf.js/) - For PDF text extraction
- [Tesseract.js](https://tesseract.projectnaptha.com/) - For OCR (Optical Character Recognition)
- Custom OCR API at http://10.1.56.160:5001/api/image-to-text - For screenshot text extraction

## Notes

- The OCR process may take some time depending on the number and size of images
- For best results with OCR, use clear images with good contrast
- Some PDFs may have security settings that prevent text extraction
- The text selection feature works best on standard web pages with visible text
- The screenshot feature requires access to the API server at http://10.1.56.160:5001
- When selecting text from PDFs, try to select areas with clear, readable text
- Extracted text is automatically copied to your clipboard for convenience
- The screenshot preview feature allows you to decide whether to process the image before sending it to the API

## License

MIT
