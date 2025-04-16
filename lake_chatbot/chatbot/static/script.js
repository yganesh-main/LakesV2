document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("chat-form");
  const chatBox = document.getElementById("chat-box");
  const promptIdInput = document.getElementById("prompt_id");
  const promptList = document.getElementById("prompt-list");
  const newPromptBtn = document.getElementById("new-prompt");
  const messageInput = document.getElementById("message");
  const imageInput = document.getElementById("image");
  const sendButton = document.querySelector(".send-btn");

  // Store conversation history for each prompt.
  const prompts = {};
  let currentPromptId = createNewPrompt();

  // Update visual "disabled" state and title for the send button.
  function updateSendButton() {
    const message = messageInput.value.trim();
    const files = imageInput.files;
    if (!message && files.length === 0) {
      sendButton.setAttribute("data-disabled", "true");
      sendButton.title = "Please enter a message or select an image";
      sendButton.classList.add("disabled");
    } else {
      sendButton.removeAttribute("data-disabled");
      sendButton.title = "";
      sendButton.classList.remove("disabled");
    }
  }

  messageInput.addEventListener("input", updateSendButton);
  imageInput.addEventListener("change", updateSendButton);
  updateSendButton();

  // Listen for clicks on the send button.
  sendButton.addEventListener("click", function (e) {
    const message = messageInput.value.trim();
    const files = imageInput.files;
    if (!message && files.length === 0) {
      e.preventDefault();
      showTemporaryError("Please enter a message or select an image", 5000);
      return;
    }
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    const message = messageInput.value.trim();
    const files = imageInput.files;

    if (!message && files.length === 0) {
      showTemporaryError("Please enter a message or select an image", 5000);
      return;
    }

    // Append the user's text message to the chat.
    if (message) {
      appendChat("user", `${escapeHTML(message)}`);
    }

    // Show the typing GIF.
    const typingIndicator = showTypingGif();

    // Create FormData from the form (no manual appending as file inputs are auto-included)
    const formData = new FormData(form);
    formData.set("prompt_id", currentPromptId);

    fetch("/handle_prompt/", {
      method: "POST",
      body: formData,
    })
      .then((res) => res.json())
      .then((data) => {
        // Remove the typing GIF when response arrives.
        removeTypingGif(typingIndicator);

        // Process S3 Image URLs first if they are available.
        if (
          data.image_urls &&
          Array.isArray(data.image_urls) &&
          data.image_urls.length > 0
        ) {
          data.image_urls.forEach((imgUrl) => {
            if (typeof imgUrl === "string" && imgUrl.trim() !== "") {
              let url = imgUrl.trim();
              // If the backend still sends an s3:// URL, convert it (optional)
              if (url.startsWith("s3://")) {
                console.log("Original S3 URL:", url);
                const parts = url.replace("s3://", "").split("/");
                const bucket = parts.shift();
                const key = parts.join("/");
                url = `https://${bucket}.s3.amazonaws.com/${key}`;
                console.log("Converted URL:", url);
              }
              // Display the S3 image as a user message.
              appendUserImage(
                `<img src="${url}" alt="User uploaded image" />`
              );
            }
          });
        } else if (data.image_url && data.image_url.trim() !== "") {
          let imgUrl = data.image_url.trim();
          if (imgUrl.startsWith("s3://")) {
            console.log("Original S3 URL:", imgUrl);
            const parts = imgUrl.replace("s3://", "").split("/");
            const bucket = parts.shift();
            const key = parts.join("/");
            imgUrl = `https://${bucket}.s3.amazonaws.com/${key}`;
            console.log("Converted URL:", imgUrl);
          }
          appendUserImage(
            `<img src="${imgUrl}" alt="User uploaded image" />`
          );
        }

        // Now process the bot response text.
        if (data.response) {
          appendChat("bot", data.response);
        }

        // Process coordinates (map button) if available.
        if (data.coordinates && data.coordinates.length > 0) {
          appendBotMapButton(data.coordinates);
        }
      })
      .catch((err) => {
        removeTypingGif(typingIndicator);
        appendChat(
          "bot",
          `<p style="color:red;">Error: ${escapeHTML(err.message)}</p>`
        );
      });

    form.reset();
    updateSendButton();
  });

  // ===== UTILITY FUNCTIONS =====

  // Create and return a "typing" indicator element.
  function showTypingGif() {
    const typingBubble = document.createElement("div");
    typingBubble.className = "chat-message typing";

//    const img = document.createElement("img");
//    img.src = "/static/typing.gif"; // Ensure this path is correct.
//    img.alt = "Typing...";
//    img.classList.add("typing-gif");
    // Create a span element that will display the typed text
  const typedElement = document.createElement("span");
  typedElement.id = "typed";

  // Apply inline CSS to the typed element (if needed)
  typedElement.style.fontSize = "1rem";
  typedElement.style.color = "var(--accent-color)"; // Ensure this variable is set in your CSS
  typedElement.style.fontWeight = "500";
  typedElement.style.backgroundColor ="#2c2d3a";
  typedElement.style.padding = "10px";
  typedElement.style.margin = "5px auto";
  typedElement.style.borderRadius = "8px";

  // Append the typed element to the typing indicator
  typingBubble.appendChild(typedElement);

  // Insert the typing indicator at the bottom of the chatBox
  chatBox.insertAdjacentElement("beforeend", typingBubble);
  chatBox.scrollTop = chatBox.scrollHeight;

  // Define the Typed.js options and initialize Typed
  const options = {
    strings: [
      'Analyzing...',
      'Thinking...',
      'Working on it...'
    ],
    typeSpeed: 50,
    backSpeed: 30,
    backDelay: 1500,
    loop: true,
    smartBackspace: true,
    cursorChar: '|'
  };
  // Initialize Typed on the element with id "typed"
  new Typed('#typed', options);

  return typingBubble;
}

  function removeTypingGif(typingElement) {
    if (typingElement && typingElement.parentNode) {
      typingElement.parentNode.removeChild(typingElement);
    }
  }

  function showTemporaryError(text, duration = 5000) {
    const errorBubble = document.createElement("div");
    errorBubble.className = "chat-message error";
    errorBubble.style.backgroundColor = "#ff4c4c";
    errorBubble.style.textAlign = "center";
    errorBubble.style.padding = "10px";
    errorBubble.style.margin = "10px auto";
    errorBubble.style.maxWidth = "60%";
    errorBubble.style.borderRadius = "8px";
    errorBubble.innerText = text;
    chatBox.appendChild(errorBubble);
    chatBox.scrollTop = chatBox.scrollHeight;
    setTimeout(() => {
      errorBubble.remove();
    }, duration);
  }

  newPromptBtn.addEventListener("click", () => {
    currentPromptId = createNewPrompt();
    chatBox.innerHTML = "";
  });

  function createNewPrompt() {
    const id = uuidv4();
    const li = document.createElement("li");
    li.textContent = `Prompt ${Object.keys(prompts).length + 1}`;
    li.onclick = () => {
      currentPromptId = id;
      chatBox.innerHTML = prompts[id] || "";
    };
    promptList.appendChild(li);
    prompts[id] = "";
    promptIdInput.value = id;
    return id;
  }

  // Append a new chat message. Escapes user text unless the content is an <img> tag.
  function appendChat(role, contentHTML) {
    const line = document.createElement("div");
    line.className = `chat-line ${role}`;

    const bubble = document.createElement("div");
    bubble.className = `chat-bubble ${role}`;

    if (role === "user") {
      if (contentHTML.trim().startsWith("<img")) {
        bubble.innerHTML = contentHTML;
      } else {
        bubble.innerHTML = escapeHTML(contentHTML);
      }
    } else {
      bubble.innerHTML = contentHTML.replace(/\n/g, "<br>");;
    }
    line.appendChild(bubble);
    chatBox.appendChild(line);
    chatBox.scrollTop = chatBox.scrollHeight;
    prompts[currentPromptId] = (prompts[currentPromptId] || "") + line.outerHTML;
  }

  // Append a user image in a fixed container (150×100) with a maximize/minimize button.
  function appendUserImage(contentHTML) {
const line = document.createElement("div");
  line.className = "chat-line user";
  const bubble = document.createElement("div");
  bubble.className = "chat-bubble user transparent";

  // Create the container with fixed dimensions.
  const container = document.createElement("div");
  container.className = "user-image-container";

  // Create an image wrapper and insert the image.
  const imageWrapper = document.createElement("div");
  imageWrapper.className = "user-image-wrapper";
  imageWrapper.innerHTML = contentHTML;
  container.appendChild(imageWrapper);

  // Instead of a button, add a click event on the container.
  container.addEventListener("click", () => {
    container.classList.toggle("expanded");
  });

  bubble.appendChild(container);
  line.appendChild(bubble);
  chatBox.appendChild(line);
  chatBox.scrollTop = chatBox.scrollHeight;
  prompts[currentPromptId] =
    (prompts[currentPromptId] || "") + line.outerHTML;
}

  function appendBotMapButton(coordinates) {
    const bubble = document.createElement("div");
    bubble.className = "chat-message bot";

    const header = document.createElement("p");
    header.className = "map-header";
    header.textContent = "Lake Map";
    bubble.appendChild(header);

    const mapBtn = document.createElement("button");
    mapBtn.className = "show-map-btn";
    mapBtn.innerText = "Show Map";
    bubble.appendChild(mapBtn);

    chatBox.appendChild(bubble);
    chatBox.scrollTop = chatBox.scrollHeight;
    prompts[currentPromptId] += bubble.outerHTML;

    let mapContainer = null;
    mapBtn.addEventListener("click", () => {
      if (mapContainer === null) {
        mapContainer = createMapWithCoordinates(coordinates);
        bubble.appendChild(mapContainer);
        mapBtn.innerText = "Hide Map";
        header.textContent = "Lake Map";
        chatBox.scrollTop = chatBox.scrollHeight;
      } else {
        mapContainer.parentNode.removeChild(mapContainer);
        mapContainer = null;
        mapBtn.innerText = "Show Map";
        header.textContent = "Lake Map";
      }
    });
  }

  function createMapWithCoordinates(coords) {
  const validCoords = coords.filter(
    (c) => c && typeof c.lat === "number" && typeof c.lon === "number"
  );
  if (validCoords.length === 0) {
    const placeholder = document.createElement("div");
    placeholder.textContent = "No valid coordinates to display.";
    return placeholder;
  }

  // Create the map container with inline styles.
  const container = document.createElement("div");
  container.className = "chat-map-container";
  container.style.width = "300px";
  container.style.height = "200px";
  container.style.border = "1px solid #ddd";
  container.style.borderRadius = "12px";
  container.style.overflow = "hidden";
  container.style.position = "relative";
  container.style.marginTop = "10px";
  container.style.transition = "all 0.3s ease";

  // Create the maximize/minimize button with inline styles.
  const maxBtn = document.createElement("button");
  maxBtn.className = "map-maximize-btn";
  maxBtn.style.position = "absolute";
  maxBtn.style.top = "5px";
  maxBtn.style.right = "5px";
  maxBtn.style.background = "none";
  maxBtn.style.border = "none";
  maxBtn.style.padding = "0";
  maxBtn.style.cursor = "pointer";
  maxBtn.style.zIndex = "1000";
  // Set a minimum clickable area.
  maxBtn.style.minWidth = "20px";
  maxBtn.style.minHeight = "20px";

  const btnImg = document.createElement("img");
  btnImg.src = "/static/max.png";
  btnImg.alt = "Maximize";
  btnImg.style.width = "24px";
  btnImg.style.height = "24px";
  btnImg.style.background = "white";

  maxBtn.appendChild(btnImg);
  container.appendChild(maxBtn);

  // Create the Leaflet map.
  const centerLat = averageLat(validCoords);
  const centerLon = averageLon(validCoords);
  const leafletMap = L.map(container).setView([centerLat, centerLon], 14);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
  }).addTo(leafletMap);
  const points = validCoords.map((c) => [c.lat, c.lon]);
  L.polyline(points, { color: "blue", weight: 2.5 }).addTo(leafletMap);
  validCoords.forEach((c, index) => {
    L.marker([c.lat, c.lon])
      .addTo(leafletMap)
      .bindPopup(`Point ${index + 1}`);
  });

  // Toggle expanded state on button click.
  maxBtn.addEventListener("click", function (e) {
    e.stopPropagation(); // Prevent click propagation to other map events.
    if (container.classList.contains("expanded")) {
      container.classList.remove("expanded");
      btnImg.src = "/static/max.png";
      btnImg.alt = "Maximize";
      // Restore collapsed dimensions.
      container.style.width = "300px";
      container.style.height = "200px";
    } else {
      container.classList.add("expanded");
      btnImg.src = "/static/min.png";
      btnImg.alt = "Minimize";
      // Expand the container dimensions; adjust these values as needed.
      container.style.width = "95%";
      container.style.height = "500px";
    }
    setTimeout(() => {
      if (leafletMap) leafletMap.invalidateSize();
    }, 300);
  });

  return container;
}

  function averageLat(coords) {
    const sum = coords.reduce((acc, c) => acc + c.lat, 0);
    return sum / coords.length;
  }

  function averageLon(coords) {
    const sum = coords.reduce((acc, c) => acc + c.lon, 0);
    return sum / coords.length;
  }

  function escapeHTML(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function uuidv4() {
    return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) =>
      (
        c ^
        crypto.getRandomValues(new Uint8Array(1))[0] &
        (15 >> (c / 4))
      ).toString(16)
    );
  }
});
