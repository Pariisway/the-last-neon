// Advanced WebRTC Voice Chat Implementation
let localStream = null;
let peerConnections = {};
let isMuted = false;
let currentScreenName = '';
let localUid = null;

// Firebase references
let roomRef = null;
let usersRef = null;
let signalsRef = null;

// WebRTC configuration
const rtcConfig = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

// Check WebRTC support
function checkWebRTCSupport() {
    if (!navigator.mediaDevices) {
        throw new Error('MediaDevices API not supported in this browser');
    }
    if (!navigator.mediaDevices.getUserMedia) {
        throw new Error('getUserMedia not supported in this browser');
    }
    if (!window.RTCPeerConnection) {
        throw new Error('WebRTC not supported in this browser');
    }
    return true;
}

function connectVoice() {
    const screenName = document.getElementById('screenName').value.trim();
    
    if (!screenName) {
        alert('Please enter a screen name');
        return;
    }
    
    currentScreenName = screenName;
    localUid = generateUid();
    
    try {
        // Check WebRTC support first
        checkWebRTCSupport();
        
        // Get microphone access with better error handling
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
            
            // Initialize Firebase for the room
            initializeRoom();
            
            console.log('Connected to voice chat in room:', window.currentRoom);
            updateStatus(`Connected to ${window.currentRoom} as ${screenName}`);
        })
        .catch(error => {
            console.error('Error accessing microphone:', error);
            let errorMessage = 'Error accessing microphone. ';
            
            if (error.name === 'NotAllowedError') {
                errorMessage += 'Please allow microphone permissions.';
            } else if (error.name === 'NotFoundError') {
                errorMessage += 'No microphone found.';
            } else if (error.name === 'NotSupportedError') {
                errorMessage += 'WebRTC not supported in this browser.';
            } else {
                errorMessage += 'Please check permissions and try again.';
            }
            
            alert(errorMessage);
        });
    } catch (error) {
        console.error('WebRTC setup error:', error);
        alert('WebRTC not supported: ' + error.message);
    }
}

function initializeRoom() {
    const db = firebase.firestore();
    
    // Room references - use window.currentRoom from main.js
    roomRef = db.collection('voiceRooms').doc(window.currentRoom);
    usersRef = roomRef.collection('users');
    signalsRef = roomRef.collection('signals');
    
    // Add current user to the room
    usersRef.doc(localUid).set({
        screenName: currentScreenName,
        uid: localUid,
        joinedAt: firebase.firestore.FieldValue.serverTimestamp(),
        active: true
    });
    
    // Listen for other users in the room
    usersRef.onSnapshot((snapshot) => {
        snapshot.docChanges().forEach((change) => {
            const userData = change.doc.data();
            
            if (change.type === 'added' && userData.uid !== localUid) {
                console.log('User joined:', userData.screenName);
                updateUserList();
                createPeerConnection(userData.uid, userData.screenName);
            }
            
            if (change.type === 'removed') {
                console.log('User left:', userData.screenName);
                if (peerConnections[userData.uid]) {
                    peerConnections[userData.uid].close();
                    delete peerConnections[userData.uid];
                }
                updateUserList();
            }
        });
    });
    
    // Listen for signaling messages
    signalsRef.where('to', '==', localUid).onSnapshot((snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
                const signal = change.doc.data();
                handleSignalingMessage(signal);
                // Remove the signal after processing
                change.doc.ref.delete();
            }
        });
    });
}

function createPeerConnection(remoteUid, remoteName) {
    try {
        const pc = new RTCPeerConnection(rtcConfig);
        peerConnections[remoteUid] = pc;
        
        // Add local stream
        localStream.getTracks().forEach(track => {
            pc.addTrack(track, localStream);
        });
        
        // Handle incoming stream
        pc.ontrack = (event) => {
            console.log('Received remote stream from:', remoteName);
            const remoteAudio = document.createElement('audio');
            remoteAudio.srcObject = event.streams[0];
            remoteAudio.autoplay = true;
            remoteAudio.controls = false;
            remoteAudio.setAttribute('data-uid', remoteUid);
            remoteAudio.setAttribute('data-name', remoteName);
            
            // Add to UI
            const audioContainer = document.getElementById('audioContainer') || createAudioContainer();
            audioContainer.appendChild(remoteAudio);
            
            updateUserList();
        };
        
        // Handle ICE candidates
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
        
        // Create and send offer
        pc.createOffer()
            .then(offer => pc.setLocalDescription(offer))
            .then(() => {
                sendSignalingMessage({
                    type: 'offer',
                    sdp: pc.localDescription,
                    to: remoteUid,
                    from: localUid
                });
            })
            .catch(error => console.error('Error creating offer:', error));
    } catch (error) {
        console.error('Error creating peer connection:', error);
    }
}

function handleSignalingMessage(signal) {
    const pc = peerConnections[signal.from] || createPeerConnection(signal.from, 'Unknown User');
    
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
                });
            break;
            
        case 'answer':
            pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
            break;
            
        case 'ice-candidate':
            pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
            break;
    }
}

function sendSignalingMessage(message) {
    signalsRef.add({
        ...message,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
}

function createAudioContainer() {
    const container = document.createElement('div');
    container.id = 'audioContainer';
    container.style.marginTop = '20px';
    container.innerHTML = '<h4>Connected Users:</h4>';
    document.querySelector('.modal-content').appendChild(container);
    return container;
}

function updateUserList() {
    const audioContainer = document.getElementById('audioContainer');
    if (!audioContainer) return;
    
    const userList = document.getElementById('userList') || createUserList();
    userList.innerHTML = '';
    
    // Add local user
    const localItem = document.createElement('div');
    localItem.textContent = `🎤 ${currentScreenName} (You) ${isMuted ? '🔇' : '🔊'}`;
    localItem.style.margin = '5px 0';
    localItem.style.color = isMuted ? '#ff4444' : '#39ff14';
    userList.appendChild(localItem);
    
    // Add remote users
    const audioElements = audioContainer.querySelectorAll('audio');
    audioElements.forEach(audio => {
        const remoteName = audio.getAttribute('data-name');
        const remoteItem = document.createElement('div');
        remoteItem.textContent = `🔊 ${remoteName}`;
        remoteItem.style.margin = '5px 0';
        remoteItem.style.color = '#00ffff';
        userList.appendChild(remoteItem);
    });
}

function createUserList() {
    const userList = document.createElement('div');
    userList.id = 'userList';
    userList.style.marginTop = '10px';
    userList.style.padding = '10px';
    userList.style.background = 'rgba(0,0,0,0.3)';
    userList.style.borderRadius = '5px';
    document.getElementById('audioContainer').appendChild(userList);
    return userList;
}

function updateStatus(message) {
    const statusElement = document.getElementById('voiceStatus') || createStatusElement();
    statusElement.textContent = message;
}

function createStatusElement() {
    const statusElement = document.createElement('div');
    statusElement.id = 'voiceStatus';
    statusElement.style.marginTop = '10px';
    statusElement.style.padding = '5px';
    statusElement.style.color = '#39ff14';
    document.querySelector('.modal-content').appendChild(statusElement);
    return statusElement;
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
    
    updateUserList();
}

function leaveVoice() {
    // Close all peer connections
    Object.values(peerConnections).forEach(pc => pc.close());
    peerConnections = {};
    
    // Stop local stream
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    
    // Remove from Firebase
    if (usersRef && localUid) {
        usersRef.doc(localUid).delete();
    }
    
    // Clean up UI
    document.getElementById('voiceControls').style.display = 'none';
    const audioContainer = document.getElementById('audioContainer');
    if (audioContainer) {
        audioContainer.remove();
    }
    
    console.log('Left voice chat');
    updateStatus('Disconnected from voice chat');
}

function generateUid() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    console.log('Voice chat module loaded');
    
    // Test WebRTC support on load
    try {
        checkWebRTCSupport();
        console.log('WebRTC supported in this browser');
    } catch (error) {
        console.error('WebRTC not supported:', error);
        // You could show a warning to the user here
    }
});
