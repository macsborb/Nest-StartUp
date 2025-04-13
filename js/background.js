const API_URL = "https://nest.web-gine.fr";


// Vérifier l'environnement de l'extension
let isExtensionEnvironment = false;
try {
  isExtensionEnvironment = typeof chrome !== 'undefined' && 
                          typeof chrome.runtime !== 'undefined' && 
                          typeof chrome.runtime.onMessage !== 'undefined';
  console.log("Environnement d'extension détecté:", isExtensionEnvironment);
} catch (e) {
  console.error("Erreur lors de la vérification de l'environnement:", e);
}

// Fonction pour récupérer le token d'authentification
function getAuthToken() {
  return new Promise((resolve, reject) => {
    console.log("Tentative de récupération du token d'authentification...");
    
    if (!isExtensionEnvironment) {
      console.error("Non exécuté dans un environnement d'extension Chrome");
      reject(new Error("Non exécuté dans un environnement d'extension Chrome"));
      return;
    }
    
    try {
      chrome.storage.local.get(['auth_token', 'user'], (result) => {
        console.log("Résultat de la récupération du storage:", { 
          hasToken: !!result.auth_token,
          tokenLength: result.auth_token ? result.auth_token.length : 0,
          hasUser: !!result.user,
          userEmail: result.user ? result.user.email : null
        });
        
        if (result && result.auth_token) {
          // Vérifier le format du token (JWT ou autre)
          const tokenFormat = result.auth_token.startsWith('ey') ? 'JWT' : 'Autre';
          console.log(`Token trouvé (format: ${tokenFormat}):`, 
                      result.auth_token.substring(0, 10) + "..." + 
                      (result.auth_token.length > 30 ? result.auth_token.substring(result.auth_token.length - 10) : ""));
          
          resolve(result.auth_token);
        } else {
          console.error("Aucun token d'authentification trouvé dans le stockage");
          if (result && result.user) {
            console.warn("Utilisateur trouvé mais pas de token. Problème de stockage probable.");
          }
          reject(new Error("Aucun token d'authentification trouvé"));
        }
      });
    } catch (e) {
      console.error("Erreur lors de l'accès au stockage:", e);
      reject(e);
    }
  });
}

// Fonction pour marquer les liens frauduleux
function markFraudulentLink(linkElement) {
    linkElement.style.border = "2px solid red";
    linkElement.title = "Ce lien est potentiellement frauduleux";
}

// Fonction pour marquer les liens sûrs
function markSafeLink(linkElement) {
    linkElement.style.border = "2px solid green";
    linkElement.title = "Ce lien est sûr";
}

// Fonction pour vérifier les liens sur la page via l'API Web Risk Lookup en GET
async function checkLinks() {
    try {
        console.log("Vérification des liens sur la page...");
        // Récupération uniquement des liens présents dans le conteneur Gmail
        const links = document.querySelectorAll("div.a3s.aiL a[href], div.a3s.aiL iframe[src], div.a3s.aiL form[action]");
        const urlsToCheck = Array.from(links).map(link => {
            if (link.tagName === "A") return link.href;
            if (link.tagName === "IFRAME") return link.src;
            if (link.tagName === "FORM") return link.action;
        }).filter(url => url);

        if (urlsToCheck.length === 0) {
            return { totalLinks: 0, fraudulentUrls: [] };
        }

        console.log(`${urlsToCheck.length} liens trouvés à vérifier`);

        // Pour chaque URL, envoyer une requête GET avec threatTypes=MALWARE
        const checkResults = await Promise.all(
            urlsToCheck.map(async (url) => {
                const queryUrl = `https://webrisk.googleapis.com/v1/uris:search?threatTypes=MALWARE&threatTypes=SOCIAL_ENGINEERING&threatTypes=UNWANTED_SOFTWARE&uri=${encodeURIComponent(url)}&key=AIzaSyAP3iAXqYFcRGrZbwF1EGxH8HTxw_Rjkpk`;
                try {
                    const response = await fetch(queryUrl);
                    let data = {};
                    if (response.ok) {
                        data = await response.json();
                    }
                    if (data && data.threat) {
                        console.log(`Menace détectée pour ${url}:`, data.threat);
                        return { url, threat: data.threat };
                    } else {
                        console.log(`Aucune détectée pour ${queryUrl}`);
                        return { url, threat: null };
                    }
                } catch (error) {
                    console.error(`Erreur lors de la vérification de ${url}:`, error);
                    return { url, threat: null, error: error.message };
                }
            })
        );

        const fraudulentUrls = checkResults.filter(result => result.threat !== null).map(result => result.url);

        // Marquer les liens dans le DOM
        links.forEach(link => {
            let urlToCheck = "";
            if (link.tagName === "A") urlToCheck = link.href;
            if (link.tagName === "IFRAME") urlToCheck = link.src;
            if (link.tagName === "FORM") urlToCheck = link.action; 

            if (fraudulentUrls.some(fraudUrl => urlToCheck.includes(fraudUrl))) {
                markFraudulentLink(link);
            } else {
                markSafeLink(link);
            }
        });

        return { totalLinks: urlsToCheck.length, fraudulentUrls: fraudulentUrls };
    } catch (error) {
        console.error("Erreur lors de la vérification des liens:", error);
        throw error;
    }
}

// Vérifie les liens dès que le script est exécuté
async function checkCurrentLinks() {
    try {
        console.log("Début de la vérification des liens...");
        let [tab] = await chromeAPI.tabs.query({ active: true, currentWindow: true });
        console.log("Onglet actif récupéré:", tab);
        
        if (!tab.url.includes('mail.google.com')) {
            showNotification('Veuillez ouvrir un email Gmail pour vérifier les liens', 'warning');
            return;
        }
        
        document.getElementById('result-container').classList.remove('hidden');
        const resultElement = document.getElementById('result');
        resultElement.textContent = 'Vérification des liens en cours';
        if (loadingAnimationInterval) clearInterval(loadingAnimationInterval);
        loadingAnimationInterval = startLoadingAnimation(resultElement);
        
        console.log("Envoi de la demande de vérification des liens...");
        chrome.runtime.sendMessage({ action: 'checkLinks', data: { tabId: tab.id } });
    } catch (error) {
        console.error('Erreur lors de la vérification des liens :', error);
        const resultElement = document.getElementById('result');
        resultElement.textContent = 'Une erreur est survenue lors de la vérification des liens';
        resultElement.className = 'result-text result-warning';
        if (loadingAnimationInterval) {
            clearInterval(loadingAnimationInterval);
            loadingAnimationInterval = null;
        }
    }
}

// Écouteur de messages - uniquement si l'environnement le permet
if (isExtensionEnvironment) {
  try {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log("Message reçu :", message);
      
      // Traitement des messages d'authentification (login)
      if (message.action === "login") {
        console.log("Tentative de connexion avec:", message.data);
        console.log("URL complète pour la connexion:", `${API_URL}/auth/login`);
        const formData = new URLSearchParams();
        formData.append('username', message.data.email);
        formData.append('password', message.data.password);
        console.log("FormData envoyé:", formData.toString());
        
        fetch(`${API_URL}/auth/login`, {
          method: "POST",
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formData
        })
        .then(response => {
          console.log("Réponse de connexion (status):", response.status);
          console.log("Réponse de connexion (headers):", [...response.headers.entries()]);
          if (!response.ok) {
            return response.json().then(errorData => {
              console.error("Erreur de connexion (données):", errorData);
              throw new Error(errorData.detail || `Erreur de connexion: ${response.status}`);
            }).catch(() => { throw new Error(`Erreur de connexion: ${response.status}`); });
          }
          return response.json();
        })
        .then(data => {
          console.log("Réponse de connexion (données):", data);
          if (data.access_token) {
            console.log("Token reçu du serveur:", {
              tokenLength: data.access_token.length,
              tokenStart: data.access_token.substring(0, 10) + "...",
              tokenEnd: data.access_token.length > 30 ? "..." + data.access_token.substring(data.access_token.length - 10) : "",
              isJwtFormat: data.access_token.startsWith('ey')
            });
            
            chrome.storage.local.set({
              auth_token: data.access_token,
              user: { email: data.user.email }
            }, () => {
              console.log("Token et informations utilisateur sauvegardés dans le stockage");
              chrome.storage.local.get(['auth_token'], result => {
                if (result.auth_token === data.access_token) {
                  console.log("Vérification: Token correctement sauvegardé");
                } else {
                  console.error("Problème de stockage: Le token sauvegardé ne correspond pas");
                }
              });
              chrome.runtime.sendMessage({
                action: 'loginResult',
                success: true,
                user: { email: data.user.email }
              });
            });
          } else {
            console.error("Pas de token dans la réponse:", data);
            chrome.runtime.sendMessage({
              action: 'loginResult',
              success: false,
              error: data.detail || "Échec de connexion: Pas de token reçu"
            });
          }
        })
        .catch(error => {
          console.error("Erreur lors de la connexion:", error);
          chrome.runtime.sendMessage({
            action: 'loginResult',
            success: false,
            error: error.message || "Erreur de connexion au serveur"
          });
        });
        return true;
      }
      
      // Traitement des messages d'inscription (register)
      else if (message.action === "register") {
        console.log("Tentative d'inscription avec:", message.data);
        console.log("URL complète pour l'inscription:", `${API_URL}/auth/register`);
        fetch(`${API_URL}/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: message.data.email, password: message.data.password })
        })
        .then(response => {
          console.log("Réponse d'inscription (status):", response.status);
          console.log("Réponse d'inscription (headers):", [...response.headers.entries()]);
          if (!response.ok) {
            return response.json().then(errorData => {
              console.error("Erreur d'inscription (données):", errorData);
              throw new Error(errorData.detail || `Erreur d'inscription: ${response.status}`);
            }).catch(jsonError => {
              console.error("Erreur de parsing JSON:", jsonError);
              throw new Error(`Erreur d'inscription: ${response.status}`);
            });
          }
          return response.json();
        })
        .then(data => {
          console.log("Réponse d'inscription (données):", data);
          if (data.access_token) {
            chrome.storage.local.set({
              auth_token: data.access_token,
              user: { email: data.user.email }
            }, () => {
              chrome.runtime.sendMessage({
                action: 'registerResult',
                success: true,
                user: { email: data.user.email }
              });
            });
          } else {
            console.error("Pas de token dans la réponse:", data);
            chrome.runtime.sendMessage({
              action: 'registerResult',
              success: false,
              error: data.detail || "Échec d'inscription: Pas de token reçu"
            });
          }
        })
        .catch(error => {
          console.error("Erreur lors de l'inscription:", error);
          chrome.runtime.sendMessage({
            action: 'registerResult',
            success: false,
            error: error.message || "Erreur de connexion au serveur"
          });
        });
        return true;
      }
      
      // Traitement des messages d'analyse d'email
      else if (message.action === "analyzeEmail") {
        const { text, source, subject } = message.data || message;
        console.log("Analyse d'email demandée", { 
          textLength: text ? text.length : 0,
          textSample: text ? text.substring(0, 50) + "..." : "VIDE",
          source: source || "Non spécifié", 
          subject: subject || "Non spécifié"
        });
        if (!text || text.trim().length === 0) {
          console.error("Aucun texte à analyser");
          chrome.runtime.sendMessage({
            action: 'analysisResult',
            result: { error: "Aucun contenu d'email à analyser" }
          });
          return true;
        }
        console.log(`Analyse d'email:
Expéditeur: ${source || "Non spécifié"}
Objet: ${subject || "Non spécifié"}
Corps de l'email (début): ${text.substring(0, 100)}...`);
        getAuthToken()
          .then(token => {
            console.log("Token récupéré avec succès:", token.substring(0, 10) + "...");
            const payload = { sender: source || "Non spécifié", subject: subject || "Non spécifié", body: text };
            console.log("Payload pour l'API:", payload);
            console.log("URL complète pour l'analyse:", `${API_URL}/llm/phi`);
            return fetch(`${API_URL}/llm/phi`, {
              method: "POST",
              headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
              },
              body: JSON.stringify(payload)
            });
          })
          .then(response => {
            console.log("Réponse brute de l'API d'analyse:", response.status, response.statusText);
            if (!response.ok) {
              if (response.status === 401) {
                console.error("Erreur 401: Token invalide ou expiré");
                throw new Error("Session expirée, veuillez vous reconnecter");
              } else {
                throw new Error(`Erreur API: ${response.status}`);
              }
            }
            return response.json();
          })
          .then(data => {
            console.log("Réponse d'analyse complète:", data);
            const isFraudulent = data.classification && data.classification.includes("NONOK");
            const score = data.rate || 0;
            console.log(`Résultat d'analyse:
Classification: ${data.classification || "N/A"}
Frauduleux: ${isFraudulent ? "OUI" : "NON"}
Score: ${score}`);
            chrome.runtime.sendMessage({
              action: 'analysisResult',
              result: { isFraudulent, score, details: data }
            });
          })
          .catch(error => {
            console.error("Erreur lors de l'analyse:", error);
            console.log(`Erreur lors de l'analyse: ${error.message}`);
            chrome.runtime.sendMessage({
              action: 'analysisResult',
              result: { error: error.message || "Une erreur est survenue" }
            });
          });
        return true;
      }
      
      // Traitement de la déconnexion
      else if (message.action === "logout") {
        console.log("Déconnexion demandée");
        chrome.storage.local.remove(['auth_token', 'user'], () => {
          chrome.runtime.sendMessage({ action: 'logoutResult', success: true });
        });
        return true;
      }
      
      // Traitement de la vérification des liens
      else if (message.action === "checkLinks") {
        console.log("Demande de vérification des liens reçue");
        chrome.scripting.executeScript({
            target: { tabId: message.data.tabId },
            func: () => {
                // window.API_ENDPOINT = "https://webrisk.googleapis.com/v1/uris:search?key=AIzaSyAP3iAXqYFcRGrZbwF1EGxH8HTxw_Rjkpk";
                window.markFraudulentLink = (linkElement) => {
                    linkElement.style.border = "2px solid red";
                    linkElement.title = "Ce lien est potentiellement frauduleux";
                };
                window.markSafeLink = (linkElement) => {
                    linkElement.style.border = "2px solid green";
                    linkElement.title = "Ce lien est sûr";
                };
            }
        })
        .then(() => {
            return chrome.scripting.executeScript({
                target: { tabId: message.data.tabId },
                func: async () => {
                    try {
                        console.log("Vérification des liens sur la page...");
                        const links = document.querySelectorAll("div.a3s.aiL a[href], div.a3s.aiL iframe[src], div.a3s.aiL form[action]");
                        const urlsToCheck = Array.from(links).map(link => {
                            if (link.tagName === "A") return link.href;
                            if (link.tagName === "IFRAME") return link.src;
                            if (link.tagName === "FORM") return link.action;
                        }).filter(url => url);
                        if (urlsToCheck.length === 0) {
                            return { totalLinks: 0, fraudulentUrls: [] };
                        }
                        console.log(`${urlsToCheck.length} liens trouvés à vérifier`);
                        // Ici, on force à n'utiliser qu'un seul threatType : MALWARE
                        const checkResults = await Promise.all(
                            urlsToCheck.map(async (url) => {
                                const queryUrl = `https://webrisk.googleapis.com/v1/uris:search?threatTypes=MALWARE&threatTypes=SOCIAL_ENGINEERING&threatTypes=UNWANTED_SOFTWARE&uri=${encodeURIComponent(url)}&key=AIzaSyAP3iAXqYFcRGrZbwF1EGxH8HTxw_Rjkpk`;
                                try {
                                    const response = await fetch(queryUrl);
                                    let data = {};
                                    if (response.ok) { data = await response.json(); }
                                    if (data && data.threat) {
                                        console.log(`Menace détectée pour ${url}:`, data.threat);
                                        return { url, threat: data.threat };
                                    } else {
                                        console.log(`Aucune détectée pour ${queryUrl}`);
                                        return { url, threat: null };
                                    }
                                } catch (error) {
                                    console.error(`Erreur lors de la vérification de ${url}:`, error);
                                    return { url, threat: null, error: error.message };
                                }
                            })
                        );
                        const fraudulentUrls = checkResults.filter(result => result.threat !== null).map(result => result.url);
                        links.forEach(link => {
                            let urlToCheck = "";
                            if (link.tagName === "A") urlToCheck = link.href;
                            if (link.tagName === "IFRAME") urlToCheck = link.src;
                            if (link.tagName === "FORM") urlToCheck = link.action;
                            if (fraudulentUrls.some(fraudUrl => urlToCheck.includes(fraudUrl))) {
                                window.markFraudulentLink(link);
                            } else {
                                window.markSafeLink(link);
                            }
                        });
                        return { totalLinks: urlsToCheck.length, fraudulentUrls: fraudulentUrls };
                    } catch (error) {
                        console.error("Erreur lors de la vérification des liens:", error);
                        throw error;
                    }
                }
            });
        })
        .then(results => {
            console.log("Résultats de la vérification des liens:", results);
            if (results && results[0] && results[0].result) {
                chrome.runtime.sendMessage({ action: 'linksCheckResult', result: results[0].result });
            } else {
                throw new Error("Résultats de vérification invalides");
            }
        })
        .catch(error => {
            console.error("Erreur lors de la vérification des liens:", error);
            chrome.runtime.sendMessage({
                action: 'linksCheckResult',
                error: error.message || "Une erreur est survenue lors de la vérification"
            });
        });
        return true;
      }
    });
  } catch (e) {
    console.error("Erreur lors de la configuration de l'écouteur de messages:", e);
  }
}

// Initialisation terminée - juste un log, pas de message qui pourrait échouer
console.log("Script background initialisé avec succès");
