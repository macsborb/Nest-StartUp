const API_URL = "https://nest.web-gine.fr/llm/phi";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("message received", message);
    if (message.action === "analyzeEmail") {
        console.log("action pass");

        fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                sender: message.source,
                subject: message.subject,
                body: message.text
            })
        })
        .then(response => response.json())
        .then(data => {
            console.log("Réponse reçue :", data.classification);
            const isFraudulent = data.classification.includes("NONOK");
            sendResponse({ isFraudulent });
        })
        .catch(error => {
            console.error("Erreur API :", error);
            sendResponse({ isFraudulent: false, error: "Erreur API" });
        });

        return true; // 🔥 Important pour indiquer que sendResponse est asynchrone
    }
});
