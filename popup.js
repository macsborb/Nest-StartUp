document.getElementById("checkEmail").addEventListener("click", test)  

async function test() {
    console.log("Bouton cliqué !");
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    console.log("Onglet actif récupéré :", tab);
    
    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: analyzeEmail
    });

}


async function analyzeEmail() {
    let emailText = document.querySelector("div.a3s.aiL")?.innerText;
    let emailSource = document.querySelector("span.go")?.innerText;
    let emailSubject = document.querySelector("h2.hP")?.innerText;

    if (!emailText) {
        console.log("No mail");
        document.getElementById("result").innerText = "Aucun email détecté.";
        return;
    }

    console.log("yes mail, envoi du message au background.js...");

    try {
        let response = await new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(
                { action: "analyzeEmail", text: emailText, source: emailSource, subject: emailSubject },
                (response) => {
                    if (chrome.runtime.lastError) {
                        return reject(chrome.runtime.lastError);
                    }
                    resolve(response);
                }
            );
        });

        console.log("Réponse reçue du background.js :", response);

        if (response?.isFraudulent) {
            alert("Attention fraude potentielle !");
        }
        document.getElementById("result").innerText = response?.isFraudulent ? "⚠️ Email suspect !" : "✅ Email sûr.";
    } catch (error) {
        console.error("Erreur lors de l'analyse de l'email :", error);
        document.getElementById("result").innerText = "❌ Erreur lors de l'analyse.";
    }
}
