// Mode développement/test 
const DEV_MODE = false; // Mettre à false pour la production

// Gestionnaire d'erreurs global
window.onerror = function(message, source, lineno, colno, error) {
  console.error(`Erreur: ${message} à la ligne ${lineno}:${colno}`, error);
  return DEV_MODE; // En mode DEV, éviter les alertes du navigateur
};

// Informations sur l'environnement
const env = {
  isPopup: window.location.pathname.includes('popup.html'),
  isBackground: window.location.pathname.includes('background'),
  isChrome: typeof chrome !== 'undefined',
  isDev: DEV_MODE
};

console.log('Environnement:', env);

// Stockage simulé pour le développement
const mockStorage = {
  _data: {},
  get: function(keys, callback) {
    if (typeof keys === 'string') {
      keys = [keys];
    }
    let result = {};
    keys.forEach(key => {
      result[key] = this._data[key];
    });
    setTimeout(() => callback(result), 0);
  },
  set: function(items, callback) {
    Object.assign(this._data, items);
    if (callback) setTimeout(callback, 0);
  },
  remove: function(keys, callback) {
    if (typeof keys === 'string') {
      keys = [keys];
    }
    keys.forEach(key => {
      delete this._data[key];
    });
    if (callback) setTimeout(callback, 0);
  }
};

// Vérificateurs de disponibilité pour les différentes APIs Chrome
const isAvailable = {
  storage: function() {
    try {
      return typeof chrome !== 'undefined' && 
             chrome.storage !== undefined && 
             chrome.storage.local !== undefined;
    } catch (e) {
      console.warn("L'API chrome.storage n'est pas disponible:", e);
      return false;
    }
  },
  runtime: function() {
    try {
      return typeof chrome !== 'undefined' && 
             chrome.runtime !== undefined;
    } catch (e) {
      console.warn("L'API chrome.runtime n'est pas disponible:", e);
      return false;
    }
  },
  tabs: function() {
    try {
      return typeof chrome !== 'undefined' && 
             chrome.tabs !== undefined;
    } catch (e) {
      console.warn("L'API chrome.tabs n'est pas disponible:", e);
      return false;
    }
  },
  scripting: function() {
    try {
      return typeof chrome !== 'undefined' && 
             chrome.scripting !== undefined;
    } catch (e) {
      console.warn("L'API chrome.scripting n'est pas disponible:", e);
      return false;
    }
  }
};

// Fournit un accès au stockage (réel ou simulé)
const storage = {
  get: function(keys, callback) {
    if (DEV_MODE || !isAvailable.storage()) {
      console.log("Utilisation du stockage simulé (get)");
      mockStorage.get(keys, callback);
    } else {
      console.log("Utilisation du stockage Chrome (get)");
      chrome.storage.local.get(keys, callback);
    }
  },
  set: function(items, callback) {
    if (DEV_MODE || !isAvailable.storage()) {
      console.log("Utilisation du stockage simulé (set)");
      mockStorage.set(items, callback);
    } else {
      console.log("Utilisation du stockage Chrome (set)");
      chrome.storage.local.set(items, callback);
    }
  },
  remove: function(keys, callback) {
    if (DEV_MODE || !isAvailable.storage()) {
      console.log("Utilisation du stockage simulé (remove)");
      mockStorage.remove(keys, callback);
    } else {
      console.log("Utilisation du stockage Chrome (remove)");
      chrome.storage.local.remove(keys, callback);
    }
  }
};

// Mocks pour les API de messagerie et de tabs
const mockRuntime = {
  _listeners: [],
  _lastMessage: null,
  sendMessage: function(message) {
    console.log('Message envoyé en mode DEV:', message);
    this._lastMessage = message;
    // Simuler une réponse pour les tests
    if (message.action === 'analyzeEmail') {
      setTimeout(() => {
        this._listeners.forEach(listener => {
          listener({
            action: 'analysisResult',
            result: { isFraudulent: Math.random() > 0.7 }
          });
        });
      }, 1000);
    }
  },
  onMessage: {
    addListener: function(callback) {
      mockRuntime._listeners.push(callback);
    }
  }
};

const mockTabs = {
  async query() {
    return [{
      id: 1,
      url: 'https://mail.google.com/mail/u/0/#inbox/123456'
    }];
  }
};

const mockScripting = {
  executeScript({ target, function: fn }) {
    console.log('Exécution de script en mode DEV sur tab:', target.tabId);
    // Simuler l'exécution
    fn();
  }
};

// Abstraction pour les API chrome
const chromeAPI = {
  runtime: {
    sendMessage: function(message) {
      if (DEV_MODE || !isAvailable.runtime()) {
        console.log("Utilisation du runtime simulé (sendMessage)");
        mockRuntime.sendMessage(message);
      } else {
        console.log("Utilisation du runtime Chrome (sendMessage)");
        chrome.runtime.sendMessage(message);
      }
    },
    onMessage: {
      addListener: function(callback) {
        if (DEV_MODE || !isAvailable.runtime()) {
          console.log("Utilisation du runtime simulé (addListener)");
          mockRuntime.onMessage.addListener(callback);
        } else {
          console.log("Utilisation du runtime Chrome (addListener)");
          chrome.runtime.onMessage.addListener(callback);
        }
      }
    }
  },
  tabs: {
    async query(queryInfo) {
      if (DEV_MODE || !isAvailable.tabs()) {
        console.log("Utilisation des tabs simulés (query)");
        return await mockTabs.query(queryInfo);
      } else {
        console.log("Utilisation des tabs Chrome (query)");
        return await chrome.tabs.query(queryInfo);
      }
    }
  },
  scripting: {
    executeScript(options) {
      if (DEV_MODE || !isAvailable.scripting()) {
        console.log("Utilisation du scripting simulé (executeScript)");
        mockScripting.executeScript(options);
        // Simuler un résultat en mode DEV
        return Promise.resolve([{
          result: {
            text: "Ceci est un email de test généré en mode développement.",
            source: "test@exemple.com",
            subject: "Email de test"
          }
        }]);
      } else {
        console.log("Utilisation du scripting Chrome (executeScript)");
        return chrome.scripting.executeScript(options);
      }
    }
  }
};

// Exposer notre API pour les contextes de script injectés
if (DEV_MODE) {
  window.chromeAPI = chromeAPI;
}

// Variable partagée pour l'animation des points
let loadingAnimationInterval = null;

// Modification de la fonction d'initialisation
document.addEventListener('DOMContentLoaded', async function() {
  console.log("DOM chargé, initialisation...");
  
  // Pas de vérification du background, on suppose qu'il est disponible
  
  // Continuer avec l'initialisation normale
  // Gestion des onglets (connexion/inscription)
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  
  tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
          const tabName = btn.getAttribute('data-tab');
          
          // Activer le bouton sélectionné
          tabBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          
          // Afficher le contenu correspondant
          tabContents.forEach(content => {
              content.classList.remove('active');
              if (content.id === `${tabName}-form`) {
                  content.classList.add('active');
              }
          });
      });
  });
  
  // Gestion du thème
  initTheme();
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
      themeToggle.addEventListener('click', toggleTheme);
  }
  
  // Gestion de l'authentification
  const loginBtn = document.getElementById('login-btn');
  const signupBtn = document.getElementById('signup-btn');
  const logoutBtn = document.getElementById('logout-btn');
  
  // Vérifier si l'utilisateur est déjà connecté
  checkAuthStatus();
  
  // Événements de connexion et inscription
  if (loginBtn) loginBtn.addEventListener('click', handleLogin);
  if (signupBtn) signupBtn.addEventListener('click', handleSignup);
  if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
  
  // Fonction d'analyse d'email
  const checkEmailBtn = document.getElementById('checkEmail');
  if (checkEmailBtn) checkEmailBtn.addEventListener('click', analyzeCurrentEmail);
  
  // Initialiser l'écouteur de messages
  initMessageListener();
});

// Initialise le thème en fonction des préférences sauvegardées
function initTheme() {
    try {
        // Utiliser notre API de stockage unifiée
        storage.get(['theme'], (result) => {
            const savedTheme = result.theme || 'light';
            applyTheme(savedTheme);
        });
    } catch (error) {
        console.error("Erreur lors de l'initialisation du thème:", error);
        applyTheme('light');
    }
}

// Applique le thème spécifié
function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    updateThemeIcons(theme);
    
    // Sauvegarder le thème
    try {
        storage.set({ theme });
    } catch (error) {
        console.error("Erreur lors de la sauvegarde du thème:", error);
    }
}

// Met à jour les icônes du thème
function updateThemeIcons(theme) {
    const lightIcon = document.getElementById('light-icon');
    const darkIcon = document.getElementById('dark-icon');
    
    if (!lightIcon || !darkIcon) return;
    
    if (theme === 'dark') {
        lightIcon.classList.add('hidden');
        darkIcon.classList.remove('hidden');
    } else {
        lightIcon.classList.remove('hidden');
        darkIcon.classList.add('hidden');
    }
}

// Bascule entre les thèmes clair et sombre
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    applyTheme(newTheme);
}

// Affiche l'écran principal avec les informations utilisateur
function showMainScreen(user) {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('main-screen').classList.remove('hidden');
    
    // Afficher l'email de l'utilisateur
    document.getElementById('user-email').textContent = user.email;
}

// Affiche l'écran d'authentification
function showAuthScreen() {
    document.getElementById('main-screen').classList.add('hidden');
    document.getElementById('auth-screen').classList.remove('hidden');
}

// Vérifie le statut d'authentification et affiche l'écran approprié
function checkAuthStatus() {
    try {
        // Récupérer les informations d'authentification
        storage.get(['user'], (result) => {
            if (result.user) {
                // Utilisateur connecté
                showMainScreen(result.user);
            } else {
                // Utilisateur non connecté
                showAuthScreen();
            }
        });
    } catch (error) {
        console.error("Erreur lors de la vérification de l'authentification:", error);
        showAuthScreen();
    }
}

// Gère la connexion
function handleLogin() {
    try {
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        
        if (!email || !password) {
            showNotification('Veuillez remplir tous les champs', 'error');
            return;
        }
        
        // Afficher un indicateur de chargement
        const loginBtn = document.getElementById('login-btn');
        if (loginBtn) {
            loginBtn.textContent = 'Connexion en cours...';
            loginBtn.disabled = true;
        }
        
        // Envoyer les identifiants au background script pour l'authentification
        console.log("Envoi des données de connexion au background script");
        chromeAPI.runtime.sendMessage({
            action: 'login',
            data: { email, password }
        });
        
        // La réponse sera traitée par l'écouteur de messages dans initMessageListener
    } catch (error) {
        console.error("Erreur lors de la connexion:", error);
        showNotification("Une erreur est survenue lors de la connexion", "error");
        
        // Réinitialiser le bouton
        const loginBtn = document.getElementById('login-btn');
        if (loginBtn) {
            loginBtn.textContent = 'Se connecter';
            loginBtn.disabled = false;
        }
    }
}

// Gère l'inscription
function handleSignup() {
    try {
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        const confirmPassword = document.getElementById('signup-confirm-password').value;
        
        if (!email || !password || !confirmPassword) {
            showNotification('Veuillez remplir tous les champs', 'error');
            return;
        }
        
        if (password !== confirmPassword) {
            showNotification('Les mots de passe ne correspondent pas', 'error');
            return;
        }
        
        // Validation du mot de passe
        if (password.length < 8) {
            showNotification('Le mot de passe doit contenir au moins 8 caractères', 'error');
            return;
        }
        
        // Afficher un indicateur de chargement
        const signupBtn = document.getElementById('signup-btn');
        if (signupBtn) {
            signupBtn.textContent = 'Inscription en cours...';
            signupBtn.disabled = true;
        }
        
        // Envoyer les informations au background script pour l'inscription
        console.log("Envoi des données d'inscription au background script");
        chromeAPI.runtime.sendMessage({
            action: 'register',
            data: { email, password }
        });
        
        // La réponse sera traitée par l'écouteur de messages dans initMessageListener
    } catch (error) {
        console.error("Erreur lors de l'inscription:", error);
        showNotification("Une erreur est survenue lors de l'inscription", "error");
        
        // Réinitialiser le bouton
        const signupBtn = document.getElementById('signup-btn');
        if (signupBtn) {
            signupBtn.textContent = 'S\'inscrire';
            signupBtn.disabled = false;
        }
    }
}

// Gère la déconnexion
function handleLogout() {
    try {
        // Supprimer les informations d'authentification
        storage.remove('user', () => {
            showAuthScreen();
        });
    } catch (error) {
        console.error("Erreur lors de la déconnexion:", error);
        showAuthScreen();
    }
}

// Affiche une notification à l'utilisateur
function showNotification(message, type = 'info') {
    // Cette fonction pourrait être améliorée pour afficher des notifications visuelles
    // Pour l'instant, utilisons une simple alerte
    alert(message);
}

// Analyse l'email actuellement ouvert
async function analyzeCurrentEmail() {
    try {
        console.log("Début de l'analyse d'email...");
        
        // Récupérer l'onglet actif
        let [tab] = await chromeAPI.tabs.query({ active: true, currentWindow: true });
        console.log("Onglet actif récupéré:", tab);
        
        // Vérifier si l'utilisateur est sur Gmail
        if (!tab.url.includes('mail.google.com')) {
            showNotification('Veuillez ouvrir un email Gmail pour l\'analyser', 'warning');
            return;
        }
        
        // Afficher le conteneur de résultat
        document.getElementById('result-container').classList.remove('hidden');
        const resultElement = document.getElementById('result');
        resultElement.textContent = 'Analyse en cours';
        
        // Démarrer l'animation des points
        // Annuler toute animation précédente qui pourrait être en cours
        if (loadingAnimationInterval) {
            clearInterval(loadingAnimationInterval);
        }
        loadingAnimationInterval = startLoadingAnimation(resultElement);
        
        console.log("Exécution du script d'extraction...");
        // 1. Exécuter le script dans l'onglet pour extraire le contenu de l'email
        const results = await chromeAPI.scripting.executeScript({
            target: { tabId: tab.id },
            function: extractEmailContentOnly, // Fonction modifiée qui retourne le contenu sans faire de messaging
            args: [],
            world: "MAIN" // Exécuter dans le contexte de la page pour accéder au DOM
        });
        
        console.log("Résultats d'extraction reçus:", results);
        
        // 2. Vérifier si on a reçu un résultat
        if (!results || !results[0] || !results[0].result) {
            // Arrêter l'animation des points
            if (loadingAnimationInterval) {
                clearInterval(loadingAnimationInterval);
                loadingAnimationInterval = null;
            }
            
            console.error("Pas de résultats valides reçus:", results);
            document.getElementById('result').textContent = 'Erreur: Impossible d\'extraire le contenu de l\'email.';
            return;
        }
        
        const emailData = results[0].result;
        console.log("Données d'email extraites:", emailData);
        
        // 3. Vérifier si le contenu de l'email a été extrait
        if (!emailData.text) {
            // Arrêter l'animation des points
            if (loadingAnimationInterval) {
                clearInterval(loadingAnimationInterval);
                loadingAnimationInterval = null;
            }
            
            console.error("Pas de texte dans l'email extrait");
            document.getElementById('result').textContent = 'Aucun email détecté. Assurez-vous d\'être sur un email ouvert dans Gmail.';
            return;
        }
        
        console.log("Contenu de l'email extrait avec succès:", {
            textLength: emailData.text.length,
            source: emailData.source,
            subject: emailData.subject
        });
        
        // 4. Envoyer directement les données au background script depuis le popup
        console.log("Envoi des données au background script pour analyse...");
        chrome.runtime.sendMessage({
            action: 'analyzeEmail',
            data: {
                text: emailData.text,
                source: emailData.source,
                subject: emailData.subject
            }
        });
        
        console.log("Données envoyées au background script, en attente de réponse...");
        
        // Remarque: l'animation continue jusqu'à ce que le résultat soit reçu
        // L'arrêt de l'animation se fait dans le gestionnaire de message 'analysisResult'
        
    } catch (error) {
        // Arrêter l'animation des points en cas d'erreur
        if (loadingAnimationInterval) {
            clearInterval(loadingAnimationInterval);
            loadingAnimationInterval = null;
        }
        
        console.error('Erreur lors de l\'analyse :', error);
        document.getElementById('result').textContent = 'Une erreur est survenue pendant l\'analyse: ' + error.message;
    }
}

// Fonction pour démarrer l'animation des points de chargement
function startLoadingAnimation(element) {
    let dots = 0;
    const baseText = element.textContent.replace(/\.+$/, '');
    
    return setInterval(() => {
        dots = (dots + 1) % 4;
        const dotsText = '.'.repeat(dots);
        element.textContent = baseText + dotsText;
    }, 500);
}

// Fonction modifiée qui extrait seulement le contenu sans envoyer de message
function extractEmailContentOnly() {
    console.log("Extraction du contenu de l'email dans Gmail...");
    
    let emailText, emailSource, emailSubject;
    
    try {
        // Tenter d'extraire le contenu de l'email par différentes méthodes
        // 1. Sélecteur standard pour le contenu de l'email
        const emailContainer = document.querySelector('div.a3s.aiL');
        
        // 2. Sélecteur alternatif pour le contenu
        const altContainer = document.querySelector('.message-part');
        
        // 3. Rechercher tous les éléments qui pourraient contenir du texte d'email
        const possibleContainers = document.querySelectorAll('.message-part, .ii.gt, div.a3s.aiL, .msg');
        
        if (emailContainer) {
            console.log("Conteneur d'email trouvé (méthode standard)");
            emailText = emailContainer.innerText;
        } else if (altContainer) {
            console.log("Conteneur d'email trouvé (méthode alternative)");
            emailText = altContainer.innerText;
        } else if (possibleContainers.length > 0) {
            console.log("Conteneur d'email trouvé (méthode de recherche générale)");
            // Prendre le container avec le plus de texte
            let maxLength = 0;
            possibleContainers.forEach(container => {
                if (container.innerText && container.innerText.length > maxLength) {
                    maxLength = container.innerText.length;
                    emailText = container.innerText;
                }
            });
        }
        
        // Essayer différentes façons de trouver l'expéditeur
        const sourceElement = document.querySelector('span.go, .gD, .email');
        emailSource = sourceElement?.innerText;
        
        if (!emailSource) {
            // Chercher dans les en-têtes d'email
            const headers = document.querySelectorAll('div.adn, .hI');
            headers.forEach(header => {
                const text = header.innerText;
                if (text && text.includes('@')) {
                    emailSource = text.split('\n')[0];
                }
            });
        }
        
        // Essayer différentes façons de trouver le sujet
        const subjectElement = document.querySelector('h2.hP, .ha, .message-subject');
        emailSubject = subjectElement?.innerText;
        
        if (!emailSubject) {
            // Chercher dans le titre de la page
            const title = document.title;
            if (title && !title.startsWith('Gmail')) {
                emailSubject = title.replace(' - Gmail', '');
            }
        }
        
        // Dernière tentative: récupérer tout le texte de la page si nécessaire
        if (!emailText && document.body) {
            console.log("Aucun conteneur spécifique trouvé, extraction du contenu complet de la page");
            emailText = document.body.innerText;
        }
        
        // Statistiques d'extraction
        console.log("Résultats de l'extraction:", {
            textFound: !!emailText,
            textLength: emailText ? emailText.length : 0,
            sourceFound: !!emailSource,
            subjectFound: !!emailSubject
        });
    } catch (e) {
        console.error("Erreur lors de l'extraction:", e);
    }
    
    // Créer des données de test uniquement si nécessaire
    if (!emailText) {
        console.log("Email non trouvé, utilisation de données de test");
        emailText = "Ceci est un email de test généré pour l'analyse.";
        emailSource = emailSource || "test@exemple.com";
        emailSubject = emailSubject || "Email de test pour analyse";
    }
    
    // Retourner les données
    return {
        text: emailText,
        source: emailSource,
        subject: emailSubject
    };
}

// Initialisation de l'écouteur de messages
function initMessageListener() {
    chromeAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
        console.log("Message reçu dans popup:", message);
        
        // Réponse d'analyse d'email
        if (message.action === 'analysisResult') {
            const resultElement = document.getElementById('result');
            if (!resultElement) {
                console.error("Élément de résultat non trouvé");
                return;
            }
            
            // Arrêter l'animation des points si elle est en cours
            if (loadingAnimationInterval) {
                clearInterval(loadingAnimationInterval);
                loadingAnimationInterval = null;
            }
            
            const result = message.result;
            console.log("Traitement du résultat d'analyse:", result);
            
            if (result.error) {
                resultElement.textContent = result.error;
                resultElement.className = 'result-text result-warning';
                return;
            }
            
            if (result.isFraudulent) {
                resultElement.textContent = '⚠️ Email suspect ! Cet email présente des caractéristiques de fraude.';
                resultElement.className = 'result-text result-danger';
            } else {
                resultElement.textContent = '✅ Email sûr. Aucune menace détectée.';
                resultElement.className = 'result-text result-safe';
            }
            
            // Ajouter des détails supplémentaires si disponibles
            // if (result.score !== undefined) {
            //     const scoreInfo = document.createElement('div');
            //     scoreInfo.className = 'score-info';
            //     scoreInfo.textContent = `Score: ${result.score}`;
            //     resultElement.appendChild(scoreInfo);
            // }
            
            // Marquer l'analyse comme terminée
            document.getElementById('result-container').dataset.status = 'completed';
        }
        
        // Réponse de connexion
        else if (message.action === 'loginResult') {
            const loginBtn = document.getElementById('login-btn');
            if (loginBtn) {
                loginBtn.textContent = 'Se connecter';
                loginBtn.disabled = false;
            }
            
            if (message.success) {
                // Stockage des informations utilisateur
                storage.set({ user: message.user }, () => {
                    showMainScreen(message.user);
                });
            } else {
                showNotification(message.error || 'Échec de connexion', 'error');
            }
        }
        
        // Réponse d'inscription
        else if (message.action === 'registerResult') {
            const signupBtn = document.getElementById('signup-btn');
            if (signupBtn) {
                signupBtn.textContent = 'S\'inscrire';
                signupBtn.disabled = false;
            }
            
            if (message.success) {
                // Stockage des informations utilisateur
                storage.set({ user: message.user }, () => {
                    showMainScreen(message.user);
                });
            } else {
                showNotification(message.error || 'Échec d\'inscription', 'error');
            }
        }
        
        // Réponse de déconnexion
        else if (message.action === 'logoutResult') {
            const logoutBtn = document.getElementById('logout-btn');
            if (logoutBtn) {
                logoutBtn.textContent = 'Déconnexion';
                logoutBtn.disabled = false;
            }
            
            if (message.success) {
                storage.remove('user', () => {
                    showAuthScreen();
                });
            }
        }
    });
}
