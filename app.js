async function loadQuestion(category) {
    const key = document.getElementById('api-key').value;
    if (!key) return alert("Please enter your API Key first!");

    // Added a more specific instruction to ensure valid JSON
    const prompt = `Generate a trivia question about ${category} for "Who Wants to Be a Millionaire". 
    Return ONLY valid JSON in this format: 
    {"question": "The question text?", "options": ["Option A", "Option B", "Option C", "Option D"], "answer": "The correct option", "explanation": "A brief explanation."}`;
    
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });

        const data = await response.json();
        
        // Check if API returned an error
        if (data.error) {
            alert("API Error: " + data.error.message);
            return;
        }

        // Clean up the text: remove markdown code block backticks and any extra whitespace
        let rawText = data.candidates[0].content.parts[0].text;
        rawText = rawText.replace(/```json/g, "").replace(/
```/g, "").trim();
        
        const result = JSON.parse(rawText);
        
        document.getElementById('question-text').innerText = result.question;
        const optionsDiv = document.getElementById('options');
        optionsDiv.innerHTML = '';
        
        result.options.forEach(opt => {
            let btn = document.createElement('button');
            btn.innerText = opt;
            btn.className = "option-btn"; // You can style this in CSS
            btn.onclick = () => {
                alert(opt === result.answer ? "Correct!" : "Wrong! The answer was " + result.answer);
                document.getElementById('explanation').innerText = "Explanation: " + result.explanation;
            };
            optionsDiv.appendChild(btn);
        });
    } catch (error) {
        console.error("Error:", error);
        alert("Failed to load question. Check your API key or internet connection.");
    }
}
