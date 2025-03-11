document.addEventListener("DOMContentLoaded", function () {
  // Get DOM elements
  const selectTextBtn = document.getElementById("selectTextBtn");
  const screenshotBtn = document.getElementById("screenshotBtn");
  const extractPdfBtn = document.getElementById("extractPdfBtn");
  const extractImageBtn = document.getElementById("extractImageBtn");
  const extractAllBtn = document.getElementById("extractAllBtn");
  const copyBtn = document.getElementById("copyBtn");
  const downloadBtn = document.getElementById("downloadBtn");
  const clearBtn = document.getElementById("clearBtn");
  const resultText = document.getElementById("resultText");
  const status = document.getElementById("status");
  const progressBar = document.getElementById("progress-bar");

  // Thêm các phần tử mới cho chức năng xem trước ảnh chụp màn hình
  const screenshotPreview = document.getElementById("screenshot-preview");
  const previewImage = document.getElementById("preview-image");
  const extractScreenshotBtn = document.getElementById(
    "extract-screenshot-btn"
  );
  const cancelScreenshotBtn = document.getElementById("cancel-screenshot-btn");

  // API endpoint for image-to-text
  const API_ENDPOINT = "http://10.1.56.160:5001/api/image-to-text";

  // Thêm biến để lưu trữ ảnh chụp màn hình
  let capturedScreenshot = null;

  // Initialize PDF.js
  pdfjsLib.GlobalWorkerOptions.workerSrc = "pdf.worker.js";

  // Add event listeners
  selectTextBtn.addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        // Inject the selection mode script
        chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          function: injectSelectionMode,
        });

        // Close the popup to allow interaction with the page
        window.close();
      } else {
        showStatus("No active tab found");
      }
    });
  });

  // Add screenshot button event listener
  screenshotBtn.addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        // Check if the current page is a PDF
        const isPdf =
          tabs[0].url.toLowerCase().endsWith(".pdf") ||
          tabs[0].url.toLowerCase().includes("pdf");

        if (isPdf) {
          // If it's a PDF, inject the selection mode script with API call
          chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            function: injectSelectionModeForPdf,
            args: [API_ENDPOINT],
          });

          // Close the popup to allow interaction with the page
          window.close();
        } else {
          // If it's not a PDF, use the modified screenshot method
          captureScreenshotOnly();
        }
      } else {
        showStatus("No active tab found");
      }
    });
  });

  // Thêm event listener cho nút Extract Text trong preview
  extractScreenshotBtn.addEventListener("click", () => {
    // Ẩn preview
    screenshotPreview.style.display = "none";

    // Gọi API để trích xuất văn bản
    processScreenshotWithAPI(capturedScreenshot);
  });

  // Thêm event listener cho nút Cancel trong preview
  cancelScreenshotBtn.addEventListener("click", () => {
    // Ẩn preview
    screenshotPreview.style.display = "none";

    // Xóa ảnh chụp màn hình đã lưu
    capturedScreenshot = null;

    showStatus("Screenshot canceled");
  });

  extractPdfBtn.addEventListener("click", () => {
    // Check if the current page is a PDF file
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        const url = tabs[0].url;
        if (url.toLowerCase().endsWith(".pdf")) {
          // If it's a PDF file, extract directly
          extractPdfDirectly(url);
        } else {
          // Otherwise, send message to content script
          sendMessage({ action: "extractPdf" });
        }
      } else {
        showStatus("No active tab found");
      }
    });
  });

  extractImageBtn.addEventListener("click", () => {
    sendMessage({ action: "extractImage" });
  });

  extractAllBtn.addEventListener("click", () => {
    sendMessage({ action: "extractAll" });
  });

  copyBtn.addEventListener("click", () => {
    resultText.select();
    document.execCommand("copy");
    showStatus("Text copied to clipboard!");
  });

  downloadBtn.addEventListener("click", () => {
    if (!resultText.value) {
      showStatus("No text to download");
      return;
    }

    const blob = new Blob([resultText.value], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "extracted_text.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showStatus("Text downloaded!");
  });

  clearBtn.addEventListener("click", () => {
    resultText.value = "";
    showStatus("Cleared");
  });

  // Hàm mới: Chỉ chụp ảnh màn hình và hiển thị cho người dùng
  async function captureScreenshotOnly() {
    try {
      showStatus("Capturing screenshot...");
      updateProgress(10);

      // Capture screenshot of the current tab
      chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
        if (!tabs[0]) {
          showStatus("No active tab found");
          updateProgress(0);
          return;
        }

        // Capture the visible area of the tab
        chrome.tabs.captureVisibleTab(
          null,
          { format: "png" },
          async (dataUrl) => {
            if (chrome.runtime.lastError) {
              showStatus("Error occurred");
              updateProgress(0);
              return;
            }

            // Lưu ảnh chụp màn hình
            capturedScreenshot = dataUrl;

            // Hiển thị ảnh chụp màn hình và các tùy chọn
            showScreenshotPreview(dataUrl);

            updateProgress(100);
            showStatus("Screenshot captured. Click 'Extract Text' to process.");
          }
        );
      });
    } catch (error) {
      console.error("Error:", error);
      showStatus("Error occurred");
      updateProgress(0);
    }
  }

  // Hàm mới: Hiển thị ảnh chụp màn hình và các tùy chọn
  function showScreenshotPreview(dataUrl) {
    // Hiển thị container preview
    screenshotPreview.style.display = "block";

    // Cập nhật ảnh preview
    previewImage.src = dataUrl;
  }

  // Hàm mới: Xử lý ảnh chụp màn hình với API
  async function processScreenshotWithAPI(dataUrl) {
    try {
      showStatus("Processing...");
      updateProgress(30);

      // Convert data URL to Blob
      const blob = dataURLtoBlob(dataUrl);

      // Create FormData and append the image
      const formData = new FormData();
      formData.append("image", blob, "screenshot.png");

      // Send to API
      const response = await fetch(API_ENDPOINT, {
        method: "POST",
        body: formData,
      });

      updateProgress(70);

      if (!response.ok) {
        throw new Error(`Error occurred`);
      }

      // Parse the response
      const data = await response.json();
      updateProgress(90);

      // Check if the response has the extracted_text field
      if (data && data.extracted_text) {
        resultText.value = data.extracted_text;
        showStatus("Text extracted successfully");
        updateProgress(100);

        // Copy to clipboard automatically
        copyToClipboard(data.extracted_text);
      } else if (data && data.text) {
        // Fallback to 'text' field if available
        resultText.value = data.text;
        showStatus("Text extracted successfully");
        updateProgress(100);

        // Copy to clipboard automatically
        copyToClipboard(data.text);
      } else {
        showStatus("No text found");
        updateProgress(0);
      }
    } catch (error) {
      console.error("Error processing:", error);
      showStatus("Error occurred");
      updateProgress(0);
    }
  }

  // Function to capture screenshot and extract text using API (giữ lại cho tương thích ngược)
  async function captureScreenshotAndExtractText() {
    try {
      showStatus("Processing...");
      updateProgress(10);

      // Capture screenshot of the current tab
      chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
        if (!tabs[0]) {
          showStatus("No active tab found");
          updateProgress(0);
          return;
        }

        // Capture the visible area of the tab
        chrome.tabs.captureVisibleTab(
          null,
          { format: "png" },
          async (dataUrl) => {
            if (chrome.runtime.lastError) {
              showStatus("Error occurred");
              updateProgress(0);
              return;
            }

            // Gọi hàm xử lý ảnh chụp màn hình với API
            await processScreenshotWithAPI(dataUrl);
          }
        );
      });
    } catch (error) {
      console.error("Error:", error);
      showStatus("Error occurred");
      updateProgress(0);
    }
  }

  // Helper function to convert data URL to Blob
  function dataURLtoBlob(dataURL) {
    const parts = dataURL.split(";base64,");
    const contentType = parts[0].split(":")[1];
    const raw = window.atob(parts[1]);
    const rawLength = raw.length;
    const uInt8Array = new Uint8Array(rawLength);

    for (let i = 0; i < rawLength; ++i) {
      uInt8Array[i] = raw.charCodeAt(i);
    }

    return new Blob([uInt8Array], { type: contentType });
  }

  // Function to copy text to clipboard
  function copyToClipboard(text) {
    // Create a temporary textarea element
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "absolute";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);

    // Select and copy the text
    textarea.select();
    document.execCommand("copy");

    // Remove the temporary element
    document.body.removeChild(textarea);

    // Show a notification
    showStatus("Text copied to clipboard!");
  }

  // Function to extract text directly from a PDF URL
  async function extractPdfDirectly(url) {
    try {
      showStatus("Processing...");
      updateProgress(10);

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
      updateProgress(30);

      const loadingTask = pdfjsLib.getDocument({ data: pdfData });
      const pdf = await loadingTask.promise;

      updateProgress(40);

      let fullText = "";

      for (let i = 1; i <= pdf.numPages; i++) {
        updateProgress(40 + Math.floor((i / pdf.numPages) * 50));

        const page = await pdf.getPage(i);
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

      if (fullText.trim()) {
        resultText.value = fullText.trim();
        showStatus("Text extracted successfully");
        updateProgress(100);
      } else {
        showStatus("No text found");
        updateProgress(0);
      }
    } catch (error) {
      console.error("Error:", error);
      showStatus(`Error occurred`);
      updateProgress(0);
    }
  }

  // Listen for messages from content script or background script
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "updateStatus") {
      showStatus(message.status);
    } else if (message.action === "updateProgress") {
      updateProgress(message.progress);
    } else if (message.action === "updateResult") {
      resultText.value = message.text;
      showStatus("Text extracted successfully");
      updateProgress(100);
    } else if (message.action === "error") {
      showStatus("Error occurred");
      updateProgress(0);
    } else if (message.action === "selectedText") {
      resultText.value = message.text;
      showStatus("Text selection complete");
      updateProgress(100);
    } else if (message.action === "pdfSelectionComplete") {
      // Handle the result from PDF selection
      resultText.value = message.text;
      showStatus("Text extracted successfully");
      updateProgress(100);
    }
    return true;
  });

  // Helper functions
  function sendMessage(message) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, message);
      } else {
        showStatus("No active tab found");
      }
    });
  }

  function showStatus(message) {
    status.textContent = message;
    // Clear status after 3 seconds if it's a success message
    if (!message.includes("Error") && message !== "Ready") {
      setTimeout(() => {
        status.textContent = "Ready";
      }, 3000);
    }
  }

  function updateProgress(percent) {
    progressBar.style.width = percent + "%";
  }
});

// Function to inject the selection mode into the page
function injectSelectionMode() {
  // Check if selection mode is already active
  if (document.querySelector(".text-selection-overlay")) {
    return;
  }

  // Add selection overlay
  const overlay = document.createElement("div");
  overlay.className = "text-selection-overlay";
  document.body.appendChild(overlay);

  // Add selection box
  const selectionBox = document.createElement("div");
  selectionBox.className = "selection-box";
  document.body.appendChild(selectionBox);

  // Add styles
  const style = document.createElement("style");
  style.textContent = `
    .text-selection-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.3);
      z-index: 9999;
      cursor: crosshair;
    }
    .selection-box {
      position: absolute;
      border: 2px solid #34a853;
      background-color: rgba(52, 168, 83, 0.2);
      pointer-events: none;
      z-index: 10000;
    }
  `;
  document.head.appendChild(style);

  // Variables for selection
  let isSelecting = false;
  let startX, startY;

  // Mouse down event
  overlay.addEventListener("mousedown", (e) => {
    isSelecting = true;
    startX = e.clientX;
    startY = e.clientY;
    selectionBox.style.left = startX + "px";
    selectionBox.style.top = startY + "px";
    selectionBox.style.width = "0";
    selectionBox.style.height = "0";
    selectionBox.style.display = "block";
  });

  // Mouse move event
  overlay.addEventListener("mousemove", (e) => {
    if (!isSelecting) return;

    const currentX = e.clientX;
    const currentY = e.clientY;

    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);

    const left = Math.min(currentX, startX);
    const top = Math.min(currentY, startY);

    selectionBox.style.left = left + "px";
    selectionBox.style.top = top + "px";
    selectionBox.style.width = width + "px";
    selectionBox.style.height = height + "px";
  });

  // Mouse up event
  overlay.addEventListener("mouseup", (e) => {
    if (!isSelecting) return;
    isSelecting = false;

    // Get the selection box coordinates
    const rect = selectionBox.getBoundingClientRect();

    // Extract text from the selected area
    extractTextFromArea(rect.left, rect.top, rect.right, rect.bottom);

    // Clean up
    document.body.removeChild(overlay);
    document.body.removeChild(selectionBox);
  });

  // Function to extract text from the selected area
  function extractTextFromArea(left, top, right, bottom) {
    // Get all text elements in the selected area
    const textElements = [];

    // Get all text nodes
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );

    let node;
    while ((node = walker.nextNode())) {
      const element = node.parentElement;

      // Skip hidden elements
      if (!element || !isVisible(element)) continue;

      // Get element position
      const rect = element.getBoundingClientRect();

      // Check if the element is within the selection area
      if (
        rect.right >= left &&
        rect.left <= right &&
        rect.bottom >= top &&
        rect.top <= bottom
      ) {
        textElements.push(node);
      }
    }

    // Extract text from the elements
    let extractedText = "";
    textElements.forEach((node) => {
      extractedText += node.textContent.trim() + " ";
    });

    // Send the extracted text to the extension
    chrome.runtime.sendMessage({
      action: "selectedText",
      text: extractedText.trim(),
    });

    // Open the popup again to show the result
    chrome.runtime.sendMessage({
      action: "openPopup",
    });
  }

  // Helper function to check if an element is visible
  function isVisible(element) {
    const style = window.getComputedStyle(element);
    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      style.opacity !== "0" &&
      element.offsetWidth > 0 &&
      element.offsetHeight > 0
    );
  }
}

// Function to inject the selection mode for PDF with API call
function injectSelectionModeForPdf(apiEndpoint) {
  // Check if selection mode is already active
  if (document.querySelector(".text-selection-overlay")) {
    return;
  }

  // Add selection overlay
  const overlay = document.createElement("div");
  overlay.className = "text-selection-overlay";
  document.body.appendChild(overlay);

  // Add selection box
  const selectionBox = document.createElement("div");
  selectionBox.className = "selection-box";
  document.body.appendChild(selectionBox);

  // Add styles
  const style = document.createElement("style");
  style.textContent = `
    .text-selection-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.3);
      z-index: 9999;
      cursor: crosshair;
    }
    .selection-box {
      position: absolute;
      border: 2px solid #34a853;
      background-color: rgba(52, 168, 83, 0.2);
      pointer-events: none;
      z-index: 10000;
    }
    .selection-status {
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background-color: #333;
      color: white;
      padding: 10px 20px;
      border-radius: 5px;
      font-family: Arial, sans-serif;
      z-index: 10001;
    }
  `;
  document.head.appendChild(style);

  // Add status message - nhưng ẩn thông tin API
  const statusElement = document.createElement("div");
  statusElement.className = "selection-status";
  statusElement.textContent = "Select an area to extract text";
  document.body.appendChild(statusElement);

  // Variables for selection
  let isSelecting = false;
  let startX, startY;

  // Mouse down event
  overlay.addEventListener("mousedown", (e) => {
    isSelecting = true;
    startX = e.clientX;
    startY = e.clientY;
    selectionBox.style.left = startX + "px";
    selectionBox.style.top = startY + "px";
    selectionBox.style.width = "0";
    selectionBox.style.height = "0";
    selectionBox.style.display = "block";
  });

  // Mouse move event
  overlay.addEventListener("mousemove", (e) => {
    if (!isSelecting) return;

    const currentX = e.clientX;
    const currentY = e.clientY;

    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);

    const left = Math.min(currentX, startX);
    const top = Math.min(currentY, startY);

    selectionBox.style.left = left + "px";
    selectionBox.style.top = top + "px";
    selectionBox.style.width = width + "px";
    selectionBox.style.height = height + "px";
  });

  // Mouse up event
  overlay.addEventListener("mouseup", (e) => {
    if (!isSelecting) return;
    isSelecting = false;

    // Get the selection box coordinates
    const rect = selectionBox.getBoundingClientRect();

    // Update status
    statusElement.textContent = "Processing...";

    // Capture the selected area and send to API
    captureSelectedAreaAndSendToAPI(
      rect.left,
      rect.top,
      rect.width,
      rect.height,
      apiEndpoint
    );
  });

  // Function to capture the selected area and send to API
  async function captureSelectedAreaAndSendToAPI(
    left,
    top,
    width,
    height,
    apiEndpoint
  ) {
    try {
      // Create a canvas to capture the selected area
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");

      // Set canvas dimensions to match selection
      canvas.width = width;
      canvas.height = height;

      // Capture the entire visible tab first
      chrome.runtime.sendMessage(
        { action: "captureScreenshot" },
        async (response) => {
          if (!response || !response.success) {
            statusElement.textContent = "Error occurred";
            setTimeout(() => {
              cleanup();
            }, 2000);
            return;
          }

          // Load the screenshot into an image
          const img = new Image();
          img.onload = async () => {
            try {
              // Draw only the selected portion to the canvas
              context.drawImage(
                img,
                left,
                top,
                width,
                height, // Source coordinates and dimensions
                0,
                0,
                width,
                height // Destination coordinates and dimensions
              );

              // Convert canvas to blob
              canvas.toBlob(async (blob) => {
                try {
                  statusElement.textContent = "Processing...";

                  // Create FormData and append the image
                  const formData = new FormData();
                  formData.append("image", blob, "selection.png");

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

                  // Không hiển thị log API response

                  // Check if the response has the extracted_text field
                  if (data && data.extracted_text) {
                    // Store the extracted text to be sent to the popup
                    const extractedText = data.extracted_text;

                    // Send the extracted text to the extension
                    chrome.runtime.sendMessage({
                      action: "pdfSelectionComplete",
                      text: extractedText,
                    });

                    // Also copy to clipboard
                    navigator.clipboard
                      .writeText(extractedText)
                      .then(() => {
                        statusElement.textContent =
                          "Text extracted successfully";
                      })
                      .catch((err) => {
                        console.error("Could not copy text: ", err);
                        statusElement.textContent =
                          "Text extracted successfully";
                      });
                  } else if (data && data.text) {
                    // Fallback to 'text' field if available
                    const extractedText = data.text;

                    // Send the extracted text to the extension
                    chrome.runtime.sendMessage({
                      action: "pdfSelectionComplete",
                      text: extractedText,
                    });

                    // Also copy to clipboard
                    navigator.clipboard
                      .writeText(extractedText)
                      .then(() => {
                        statusElement.textContent =
                          "Text extracted successfully";
                      })
                      .catch((err) => {
                        console.error("Could not copy text: ", err);
                        statusElement.textContent =
                          "Text extracted successfully";
                      });
                  } else {
                    statusElement.textContent = "No text found";
                  }

                  // Clean up after a delay
                  setTimeout(() => {
                    cleanup();

                    // Open the popup again to show the result
                    chrome.runtime.sendMessage({
                      action: "openPopup",
                    });
                  }, 1500);
                } catch (error) {
                  console.error("Error processing:", error);
                  statusElement.textContent = "Error occurred";

                  setTimeout(() => {
                    cleanup();
                  }, 2000);
                }
              }, "image/png");
            } catch (error) {
              console.error("Error processing:", error);
              statusElement.textContent = "Error occurred";

              setTimeout(() => {
                cleanup();
              }, 2000);
            }
          };

          img.onerror = () => {
            statusElement.textContent = "Error occurred";
            setTimeout(() => {
              cleanup();
            }, 2000);
          };

          img.src = response.dataUrl;
        }
      );
    } catch (error) {
      console.error("Error:", error);
      statusElement.textContent = "Error occurred";

      setTimeout(() => {
        cleanup();
      }, 2000);
    }
  }

  // Function to clean up the overlay and selection elements
  function cleanup() {
    if (document.body.contains(overlay)) {
      document.body.removeChild(overlay);
    }
    if (document.body.contains(selectionBox)) {
      document.body.removeChild(selectionBox);
    }
    if (document.body.contains(statusElement)) {
      document.body.removeChild(statusElement);
    }
  }
}
