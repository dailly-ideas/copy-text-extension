// Initialize Tesseract.js for OCR
let tesseractWorker = null;

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "extractPdf") {
    extractTextFromPdfs();
  } else if (message.action === "extractImage") {
    extractTextFromImages();
  } else if (message.action === "extractAll") {
    extractAllText();
  } else if (message.action === "startTextSelection") {
    startTextSelection();
  } else if (message.action === "sendToApi") {
    sendImageToApi(message.imageData, message.apiEndpoint);
  }
  return true;
});

// Function to send image data to API
async function sendImageToApi(imageData, apiEndpoint) {
  try {
    updateStatus("Processing...");

    // Convert base64 to blob
    const byteString = atob(imageData.split(",")[1]);
    const mimeString = imageData.split(",")[0].split(":")[1].split(";")[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);

    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }

    const blob = new Blob([ab], { type: mimeString });

    // Create FormData and append the image
    const formData = new FormData();
    formData.append("image", blob, "image.png");

    // Send to API
    const response = await fetch(apiEndpoint, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Error occurred`);
    }

    // Parse the response
    const data = await response.json();

    // Check if the response has the extracted_text field
    if (data && data.extracted_text) {
      // Update the result in the popup
      updateResult(data.extracted_text);

      // Try to copy to clipboard
      try {
        await navigator.clipboard.writeText(data.extracted_text);
        updateStatus("Text extracted successfully");
      } catch (err) {
        console.error("Could not copy text: ", err);
        updateStatus("Text extracted successfully");
      }
    } else if (data && data.text) {
      // Fallback to 'text' field if available
      updateResult(data.text);

      // Try to copy to clipboard
      try {
        await navigator.clipboard.writeText(data.text);
        updateStatus("Text extracted successfully");
      } catch (err) {
        console.error("Could not copy text: ", err);
        updateStatus("Text extracted successfully");
      }
    } else {
      updateStatus("No text found");
    }
  } catch (error) {
    console.error("Error:", error);
    chrome.runtime.sendMessage({
      action: "error",
      error: "Error occurred",
    });
  }
}

// Function to start text selection mode
function startTextSelection() {
  // This is handled by the injected script from popup.js
  // But we can add additional functionality here if needed
  console.log("Text selection mode started");
}

// Function to extract text from PDFs on the page
async function extractTextFromPdfs() {
  updateStatus("Looking for PDF elements...");

  // Find PDF objects, embeds, and links
  const pdfElements = [
    ...document.querySelectorAll('object[type="application/pdf"]'),
    ...document.querySelectorAll('embed[type="application/pdf"]'),
    ...document.querySelectorAll('iframe[src$=".pdf"]'),
    ...document.querySelectorAll('a[href$=".pdf"]'),
  ];

  // Also check for PDF viewers that might be using canvas or other elements
  const possiblePdfViewers = [
    ...document.querySelectorAll(".pdf-viewer"),
    ...document.querySelectorAll('[id*="pdf"]'),
    ...document.querySelectorAll('[class*="pdf"]'),
    ...document.querySelectorAll("canvas"),
  ];

  if (pdfElements.length === 0 && possiblePdfViewers.length === 0) {
    // If no PDF elements found, try to detect if the current page itself is a PDF
    if (window.location.href.toLowerCase().endsWith(".pdf")) {
      updateStatus("Current page is a PDF. Extracting text...");
      const text = await extractTextFromPdfUrl(window.location.href);
      if (text.trim()) {
        updateResult(text.trim());
      } else {
        updateStatus("Could not extract text from PDF");
      }
      return;
    }

    updateStatus("No PDF elements found on this page");
    return;
  }

  let allText = "";
  let processedCount = 0;
  let totalElements = pdfElements.length;

  // Process standard PDF elements
  for (const element of pdfElements) {
    try {
      let pdfUrl;

      if (element.tagName === "A") {
        pdfUrl = element.href;
      } else if (element.tagName === "IFRAME") {
        pdfUrl = element.src;
      } else {
        pdfUrl = element.data || element.src;
      }

      if (!pdfUrl) continue;

      updateStatus(`Processing PDF: ${pdfUrl.split("/").pop()}`);
      updateProgress(Math.floor((processedCount / totalElements) * 100));

      const text = await extractTextFromPdfUrl(pdfUrl);
      if (text.trim()) {
        allText += text + "\n\n";
      }

      processedCount++;
    } catch (error) {
      console.error("Error processing PDF:", error);
    }
  }

  // Try to extract from possible PDF viewers if no text was found
  if (!allText.trim() && possiblePdfViewers.length > 0) {
    updateStatus("Trying to extract from PDF viewers...");

    // Try to find PDF.js viewer
    const pdfJsViewers = Array.from(possiblePdfViewers).filter((el) => {
      return el.querySelector("canvas") || el.tagName === "CANVAS";
    });

    if (pdfJsViewers.length > 0) {
      updateStatus("PDF.js viewer detected. Attempting to extract text...");

      // Try to find the PDF URL from the page
      let pdfUrl = "";

      // Look for PDF URL in various places
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.has("file")) {
        pdfUrl = urlParams.get("file");
      } else {
        // Try to find it in the page source
        const scripts = document.querySelectorAll("script");
        for (const script of scripts) {
          const content = script.textContent;
          if (content && content.includes(".pdf")) {
            const match = content.match(/['"]([^'"]*\.pdf)['"]/);
            if (match && match[1]) {
              pdfUrl = match[1];
              break;
            }
          }
        }
      }

      if (pdfUrl) {
        updateStatus(`Found PDF URL: ${pdfUrl}`);
        const text = await extractTextFromPdfUrl(pdfUrl);
        if (text.trim()) {
          allText += text + "\n\n";
        }
      } else {
        // If we can't find the URL, try to extract text from the canvas directly
        updateStatus("Attempting to extract text from canvas elements...");
        const canvasElements = document.querySelectorAll("canvas");

        if (canvasElements.length > 0) {
          // Use OCR on canvas elements as a fallback
          if (!tesseractWorker) {
            updateStatus("Initializing OCR engine...");
            tesseractWorker = await Tesseract.createWorker();
            await tesseractWorker.loadLanguage("eng");
            await tesseractWorker.initialize("eng");
          }

          for (const canvas of canvasElements) {
            if (canvas.width > 100 && canvas.height > 100) {
              try {
                updateStatus("Extracting text from canvas using OCR...");
                const {
                  data: { text },
                } = await tesseractWorker.recognize(canvas);

                if (text.trim()) {
                  allText += text.trim() + "\n\n";
                }
              } catch (error) {
                console.error("Error extracting text from canvas:", error);
              }
            }
          }
        }
      }
    }
  }

  if (allText.trim()) {
    updateResult(allText.trim());
  } else {
    updateStatus("Could not extract text from PDFs");
  }
}

// Function to extract text from a PDF URL
async function extractTextFromPdfUrl(url) {
  try {
    updateStatus("Processing...");

    // Handle relative URLs
    if (
      !url.startsWith("http") &&
      !url.startsWith("blob:") &&
      !url.startsWith("data:")
    ) {
      const base = window.location.origin;
      url = new URL(url, base).href;
    }

    const response = await fetch(url, {
      method: "GET",
      mode: "cors",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/pdf",
      },
    });

    if (!response.ok) {
      throw new Error(`Error occurred`);
    }

    const pdfData = await response.arrayBuffer();

    const loadingTask = pdfjsLib.getDocument({ data: pdfData });
    const pdf = await loadingTask.promise;

    updateStatus("Processing...");

    let fullText = "";

    for (let i = 1; i <= pdf.numPages; i++) {
      updateProgress(Math.floor((i / pdf.numPages) * 100));
      const page = await pdf.getPage(i);

      // Get text content
      const textContent = await page.getTextContent();

      // Process text content with better formatting
      let lastY = -1;
      let text = "";

      for (const item of textContent.items) {
        if (lastY !== item.transform[5] && lastY !== -1) {
          text += "\n"; // New line when y-position changes
        }
        text += item.str + " ";
        lastY = item.transform[5];
      }

      fullText += text + "\n\n";
    }

    // Try to copy to clipboard
    try {
      await navigator.clipboard.writeText(fullText.trim());
      updateStatus("Text extracted successfully");
    } catch (err) {
      console.error("Could not copy text: ", err);
      // Continue without clipboard copy
    }

    return fullText;
  } catch (error) {
    console.error("Error:", error);
    updateStatus(`Error occurred`);
    return "";
  }
}

// Function to extract text from images on the page
async function extractTextFromImages() {
  updateStatus("Looking for images...");

  const images = document.querySelectorAll("img");

  if (images.length === 0) {
    updateStatus("No images found on this page");
    return;
  }

  // Filter out tiny images and icons
  const validImages = Array.from(images).filter((img) => {
    return (
      img.naturalWidth > 100 && img.naturalHeight > 100 && isImageVisible(img)
    );
  });

  if (validImages.length === 0) {
    updateStatus("No suitable images found for text extraction");
    return;
  }

  updateStatus(`Found ${validImages.length} images. Processing...`);

  // Initialize Tesseract worker if not already initialized
  if (!tesseractWorker) {
    updateStatus("Initializing OCR engine...");
    tesseractWorker = await Tesseract.createWorker();
    await tesseractWorker.loadLanguage("eng");
    await tesseractWorker.initialize("eng");
  }

  let allText = "";
  let processedCount = 0;

  for (const img of validImages) {
    try {
      updateStatus(
        `Processing image ${processedCount + 1} of ${validImages.length}`
      );
      updateProgress(Math.floor((processedCount / validImages.length) * 100));

      const {
        data: { text },
      } = await tesseractWorker.recognize(img);

      if (text.trim()) {
        allText += text.trim() + "\n\n";
      }

      processedCount++;
    } catch (error) {
      console.error("Error processing image:", error);
    }
  }

  if (allText.trim()) {
    updateResult(allText.trim());
  } else {
    updateStatus("Could not extract text from images");
  }
}

// Function to extract all text (PDFs and images)
async function extractAllText() {
  updateStatus("Extracting all text...");

  // First extract text from PDFs
  await extractTextFromPdfs();

  // Then extract text from images
  await extractTextFromImages();

  updateStatus("All text extraction complete");
}

// Helper function to check if an image is visible
function isImageVisible(img) {
  const style = window.getComputedStyle(img);
  return (
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    img.offsetWidth > 0 &&
    img.offsetHeight > 0
  );
}

// Helper functions to communicate with popup
function updateStatus(status) {
  chrome.runtime.sendMessage({ action: "updateStatus", status });
}

function updateProgress(progress) {
  chrome.runtime.sendMessage({ action: "updateProgress", progress });
}

function updateResult(text) {
  chrome.runtime.sendMessage({ action: "updateResult", text });
}
