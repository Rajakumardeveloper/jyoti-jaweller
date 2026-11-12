document.addEventListener('DOMContentLoaded', () => {
  console.log("Auth Script Loaded Successfully");

  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  const linkSignup = document.getElementById('link-signup');
  const linkBackLogin = document.getElementById('link-back-login');
  const subtitle = document.getElementById('login-subtitle');

  // Safety check: If the forms don't exist, stop running to prevent crashes
  if (!loginForm || !signupForm) {
    console.error("Login or Signup form not found in HTML");
    return;
  }

  // Custom message function (uses the beautiful popup from app.js)
  const showMsg = (msg, type, callback = null) => {
    if (typeof window.showAlert === 'function') {
      window.showAlert(msg, type, callback);
    } else {
      alert(msg);
      if (callback) callback();
    }
  };

  // Toggle to Signup Form
  if (linkSignup) {
    linkSignup.addEventListener('click', (e) => {
      e.preventDefault();
      loginForm.style.display = 'none';
      signupForm.style.display = 'block';
      if (subtitle) subtitle.innerText = "Create Master Account";
    });
  }

  // Toggle to Login Form
  if (linkBackLogin) {
    linkBackLogin.addEventListener('click', (e) => {
      e.preventDefault();
      signupForm.style.display = 'none';
      loginForm.style.display = 'block';
      if (subtitle) subtitle.innerText = "Billing Software";
    });
  }

  // --- SIGNUP LOGIC ---
  signupForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('signup-id').value.trim();
    const mobile = document.getElementById('signup-mobile').value.trim();

    if (name.length < 2) {
      showMsg('Name must be at least 2 characters.', 'error');
      return;
    }
    if (mobile.length < 10) {
      showMsg('Please enter a valid 10-digit mobile number.', 'error');
      return;
    }

    // Save user to browser storage
    const user = { name: name, mobile: mobile };
    localStorage.setItem('sj_user', JSON.stringify(user));

    showMsg('Account created successfully! Please login.', 'success', () => {
      signupForm.reset();
      signupForm.style.display = 'none';
      loginForm.style.display = 'block';
      if (subtitle) subtitle.innerText = "Billing Software";
      
      // Auto-fill the name for convenience
      document.getElementById('login-id').value = name;
    });
  });

  // --- LOGIN LOGIC ---
  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const nameInput = document.getElementById('login-id').value.trim();
    const mobileInput = document.getElementById('login-mobile').value.trim();
    
    const currentUser = JSON.parse(localStorage.getItem('sj_user'));

    // Check if account exists
    if (!currentUser) {
      showMsg('No account found. Please click "Create New Account" first.', 'error');
      return;
    }

    // Check credentials
    if (nameInput === currentUser.name && mobileInput === currentUser.mobile) {
      // Success! Create Session
      localStorage.setItem('sj_logged_in', 'true');
      
      showMsg('Login successful! Redirecting...', 'success', () => {
        window.location.href = 'dashboard.html';
      });

    } else {
      showMsg('Invalid Name or Mobile Number. Please try again.', 'error');
    }
  });
});