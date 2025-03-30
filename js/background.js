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
          // Vérifier si le token semble être au format JWT ou non
          const tokenFormat = result.auth_token.startsWith('ey') ? 'JWT' : 'Autre';
          console.log(`Token trouvé (format: ${tokenFormat}):`, 
                      result.auth_token.substring(0, 10) + "..." + 
                      (result.auth_token.length > 30 ? result.auth_token.substring(result.auth_token.length - 10) : ""));
          
          resolve(result.auth_token);
        } else {
          console.error("Aucun token d'authentification trouvé dans le stockage");
          
          // Si l'utilisateur est défini mais pas le token, c'est probablement un problème de stockage
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

// Écouteur de messages - uniquement si l'environnement le permet
if (isExtensionEnvironment) {
  try {
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log("Message reçu :", message);
      
      // Le gestionnaire de ping a été supprimé car il n'est plus nécessaire
      
      // Traitement des messages d'authentification
      if (message.action === "login") {
        console.log("Tentative de connexion avec:", message.data);
        console.log("URL complète pour la connexion:", `${API_URL}/auth/login`);
        
        // FormData pour la requête OAuth2
        const formData = new URLSearchParams();
        formData.append('username', message.data.email);  // OAuth2 utilise username
        formData.append('password', message.data.password);
        console.log("FormData envoyé:", formData.toString());
        
        fetch(`${API_URL}/auth/login`, {
          method: "POST",
          headers: { 
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: formData
        })
        .then(response => {
          console.log("Réponse de connexion (status):", response.status);
          console.log("Réponse de connexion (headers):", [...response.headers.entries()]);
          
          if (!response.ok) {
            return response.json().then(errorData => {
              console.error("Erreur de connexion (données):", errorData);
              throw new Error(errorData.detail || `Erreur de connexion: ${response.status}`);
            }).catch(jsonError => {
              // Si on ne peut pas parser la réponse JSON
              throw new Error(`Erreur de connexion: ${response.status}`);
            });
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
            
            // Sauvegarder le token pour futures requêtes
            chrome.storage.local.set({
              auth_token: data.access_token,
              user: { email: data.user.email }
            }, () => {
              console.log("Token et informations utilisateur sauvegardés dans le stockage");
              
              // Vérifier immédiatement que le token a été correctement stocké
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
            // Échec de connexion
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
        
        return true; // Indique que la réponse sera asynchrone
      }
      
      // Traitement des messages d'inscription
      else if (message.action === "register") {
        console.log("Tentative d'inscription avec:", message.data);
        console.log("URL complète pour l'inscription:", `${API_URL}/auth/register`);
        
        fetch(`${API_URL}/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
            email: message.data.email,
            password: message.data.password
          })
        })
        .then(response => {
          console.log("Réponse d'inscription (status):", response.status);
          console.log("Réponse d'inscription (headers):", [...response.headers.entries()]);
          
          // Vérifier si la réponse est OK, sinon extraire l'erreur
          if (!response.ok) {
            return response.json().then(errorData => {
              console.error("Erreur d'inscription (données):", errorData);
              throw new Error(errorData.detail || `Erreur d'inscription: ${response.status}`);
            }).catch(jsonError => {
              // Si on ne peut pas parser la réponse JSON
              console.error("Erreur de parsing JSON:", jsonError);
              throw new Error(`Erreur d'inscription: ${response.status}`);
            });
          }
          return response.json();
        })
        .then(data => {
          console.log("Réponse d'inscription (données):", data);
          
          if (data.access_token) {
            // Sauvegarder le token pour futures requêtes
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
            // Échec d'inscription
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
        
        return true; // Indique que la réponse sera asynchrone
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
        
        // Vérifier que nous avons un texte à analyser
        if (!text || text.trim().length === 0) {
          console.error("Aucun texte à analyser");
          chrome.runtime.sendMessage({
            action: 'analysisResult',
            result: { error: "Aucun contenu d'email à analyser" }
          });
          return true;
        }
        
        // Alerte pour afficher les paramètres de la requête
        console.log(`Analyse d'email:
Expéditeur: ${source || "Non spécifié"}
Objet: ${subject || "Non spécifié"}
Corps de l'email (début): ${text.substring(0, 100)}...`);
        
        // Récupérer le token d'authentification
        getAuthToken()
          .then(token => {
            console.log("Token récupéré avec succès:", token.substring(0, 10) + "...");
            
            // Construire la payload pour l'API - IDENTIQUE au format qui fonctionne
            const payload = {
              sender: source || "Non spécifié",
              subject: subject || "Non spécifié",
              body: text
            };
            
            console.log("Payload pour l'API:", payload);
            console.log("URL complète pour l'analyse:", `${API_URL}/llm/phi`);
            
            // ===== CODE EXACT COMME LE TEST QUI FONCTIONNE =====
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
            
            // Simplification: récupérer directement le JSON
            return response.json();
          })
          .then(data => {
            console.log("Réponse d'analyse complète:", data);
            
            // Traitement simplifié - format standard
            const isFraudulent = data.classification && data.classification.includes("NONOK");
            const score = data.rate || 0;
            
            // Afficher une alerte avec le résultat
            console.log(`Résultat d'analyse:
Classification: ${data.classification || "N/A"}
Frauduleux: ${isFraudulent ? "OUI" : "NON"}
Score: ${score}`);
            
            // Envoyer le résultat à l'interface
            chrome.runtime.sendMessage({
              action: 'analysisResult',
              result: {
                isFraudulent,
                score,
                details: data
              }
            });
          })
          .catch(error => {
            console.error("Erreur lors de l'analyse:", error);
            
            // Afficher une alerte avec l'erreur
            console.log(`Erreur lors de l'analyse: ${error.message}`);
            
            // Envoyer l'erreur à l'interface
            chrome.runtime.sendMessage({
              action: 'analysisResult',
              result: { error: error.message || "Une erreur est survenue" }
            });
          });
        
        return true; // Indique que la réponse sera asynchrone
      }
      
      // Traitement de la déconnexion
      else if (message.action === "logout") {
        console.log("Déconnexion demandée");
        
        chrome.storage.local.remove(['auth_token', 'user'], () => {
          chrome.runtime.sendMessage({
            action: 'logoutResult',
            success: true
          });
        });
        
        return true; // Indique que la réponse sera asynchrone
      }
      
      // Le gestionnaire de checkAuth a été supprimé car il n'est plus nécessaire
    });
  } catch (e) {
    console.error("Erreur lors de la configuration de l'écouteur de messages:", e);
  }
}

// Initialisation terminée - juste un log, pas de message qui pourrait échouer
console.log("Script background initialisé avec succès");
