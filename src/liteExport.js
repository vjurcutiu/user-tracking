let liteEvents = [];

function getElementSelector(el) {
    if (!el || !el.tagName) return null;
    let selector = el.tagName.toLowerCase();
    if (el.id) selector += `#${el.id}`;
    if (el.classList.length) selector += `.${[...el.classList].join('.')}`;
    return selector;
}

function logEvent(type, data) {
    liteEvents.push({ type, timestamp: Date.now(), ...data });
}

// Click tracking
document.addEventListener("click", (event) => {
    const data = {
        selector: getElementSelector(event.target),
        text: event.target.innerText.slice(0, 50) || null,
        position: { x: event.clientX, y: event.clientY }
    };
    console.log('Click event data:', data);
    logEvent("click", data);
});

// Scroll tracking
document.addEventListener("scroll", () => {
    logEvent("scroll", {
        scrollX: window.scrollX,
        scrollY: window.scrollY
    });
});

// Input tracking
document.addEventListener("input", (event) => {
    const target = event.target;
    if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) {
        logEvent("input", {
            selector: getElementSelector(target),
            value: target.type === "password" ? "****" : target.value.slice(0, 100)
        });
    }
});

// Keypress tracking
document.addEventListener("keydown", (event) => {
    logEvent("keypress", {
        key: event.key,
        keyCode: event.keyCode,
        ctrl: event.ctrlKey,
        shift: event.shiftKey,
        alt: event.altKey
    });
});

// Handle messages from background.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "exportLite") {
        try {
            console.log("Received exportLite message", message);
            console.log("Exporting lite events:", liteEvents);
            sendResponse({ liteEvents });
        } catch (err) {
            console.error('Error sending liteEvents:', err);
            sendResponse({ error: err.message });
        }
    } else if (message.action === "clearLiteEvents") {
        liteEvents = [];
    }
});

console.log("LiteExport module loaded.");
