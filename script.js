// Firebase configuration
const firebaseConfig = {
    apiKey: 'AIzaSyCQd2QmmDl7dTW9xgurON5uiOp5rTn0S_c',
    authDomain: 'points-d6cfb.firebaseapp.com',
    projectId: 'points-d6cfb',
    storageBucket: 'points-d6cfb.firebasestorage.app',
    messagingSenderId: '832909125676',
    appId: '1:832909125676:web:7dcc2e47ad16657cf9c989',
    measurementId: 'G-XL96X9KSMZ',
    databaseURL: 'https://points-d6cfb-default-rtdb.firebaseio.com/'
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const database = firebase.database();

// DOM Elements
const loginSection = document.getElementById('login-section');
const dashboardSection = document.getElementById('dashboard-section');
const loginBtn = document.getElementById('login-btn');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginError = document.getElementById('login-error');
const userPointsElement = document.getElementById('user-points');
const postsContainer = document.getElementById('posts-container');
const scanBtn = document.getElementById('scan-btn');

// Generate device ID for web
function getWebDeviceId() {
    let deviceId = localStorage.getItem('deviceId');
    if (!deviceId) {
        deviceId = 'web_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('deviceId', deviceId);
    }
    return deviceId;
}

// Login function
loginBtn.addEventListener('click', async () => {
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();
    const deviceId = getWebDeviceId();

    try {
        // Check if user exists in database with this email
        const usersRef = database.ref('users');
        const snapshot = await usersRef.once('value');
        const usersData = snapshot.val();

        let foundUserId = null;
        let storedDeviceId = null;

        if (usersData) {
            for (const [userId, userData] of Object.entries(usersData)) {
                if (userData.email === email) {
                    foundUserId = userId;
                    storedDeviceId = userData.deviceId;
                    break;
                }
            }
        }

        // Check if account is registered on another device
        if (foundUserId && storedDeviceId && storedDeviceId !== deviceId) {
            loginError.textContent = 'هذا الحساب مسجل على جهاز آخر!';
            loginError.classList.remove('hidden');
            return;
        }

        // Sign in with email and password
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const user = userCredential.user;

        if (user) {
            // Update user device ID in database
            await usersRef.child(user.uid).update({
                email: user.email,
                deviceId: deviceId
            });

            // Show dashboard
            loginSection.classList.add('hidden');
            dashboardSection.classList.remove('hidden');
            scanBtn.classList.remove('hidden');

            // Load user data
            loadUserData(user.uid);
            loadPosts();
        }
    } catch (error) {
        console.error('Login error:', error);
        loginError.textContent = 'فشل تسجيل الدخول: تحقق من البيانات المدخلة';
        loginError.classList.remove('hidden');
    }
});

// Redirect to scanner page
scanBtn.addEventListener('click', () => {
    window.location.href = 'scan.html';
});

// Load user points
function loadUserData(userId) {
    const userRef = database.ref('users/' + userId);
    
    userRef.on('value', (snapshot) => {
        const userData = snapshot.val();
        if (userData && userData.marks) {
            userPointsElement.textContent = userData.marks;
        }
    });
}

// Load posts from database
function loadPosts() {
    const postsRef = database.ref('posts').orderByChild('timestamp');
    
    postsRef.on('value', (snapshot) => {
        const postsData = snapshot.val();
        postsContainer.innerHTML = '';

        if (!postsData) {
            postsContainer.innerHTML = '<div class="post-card">No posts yet!</div>';
            return;
        }

        // Convert to array and sort by timestamp (newest first)
        const postsArray = Object.entries(postsData).map(([postId, post]) => ({
            postId,
            ...post
        })).sort((a, b) => b.timestamp.localeCompare(a.timestamp));

        postsArray.forEach(post => {
            const postElement = createPostElement(post);
            postsContainer.appendChild(postElement);
        });
    });
}

// Create post HTML element
function createPostElement(post) {
    const postElement = document.createElement('div');
    postElement.className = 'post-card';

    // Format username (capitalize first letter)
    const userEmail = post.user.split('@')[0];
    const username = userEmail.charAt(0).toUpperCase() + userEmail.slice(1);

    // Format timestamp
    const timestamp = formatTimestamp(post.timestamp);

    // Create post HTML
    postElement.innerHTML = `
        <div class="post-header">
            <div class="post-user">${username}</div>
            <div class="post-time">${timestamp}</div>
        </div>
        ${post.post ? `<div class="post-content">${post.post}</div>` : ''}
        ${post.images && post.images.length > 0 ? createPostImages(post.images) : ''}
        <div class="post-footer">
            <button class="like-btn" data-post-id="${post.postId}">
                <span class="material-icons">favorite_border</span>
                <span class="likes-count">${post.likes ? post.likes.length : 0}</span>
            </button>
        </div>
    `;

    // Add like button functionality
    const likeBtn = postElement.querySelector('.like-btn');
    likeBtn.addEventListener('click', () => toggleLike(post.postId));

    // Check if current user liked this post
    auth.onAuthStateChanged(user => {
        if (user && post.likes && post.likes.includes(user.email)) {
            likeBtn.classList.add('liked');
            likeBtn.innerHTML = `
                <span class="material-icons">favorite</span>
                <span class="likes-count">${post.likes.length}</span>
            `;
        }
    });

    return postElement;
}

// Create images HTML for post
function createPostImages(images) {
    let imagesHTML = '<div class="post-images">';
    
    images.forEach((image, index) => {
        imagesHTML += `
            <img src="data:image/jpeg;base64,${image}" alt="Post image ${index + 1}" class="post-image">
        `;
    });
    
    imagesHTML += '</div>';
    return imagesHTML;
}

// Format timestamp
function formatTimestamp(timestamp) {
    if (!timestamp) return 'Unknown time';
    
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return 'Unknown time';
    
    return date.toLocaleString('ar-EG', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Toggle like on post
async function toggleLike(postId) {
    const user = auth.currentUser;
    if (!user) return;

    const postRef = database.ref('posts/' + postId);
    const snapshot = await postRef.once('value');
    const postData = snapshot.val();

    if (postData) {
        const likes = postData.likes || [];
        const userEmail = user.email;

        if (likes.includes(userEmail)) {
            // Unlike
            const newLikes = likes.filter(email => email !== userEmail);
            await postRef.update({ likes: newLikes });
        } else {
            // Like
            likes.push(userEmail);
            await postRef.update({ likes: likes });

            // Record interaction in database
            const interactionsRef = database.ref('interactions');
            await interactionsRef.push({
                userId: user.uid,
                type: 'like',
                postId: postId,
                timestamp: new Date().toISOString(),
                userEmail: userEmail,
                postContent: postData.post || ''
            });
        }
    }
}

// Check auth state
auth.onAuthStateChanged(user => {
    if (user) {
        // User is signed in
        loginSection.classList.add('hidden');
        dashboardSection.classList.remove('hidden');
        scanBtn.classList.remove('hidden');
        loadUserData(user.uid);
        loadPosts();
    } else {
        // User is signed out
        loginSection.classList.remove('hidden');
        dashboardSection.classList.add('hidden');
        scanBtn.classList.add('hidden');
    }
});