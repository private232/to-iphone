// Firebase configuration
const firebaseConfig = {
    apiKey: 'AIzaSyALJkV22o-8iVRj1UfEBgzjF0_uCc88Bus',
    appId: '1:604464445362:web:50fc15dba3580bb92e16ab',
    messagingSenderId: '604464445362',
    projectId: 'new-points-854d6',
    authDomain: 'new-points-854d6.firebaseapp.com',
    databaseURL: 'https://new-points-854d6-default-rtdb.firebaseio.com',
    storageBucket: 'new-points-854d6.firebasestorage.app',
    measurementId: 'G-LZX2BWYQ44',
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

        // Setup image sliders after posts are loaded
        setupImageSliders();
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
    let imagesHTML = `
        <div class="post-images">
            <div class="post-images-container" style="width: ${images.length * 100}%">
    `;
    
    images.forEach((image, index) => {
        imagesHTML += `
            <div style="width: 100%; flex-shrink: 0; display: flex; justify-content: center; align-items: center;">
                <img src="data:image/jpeg;base64,${image}" alt="Post image ${index + 1}" class="post-image" onload="this.style.opacity=1">
            </div>
        `;
    });
    
    imagesHTML += `
            </div>
            <div class="images-indicator">
                ${images.map((_, index) => `
                    <div class="indicator-dot ${index === 0 ? 'active' : ''}" data-index="${index}"></div>
                `).join('')}
            </div>
        </div>
    `;
    
    return imagesHTML;
}

// Setup image sliders functionality with reversed dots order
function setupImageSliders() {
    document.querySelectorAll('.post-images').forEach(imagesContainer => {
        const container = imagesContainer.querySelector('.post-images-container');
        const dotsContainer = imagesContainer.querySelector('.indicators');
        const dots = Array.from(imagesContainer.querySelectorAll('.indicator-dot'));
        const imageCount = dots.length;
        let currentIndex = 0;
        let startX, moveX;
        let isDragging = false;

        // Set initial position
        container.style.direction = 'ltr';
        container.style.display = 'flex';
        container.style.width = `${imageCount * 100}%`;
        
        // عكس ترتيب النقاط في الـ DOM
        if (dotsContainer) {
            dots.reverse().forEach(dot => dotsContainer.appendChild(dot));
        }
        
        updateSliderPosition();

        // Touch events for mobile
        imagesContainer.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            isDragging = true;
            container.style.transition = 'none';
        });

        imagesContainer.addEventListener('touchmove', (e) => {
            if (!isDragging) return;
            moveX = e.touches[0].clientX;
            const diff = moveX - startX;
            const translateX = -currentIndex * 100 + (diff / imagesContainer.offsetWidth) * 100;
            container.style.transform = `translateX(${translateX}%)`;
        });

        imagesContainer.addEventListener('touchend', (e) => {
            if (!isDragging) return;
            isDragging = false;
            container.style.transition = 'transform 0.3s ease';
            const diff = moveX - startX;
            
            if (Math.abs(diff) > 50) {
                if (diff > 0 && currentIndex > 0) {
                    // Swipe right - go to previous image
                    currentIndex--;
                } else if (diff < 0 && currentIndex < imageCount - 1) {
                    // Swipe left - go to next image
                    currentIndex++;
                }
            }
            
            updateSliderPosition();
        });

        // Mouse events for desktop
        imagesContainer.addEventListener('mousedown', (e) => {
            startX = e.clientX;
            isDragging = true;
            container.style.transition = 'none';
            e.preventDefault();
        });

        imagesContainer.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            moveX = e.clientX;
            const diff = moveX - startX;
            const translateX = -currentIndex * 100 + (diff / imagesContainer.offsetWidth) * 100;
            container.style.transform = `translateX(${translateX}%)`;
        });

        imagesContainer.addEventListener('mouseup', (e) => {
            if (!isDragging) return;
            isDragging = false;
            container.style.transition = 'transform 0.3s ease';
            const diff = moveX - startX;
            
            if (Math.abs(diff) > 50) {
                if (diff > 0 && currentIndex > 0) {
                    // Swipe right - go to previous image
                    currentIndex--;
                } else if (diff < 0 && currentIndex < imageCount - 1) {
                    // Swipe left - go to next image
                    currentIndex++;
                }
            }
            
            updateSliderPosition();
        });

        function updateSliderPosition() {
            container.style.transform = `translateX(-${currentIndex * 100}%)`;
            
            // Update dots (now in reversed order)
            dots.forEach((dot, index) => {
                if ((imageCount - 1 - index) === currentIndex) {
                    dot.classList.add('active');
                } else {
                    dot.classList.remove('active');
                }
            });
        }
    });
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

// Global function to handle image load
window.onload = function() {
    // Set opacity to 1 for all images after they load
    document.querySelectorAll('.post-image').forEach(img => {
        img.style.opacity = '1';
    });
};