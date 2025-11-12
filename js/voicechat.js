// Enhanced WebRTC Voice Chat Implementation with PROPER Firestore Cleanup
let localStream = null;
let peerConnections = {};
let isMuted = false;
let currentScreenName = '';
let localUid = null;

// Firebase references and listeners
let roomRef = null;
let usersRef = null;
let signalsRef = null;
let usersUnsubscribe = null;
let signalsUnsubscribe = null;

// WebRTC configuration
const rtcConfig = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
    ]
};

function connectVoice() {
    const screenName = document.getElementById('screenName').value.trim();
    
    if (!screenName) {
        alert('Please enter a screen name');
        return;
    }
    
    currentScreenName = screenName;
    localUid = generateUid();
    
    debugLog('Starting voice connection...');
    
    // Get microphone access
    navigator.mediaDevices.getUserMedia({ 
        audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
        }, 
        video: false 
    })
    .then(stream => {
        localStream = stream;
        document.getElementById('voiceControls').style.display = 'block';
        debugLog('Microphone access granted');
        initializeRoom();
    })
    .catch(error => {
        console.error('Microphone error:', error);
        alert('Cannot access microphone. Please check permissions and try again.');
    });
}

function initializeRoom() {
    // Clean up any existing listeners FIRST
    cleanupFirebaseListeners();
    
    const db = firebase.firestore();
    const roomName = window.currentRoom;
    
    debugLog(`Initializing room: ${roomName}`);
    
    // Room references
    roomRef = db.collection('voiceRooms').doc(roomName);
    usersRef = roomRef.collection('users');
    signalsRef = roomRef.collection('signals');
    
    // Add current user to the room
    usersRef.doc(localUid).set({
        screenName: currentScreenName,
        uid: localUid,
        joinedAt: firebase.firestore.FieldValue.serverTimestamp(),
        active: true
    })
    .then(() => {
        debugLog(`Joined room as ${currentScreenName}`);
        setupListeners();
    })
    .catch(error => {
        console.error('Error joining room:', error);
        alert('Error joining room. Check Firebase permissions.');
    });
}

function setupListeners() {
    // Listen for other users - store the unsubscribe function
    usersUnsubscribe = usersRef.onSnapshot((snapshot) => {
        snapshot.docChanges().forEach((change) => {
            const userData = change.doc.data();
            
            if (change.type === 'added' && userData.uid !== localUid) {
                debugLog(`User joined: ${userData.screenName}`);
                createPeerConnection(userData.uid, userData.screenName);
            }
            
            if (change.type === 'removed') {
                debugLog(`User left: ${userData.screenName}`);
                cleanupUser(userData.uid);
            }
        });
        updateUserList();
    }, (error) => {
        console.error('Users listener error:', error);
    });
    
    // Listen for signaling messages - store the unsubscribe function
    signalsUnsubscribe = signalsRef.where('to', '==', localUid).onSnapshot((snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
                const signal = change.doc.data();
                handleSignalingMessage(signal);
                // Clean up the signal
                change.doc.ref.delete().catch(console.error);
            }
        });
    }, (error) => {
        console.error('Signals listener error:', error);
    });
}

function cleanupFirebaseListeners() {
    console.log('Cleaning up Firebase listeners...');
    
    // Properly unsubscribe from Firestore listeners
    if (usersUnsubscribe) {
        usersUnsubscribe();
        usersUnsubscribe = null;
        console.log('Users listener closed');
    }
    
    if (signalsUnsubscribe) {
        signalsUnsubscribe();
        signalsUnsubscribe = null;
        console.log('Signals listener closed');
    }
    
    // Clear references
    roomRef = null;
    usersRef = null;
    signalsRef = null;
}

function createPeerConnection(remoteUid, remoteName) {
    debugLog(`Creating peer connection with ${remoteName}`);
    
    try {
        const pc = new RTCPeerConnection(rtcConfig);
        peerConnections[remoteUid] = pc;
        
        // Add local audio tracks
        localStream.getAudioTracks().forEach(track => {
            pc.addTrack(track, localStream);
        });
        
        // Handle incoming remote stream
        pc.ontrack = (event) => {
            debugLog(`✅ Received audio stream from ${remoteName}`);
            const remoteStream = event.streams[0];
            setupRemoteAudio(remoteStream, remoteUid, remoteName);
        };
        
        // ICE candidate handling
        pc.onicecandidate = (event) => {
            if (event.candidate) {
                sendSignalingMessage({
                    type: 'ice-candidate',
                    candidate: event.candidate,
                    to: remoteUid,
                    from: localUid
                });
            }
        };
        
        // Connection state monitoring
        pc.onconnectionstatechange = () => {
            debugLog(`Connection state with ${remoteName}: ${pc.connectionState}`);
        };
        
        // Create offer
        createOffer(pc, remoteUid);
        
    } catch (error) {
        console.error('Error creating peer connection:', error);
    }
}

function createOffer(pc, remoteUid) {
    pc.createOffer({
        offerToReceiveAudio: true
    })
    .then(offer => pc.setLocalDescription(offer))
    .then(() => {
        sendSignalingMessage({
            type: 'offer',
            sdp: pc.localDescription,
            to: remoteUid,
            from: localUid
        });
        debugLog('Sent offer to ' + remoteUid);
    })
    .catch(error => console.error('Error creating offer:', error));
}

function setupRemoteAudio(remoteStream, remoteUid, remoteName) {
    // Remove existing audio element for this user
    const existingAudio = document.querySelector(`audio[data-uid="${remoteUid}"]`);
    if (existingAudio) {
        existingAudio.remove();
    }
    
    // Create new audio element
    const remoteAudio = document.createElement('audio');
    remoteAudio.srcObject = remoteStream;
    remoteAudio.autoplay = true;
    remoteAudio.controls = false;
    remoteAudio.setAttribute('data-uid', remoteUid);
    remoteAudio.setAttribute('data-name', remoteName);
    remoteAudio.style.display = 'none';
    
    // Add event listeners to monitor audio
    remoteAudio.onloadedmetadata = () => {
        debugLog(`✅ Audio stream ready for ${remoteName}`);
    };
    
    remoteAudio.onerror = (error) => {
        console.error(`Audio error for ${remoteName}:`, error);
    };
    
    // Add to container
    const audioContainer = document.getElementById('audioContainer');
    if (audioContainer) {
        audioContainer.appendChild(remoteAudio);
    }
    
    updateUserList();
}

function handleSignalingMessage(signal) {
    debugLog(`Received signal: ${signal.type} from ${signal.from}`);
    
    let pc = peerConnections[signal.from];
    if (!pc) {
        pc = createPeerConnection(signal.from, 'Remote User');
    }
    
    switch (signal.type) {
        case 'offer':
            pc.setRemoteDescription(new RTCSessionDescription(signal.sdp))
                .then(() => pc.createAnswer())
                .then(answer => pc.setLocalDescription(answer))
                .then(() => {
                    sendSignalingMessage({
                        type: 'answer',
                        sdp: pc.localDescription,
                        to: signal.from,
                        from: localUid
                    });
                })
                .catch(error => console.error('Error handling offer:', error));
            break;
            
        case 'answer':
            pc.setRemoteDescription(new RTCSessionDescription(signal.sdp))
                .catch(error => console.error('Error setting remote description:', error));
            break;
            
        case 'ice-candidate':
            pc.addIceCandidate(new RTCIceCandidate(signal.candidate))
                .catch(error => console.error('Error adding ICE candidate:', error));
            break;
    }
}

function sendSignalingMessage(message) {
    if (!signalsRef) {
        console.error('Cannot send signal - signalsRef is null');
        return;
    }
    
    signalsRef.add({
        ...message,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    }).catch(error => console.error('Error sending signal:', error));
}

function cleanupUser(uid) {
    if (peerConnections[uid]) {
        peerConnections[uid].close();
        delete peerConnections[uid];
    }
    
    const audioElement = document.querySelector(`audio[data-uid="${uid}"]`);
    if (audioElement) {
        audioElement.remove();
    }
    
    updateUserList();
}

function leaveVoice() {
    debugLog('Leaving voice chat...');
    
    // Close all peer connections
    Object.values(peerConnections).forEach(pc => {
        if (pc) {
            pc.close();
        }
    });
    peerConnections = {};
    
    // Stop local stream
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    
    // Clean up Firebase listeners and data
    cleanupFirebaseListeners();
    
    // Remove user from Firestore
    if (usersRef && localUid) {
        usersRef.doc(localUid).delete().catch(error => {
            console.log('User already removed from room');
        });
    }
    
    // Clean up UI
    document.getElementById('voiceControls').style.display = 'none';
    const audioContainer = document.getElementById('audioContainer');
    if (audioContainer) {
        const audios = audioContainer.querySelectorAll('audio');
        audios.forEach(audio => audio.remove());
        
        const userList = document.getElementById('userList');
        if (userList) {
            userList.innerHTML = '';
        }
    }
    
    updateStatus('Disconnected from voice chat');
    console.log('Voice chat completely cleaned up');
}

// Utility functions
function debugLog(message) {
    console.log(`[VoiceChat] ${message}`);
    updateStatus(message);
}

function updateStatus(message) {
    const statusElement = document.getElementById('voiceStatus');
    if (statusElement) {
        statusElement.textContent = message;
    }
}

function updateUserList() {
    const userList = document.getElementById('userList');
    if (!userList) return;
    
    userList.innerHTML = '';
    
    // Add local user
    const localItem = document.createElement('div');
    localItem.textContent = `🎤 ${currentScreenName} (You) ${isMuted ? '🔇' : '🔊'}`;
    localItem.style.margin = '5px 0';
    localItem.style.color = isMuted ? '#ff4444' : '#39ff14';
    userList.appendChild(localItem);
    
    // Add remote users
    const audioElements = document.querySelectorAll('audio[data-name]');
    audioElements.forEach(audio => {
        const remoteName = audio.getAttribute('data-name');
        const remoteItem = document.createElement('div');
        remoteItem.textContent = `🔊 ${remoteName}`;
        remoteItem.style.margin = '5px 0';
        remoteItem.style.color = '#00ffff';
        userList.appendChild(remoteItem);
    });
}

function toggleMute() {
    if (!localStream) return;
    
    isMuted = !isMuted;
    localStream.getAudioTracks().forEach(track => {
        track.enabled = !isMuted;
    });
    
    const muteBtn = document.getElementById('muteBtn');
    muteBtn.textContent = isMuted ? 'Unmute' : 'Mute';
    muteBtn.style.background = isMuted ? '#ff4444' : '';
    muteBtn.style.borderColor = isMuted ? '#ff4444' : '';
    
    updateUserList();
    debugLog(isMuted ? 'Microphone muted' : 'Microphone unmuted');
}

function generateUid() {
    return 'user_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    debugLog('Voice chat module loaded');
    
    // Add beforeunload listener to clean up on page refresh/close
    window.addEventListener('beforeunload', function() {
        if (localStream || usersUnsubscribe || signalsUnsubscribe) {
            leaveVoice();
        }
    });
});