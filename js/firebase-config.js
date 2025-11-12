// Firebase configuration for THE-LAST-NEON
const firebaseConfig = {
  apiKey: "AIzaSyBUjgWx4Jq4vBr2Rc7v88j2Y6Hra4Kzpts",
  authDomain: "the-last-neon.firebaseapp.com",
  projectId: "the-last-neon",
  storageBucket: "the-last-neon.firebasestorage.app",
  messagingSenderId: "161452196731",
  appId: "1:161452196731:web:b4094a1f2dfeb1403bf3de"
};

// Initialize Firebase ONLY ONCE
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
    console.log('✅ Firebase initialized successfully for THE-LAST-NEON');
    
    // Initialize Firestore
    const db = firebase.firestore();
    
    // Enable persistence with error handling
    db.enablePersistence()
      .catch((err) => {
          if (err.code == 'failed-precondition') {
              console.log('Persistence failed: Multiple tabs open');
          } else if (err.code == 'unimplemented') {
              console.log('Persistence not supported');
          }
      });
      
} else {
    console.log('Firebase already initialized');
}