document.addEventListener("DOMContentLoaded", function () {
  const chatForm = document.getElementById("chat-form");
  const messageInput = document.getElementById("message");
  const chatMessages = document.getElementById("chat-messages");
  const newPromptButton = document.getElementById("new-prompt");
  const promptList = document.getElementById("prompt-list");

  // Retrieve current prompt ID from localStorage
  let currentPromptId = localStorage.getItem("currentPromptId");

  // If none exists, create one
  if (!currentPromptId) {
    let promptIds = JSON.parse(localStorage.getItem("promptIds")) || [];
    let nextIndex = promptIds.length + 1;
    currentPromptId = `Prompt${nextIndex.toString().padStart(2, '0')}`;
    promptIds.push(currentPromptId);
    localStorage.setItem("promptIds", JSON.stringify(promptIds));
    localStorage.setItem("currentPromptId", currentPromptId);
  }

  // Load chat history
  const loadChatHistory = () => {
    if (!currentPromptId) return;
    const history = JSON.parse(localStorage.getItem(`chatHistory_${currentPromptId}`)) || [];
    chatMessages.innerHTML = '';
    let botResponseCount = 1;
    history.forEach(message => {
      if (message.sender === "bot") {
        appendMessage("bot", message.text, botResponseCount++);
      } else {
        appendMessage("user", message.text);
      }
    });
  };

  // Store chat history
  const storeChatHistory = (sender, text) => {
    if (!currentPromptId) return;
    const history = JSON.parse(localStorage.getItem(`chatHistory_${currentPromptId}`)) || [];
    history.push({ sender, text });
    localStorage.setItem(`chatHistory_${currentPromptId}`, JSON.stringify(history));
  };

  // Append messages to chat display
  function appendMessage(sender, text, responseNumber = null) {
    const bubble = document.createElement("div");
    bubble.className = `chat-bubble ${sender}`;

    if (sender === "bot" && responseNumber) {
      bubble.innerHTML = `<strong>${responseNumber}. </strong>${text}`;
    } else {
      bubble.textContent = text;
    }

    chatMessages.appendChild(bubble);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  // Load prompt list
  const loadPromptList = () => {
    const promptIds = JSON.parse(localStorage.getItem("promptIds")) || [];
    promptList.innerHTML = '';

    promptIds.forEach(promptId => {
      const listItem = document.createElement("li");
      listItem.textContent = promptId;
      listItem.classList.add("prompt-item");

      if (promptId === currentPromptId) {
        listItem.classList.add("active");
      }

      // Click to switch prompt
      listItem.addEventListener("click", () => {
        currentPromptId = promptId;
        localStorage.setItem("currentPromptId", currentPromptId);
        loadChatHistory();
        loadPromptList();
      });

      // Delete button
      const deleteButton = document.createElement("button");
      deleteButton.textContent = "✖";
      deleteButton.classList.add("delete-button");
      deleteButton.addEventListener("click", (e) => {
        e.stopPropagation();
        deletePrompt(promptId);
      });

      listItem.appendChild(deleteButton);
      promptList.appendChild(listItem);
    });
  };

  // Delete a prompt
  const deletePrompt = (promptId) => {
    let promptIds = JSON.parse(localStorage.getItem("promptIds")) || [];
    promptIds = promptIds.filter(id => id !== promptId);
    localStorage.setItem("promptIds", JSON.stringify(promptIds));
    localStorage.removeItem(`chatHistory_${promptId}`);

    if (promptId === currentPromptId) {
      currentPromptId = promptIds.length > 0 ? promptIds[0] : null;
      localStorage.setItem("currentPromptId", currentPromptId);
    }

    loadPromptList();
    loadChatHistory();
  };

  // On submit message
  chatForm.addEventListener("submit", function (e) {
    e.preventDefault();
    const message = messageInput.value.trim();
    if (!message) return;

    appendMessage("user", message);
    storeChatHistory("user", message);
    messageInput.value = "";

    fetch("/handle_prompt/", {
      method: "POST",
      headers: { "X-CSRFToken": document.querySelector('input[name="csrfmiddlewaretoken"]').value },
      body: new FormData(chatForm)
    })
      .then(res => res.json())
      .then(data => {
        if (data.response) {
          const history = JSON.parse(localStorage.getItem(`chatHistory_${currentPromptId}`)) || [];
          const responseNumber = history.filter(m => m.sender === "bot").length + 1;
          appendMessage("bot", data.response, responseNumber);
          storeChatHistory("bot", data.response);
        }
      });
  });

  // Add new prompt
  newPromptButton.addEventListener("click", function () {
    let promptIds = JSON.parse(localStorage.getItem("promptIds")) || [];
    let nextIndex = promptIds.length + 1;
    const newPromptId = `Prompt${nextIndex.toString().padStart(2, '0')}`;

    promptIds.push(newPromptId);
    localStorage.setItem("promptIds", JSON.stringify(promptIds));
    currentPromptId = newPromptId;
    localStorage.setItem("currentPromptId", currentPromptId);

    chatMessages.innerHTML = '';
    loadChatHistory();
    loadPromptList();
    messageInput.focus();
  });

  // Load on startup
  loadPromptList();
  loadChatHistory();
});
