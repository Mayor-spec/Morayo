async function loadQuestion(category) {
    console.log("Button clicked for category:", category); // Debug 1
    
    const key = document.getElementById('api-key').value;
    if (!key) {
        console.log("No API key found!"); // Debug 2
        return alert("Please enter your API Key first!");
    }

    console.log("Preparing to fetch from Gemini using gemini-1.5-flash..."); // Debug 3

    // Prompting Gemini to return pure, structured JSON
    const prompt = `Generate a trivia question about ${category} for "Who Wants to Be a Millionaire". 
    Return ONLY valid JSON in this exact format: 
    {"question": "The question text?", "options": ["Option A", "Option B", "Option C", "Option D"], "answer": "The correct option", "explanation": "A brief explanation."}`;
    
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });

        console.log("Response received from API, parsing data..."); // Debug 4
        const data = await response.json();
        
        // Check if API returned an error object
        if (data.error) {
            console.error("API Error details:", data.error);
            alert("API Error: " + data.error.message);
            return;
        }

        // Extract and clean up the text: remove markdown code blocks (backticks)
        let rawText = data.candidates[0].content.parts[0].text;
        rawText = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
        
        console.log("Cleaned JSON text:", rawText); // Debug 5
        const result = JSON.parse(rawText);
        
        // Update DOM elements with the quiz data
        document.getElementById('question-text').innerText = result.question;
        document.getElementById('explanation').innerText = ''; // Clear previous explanation
        
        const optionsDiv = document.getElementById('options');
        optionsDiv.innerHTML = '';
        
        result.options.forEach(opt => {
            let btn = document.createElement('button');
            btn.innerText = opt;
            btn.className = "option-btn";
            btn.onclick = () => {
                if (opt === result.answer) {
                    alert("Correct! 🎉");
                } else {
                    alert("Wrong! ❌ The correct answer was: " + result.answer);
                }
                document.getElementById('explanation').innerText = "Explanation: " + result.explanation;
            };
            optionsDiv.appendChild(btn);
        });
        
    } catch (error) {
        console.error("Catch Block Error:", error);
        alert("Failed to process request. Please open your browser console (F12) to check for CORS or network blocking issues.");
    }
}
