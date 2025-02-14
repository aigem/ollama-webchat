// 全局配置
let config = {
    baseUrl: localStorage.getItem('baseUrl') || 'http://127.0.0.1:11434',
    systemPrompt: localStorage.getItem('systemPrompt') || '你是我的性感女友，风骚又放荡，所有问题必须以女友的视角回答，绝对不能出戏'
};

// 全局状态
let state = {
    chatModel: '',
    replyIng: false,
    controller: null,
    chatHistory: []
};

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

function initializeApp() {
    const elements = {
        chatContainer: document.getElementById('chat-container'),
        messageForm: document.getElementById('message-form'),
        messageInput: document.getElementById('message-input'),
        submitButton: document.getElementById('submit'),
        modelSelect: document.getElementById('models'),
        cleanButton: document.getElementById('clean'),
        settingsToggle: document.getElementById('settings-toggle'),
        settingsPanel: document.getElementById('settings-panel'),
        baseUrlInput: document.getElementById('base-url'),
        systemPromptInput: document.getElementById('system-prompt'),
        saveSettingsBtn: document.getElementById('save-settings')
    };

    // 初始化设置面板
    initializeSettings(elements);
    
    // 加载模型列表
    loadModelTags();
    
    // 绑定事件监听器
    bindEventListeners(elements);
}

function initializeSettings(elements) {
    elements.baseUrlInput.value = config.baseUrl;
    elements.systemPromptInput.value = config.systemPrompt;
    
    elements.settingsToggle.addEventListener('click', () => {
        elements.settingsPanel.classList.toggle('open');
    });
    
    elements.saveSettingsBtn.addEventListener('click', () => {
        saveSettings(elements);
    });
}

function saveSettings(elements) {
    config.baseUrl = elements.baseUrlInput.value;
    config.systemPrompt = elements.systemPromptInput.value;
    
    localStorage.setItem('baseUrl', config.baseUrl);
    localStorage.setItem('systemPrompt', config.systemPrompt);
    
    elements.settingsPanel.classList.remove('open');
    showToast('设置已保存');
}

function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

function bindEventListeners(elements) {
    elements.messageInput.addEventListener('keypress', event => {
        if (event.keyCode === 13 && !event.shiftKey && elements.messageInput.value.trim().length > 0) {
            event.preventDefault();
            sendMessage(elements);
        }
    });

    elements.submitButton.addEventListener('click', () => {
        sendMessage(elements);
    });

    elements.modelSelect.addEventListener('change', event => {
        state.chatModel = event.target.value;
    });

    elements.cleanButton.addEventListener('click', () => {
        renderChatHistory(elements);
    });
}

async function loadModelTags() {
    try {
        const response = await fetch(`${config.baseUrl}/api/tags`);
        const data = await response.json();
        initModels(data.models);
    } catch (error) {
        console.error('Failed to load models:', error);
        showToast('加载模型列表失败');
    }
}

function initModels(models) {
    if (!models || models.length === 0) return;
    
    const modelSelect = document.getElementById('models');
    modelSelect.innerHTML = '';
    
    state.chatModel = models[0].model;
    models.forEach(model => {
        modelSelect.options.add(new Option(model.name, model.model));
    });
}

function renderChatHistory(elements, isNew, data) {
    if (!data) {
        state.chatHistory = [];
        elements.chatContainer.innerHTML = '';
        return;
    }

    if (isNew) {
        state.chatHistory.push(data);
        appendMessage(elements, data);
    } else {
        state.chatHistory[state.chatHistory.length - 1] = data;
        updateLastMessage(elements, data);
    }

    scrollToBottom(elements.chatContainer);
}

function appendMessage(elements, data) {
    const chatDiv = createMessageElement(data);
    elements.chatContainer.appendChild(chatDiv);
}

function updateLastMessage(elements, data) {
    const lastMessage = elements.chatContainer.lastElementChild;
    if (lastMessage) {
        const messageDiv = lastMessage.querySelector('.message');
        if (messageDiv) {
            let content = data.content;
            content = processThinkBlocks(content);
            content = marked.parse(content);
            messageDiv.innerHTML = content;
            
            // 如果消息还在加载中，添加加载动画
            if (state.replyIng) {
                messageDiv.classList.add('loading');
            } else {
                messageDiv.classList.remove('loading');
            }
        }
    }
}

function createMessageElement(data) {
    const chatDiv = document.createElement('div');
    chatDiv.className = `chat ${data.role}`;

    const roleDiv = document.createElement('div');
    roleDiv.className = 'role';
    roleDiv.textContent = data.role === 'user' ? '我' : data.model;

    const messageDiv = document.createElement('div');
    messageDiv.className = 'message';
    if (data.role === 'assistant' && state.replyIng) {
        messageDiv.classList.add('loading');
    }

    let content = data.content;
    content = processThinkBlocks(content);
    content = marked.parse(content);
    messageDiv.innerHTML = content;

    chatDiv.appendChild(roleDiv);
    chatDiv.appendChild(messageDiv);

    if (state.replyIng) {
        const indicator = document.createElement('div');
        indicator.className = 'sending-indicator';
        indicator.textContent = data.role === 'user' ? '发送中...' : '正在回复...';
        chatDiv.appendChild(indicator);
    }

    return chatDiv;
}

function scrollToBottom(container) {
    // 使用 requestAnimationFrame 确保在 DOM 更新后滚动
    requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight;
    });
}

function processThinkBlocks(content) {
    return content.replace(/<think>|<\/think>/gi, match => {
        if (match.toLowerCase() === '<think>') {
            return `<div class="think-container">
                <div class="think-toggle">
                    <span class="think-icon">🔽</span>
                    <span>思考过程</span>
                </div>
                <div class="think-content" style="display: block;">
                    <pre>`;
        } else {
            return `</pre>
                </div>
            </div>`;
        }
    });
}

function addThinkBlockListeners(chatDiv) {
    chatDiv.querySelectorAll('.think-toggle').forEach(toggle => {
        toggle.addEventListener('click', () => {
            const content = toggle.nextElementSibling;
            const icon = toggle.querySelector('.think-icon');
            if (content.style.display === 'none') {
                content.style.display = 'block';
                icon.textContent = '🔽';
            } else {
                content.style.display = 'none';
                icon.textContent = '💡';
            }
        });
    });
}

function sendMessage(elements) {
    if (state.replyIng) {
        state.controller.abort();
        elements.submitButton.textContent = "发送";
        elements.submitButton.classList.remove('sending');
        state.replyIng = false;
        return;
    }

    const message = elements.messageInput.value.trim();
    if (message.length === 0) return;

    state.controller = new AbortController();
    state.replyIng = true;
    elements.submitButton.textContent = "停止";
    elements.submitButton.classList.add('sending');
    
    renderChatHistory(elements, true, { role: "user", content: message });
    requestMessage(elements);
    elements.messageInput.value = '';
}

async function requestMessage(elements) {
    try {
        const messagesWithSystem = [
            { role: "system", content: config.systemPrompt },
            ...state.chatHistory.map(msg =>
                msg.role === 'assistant' ? {
                    ...msg,
                    content: msg.content.replace(/<think>[\s\S]*?<\/think>\s*/gi, '')
                } : msg
            )
        ];

        // 立即添加一个空的助手消息
        renderChatHistory(elements, true, { 
            role: "assistant", 
            model: state.chatModel,
            content: '<span class="typing">▋</span>'
        });

        const response = await fetch(`${config.baseUrl}/api/chat`, {
            signal: state.controller.signal,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: state.chatModel,
                messages: messagesWithSystem,
                max_output_tokens: 1000,
                temperature: 0.7,
                top_p: 0.7,
                repetition_penalty: 1.14,
            })
        });

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        const replyStrArray = [];

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const dataJson = JSON.parse(decoder.decode(value, { stream: true }));
            replyStrArray.push(dataJson.message.content);
            renderChatHistory(elements, false, { 
                role: "assistant", 
                model: dataJson.model, 
                content: replyStrArray.join("")
            });
        }
    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error('Failed to get response:', error);
            showToast('获取回复失败');
        }
    } finally {
        state.replyIng = false;
        state.controller = null;
        elements.submitButton.textContent = "发送";
        elements.submitButton.classList.remove('sending');
        
        // 移除最后一条消息的加载状态
        const lastMessage = elements.chatContainer.lastElementChild;
        if (lastMessage) {
            const messageDiv = lastMessage.querySelector('.message');
            if (messageDiv) {
                messageDiv.classList.remove('loading');
            }
            const indicator = lastMessage.querySelector('.sending-indicator');
            if (indicator) {
                indicator.remove();
            }
        }
    }
} 