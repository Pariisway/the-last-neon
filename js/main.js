// Main application logic for THE-LAST-NEON
let currentSection = 'voicechat';

// Make currentRoom available globally for voicechat.js
window.currentRoom = null;

function showSection(sectionId) {
    // Hide all sections
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Show selected section
    document.getElementById(sectionId).classList.add('active');
    currentSection = sectionId;
}

// Test Firestore Connection
function testFirestoreConnection() {
    const db = firebase.firestore();
    
    console.log('🧪 Testing Firestore connection for THE-LAST-NEON...');
    
    // Test write
    return db.collection('test').doc('connection-test').set({
        test: true,
        project: 'the-last-neon',
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    })
    .then(() => {
        console.log('✅ Firestore write successful');
        // Test read
        return db.collection('test').doc('connection-test').get();
    })
    .then(doc => {
        if (doc.exists) {
            console.log('✅ Firestore read successful');
            console.log('✅ THE-LAST-NEON Firestore is working perfectly!');
        }
        // Clean up
        return db.collection('test').doc('connection-test').delete();
    })
    .then(() => {
        console.log('✅ Firestore test completed successfully');
        return true;
    })
    .catch(error => {
        console.error('❌ Firestore test failed:', error);
        alert('Firestore connection failed. Please check security rules.\nError: ' + error.message);
        return false;
    });
}

// Voice Chat Functions
function joinRoom(room) {
    // Test connection before joining room
    testFirestoreConnection().then(success => {
        if (success) {
            window.currentRoom = room;
            document.getElementById('roomName').textContent = room.charAt(0).toUpperCase() + room.slice(1);
            document.getElementById('voiceModal').style.display = 'block';
            document.getElementById('screenName').value = ''; // Clear previous name
            document.getElementById('screenName').focus();
        }
    });
}

function closeVoiceModal() {
    document.getElementById('voiceModal').style.display = 'none';
    if (typeof leaveVoice === 'function') {
        leaveVoice();
    }
}

// Auth Functions
function showAuth() {
    document.getElementById('authModal').style.display = 'block';
}

function closeAuthModal() {
    document.getElementById('authModal').style.display = 'none';
}

function showSignup() {
    document.getElementById('login-form').style.display = 'none';
    document.getElementById('signup-form').style.display = 'block';
}

function showLogin() {
    document.getElementById('signup-form').style.display = 'none';
    document.getElementById('login-form').style.display = 'block';
}

// Firebase Auth Functions
function login() {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    firebase.auth().signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
            console.log('User logged in:', userCredential.user);
            closeAuthModal();
            loadMarketplace();
        })
        .catch((error) => {
            console.error('Login error:', error);
            alert('Login failed: ' + error.message);
        });
}

function signup() {
    const name = document.getElementById('signupName').value;
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;
    const address = document.getElementById('signupAddress').value;
    const city = document.getElementById('signupCity').value;
    const zip = document.getElementById('signupZip').value;

    firebase.auth().createUserWithEmailAndPassword(email, password)
        .then((userCredential) => {
            // Save additional user data to Firestore
            return firebase.firestore().collection('users').doc(userCredential.user.uid).set({
                name: name,
                address: address,
                city: city,
                zip: zip,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        })
        .then(() => {
            console.log('User created and data saved');
            closeAuthModal();
            loadMarketplace();
        })
        .catch((error) => {
            console.error('Signup error:', error);
            alert('Signup failed: ' + error.message);
        });
}

function loadMarketplace() {
    // This will load the marketplace for logged-in users
    const user = firebase.auth().currentUser;
    if (user) {
        document.getElementById('marketplace-content').innerHTML = `
            <h3>Welcome to the Marketplace!</h3>
            <p>Here you can browse our exclusive merch.</p>
            <div class="product-grid">
                <div class="product-card">
                    <h4>Neon T-Shirt</h4>
                    <p>$24.99</p>
                    <button>Add to Cart</button>
                </div>
                <div class="product-card">
                    <h4>Glowing Hoodie</h4>
                    <p>$49.99</p>
                    <button>Add to Cart</button>
                </div>
            </div>
        `;
    }
}

// Arcade Games
function loadGame(game) {
    // Redirect to arcade page with game parameter
    window.location.href = `pages/arcade.html?game=${game}`;
}

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
    showSection('voicechat');
    
    console.log('🚀 THE-LAST-NEON initializing...');
    
    // Test Firestore connection on startup
    setTimeout(() => {
        testFirestoreConnection();
    }, 2000);
    
    // Close modals when clicking outside
    window.onclick = function(event) {
        const voiceModal = document.getElementById('voiceModal');
        const authModal = document.getElementById('authModal');
        
        if (event.target === voiceModal) {
            closeVoiceModal();
        }
        if (event.target === authModal) {
            closeAuthModal();
        }
    };

    // Auth state observer
    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            console.log('User authenticated:', user.email);
            loadMarketplace();
        } else {
            console.log('No user authenticated');
        }
    });
});