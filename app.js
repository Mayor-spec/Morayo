async function loadQuestion(category) {
    const key = document.getElementById('api-key').value;
    if (!key) return alert("Please enter your API Key first!");

    const prompt = `Generate a trivia question about ${category} for "Who Wants to Be a Millionaire". Return JSON: {"question": "...", "options": ["A", "B", "C", "D"], "answer": "...", "explanation": "..."}`;
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });

    const data = await response.json();
    const result = JSON.parse(data.candidates[0].content.parts[0].text.replace(/```json|
```/g, ""));
    
    document.getElementById('question-text').innerText = result.question;
    const optionsDiv = document.getElementById('options');
    optionsDiv.innerHTML = '';
    result.options.forEach(opt => {
        let btn = document.createElement('button');
        btn.innerText = opt;
        btn.onclick = () => {
            alert(opt === result.answer ? "Correct!" : "Wrong!");
            document.getElementById('explanation').innerText = result.explanation;
        };
        optionsDiv.appendChild(btn);
    });
}
