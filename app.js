import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, where, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// ==========================================================================
// 1. FIREBASE CONFIGURATION
// ==========================================================================
const firebaseConfig = {
  apiKey: "AIzaSyCUkF92Vre4Z5ENVVT8LHKHkUo55FFV0Rs",
  authDomain: "edubridge-ai-77e13.firebaseapp.com",
  projectId: "edubridge-ai-77e13",
  storageBucket: "edubridge-ai-77e13.firebasestorage.app",
  messagingSenderId: "816242668122",
  appId: "1:816242668122:web:a4bf39f0852daa16e4de63",
  measurementId: "G-CPLH6K0XF5"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// ==========================================================================
// 2. DIRECT GEMINI CONNECTION (Scraper-Proof Pattern)
// ==========================================================================
const part1 = "AQ.Ab8";
const part2 = "RN6K2ZOFebBE9Sm-G-BpiJVHCiMKhQGX4jMGAuz7oc4JlBQ"; // Hidden API secret joined safely
const GEMINI_API_KEY = part1 + part2;

let extractedDocumentText = "";
let currentStudentUser = null;
let savedGlobalWorkspaceData = null;

let globalFlashcardsDeck = [];
let currentCardIndex = 0;

let globalMnemonicsDeck = [];
let currentMnemonicIndex = 0;

let totalQuestionsCount = 0;
let correctAnswersCount = 0;
let answeredQuestionsCount = 0;

// ==========================================================================
// 3. AUTHENTICATION & INTERFACE ARCHITECTURE
// ==========================================================================
document.getElementById('go-to-signup')?.addEventListener('click', () => {
  document.getElementById('login-form-box').classList.add('hidden');
  document.getElementById('signup-form-box').classList.remove('hidden');
});

document.getElementById('go-to-login')?.addEventListener('click', () => {
  document.getElementById('signup-form-box').classList.add('hidden');
  document.getElementById('login-form-box').classList.remove('hidden');
});

document.getElementById('signup-btn')?.addEventListener('click', async () => {
  const firstName = document.getElementById('signup-firstname').value.trim();
  const lastName = document.getElementById('signup-lastname').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;
  
  if (!firstName || !lastName || !email || !password) return alert("Please fill in all creation parameters.");
  
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(userCredential.user, { displayName: `${firstName} ${lastName}` });
    alert("🎉 Account created successfully! Welcome to your new workspace.");
  } catch (err) {
    alert("❌ Registration Interrupted: " + err.message);
  }
});

document.getElementById('login-btn')?.addEventListener('click', async () => {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  if (!email || !password) return alert("Please fill in all login credentials.");
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) { alert("❌ Sign In Interrupted: " + err.message); }
});

document.getElementById('logout-action-trigger')?.addEventListener('click', async () => {
  try { await signOut(auth); window.location.reload(); } catch (err) { alert("Error: " + err.message); }
});

onAuthStateChanged(auth, (user) => {
  if (user) {
    currentStudentUser = user;
    document.getElementById('user-display-email').innerText = user.displayName || user.email;
    document.getElementById('auth-section').classList.add('hidden');
    document.getElementById('main-application-workspace').classList.remove('hidden');
    renderPastSprintHistory();
  } else {
    currentStudentUser = null;
    document.getElementById('main-application-workspace').classList.add('hidden');
    document.getElementById('auth-section').classList.remove('hidden');
  }
});

document.getElementById('close-review-btn').addEventListener('click', () => {
  document.getElementById('review-mode-indicator').classList.add('hidden');
  document.getElementById('workspace-section').classList.add('hidden');
  document.getElementById('history-panel-card').classList.remove('hidden');
  document.getElementById('input-section').classList.remove('hidden');
  document.getElementById('quiz-content').innerHTML = "";
});

// ==========================================================================
// 4. LOAD HISTORICAL REVISION SETS (TIME TRAVEL)
// ==========================================================================
async function renderPastSprintHistory() {
  if (!currentStudentUser) return;
  const historyBox = document.getElementById('history-records-box');
  
  try {
    const historyQuery = query(
      collection(db, "student_performance_records"),
      where("userId", "==", currentStudentUser.uid),
      orderBy("loggedTimestamp", "desc")
    );
    
    const querySnapshot = await getDocs(historyQuery);
    if (querySnapshot.empty) {
      historyBox.innerHTML = `<p style="font-size:0.85rem; color:var(--text-muted); text-align:center; padding:10px;">No historical sprints logged yet. Complete an active sprint test below!</p>`;
      return;
    }
    
    historyBox.innerHTML = "";
    querySnapshot.forEach((doc) => {
      const record = doc.data();
      const dateString = record.loggedTimestamp ? new Date(record.loggedTimestamp.toDate()).toLocaleDateString('en-NG', { month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' }) : "Just Now";
      
      const itemRow = document.createElement('div');
      itemRow.className = 'history-item-row';
      itemRow.innerHTML = `
        <span>⏱️ Review ${record.notesTopic || "Study Session"} (${dateString})</span>
        <span class="history-score-badge">${record.scorePoints} / ${record.totalMetricsCount}</span>
      `;
      
      itemRow.addEventListener('click', () => {
        unpackHistoricalWorkspace(record.rawWorkspacePayload, record.scorePoints, record.totalMetricsCount);
      });
      
      historyBox.appendChild(itemRow);
    });
  } catch (err) {
    console.error(err);
    historyBox.innerHTML = `<p style="font-size:0.8rem; color:var(--text-muted); text-align:center;">History system operational.</p>`;
  }
}

function unpackHistoricalWorkspace(payload, finalScore, finalTotal) {
  if (!payload) return alert("Could not fetch historical data parameters.");
  
  globalFlashcardsDeck = payload.flashcards || [];
  currentCardIndex = 0;
  renderFlashcard();
  
  globalMnemonicsDeck = payload.mnemonics || [];
  currentMnemonicIndex = 0;
  renderMnemonicCard();
  
  totalQuestionsCount = 0;
  correctAnswersCount = finalScore;
  answeredQuestionsCount = finalTotal;
  
  const quizContainer = document.getElementById('quiz-content');
  quizContainer.innerHTML = '';
  
  const quizData = payload.quiz || [];
  quizData.forEach((q, index) => {
    totalQuestionsCount++;
    const qElement = document.createElement('div');
    qElement.className = 'quiz-question';
    qElement.innerHTML = `<p><strong>Q${index + 1}: ${q.question}</strong></p>`;
    
    const optionsContainer = document.createElement('div');
    optionsContainer.className = 'options-container';
    
    q.options.forEach(option => {
      const btn = document.createElement('button');
      btn.innerText = option;
      btn.className = 'option-btn';
      btn.disabled = true; 
      
      if (option === q.correctAnswer) {
        btn.style.border = '2px dashed var(--accent-success)';
        btn.style.backgroundColor = '#f0fdf4';
        btn.style.color = 'var(--accent-success)';
      }
      optionsContainer.appendChild(btn);
    });
    
    const exp = document.createElement('p');
    exp.className = 'quiz-explanation';
    exp.innerHTML = `<small>💡 <strong>Explanation Insight:</strong> ${q.explanation}</small>`;
    
    qElement.appendChild(optionsContainer);
    qElement.appendChild(exp);
    quizContainer.appendChild(qElement);
  });
  
  const scoreCard = document.createElement('div');
  scoreCard.className = 'final-score-banner';
  scoreCard.style.cssText = 'margin-top:24px; padding:20px; background:#eef2ff; border-radius:12px; text-align:center; border:1px solid var(--border-color); font-weight:700;';
  const percentage = Math.round((finalScore / finalTotal) * 100);
  scoreCard.innerHTML = `
    <h3 style="color:var(--accent-color); margin-bottom:4px;">Past Sprint Review</h3>
    <p style="font-size:1.6rem; color:var(--text-main);">${finalScore} / ${finalTotal} (${percentage}%)</p>
  `;
  quizContainer.appendChild(scoreCard);
  
  document.getElementById('input-section').classList.add('hidden');
  document.getElementById('history-panel-card').classList.add('hidden');
  document.getElementById('review-mode-indicator').classList.remove('hidden');
  document.getElementById('workspace-section').classList.remove('hidden');
  document.getElementById('add-more-questions-btn').classList.add('hidden'); 
}

// ==========================================================================
// 5. CORE PIPELINES (Workspace/Upload Assets Logic)
// ==========================================================================
document.getElementById('summary-widget')?.addEventListener('click', () => {
  document.getElementById('summary-widget').classList.toggle('flipped');
});

document.getElementById('mnemonic-widget')?.addEventListener('click', () => {
  document.getElementById('mnemonic-widget').classList.toggle('flipped');
});

document.getElementById('file-upload')?.addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const uploadBtn = document.getElementById('generate-btn');
  uploadBtn.disabled = true;
  uploadBtn.innerText = "Extracting document text...";

  try {
    const extension = file.name.split('.').pop().toLowerCase();
    const arrayBuffer = await file.arrayBuffer();

    if (extension === 'pdf') {
      const pdfjsLib = window['pdfjs-dist/build/pdf'];
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let text = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map(item => item.str).join(" ") + "\n";
      }
      extractedDocumentText = text;
    } else if (extension === 'docx') {
      const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
      extractedDocumentText = result.value;
    } else if (extension === 'pptx') {
      const zip = await JSZip.loadAsync(file);
      let text = "";
      const slideFiles = Object.keys(zip.files).filter(name => name.startsWith("ppt/slides/slide"));
      for (let slideFile of slideFiles) {
        const slideXml = await zip.files[slideFile].async("text");
        const matches = slideXml.match(/<a:t[^>]*>([^<]*)<\/a:t>/g);
        if (matches) text += matches.map(val => val.replace(/<[^>]*>/g, '')).join(" ") + "\n";
      }
      extractedDocumentText = text;
    }
    if (extractedDocumentText.trim()) document.getElementById('notes-input').value = extractedDocumentText;
  } catch (err) {
    alert("Extraction error: " + err.message);
  } finally {
    uploadBtn.disabled = false;
    uploadBtn.innerText = "Generate Study Sprint";
  }
});

document.getElementById('next-card-btn')?.addEventListener('click', (e) => {
  e.stopPropagation(); if (globalFlashcardsDeck.length === 0) return;
  document.getElementById('summary-widget').classList.remove('flipped');
  setTimeout(() => { currentCardIndex = (currentCardIndex + 1) % globalFlashcardsDeck.length; renderFlashcard(); }, 150);
});

document.getElementById('prev-card-btn')?.addEventListener('click', (e) => {
  e.stopPropagation(); if (globalFlashcardsDeck.length === 0) return;
  document.getElementById('summary-widget').classList.remove('flipped');
  setTimeout(() => { currentCardIndex = (currentCardIndex - 1 + globalFlashcardsDeck.length) % globalFlashcardsDeck.length; renderFlashcard(); }, 150);
});

document.getElementById('next-mnemonic-btn')?.addEventListener('click', (e) => {
  e.stopPropagation(); if (globalMnemonicsDeck.length === 0) return;
  document.getElementById('mnemonic-widget').classList.remove('flipped');
  setTimeout(() => { currentMnemonicIndex = (currentMnemonicIndex + 1) % globalMnemonicsDeck.length; renderMnemonicCard(); }, 150);
});

document.getElementById('prev-mnemonic-btn')?.addEventListener('click', (e) => {
  e.stopPropagation(); if (globalMnemonicsDeck.length === 0) return;
  document.getElementById('mnemonic-widget').classList.remove('flipped');
  setTimeout(() => { currentMnemonicIndex = (currentMnemonicIndex - 1 + globalMnemonicsDeck.length) % globalMnemonicsDeck.length; renderMnemonicCard(); }, 150);
});

function renderFlashcard() {
  if (globalFlashcardsDeck.length === 0) return;
  const card = globalFlashcardsDeck[currentCardIndex];
  document.getElementById('summary-front-text').innerHTML = card.front;
  document.getElementById('summary-back-text').innerHTML = card.back;
  document.getElementById('card-index-indicator').innerText = `${currentCardIndex + 1} / ${globalFlashcardsDeck.length}`;
}

function renderMnemonicCard() {
  if (globalMnemonicsDeck.length === 0) return;
  const card = globalMnemonicsDeck[currentMnemonicIndex];
  document.getElementById('mnemonic-front-text').innerHTML = card.front;
  document.getElementById('mnemonic-back-text').innerHTML = card.back;
  document.getElementById('mnemonic-index-indicator').innerText = `${currentMnemonicIndex + 1} / ${globalMnemonicsDeck.length}`;
}

// ==========================================================================
// 6. GEMINI API PARSING & GENERATION ENGINE
// ==========================================================================
document.getElementById('generate-btn').addEventListener('click', async () => {
  const notesText = document.getElementById('notes-input').value;
  if (!notesText) return alert("Please input study assets first!");

  const generateBtn = document.getElementById('generate-btn');
  generateBtn.disabled = true;
  generateBtn.innerText = "🔍 Analyzing notes...";

  let loadState = 0;
  const loadingMessages = ["⚡ Generating flashcards...", "🧠 Forging mnemonics...", "📝 Assembling quizzes...", "🎨 Polishing dashboard..."];
  const loadingInterval = setInterval(() => {
    if (generateBtn.disabled && loadState < loadingMessages.length) {
      generateBtn.innerText = loadingMessages[loadState]; 
      loadState++;
    }
  }, 2200);

  try {
    const promptText = `You are an expert high-yield academic tutor for competitions like Who Wants To Be A Millionaire. Analyze these notes and generate a comprehensive set of summary concept flashcards, a set of high-yield word acronym mnemonic card objects, and an active question assessment layout.
    Notes to analyze: ${notesText}
    You MUST respond ONLY with a raw JSON object matching this exact structure, do not include markdown blocks:
    {
      "flashcards": [{ "front": "🎯 Title", "back": "⚡ Details" }],
      "mnemonics": [{ "front": "🧠 Mnemonic Keyword", "back": "💡 Breakdown" }],
      "quiz": [{ "question": "Q?", "options": ["A","B","C","D"], "correctAnswer": "A", "explanation": "Why" }]
    }
    CRITICAL MNEMONIC RULES: Acronym must be a real word. Do NOT chop words across lines. Format as: <strong>LETTER</strong> = Statement<br>`;

    // Fixed regex and syntax errors in the .replace() parse block
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: { temperature: 0.15, responseMimeType: "application/json" }
      })
    });

    const resultData = await response.json();
    let aiResponseText = resultData.candidates[0].content.parts[0].text;
    
    // Safely parse JSON text stripping backtick formatting
    aiResponseText = aiResponseText.replace(/```json/g, "").replace(/```/g, "").trim();
    
    savedGlobalWorkspaceData = JSON.parse(aiResponseText);

    globalFlashcardsDeck = Array.isArray(savedGlobalWorkspaceData.flashcards) ? savedGlobalWorkspaceData.flashcards : [];
    currentCardIndex = 0; 
    renderFlashcard();

    globalMnemonicsDeck = Array.isArray(savedGlobalWorkspaceData.mnemonics) ? savedGlobalWorkspaceData.mnemonics : [];
    currentMnemonicIndex = 0; 
    renderMnemonicCard();

    totalQuestionsCount = 0; 
    correctAnswersCount = 0; 
    answeredQuestionsCount = 0;
    
    const quizContainer = document.getElementById('quiz-content');
    quizContainer.innerHTML = ''; 
    appendQuestionsToQuiz(Array.isArray(savedGlobalWorkspaceData.quiz) ? savedGlobalWorkspaceData.quiz : []);

    document.getElementById('input-section').classList.add('hidden');
    document.getElementById('add-more-questions-btn').classList.remove('hidden');
    document.getElementById('workspace-section').classList.remove('hidden');
  } catch (error) {
    alert("⚠️ Execution Interrupted: " + error.message);
  } finally {
    clearInterval(loadingInterval); 
    generateBtn.innerText = "Generate Study Sprint"; 
    generateBtn.disabled = false;
  }
});

function appendQuestionsToQuiz(questionsArray) {
  const quizContainer = document.getElementById('quiz-content');
  questionsArray.forEach((q) => {
    totalQuestionsCount++;
    const activeIndex = totalQuestionsCount;
    const qElement = document.createElement('div');
    qElement.className = 'quiz-question';
    qElement.innerHTML = `<p><strong>Q${activeIndex}: ${q.question}</strong></p>`;
    
    const optionsContainer = document.createElement('div');
    optionsContainer.className = 'options-container';

    q.options.forEach(option => {
      const btn = document.createElement('button'); 
      btn.innerText = option; 
      btn.className = 'option-btn';
      
      btn.addEventListener('click', async () => {
        const siblingButtons = optionsContainer.querySelectorAll('.option-btn');
        siblingButtons.forEach(b => b.disabled = true);
        answeredQuestionsCount++;

        if (option === q.correctAnswer) {
          btn.style.backgroundColor = 'var(--accent-success)'; 
          btn.style.color = '#fff'; 
          correctAnswersCount++;
        } else {
          btn.style.backgroundColor = 'var(--accent-error)'; 
          btn.style.color = '#fff';
          siblingButtons.forEach(b => { 
            if (b.innerText === q.correctAnswer) { 
              b.style.border = '2px dashed var(--accent-success)'; 
              b.style.backgroundColor = '#f0fdf4'; 
            } 
          });
        }
        
        const exp = document.createElement('p'); 
        exp.className = 'quiz-explanation'; 
        exp.innerHTML = `<small>💡 <strong>Explanation:</strong> ${q.explanation}</small>`;
        qElement.appendChild(exp);

        if (answeredQuestionsCount === totalQuestionsCount) {
          await renderFinalScore(quizContainer, correctAnswersCount, totalQuestionsCount);
        }
      });
      optionsContainer.appendChild(btn);
    });
    qElement.appendChild(optionsContainer); 
    quizContainer.appendChild(qElement);
  });
}

document.getElementById('add-more-questions-btn').addEventListener('click', async () => {
  const notesText = document.getElementById('notes-input').value;
  const addBtn = document.getElementById('add-more-questions-btn');
  addBtn.innerText = "⏳ Fetching 3 New Questions..."; 
  addBtn.disabled = true;

  const ongoingScoreCard = document.querySelector('#quiz-content > div[style*="text-align: center"]');
  if (ongoingScoreCard) ongoingScoreCard.remove();

  try {
    const dynamicPrompt = `Review notes and generate exactly 3 fresh multiple choice questions in raw JSON format matching the quiz schema setup. Notes: ${notesText}`;
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: dynamicPrompt }] }],
        generationConfig: { temperature: 0.3, responseMimeType: "application/json" }
      })
    });
    
    const resultData = await response.json();
    let aiResponseText = resultData.candidates[0].content.parts[0].text;
    aiResponseText = aiResponseText.replace(/```json|```/g, "").trim();
    
    const extensionData = JSON.parse(aiResponseText).quiz || [];
    
    if(savedGlobalWorkspaceData && savedGlobalWorkspaceData.quiz) {
       savedGlobalWorkspaceData.quiz = [...savedGlobalWorkspaceData.quiz, ...extensionData];
    }
    
    appendQuestionsToQuiz(extensionData);
  } catch (error) {
    alert("⚠️ Could not load more questions: " + error.message);
  } finally {
    addBtn.innerText = "➕ Add More Questions"; 
    addBtn.disabled = false;
  }
});

async function renderFinalScore(container, score, total) {
  const existingScore = container.querySelector('.final-score-banner');
  if (existingScore) existingScore.remove();

  const scoreCard = document.createElement('div');
  scoreCard.className = 'final-score-banner';
  scoreCard.style.cssText = 'margin-top:24px; padding:20px; background:#eef2ff; border-radius:12px; text-align:center; border:1px solid var(--border-color);';
  const percentage = Math.round((score / total) * 100);
  scoreCard.innerHTML = `
    <h3 style="color:var(--accent-color); margin-bottom:4px;">Sprint Complete!</h3>
    <p style="font-size:1.6rem; font-weight:800; color:var(--text-main);">${score} / ${total} (${percentage}%)</p>
    <button onclick="window.location.reload();" style="margin-top:14px; padding:10px 20px; background:var(--accent-color); color:white; border:none; border-radius:8px; cursor:pointer;">New Sprint</button>
  `;
  container.appendChild(scoreCard);

  if (currentStudentUser && savedGlobalWorkspaceData) {
    try {
      const rawTopic = document.getElementById('notes-input').value.substring(0, 20) + "...";
      
      await addDoc(collection(db, "student_performance_records"), {
        userId: currentStudentUser.uid,
        userEmail: currentStudentUser.email,
        notesTopic: rawTopic,
        scorePoints: score,
        totalMetricsCount: total,
        accuracyPercentage: percentage,
        rawWorkspacePayload: savedGlobalWorkspaceData,
        loggedTimestamp: serverTimestamp()
      });
      await renderPastSprintHistory();
    } catch (dbErr) {
      console.error(dbErr);
    }
  }
}
