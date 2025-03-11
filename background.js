// Background script for Text Extractor extension

// Listen for installation
chrome.runtime.onInstalled.addListener(() => {
  // Không hiển thị log khi cài đặt
});

// Store selected text temporarily
let selectedText = "";

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Forward messages between popup and content script if needed
  if (message.action === "forwardToContent" && sender.tab) {
    chrome.tabs.sendMessage(sender.tab.id, message.data);
  } else if (message.action === "forwardToPopup") {
    chrome.runtime.sendMessage(message.data);
  } else if (message.action === "selectedText") {
    // Store the selected text
    selectedText = message.text;

    // Try to copy to clipboard
    copyToClipboard(message.text);
  } else if (message.action === "pdfSelectionComplete") {
    // Store the selected text from PDF
    selectedText = message.text;

    // Try to copy to clipboard
    copyToClipboard(message.text);
  } else if (message.action === "openPopup") {
    // Open the popup programmatically
    chrome.action.openPopup();

    // Wait a moment for the popup to open, then send the selected text
    setTimeout(() => {
      chrome.runtime.sendMessage({
        action: "selectedText",
        text: selectedText,
      });
    }, 300);
  } else if (message.action === "captureScreenshot") {
    // Handle screenshot capture request
    captureScreenshot(sendResponse);
    return true; // Keep the message channel open for the async response
  } else if (message.action === "copyToClipboard") {
    // Handle clipboard copy request
    copyToClipboard(message.text);
  }

  return true;
});

// Function to copy text to clipboard
function copyToClipboard(text) {
  // Create a temporary element
  const input = document.createElement("textarea");
  input.value = text;
  document.body.appendChild(input);
  input.select();

  // Execute copy command
  document.execCommand("copy");

  // Clean up
  document.body.removeChild(input);

  // Không hiển thị log khi copy
}

// Function to capture a screenshot
function captureScreenshot(sendResponse) {
  chrome.tabs.captureVisibleTab(null, { format: "png" }, (dataUrl) => {
    if (chrome.runtime.lastError) {
      sendResponse({
        success: false,
        error: chrome.runtime.lastError.message,
      });
    } else {
      sendResponse({
        success: true,
        dataUrl: dataUrl,
      });
    }
  });
}

// Handle browser action click (for browsers that don't support action API)
chrome.action.onClicked.addListener((tab) => {
  // This will only run if the browser doesn't support the popup
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    function: () => {
      alert(
        "Please use the popup interface by clicking on the extension icon."
      );
    },
  });
});
