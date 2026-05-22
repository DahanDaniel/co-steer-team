const chatWidget = document.getElementById('chat-widget');
        const chatToggleBtn = document.getElementById('chat-toggle-btn');
        const chatCloseBtn = document.getElementById('chat-close-btn');

        chatToggleBtn.addEventListener('click', () => {
            chatWidget.classList.remove('collapsed');
            chatToggleBtn.classList.add('hidden');
            const chatBody = document.querySelector('.chat-body');
            if (chatBody) chatBody.scrollTop = chatBody.scrollHeight;
        });

        chatCloseBtn.addEventListener('click', () => {
            chatWidget.classList.add('collapsed');
            chatToggleBtn.classList.remove('hidden');
        });
        
        // Hover effect for close button
        chatCloseBtn.addEventListener('mouseenter', () => chatCloseBtn.style.color = '#fff');
        chatCloseBtn.addEventListener('mouseleave', () => chatCloseBtn.style.color = 'var(--text-muted)');

        const expandChatToFullscreen = () => {
            const chatsView = document.getElementById('chats');
            const chatExpandBtn = document.getElementById('chat-expand-btn');
            const chatMinimizeBtn = document.getElementById('chat-minimize-btn');

            document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
            chatsView.classList.add('active');
            
            chatWidget.classList.remove('collapsed');
            chatToggleBtn.classList.add('hidden');
            chatWidget.classList.add('chat-fullscreen');
            chatsView.style.position = 'relative';
            chatsView.appendChild(chatWidget);

            chatExpandBtn.style.display = 'none';
            chatMinimizeBtn.style.display = 'block';
            
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            const chatsNav = document.querySelector('[data-view="chats"]');
            if(chatsNav) chatsNav.classList.add('active');

            const chatBody = document.querySelector('.chat-body');
            if (chatBody) chatBody.scrollTop = chatBody.scrollHeight;
        };

        const minimizeChatFromFullscreen = () => {
            const chatWidget = document.getElementById('chat-widget');
            const chatToggleBtn = document.getElementById('chat-toggle-btn');
            const dashboardView = document.getElementById('dashboard');

            // 1. Move chat back to body and remove fullscreen class
            chatWidget.classList.remove('chat-fullscreen');
            document.body.appendChild(chatWidget);
            
            // 2. Fix buttons
            const chatMinimizeBtn = document.getElementById('chat-minimize-btn');
            const chatExpandBtn = document.getElementById('chat-expand-btn');
            if (chatMinimizeBtn) chatMinimizeBtn.style.display = 'none';
            if (chatExpandBtn) chatExpandBtn.style.display = 'block';

            // 3. Switch views back to dashboard
            document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
            if(dashboardView) dashboardView.classList.add('active');

            // 4. Update Nav Items
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            const dashboardTab = document.querySelector('.nav-item[data-view="dashboard"]');
            if(dashboardTab) dashboardTab.classList.add('active');

            // 5. Keep small chat open!
            chatWidget.classList.remove('collapsed');
            if(chatToggleBtn) chatToggleBtn.classList.add('hidden');
        };

        // View Navigation Logic
        const navItems = document.querySelectorAll('.nav-item[data-view]');
        const views = document.querySelectorAll('.view');
        
        navItems.forEach(item => {
            item.addEventListener('click', () => {
                if (item.classList.contains('locked')) return;
                
                const targetView = item.getAttribute('data-view');
                
                if (targetView === 'chats') {
                    if (!chatWidget.classList.contains('chat-fullscreen')) {
                        expandChatToFullscreen();
                    }
                    return;
                }

                navItems.forEach(n => n.classList.remove('active'));
                item.classList.add('active');

                views.forEach(v => {
                    if(v.id === targetView) {
                        v.classList.add('active');
                    } else {
                        v.classList.remove('active');
                    }
                });

                if (targetView === 'objectives') fetchTeamBriefs();
                
                if (chatWidget.classList.contains('chat-fullscreen')) {
                    chatWidget.classList.remove('chat-fullscreen');
                    document.body.appendChild(chatWidget);
                    const chatMinimizeBtn = document.getElementById('chat-minimize-btn');
                    const chatExpandBtn = document.getElementById('chat-expand-btn');
                    if (chatMinimizeBtn) chatMinimizeBtn.style.display = 'none';
                    if (chatExpandBtn) chatExpandBtn.style.display = 'block';
                }
                
                // Fully collapse chat to just the bottom right button
                chatWidget.classList.add('collapsed');
                chatToggleBtn.classList.remove('hidden');
            });
        });

        // MVP API Integration
        const chatInput = document.querySelector('.chat-input');
        const chatSendBtn = document.getElementById('chat-send-btn');
        const chatBody = document.querySelector('.chat-body');
        let chatHistory = [];

        const appendMessage = (text, isAi = true) => {
            const msgContainer = document.createElement('div');
            msgContainer.className = 'participant-msg';
            if (!isAi) {
                msgContainer.style.alignSelf = 'flex-end';
                msgContainer.style.flexDirection = 'row-reverse';
                msgContainer.innerHTML = `
                    <div class="participant-avatar avatar-you">Y</div>
                    <div style="display: flex; flex-direction: column; align-items: flex-end;">
                        <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.25rem;">You</div>
                        <div class="msg-bubble own">${text}</div>
                    </div>
                `;
            } else {
                const parsedText = marked.parse(text);
                msgContainer.innerHTML = `
                    <div class="participant-avatar" style="background: #64748b;">
                        <svg viewBox="0 0 24 24" style="width: 18px; height: 18px;"><path d="M12 2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2 2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"></path><path d="M12 10a4 4 0 0 1 4 4v6a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-6a4 4 0 0 1 4-4z"></path></svg>
                    </div>
                    <div>
                        <div style="font-size: 0.8rem; color: var(--primary); margin-bottom: 0.25rem; font-weight: 600;">Co-Steer Copilot</div>
                        <div class="msg-bubble">${parsedText}</div>
                    </div>
                `;
            }
            chatBody.appendChild(msgContainer);
            chatBody.scrollTop = chatBody.scrollHeight;
        };

        const sendMessage = async () => {
            const message = chatInput.value.trim();
            if(!message) return;
            
            appendMessage(message, false);
            chatInput.value = '';

            // Remove existing action buttons if they exist
            const existingBtns = chatBody.querySelectorAll('.action-btn-group');
            existingBtns.forEach(btn => btn.remove());

            const loadingId = 'loading-' + Date.now();
            const loadingDiv = document.createElement('div');
            loadingDiv.className = 'participant-msg';
            loadingDiv.id = loadingId;
            loadingDiv.innerHTML = `
                <div class="participant-avatar" style="background: #64748b;">
                    <svg viewBox="0 0 24 24" style="width: 18px; height: 18px;"><path d="M12 2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2 2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"></path><path d="M12 10a4 4 0 0 1 4 4v6a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-6a4 4 0 0 1 4-4z"></path></svg>
                </div>
                <div>
                    <div style="font-size: 0.8rem; color: var(--primary); margin-bottom: 0.25rem; font-weight: 600;">Co-Steer Copilot</div>
                    <div class="msg-bubble" style="opacity: 0.7; font-style: italic;">Processing...</div>
                </div>
            `;
            chatBody.appendChild(loadingDiv);
            chatBody.scrollTop = chatBody.scrollHeight;

            try {
                const res = await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message, history: chatHistory })
                });
                const data = await res.json();
                
                document.getElementById(loadingId)?.remove();

                if (data.error) {
                    appendMessage("API Error: " + data.error, true);
                    return;
                }
                
                chatHistory.push({ role: 'user', content: message });
                chatHistory.push({ role: 'assistant', content: data.reply });
                
                appendMessage(data.reply, true);
                
                if (data.requiresContext) {
                    renderContextUploadButton();
                } else if (data.readyForApproval) {
                    renderActionButtons();
                }
            } catch(e) {
                document.getElementById(loadingId)?.remove();
                appendMessage("Error connecting to Co-Steer MVP backend.", true);
            }
        };

        const renderActionButtons = () => {
            const btnContainer = document.createElement('div');
            btnContainer.className = 'action-btn-group';
            btnContainer.style.display = 'flex';
            btnContainer.style.gap = '0.5rem';
            btnContainer.style.marginTop = '0.5rem';
            btnContainer.style.justifyContent = 'flex-end';

            const generateBtn = document.createElement('button');
            generateBtn.innerText = "Generate Briefs";
            generateBtn.style.background = "var(--primary)";
            generateBtn.style.color = "white";
            generateBtn.style.border = "none";
            generateBtn.style.padding = "0.5rem 1rem";
            generateBtn.style.borderRadius = "8px";
            generateBtn.style.cursor = "pointer";

            const adjustBtn = document.createElement('button');
            adjustBtn.innerText = "Make Adjustments";
            adjustBtn.style.background = "rgba(255,255,255,0.1)";
            adjustBtn.style.color = "var(--text-main)";
            adjustBtn.style.border = "1px solid var(--glass-border)";
            adjustBtn.style.padding = "0.5rem 1rem";
            adjustBtn.style.borderRadius = "8px";
            adjustBtn.style.cursor = "pointer";

            generateBtn.addEventListener('click', async () => {
                generateBtn.innerText = "Generating...";
                try {
                    const res = await fetch('/api/briefs/generate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ history: chatHistory })
                    });
                    const d = await res.json();
                    
                    const btnId = 'view-briefs-btn-' + Date.now();
                    const btnContainerHTML = `
                        <div style="margin-top: 0.5rem;">
                            <button id="${btnId}" style="background: var(--accent-2); color: #09090b; border: none; padding: 0.5rem 1rem; border-radius: 8px; cursor: pointer; font-weight: 600;">
                                View Team Briefs
                            </button>
                        </div>
                    `;
                    
                    appendMessage(d.message + btnContainerHTML, true);
                    
                    setTimeout(() => {
                        const viewBtn = document.getElementById(btnId);
                        if(viewBtn) {
                            viewBtn.addEventListener('click', () => {
                                const objectivesTab = document.querySelector('.nav-item[data-view="objectives"]');
                                if(objectivesTab) objectivesTab.click();
                            });
                        }
                    }, 100);

                    btnContainer.remove();
                    fetchTeamBriefs();
                } catch(e) {
                    appendMessage("Error generating brief.", true);
                }
            });

            adjustBtn.addEventListener('click', () => {
                chatInput.value = "I need to make some adjustments to the plan.";
                btnContainer.remove();
            });

            btnContainer.appendChild(adjustBtn);
            btnContainer.appendChild(generateBtn);
            chatBody.appendChild(btnContainer);
            chatBody.scrollTop = chatBody.scrollHeight;
        };

        const renderContextUploadButton = () => {
            const btnContainer = document.createElement('div');
            btnContainer.className = 'action-btn-group';
            btnContainer.style.display = 'flex';
            btnContainer.style.marginTop = '0.5rem';
            btnContainer.style.justifyContent = 'flex-end';

            const uploadBtn = document.createElement('button');
            uploadBtn.innerText = "Upload Company Context";
            uploadBtn.style.background = "var(--primary)";
            uploadBtn.style.color = "white";
            uploadBtn.style.border = "none";
            uploadBtn.style.padding = "0.5rem 1rem";
            uploadBtn.style.borderRadius = "8px";
            uploadBtn.style.cursor = "pointer";

            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.multiple = true;
            fileInput.style.display = 'none';
            document.body.appendChild(fileInput);

            uploadBtn.addEventListener('click', () => fileInput.click());

            fileInput.addEventListener('change', async (e) => {
                if(e.target.files.length > 0) {
                    const formData = new FormData();
                    for (let i = 0; i < e.target.files.length; i++) {
                        formData.append('files', e.target.files[i]);
                    }
                    uploadBtn.innerText = "Uploading...";
                    try {
                        await fetch('/api/context/upload', { method: 'POST', body: formData });
                        btnContainer.remove();
                        fetchCompanyContext();
                        appendMessage("Context uploaded successfully. Let's start the week.", true);
                        setTimeout(() => {
                            chatInput.value = "Let's open this week";
                            sendMessage();
                        }, 500);
                    } catch(err) {
                        uploadBtn.innerText = "Upload Failed";
                    }
                }
            });

            btnContainer.appendChild(uploadBtn);
            chatBody.appendChild(btnContainer);
            chatBody.scrollTop = chatBody.scrollHeight;
        };

        const chatExpandBtn = document.getElementById('chat-expand-btn');
        const chatMinimizeBtn = document.getElementById('chat-minimize-btn');

        chatExpandBtn.addEventListener('click', expandChatToFullscreen);
        chatMinimizeBtn.addEventListener('click', minimizeChatFromFullscreen);

        chatSendBtn.addEventListener('click', sendMessage);
        chatInput.addEventListener('keypress', (e) => { if(e.key === 'Enter') sendMessage(); });

        // Connect Data Source bypass
        const uploadContextBtn = document.getElementById('upload-context-btn');
        if(uploadContextBtn) {
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.multiple = true;
            fileInput.style.display = 'none';
            document.body.appendChild(fileInput);

            uploadContextBtn.addEventListener('click', () => fileInput.click());

            fileInput.addEventListener('change', async (e) => {
                if(e.target.files.length > 0) {
                    const formData = new FormData();
                    for (let i = 0; i < e.target.files.length; i++) {
                        formData.append('files', e.target.files[i]);
                    }
                    uploadContextBtn.innerText = "Uploading...";
                    try {
                        const res = await fetch('/api/context/upload', {
                            method: 'POST',
                            body: formData
                        });
                        const data = await res.json();
                        alert(data.message || "Uploaded successfully");
                        uploadContextBtn.innerText = "Select File";
                        fetchCompanyContext();
                    } catch(err) {
                        alert("Upload failed.");
                        uploadContextBtn.innerText = "Select File";
                    }
                }
            });
        }

        // Weekly Loop Quick Start
        const startWeeklyLoopBtn = document.getElementById('start-weekly-loop');
        if(startWeeklyLoopBtn) {
            startWeeklyLoopBtn.addEventListener('click', () => {
                chatWidget.classList.remove('collapsed');
                chatToggleBtn.classList.add('hidden');
                chatInput.value = "Let's open this week";
                sendMessage();
            });
        }

        // Fetch Team Briefs
        const fetchTeamBriefs = async () => {
            try {
                const res = await fetch('/api/briefs/team');
                const briefs = await res.json();
                const teamContainer = document.getElementById('team-briefs-container');
                const ceoContainer = document.getElementById('ceo-briefs-container');
                
                if (teamContainer) teamContainer.innerHTML = '';
                if (ceoContainer) ceoContainer.innerHTML = '';
                
                const safeRole = b => (b.role || 'Unassigned');
                const ceoBriefs = briefs.filter(b => safeRole(b).toLowerCase().includes('ceo'));
                const teamBriefs = briefs.filter(b => !safeRole(b).toLowerCase().includes('ceo'));

                const renderCard = (b, container) => {
                    const div = document.createElement('div');
                    div.className = 'glass';
                    div.style.padding = '1rem';
                    div.style.cursor = 'pointer';
                    div.style.transition = 'background 0.2s';
                    div.onmouseover = () => div.style.background = 'rgba(255,255,255,0.05)';
                    div.onmouseout = () => div.style.background = 'var(--glass-bg)';
                    
                    div.innerHTML = `
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
                            <h4 style="font-weight: 600; color: var(--text-main);">${b.role} ${b.name ? `(${b.name})` : ''}</h4>
                            <span style="font-size: 0.75rem; color: var(--text-muted);">${b.time || ''}</span>
                        </div>
                        <div style="font-size: 0.85rem; color: var(--text-muted); display: flex; justify-content: space-between;">
                            <span>Brief - ${b.date}</span>
                            <span style="color: #22c55e;">Generated</span>
                        </div>
                    `;
                    div.addEventListener('click', () => openBriefModal(b));
                    div.addEventListener('contextmenu', (e) => {
                        e.preventDefault();
                        const menu = document.getElementById('brief-context-menu');
                        menu.style.display = 'block';
                        menu.style.left = `${e.clientX}px`;
                        menu.style.top = `${e.clientY}px`;
                        
                        const deleteBtn = document.getElementById('context-delete-btn');
                        
                        // Remove old listeners to prevent multiple deletions
                        const newDeleteBtn = deleteBtn.cloneNode(true);
                        deleteBtn.parentNode.replaceChild(newDeleteBtn, deleteBtn);
                        
                        newDeleteBtn.addEventListener('click', async () => {
                            menu.style.display = 'none';
                            try {
                                await fetch(`/api/briefs/team/${b.id}`, { method: 'DELETE' });
                                fetchTeamBriefs();
                            } catch(err) {
                                console.error(err);
                            }
                        });
                    });
                    container.prepend(div);
                };

                if (ceoBriefs.length === 0 && ceoContainer) {
                    ceoContainer.innerHTML = '<div class="message" style="color: var(--text-muted);">No CEO briefs generated yet.</div>';
                } else {
                    ceoBriefs.forEach(b => renderCard(b, ceoContainer));
                }

                if (teamBriefs.length === 0 && teamContainer) {
                    teamContainer.innerHTML = '<div class="message" style="color: var(--text-muted);">No Team briefs generated yet.</div>';
                } else {
                    teamBriefs.forEach(b => renderCard(b, teamContainer));
                }
            } catch(e) {
                console.error("Failed to fetch briefs", e);
            }
        };

        const briefModal = document.getElementById('brief-modal');
        const modalTitle = document.getElementById('modal-title');
        const modalRole = document.getElementById('modal-role');
        const modalDate = document.getElementById('modal-date');
        const modalContent = document.getElementById('modal-content');
        
        const openBriefModal = (brief) => {
            modalTitle.innerText = `Weekly Brief: ${brief.role}`;
            modalRole.innerText = `${brief.role} ${brief.name ? `(${brief.name})` : ''}`;
            modalDate.innerText = `${brief.date} at ${brief.time || ''}`;
            
            if (window.marked) {
                modalContent.innerHTML = marked.parse(brief.content);
            } else {
                modalContent.innerHTML = `<pre>${brief.content}</pre>`;
            }
            
            // Setup Edit Action
            const editBtn = document.getElementById('modal-edit-btn');
            if (editBtn) {
                editBtn.innerText = "✏️ Edit Brief";
                editBtn.style.background = "rgba(56, 189, 248, 0.1)";
                editBtn.onclick = () => {
                    if (editBtn.innerText.includes("Save")) {
                        // Save action
                        const newContent = document.getElementById('brief-edit-textarea').value;
                        editBtn.innerText = "Saving...";
                        fetch(`/api/briefs/team/${brief.id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ content: newContent })
                        }).then(res => res.json()).then(data => {
                            brief.content = newContent; // update local ref
                            if (window.marked) {
                                modalContent.innerHTML = marked.parse(brief.content);
                            } else {
                                modalContent.innerHTML = `<pre>${brief.content}</pre>`;
                            }
                            editBtn.innerText = "✅ Saved";
                            setTimeout(() => {
                                editBtn.innerText = "✏️ Edit Brief";
                                editBtn.style.background = "rgba(56, 189, 248, 0.1)";
                            }, 2000);
                            fetchTeamBriefs(); // refresh background cards
                        }).catch(err => {
                            console.error(err);
                            editBtn.innerText = "❌ Error";
                        });
                    } else {
                        // Edit action
                        modalContent.innerHTML = `<textarea id="brief-edit-textarea" style="width: 100%; height: 100%; min-height: 300px; background: rgba(0,0,0,0.3); border: 1px solid var(--glass-border); color: var(--text-main); font-family: inherit; font-size: 0.95rem; padding: 1rem; border-radius: 8px; resize: vertical; line-height: 1.6;"></textarea>`;
                        document.getElementById('brief-edit-textarea').value = brief.content;
                        editBtn.innerText = "💾 Save Changes";
                        editBtn.style.background = "var(--primary)";
                    }
                };
            }
            
            // Setup Copy Action
            document.getElementById('modal-copy-btn').onclick = () => {
                navigator.clipboard.writeText(brief.content);
                const btn = document.getElementById('modal-copy-btn');
                btn.innerText = "✅ Copied!";
                setTimeout(() => btn.innerText = "📋 Copy Content", 2000);
            };

            // Setup Print/Download Action
            document.getElementById('modal-download-btn').onclick = () => {
                window.print();
            };

            briefModal.showModal();
        };

        document.getElementById('modal-close').addEventListener('click', () => {
            briefModal.close();
        });

        briefModal.addEventListener('click', (e) => {
            const dialogDimensions = briefModal.getBoundingClientRect();
            if (
                e.clientX < dialogDimensions.left ||
                e.clientX > dialogDimensions.right ||
                e.clientY < dialogDimensions.top ||
                e.clientY > dialogDimensions.bottom
            ) {
                briefModal.close();
            }
        });

        const clearAllBriefsBtn = document.getElementById('clear-all-briefs-btn');
        const confirmModal = document.getElementById('confirm-modal');
        const confirmCancelBtn = document.getElementById('confirm-cancel-btn');
        const confirmDeleteBtn = document.getElementById('confirm-delete-btn');

        if (clearAllBriefsBtn && confirmModal) {
            clearAllBriefsBtn.addEventListener('click', () => {
                confirmModal.showModal();
            });

            confirmCancelBtn.addEventListener('click', () => {
                confirmModal.close();
            });

            confirmDeleteBtn.addEventListener('click', async () => {
                confirmDeleteBtn.innerText = 'Deleting...';
                confirmDeleteBtn.style.opacity = '0.7';
                try {
                    await fetch('/api/briefs/team', { method: 'DELETE' });
                    fetchTeamBriefs();
                } catch(e) {
                    console.error('Failed to clear briefs', e);
                }
                confirmModal.close();
                confirmDeleteBtn.innerText = 'Yes, Delete All';
                confirmDeleteBtn.style.opacity = '1';
            });
        }

        document.addEventListener('click', (e) => {
            const menu = document.getElementById('brief-context-menu');
            if (menu && menu.style.display === 'block') {
                menu.style.display = 'none';
            }
        });

        const fetchCompanyContext = async () => {
            try {
                const res = await fetch('/api/context');
                const data = await res.json();
                
                const uploadContainer = document.getElementById('upload-container');
                const activeContextContainer = document.getElementById('active-context-container');
                const infoUploadState = document.getElementById('company-info-upload-state');
                const infoLoadedState = document.getElementById('company-info-loaded-state');
                const rawContext = document.getElementById('raw-company-context');
                
                if(data.profile) {
                    if (uploadContainer) uploadContainer.style.display = 'none';
                    if (activeContextContainer) activeContextContainer.style.display = 'flex';
                    if (infoUploadState) infoUploadState.style.display = 'none';
                    if (infoLoadedState) infoLoadedState.style.display = 'block';
                    if (rawContext && window.marked) {
                        let cleanProfile = data.profile.replace(/```markdown\n?/gi, '').replace(/```\n?/gi, '');
                        rawContext.innerHTML = marked.parse(cleanProfile);
                    }
                } else {
                    if (uploadContainer) uploadContainer.style.display = 'block';
                    if (activeContextContainer) activeContextContainer.style.display = 'none';
                    if (infoUploadState) infoUploadState.style.display = 'block';
                    if (infoLoadedState) infoLoadedState.style.display = 'none';
                }
            } catch(e) {
                console.error("Failed to fetch context", e);
            }
        };

        const clearBtn = document.getElementById('clear-context-btn');
        if (clearBtn) {
            clearBtn.addEventListener('click', async () => {
                try {
                    await fetch('/api/context', { method: 'DELETE' });
                    fetchCompanyContext();
                } catch(e) {
                    console.error("Failed to clear context", e);
                }
            });
        }

        // Initial fetch
        fetchTeamBriefs();
        fetchCompanyContext();
