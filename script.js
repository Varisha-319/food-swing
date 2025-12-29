// API Configuration
const API_BASE_URL = 'http://localhost:5000/api'; // Change this to your production URL

// Authentication token management
let authToken = localStorage.getItem('foodswing_token');
let currentUser = null;

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    // Check if user is logged in
    if (authToken) {
        await verifyToken();
    }
    
    // Start emoji rain animation
    createEmojiRain();
    
    // Initialize Dark Mode
    initializeDarkMode();
});

// ============= DARK MODE =============

function initializeDarkMode() {
    // Load dark mode preference
    const isDark = localStorage.getItem('darkMode') === 'true';
    if (isDark) {
        document.body.classList.add('dark-mode');
    }
    
    // Create dark mode toggle button
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'dark-mode-toggle';
    toggleBtn.textContent = isDark ? '☀️' : '🌙';
    toggleBtn.onclick = toggleDarkMode;
    toggleBtn.setAttribute('aria-label', 'Toggle dark mode');
    toggleBtn.title = 'Toggle Dark Mode';
    document.body.appendChild(toggleBtn);
}

function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    
    // Save preference to localStorage
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('darkMode', isDark);
    
    // Update toggle button icon
    const toggleBtn = document.querySelector('.dark-mode-toggle');
    toggleBtn.textContent = isDark ? '☀️' : '🌙';
    
    // Show toast notification
    showToast(isDark ? '🌙 Dark mode enabled' : '☀️ Light mode enabled', 'success');
}

// ============= API HELPER FUNCTIONS =============

async function apiRequest(endpoint, options = {}) {
    try {
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        // Add auth token if available
        if (authToken) {
            headers['Authorization'] = `Bearer ${authToken}`;
        }

        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Something went wrong');
        }

        return data;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// ============= AUTHENTICATION =============

async function verifyToken() {
    try {
        const response = await apiRequest('/auth/verify');
        if (response.success) {
            currentUser = response.user;
            updateUIForLoggedInUser();
            return true;
        }
    } catch (error) {
        // Token invalid or expired
        localStorage.removeItem('foodswing_token');
        authToken = null;
        currentUser = null;
        return false;
    }
}

function switchAuth(type) {
    const loginTab = document.getElementById('loginTab');
    const signupTab = document.getElementById('signupTab');
    const nameField = document.getElementById('nameField');
    const authBtnText = document.getElementById('authBtnText');

    if (type === 'login') {
        loginTab.classList.add('active');
        signupTab.classList.remove('active');
        nameField.style.display = 'none';
        authBtnText.textContent = 'Login';
    } else {
        signupTab.classList.add('active');
        loginTab.classList.remove('active');
        nameField.style.display = 'block';
        authBtnText.textContent = 'Sign Up';
    }
}

async function handleAuth() {
    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value.trim();
    const name = document.getElementById('authName').value.trim();
    const isSignup = document.getElementById('signupTab').classList.contains('active');

    // Validation
    if (!email || !password) {
        showToast('Please fill in all fields! 📝', 'error');
        return;
    }

    if (isSignup && !name) {
        showToast('Please enter your name! 👤', 'error');
        return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showToast('Please enter a valid email! 📧', 'error');
        return;
    }

    // Password validation
    if (password.length < 6) {
        showToast('Password must be at least 6 characters! 🔒', 'error');
        return;
    }

    try {
        const endpoint = isSignup ? '/auth/signup' : '/auth/login';
        const body = isSignup ? { name, email, password } : { email, password };

        const response = await apiRequest(endpoint, {
            method: 'POST',
            body: JSON.stringify(body)
        });

        if (response.success) {
            // Store token
            authToken = response.token;
            localStorage.setItem('foodswing_token', authToken);
            currentUser = response.user;

            // Show success message
            showToast(response.message, 'success');

            // Update UI
            updateUIForLoggedInUser();

            // Navigate to home
            setTimeout(() => {
                showPage('home');
            }, 1000);
        }
    } catch (error) {
        showToast(error.message || 'Authentication failed! 😕', 'error');
    }
}

function updateUIForLoggedInUser() {
    // Hide landing page, show navbar
    document.getElementById('landingPage').style.display = 'none';
    document.getElementById('mainNavbar').style.display = 'block';
    
    // Update user button
    const userBtn = document.getElementById('userBtn');
    if (currentUser) {
        userBtn.textContent = `Logout (${currentUser.name})`;
    }
}

function logoutUser() {
    // Clear auth data
    localStorage.removeItem('foodswing_token');
    authToken = null;
    currentUser = null;

    // Show landing page
    document.getElementById('mainNavbar').style.display = 'none';
    document.getElementById('landingPage').style.display = 'block';
    document.getElementById('landingPage').classList.add('active');
    
    // Hide all other pages
    document.querySelectorAll('.page').forEach(page => {
        if (page.id !== 'landingPage') {
            page.classList.remove('active');
        }
    });

    showToast('Logged out successfully! 👋', 'success');
}

// ============= MOOD SELECTION =============

async function selectMood(mood) {
    if (!currentUser) {
        showToast('Please login first! 🔒', 'error');
        return;
    }

    // Track mood selection in backend
    try {
        await apiRequest('/mood/select', {
            method: 'POST',
            body: JSON.stringify({ mood })
        });
    } catch (error) {
        console.error('Failed to track mood:', error);
        // Don't block the user experience if tracking fails
    }

    // Show food suggestions
    displayFoodSuggestions(mood);
}

// ============= FOOD SUGGESTIONS =============

const foodDatabase = {
    happy: [
        { name: "Pizza Party", emoji: "🍕", description: "Celebrate with a classic!", category: "Italian" },
        { name: "Ice Cream Sundae", emoji: "🍦", description: "Sweet moments!", category: "Dessert" },
        { name: "Sushi Rolls", emoji: "🍣", description: "Fresh and delightful", category: "Japanese" },
        { name: "Birthday Cake", emoji: "🎂", description: "Every day's a celebration!", category: "Dessert" },
        { name: "Tacos", emoji: "🌮", description: "Fiesta vibes!", category: "Mexican" },
        { name: "Fruit Salad", emoji: "🍓", description: "Refreshing happiness", category: "Healthy" },
        { name: "Smoothie Bowl", emoji: "🥣", description: "Colorful energy", category: "Healthy" },
        { name: "Donuts", emoji: "🍩", description: "Sweet circle of joy", category: "Dessert" }
    ],
    sad: [
        { name: "Mac & Cheese", emoji: "🧀", description: "Ultimate comfort food", category: "Comfort" },
        { name: "Hot Chocolate", emoji: "☕", description: "Warm hugs in a mug", category: "Beverage" },
        { name: "Chicken Soup", emoji: "🍲", description: "Healing warmth", category: "Comfort" },
        { name: "Mashed Potatoes", emoji: "🥔", description: "Soft and soothing", category: "Comfort" },
        { name: "Chocolate Cake", emoji: "🍫", description: "Sweet therapy", category: "Dessert" },
        { name: "Grilled Cheese", emoji: "🧀", description: "Melty goodness", category: "Comfort" },
        { name: "Ramen", emoji: "🍜", description: "Slurp your sorrows away", category: "Asian" },
        { name: "Cookies", emoji: "🍪", description: "Bite-sized happiness", category: "Dessert" }
    ],
    angry: [
        { name: "Spicy Wings", emoji: "🍗", description: "Fire meets fire!", category: "Spicy" },
        { name: "Hot Curry", emoji: "🍛", description: "Release the heat", category: "Indian" },
        { name: "Jalapeño Poppers", emoji: "🌶️", description: "Explosive flavor", category: "Spicy" },
        { name: "Spicy Ramen", emoji: "🍜", description: "Burn the anger away", category: "Asian" },
        { name: "Buffalo Chicken", emoji: "🍗", description: "Fiery satisfaction", category: "Spicy" },
        { name: "Sriracha Noodles", emoji: "🍝", description: "Spice therapy", category: "Spicy" },
        { name: "Hot Salsa", emoji: "🌶️", description: "Chip away the anger", category: "Mexican" },
        { name: "Wasabi Sushi", emoji: "🍣", description: "Clear your mind", category: "Japanese" }
    ],
    stressed: [
        { name: "Dark Chocolate", emoji: "🍫", description: "Stress relief in a bite", category: "Dessert" },
        { name: "Green Tea", emoji: "🍵", description: "Zen in a cup", category: "Beverage" },
        { name: "Salmon", emoji: "🐟", description: "Omega-3 calm", category: "Healthy" },
        { name: "Avocado Toast", emoji: "🥑", description: "Smooth operator", category: "Healthy" },
        { name: "Nuts Mix", emoji: "🥜", description: "Crunchy stress relief", category: "Snack" },
        { name: "Chamomile Tea", emoji: "☕", description: "Peaceful sips", category: "Beverage" },
        { name: "Berries", emoji: "🫐", description: "Antioxidant boost", category: "Healthy" },
        { name: "Yogurt Parfait", emoji: "🥣", description: "Calming layers", category: "Healthy" }
    ],
    excited: [
        { name: "Energy Bowl", emoji: "🥗", description: "Fuel your adventure!", category: "Healthy" },
        { name: "Burger Combo", emoji: "🍔", description: "Big bold flavors", category: "Fast Food" },
        { name: "Pasta Carbonara", emoji: "🍝", description: "Rich excitement", category: "Italian" },
        { name: "BBQ Ribs", emoji: "🍖", description: "Party starter", category: "BBQ" },
        { name: "Nachos", emoji: "🧀", description: "Share the joy", category: "Mexican" },
        { name: "Fried Chicken", emoji: "🍗", description: "Crispy celebration", category: "Comfort" },
        { name: "Milkshake", emoji: "🥤", description: "Sweet rush", category: "Beverage" },
        { name: "Spring Rolls", emoji: "🥢", description: "Fresh excitement", category: "Asian" }
    ]
};

const healingMessages = {
    sad: {
        title: "💙 We're Here For You",
        description: "It's okay to feel sad sometimes. These comfort foods are scientifically proven to boost serotonin levels and provide emotional warmth. Remember, this feeling is temporary, and brighter days are ahead.",
        tips: [
            "💭 Take deep breaths and be kind to yourself",
            "🤗 Reach out to a friend or loved one",
            "🌟 Focus on one small positive thing today",
            "🎵 Listen to your favorite uplifting music"
        ]
    },
    angry: {
        title: "🔥 Channel That Energy",
        description: "Anger is a natural emotion. These spicy foods can help release endorphins and provide a healthy outlet for your feelings. Transform that fire into fuel for positive action.",
        tips: [
            "🏃 Get some physical exercise to release tension",
            "📝 Write down what's bothering you",
            "🧘 Try 5 minutes of meditation",
            "💪 Use this energy for something productive"
        ]
    },
    stressed: {
        title: "🌊 Take a Breath",
        description: "Stress is overwhelming, but you've got this. These foods contain natural stress-reducing compounds that can help your body and mind relax. One step at a time.",
        tips: [
            "⏰ Take a 5-minute break right now",
            "📋 Write a to-do list to clear your mind",
            "🛀 Plan a relaxing activity for later",
            "🙅 It's okay to say no to extra commitments"
        ]
    }
};

/* ============================================
   SURPRISE ME FEATURE - ADD TO script.js
   (Add this code after the foodDatabase object)
   ============================================ */

// Surprise Me - Random Food Generator
function surpriseMe() {
    if (!currentUser) {
        showToast('Please login first! 🔒', 'error');
        return;
    }

    // Get all foods from all moods
    const allFoods = [];
    const allMoods = Object.keys(foodDatabase);
    
    allMoods.forEach(mood => {
        foodDatabase[mood].forEach(food => {
            allFoods.push({ ...food, mood: mood });
        });
    });

    // Pick a random food
    const randomFood = allFoods[Math.floor(Math.random() * allFoods.length)];
    
    // Display in a special modal/popup
    showSurpriseModal(randomFood);
    
    // Trigger celebration effects
    triggerConfetti();
    showToast(`🎲 ${randomFood.name}! Perfect choice!`, 'success');
}

function showSurpriseModal(food) {
    // Remove existing modal if any
    const existingModal = document.querySelector('.surprise-modal');
    if (existingModal) {
        existingModal.remove();
    }

    // Get mood emoji
    const moodEmojis = {
        happy: '😊',
        sad: '😢',
        angry: '😠',
        stressed: '😰',
        excited: '🤩'
    };

    // Get mood color
    const moodColors = {
        happy: 'linear-gradient(135deg, #ffb6c1 0%, #ff69b4 100%)',
        sad: 'linear-gradient(135deg, #dda0dd 0%, #ba55d3 100%)',
        angry: 'linear-gradient(135deg, #ff69b4 0%, #ff1493 100%)',
        stressed: 'linear-gradient(135deg, #ffb6d9 0%, #ff85c0 100%)',
        excited: 'linear-gradient(135deg, #ff77ff 0%, #ff1493 100%)'
    };

    // Create modal
    const modal = document.createElement('div');
    modal.className = 'surprise-modal';
    modal.innerHTML = `
        <div class="surprise-overlay" onclick="closeSurpriseModal()"></div>
        <div class="surprise-content">
            <button class="surprise-close" onclick="closeSurpriseModal()">×</button>
            <div class="surprise-header">
                <h2>🎉 Your Surprise Food! 🎉</h2>
            </div>
            <div class="surprise-food-card" style="background: ${moodColors[food.mood]}">
                <div class="surprise-emoji">${food.emoji}</div>
                <h3 class="surprise-food-name">${food.name}</h3>
                <p class="surprise-food-description">${food.description}</p>
                <div class="surprise-tags">
                    <span class="surprise-tag category-tag">${food.category}</span>
                    <span class="surprise-tag mood-tag">${moodEmojis[food.mood]} ${food.mood}</span>
                </div>
            </div>
            <div class="surprise-actions">
                <button class="surprise-btn surprise-again" onclick="surpriseMe()">
                    🎲 Surprise Me Again!
                </button>
                <button class="surprise-btn surprise-view-mood" onclick="viewMoodFromSurprise('${food.mood}')">
                    View All ${food.mood} Foods
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Animate in
    setTimeout(() => modal.classList.add('show'), 10);
}

function closeSurpriseModal() {
    const modal = document.querySelector('.surprise-modal');
    if (modal) {
        modal.classList.remove('show');
        setTimeout(() => modal.remove(), 300);
    }
}

function viewMoodFromSurprise(mood) {
    closeSurpriseModal();
    selectMood(mood);
}

// Close modal on ESC key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeSurpriseModal();
    }
});

function displayFoodSuggestions(mood) {
    const suggestionsDiv = document.getElementById('foodSuggestions');
    const titleDiv = document.getElementById('suggestionTitle');
    const foodGrid = document.getElementById('foodGrid');
    const healingMessage = document.getElementById('healingMessage');

    // Set title with emoji
    const moodEmojis = {
        happy: '😊',
        sad: '😢',
        angry: '😠',
        stressed: '😰',
        excited: '🤩'
    };

    titleDiv.innerHTML = `${moodEmojis[mood]} Perfect for when you're feeling ${mood}!`;

    // Show/hide healing message for negative moods
    if (healingMessages[mood]) {
        const message = healingMessages[mood];
        document.getElementById('healingTitle').textContent = message.title;
        document.getElementById('healingDescription').textContent = message.description;
        
        const tipsHtml = message.tips.map(tip => `<div class="healing-tip">${tip}</div>`).join('');
        document.getElementById('healingTips').innerHTML = tipsHtml;
        
        healingMessage.classList.remove('hidden');
    } else {
        healingMessage.classList.add('hidden');
    }

    // Display food suggestions
    const foods = foodDatabase[mood];
    foodGrid.innerHTML = foods.map(food => `
        <div class="food-card food-item" style="background: linear-gradient(135deg, ${getMoodColor(mood)})">
            <div class="food-emoji">${food.emoji}</div>
            <h3>${food.name}</h3>
            <p class="food-description">${food.description}</p>
            <span class="food-category">${food.category}</span>
        </div>
    `).join('');

    // Show suggestions section with animation
    suggestionsDiv.classList.remove('hidden');
    suggestionsDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    // Trigger confetti for positive moods
    if (mood === 'happy' || mood === 'excited') {
        triggerConfetti();
    }
}

function getMoodColor(mood) {
    const colors = {
        happy: '#ffb6c1 0%, #ff69b4 100%',
        sad: '#dda0dd 0%, #ba55d3 100%',
        angry: '#ff69b4 0%, #ff1493 100%',
        stressed: '#ffb6d9 0%, #ff85c0 100%',
        excited: '#ff77ff 0%, #ff1493 100%'
    };
    return colors[mood] || '#ff69b4 0%, #ff1493 100%';
}

function shuffleFoods() {
    const foodGrid = document.getElementById('foodGrid');
    const cards = Array.from(foodGrid.children);
    
    // Fisher-Yates shuffle
    for (let i = cards.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        foodGrid.insertBefore(cards[j], cards[i]);
    }
    
    showToast('Shuffled! 🎲', 'success');
}

// ============= CONTACT FORM =============

async function submitContact() {
    const name = document.getElementById('contactName').value.trim();
    const email = document.getElementById('contactEmail').value.trim();
    const message = document.getElementById('contactMessage').value.trim();

    if (!name || !email || !message) {
        showToast('Please fill in all fields! 📝', 'error');
        return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showToast('Please enter a valid email! 📧', 'error');
        return;
    }

    try {
        const response = await apiRequest('/contact', {
            method: 'POST',
            body: JSON.stringify({ name, email, message })
        });

        if (response.success) {
            showToast(response.message, 'success');
            
            // Clear form
            document.getElementById('contactName').value = '';
            document.getElementById('contactEmail').value = '';
            document.getElementById('contactMessage').value = '';
        }
    } catch (error) {
        showToast(error.message || 'Failed to send message! 😕', 'error');
    }
}

// ============= PAGE NAVIGATION =============

function showPage(pageId) {
    if (!currentUser && pageId !== 'landing') {
        showToast('Please login first! 🔒', 'error');
        return;
    }

    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });

    const targetPage = document.getElementById(`${pageId}Page`);
    if (targetPage) {
        targetPage.classList.add('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Close mobile menu if open
    const mobileMenu = document.getElementById('mobileMenu');
    if (mobileMenu.classList.contains('active')) {
        mobileMenu.classList.remove('active');
    }
}

function toggleMobileMenu() {
    const mobileMenu = document.getElementById('mobileMenu');
    mobileMenu.classList.toggle('active');
}

function openBlogPost(postId) {
    showToast('Blog post coming soon! 📚', 'info');
}

// ============= UI EFFECTS =============

function showToast(message, type = 'info') {
    // Remove existing toast
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
        existingToast.remove();
    }
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function createEmojiRain() {
    const emojiRain = document.getElementById('emojiRain');
    if (!emojiRain) return;

    const emojis = ['😊', '😢', '😠', '😰', '🤩', '🍕', '🍔', '🍰', '🍦'];
    
    for (let i = 0; i < 20; i++) {
        setTimeout(() => {
            const emoji = document.createElement('div');
            emoji.className = 'falling-emoji';
            emoji.textContent = emojis[Math.floor(Math.random() * emojis.length)];
            emoji.style.left = Math.random() * 100 + '%';
            emoji.style.animationDuration = (Math.random() * 3 + 2) + 's';
            emojiRain.appendChild(emoji);

            setTimeout(() => emoji.remove(), 5000);
        }, i * 200);
    }
}

function triggerConfetti() {
    const container = document.getElementById('confettiContainer');
    const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f7b731', '#5f27cd', '#00d2d3'];
    
    for (let i = 0; i < 50; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.left = Math.random() * 100 + '%';
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.animationDelay = Math.random() * 0.5 + 's';
        container.appendChild(confetti);

        setTimeout(() => confetti.remove(), 3000);
    }
}